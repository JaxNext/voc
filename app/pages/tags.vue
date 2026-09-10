<script setup lang="ts">
// Tags management page (product-design §6.9): predefined tags are read-only;
// custom tags list with inline delete (FK cascade un-tags records — deleting
// is low-stakes and recreatable, so it deletes immediately with a toast
// instead of a confirm dialog). Creation reuses TagCreateInline.

import type { Tag } from '~/composables/useTags'

useHead({ title: 'Tags — Voc' })

const { tags, predefinedTags, customTags, loading, ensureLoaded, deleteTag } = useTags()
const toast = useToast()

onMounted(() => {
  void ensureLoaded()
})

const deletingId = ref<string | null>(null)

async function remove(tag: Tag) {
  if (deletingId.value) return
  deletingId.value = tag.id
  try {
    await deleteTag(tag.id)
    toast.add({
      title: `Tag "${tag.name}" deleted — records using it were untagged`,
      color: 'success',
      icon: 'i-lucide-circle-check',
    })
  } catch (error) {
    toast.add({
      title: error instanceof Error ? error.message : 'Could not delete tag',
      color: 'error',
      icon: 'i-lucide-circle-alert',
    })
  } finally {
    deletingId.value = null
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
      <h1 class="text-lg font-semibold">Tags</h1>
    </header>

    <template v-if="loading && tags.length === 0">
      <div v-for="i in 2" :key="i" class="flex flex-col gap-2">
        <USkeleton class="h-4 w-24" />
        <USkeleton v-for="j in 3" :key="j" class="h-11 rounded-lg" />
      </div>
    </template>

    <template v-else>
      <section aria-labelledby="tags-predefined">
        <h2
          id="tags-predefined"
          class="mb-2 text-xs font-medium tracking-wide text-muted uppercase"
        >
          Predefined
        </h2>
        <ul class="flex flex-col gap-2">
          <li
            v-for="tag in predefinedTags"
            :key="tag.id"
            class="flex items-center rounded-lg bg-elevated px-3 py-2.5"
          >
            <span class="font-medium">#{{ tag.name }}</span>
          </li>
        </ul>
      </section>

      <section aria-labelledby="tags-custom">
        <h2 id="tags-custom" class="mb-2 text-xs font-medium tracking-wide text-muted uppercase">
          Custom
        </h2>
        <div class="mb-2 flex items-center gap-1.5">
          <TagCreateInline />
        </div>
        <ul v-if="customTags.length > 0" class="flex flex-col gap-2">
          <li
            v-for="tag in customTags"
            :key="tag.id"
            class="flex items-center justify-between rounded-lg bg-elevated px-3 py-2.5"
          >
            <span class="font-medium">#{{ tag.name }}</span>
            <UButton
              icon="i-lucide-x"
              color="neutral"
              variant="ghost"
              size="xs"
              :aria-label="`Delete tag #${tag.name}`"
              :loading="deletingId === tag.id"
              @click="remove(tag)"
            />
          </li>
        </ul>
        <p v-else class="text-sm text-muted">
          No custom tags yet — create one above or from a record form.
        </p>
      </section>
    </template>
  </div>
</template>
