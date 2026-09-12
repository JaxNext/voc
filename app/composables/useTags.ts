// Tag management composable — single source of tag state for the whole app
// (TagPicker, /tags page, record forms). Talks to PostgREST directly using
// the user's session: RLS marks predefined rows read-only and scopes custom
// rows to their owner, so no Nitro route is involved (architecture rule 1).
//
// State lives in useState so every consumer sees the same list and
// mutations (create/delete) propagate app-wide without manual refresh.

import { TagInputSchema } from '~/types/records'
import type { Database } from '~/types/database'
import type { NuxtApp } from '#app'

export type Tag = Database['public']['Tables']['tags']['Row']

// nuxtApp is per-request on the server and per-app on the client, so an
// in-flight promise attached to it is shared by concurrent callers within the
// same request/app without ever leaking across server requests (a module-level
// promise would be shared by all requests — the cross-request trap). Mirrors
// how Nuxt's own useAsyncData dedupes fetches via nuxtApp._asyncDataPromises.
type TagsApp = NuxtApp & { __vocTagsLoad?: Promise<void> }

const TAGS_STATE_KEY = 'voc-tags'
const TAGS_LOADED_KEY = 'voc-tags-loaded'

// Unique-violation code from Postgres (partial unique indexes on tags.name).
const PG_UNIQUE_VIOLATION = '23505'

export function useTags() {
  const supabase = useSupabaseClient<Database>()
  const user = useSupabaseUser()
  const tagsApp = useNuxtApp() as TagsApp

  const tags = useState<Tag[]>(TAGS_STATE_KEY, () => [])
  const initialized = useState(TAGS_LOADED_KEY, () => false)
  const loading = ref(false)

  const predefinedTags = computed(() => tags.value.filter(tag => tag.is_predefined))

  // Newest first — the tag a user just created is immediately visible.
  const customTags = computed(() =>
    tags.value
      .filter(tag => !tag.is_predefined)
      .sort((a, b) => b.created_at.localeCompare(a.created_at)),
  )

  // One query returns exactly the set RLS allows for the calling session:
  // all predefined tags plus the user's own custom tags.
  async function load(): Promise<void> {
    loading.value = true
    try {
      const { data, error } = await supabase
        .from('tags')
        .select('*')
        .order('is_predefined', { ascending: false })
        .order('name')
      if (error) throw new Error(describeError(error))
      tags.value = data
      initialized.value = true
    } finally {
      loading.value = false
    }
  }

  // Fetch-once guard for consumers that mount independently (TagPicker on
  // record forms, /tags page). Concurrent first-time callers share one
  // in-flight promise, so two components mounting in the same tick trigger a
  // single Supabase request instead of two.
  async function ensureLoaded(): Promise<void> {
    if (initialized.value) return
    if (tagsApp.__vocTagsLoad) {
      await tagsApp.__vocTagsLoad
      // The shared load may have failed — our own flag stays false in that
      // case, so fall through and retry with a fresh request.
      if (initialized.value) return
    }
    tagsApp.__vocTagsLoad = load().finally(() => {
      tagsApp.__vocTagsLoad = undefined
    })
    await tagsApp.__vocTagsLoad
  }

  // user_id is derived from the session (never arbitrary client input) and
  // is required because the column is nullable with no default, while the
  // RLS "tags owner all" policy checks auth.uid() = user_id.
  async function createTag(name: string): Promise<Tag> {
    const parsed = TagInputSchema.safeParse({ name })
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? 'Invalid tag name')
    }
    if (!user.value) throw new Error('You must be signed in to create tags')

    const { data, error } = await supabase
      .from('tags')
      // user id comes from JWT claims (`sub`) since @nuxtjs/supabase v2.
      .insert({ name: parsed.data.name, user_id: user.value.sub })
      .select()
      .single()
    if (error) throw new Error(describeError(error))

    tags.value = [...tags.value, data]
    return data
  }

  // record_tags rows referencing this tag are removed by the FK cascade.
  async function deleteTag(id: string): Promise<void> {
    const tag = tags.value.find(t => t.id === id)
    if (tag?.is_predefined) throw new Error('Predefined tags cannot be deleted')

    const { error } = await supabase.from('tags').delete().eq('id', id)
    if (error) throw new Error(describeError(error))

    tags.value = tags.value.filter(t => t.id !== id)
  }

  return { tags, predefinedTags, customTags, loading, load, ensureLoaded, createTag, deleteTag }
}

// Normalize Supabase / Zod / unknown failures into user-presentable messages.
function describeError(error: unknown): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === PG_UNIQUE_VIOLATION
  ) {
    return 'A tag with this name already exists'
  }
  if (error instanceof Error) return error.message
  return 'Something went wrong'
}
