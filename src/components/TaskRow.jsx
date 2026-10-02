import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { formatDateTime, formatRatio, formatRelativeDue, urgencyLevel } from '../domain/priority'

function dateTimeInputValue(value) {
  const date = new Date(value)
  const pad = (v) => String(v).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export default function TaskRow({ task, now, onChange, onDelete }) {
  const [showDetails, setShowDetails] = useState(false)
  const level = urgencyLevel(task, now)
  const recurrenceLabel = useMemo(() => {
    if (!task.recurrence || task.recurrence.frequency === 'none') return ''
    if (task.recurrence.frequency === 'daily') return 'Daily'
    return task.recurrence.daysOfWeek?.length === 7 ? 'Weekly' : 'Weekly'
  }, [task.recurrence])

  const [draftProgress, setDraftProgress] = useState(task.progress)
  const [draftTitle, setDraftTitle] = useState(task.title)
  const [draftEstimate, setDraftEstimate] = useState(String(task.estimateMinutes))
  const [draftCourse, setDraftCourse] = useState(task.course || '')
  const titleInput = useRef(null)
  const titleEditing = useRef(false)
  const estimateEditing = useRef(false)

  useLayoutEffect(() => {
    setDraftProgress(task.progress)
  }, [task.progress, task.dueAt])

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

  useEffect(() => {
    setDraftCourse(task.course || '')
  }, [task.course])

  function patch(patch) {
    onChange({
      ...task,
      ...patch,
      updatedAt: new Date().toISOString(),
    })
  }

  function commitProgress(value) {
    const progress = Number(value)
    if (progress === task.progress) return
    const completed = {
      ...task,
      progress,
      completedAt: progress >= 100 ? new Date().toISOString() : null,
      updatedAt: new Date().toISOString(),
    }
    const persisted = onChange(completed)
    if (persisted) setDraftProgress(persisted.progress)
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

  function commitCourse() {
    const course = draftCourse.trim()
    if (course !== (task.course || '')) patch({ course })
  }

  return (
    <article className={`task-row task-row--${level} ${task.progress >= 100 ? 'task-row--done' : ''}`}>
      <div className="task-main">
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
            <span className={`course-tag ${task.course ? '' : 'course-tag--empty'}`}>
              {task.course || 'No class tag'}
            </span>
            <span className="task-due-label" title={formatDateTime(task.dueAt)}>{formatRelativeDue(task, now)}</span>
          </div>
        </div>
      </div>

      <div className="task-progress">
        <div className="progress-header">
          <label htmlFor={`progress-${task.id}`}>Progress</label>
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
            onChange={(e) => setDraftProgress(Number(e.currentTarget.value))}
            onPointerUp={(e) => commitProgress(e.currentTarget.value)}
            onKeyUp={(e) => commitProgress(e.currentTarget.value)}
            onPointerCancel={(e) => {
              setDraftProgress(task.progress)
              e.currentTarget.blur()
            }}
            style={{ '--progress': `${draftProgress}%` }}
          />
      </div>

      <button
        type="button"
        className="row-disclosure"
        aria-expanded={showDetails}
        aria-controls={`task-details-${task.id}`}
        onClick={() => setShowDetails((shown) => !shown)}
        aria-label={`${showDetails ? 'Hide' : 'Show'} details for ${task.title}`}
      >
        <span aria-hidden="true">···</span>
      </button>

      <div className="task-details" id={`task-details-${task.id}`} hidden={!showDetails}>
        <div className="task-field task-course">
          <label htmlFor={`course-${task.id}`}>Class</label>
          <input
            id={`course-${task.id}`}
            type="text"
            value={draftCourse}
            onChange={(e) => setDraftCourse(e.target.value)}
            onBlur={commitCourse}
            placeholder="e.g. Biology 101"
            aria-label={`Class tag for ${task.title}`}
          />
        </div>

        <div className="task-field task-due">
          <label>Exact deadline</label>
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
          <label>Estimated time</label>
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
            <span>minutes</span>
          </div>
        </div>

        <div className="task-extra-meta">
          {recurrenceLabel && <span>Repeats {recurrenceLabel.toLowerCase()}</span>}
          <span title="Time until deadline divided by unfinished work">Time / work: {formatRatio(task, now)}</span>
        </div>

        <button className="delete-task" onClick={() => onDelete(task.id)} title="Delete task">Delete task</button>
      </div>
    </article>
  )
}
