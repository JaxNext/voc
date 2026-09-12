// Records CRUD composable — the data layer for capture, editing and listing.
// Talks to PostgREST directly through the module's Supabase client, which
// carries the user's session token; RLS scopes every row to its owner, so no
// Nitro route is involved (architecture rule 1).
//
// Unlike tags (one small shared list), records are paginated and filtered, so
// state lives with the caller (list page, detail page) instead of in
// useState — this composable is query/action-only.

import { RecordInputSchema } from '~/types/records'
import type { RecordInput, RecordType } from '~/types/records'
import type { Database } from '~/types/database'
import type { Tag } from '~/composables/useTags'

// Named VocRecord (not `Record`) to avoid shadowing TypeScript's utility type.
export type VocRecord = Database['public']['Tables']['records']['Row']
export type RecordWithTags = VocRecord & { tags: Tag[] }

export type RecordSort = 'newest' | 'oldest' | 'alphabetical'

export interface RecordListFilters {
  // Case-insensitive substring match on content OR meaning.
  search?: string
  type?: RecordType | 'all'
  // Union semantics: records carrying ANY of these tags.
  tagIds?: string[]
  sort?: RecordSort
  page?: number // 1-based
  pageSize?: number
}

export const DEFAULT_PAGE_SIZE = 20

// PostgREST `or=...` reserves commas/parens; strip them so user input can
// never inject additional filter branches.
function sanitizeSearchTerm(term: string): string {
  return term.replace(/[,()]/g, ' ').trim()
}

function parseInput(input: RecordInput) {
  const parsed = RecordInputSchema.safeParse(input)
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Invalid record')
  }
  return parsed.data
}

// Embed shape of `record_tags(tags(*))`; tags can be null when the embed is
// RLS-filtered (e.g. a tag row that this session may no longer read).
interface RecordTagEmbed {
  tags: Tag | null
}
type RecordQueryRow = VocRecord & { record_tags: RecordTagEmbed[] | null }

function toRecordWithTags(row: RecordQueryRow): RecordWithTags {
  const { record_tags, ...record } = row
  return { ...record, tags: (record_tags ?? []).flatMap(embed => (embed.tags ? [embed.tags] : [])) }
}

