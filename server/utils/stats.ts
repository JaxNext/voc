// Pure stats math for the /api/stats route — no I/O, no clock reads.
// Consumed by server/api/stats.get.ts; unit-tested in tests/server/stats.test.ts.
// Spec: docs/development-plan.md §2.3, docs/tech-design.md §7.

export interface DailyCount {
  date: string // YYYY-MM-DD
  count: number
}

function dayFormatter(timeZone: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

// True when the string is a valid IANA timezone (e.g. 'Asia/Shanghai').
export function isValidTimezone(timeZone: string): boolean {
  if (!timeZone) return false
  try {
    dayFormatter(timeZone)
    return true
  } catch {
    return false
  }
}

// Local calendar date (YYYY-MM-DD) of an instant in the given timezone —
// the unit for streaks and weekly buckets. Built from formatToParts so the
// output stays ISO-shaped regardless of locale runtime quirks.
export function localDateKey(instant: Date, timeZone: string): string {
  const parts = dayFormatter(timeZone).formatToParts(instant)
  const value = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find(part => part.type === type)?.value ?? ''
  return `${value('year')}-${value('month')}-${value('day')}`
}

// Previous calendar day of a YYYY-MM-DD key (UTC-anchored arithmetic, so
// month/leap-year boundaries and DST shifts stay correct).
function prevDay(dateKey: string): string {
  const day = new Date(`${dateKey}T00:00:00Z`)
  day.setUTCDate(day.getUTCDate() - 1)
  return day.toISOString().slice(0, 10)
}

// Longest run of consecutive active days ending today or yesterday: a streak
// survives "not reviewed yet today" (it ends at yesterday) but breaks at the
// first missing day before that.
export function computeStreak(activeDays: ReadonlySet<string>, today: string): number {
  let cursor = activeDays.has(today) ? today : prevDay(today)
  if (!activeDays.has(cursor)) return 0
  let streak = 0
  while (activeDays.has(cursor)) {
    streak += 1
    cursor = prevDay(cursor)
  }
  return streak
}

// Review-event counts per day for the last `days` days ending today,
// oldest first. Events outside the window are ignored.
export function weeklyActivity(
  eventDays: readonly string[],
  today: string,
  days = 7,
): DailyCount[] {
  const counts = new Map<string, number>()
  for (const day of eventDays) counts.set(day, (counts.get(day) ?? 0) + 1)

  const window: string[] = []
  let cursor = today
  for (let i = 0; i < days; i++) {
    window.unshift(cursor)
    cursor = prevDay(cursor)
  }
  return window.map(date => ({ date, count: counts.get(date) ?? 0 }))
}
