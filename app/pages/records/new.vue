<script setup lang="ts">
// New record entry page (product-design §6.3, create mode): thin shell around
// RecordForm — the form owns fields, validation and submission; this page owns
// the header and post-save navigation to the new record's detail view.

import type { VocRecord } from '~/composables/useRecords'

useHead({ title: 'New record — Voc' })

async function onCreated(record: VocRecord) {
  await navigateTo(`/records/${record.id}`)
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
      <h1 class="text-lg font-semibold">New record</h1>
    </header>

    <RecordForm @success="onCreated" />
  </div>
</template>
