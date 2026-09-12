<script setup lang="ts">
// Records home per product-design §6.2 — the "My Records" library: debounced
// search, type chips, tag filter dropdown + active-chip row, sort selector,
// empty states and IntersectionObserver infinite scroll. Data comes from
// useRecords().fetchRecords (client-side, so relative times hydrate cleanly);
// tags come from the shared useTags state.

import type { RecordWithTags, RecordSort } from '~/composables/useRecords'
import type { RecordType } from '~/types/records'

useHead({ title: 'My Records — Voc' })

const { fetchRecords } = useRecords()
const { tags, ensureLoaded } = useTags()
const toast = useToast()

const TYPE_CHIPS: Array<{ value: 'all' | RecordType; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'word', label: 'Word' },
  { value: 'phrase', label: 'Phrase' },
  { value: 'sentence', label: 'Sentence' },
]

const SORT_OPTIONS: Array<{ label: string; value: RecordSort }> = [
  { label: 'Newest', value: 'newest' },
  { label: 'Oldest', value: 'oldest' },
  { label: 'Alphabetical', value: 'alphabetical' },
]

const records = ref<RecordWithTags[]>([])
const total = ref(0)
const page = ref(1)
const hasMore = ref(false)
const loading = ref(true)
const loadingMore = ref(false)

const searchInput = ref('')
const search = ref('')
const type = ref<'all' | RecordType>('all')
const activeTagIds = ref<string[]>([])
const sort = ref<RecordSort>('newest')

const hasActiveFilters = computed(
  () => search.value !== '' || type.value !== 'all' || activeTagIds.value.length > 0,
)

// Generation counter: a slow in-flight response from a previous filter state
// must never mutate the list of a newer one.
let fetchGen = 0

async function loadFirst() {
  const gen = ++fetchGen
  loading.value = true
  try {
    const res = await fetchRecords({
      search: search.value,
      type: type.value,
      tagIds: activeTagIds.value,
      sort: sort.value,
      page: 1,
    })
    if (gen !== fetchGen) return
    records.value = res.records
    total.value = res.total
    hasMore.value = res.hasMore
    page.value = 1
  } catch (error) {
    if (gen !== fetchGen) return
    toast.add({
      title: error instanceof Error ? error.message : 'Could not load records',
      color: 'error',
      icon: 'i-lucide-circle-alert',
    })
  } finally {
    if (gen === fetchGen) loading.value = false
  }
}

async function loadMore() {
  if (loading.value || loadingMore.value || !hasMore.value) return
  const gen = ++fetchGen
  loadingMore.value = true
  try {
    const res = await fetchRecords({
      search: search.value,
      type: type.value,
      tagIds: activeTagIds.value,
      sort: sort.value,
      page: page.value + 1,
    })
    if (gen !== fetchGen) return
    records.value.push(...res.records)
    total.value = res.total
    hasMore.value = res.hasMore
    page.value += 1
  } catch (error) {
    if (gen === fetchGen) {
      toast.add({
        title: error instanceof Error ? error.message : 'Could not load more records',
        color: 'error',
        icon: 'i-lucide-circle-alert',
      })
    }
  } finally {
    if (gen === fetchGen) loadingMore.value = false
  }
}

// Debounced search — the input stays responsive; the query fires 300ms after
// typing stops.
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(searchInput, value => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    search.value = value.trim()
  }, 300)
})

watch([search, type, activeTagIds, sort], () => {
  void loadFirst()
})

// Tag dropdown options + name lookup for the active-chip row.
const tagOptions = computed(() => tags.value.map(tag => ({ label: tag.name, value: tag.id })))
const tagName = (id: string) => tags.value.find(tag => tag.id === id)?.name

function removeTag(id: string) {
  activeTagIds.value = activeTagIds.value.filter(tagId => tagId !== id)
}

function clearFilters() {
  searchInput.value = ''
  search.value = ''
  type.value = 'all'
  activeTagIds.value = []
  sort.value = 'newest'
}

