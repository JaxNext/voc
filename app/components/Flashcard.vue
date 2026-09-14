<script setup lang="ts">
// Production-recall flashcard (product-design §6.5, direction decision in
// docs/2.2 §2): the front shows the meaning + type badge and the user tries
// to produce the English expression they captured; the back reveals the
// recorded content plus tags/source/notes for context, with 4 one-tap grade
// buttons. Presentational only — the parent (review/session page) owns the
// queue via useReview and turns `grade` events into POST /api/review/grade
// calls, passing `grading` back to disable the buttons in flight.
//
// Explicit Vue imports instead of Nuxt auto-imports so the bare-vitest SFC
// test compiles this file unchanged (same approach as RecordCard). The flip
// is CSS 3D: both faces stacked in one grid cell, backface hidden, container
// rotates — so height follows the taller face and no fixed card size is
// needed.

import { ref, watch } from 'vue'
import { useSpeech } from '~/composables/useSpeech'
import type { Grade } from '~/types/records'
import type { ReviewSessionItem } from '~/composables/useReview'

const props = defineProps<{
  item: ReviewSessionItem
  /** True while the grade POST is in flight — buttons disabled for retry safety. */
  grading?: boolean
}>()

const emit = defineEmits<{ grade: [grade: Grade] }>()

const { supported: canSpeak, speaking, speak, stop } = useSpeech()

const revealed = ref(false)

// Cards always start face-down: when the parent swaps in the next item the
// component instance is reused, so reset on record change (a failed grade
// keeps the same record, leaving the card revealed for retry). Speech is
// cancelled too so audio never bleeds into the next card.
watch(
  () => props.item.record.id,
  () => {
    revealed.value = false
    stop()
  },
)

// Wireframe order left→right; colors mirror SRS conventions (red = again,
// green = easiest).
const GRADE_META: Array<{
  grade: Grade
  label: string
  color: 'error' | 'warning' | 'primary' | 'success'
}> = [
  { grade: 'forgot', label: 'Forgot', color: 'error' },
  { grade: 'hazy', label: 'Hazy', color: 'warning' },
  { grade: 'know', label: 'Know', color: 'primary' },
  { grade: 'easy', label: 'Easy', color: 'success' },
]
</script>

<template>
  <div class="flip-scene">
    <div class="flip-card" :class="{ revealed }">
      <!-- Front: recall prompt -->
      <div
        class="flip-face flex flex-col items-center justify-center rounded-2xl border border-default bg-elevated p-5 text-center"
      >
        <p class="text-xs font-medium uppercase tracking-widest text-muted">
          {{ item.record.type }}
        </p>
        <p class="mt-4 text-2xl font-medium break-words text-highlighted">
          {{ item.record.meaning }}
        </p>
        <p class="mt-2 text-sm text-muted">Say it in English…</p>
        <UButton class="mt-6" size="lg" block :disabled="grading" @click="revealed = true">
          Show expression
        </UButton>
      </div>

      <!-- Back: reveal + self-grade -->
      <div class="flip-face flip-face-back rounded-2xl border border-default bg-elevated p-5">
        <div class="flex items-start justify-between gap-2">
          <p class="text-xl font-medium break-words text-highlighted">
            "{{ item.record.content }}"
          </p>
          <UButton
            v-if="canSpeak"
            icon="i-lucide-volume-2"
            :color="speaking ? 'primary' : 'neutral'"
            variant="ghost"
            size="xs"
            aria-label="Play pronunciation"
            @click="speak(item.record.content)"
          />
        </div>
        <p class="mt-1 text-sm text-muted">{{ item.record.meaning }}</p>
        <p
          v-if="item.record.tags.length > 0"
          class="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-muted"
        >
          <span
            v-for="tag in item.record.tags"
            :key="tag.id"
            class="rounded-full bg-accented px-2 py-0.5"
          >
            #{{ tag.name }}
          </span>
        </p>
        <p v-if="item.record.source" class="mt-3 text-xs text-muted">
          Source: {{ item.record.source }}
        </p>
        <p v-if="item.record.notes" class="mt-1 text-sm whitespace-pre-line text-toned">
          {{ item.record.notes }}
        </p>

        <p class="mt-5 text-sm text-muted">Could you express it?</p>
        <div role="group" aria-label="Grade your recall" class="mt-2 grid grid-cols-4 gap-1.5">
          <UButton
            v-for="meta in GRADE_META"
            :key="meta.grade"
            :color="meta.color"
            variant="soft"
            :disabled="grading"
            @click="emit('grade', meta.grade)"
          >
            {{ meta.label }}
          </UButton>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.flip-scene {
  perspective: 1400px;
}

.flip-card {
  display: grid;
  transform-style: preserve-3d;
  transition: transform 0.5s cubic-bezier(0.4, 0.2, 0.2, 1);
}

.flip-card.revealed {
  transform: rotateY(180deg);
}

.flip-face {
  grid-area: 1 / 1;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}

.flip-face-back {
  transform: rotateY(180deg);
}

@media (prefers-reduced-motion: reduce) {
  .flip-card {
    transition: none;
  }
}
</style>
