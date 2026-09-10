<script setup lang="ts">
// Chip-based tag selector shared by record forms and list filters.
// Selection is a v-model of tag IDs; chips render the shared tag state from
// useTags() (predefined first, then the user's newest custom tags). Inline
// creation lives in TagCreateInline — a created (or already-existing) tag is
// selected automatically.

import type { Tag } from '~/composables/useTags'

const model = defineModel<string[]>({ default: () => [] })

defineProps<{ disabled?: boolean }>()

const { tags, predefinedTags, customTags, loading, ensureLoaded } = useTags()

const allTags = computed(() => [...predefinedTags.value, ...customTags.value])

onMounted(() => {
  void ensureLoaded()
})

function isSelected(id: string) {
  return model.value.includes(id)
}

function toggle(id: string) {
  model.value = isSelected(id) ? model.value.filter(t => t !== id) : [...model.value, id]
}

function selectTag(tag: Tag) {
  if (!isSelected(tag.id)) model.value = [...model.value, tag.id]
}
</script>

<template>
  <div role="group" aria-label="Tags" class="flex flex-wrap items-center gap-1.5">
    <template v-if="loading && tags.length === 0">
      <USkeleton v-for="i in 3" :key="i" class="h-7 w-16 rounded-full" />
    </template>

    <template v-else>
      <UButton
        v-for="tag in allTags"
        :key="tag.id"
        :label="`#${tag.name}`"
        size="sm"
        class="rounded-full"
        :color="isSelected(tag.id) ? 'primary' : 'neutral'"
        :variant="isSelected(tag.id) ? 'solid' : 'soft'"
        :aria-pressed="isSelected(tag.id)"
        :disabled="disabled"
        @click="toggle(tag.id)"
      />
    </template>

    <TagCreateInline :disabled="disabled" @created="selectTag" @existing="selectTag" />
  </div>
</template>
