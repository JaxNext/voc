// Pure SRS interval math — no I/O, no clock reads, no Supabase dependency.
// Consumed by server/api/review/grade.post.ts; unit-tested in
// tests/server/srs.test.ts.
// Spec: docs/development-plan.md §2.1, docs/tech-design.md §7.

export type Grade = 'forgot' | 'hazy' | 'know' | 'easy'
export type LearningStatus = 'new' | 'learning' | 'mastered'

// Interval ladder (days). `know` climbs one rung at a time.
export const INTERVAL_LADDER = [0, 1, 3, 7, 14, 30]
export const MAX_INTERVAL_DAYS = 30

// Consecutive know/easy passes needed to mark a record as mastered.
export const PASSES_TO_MASTER = 3

export interface SrsState {
  intervalDays: number
  consecutivePass: number
  status: LearningStatus
}

// Smallest ladder value strictly greater than `current` (30 once at the top).
// Unlike a naive indexOf lookup this stays correct for off-ladder intervals
// produced by `easy`/`hazy` (e.g. current 2 → next rung 3, not ladder[0] = 0).
function nextLadderStep(current: number): number {
  for (const step of INTERVAL_LADDER) {
    if (step > current) return step
  }
  return MAX_INTERVAL_DAYS
}

// Grade transitions:
// - forgot → restart: interval resets to 1, pass streak resets, stays learning.
// - hazy   → wobble: interval halved (min 1), pass streak resets (not a pass).
// - know   → climb one ladder rung.
// - easy   → accelerated jump (×3, capped at 30); clamped to ≥ 1 so a fresh
//   record (interval 0) is not instantly due again.
// The 3rd consecutive know/easy marks the record mastered, interval capped.
export function calculateNextReview(
  currentInterval: number,
  consecutivePass: number,
  grade: Grade,
): SrsState {
  switch (grade) {
    case 'forgot':
      return { intervalDays: 1, consecutivePass: 0, status: 'learning' }
    case 'hazy':
      return {
        intervalDays: Math.max(1, Math.round(currentInterval / 2)),
        consecutivePass: 0,
        status: 'learning',
      }
    case 'know':
    case 'easy': {
      const passes = consecutivePass + 1
      const mastered = passes >= PASSES_TO_MASTER
      const interval =
        grade === 'know'
          ? nextLadderStep(currentInterval)
          : Math.min(MAX_INTERVAL_DAYS, Math.max(1, Math.round(currentInterval * 3)))
      return {
        intervalDays: mastered ? MAX_INTERVAL_DAYS : interval,
        consecutivePass: passes,
        status: mastered ? 'mastered' : 'learning',
      }
    }
  }
}

// Due timestamp for a record reviewed at `from` with the given interval.
// Calendar-day add, so "1 day" means the same wall-clock time tomorrow.
export function nextReviewAt(from: Date, intervalDays: number): Date {
  const due = new Date(from)
  due.setDate(due.getDate() + intervalDays)
  return due
}

// Fisher–Yates on a copy (input untouched). Used when building a session so
// the queue is not biased by next_review_at ordering.
export function shuffle<T>(items: readonly T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = copy[i]!
    copy[i] = copy[j]!
    copy[j] = tmp
  }
  return copy
}
