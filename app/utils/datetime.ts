// Relative-time formatting for list cards ("2d ago" per product-design §6.2).
// Pure function with an injectable `now` so tests are deterministic. `now`
// defaults to a lazy new Date() — evaluated per call, not per module load.

const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const diff = Math.max(0, now.getTime() - then) // clamp future clock skew

  if (diff < MINUTE_MS) return 'just now'
  if (diff < HOUR_MS) return `${Math.floor(diff / MINUTE_MS)}m ago`
  if (diff < DAY_MS) return `${Math.floor(diff / HOUR_MS)}h ago`
  if (diff < 7 * DAY_MS) return `${Math.floor(diff / DAY_MS)}d ago`
  if (diff < 30 * DAY_MS) return `${Math.floor(diff / (7 * DAY_MS))}w ago`
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
