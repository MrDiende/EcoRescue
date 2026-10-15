/** An empty in-memory model; user accounts are loaded from Supabase Auth. */
export function emptyDatabase() {
  return {
    users: [],
    routes: [],
    schedules: [],
    trucks: [],
    reports: [],
    notifications: [],
    announcements: [],
    gps: [],
    issues: [],
    activity: [],
  };
}
