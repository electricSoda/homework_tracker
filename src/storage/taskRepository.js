const STORAGE_KEY = 'cmu-homework-tracker:v1'

export class LocalTaskRepository {
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  }

  save(tasks) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks))
  }

  clear() {
    localStorage.removeItem(STORAGE_KEY)
  }
}

export const taskRepository = new LocalTaskRepository()

export const STORAGE_KEY_NAME = STORAGE_KEY
