// GET /api/stats — dashboard aggregations (development-plan §2.3).
//
// Reads run with the caller's JWT via serverSupabaseClient, so RLS scopes
// records, review_states and review_events to their owner (architecture
// rule 2) — no service key involved. Counts aggregate over review_states
// (tech-design §7): the grading route keeps that table in sync but never
// touches records.learning_status, which would read stale.
//
// `?tz=` (IANA name, e.g. Asia/Shanghai) localizes the day boundaries used
// by the streak and weekly buckets; defaults to UTC.

import type { Database } from '~/types/database'
import {
  computeStreak,
  isValidTimezone,
  localDateKey,
  weeklyActivity,
  type DailyCount,
} from '../utils/stats'
import { requireUserId } from '../utils/supabase'
import { serverSupabaseClient } from '#supabase/server'

export interface VocStats {
  totalRecords: number
  // review_states rows not yet mastered ('new' records are due immediately,
  // so they are actively learning too) — Total ≈ Learning + Mastered.
  learning: number
  mastered: number
  // Same predicate as GET /api/review/session, so the stats page renders its
  // "due today" callout from this single request.
  dueToday: number
  streak: number
  weeklyActivity: DailyCount[]
}

export default defineEventHandler(async (event): Promise<VocStats> => {
  await requireUserId(event)

  const query = getQuery(event)
  const requestedTz = String(query.tz ?? '').trim()
  if (requestedTz && !isValidTimezone(requestedTz)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid timezone' })
  }
  const timeZone = requestedTz || 'UTC'

  const supabase = await serverSupabaseClient<Database>(event)
  const now = new Date().toISOString()

  const [total, learning, mastered, due, events] = await Promise.all([
    supabase.from('records').select('id', { count: 'exact', head: true }),
    supabase
      .from('review_states')
      .select('record_id', { count: 'exact', head: true })
      .in('status', ['new', 'learning']),
    supabase
      .from('review_states')
      .select('record_id', { count: 'exact', head: true })
      .eq('status', 'mastered'),
    supabase
      .from('review_states')
      .select('record_id', { count: 'exact', head: true })
      .lte('next_review_at', now)
      .neq('status', 'mastered'),
    supabase.from('review_events').select('reviewed_at'),
  ])

  for (const result of [total, learning, mastered, due] as const) {
    if (result.error) throw createError({ statusCode: 500, statusMessage: result.error.message })
  }
  if (events.error) throw createError({ statusCode: 500, statusMessage: events.error.message })

  const today = localDateKey(new Date(), timeZone)
  const eventDays = (events.data ?? []).map(row =>
    localDateKey(new Date(row.reviewed_at), timeZone),
  )

  return {
    totalRecords: total.count ?? 0,
    learning: learning.count ?? 0,
    mastered: mastered.count ?? 0,
    dueToday: due.count ?? 0,
    streak: computeStreak(new Set(eventDays), today),
    weeklyActivity: weeklyActivity(eventDays, today),
  }
})
