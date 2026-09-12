<script setup lang="ts">
// "Me" page per product-design §6.8: profile card (email + member since),
// Tags management link, and Log out. Export/Change password rows render as
// disabled placeholders — export lands in 3.1, in-app password change is not
// in the plan (the reset-password flow covers recovery). signOut() on the
// @supabase/ssr-backed client clears the HttpOnly cookie session; the global
// guard would catch the next navigation anyway, but we route to /login
// explicitly per the plan.

useHead({ title: 'Me — Voc' })

const user = useSupabaseUser()
const supabase = useSupabaseClient()
const toast = useToast()

const signingOut = ref(false)

const memberSince = computed(() =>
  user.value?.created_at
    ? new Date(user.value.created_at).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
      })
    : '',
)

async function logout() {
  if (signingOut.value) return
  signingOut.value = true
  try {
    await supabase.auth.signOut()
    await navigateTo('/login')
  } catch {
    toast.add({
      title: 'Could not sign out. Please try again.',
      color: 'error',
      icon: 'i-lucide-circle-alert',
    })
    signingOut.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <header>
      <h1 class="text-lg font-semibold">Me</h1>
    </header>

    <section class="flex items-center gap-3 rounded-lg bg-elevated p-4">
      <span class="flex size-10 items-center justify-center rounded-full bg-primary/10">
        <UIcon name="i-lucide-user" class="size-5 text-primary" />
      </span>
      <div class="min-w-0">
        <p class="truncate font-medium">{{ user?.email ?? 'Signed out' }}</p>
        <p v-if="memberSince" class="text-sm text-muted">Member since {{ memberSince }}</p>
      </div>
    </section>

    <nav class="flex flex-col overflow-hidden rounded-lg bg-elevated" aria-label="Settings">
      <NuxtLink
        to="/tags"
        class="flex items-center justify-between px-4 py-3 text-sm transition-colors hover:bg-accented/50"
      >
        Tags management
        <UIcon name="i-lucide-chevron-right" class="size-4 text-dimmed" />
      </NuxtLink>
      <div class="flex items-center justify-between px-4 py-3 text-sm text-dimmed">
        Data export (JSON)
        <span class="text-xs">Coming soon</span>
      </div>
      <div class="flex items-center justify-between px-4 py-3 text-sm text-dimmed">
        Change password
        <span class="text-xs">Coming soon</span>
      </div>
    </nav>

    <UButton
      label="Log out"
      color="neutral"
      variant="soft"
      block
      icon="i-lucide-log-out"
      :loading="signingOut"
      @click="logout"
    />
  </div>
</template>
