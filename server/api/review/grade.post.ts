// POST /api/review/grade — apply a self-grade and reschedule (development-plan
// §2.1). Body: { record_id: uuid, grade: 'forgot'|'hazy'|'know'|'easy' }.
//
// Mutations run on the service-role client (tech-design §7): RLS does not
// bind it, so ownership is checked explicitly with the session-derived id —
// the body's record_id alone is never trusted (architecture rule 4).

import type { Grade } from '../../utils/srs'
import { ReviewGradeSchema } from '~/types/records'
import { calculateNextReview, nextReviewAt } from '../../utils/srs'
import { getServiceSupabase, requireUserId } from '../../utils/supabase'

export interface GradeResult {
  record_id: string
  grade: Grade
  status: 'new' | 'learning' | 'mastered'
  interval_days: number
  consecutive_pass: number
  next_review_at: string
  mastered: boolean
}

export default defineEventHandler(async (event): Promise<GradeResult> => {
  const userId = await requireUserId(event)

  const parsed = ReviewGradeSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid request body',
      data: parsed.error.issues,
    })
  }
  const { record_id, grade } = parsed.data

  const service = getServiceSupabase(event)

  // Ownership check — a foreign or nonexistent record is indistinguishable.
  const { data: owned, error: ownedError } = await service
    .from('records')
    .select('id')
    .eq('id', record_id)
    .eq('user_id', userId)
    .maybeSingle()
  if (ownedError) throw createError({ statusCode: 500, statusMessage: ownedError.message })
  if (!owned) throw createError({ statusCode: 404, statusMessage: 'Record not found' })

  // Missing state row (e.g. a failed init) grades from fresh-record defaults.
  const { data: state, error: stateError } = await service
    .from('review_states')
    .select('status, interval_days, consecutive_pass')
    .eq('record_id', record_id)
    .maybeSingle()
  if (stateError) throw createError({ statusCode: 500, statusMessage: stateError.message })

  const next = calculateNextReview(state?.interval_days ?? 0, state?.consecutive_pass ?? 0, grade)
  const now = new Date()
  const dueAt = nextReviewAt(now, next.intervalDays)

  // PostgREST cannot run multi-statement transactions: the state upsert goes
  // first, the event append second. If the append fails the schedule has
  // already moved (stats lose one event); the client surfaces the error and a
  // retry re-grades from the fresh state. See docs/2.1-srs-and-server-routes.md.
  const { error: updateError } = await service.from('review_states').upsert({
    record_id,
    status: next.status,
    interval_days: next.intervalDays,
    consecutive_pass: next.consecutivePass,
    last_reviewed_at: now.toISOString(),
    next_review_at: dueAt.toISOString(),
  })
  if (updateError) throw createError({ statusCode: 500, statusMessage: updateError.message })

  const { error: eventError } = await service.from('review_events').insert({
    record_id,
    user_id: userId,
    grade,
  })
  if (eventError) throw createError({ statusCode: 500, statusMessage: eventError.message })

  return {
    record_id,
    grade,
    status: next.status,
    interval_days: next.intervalDays,
    consecutive_pass: next.consecutivePass,
    next_review_at: dueAt.toISOString(),
    mastered: next.status === 'mastered',
  }
})
