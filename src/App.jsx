import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import TaskForm from './components/TaskForm.jsx'
import TaskRow from './components/TaskRow.jsx'
import StudyPlanner from './components/StudyPlanner.jsx'
import TopBar from './components/TopBar.jsx'
import { sortTasks } from './domain/priority.js'
import { advanceRecurringTask } from './domain/recurrence.js'
import { taskRepository } from './storage/taskRepository.js'

function createId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function makeTask(input) {
  return {
    id: createId(),
    title: input.title,
    course: input.course || '',
    dueAt: new Date(input.dueAt).toISOString(),
    estimateMinutes: Math.max(5, Number(input.estimateMinutes) || 60),
    progress: Math.min(100, Math.max(0, Number(input.progress) || 0)),
    recurrence: input.recurrence || { frequency: 'none', daysOfWeek: [], until: '' },
    completedAt: input.progress >= 100 ? new Date().toISOString() : null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

function parseImported(data) {
  if (!Array.isArray(data)) throw new Error('Expected a JSON array of tasks.')
  return data.map((task) => ({
    ...task,
    id: task.id || createId(),
    title: String(task.title || 'Untitled task'),
    course: String(task.course || ''),
    estimateMinutes: Math.max(5, Number(task.estimateMinutes) || 60),
    progress: Math.min(100, Math.max(0, Number(task.progress) || 0)),
    dueAt: new Date(task.dueAt).toISOString(),
    recurrence: task.recurrence || { frequency: 'none', daysOfWeek: [], until: '' },
    completedAt: task.completedAt || null,
    createdAt: task.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }))
}

export default function App() {
  const [tasks, setTasks] = useState([])
  const [showAdd, setShowAdd] = useState(false)
  const [showFocus, setShowFocus] = useState(false)
  const [filter, setFilter] = useState('active')
  const [now, setNow] = useState(() => new Date())
  const [notice, setNotice] = useState('')
  const [isReady, setIsReady] = useState(false)
  const localRevision = useRef(0)
  const syncInFlight = useRef(false)
  const pendingWrites = useRef(0)

  useEffect(() => {
    let cancelled = false
    const startingRevision = localRevision.current

    async function bootstrapTasks() {
      const saved = await taskRepository.load()
      if (cancelled) return
      if (localRevision.current === startingRevision) {
        setTasks(Array.isArray(saved) ? saved : [])
      }
      setIsReady(true)
    }

    bootstrapTasks()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!isReady) return

    const timer = setInterval(async () => {
      if (syncInFlight.current || pendingWrites.current > 0) return
      syncInFlight.current = true
      const startingRevision = localRevision.current
      try {
        const latest = await taskRepository.load()
        setTasks((current) => {
          if (localRevision.current !== startingRevision || pendingWrites.current > 0) return current
          const next = Array.isArray(latest) ? latest : []
          return JSON.stringify(current) === JSON.stringify(next) ? current : next
        })
      } catch (error) {
        console.warn('Failed to sync tasks from Supabase:', error)
      } finally {
        syncInFlight.current = false
      }
    }, 5000)

    return () => clearInterval(timer)
  }, [isReady])

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!showAdd && !showFocus) return undefined
    function closeOnEscape(event) {
      if (event.key === 'Escape') {
        setShowAdd(false)
        setShowFocus(false)
      }
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [showAdd, showFocus])

  const activeCount = tasks.filter((task) => task.progress < 100).length
  const completedCount = tasks.length - activeCount

  const visibleTasks = useMemo(() => {
    let list = tasks
    if (filter === 'active') list = tasks.filter((task) => task.progress < 100)
    if (filter === 'completed') list = tasks.filter((task) => task.progress >= 100)
    if (filter === 'today') {
      const end = new Date(now)
      end.setHours(23, 59, 59, 999)
      list = tasks.filter((task) => new Date(task.dueAt) <= end && new Date(task.dueAt) >= now)
    }
    return sortTasks(list, now)
  }, [tasks, filter, now])

  async function persistTasks(nextTasks, options) {
    pendingWrites.current += 1
    try {
      const ok = await taskRepository.save(nextTasks, options)
      if (!ok) {
        setNotice('Supabase sync failed; your local backup was kept.')
        setTimeout(() => setNotice(''), 2200)
      }
    } finally {
      pendingWrites.current -= 1
    }
  }

  function addTask(input) {
    const next = [...tasks, makeTask(input)]
    localRevision.current += 1
    setTasks(next)
    setShowAdd(false)
    void persistTasks(next)
  }

  function toggleFocusSession() {
    setShowFocus(true)
  }

  function updateTask(updated) {
    const previous = tasks.find((task) => task.id === updated.id)
    const previousTime = new Date(previous?.updatedAt || 0).getTime()
    let normalized = {
      ...updated,
      updatedAt: new Date(Math.max(Date.now(), previousTime + 1)).toISOString(),
    }
    const completedNow = previous && previous.progress < 100 && normalized.progress >= 100
    if (completedNow) {
      normalized = advanceRecurringTask(normalized) || normalized
    }
    normalized.updatedAt = new Date(Math.max(Date.now(), previousTime + 1)).toISOString()
    const next = tasks.map((task) => (task.id === normalized.id ? normalized : task))
    localRevision.current += 1
    setTasks(next)
    void persistTasks(next, completedNow ? { forceIds: [normalized.id] } : undefined)
    return normalized
  }

  function deleteTask(id) {
    const next = tasks.filter((task) => task.id !== id)
    localRevision.current += 1
    setTasks(next)
    void taskRepository.deleteTask(id)
  }

  function exportBackup() {
    const payload = JSON.stringify(tasks, null, 2)
    const blob = new Blob([payload], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `homework-backup-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
    setNotice('Backup exported.')
    setTimeout(() => setNotice(''), 1800)
  }

  async function importBackup(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const imported = parseImported(JSON.parse(await file.text()))
      localRevision.current += 1
      setTasks(imported)
      const ok = await taskRepository.save(imported)
      if (!ok) {
        setNotice('Imported locally, but Supabase sync failed.')
      } else {
        setNotice(`Imported ${imported.length} tasks.`)
      }
    } catch {
      setNotice('Could not import that file.')
    }
    setTimeout(() => setNotice(''), 2200)
  }

  async function clearAll() {
    if (!window.confirm('Clear every local task? Export a backup first if you want to keep them.')) return
    localRevision.current += 1
    setTasks([])
    const ok = await taskRepository.clear()
    setNotice(ok ? 'Cleared local tasks.' : 'Local tasks cleared, but remote sync failed.')
    setTimeout(() => setNotice(''), 1800)
  }

  return (
    <main className="app-shell">
      <div className="app-container">
        <TopBar
          onAdd={() => setShowAdd((value) => !value)}
          onExport={exportBackup}
          onImport={importBackup}
          activeCount={activeCount}
          onFocus={toggleFocusSession}
        />

        {showAdd && createPortal(
          <div className="modal-backdrop" onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowAdd(false)
          }}>
            <section className="task-modal" role="dialog" aria-modal="true" aria-labelledby="new-task-heading">
              <div className="task-modal__head">
                <div>
                  <p className="eyebrow">NEW ITEM</p>
                  <h2 id="new-task-heading">Add a task</h2>
                </div>
                <button className="modal-close" type="button" onClick={() => setShowAdd(false)} aria-label="Close">×</button>
              </div>
              <TaskForm onAdd={addTask} onClose={() => setShowAdd(false)} />
            </section>
          </div>,
          document.body
        )}

        {showFocus && createPortal(
          <div className="modal-backdrop" onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowFocus(false)
          }}>
            <section className="task-modal focus-modal" role="dialog" aria-modal="true" aria-labelledby="focus-heading">
              <div className="task-modal__head">
                <div>
                  <p className="eyebrow">OPTIONAL</p>
                  <h2 id="focus-heading">Build a focus session</h2>
                </div>
                <button className="modal-close" type="button" onClick={() => setShowFocus(false)} aria-label="Close">×</button>
              </div>
              <StudyPlanner tasks={tasks} now={now} />
            </section>
          </div>,
          document.body
        )}

        {notice && <div className="notice" role="status">{notice}</div>}

        <section className="masterview">
          <div className="masterview__head">
            <div>
              <p className="eyebrow">YOUR WORK</p>
              <h2>{filter === 'completed' ? 'Completed' : 'Up next'}</h2>
            </div>
            <div className="filters" role="tablist" aria-label="Task filters">
              {[
                ['active', `Active · ${activeCount}`],
                ['today', 'Today'],
                ['all', 'All'],
                ['completed', `Done · ${completedCount}`],
              ].map(([value, label]) => (
                <button
                  key={value}
                  className={`filter-button ${filter === value ? 'is-active' : ''}`}
                  onClick={() => setFilter(value)}
                  role="tab"
                  aria-selected={filter === value}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="task-list-viewport" aria-label="Tasks">
            <div className="task-list">
              {visibleTasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  now={now}
                  onChange={updateTask}
                  onDelete={deleteTask}
                />
              ))}
            </div>

            {!visibleTasks.length && (
              <div className="empty-state">
                <div className="empty-state__icon">✓</div>
                <h3>Nothing here.</h3>
                <p>Add a task, or switch the filter to see completed work.</p>
                <button className="button button--primary" onClick={() => setShowAdd(true)}>＋ Add task</button>
              </div>
            )}
          </div>
        </section>

        {/* <footer className="footer">
        </footer> */}
      </div>
    </main>
  )
}
