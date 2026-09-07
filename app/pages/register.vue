<script setup lang="ts">
import { RegisterInputSchema, type RegisterInput } from '~/types/auth'

useHead({ title: 'Create account — Voc' })

const supabase = useSupabaseClient()

const state = reactive<RegisterInput>({ email: '', password: '', confirmPassword: '' })
const serverError = ref<string | null>(null)
const pending = ref(false)

async function onSubmit({ data }: { data: RegisterInput }) {
  serverError.value = null
  pending.value = true
  try {
    const { data: result, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        // Point the confirmation email back at our verify page so the
        // callback (token_hash / access_token) lands where we handle it.
        emailRedirectTo: `${window.location.origin}/verify-email`,
      },
    })
    if (error) {
      serverError.value = error.message
      return
    }
    if (result.session) {
      // Email confirmation is disabled on the project (or auto-confirmed):
      // the user is already signed in.
      await navigateTo('/')
      return
    }
    // Confirmation required — show the "check your inbox" notice.
    await navigateTo(`/verify-email?email=${encodeURIComponent(data.email)}`)
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
        <h2 class="text-center text-lg font-medium">Create account</h2>

        <UAlert v-if="serverError" color="error" variant="soft" :title="serverError ?? undefined" />

        <UForm :schema="RegisterInputSchema" :state="state" class="space-y-4" @submit="onSubmit">
          <UFormField name="email" label="Email" required>
            <UInput
              v-model="state.email"
              name="email"
              type="email"
              autocomplete="email"
              placeholder="you@example.com"
            />
          </UFormField>

          <UFormField
            name="password"
            label="Password"
            description="At least 8 characters and one number."
            required
          >
            <UInput
              v-model="state.password"
              name="password"
              type="password"
              autocomplete="new-password"
              placeholder="Your password"
            />
          </UFormField>

          <UFormField name="confirmPassword" label="Confirm password" required>
            <UInput
              v-model="state.confirmPassword"
              name="confirmPassword"
              type="password"
              autocomplete="new-password"
              placeholder="Repeat your password"
            />
          </UFormField>

          <UButton type="submit" block :disabled="pending">
            {{ pending ? 'Creating account…' : 'Sign up' }}
          </UButton>
        </UForm>

        <p class="text-center text-sm text-gray-500 dark:text-gray-400">
          Already have an account?
          <NuxtLink
            to="/login"
            class="font-medium text-gray-900 underline underline-offset-4 dark:text-gray-100"
          >
            Log in
          </NuxtLink>
        </p>
      </section>
    </div>
  </main>
</template>
