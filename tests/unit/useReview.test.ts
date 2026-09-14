// useReview composable tests (development-plan §2.2). The composable relies
// on Nuxt auto-imports, so useState is stubbed with a keyed ref store and
// $fetch with a vi.fn speaking the same request/response contract as the
// Nitro routes in server/api/review (GET /session, POST /grade).

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useReview } from '~/composables/useReview'
import type { GradeResult } from '~/composables/useReview'
import type { ReviewSessionItem } from '~/composables/useReview'

// Minimal Nuxt useState: one shared ref per state key, lazily initialized.
const stores = new Map<string, ReturnType<typeof ref>>()
vi.stubGlobal('useState', (key: string, init?: () => unknown) => {
  if (!stores.has(key)) stores.set(key, ref(init ? init() : undefined))
  return stores.get(key)
})

const fetchMock = vi.fn<(url: string, opts?: Record<string, unknown>) => Promise<unknown>>()
vi.stubGlobal('$fetch', fetchMock)

beforeEach(() => {
  stores.clear()
  fetchMock.mockReset()
})

const NOW = '2026-01-01T00:00:00.000Z'

function makeItem(
  id: string,
  status: ReviewSessionItem['state']['status'] = 'learning',
): ReviewSessionItem {
  return {
    record: {
      id,
      user_id: 'user-1',
      type: 'word',
      content: `content ${id}`,
      meaning: `meaning ${id}`,
      source: null,
      notes: null,
      created_at: NOW,
      updated_at: NOW,
      tags: [],
    },
    state: { status, interval_days: 1, consecutive_pass: 1, next_review_at: NOW },
  }
}

function gradeResult(recordId: string, grade: GradeResult['grade'], mastered = false): GradeResult {
  return {
    record_id: recordId,
    grade,
    status: mastered ? 'mastered' : 'learning',
    interval_days: 3,
    consecutive_pass: 2,
    next_review_at: NOW,
    mastered,
  }
}

