<script setup lang="ts">
// Record detail page (product-design §6.4): read view with Edit (toggles the
// RecordForm) and Delete (confirm modal — unlike a tag, deleting a record
// loses its review history and is not recreatable, so it asks first). The
// record refetches after an edit because updateRecord's return row does not
// carry fresh tag associations.

import { z } from 'zod'
import type { RecordWithTags } from '~/composables/useRecords'

const route = useRoute()

const TYPE_LABELS = { word: 'WORD', phrase: 'PHRASE', sentence: 'SENTENCE' } as const

const record = ref<RecordWithTags | null>(null)
const loading = ref(true)
const notFound = ref(false)
const editing = ref(false)
const confirmOpen = ref(false)
const deleting = ref(false)
const toast = useToast()
const { supported, speaking, speak } = useSpeech()

const isUuid = z.uuid().safeParse(String(route.params.id)).success

onMounted(async () => {
  if (!isUuid) {
    notFound.value = true
    loading.value = false
    return
  }
  const { fetchRecord } = useRecords()
  try {
    record.value = await fetchRecord(String(route.params.id))
    if (!record.value) notFound.value = true
  } catch (error) {
    toast.add({
      title: error instanceof Error ? error.message : 'Could not load record',
      color: 'error',
      icon: 'i-lucide-circle-alert',
    })
    notFound.value = true
  } finally {
    loading.value = false
  }
})

async function refetch() {
  const { fetchRecord } = useRecords()
  const fresh = await fetchRecord(String(route.params.id))
  if (fresh) record.value = fresh
}

async function onEdited() {
  editing.value = false
  await refetch()
}

const addedDate = computed(() =>
  record.value
    ? new Date(record.value.created_at).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '',
)

async function onDelete() {
  if (!record.value || deleting.value) return
  deleting.value = true
  try {
    const { deleteRecord } = useRecords()
    await deleteRecord(record.value.id)
    toast.add({
      title: 'Record deleted',
      color: 'success',
      icon: 'i-lucide-circle-check',
    })
    await navigateTo('/')
  } catch (error) {
    toast.add({
      title: error instanceof Error ? error.message : 'Could not delete record',
      color: 'error',
      icon: 'i-lucide-circle-alert',
    })
    confirmOpen.value = false
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <header class="flex items-center gap-2">
      <UButton
        to="/"
        icon="i-lucide-arrow-left"
        color="neutral"
        variant="ghost"
        size="sm"
        aria-label="Back to records"
      />
      <h1 class="text-lg font-semibold">Record</h1>
      <UButton
        v-if="record && !editing"
        label="Edit"
        icon="i-lucide-pencil"
        color="neutral"
        variant="ghost"
        size="sm"
        class="ml-auto"
        @click="editing = true"
      />
    </header>

    <template v-if="loading">
      <USkeleton class="h-5 w-20" />
      <USkeleton class="h-20 rounded-lg" />
      <USkeleton class="h-6 w-2/3" />
      <USkeleton class="h-4 w-1/2" />
    </template>

    <UAlert
      v-else-if="notFound"
      color="warning"
      variant="soft"
      title="Record not found"
      description="It may have been deleted, or it belongs to another account."
    />

    <RecordForm
      v-else-if="editing && record"
      :record="record"
      @success="onEdited"
      @cancel="editing = false"
    />

    <template v-else-if="record">
      <UBadge :label="TYPE_LABELS[record.type]" color="neutral" variant="soft" class="w-fit" />

      <section class="flex items-start justify-between gap-3 rounded-lg bg-elevated p-4">
        <p class="text-lg font-medium break-words">"{{ record.content }}"</p>
        <UButton
          v-if="supported"
          icon="i-lucide-volume-2"
          :color="speaking ? 'primary' : 'neutral'"
          variant="ghost"
          size="xs"
          aria-label="Play pronunciation"
          @click="speak(record.content)"
        />
      </section>

      <p class="text-base break-words">{{ record.meaning }}</p>

      <dl class="flex flex-col gap-3 text-sm">
        <div v-if="record.source">
          <dt class="text-muted">Source</dt>
          <dd class="break-words">{{ record.source }}</dd>
        </div>
        <div v-if="record.notes">
          <dt class="text-muted">Notes</dt>
          <dd class="whitespace-pre-line break-words">{{ record.notes }}</dd>
        </div>
        <div v-if="record.tags.length > 0">
          <dt class="text-muted">Tags</dt>
          <dd class="flex flex-wrap gap-1.5">
            <UBadge
              v-for="tag in record.tags"
              :key="tag.id"
              :label="`#${tag.name}`"
              color="neutral"
              variant="soft"
              size="sm"
            />
          </dd>
        </div>
        <div>
          <dt class="text-muted">Added</dt>
          <dd>{{ addedDate }}</dd>
        </div>
      </dl>

      <UButton
        label="Delete record"
        color="error"
        variant="soft"
        block
        icon="i-lucide-trash-2"
        @click="confirmOpen = true"
      />

      <UModal
        v-model:open="confirmOpen"
        title="Delete this record?"
        description="Its review history is removed too. This cannot be undone."
      >
        <template #footer="{ close }">
          <div class="flex w-full gap-2">
            <UButton label="Cancel" color="neutral" variant="ghost" block @click="close" />
            <UButton label="Delete" color="error" block :loading="deleting" @click="onDelete" />
          </div>
        </template>
      </UModal>
    </template>
  </div>
</template>
