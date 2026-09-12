<script setup lang="ts">
// List card per product-design §6.2: quoted content, "Type · meaning",
// "#tags · relative time" — the whole card is the tap target to the detail
// page. Badges are plain spans (dependency-light in long lists). Explicit
// imports instead of Nuxt auto-imports so the bare-vitest SFC test compiles
// this file unchanged.

import { formatRelativeTime } from '~/utils/datetime'
import type { RecordWithTags } from '~/composables/useRecords'

defineProps<{ record: RecordWithTags }>()
</script>

<template>
  <NuxtLink
    :to="`/records/${record.id}`"
    class="block rounded-lg bg-elevated px-3.5 py-3 transition-colors hover:bg-accented/50"
  >
    <p class="font-medium break-words">"{{ record.content }}"</p>
    <p class="mt-0.5 text-sm text-muted">
      <span class="capitalize">{{ record.type }}</span>
      <span v-if="record.meaning"> · {{ record.meaning }}</span>
    </p>
    <p v-if="record.tags.length > 0" class="mt-1.5 flex items-center gap-1.5 text-xs text-muted">
      <span v-for="tag in record.tags" :key="tag.id" class="rounded-full bg-accented px-2 py-0.5">
        #{{ tag.name }}
      </span>
      <time class="ml-auto whitespace-nowrap">{{ formatRelativeTime(record.created_at) }}</time>
    </p>
    <p v-else class="mt-1.5 text-right text-xs text-muted">
      <time>{{ formatRelativeTime(record.created_at) }}</time>
    </p>
  </NuxtLink>
</template>
