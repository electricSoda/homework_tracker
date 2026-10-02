import test from 'node:test'
import assert from 'node:assert/strict'

import { advanceRecurringTask, nextOccurrence } from './recurrence.js'

test('advancing a completed daily task schedules the next occurrence and resets completion', () => {
  const task = {
    id: 'daily-task',
    dueAt: '2026-10-02T17:30:00.000Z',
    progress: 100,
    completedAt: '2026-10-02T16:00:00.000Z',
    recurrence: { frequency: 'daily', daysOfWeek: [], until: '' },
    updatedAt: '2026-10-02T16:00:00.000Z',
  }

  const advanced = advanceRecurringTask(task)

  assert.equal(advanced.dueAt, '2026-10-03T17:30:00.000Z')
  assert.equal(advanced.progress, 0)
  assert.equal(advanced.completedAt, null)
  assert.ok(advanced.updatedAt >= task.updatedAt)
})

test('recurrence ending before the next date does not schedule another occurrence', () => {
  const task = {
    dueAt: '2026-10-02T17:30:00.000Z',
    recurrence: { frequency: 'daily', daysOfWeek: [], until: '2026-10-02' },
  }

  assert.equal(nextOccurrence(task), null)
  assert.equal(advanceRecurringTask(task), null)
})
