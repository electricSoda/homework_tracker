import test from 'node:test'
import assert from 'node:assert/strict'

import { findDeletedTaskIds, mergeTaskUpdates } from './taskRepository.js'

test('mergeTaskUpdates prefers the newest updatedAt value per task id', () => {
  const current = [
    { id: 'a', title: 'old', updatedAt: '2025-01-01T00:00:00.000Z' },
    { id: 'b', title: 'stay', updatedAt: '2025-01-02T00:00:00.000Z' },
  ]

  const remote = [
    { id: 'a', title: 'newer', updatedAt: '2025-01-03T00:00:00.000Z' },
    { id: 'c', title: 'added', updatedAt: '2025-01-04T00:00:00.000Z' },
  ]

  assert.deepEqual(mergeTaskUpdates(current, remote), [
    { id: 'b', title: 'stay', updatedAt: '2025-01-02T00:00:00.000Z' },
    { id: 'a', title: 'newer', updatedAt: '2025-01-03T00:00:00.000Z' },
    { id: 'c', title: 'added', updatedAt: '2025-01-04T00:00:00.000Z' },
  ])
})

test('findDeletedTaskIds identifies stale tasks that must be removed from remote storage', () => {
  const current = [
    { id: 'a', title: 'kept', updatedAt: '2025-01-01T00:00:00.000Z' },
  ]

  const remote = [
    { id: 'a', title: 'kept', updatedAt: '2025-01-01T00:00:00.000Z' },
    { id: 'b', title: 'deleted', updatedAt: '2025-01-02T00:00:00.000Z' },
  ]

  assert.deepEqual(findDeletedTaskIds(current, remote), ['b'])
})
