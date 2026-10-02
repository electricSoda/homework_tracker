import { useEffect, useMemo, useState } from 'react'
import { buildStudyPlan } from '../domain/scheduler'
import { formatRelativeDue } from '../domain/priority'

export default function StudyPlanner({ tasks, now }) {
  const [available, setAvailable] = useState(60)
  const [session, setSession] = useState(null)
  const plan = useMemo(() => buildStudyPlan(tasks, available, now), [tasks, available, now])

  useEffect(() => {
    if (!session?.running) return undefined
    const timer = window.setInterval(() => {
      setSession((current) => {
        if (!current?.running) return current
        const remainingSeconds = Math.max(0, Math.ceil((current.endsAt - Date.now()) / 1000))
        if (remainingSeconds === 0) return { ...current, remainingSeconds: 0, running: false, finished: true }
        return { ...current, remainingSeconds }
      })
    }, 250)
    return () => window.clearInterval(timer)
  }, [session?.running])

  const currentTask = session?.items[session.itemIndex]?.task
  const remaining = session?.remainingSeconds ?? 0
  const remainingLabel = `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`
  const totalSessionSeconds = session?.items.reduce((sum, item) => sum + item.minutes * 60, 0) || 0
  const sessionProgress = session && totalSessionSeconds
    ? Math.min(100, ((totalSessionSeconds - remaining) / totalSessionSeconds) * 100)
    : 0

  function startSession() {
    if (!plan.length) return
    const items = plan.map(({ task, minutes }) => ({ task, minutes }))
    const totalSeconds = items.reduce((sum, item) => sum + item.minutes * 60, 0)
    setSession({ items, itemIndex: 0, remainingSeconds: totalSeconds, endsAt: Date.now() + totalSeconds * 1000, running: true, finished: false })
  }

  function toggleSession() {
    setSession((current) => {
      if (!current) return current
      if (current.running) return { ...current, running: false }
      return { ...current, running: true, endsAt: Date.now() + current.remainingSeconds * 1000, finished: false }
    })
  }

  function advanceSession() {
    setSession((current) => {
      if (!current) return current
      const nextIndex = current.itemIndex + 1
      if (nextIndex >= current.items.length) return { ...current, running: false, finished: true, remainingSeconds: 0 }
      return { ...current, itemIndex: nextIndex }
    })
  }

  function resetSession() {
    setSession(null)
  }

  return (
      <div className="planner__content">
        {session ? (
          <section className="focus-session" aria-live="polite">
            <div className="focus-session__timer">
              <span className={`focus-session__orb ${session.running ? 'is-running' : ''}`} aria-hidden="true" />
              <div>
                <p className="eyebrow">{session.finished ? 'SESSION COMPLETE' : session.running ? 'FOCUSING NOW' : 'SESSION PAUSED'}</p>
                <strong className="focus-session__countdown">{remainingLabel}</strong>
                <span className="focus-session__position">Task {session.itemIndex + 1} of {session.items.length} · {session.items[session.itemIndex].minutes} min planned</span>
              </div>
              <div className="focus-session__actions">
                {!session.finished && <button type="button" className="button button--primary" onClick={toggleSession}>{session.running ? 'Pause' : 'Resume'}</button>}
                <button type="button" className="button button--ghost" onClick={resetSession}>End session</button>
              </div>
              <div className="focus-session__track" aria-label={`${Math.round(sessionProgress)} percent complete`}>
                <span style={{ width: `${sessionProgress}%` }} />
              </div>
            </div>
            {!session.finished && currentTask && (
              <div className="focus-session__current">
                <span className="eyebrow">CURRENT TASK · {session.items[session.itemIndex].minutes} MIN</span>
                <strong>{currentTask.title}</strong>
                {currentTask.course && <span className="course-tag">{currentTask.course}</span>}
                <button type="button" className="button button--ghost" onClick={advanceSession}>{session.itemIndex + 1 === session.items.length ? 'Finish session' : 'Next task →'}</button>
              </div>
            )}
          </section>
        ) : (
          <>
            <div className="planner__intro">
              <div>
                <p className="eyebrow">READY WHEN YOU ARE</p>
                <p className="planner__description">A simple timed plan, starting with your highest-priority work.</p>
              </div>
              <div className="planner-controls" aria-label="Available study time">
                {[30, 60, 90].map((value) => (
                  <button
                    type="button"
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
              <>
                <div className="plan-list">
                  {plan.map(({ task, minutes }, index) => (
                    <div className="plan-item" key={task.id}>
                      <span className="plan-index">{index + 1}</span>
                      <div className="plan-copy">
                        <strong>{task.title}</strong>
                        <span>
                          {task.course ? `${task.course} · ` : 'No class · '}{formatRelativeDue(task, now)}
                        </span>
                      </div>
                      <span className="plan-minutes">{minutes}m</span>
                    </div>
                  ))}
                </div>
                <div className="focus-session__start-row">
                  <span>{plan.length} task{plan.length === 1 ? '' : 's'} · {plan.reduce((sum, item) => sum + item.minutes, 0)} minutes</span>
                  <button type="button" className="button button--primary" onClick={startSession}>Start focus session <span aria-hidden="true">→</span></button>
                </div>
              </>
            ) : (
              <div className="planner-empty">No unfinished tasks are available for a focus session.</div>
            )}
          </>
        )}
      </div>
  )
}
