// Auth entry points reachable without a session. Single source of truth,
// shared by the global auth guard (app/middleware/auth.global.ts) and the
// app shell (app/app.vue, which hides the bottom nav on these routes).
export const PUBLIC_AUTH_PATHS = new Set([
  '/login',
  '/register',
  '/reset-password',
  '/verify-email',
])

// OAuth consent UI (design: docs/oauth-provider-tech-design.md §7). Deliberately
// NOT in PUBLIC_AUTH_PATHS: the page requires a session — the guard bounces
// unauthenticated visitors to /login, preserving the authorization_id.
export const OAUTH_CONSENT_PATH = '/oauth/consent'

// Strict internal-redirect guard for ?redirect= handling after login/registration:
// only same-origin absolute paths are accepted. Rejects anything that could leave
// the app — external URLs, protocol-relative URLs (//evil.com), and backslash
// paths that browsers may normalize into an external origin.
export function sanitizeInternalRedirect(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return null
  return raw
}
