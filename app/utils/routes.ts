// Auth entry points reachable without a session. Single source of truth,
// shared by the global auth guard (app/middleware/auth.global.ts) and the
// app shell (app/app.vue, which hides the bottom nav on these routes).
export const PUBLIC_AUTH_PATHS = new Set([
  '/login',
  '/register',
  '/reset-password',
  '/verify-email',
])
