import test from 'node:test'
import assert from 'node:assert/strict'

import { buildStudyPlan } from './scheduler.js'

test('focus session plan allocates actionable minutes to unfinished tasks within budget', () => {
  const now = new Date('2026-10-02T12:00:00.000Z')
  const tasks = [
    {
      id: 'soon',
      title: 'Read chapter',
      course: 'Biology',
      dueAt: '2026-10-03T12:00:00.000Z',
      estimateMinutes: 90,
      progress: 0,
    },
    {
      id: 'later',
      title: 'Review notes',
      course: 'History',
      dueAt: '2026-10-20T12:00:00.000Z',
      estimateMinutes: 60,
      progress: 25,
    },
    {
      id: 'done',
      title: 'Finished work',
      dueAt: '2026-10-01T12:00:00.000Z',
      estimateMinutes: 15,
      progress: 100,
    },
  ]

  const plan = buildStudyPlan(tasks, 30, now)
  const totalMinutes = plan.reduce((sum, item) => sum + item.minutes, 0)

  assert.ok(plan.length > 0)
  assert.ok(totalMinutes <= 30)
  assert.ok(plan.every((item) => item.minutes >= 10))
  assert.ok(plan.every((item) => item.task.progress < 100))
  assert.equal(plan[0].task.id, 'soon')
})