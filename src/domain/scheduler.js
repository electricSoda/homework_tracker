import { priorityRatio, remainingMinutes, clamp } from './priority.js'

function roundToFive(value) {
  return Math.max(5, Math.round(value / 5) * 5)
}

/**
 * Greedy, deterministic scheduler. It deliberately has no calendar knowledge yet.
 * A future Google Calendar adapter can provide busy windows; the scoring logic can
 * remain unchanged and simply be fed the actual free minutes for the day.
 */
export function buildStudyPlan(tasks, availableMinutes, now = new Date()) {
  const candidates = tasks
    .filter((task) => task.progress < 100 && remainingMinutes(task) > 0)
    .map((task) => {
      const ratio = priorityRatio(task, now)
      const urgency = 1 / Math.max(0.25, Number.isFinite(ratio) ? ratio : 0.25)
      const remaining = remainingMinutes(task)
      // Urgency drives the order; remaining work breaks ties without drowning out urgency.
      const weight = urgency * Math.sqrt(remaining)
      const ideal = clamp(10 + urgency * 8 + remaining * 0.18, 10, 45)
      return { task, ratio, weight, ideal }
    })
    .sort((a, b) => b.weight - a.weight)

  if (!candidates.length || availableMinutes <= 0) return []

  let budget = Math.max(0, availableMinutes)
  const plan = []

  for (const item of candidates) {
    if (budget < 10) break
    const minutes = Math.min(
      Math.max(10, roundToFive(item.ideal)),
      Math.round(remainingMinutes(item.task)),
      budget,
    )
    if (minutes < 10) continue

    plan.push({
      task: item.task,
      minutes,
      ratio: item.ratio,
    })
    budget -= minutes
  }

  // If there is still time, give it back to the most urgent task in 10-minute chunks.
  let index = 0
  while (budget >= 10 && plan.length) {
    const slot = plan[index % plan.length]
    const remaining = remainingMinutes(slot.task)
    const extra = Math.min(10, Math.max(0, Math.round(remaining - slot.minutes)))
    if (extra <= 0) {
      index += 1
      if (index > plan.length * 2) break
      continue
    }
    slot.minutes += extra
    budget -= extra
    index += 1
  }

  return plan
}
