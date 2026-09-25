import { useMemo, useState } from 'react'
import { defaultRecurrenceFor } from '../domain/recurrence'

function localDateTimeInputValue(date = new Date()) {
  const pad = (v) => String(v).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function makeInitial() {
  const date = new Date()
  date.setHours(23, 59, 0, 0)
  return {
    title: '',
    course: '',
    dueAt: localDateTimeInputValue(date),
    estimateMinutes: 60,
    progress: 0,
    recurrence: defaultRecurrenceFor(date.toISOString()),
  }
}

export default function TaskForm({ onAdd, onClose }) {
  const [form, setForm] = useState(makeInitial)
  const [showSchedule, setShowSchedule] = useState(false)

  const weekDays = useMemo(() => [
    ['S', 0], ['M', 1], ['T', 2], ['W', 3], ['T', 4], ['F', 5], ['S', 6],
  ], [])

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function submit(event) {
    event.preventDefault()
    if (!form.title.trim()) return

    onAdd({
      ...form,
      title: form.title.trim(),
      course: form.course.trim(),
      estimateMinutes: Math.max(5, Number(form.estimateMinutes) || 60),
      progress: Math.min(100, Math.max(0, Number(form.progress) || 0)),
      recurrence: form.recurrence?.frequency === 'none'
        ? { frequency: 'none', daysOfWeek: [], until: '' }
        : form.recurrence,
    })
  }

  return (
    <form className="add-panel" onSubmit={submit}>
      <div className="add-panel__main">
        <input
          autoFocus
          className="title-input"
          value={form.title}
          onChange={(e) => update('title', e.target.value)}
          placeholder="What do you need to do?"
          aria-label="Task name"
        />
        <input
          className="course-input"
          value={form.course}
          onChange={(e) => update('course', e.target.value)}
          placeholder="Course"
          aria-label="Course"
        />
        <input
          className="date-input"
          type="datetime-local"
          value={form.dueAt}
          onChange={(e) => update('dueAt', e.target.value)}
          aria-label="Deadline"
        />
        <div className="estimate-input-wrap">
          <input
            className="number-input"
            type="number"
            min="5"
            step="5"
            value={form.estimateMinutes}
            onChange={(e) => update('estimateMinutes', e.target.value)}
            aria-label="Estimated minutes"
          />
          <span>min</span>
        </div>
      </div>

      <div className="add-panel__subrow">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={showSchedule}
            onChange={(e) => setShowSchedule(e.target.checked)}
          />
          Repeat
        </label>

        {showSchedule && (
          <div className="repeat-controls">
            <select
              value={form.recurrence.frequency}
              onChange={(e) => {
                const frequency = e.target.value
                setForm((current) => ({
                  ...current,
                  recurrence: {
                    ...current.recurrence,
                    frequency,
                    daysOfWeek: frequency === 'weekly' && current.recurrence.daysOfWeek.length
                      ? current.recurrence.daysOfWeek
                      : [new Date(current.dueAt).getDay()],
                  },
                }))
              }}
            >
              <option value="none">Never</option>
              <option value="daily">Every day</option>
              <option value="weekly">Every week</option>
            </select>

            {form.recurrence.frequency === 'weekly' && (
              <div className="weekday-picker" aria-label="Days of week">
                {weekDays.map(([label, day]) => {
                  const checked = form.recurrence.daysOfWeek.includes(day)
                  return (
                    <label className={`day-chip ${checked ? 'is-active' : ''}`} key={`${label}-${day}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          const days = checked
                            ? form.recurrence.daysOfWeek.filter((d) => d !== day)
                            : [...form.recurrence.daysOfWeek, day].sort()
                          setForm((current) => ({
                            ...current,
                            recurrence: { ...current.recurrence, daysOfWeek: days },
                          }))
                        }}
                      />
                      {label}
                    </label>
                  )
                })}
              </div>
            )}

            {form.recurrence.frequency !== 'none' && (
              <label className="until-input">
                Until
                <input
                  type="date"
                  value={form.recurrence.until}
                  onChange={(e) => setForm((current) => ({
                    ...current,
                    recurrence: { ...current.recurrence, until: e.target.value },
                  }))}
                />
              </label>
            )}
          </div>
        )}

        <div className="add-panel__spacer" />
        <button type="button" className="button button--ghost" onClick={onClose}>Cancel</button>
        <button type="submit" className="button button--primary">Add task</button>
      </div>
    </form>
  )
}
