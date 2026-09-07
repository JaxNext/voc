<script setup lang="ts">
import {
  NewPasswordSchema,
  ResetRequestSchema,
  type NewPassword,
  type ResetRequest,
} from '~/types/auth'

useHead({ title: 'Reset password — Voc' })

const route = useRoute()
const supabase = useSupabaseClient()

// 'checking' → figure out which view applies while the callback session
// (implicit hash flow) or token_hash (PKCE-style flow) is being resolved.
type Mode = 'checking' | 'request' | 'set' | 'sent'

const mode = ref<Mode>('checking')
const serverError = ref<string | null>(null)
const pending = ref(false)

const requestState = reactive<ResetRequest>({ email: '' })
const newPasswordState = reactive<NewPassword>({ password: '', confirmPassword: '' })

onMounted(async () => {
  // Case 1: password-recovery link with a token_hash — exchange it first to
  // obtain a session, then show the "choose a new password" form.
  const tokenHash = typeof route.query.token_hash === 'string' ? route.query.token_hash : undefined
  if (tokenHash) {
    const { error } = await supabase.auth.verifyOtp({ type: 'recovery', token_hash: tokenHash })
    if (error) {
      serverError.value = error.message
      mode.value = 'request'
      return
    }
    mode.value = 'set'
    return
  }

  // Case 2: implicit-flow link carries the session in the URL hash and the
  // Supabase client detects it automatically.
  const { data } = await supabase.auth.getSession()
  mode.value = data.session ? 'set' : 'request'
})

async function requestReset({ data }: { data: ResetRequest }) {
  serverError.value = null
  pending.value = true
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) {
      serverError.value = error.message
      return
    }
    mode.value = 'sent'
  } finally {
    pending.value = false
  }
}

async function updatePassword({ data }: { data: NewPassword }) {
  serverError.value = null
  pending.value = true
  try {
    const { error } = await supabase.auth.updateUser({ password: data.password })
    if (error) {
      serverError.value = error.message
      return
    }
    // Drop the recovery session and let the user sign in with the new password.
    await supabase.auth.signOut()
    await navigateTo('/login?reset=1')
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <main class="flex min-h-dvh items-center justify-center px-4 py-10">
    <div class="w-full max-w-sm space-y-6">
      <header class="space-y-1 text-center">
        <h1 class="text-2xl font-semibold tracking-tight">Voc</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400">Capture. Review. Grow.</p>
      </header>

      <section class="space-y-4">
        <p v-if="mode === 'checking'" class="text-center text-sm text-gray-500 dark:text-gray-400">
          Checking your reset link…
        </p>

        <template v-else-if="mode === 'request'">
          <h2 class="text-center text-lg font-medium">Reset password</h2>

          <UAlert
            v-if="serverError"
            color="error"
            variant="soft"
            :title="serverError ?? undefined"
          />

          <p class="text-sm text-gray-500 dark:text-gray-400">
            Enter your email and we will send a reset link.
          </p>

          <UForm
            :schema="ResetRequestSchema"
            :state="requestState"
            class="space-y-4"
            @submit="requestReset"
          >
            <UFormField name="email" label="Email" required>
              <UInput
                v-model="requestState.email"
                name="email"
                type="email"
                autocomplete="email"
                placeholder="you@example.com"
              />
            </UFormField>

            <UButton type="submit" block :disabled="pending">
              {{ pending ? 'Sending…' : 'Send reset link' }}
            </UButton>
          </UForm>

          <NuxtLink
            to="/login"
            class="block text-center text-sm text-gray-500 underline-offset-4 hover:text-gray-900 hover:underline dark:text-gray-400 dark:hover:text-gray-100"
          >
            Back to login
          </NuxtLink>
        </template>

        <template v-else-if="mode === 'set'">
          <h2 class="text-center text-lg font-medium">Choose a new password</h2>

          <UAlert
            v-if="serverError"
            color="error"
            variant="soft"
            :title="serverError ?? undefined"
          />

          <UForm
            :schema="NewPasswordSchema"
            :state="newPasswordState"
            class="space-y-4"
            @submit="updatePassword"
          >
            <UFormField
              name="password"
              label="New password"
              description="At least 8 characters and one number."
              required
            >
              <UInput
                v-model="newPasswordState.password"
                name="password"
                type="password"
                autocomplete="new-password"
                placeholder="Your new password"
              />
            </UFormField>

            <UFormField name="confirmPassword" label="Confirm new password" required>
              <UInput
                v-model="newPasswordState.confirmPassword"
                name="confirmPassword"
                type="password"
                autocomplete="new-password"
                placeholder="Repeat your new password"
              />
            </UFormField>

            <UButton type="submit" block :disabled="pending">
              {{ pending ? 'Updating…' : 'Update password' }}
            </UButton>
          </UForm>
        </template>

        <template v-else>
          <UAlert
            color="success"
            variant="soft"
            title="Check your inbox"
            description="If an account exists for that email, we sent a password reset link."
          />
          <button
            type="button"
            class="block w-full text-center text-sm text-gray-500 underline-offset-4 hover:text-gray-900 hover:underline dark:text-gray-400 dark:hover:text-gray-100"
            @click="mode = 'request'"
          >
            Send another link
          </button>
          <NuxtLink
            to="/login"
            class="block text-center text-sm font-medium text-gray-900 underline underline-offset-4 dark:text-gray-100"
          >
            Back to login
          </NuxtLink>
        </template>
      </section>
    </div>
  </main>
</template>
