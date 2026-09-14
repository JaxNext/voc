// Unit tests for the pure SRS interval math (server/utils/srs.ts).
// Spec: development-plan.md §2.1 — forgot resets, hazy halves, know climbs
// the ladder, easy jumps ×3, and 3 consecutive passes master the record.

import { describe, expect, it } from 'vitest'
import {
  INTERVAL_LADDER,
  MAX_INTERVAL_DAYS,
  PASSES_TO_MASTER,
  calculateNextReview,
  nextReviewAt,
  shuffle,
} from '../../server/utils/srs'

describe('calculateNextReview — forgot', () => {
  it('resets the interval to 1 and clears the pass streak', () => {
    expect(calculateNextReview(7, 2, 'forgot')).toEqual({
      intervalDays: 1,
      consecutivePass: 0,
      status: 'learning',
    })
  })

  it('brings a fresh record straight to learning', () => {
    const next = calculateNextReview(0, 0, 'forgot')
    expect(next.status).toBe('learning')
    expect(next.intervalDays).toBe(1)
  })

  it('pulls a mastered record back into learning', () => {
    const next = calculateNextReview(MAX_INTERVAL_DAYS, PASSES_TO_MASTER, 'forgot')
    expect(next.status).toBe('learning')
    expect(next.intervalDays).toBe(1)
  })
})

describe('calculateNextReview — hazy', () => {
  it('halves the interval, rounding to nearest', () => {
    expect(calculateNextReview(7, 1, 'hazy').intervalDays).toBe(4) // round(3.5)
    expect(calculateNextReview(30, 0, 'hazy').intervalDays).toBe(15)
    expect(calculateNextReview(4, 0, 'hazy').intervalDays).toBe(2)
  })

  it('never drops below 1 day', () => {
    expect(calculateNextReview(1, 0, 'hazy').intervalDays).toBe(1)
    expect(calculateNextReview(0, 0, 'hazy').intervalDays).toBe(1)
  })

  it('resets the pass streak — hazy is not a pass', () => {
    const next = calculateNextReview(7, 2, 'hazy')
    expect(next.consecutivePass).toBe(0)
    expect(next.status).toBe('learning')
  })
})

describe('calculateNextReview — know', () => {
  it('climbs the ladder one rung at a time', () => {
    for (let i = 0; i < INTERVAL_LADDER.length - 1; i++) {
      const current = INTERVAL_LADDER[i]!
      const expected = INTERVAL_LADDER[i + 1]!
      expect(calculateNextReview(current, 0, 'know').intervalDays).toBe(expected)
    }
  })

  it('caps the ladder at 30 days', () => {
    expect(calculateNextReview(MAX_INTERVAL_DAYS, 0, 'know').intervalDays).toBe(MAX_INTERVAL_DAYS)
  })

  it('handles off-ladder intervals left by easy/hazy', () => {
    expect(calculateNextReview(2, 0, 'know').intervalDays).toBe(3)
    expect(calculateNextReview(9, 0, 'know').intervalDays).toBe(14)
    expect(calculateNextReview(29, 0, 'know').intervalDays).toBe(30)
  })

  it('increments the pass streak', () => {
    const next = calculateNextReview(0, 0, 'know')
    expect(next.consecutivePass).toBe(1)
    expect(next.status).toBe('learning')
  })
})

describe('calculateNextReview — easy', () => {
  it('triples the interval', () => {
    expect(calculateNextReview(1, 0, 'easy').intervalDays).toBe(3)
    expect(calculateNextReview(3, 0, 'easy').intervalDays).toBe(9)
    expect(calculateNextReview(9, 0, 'easy').intervalDays).toBe(27)
  })

  it('caps at 30 days', () => {
    expect(calculateNextReview(27, 0, 'easy').intervalDays).toBe(30)
    expect(calculateNextReview(30, 0, 'easy').intervalDays).toBe(30)
  })

  it('clamps to at least 1 day so a fresh card is not instantly due again', () => {
    expect(calculateNextReview(0, 0, 'easy').intervalDays).toBe(1)
  })
})

describe('calculateNextReview — mastery', () => {
  it('masters exactly on the 3rd consecutive pass and caps the interval', () => {
    const second = calculateNextReview(0, 1, 'know')
    expect(second.status).toBe('learning')

    const third = calculateNextReview(second.intervalDays, second.consecutivePass, 'easy')
    expect(third.status).toBe('mastered')
    expect(third.consecutivePass).toBe(3)
    expect(third.intervalDays).toBe(MAX_INTERVAL_DAYS)
  })

  it('stays mastered on further passes', () => {
    const next = calculateNextReview(MAX_INTERVAL_DAYS, PASSES_TO_MASTER, 'know')
    expect(next.status).toBe('mastered')
    expect(next.consecutivePass).toBe(4)
  })

  it('does not master before 3 passes', () => {
    expect(calculateNextReview(1, 0, 'easy').status).toBe('learning')
    expect(calculateNextReview(3, 1, 'easy').status).toBe('learning')
  })
})

describe('nextReviewAt', () => {
  it('schedules the same wall-clock time N calendar days later', () => {
    const now = new Date('2026-06-15T08:30:00')
    expect(nextReviewAt(now, 1).toISOString()).toBe(new Date('2026-06-16T08:30:00').toISOString())
    expect(nextReviewAt(now, 7).toISOString()).toBe(new Date('2026-06-22T08:30:00').toISOString())
  })

  it('does not mutate the input date', () => {
    const now = new Date('2026-06-15T08:30:00')
    nextReviewAt(now, 30)
    expect(now.toISOString()).toBe(new Date('2026-06-15T08:30:00').toISOString())
  })
})

describe('shuffle', () => {
  it('preserves length and members', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    const output = shuffle(input)
    expect(output).toHaveLength(input.length)
    expect([...output].sort((a, b) => a - b)).toEqual(input)
  })

  it('returns a copy and leaves the input untouched', () => {
    const input = ['a', 'b', 'c']
    const output = shuffle(input)
    expect(output).not.toBe(input)
    expect(input).toEqual(['a', 'b', 'c'])
  })

  it('handles empty and single-item inputs', () => {
    expect(shuffle([])).toEqual([])
    expect(shuffle([42])).toEqual([42])
  })
})
