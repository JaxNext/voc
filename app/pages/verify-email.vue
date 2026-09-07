<script setup lang="ts">
useHead({ title: 'Check your inbox — Voc' })

const route = useRoute()
const supabase = useSupabaseClient()

type Status = 'checking' | 'instructions' | 'verified' | 'error'

const status = ref<Status>('checking')
const errorMessage = ref<string | null>(null)
const email = computed(() =>
  typeof route.query.email === 'string' ? route.query.email : undefined,
)

onMounted(async () => {
  // Case 1: email-verification link with a token_hash (PKCE-style callback).
  const tokenHash = typeof route.query.token_hash === 'string' ? route.query.token_hash : undefined
  if (tokenHash) {
    const { error } = await supabase.auth.verifyOtp({ type: 'email', token_hash: tokenHash })
    if (error) {
      status.value = 'error'
      errorMessage.value = error.message
      return
    }
    status.value = 'verified'
    await navigateTo('/')
    return
  }

  // Case 2: implicit-flow link carries the session in the URL hash. The
  // Supabase client detects it automatically — confirm the session exists.
  const { data } = await supabase.auth.getSession()
  if (data.session) {
    status.value = 'verified'
    await navigateTo('/')
    return
  }

  // Case 3: plain instruction view (arrived here from the register page).
  status.value = 'instructions'
})
</script>

<template>
  <main class="flex min-h-dvh items-center justify-center px-4 py-10">
    <div class="w-full max-w-sm space-y-6 text-center">
      <header class="space-y-1">
        <h1 class="text-2xl font-semibold tracking-tight">Voc</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400">Capture. Review. Grow.</p>
      </header>

      <section class="space-y-4">
        <p v-if="status === 'checking'" class="text-sm text-gray-500 dark:text-gray-400">
          Checking your verification link…
        </p>

        <template v-else-if="status === 'verified'">
          <p class="text-lg font-medium">Email verified!</p>
          <p class="text-sm text-gray-500 dark:text-gray-400">Taking you to your records…</p>
        </template>

        <template v-else-if="status === 'error'">
          <UAlert
            color="error"
            variant="soft"
            title="Verification failed"
            :description="errorMessage ?? undefined"
          />
          <p class="text-sm text-gray-500 dark:text-gray-400">
            The link may be expired. You can try logging in and requesting a new one.
          </p>
          <NuxtLink
            to="/login"
            class="inline-block text-sm font-medium text-gray-900 underline underline-offset-4 dark:text-gray-100"
          >
            Back to login
          </NuxtLink>
        </template>

        <template v-else>
          <UAlert
            color="success"
            variant="soft"
            title="Check your inbox"
            :description="
              email
                ? `We sent a confirmation link to ${email}. Open it to activate your account.`
                : 'We sent you a confirmation link. Open it to activate your account.'
            "
          />
          <p class="text-xs text-gray-400 dark:text-gray-500">
            Didn't see it? Check your spam folder, then try logging in to send a new link.
          </p>
          <NuxtLink
            to="/login"
            class="inline-block text-sm font-medium text-gray-900 underline underline-offset-4 dark:text-gray-100"
          >
            Back to login
          </NuxtLink>
        </template>
      </section>
    </div>
  </main>
</template>