// Infinite scroll: sentinel just past the last card pre-fetches the next page.
const sentinel = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | undefined
onMounted(() => {
  void ensureLoaded()
  void loadFirst()
  observer = new IntersectionObserver(
    entries => {
      if (entries.some(entry => entry.isIntersecting)) void loadMore()
    },
    { rootMargin: '400px' },
  )
  if (sentinel.value) observer.observe(sentinel.value)
})
onBeforeUnmount(() => {
  clearTimeout(searchTimer)
  observer?.disconnect()
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <header class="flex items-center justify-between">
      <h1 class="text-lg font-semibold">My Records</h1>
      <UButton to="/records/new" icon="i-lucide-plus" size="sm" aria-label="Add record" />
    </header>

    <UInput
      v-model="searchInput"
      icon="i-lucide-search"
      placeholder="Search content or meaning"
      size="sm"
      class="w-full"
    />

    <div class="flex flex-wrap gap-1.5" role="group" aria-label="Filter by type">
      <UButton
        v-for="chip in TYPE_CHIPS"
        :key="chip.value"
        :label="chip.label"
        size="xs"
        class="rounded-full"
        :color="type === chip.value ? 'primary' : 'neutral'"
        :variant="type === chip.value ? 'solid' : 'soft'"
        :aria-pressed="type === chip.value"
        @click="type = chip.value"
      />
    </div>

    <div class="flex items-center gap-2">
      <USelectMenu
        v-model="activeTagIds"
        :items="tagOptions"
        value-key="value"
        multiple
        placeholder="Tag"
        size="sm"
        class="flex-1"
      />
      <USelect
        v-model="sort"
        :items="SORT_OPTIONS"
        size="sm"
        class="w-36"
        aria-label="Sort order"
      />
    </div>

    <div v-if="activeTagIds.length > 0" class="flex flex-wrap gap-1.5">
      <UButton
        v-for="id in activeTagIds"
        :key="id"
        icon="i-lucide-x"
        size="xs"
        color="primary"
        variant="soft"
        class="rounded-full"
        :label="tagName(id) ?? '…'"
        :aria-label="`Remove filter ${tagName(id) ?? id}`"
        @click="removeTag(id)"
      />
      <UButton
        to="/tags"
        icon="i-lucide-plus"
        size="xs"
        color="neutral"
        variant="soft"
        class="rounded-full"
        aria-label="Manage tags"
      />
    </div>

    <template v-if="loading">
      <div class="flex flex-col gap-2">
        <USkeleton v-for="i in 3" :key="i" class="h-20 rounded-lg" />
      </div>
    </template>

    <div
      v-else-if="records.length === 0"
      class="flex flex-col items-center gap-3 py-10 text-center"
    >
      <UIcon
        :name="hasActiveFilters ? 'i-lucide-search-x' : 'i-lucide-notebook-pen'"
        class="size-8 text-dimmed"
      />
      <div>
        <p class="font-medium">{{ hasActiveFilters ? 'No matches' : 'No records yet' }}</p>
        <p class="mt-1 text-sm text-muted">
          {{
            hasActiveFilters
              ? 'Try different keywords or clear the filters.'
              : 'Capture your first word, phrase or sentence.'
          }}
        </p>
      </div>
      <UButton
        v-if="hasActiveFilters"
        label="Clear filters"
        color="neutral"
        variant="soft"
        size="sm"
        @click="clearFilters"
      />
      <UButton v-else to="/records/new" label="Add record" size="sm" />
    </div>

    <template v-else>
      <div class="flex flex-col gap-2">
        <RecordCard v-for="record in records" :key="record.id" :record="record" />
      </div>
      <div ref="sentinel" class="h-px" aria-hidden="true" />
      <div v-if="loadingMore" class="flex justify-center py-2">
        <UIcon name="i-lucide-loader-circle" class="size-4 animate-spin text-muted" />
      </div>
      <p v-else-if="!hasMore" class="text-center text-xs text-muted">
        {{ total }} record{{ total === 1 ? '' : 's' }}
      </p>
    </template>
  </div>
</template>
