const MIN_HOURS = 0.05

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

export function remainingMinutes(task) {
  return Math.max(0, task.estimateMinutes * (1 - task.progress / 100))
}

export function hoursUntil(dueAt, now = new Date()) {
  return (new Date(dueAt).getTime() - now.getTime()) / 3_600_000
}

/**
 * Lower is more urgent. This is intentionally close to the spreadsheet:
 * hours remaining / hours of unfinished work.
 */
export function priorityRatio(task, now = new Date()) {
  if (task.progress >= 100) return Number.POSITIVE_INFINITY

  const hoursLeft = hoursUntil(task.dueAt, now)
  const workHoursLeft = remainingMinutes(task) / 60

  if (workHoursLeft <= 0) return Number.POSITIVE_INFINITY
  return hoursLeft / workHoursLeft
}

export function urgencyLevel(task, now = new Date()) {
  if (task.progress >= 100) return 'done'
  const ratio = priorityRatio(task, now)
  const dueHours = hoursUntil(task.dueAt, now)

  if (dueHours < 0) return 'overdue'
  if (ratio <= 1) return 'critical'
  if (ratio <= 4) return 'urgent'
  if (ratio <= 12) return 'soon'
  return 'later'
}

export function urgencyLabel(task, now = new Date()) {
  const level = urgencyLevel(task, now)
  return {
    overdue: 'Overdue',
    critical: 'Critical',
    urgent: 'Urgent',
    soon: 'Soon',
    later: 'Later',
    done: 'Done',
  }[level]
}

export function sortTasks(tasks, now = new Date()) {
  return [...tasks].sort((a, b) => {
    const aDone = a.progress >= 100
    const bDone = b.progress >= 100
    if (aDone !== bDone) return aDone ? 1 : -1

    const aDue = new Date(a.dueAt).getTime()
    const bDue = new Date(b.dueAt).getTime()
    const aOverdue = aDue < now.getTime()
    const bOverdue = bDue < now.getTime()
    if (aOverdue !== bOverdue) return aOverdue ? -1 : 1

    const aRatio = priorityRatio(a, now)
    const bRatio = priorityRatio(b, now)
    if (aRatio !== bRatio) return aRatio - bRatio
    return aDue - bDue
  })
}

export function formatRatio(task, now = new Date()) {
  const ratio = priorityRatio(task, now)
  if (!Number.isFinite(ratio)) return '—'
  if (ratio < MIN_HOURS) return '<0.1×'
  if (ratio >= 100) return `${Math.round(ratio)}×`
  return `${ratio.toFixed(ratio < 10 ? 1 : 0)}×`
}

export function formatRelativeDue(task, now = new Date()) {
  const ms = new Date(task.dueAt).getTime() - now.getTime()
  const absMinutes = Math.round(Math.abs(ms) / 60_000)
  const prefix = ms < 0 ? '' : 'in '
  if (absMinutes < 60) return `${prefix}${absMinutes}m${ms < 0 ? ' ago' : ''}`

  const hours = Math.floor(absMinutes / 60)
  const minutes = absMinutes % 60
  if (hours < 48) return `${prefix}${hours}h ${minutes}m${ms < 0 ? ' ago' : ''}`

  const days = Math.floor(hours / 24)
  return `${prefix}${days}d${ms < 0 ? ' ago' : ''}`
}

export function formatDateTime(value) {
  const date = new Date(value)
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}