describe('useReview', () => {
  it('starts with an empty queue and no active card', () => {
    const review = useReview()
    expect(review.queue.value).toEqual([])
    expect(review.current.value).toBeNull()
    expect(review.isComplete.value).toBe(false)
    expect(review.totalDue.value).toBe(0)
  })

  it('loadQueue fetches the session and resets all progress', async () => {
    fetchMock.mockResolvedValue({ items: [makeItem('a'), makeItem('b')], totalDue: 5 })

    const review = useReview()
    const items = await review.loadQueue()

    expect(fetchMock).toHaveBeenCalledWith('/api/review/session', { query: { limit: 10 } })
    expect(items).toHaveLength(2)
    expect(review.queue.value).toHaveLength(2)
    expect(review.totalDue.value).toBe(5)
    expect(review.current.value?.record.id).toBe('a')
    expect(review.isComplete.value).toBe(false)
  })

  it('loadQueue forwards a custom limit', async () => {
    fetchMock.mockResolvedValue({ items: [], totalDue: 0 })

    const review = useReview()
    await review.loadQueue(20)

    expect(fetchMock).toHaveBeenCalledWith('/api/review/session', { query: { limit: 20 } })
  })

  it('loadQueue surfaces a friendly error and rethrows', async () => {
    fetchMock.mockRejectedValue({ statusCode: 500, data: { message: 'Database unavailable' } })

    const review = useReview()
    await expect(review.loadQueue()).rejects.toBeTruthy()
    expect(review.error.value).toBe('Database unavailable')
    expect(review.loading.value).toBe(false)
    expect(review.queue.value).toEqual([])
  })

  it('ensureQueue reuses the active queue without refetching', async () => {
    fetchMock.mockResolvedValue({ items: [makeItem('a')], totalDue: 1 })

    const review = useReview()
    await review.loadQueue()
    const items = await review.ensureQueue()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(items).toHaveLength(1)
  })

  it('ensureQueue rebuilds when no queue is active', async () => {
    fetchMock.mockResolvedValue({ items: [makeItem('a')], totalDue: 1 })

    const review = useReview()
    await review.ensureQueue()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(review.queue.value).toHaveLength(1)
  })

  it('submitGrade posts the current record and advances after confirmation', async () => {
    fetchMock
      .mockResolvedValueOnce({ items: [makeItem('a'), makeItem('b')], totalDue: 2 })
      .mockResolvedValueOnce(gradeResult('a', 'know'))

    const review = useReview()
    await review.loadQueue()
    const result = await review.submitGrade('know')

    expect(fetchMock).toHaveBeenLastCalledWith('/api/review/grade', {
      method: 'POST',
      body: { record_id: 'a', grade: 'know' },
    })
    expect(result.record_id).toBe('a')
    expect(review.results.value).toHaveLength(1)
    expect(review.currentIndex.value).toBe(1)
    expect(review.current.value?.record.id).toBe('b')
    expect(review.grading.value).toBe(false)
  })

  it('submitGrade failure keeps the card active for retry', async () => {
    fetchMock
      .mockResolvedValueOnce({ items: [makeItem('a'), makeItem('b')], totalDue: 2 })
      .mockRejectedValueOnce({ statusCode: 401 })

    const review = useReview()
    await review.loadQueue()
    await expect(review.submitGrade('easy')).rejects.toBeTruthy()

    expect(review.currentIndex.value).toBe(0)
    expect(review.results.value).toHaveLength(0)
    expect(review.current.value?.record.id).toBe('a')
    expect(review.error.value).toBe('Your session has expired — sign in again')
  })

  it('submitGrade refuses without an active card', async () => {
    const review = useReview()
    await expect(review.submitGrade('know')).rejects.toThrow('No active card to grade')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('isComplete flips once every card is graded', async () => {
    fetchMock
      .mockResolvedValueOnce({ items: [makeItem('a'), makeItem('b')], totalDue: 2 })
      .mockResolvedValueOnce(gradeResult('a', 'know'))
      .mockResolvedValueOnce(gradeResult('b', 'forgot'))

    const review = useReview()
    await review.loadQueue()
    expect(review.isComplete.value).toBe(false)

    await review.submitGrade('know')
    expect(review.isComplete.value).toBe(false)

    await review.submitGrade('forgot')
    expect(review.isComplete.value).toBe(true)
    expect(review.progress.value).toEqual({ done: 2, total: 2 })
  })

  it('summary tallies grades, mastered and new cards', async () => {
    fetchMock
      .mockResolvedValueOnce({
        items: [makeItem('a', 'new'), makeItem('b'), makeItem('c', 'new')],
        totalDue: 3,
      })
      .mockResolvedValueOnce(gradeResult('a', 'know'))
      .mockResolvedValueOnce(gradeResult('b', 'know', true))
      .mockResolvedValueOnce(gradeResult('c', 'forgot'))

    const review = useReview()
    await review.loadQueue()
    await review.submitGrade('know')
    await review.submitGrade('know')
    await review.submitGrade('forgot')

    expect(review.summary.value).toEqual({
      counts: { forgot: 1, hazy: 0, know: 2, easy: 0 },
      graded: 3,
      mastered: 1,
      newCount: 2,
    })
  })

  it('exitSession clears the queue but keeps the due count', async () => {
    fetchMock
      .mockResolvedValueOnce({ items: [makeItem('a'), makeItem('b')], totalDue: 7 })
      .mockResolvedValueOnce(gradeResult('a', 'hazy'))

    const review = useReview()
    await review.loadQueue()
    await review.submitGrade('hazy')
    review.exitSession()

    expect(review.queue.value).toEqual([])
    expect(review.current.value).toBeNull()
    expect(review.results.value).toEqual([])
    expect(review.currentIndex.value).toBe(0)
    expect(review.totalDue.value).toBe(7)
  })

  it('shares session state between two useReview consumers', async () => {
    fetchMock.mockResolvedValue({ items: [makeItem('a'), makeItem('b')], totalDue: 2 })

    const first = useReview()
    await first.loadQueue()

    const second = useReview()
    expect(second.queue.value).toHaveLength(2)
    expect(second.current.value?.record.id).toBe('a')

    fetchMock.mockResolvedValueOnce(gradeResult('a', 'easy', true))
    await second.submitGrade('easy')
    expect(first.currentIndex.value).toBe(1)
    expect(first.results.value).toHaveLength(1)
  })
})