export function useRecords() {
  const supabase = useSupabaseClient<Database>()
  const user = useSupabaseUser()

  // One list query with exact count for pagination. Tag filtering is a
  // two-step union (ids from record_tags, then `in (ids)`) — a single `!inner`
  // join would duplicate records carrying several matching tags and break the
  // exact count.
  async function fetchRecords(filters: RecordListFilters = {}): Promise<{
    records: RecordWithTags[]
    total: number
    hasMore: boolean
  }> {
    const {
      search,
      type = 'all',
      tagIds = [],
      sort = 'newest',
      page = 1,
      pageSize = DEFAULT_PAGE_SIZE,
    } = filters

    let recordIdFilter: string[] | undefined
    if (tagIds.length > 0) {
      const { data, error } = await supabase
        .from('record_tags')
        .select('record_id')
        .in('tag_id', tagIds)
      if (error) throw new Error(error.message)
      const matchingIds = [...new Set((data ?? []).map(row => row.record_id))]
      if (matchingIds.length === 0) return { records: [], total: 0, hasMore: false }
      recordIdFilter = matchingIds
    }

    let query = supabase.from('records').select('*, record_tags(tags(*))', { count: 'exact' })

    if (type !== 'all') query = query.eq('type', type)
    if (recordIdFilter) query = query.in('id', recordIdFilter)

    const term = search ? sanitizeSearchTerm(search) : ''
    if (term) {
      query = query.or(`content.ilike.%${term}%,meaning.ilike.%${term}%`)
    }

    // Tiebreak on id so equal created_at/content values paginate stably.
    if (sort === 'newest') query = query.order('created_at', { ascending: false }).order('id')
    else if (sort === 'oldest') query = query.order('created_at', { ascending: true }).order('id')
    else query = query.order('content').order('id')

    const from = (page - 1) * pageSize
    const { data, count, error } = await query.range(from, from + pageSize - 1)
    if (error) throw new Error(error.message)

    const records = (data ?? []).map(toRecordWithTags)
    const total = count ?? 0
    return { records, total, hasMore: from + records.length < total }
  }

  // Null when the id does not exist or is RLS-invisible (foreign record).
  async function fetchRecord(id: string): Promise<RecordWithTags | null> {
    const { data, error } = await supabase
      .from('records')
      .select('*, record_tags(tags(*))')
      .eq('id', id)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return data ? toRecordWithTags(data) : null
  }

  // Three sequential inserts: record → record_tags → review_states. The
  // review_states row relies on DB defaults (status 'new', interval 0,
  // next_review_at now() → due immediately). If anything after the record
  // insert fails, the record is deleted again (FK cascade cleans the rest) so
  // the user never keeps a half-created record.
  async function createRecord(input: RecordInput): Promise<VocRecord> {
    if (!user.value) throw new Error('You must be signed in to add records')

    const { tagIds, ...fields } = parseInput(input)
    const { data: record, error } = await supabase
      .from('records')
      .insert({ ...fields, user_id: user.value.id })
      .select()
      .single()
    if (error) throw new Error(error.message)

    try {
      if (tagIds.length > 0) {
        const { error: tagError } = await supabase
          .from('record_tags')
          .insert(tagIds.map(tag_id => ({ record_id: record.id, tag_id })))
        if (tagError) throw new Error(tagError.message)
      }
      const { error: stateError } = await supabase
        .from('review_states')
        .insert({ record_id: record.id })
      if (stateError) throw new Error(stateError.message)
    } catch (error) {
      await supabase.from('records').delete().eq('id', record.id)
      throw error
    }
    return record
  }

  // Updates the row and syncs tag associations as a diff (removes only the
  // unselected tags, adds only the new ones), so a failed tag write can never
  // wipe existing associations. The returned row does not carry fresh tags —
  // refetch via fetchRecord when needed (detail page does).
  async function updateRecord(id: string, input: RecordInput): Promise<VocRecord> {
    if (!user.value) throw new Error('You must be signed in to edit records')

    const { tagIds, ...fields } = parseInput(input)
    const { data, error } = await supabase
      .from('records')
      .update(fields)
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(describeError(error))

    const { data: current, error: currentError } = await supabase
      .from('record_tags')
      .select('tag_id')
      .eq('record_id', id)
    if (currentError) throw new Error(currentError.message)

    const currentIds = (current ?? []).map(row => row.tag_id)
    const toRemove = currentIds.filter(tagId => !tagIds.includes(tagId))
    const toAdd = tagIds.filter(tagId => !currentIds.includes(tagId))

    if (toRemove.length > 0) {
      const { error: removeError } = await supabase
        .from('record_tags')
        .delete()
        .eq('record_id', id)
        .in('tag_id', toRemove)
      if (removeError) throw new Error(removeError.message)
    }
    if (toAdd.length > 0) {
      const { error: addError } = await supabase
        .from('record_tags')
        .insert(toAdd.map(tag_id => ({ record_id: id, tag_id })))
      if (addError) throw new Error(addError.message)
    }
    return data
  }

  // FK cascades remove record_tags, review_states and review_events.
  async function deleteRecord(id: string): Promise<void> {
    const { error } = await supabase.from('records').delete().eq('id', id)
    if (error) throw new Error(error.message)
  }

  return { fetchRecords, fetchRecord, createRecord, updateRecord, deleteRecord }
}

// Update returns via .single(): a 0-row update (bad id or RLS-invisible) is an
// error there, mapped to a friendly message.
function describeError(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'PGRST116') {
    return 'Record not found'
  }
  if (error instanceof Error) return error.message
  return 'Something went wrong'
}
