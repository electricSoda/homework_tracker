// Future integration seam. The tracker does not need Google APIs to function.
// When calendar sync is added, implement this provider without changing the UI
// or priority/scheduling domain code.
export const googleCalendarProvider = {
  async getBusyWindows() {
    return []
  },

  async createStudyBlock() {
    throw new Error('Google Calendar integration is not enabled yet.')
  },
}
