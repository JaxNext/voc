<script setup lang="ts">
// Unified record capture/edit form (product-design §6.3). Create mode when
// `record` is absent, edit mode when it is passed — pages render it only
// after data is loaded so prefill happens once at setup. UForm runs
// RecordInputSchema (the same Zod schema the composable enforces) and only
// emits submit with parsed data; the composable's parseInput is then a
// no-op double check. Submission calls useRecords directly; pages react to
// `success` (navigate) and `cancel`.

import {
  RecordInputSchema,
  RECORD_TYPES,
  MAX_CONTENT,
  MAX_MEANING,
  MAX_SOURCE,
  MAX_NOTES,
} from '~/types/records'
import type { RecordInput, RecordType } from '~/types/records'
import type { RecordWithTags, VocRecord } from '~/composables/useRecords'

const props = defineProps<{ record?: RecordWithTags }>()

const emit = defineEmits<{ success: [record: VocRecord]; cancel: [] }>()

const isEdit = computed(() => !!props.record)

const { createRecord, updateRecord } = useRecords()
const toast = useToast()

const TYPE_LABELS: Record<RecordType, string> = {
  word: 'Word',
  phrase: 'Phrase',
  sentence: 'Sentence',
}

const state = reactive<RecordInput>({
  type: props.record?.type ?? 'word',
  content: props.record?.content ?? '',
  meaning: props.record?.meaning ?? '',
  source: props.record?.source ?? '',
  notes: props.record?.notes ?? '',
  tagIds: props.record?.tags.map(tag => tag.id) ?? [],
})

const submitting = ref(false)

async function onSubmit({ data }: { data: RecordInput }) {
  if (submitting.value) return
  // Empty optional strings become undefined so DB rows keep null, not ''.
  const payload: RecordInput = {
    ...data,
    source: data.source || undefined,
    notes: data.notes || undefined,
  }

  submitting.value = true
  try {
    const saved = props.record
      ? await updateRecord(props.record.id, payload)
      : await createRecord(payload)
    toast.add({
      title: props.record ? 'Changes saved' : `Record added — due for review today`,
      color: 'success',
      icon: 'i-lucide-circle-check',
    })
    emit('success', saved)
  } catch (error) {
    toast.add({
      title: error instanceof Error ? error.message : 'Could not save record',
      color: 'error',
      icon: 'i-lucide-circle-alert',
    })
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <UForm :schema="RecordInputSchema" :state="state" class="flex flex-col gap-4" @submit="onSubmit">
    <UFormField label="Type">
      <div role="group" aria-label="Record type" class="flex flex-wrap gap-1.5">
        <UButton
          v-for="type in RECORD_TYPES"
          :key="type"
          :label="TYPE_LABELS[type]"
          size="sm"
          class="rounded-full"
          :color="state.type === type ? 'primary' : 'neutral'"
          :variant="state.type === type ? 'solid' : 'soft'"
          type="button"
          :aria-pressed="state.type === type"
          :disabled="submitting"
          @click="state.type = type"
        />
      </div>
    </UFormField>

    <UFormField name="content" label="Content" required>
      <UTextarea
        v-model="state.content"
        name="content"
        :rows="2"
        autoresize
        :maxlength="MAX_CONTENT"
        placeholder="Word, phrase or sentence"
        class="w-full"
        :disabled="submitting"
      />
    </UFormField>

    <UFormField name="meaning" label="Meaning" required>
      <UTextarea
        v-model="state.meaning"
        name="meaning"
        :rows="2"
        autoresize
        :maxlength="MAX_MEANING"
        placeholder="What it means"
        class="w-full"
        :disabled="submitting"
      />
    </UFormField>

    <UFormField name="source" label="Source" hint="optional">
      <UInput
        v-model="state.source"
        name="source"
        :maxlength="MAX_SOURCE"
        placeholder="Book, podcast, conversation…"
        class="w-full"
        :disabled="submitting"
      />
    </UFormField>

    <UFormField name="notes" label="Notes" hint="optional">
      <UTextarea
        v-model="state.notes"
        name="notes"
        :rows="3"
        autoresize
        :maxlength="MAX_NOTES"
        placeholder="Context, usage, mnemonics…"
        class="w-full"
        :disabled="submitting"
      />
    </UFormField>

    <UFormField name="tagIds" label="Tags">
      <TagPicker v-model="state.tagIds" :disabled="submitting" />
    </UFormField>

    <div class="flex flex-col gap-2 pt-2">
      <UButton type="submit" block :loading="submitting">
        {{ isEdit ? 'Save changes' : 'Save record' }}
      </UButton>
      <UButton
        v-if="isEdit"
        color="neutral"
        variant="ghost"
        block
        :disabled="submitting"
        @click="emit('cancel')"
      >
        Cancel
      </UButton>
    </div>
  </UForm>
</template>
