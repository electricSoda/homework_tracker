import { useEffect, useMemo, useRef, useState } from 'react'
import { formatDateTime, formatRatio, formatRelativeDue, urgencyLevel } from '../domain/priority'
import { advanceRecurringTask } from '../domain/recurrence'

function dateTimeInputValue(value) {
  const date = new Date(value)
  const pad = (v) => String(v).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export default function TaskRow({ task, now, onChange, onDelete }) {
  const level = urgencyLevel(task, now)
  const recurrenceLabel = useMemo(() => {
    if (!task.recurrence || task.recurrence.frequency === 'none') return ''
    if (task.recurrence.frequency === 'daily') return 'Daily'
    return task.recurrence.daysOfWeek?.length === 7 ? 'Weekly' : 'Weekly'
  }, [task.recurrence])

  const [draftProgress, setDraftProgress] = useState(task.progress)
  const [draftTitle, setDraftTitle] = useState(task.title)
  const [draftEstimate, setDraftEstimate] = useState(String(task.estimateMinutes))
  const titleInput = useRef(null)
  const titleEditing = useRef(false)
  const estimateEditing = useRef(false)

  useEffect(() => {
    setDraftProgress(task.progress)
  }, [task.progress])

  useEffect(() => {
    if (!titleEditing.current) setDraftTitle(task.title)
  }, [task.title])

  useEffect(() => {
    const input = titleInput.current
    if (!input) return
    input.style.height = 'auto'
    input.style.height = `${input.scrollHeight}px`
  }, [draftTitle])

  useEffect(() => {
    if (!estimateEditing.current) setDraftEstimate(String(task.estimateMinutes))
  }, [task.estimateMinutes])

  function patch(patch) {
    onChange({
      ...task,
      ...patch,
      updatedAt: new Date().toISOString(),
    })
  }

  function commitProgress() {
    const progress = Number(draftProgress)
    if (progress === task.progress) return
    const completed = {
      ...task,
      progress,
      completedAt: progress >= 100 ? new Date().toISOString() : null,
      updatedAt: new Date().toISOString(),
    }
    const nextOccurrenceTask = progress >= 100 ? advanceRecurringTask(completed) : null
    onChange(nextOccurrenceTask || completed)
  }

  function commitTitle() {
    const title = draftTitle.trim()
    if (!title) {
      setDraftTitle(task.title)
      return
    }
    if (title !== task.title) patch({ title })
  }

  function commitEstimate() {
    const minutes = Number(draftEstimate)
    if (!draftEstimate.trim() || !Number.isFinite(minutes)) {
      setDraftEstimate(String(task.estimateMinutes))
      return
    }
    patch({ estimateMinutes: Math.max(5, minutes) })
  }

  return (
    <article className={`task-row task-row--${level} ${task.progress >= 100 ? 'task-row--done' : ''}`}>
      <div className="task-main">
        <div className="task-status-dot" aria-hidden="true" />
        <div className="task-title-wrap">
          <textarea
            ref={titleInput}
            className="task-title"
            rows="1"
            value={draftTitle}
            onFocus={() => { titleEditing.current = true }}
            onChange={(e) => setDraftTitle(e.target.value)}
            onBlur={() => {
              titleEditing.current = false
              commitTitle()
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                e.currentTarget.blur()
              }
            }}
            aria-label={`Rename ${task.title}`}
          />
          <div className="task-meta">
            {task.course && <span className="course-pill">{task.course}</span>}
            {recurrenceLabel && <span className="recurrence-pill">↻ {recurrenceLabel}</span>}
            <span>{formatRelativeDue(task, now)}</span>
          </div>
        </div>
      </div>

      <div className="task-field task-due">
        <label>Deadline</label>
        <input
          type="datetime-local"
          value={dateTimeInputValue(task.dueAt)}
          onChange={(e) => {
            if (e.target.value) patch({ dueAt: new Date(e.target.value).toISOString() })
          }}
          title={formatDateTime(task.dueAt)}
        />
      </div>

      <div className="task-field task-estimate">
        <label>Est.</label>
        <div className="estimate-cell">
          <input
            type="number"
            min="5"
            step="5"
            value={draftEstimate}
            onFocus={() => { estimateEditing.current = true }}
            onChange={(e) => setDraftEstimate(e.target.value)}
            onBlur={() => {
              estimateEditing.current = false
              commitEstimate()
            }}
            aria-label={`Estimated minutes for ${task.title}`}
          />
          <span>m</span>
        </div>
      </div>

      <div className="task-progress">
        <div className="progress-header">
          <label htmlFor={`progress-${task.id}`}>Done</label>
          <span>{draftProgress}%</span>
        </div>
        <input
            id={`progress-${task.id}`}
            className="progress-slider"
            type="range"
            min="0"
            max="100"
            step="5"
            value={draftProgress}
            onChange={(e) => setDraftProgress(Number(e.target.value))}
            onPointerUp={commitProgress}
            onKeyUp={commitProgress}
            style={{ '--progress': `${draftProgress}%` }}
          />
      </div>

      <div className="task-priority">
        <span className="priority-chip">{formatRatio(task, now)}</span>
        <small>{level === 'done' ? 'complete' : 'time / work left'}</small>
      </div>

      <div className="task-actions">
        <button className="icon-button" onClick={() => onDelete(task.id)} title="Delete task" aria-label="Delete task">×</button>
      </div>
    </article>
  )
}
