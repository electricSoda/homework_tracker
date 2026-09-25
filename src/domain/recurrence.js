function endOfDay(dateString) {
  const result = new Date(`${dateString}T23:59:59`)
  result.setMilliseconds(999)
  return result
}

export function defaultRecurrenceFor(dueAt) {
  return {
    frequency: 'none',
    daysOfWeek: [new Date(dueAt).getDay()],
    until: '',
  }
}

export function nextOccurrence(task) {
  if (!task.recurrence || task.recurrence.frequency === 'none') return null

  const current = new Date(task.dueAt)
  const next = new Date(current)

  if (task.recurrence.frequency === 'daily') {
    next.setDate(next.getDate() + 1)
  } else if (task.recurrence.frequency === 'weekly') {
    const days = task.recurrence.daysOfWeek?.length
      ? [...task.recurrence.daysOfWeek].sort((a, b) => a - b)
      : [current.getDay()]

    let delta = 7
    for (const day of days) {
      const candidateDelta = (day - current.getDay() + 7) % 7
      if (candidateDelta > 0) {
        delta = Math.min(delta, candidateDelta)
      }
    }
    next.setDate(next.getDate() + delta)
  }

  if (task.recurrence.until) {
    const limit = endOfDay(task.recurrence.until)
    if (next > limit) return null
  }

  return next.toISOString()
}

export function advanceRecurringTask(task) {
  const next = nextOccurrence(task)
  if (!next) return null
  return {
    ...task,
    dueAt: next,
    progress: 0,
    completedAt: null,
    updatedAt: new Date().toISOString(),
  }
}
