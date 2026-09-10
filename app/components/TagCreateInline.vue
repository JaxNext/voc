<script setup lang="ts">
// Inline custom-tag creation, shared by TagPicker (inside the chip row) and
// the /tags manager page. Renders a dashed "+ Add tag" chip that flips into
// a compact input; submits through useTags().createTag. Creating an existing
// name (any casing) just emits that tag instead — friendly per the
// immediate-feedback UX. Toasts are handled here; consumers react to the
// emitted tag (e.g. TagPicker selects it).

import { MAX_TAG_NAME } from '~/types/records'
import type { Tag } from '~/composables/useTags'

defineProps<{ disabled?: boolean }>()

const emit = defineEmits<{ created: [tag: Tag]; existing: [tag: Tag] }>()

const { tags, createTag } = useTags()
const toast = useToast()

const creating = ref(false)
const creatingTag = ref(false)
const newName = ref('')
const newTagInput = useTemplateRef<{ inputRef: HTMLInputElement | null }>('newTagInput')

async function startCreate() {
  creating.value = true
  await nextTick()
  newTagInput.value?.inputRef?.focus()
}

function cancelCreate() {
  creating.value = false
  creatingTag.value = false
  newName.value = ''
}

async function submitCreate() {
  if (creatingTag.value) return
  const name = newName.value

  const existing = tags.value.find(tag => tag.name.toLowerCase() === name.trim().toLowerCase())
  if (existing) {
    toast.add({
      title: `Tag "${existing.name}" already exists — selected`,
      color: 'info',
      icon: 'i-lucide-info',
    })
    emit('existing', existing)
    cancelCreate()
    return
  }

  creatingTag.value = true
  try {
    const tag = await createTag(name)
    toast.add({
      title: `Tag "${tag.name}" created`,
      color: 'success',
      icon: 'i-lucide-circle-check',
    })
    emit('created', tag)
    cancelCreate()
  } catch (error) {
    toast.add({
      title: error instanceof Error ? error.message : 'Could not create tag',
      color: 'error',
      icon: 'i-lucide-circle-alert',
    })
    creatingTag.value = false // keep the input open so the name can be fixed
  }
}
</script>

<template>
  <template v-if="creating">
    <UInput
      ref="newTagInput"
      v-model="newName"
      :maxlength="MAX_TAG_NAME"
      size="sm"
      placeholder="New tag name"
      class="w-36"
      :disabled="disabled || creatingTag"
      @keydown.enter.prevent="submitCreate"
      @keydown.esc="cancelCreate"
    />
    <UButton
      icon="i-lucide-check"
      size="sm"
      color="primary"
      variant="soft"
      class="rounded-full"
      aria-label="Create tag"
      :loading="creatingTag"
      @click="submitCreate"
    />
    <UButton
      icon="i-lucide-x"
      size="sm"
      color="neutral"
      variant="ghost"
      class="rounded-full"
      aria-label="Cancel"
      :disabled="disabled"
      @click="cancelCreate"
    />
  </template>

  <UButton
    v-else
    icon="i-lucide-plus"
    label="Add tag"
    size="sm"
    color="neutral"
    variant="outline"
    class="rounded-full border-dashed"
    :disabled="disabled"
    @click="startCreate"
  />
</template>
