<script setup lang="ts">
const route = useRoute()

// Auth screens and the OAuth consent screen render their own full-screen
// layouts; the app shell (content container + bottom nav) applies to every
// other route. The consent path is NOT public (the auth guard requires a
// session there) — it only shares the full-screen presentation.
const isFullscreenRoute = computed(
  () => PUBLIC_AUTH_PATHS.has(route.path) || route.path === OAUTH_CONSENT_PATH,
)
</script>

<template>
  <UApp>
    <NuxtRouteAnnouncer />

    <NuxtPage v-if="isFullscreenRoute" />

    <!-- App shell: mobile-first column with clearance for the bottom nav. -->
    <main v-else class="min-h-dvh pb-24 md:pb-10">
      <div class="mx-auto w-full max-w-lg px-4 pt-4">
        <NuxtPage />
      </div>
    </main>

    <AppBottomNav v-if="!isFullscreenRoute" />
  </UApp>
</template>
