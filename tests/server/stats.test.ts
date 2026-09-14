// Unit tests for the pure stats math (server/utils/stats.ts).
// Spec: development-plan.md §2.3 — streak = consecutive distinct active days
// ending today/yesterday; weekly = per-day event counts for the last 7 days.

import { describe, expect, it } from 'vitest'
import {
  computeStreak,
  isValidTimezone,
  localDateKey,
  weeklyActivity,
} from '../../server/utils/stats'

describe('isValidTimezone', () => {
  it('accepts IANA timezone names', () => {
    expect(isValidTimezone('UTC')).toBe(true)
    expect(isValidTimezone('Asia/Shanghai')).toBe(true)
    expect(isValidTimezone('America/New_York')).toBe(true)
  })

  it('rejects unknown timezones and empty strings', () => {
    expect(isValidTimezone('Not/AZone')).toBe(false)
    expect(isValidTimezone('')).toBe(false)
  })
})

describe('localDateKey', () => {
  it('formats an instant as YYYY-MM-DD in the target timezone', () => {
    expect(localDateKey(new Date('2026-09-14T12:00:00Z'), 'UTC')).toBe('2026-09-14')
  })

  it('shifts the calendar day with the timezone offset', () => {
    const instant = new Date('2026-09-14T20:00:00Z') // already 2026-09-15 in Shanghai
    expect(localDateKey(instant, 'Asia/Shanghai')).toBe('2026-09-15')
    expect(localDateKey(instant, 'America/New_York')).toBe('2026-09-14')
  })

  it('respects DST offsets', () => {
    const instant = new Date('2026-07-10T03:30:00Z') // 2026-07-09 23:30 in New York (EDT)
    expect(localDateKey(instant, 'America/New_York')).toBe('2026-07-09')
  })
})

describe('computeStreak', () => {
  it('is 0 with no activity', () => {
    expect(computeStreak(new Set(), '2026-06-15')).toBe(0)
  })

  it('counts a run ending today', () => {
    const days = new Set(['2026-06-11', '2026-06-12', '2026-06-13', '2026-06-14', '2026-06-15'])
    expect(computeStreak(days, '2026-06-15')).toBe(5)
  })

  it('survives a not-yet-reviewed today by ending at yesterday', () => {
    const days = new Set(['2026-06-13', '2026-06-14'])
    expect(computeStreak(days, '2026-06-15')).toBe(2)
  })

  it('is 0 when neither today nor yesterday was active', () => {
    const days = new Set(['2026-06-10', '2026-06-11'])
    expect(computeStreak(days, '2026-06-15')).toBe(0)
  })

  it('breaks at the first missing day', () => {
    const days = new Set(['2026-06-12', '2026-06-13', '2026-06-15'])
    expect(computeStreak(days, '2026-06-15')).toBe(1)
  })

  it('crosses month boundaries', () => {
    const days = new Set(['2026-02-27', '2026-02-28', '2026-03-01'])
    expect(computeStreak(days, '2026-03-01')).toBe(3)
  })

  it('handles leap years', () => {
    const days = new Set(['2024-02-28', '2024-02-29', '2024-03-01'])
    expect(computeStreak(days, '2024-03-01')).toBe(3)
  })
})

describe('weeklyActivity', () => {
  it('returns 7 zeroed buckets oldest-first with no events', () => {
    expect(weeklyActivity([], '2026-06-15')).toEqual([
      { date: '2026-06-09', count: 0 },
      { date: '2026-06-10', count: 0 },
      { date: '2026-06-11', count: 0 },
      { date: '2026-06-12', count: 0 },
      { date: '2026-06-13', count: 0 },
      { date: '2026-06-14', count: 0 },
      { date: '2026-06-15', count: 0 },
    ])
  })

  it('aggregates counts per day and ignores events outside the window', () => {
    const events = [
      '2026-06-15',
      '2026-06-15',
      '2026-06-14',
      '2026-06-10',
      '2026-06-09',
      '2026-06-01', // outside the 7-day window
    ]
    const weekly = weeklyActivity(events, '2026-06-15')
    expect(weekly).toHaveLength(7)
    expect(weekly[0]).toEqual({ date: '2026-06-09', count: 1 })
    expect(weekly[5]).toEqual({ date: '2026-06-14', count: 1 })
    expect(weekly[6]).toEqual({ date: '2026-06-15', count: 2 })
  })

  it('crosses month boundaries', () => {
    const weekly = weeklyActivity(['2026-02-28'], '2026-03-02')
    expect(weekly.map(day => day.date)).toEqual([
      '2026-02-24',
      '2026-02-25',
      '2026-02-26',
      '2026-02-27',
      '2026-02-28',
      '2026-03-01',
      '2026-03-02',
    ])
  })
})
