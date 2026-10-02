const STORAGE_KEY = 'cmu-homework-tracker:v1'
const BACKUP_KEY = `${STORAGE_KEY}:backup`
const DELETED_KEY = `${STORAGE_KEY}:deleted`
const CLEARED_AT_KEY = `${STORAGE_KEY}:cleared-at`

import { createClient } from '@supabase/supabase-js'

const ENV = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {}

export function mergeTaskUpdates(currentTasks = [], remoteTasks = []) {
  const latestById = new Map()

  for (const task of [...currentTasks, ...remoteTasks]) {
    if (!task || !task.id) continue

    const current = latestById.get(task.id)
    const currentTime = current ? new Date(current.updatedAt || 0).getTime() : Number.NEGATIVE_INFINITY
    const incomingTime = new Date(task.updatedAt || 0).getTime()

    if (!current || incomingTime > currentTime) {
      latestById.set(task.id, task)
    }
  }

  return [...latestById.values()].sort((left, right) => {
    const leftTime = new Date(left.updatedAt || 0).getTime()
    const rightTime = new Date(right.updatedAt || 0).getTime()
    return leftTime - rightTime
  })
}

export function findDeletedTaskIds(currentTasks = [], remoteTasks = []) {
  const currentIds = new Set(
    (currentTasks || [])
      .filter((task) => task && task.id)
      .map((task) => task.id)
  )

  return (remoteTasks || [])
    .filter((task) => task && task.id && !currentIds.has(task.id))
    .map((task) => task.id)
}

class LocalBackup {
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      return raw ? JSON.parse(raw) : null
    } catch (e) {
      console.warn('Failed to load local backup:', e)
      return null
    }
  }

  save(tasks) {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(tasks)
      )
    } catch (e) {
      console.warn('Failed to save local backup:', e)
    }
  }

  clear() {
    localStorage.removeItem(STORAGE_KEY)
  }

  deletedIds() {
    try {
      const raw = localStorage.getItem(DELETED_KEY)
      const entries = raw ? JSON.parse(raw) : []
      if (Array.isArray(entries)) return Object.fromEntries(entries.map((id) => [id, '']))
      return entries && typeof entries === 'object' ? entries : {}
    } catch (e) {
      console.warn('Failed to load deleted task markers:', e)
      return []
    }
  }

  markDeleted(ids, deletedAt = new Date().toISOString()) {
    const deleted = this.deletedIds()
    for (const id of ids.filter(Boolean)) deleted[id] = deletedAt
    localStorage.setItem(DELETED_KEY, JSON.stringify(deleted))
  }

  unmarkDeleted(tasks) {
    const deleted = this.deletedIds()
    for (const task of tasks) {
      const deletedAt = deleted[task.id]
      if (deletedAt && new Date(task.updatedAt || 0).getTime() > new Date(deletedAt).getTime()) {
        delete deleted[task.id]
      }
    }
    localStorage.setItem(DELETED_KEY, JSON.stringify(deleted))
  }

  clearedAt() {
    return localStorage.getItem(CLEARED_AT_KEY) || ''
  }

  markCleared() {
    localStorage.setItem(CLEARED_AT_KEY, new Date().toISOString())
  }
}

class SupabaseRepository {
  constructor() {
    const url = ENV.VITE_SUPABASE_URL
    const key = ENV.VITE_SUPABASE_ANON_KEY

    if (!url || !key) {
      this.client = null
      return
    }

    this.client = createClient(url, key)
    this.table = 'tasks'
  }

  async load() {
    if (!this.client) {
      throw new Error('Supabase is not configured')
    }

    const { data, error } = await this.client
      .from(this.table)
      .select('id, data, updated_at')
      .order('updated_at', { ascending: true })

    if (error) {
      throw error
    }

    return (data ?? []).map((row) => ({
      ...row.data,
      updatedAt: row.data?.updatedAt ?? row.updated_at ?? new Date().toISOString(),
    }))
  }

