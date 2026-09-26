const STORAGE_KEY = 'cmu-homework-tracker:v1'
const BACKUP_KEY = `${STORAGE_KEY}:backup`

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
    const incomingIds = new Set(
      incoming
        .filter((task) => task && task.id)
        .map((task) => task.id)
    )

    const { data: remoteRows, error: remoteRowsError } = await this.client
      .from(this.table)
      .select('id')

    if (remoteRowsError) {
      throw remoteRowsError
    }

    const staleIds = (remoteRows ?? [])
      .map((row) => row.id)
      .filter((id) => id && !incomingIds.has(id))

    if (staleIds.length > 0) {
      const { error: deleteError } = await this.client
        .from(this.table)
        .delete()
        .in('id', staleIds)

      if (deleteError) {
        throw deleteError
      }
    }

    const rows = incoming.map((task) => {
      const normalized = {
        ...task,
        updatedAt: task.updatedAt || new Date().toISOString(),
      }

      return {
        id: normalized.id,
        data: normalized,
        updated_at: normalized.updatedAt,
      }
    })

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

export const taskRepository = {
  async load() {
    try {
      const remoteTasks = await remote.load()
      const next = mergeTaskUpdates(local.load() ?? [], remoteTasks)
      local.save(next)
      return next
    } catch (e) {
      console.warn('Supabase unavailable; using local backup:', e)
      return local.load() ?? []
    }
  },

  async save(tasks) {
    const sanitized = Array.isArray(tasks) ? tasks : []

    try {
      await remote.save(sanitized)
      local.save(sanitized)
      return true
    } catch (e) {
      console.error('Failed to save tasks to Supabase:', e)
      local.save(sanitized)
      return false
    }
  },

  async deleteTask(id) {
    try {
      await remote.delete(id)
      const current = local.load() ?? []
      const next = current.filter((task) => task.id !== id)
      local.save(next)
      return true
    } catch (e) {
      console.error('Failed to delete task from Supabase:', e)
      return false
    }
  },

  async clear() {
    try {
      await remote.clear()
      local.clear()
      return true
    } catch (e) {
      console.error('Failed to clear tasks from Supabase:', e)
      local.clear()
      return false
    }
  },
}

export const STORAGE_KEY_NAME = STORAGE_KEY