<script setup lang="ts">
// Review index per product-design §3.5/§6.5 — the "N items due today" daily
// anchor. Mounting builds the session queue via useReview (GET
// /api/review/session): the same fetch feeds this page's badge and the
// session page's queue, so tapping Start is instant. Every visit refetches —
// grading reschedules items, so the due count drifts after sessions.

useHead({ title: 'Review — Voc' })

const { totalDue, queue, loading, error, loadQueue } = useReview()

const loadError = ref('')

async function load() {
  loadError.value = ''
  try {
    await loadQueue()
  } catch {
    loadError.value = error.value ?? 'Could not load your review queue'
  }
}

onMounted(() => {
  void load()
})
</script>

<template>
  <div class="flex flex-col gap-6">
    <header>
      <h1 class="text-lg font-semibold">Review</h1>
    </header>

    <div
      v-if="loading"
      class="flex items-center justify-center gap-2 rounded-lg bg-elevated p-10 text-sm text-muted"
    >
      <UIcon name="i-lucide-loader-circle" class="size-4 animate-spin" />
      Loading your queue…
    </div>

    <div v-else-if="loadError" class="rounded-lg bg-elevated p-6 text-center">
      <UIcon name="i-lucide-circle-alert" class="size-6 text-error" />
      <p class="mt-2 text-sm text-muted">{{ loadError }}</p>
      <UButton class="mt-4" color="neutral" variant="soft" @click="load">Try again</UButton>
    </div>

    <div v-else-if="totalDue === 0" class="rounded-lg bg-elevated p-10 text-center">
      <p class="text-4xl">🎉</p>
      <h2 class="mt-3 font-medium text-highlighted">All caught up!</h2>
      <p class="mt-1 text-sm text-muted">
        Nothing is due right now — new records are due as soon as you add them.
      </p>
      <UButton class="mt-5" to="/records/new" color="neutral" variant="soft" icon="i-lucide-plus">
        Add a record
      </UButton>
    </div>

    <div v-else class="rounded-lg bg-elevated p-8 text-center">
      <p class="text-4xl font-semibold text-highlighted">{{ totalDue }}</p>
      <p class="mt-1 text-sm text-muted">{{ totalDue === 1 ? 'item' : 'items' }} due today</p>
      <UButton class="mt-6" size="lg" block to="/review/session" icon="i-lucide-play">
        Start Review Session
      </UButton>
      <p v-if="queue.length > 0 && queue.length < totalDue" class="mt-2 text-xs text-dimmed">
        Session of {{ queue.length }} — the rest stays due.
      </p>
    </div>
  </div>
</template>