  async save(tasks) {
    if (!this.client) {
      throw new Error('Supabase is not configured')
    }

    const incoming = Array.isArray(tasks) ? tasks : []
    const { data: remoteRows, error: remoteRowsError } = await this.client
      .from(this.table)
      .select('id, data, updated_at')

    if (remoteRowsError) {
      throw remoteRowsError
    }

    const remoteById = new Map((remoteRows ?? []).map((row) => [row.id, row]))
    const incomingById = new Map(incoming.filter((task) => task && task.id).map((task) => [task.id, task]))
    const rows = [...incomingById.values()].flatMap((task) => {
      const normalized = {
        ...task,
        updatedAt: task.updatedAt || new Date().toISOString(),
      }
      const remoteRow = remoteById.get(normalized.id)
      const remoteTime = new Date(remoteRow?.data?.updatedAt ?? remoteRow?.updated_at ?? 0).getTime()
      const localTime = new Date(normalized.updatedAt).getTime()

      // A delayed save must never replace a newer task already stored remotely.
      if (remoteRow && remoteTime > localTime) return []

      return [{
        id: normalized.id,
        data: normalized,
        updated_at: normalized.updatedAt,
      }]
    })

    if (!rows.length) return

    const { error } = await this.client
      .from(this.table)
      .upsert(rows, {
        onConflict: 'id',
      })

    if (error) {
      throw error
    }
  }

  async delete(ids) {
    if (!this.client) {
      throw new Error('Supabase is not configured')
    }

    const targetIds = (Array.isArray(ids) ? ids : [ids]).filter(Boolean)
    if (!targetIds.length) {
      return
    }

    const { error } = await this.client
      .from(this.table)
      .delete()
      .in('id', targetIds)

    if (error) {
      throw error
    }
  }

  async clear() {
    if (!this.client) {
      throw new Error('Supabase is not configured')
    }

    const { error } = await this.client
      .from(this.table)
      .delete()
      .neq('id', '')

    if (error) {
      throw error
    }
  }
}

const local = new LocalBackup()
const remote = new SupabaseRepository()
let remoteWriteQueue = Promise.resolve()

function queueRemoteWrite(operation) {
  const result = remoteWriteQueue.then(operation)
  remoteWriteQueue = result.catch(() => {})
  return result
}

export const taskRepository = {
  async load() {
    try {
      const remoteTasks = await remote.load()
      const deleted = local.deletedIds()
      const clearedAt = new Date(local.clearedAt() || 0).getTime()
      const visibleRemote = remoteTasks.filter((task) => (
        !deleted[task.id] && new Date(task.updatedAt || 0).getTime() > clearedAt
      ))
      const current = (local.load() ?? []).filter((task) => !deleted[task.id])
      const next = mergeTaskUpdates(current, visibleRemote)
      local.save(next)
      return next
    } catch (e) {
      console.warn('Supabase unavailable; using local backup:', e)
      const deleted = local.deletedIds()
      const clearedAt = new Date(local.clearedAt() || 0).getTime()
      return (local.load() ?? []).filter((task) => (
        !deleted[task.id] && new Date(task.updatedAt || 0).getTime() > clearedAt
      ))
    }
  },

  async save(tasks) {
    const incoming = Array.isArray(tasks) ? tasks : []
    const deleted = local.deletedIds()
    const clearedAt = new Date(local.clearedAt() || 0).getTime()
    const sanitized = incoming.filter((task) => (
      task?.id && new Date(task.updatedAt || 0).getTime() > Math.max(
        clearedAt,
        new Date(deleted[task.id] || 0).getTime()
      )
    ))
    local.unmarkDeleted(sanitized)
    const previous = local.load() ?? []
    const previousById = new Map(previous.map((task) => [task.id, task]))
    const protectedTasks = sanitized.map((task) => {
      const current = previousById.get(task.id)
      return current && new Date(current.updatedAt || 0).getTime() > new Date(task.updatedAt || 0).getTime()
        ? current
        : task
    })
    local.save(protectedTasks)

    try {
      await queueRemoteWrite(() => remote.save(protectedTasks))
      return true
    } catch (e) {
      console.error('Failed to save tasks to Supabase:', e)
      return false
    }
  },

  async deleteTask(id) {
    const deletedAt = new Date().toISOString()
    const current = local.load() ?? []
    local.save(current.filter((task) => task.id !== id))
    local.markDeleted([id], deletedAt)

    try {
      await queueRemoteWrite(() => remote.delete(id))
      return true
    } catch (e) {
      console.error('Failed to delete task from Supabase:', e)
      return false
    }
  },

  async clear() {
    const current = local.load() ?? []
    local.markCleared()
    local.markDeleted(current.map((task) => task.id))
    local.clear()

    try {
      await queueRemoteWrite(() => remote.clear())
      return true
    } catch (e) {
      console.error('Failed to clear tasks from Supabase:', e)
      return false
    }
  },
}

export const STORAGE_KEY_NAME = STORAGE_KEY