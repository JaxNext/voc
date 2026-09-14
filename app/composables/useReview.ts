// Review session composable — client state for the flashcard flow
// (development-plan §2.2). Owns the active queue, the current card index and
// the per-card grade results, and syncs the two Nitro endpoints:
//   GET  /api/review/session → queue build (its totalDue also feeds the
//                              "N items due today" badge on the review index)
//   POST /api/review/grade   → one call per graded card
//
// Session state lives in useState so it survives the /review → /review/session
// navigation and is shared by every consumer; a full page reload rebuilds a
// fresh queue via ensureQueue. Unlike useTags there is no app-wide cache of
// "all" reviews — a finished session is disposable, so exitSession clears it.

import { computed, ref } from 'vue'
import type { Grade } from '~/types/records'

// Response shapes of the two review routes. Types only — importing values
// would pull server code into the client bundle.
export type { ReviewSession, ReviewSessionItem } from '~~/server/api/review/session.get'
export type { GradeResult } from '~~/server/api/review/grade.post'
import type { GradeResult } from '~~/server/api/review/grade.post'
import type { ReviewSession, ReviewSessionItem } from '~~/server/api/review/session.get'

// Mirrors DEFAULT_SESSION_SIZE on the server route (see comment above).
export const DEFAULT_QUEUE_SIZE = 10

export interface ReviewSummary {
  // Per-grade tally for the summary breakdown (Forgot/Hazy/Know/Easy).
  counts: Record<Grade, number>
  graded: number
  mastered: number
  // Cards that entered the session as brand new (status 'new').
  newCount: number
}

export function useReview() {
  // Cross-page state: the /review index builds the queue, /review/session
  // consumes it card by card, the summary screen reads the results.
  const queue = useState<ReviewSessionItem[]>('voc-review-queue', () => [])
  const totalDue = useState<number>('voc-review-total-due', () => 0)
  const currentIndex = useState<number>('voc-review-index', () => 0)
  const results = useState<GradeResult[]>('voc-review-results', () => [])

  // Transient request state — per consumer, not shared.
  const loading = ref(false)
  const grading = ref(false)
  const error = ref<string | null>(null)

  const current = computed<ReviewSessionItem | null>(() => queue.value[currentIndex.value] ?? null)
  const isComplete = computed(
    () => queue.value.length > 0 && currentIndex.value >= queue.value.length,
  )
  // Progress header ("X / N"): done never exceeds total, even mid-flight.
  const progress = computed(() => ({
    done: Math.min(currentIndex.value, queue.value.length),
    total: queue.value.length,
  }))

  // Fetches a fresh session and resets all progress. totalDue covers ALL due
  // items (may exceed the session's limit-sized slice).
  async function loadQueue(limit = DEFAULT_QUEUE_SIZE): Promise<ReviewSessionItem[]> {
    loading.value = true
    error.value = null
    try {
      const session = await $fetch<ReviewSession>('/api/review/session', { query: { limit } })
      queue.value = session.items
      totalDue.value = session.totalDue
      currentIndex.value = 0
      results.value = []
      return session.items
    } catch (err) {
      error.value = describeError(err)
      throw err
    } finally {
      loading.value = false
    }
  }

  // Deep link / page reload on /review/session: rebuild a queue only when none
  // is active. Returns the items so the caller can branch on an empty queue.
  async function ensureQueue(limit = DEFAULT_QUEUE_SIZE): Promise<ReviewSessionItem[]> {
    if (queue.value.length > 0) return queue.value
    return loadQueue(limit)
  }

  // One server round-trip per grade; the card advances only after the server
  // confirms, so a failed POST leaves the current card on screen for a retry
  // (the route re-grades from the fresh state — see docs/2.1 §3).
  async function submitGrade(grade: Grade): Promise<GradeResult> {
    const item = current.value
    if (!item) throw new Error('No active card to grade')
    grading.value = true
    error.value = null
    try {
      const result = await $fetch<GradeResult>('/api/review/grade', {
        method: 'POST',
        body: { record_id: item.record.id, grade },
      })
      results.value.push(result)
      currentIndex.value += 1
      return result
    } catch (err) {
      error.value = describeError(err)
      throw err
    } finally {
      grading.value = false
    }
  }

  // Breakdown for the session-summary screen.
  const summary = computed<ReviewSummary>(() => {
    const counts: Record<Grade, number> = { forgot: 0, hazy: 0, know: 0, easy: 0 }
    let mastered = 0
    for (const result of results.value) {
      counts[result.grade] += 1
      if (result.mastered) mastered += 1
    }
    return {
      counts,
      graded: results.value.length,
      mastered,
      newCount: queue.value.filter(item => item.state.status === 'new').length,
    }
  })

  // Clears the active session (exit button / "Done"). totalDue is kept — the
  // ungraded remainder is still due, so the index badge stays honest.
  function exitSession(): void {
    queue.value = []
    currentIndex.value = 0
    results.value = []
  }

  return {
    queue,
    totalDue,
    currentIndex,
    results,
    loading,
    grading,
    error,
    current,
    isComplete,
    progress,
    summary,
    loadQueue,
    ensureQueue,
    submitGrade,
    exitSession,
  }
}

// ofetch FetchError → user-presentable message. Nitro's createError payload
// arrives in `data`; 401 means the cookie session expired mid-session.
// Exported for reuse by other API-consuming pages (e.g. the stats dashboard).
export function describeError(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const err = error as {
      data?: { message?: string; statusMessage?: string }
      statusCode?: number
      statusMessage?: string
      message?: string
    }
    if (err.statusCode === 401) return 'Your session has expired — sign in again'
    if (err.data?.message) return err.data.message
    if (err.data?.statusMessage) return err.data.statusMessage
    if (err.statusMessage) return err.statusMessage
    if (err.message) return err.message
  }
  return 'Something went wrong'
}
