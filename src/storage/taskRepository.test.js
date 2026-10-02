import test from 'node:test'
import assert from 'node:assert/strict'

import {
  findDeletedTaskIds,
  matchesPersistedTaskState,
  mergeTaskUpdates,
  shouldApplyRemoteTaskUpdate,
} from './taskRepository.js'

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

test('forced recurring reset can replace a stale remote completion', () => {
  const reset = { id: 'repeat', progress: 0, updatedAt: '2026-10-02T12:00:00.000Z' }
  const staleCompletion = { id: 'repeat', progress: 100, updatedAt: '2026-10-02T12:00:01.000Z' }

  assert.equal(shouldApplyRemoteTaskUpdate(reset, staleCompletion), false)
  assert.equal(shouldApplyRemoteTaskUpdate(reset, staleCompletion, true), true)
})

test('remote confirmation requires the recurring task progress reset to be stored', () => {
  const expected = {
    id: 'repeat',
    progress: 0,
    dueAt: '2026-10-03T12:00:00.000Z',
    completedAt: null,
  }

  assert.equal(matchesPersistedTaskState(expected, { ...expected }), true)
  assert.equal(matchesPersistedTaskState(expected, { ...expected, progress: 100 }), false)
})
