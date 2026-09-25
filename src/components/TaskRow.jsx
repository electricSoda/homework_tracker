import { useEffect, useMemo, useState } from 'react'
import { formatDateTime, formatRatio, formatRelativeDue, urgencyLevel } from '../domain/priority'
import { advanceRecurringTask, nextOccurrence } from '../domain/recurrence'

function dateTimeInputValue(value) {
  const date = new Date(value)
  const pad = (v) => String(v).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export default function TaskRow({ task, now, onChange, onDelete }) {
  const level = urgencyLevel(task, now)
  const recurrenceNext = task.progress >= 100 ? nextOccurrence(task) : null
  const recurrenceLabel = useMemo(() => {
    if (!task.recurrence || task.recurrence.frequency === 'none') return ''
    if (task.recurrence.frequency === 'daily') return 'Daily'
    return task.recurrence.daysOfWeek?.length === 7 ? 'Weekly' : 'Weekly'
  }, [task.recurrence])

  const [draftProgress, setDraftProgress] = useState(task.progress)

  useEffect(() => {
    setDraftProgress(task.progress)
  }, [task.progress])

  function patch(patch) {
    onChange({
      ...task,
      ...patch,
      updatedAt: new Date().toISOString(),
    })
  }

  function commitProgress() {
    const progress = Number(draftProgress)

    patch({
      progress,
      completedAt: progress >= 100 ? new Date().toISOString() : null,
    })
  }

  function advance() {
    const next = advanceRecurringTask(task)
    if (next) onChange(next)
  }

  return (
    <article className={`task-row task-row--${level} ${task.progress >= 100 ? 'task-row--done' : ''}`}>
      <div className="task-main">
        <div className="task-status-dot" aria-hidden="true" />
        <div className="task-title-wrap">
          <input
            className="task-title"
            value={task.title}
            onChange={(e) => patch({ title: e.target.value })}
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
            value={task.estimateMinutes}
            onChange={(e) => patch({ estimateMinutes: Math.max(5, Number(e.target.value) || 5) })}
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
            style={{ '--progress': `${draftProgress}%` }}
          />
      </div>

      <div className="task-priority">
        <span className="priority-chip">{formatRatio(task, now)}</span>
        <small>{level === 'done' ? 'complete' : 'time / work left'}</small>
      </div>

      <div className="task-actions">
        {task.progress >= 100 && recurrenceNext && (
          <button className="icon-button icon-button--accent" onClick={advance} title="Advance to next occurrence" aria-label="Advance to next occurrence">↻</button>
        )}
        <button className="icon-button" onClick={() => onDelete(task.id)} title="Delete task" aria-label="Delete task">×</button>
      </div>
    </article>
  )
}
