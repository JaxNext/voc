// GET /api/review/session — build today's review queue (development-plan §2.1).
//
// Reads run with the caller's JWT via serverSupabaseClient, so RLS scopes
// review_states and records to their owner (architecture rule 2). Up to
// `limit` due items (next_review_at <= now, status not mastered) are fetched
// and shuffled to avoid memorization-order bias.

import type { Database } from '~/types/database'
import type { RecordWithTags, VocRecord } from '~/composables/useRecords'
import type { Tag } from '~/composables/useTags'
import type { LearningStatus } from '../../utils/srs'
import { serverSupabaseClient } from '#supabase/server'
import { shuffle } from '../../utils/srs'
import { requireUserId } from '../../utils/supabase'

export const DEFAULT_SESSION_SIZE = 10
export const MAX_SESSION_SIZE = 50

export interface ReviewSessionItem {
  record: RecordWithTags
  state: ReviewStateSnapshot
}

export interface ReviewStateSnapshot {
  status: LearningStatus
  interval_days: number
  consecutive_pass: number
  next_review_at: string
}

export interface ReviewSession {
  items: ReviewSessionItem[]
  // All due items for the caller (may exceed the session size) — the review
  // index uses it for the "N items due today" badge.
  totalDue: number
}

// Embed shape of `record_tags(tags(*))`; tags can be null when the embed is
// RLS-filtered (same shape as the client's useRecords mapper).
interface RecordTagEmbed {
  tags: Tag | null
}
type RecordQueryRow = VocRecord & { record_tags: RecordTagEmbed[] | null }

function toRecordWithTags(row: RecordQueryRow): RecordWithTags {
  const { record_tags, ...record } = row
  return { ...record, tags: (record_tags ?? []).flatMap(embed => (embed.tags ? [embed.tags] : [])) }
}

export default defineEventHandler(async (event): Promise<ReviewSession> => {
  await requireUserId(event)

  const query = getQuery(event)
  const parsedLimit = Number.parseInt(String(query.limit ?? ''), 10)
  const limit = Number.isNaN(parsedLimit)
    ? DEFAULT_SESSION_SIZE
    : Math.min(MAX_SESSION_SIZE, Math.max(1, parsedLimit))

  const supabase = await serverSupabaseClient<Database>(event)
  const now = new Date().toISOString()

  // Most-overdue first; the tiebreak keeps the limit cut deterministic.
  const { data: states, error } = await supabase
    .from('review_states')
    .select('record_id, status, interval_days, consecutive_pass, next_review_at')
    .lte('next_review_at', now)
    .neq('status', 'mastered')
    .order('next_review_at')
    .order('record_id')
    .limit(limit)
  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  const { count: totalDue, error: countError } = await supabase
    .from('review_states')
    .select('record_id', { count: 'exact', head: true })
    .lte('next_review_at', now)
    .neq('status', 'mastered')
  if (countError) throw createError({ statusCode: 500, statusMessage: countError.message })

  const dueStates = states ?? []
  if (dueStates.length === 0) return { items: [], totalDue: totalDue ?? 0 }

  const { data: records, error: recordsError } = await supabase
    .from('records')
    .select('*, record_tags(tags(*))')
    .in(
      'id',
      dueStates.map(state => state.record_id),
    )
  if (recordsError) throw createError({ statusCode: 500, statusMessage: recordsError.message })

  const byId = new Map((records ?? []).map(row => [row.id, toRecordWithTags(row)]))

  // States without a visible record are dropped defensively (should not happen
  // — RLS ties states to owned records — but never leak a null slot).
  const items = shuffle(dueStates).flatMap(state => {
    const record = byId.get(state.record_id)
    if (!record) return []
    const { record_id: _recordId, ...snapshot } = state
    return [{ record, state: snapshot }]
  })

  return { items, totalDue: totalDue ?? 0 }
})
