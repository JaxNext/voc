<script setup lang="ts">
// Review session page (product-design §6.5/§6.6): progress header with exit,
// the active Flashcard, and the completion summary. All state lives in
// useReview (shared, so /review → /review/session navigation keeps the queue);
// grades POST through submitGrade — a failed grade keeps the card on screen
// (advance-on-confirm) and toasts the reason. Deep links / reloads rebuild a
// queue via ensureQueue; exit and Done clear the session and return to /review.

import type { Grade } from '~/types/records'

useHead({ title: 'Review session — Voc' })

const toast = useToast()
const {
  queue,
  currentIndex,
  loading,
  grading,
  error,
  current,
  isComplete,
  summary,
  loadQueue,
  ensureQueue,
  submitGrade,
  exitSession,
} = useReview()

// Load failures render as a full-page state; grade failures are toasts (the
// composable's `error` is reused by both paths, so the page copies it to a
// dedicated ref at load time — a stale load error must never leak into the
// in-session UI).
const loadError = ref('')

// "3 / 10" — current card number, clamped at total on the last card.
const progressLabel = computed(
  () => `${Math.min(currentIndex.value + 1, queue.value.length)} / ${queue.value.length}`,
)

async function start() {
  loadError.value = ''
  try {
    await ensureQueue()
  } catch {
    loadError.value = error.value ?? 'Could not start your review session'
  }
}

async function onAgain() {
  loadError.value = ''
  try {
    await loadQueue()
  } catch {
    loadError.value = error.value ?? 'Could not start a new session'
  }
}

async function onGrade(grade: Grade) {
  if (grading.value) return
  try {
    await submitGrade(grade)
  } catch {
    toast.add({
      title: error.value ?? 'Could not save your grade',
      color: 'error',
      icon: 'i-lucide-circle-alert',
    })
  }
}

async function onExit() {
  exitSession()
  await navigateTo('/review')
}

onMounted(() => {
  void start()
})
</script>

<template>
  <div class="flex flex-col gap-6">
    <div
      v-if="loading"
      class="flex items-center justify-center gap-2 rounded-lg bg-elevated p-10 text-sm text-muted"
    >
      <UIcon name="i-lucide-loader-circle" class="size-4 animate-spin" />
      Preparing your session…
    </div>

    <div v-else-if="loadError" class="rounded-lg bg-elevated p-6 text-center">
      <UIcon name="i-lucide-circle-alert" class="size-6 text-error" />
      <p class="mt-2 text-sm text-muted">{{ loadError }}</p>
      <UButton class="mt-4" color="neutral" variant="soft" @click="start">Try again</UButton>
    </div>

    <template v-else-if="isComplete">
      <div class="rounded-lg bg-elevated p-6 text-center">
        <p class="text-4xl">🎉</p>
        <h2 class="mt-2 text-lg font-semibold text-highlighted">Session complete!</h2>

        <dl class="mx-auto mt-5 max-w-56 space-y-1.5 text-sm">
          <div class="flex justify-between">
            <dt class="text-muted">Reviewed</dt>
            <dd class="font-medium tabular-nums text-highlighted">{{ summary.graded }}</dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-muted">Forgot</dt>
            <dd class="font-medium tabular-nums">{{ summary.counts.forgot }}</dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-muted">Hazy</dt>
            <dd class="font-medium tabular-nums">{{ summary.counts.hazy }}</dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-muted">Know</dt>
            <dd class="font-medium tabular-nums">{{ summary.counts.know }}</dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-muted">Easy</dt>
            <dd class="font-medium tabular-nums">{{ summary.counts.easy }}</dd>
          </div>
        </dl>

        <p class="mt-5 text-sm text-muted">
          New items: {{ summary.newCount }} · Mastered: {{ summary.mastered }}
        </p>
      </div>

      <div class="flex gap-2">
        <UButton block color="neutral" variant="soft" @click="onExit">Done</UButton>
        <UButton block @click="onAgain">Review Again</UButton>
      </div>
    </template>

    <div v-else-if="queue.length === 0" class="rounded-lg bg-elevated p-10 text-center">
      <p class="text-4xl">🎉</p>
      <h2 class="mt-3 font-medium text-highlighted">All caught up!</h2>
      <p class="mt-1 text-sm text-muted">Nothing is due right now.</p>
      <UButton class="mt-5" to="/review" color="neutral" variant="soft">Back to review</UButton>
    </div>

    <template v-else-if="current">
      <header class="flex items-center gap-2">
        <h1 class="text-lg font-semibold">Review</h1>
        <span class="ml-auto text-sm tabular-nums text-muted">{{ progressLabel }}</span>
        <UButton
          icon="i-lucide-x"
          color="neutral"
          variant="ghost"
          size="sm"
          aria-label="Exit session"
          :disabled="grading"
          @click="onExit"
        />
      </header>

      <Flashcard :item="current" :grading="grading" @grade="onGrade" />
    </template>
  </div>
</template>
