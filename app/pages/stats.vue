<script setup lang="ts">
// Stats dashboard per product-design §6.7 and development-plan §2.3: streak
// badge, KPI cards (Total / Learning / Mastered), a due-today callout with a
// direct "Start review" CTA, and the weekly activity histogram. Data comes
// from GET /api/stats in one request; the client passes its IANA timezone so
// the server's streak/weekly day boundaries match the device calendar.
// Fetch runs onMounted (client-only) like the review index — every visit
// refetches, so finishing a session refreshes the numbers on the way back.

import type { VocStats } from '~~/server/api/stats.get'
import { describeError } from '~/composables/useReview'

useHead({ title: 'Stats — Voc' })

const stats = ref<VocStats | null>(null)
const loading = ref(true)
const loadError = ref('')

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    stats.value = await $fetch<VocStats>('/api/stats', { query: { tz } })
  } catch (err) {
    loadError.value = describeError(err)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void load()
})

// Histogram scale: the tallest bar fills the track; zero days render as a
// flat stub instead of an invisible bar.
const maxWeekly = computed(() =>
  Math.max(1, ...(stats.value?.weeklyActivity.map(day => day.count) ?? [1])),
)

function barHeight(count: number): string {
  return `${Math.max(10, Math.round((count / maxWeekly.value) * 100))}%`
}

// Server day keys are the user's local calendar days (computed in the tz the
// client sent), so parsing at local midnight yields the correct weekday.
function weekday(dateKey: string): string {
  return new Date(`${dateKey}T00:00:00`).toLocaleDateString(undefined, { weekday: 'narrow' })
}

function reviewsLabel(count: number): string {
  return count === 1 ? '1 review' : `${count} reviews`
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <header>
      <h1 class="text-lg font-semibold">Stats</h1>
    </header>

    <div
      v-if="loading"
      class="flex items-center justify-center gap-2 rounded-lg bg-elevated p-10 text-sm text-muted"
    >
      <UIcon name="i-lucide-loader-circle" class="size-4 animate-spin" />
      Loading your progress…
    </div>

    <div v-else-if="loadError" class="rounded-lg bg-elevated p-6 text-center">
      <UIcon name="i-lucide-circle-alert" class="size-6 text-error" />
      <p class="mt-2 text-sm text-muted">{{ loadError }}</p>
      <UButton class="mt-4" color="neutral" variant="soft" @click="load">Try again</UButton>
    </div>

    <template v-else-if="stats">
      <section
        class="flex items-center gap-3 rounded-lg bg-elevated p-4"
        :class="stats.streak > 0 ? 'text-warning' : 'text-muted'"
        aria-label="Review streak"
      >
        <UIcon name="i-lucide-flame" class="size-6 shrink-0" />
        <p class="text-sm font-medium">
          <template v-if="stats.streak > 0">{{ stats.streak }}-day streak</template>
          <template v-else>No streak yet — review today to start one</template>
        </p>
      </section>

      <section class="grid grid-cols-3 gap-3" aria-label="Record counts">
        <div class="rounded-lg bg-elevated p-3 text-center">
          <p class="text-xl font-semibold tabular-nums text-highlighted">
            {{ stats.totalRecords }}
          </p>
          <p class="mt-0.5 text-xs text-muted">Total</p>
        </div>
        <div class="rounded-lg bg-elevated p-3 text-center">
          <p class="text-xl font-semibold tabular-nums text-primary">{{ stats.learning }}</p>
          <p class="mt-0.5 text-xs text-muted">Learning</p>
        </div>
        <div class="rounded-lg bg-elevated p-3 text-center">
          <p class="text-xl font-semibold tabular-nums text-success">{{ stats.mastered }}</p>
          <p class="mt-0.5 text-xs text-muted">Mastered</p>
        </div>
      </section>

      <section v-if="stats.dueToday > 0" class="rounded-lg bg-elevated p-6 text-center">
        <p class="text-2xl font-semibold tabular-nums text-highlighted">{{ stats.dueToday }}</p>
        <p class="mt-1 text-sm text-muted">
          {{ stats.dueToday === 1 ? 'item' : 'items' }} due today
        </p>
        <UButton class="mt-4" size="lg" block to="/review/session" icon="i-lucide-play">
          Start review
        </UButton>
      </section>
      <section
        v-else
        class="flex items-center justify-center gap-2 rounded-lg bg-elevated p-4 text-sm text-muted"
      >
        <span aria-hidden="true">🎉</span>
        All caught up — nothing due right now
      </section>

      <section class="rounded-lg bg-elevated p-4" aria-label="Reviews this week">
        <h2 class="text-sm font-medium">Reviews this week</h2>
        <div class="mt-4 flex items-end gap-2">
          <div
            v-for="(day, index) in stats.weeklyActivity"
            :key="day.date"
            class="flex flex-1 flex-col items-center gap-1.5"
          >
            <div class="flex h-20 w-full items-end">
              <div
                class="w-full rounded-t-sm"
                :class="day.count > 0 ? 'bg-primary' : 'bg-accented'"
                :style="{ height: day.count > 0 ? barHeight(day.count) : '4px' }"
                :title="`${day.date}: ${reviewsLabel(day.count)}`"
                :aria-label="`${day.date}: ${reviewsLabel(day.count)}`"
                role="img"
              />
            </div>
            <span
              class="text-xs"
              :class="
                index === stats.weeklyActivity.length - 1
                  ? 'font-medium text-highlighted'
                  : 'text-dimmed'
              "
            >
              {{ weekday(day.date) }}
            </span>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>
