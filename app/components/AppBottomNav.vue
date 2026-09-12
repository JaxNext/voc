<script setup lang="ts">
interface NavItem {
  label: string
  icon: string
  to: string
  // Exact match avoids "/" being active for every path (prefix rule).
  exact?: boolean
}

const items: NavItem[] = [
  { label: 'Records', icon: 'i-lucide-library', to: '/', exact: true },
  { label: 'Review', icon: 'i-lucide-repeat', to: '/review' },
  { label: 'Add', icon: 'i-lucide-plus', to: '/records/new' },
  { label: 'Stats', icon: 'i-lucide-chart-column', to: '/stats' },
  { label: 'Me', icon: 'i-lucide-user', to: '/settings' },
]

const route = useRoute()

function isActive(item: NavItem) {
  return item.exact ? route.path === item.to : route.path.startsWith(item.to)
}
</script>

<template>
  <nav
    aria-label="Main navigation"
    class="fixed inset-x-0 bottom-0 z-40 border-t border-default bg-default pb-[env(safe-area-inset-bottom)]"
  >
    <div class="mx-auto flex w-full max-w-lg">
      <NuxtLink
        v-for="item in items"
        :key="item.to"
        :to="item.to"
        class="flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium"
        :class="isActive(item) ? 'text-primary' : 'text-muted'"
        :aria-current="isActive(item) ? 'page' : undefined"
      >
        <UIcon :name="item.icon" class="size-5 shrink-0" />
        <span>{{ item.label }}</span>
      </NuxtLink>
    </div>
  </nav>
</template>
