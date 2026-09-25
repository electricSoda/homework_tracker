import { useMemo, useState } from 'react'
import { buildStudyPlan } from '../domain/scheduler'
import { formatRelativeDue } from '../domain/priority'

export default function StudyPlanner({ tasks, now }) {
  const [available, setAvailable] = useState(60)
  const plan = useMemo(() => buildStudyPlan(tasks, available, now), [tasks, available, now])
  const planned = plan.reduce((sum, item) => sum + item.minutes, 0)

  return (
    <section className="planner">
      <div className="planner__head">
        <div>
          <p className="eyebrow">FOCUS</p>
        </div>
        <div className="planner-controls">
          {[30, 60, 90].map((value) => (
            <button
              key={value}
              className={`seg-button ${available === value ? 'is-active' : ''}`}
              onClick={() => setAvailable(value)}
            >
              {value}m
            </button>
          ))}
        </div>
      </div>

      {plan.length ? (
        <div className="plan-list">
          {plan.map(({ task, minutes }, index) => (
            <div className="plan-item" key={task.id}>
              <span className="plan-index">{index + 1}</span>
              <div className="plan-copy">
                <strong>{task.title}</strong>
                <span>{task.course || 'General'} · {formatRelativeDue(task, now)}</span>
              </div>
              <span className="plan-minutes">{minutes}m</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="planner-empty">Nothing needs attention right now.</div>
      )}
    </section>
  )
}
