<script setup lang="ts">
const route = useRoute()

// Auth screens render their own full-screen layouts; the app shell
// (content container + bottom nav) applies to every other route.
const isPublicRoute = computed(() => PUBLIC_AUTH_PATHS.has(route.path))
</script>

<template>
  <UApp>
    <NuxtRouteAnnouncer />

    <NuxtPage v-if="isPublicRoute" />

    <!-- App shell: mobile-first column with clearance for the bottom nav. -->
    <main v-else class="min-h-dvh pb-24 md:pb-10">
      <div class="mx-auto w-full max-w-lg px-4 pt-4">
        <NuxtPage />
      </div>
    </main>

    <AppBottomNav v-if="!isPublicRoute" />
  </UApp>
</template>
