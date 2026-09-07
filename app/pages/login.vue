<script setup lang="ts">
import { LoginInputSchema, type LoginInput } from '~/types/auth'

useHead({ title: 'Log in — Voc' })

const route = useRoute()
const supabase = useSupabaseClient()

const state = reactive<LoginInput>({ email: '', password: '' })
const serverError = ref<string | null>(null)
const pending = ref(false)

// Set when arriving from reset-password after a successful password update.
const resetDone = computed(() => route.query.reset === '1')

async function onSubmit({ data }: { data: LoginInput }) {
  serverError.value = null
  pending.value = true
  try {
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    })
    if (error) {
      if (error.code === 'email_not_confirmed') {
        await navigateTo(`/verify-email?email=${encodeURIComponent(data.email)}`)
        return
      }
      serverError.value = error.message
      return
    }
    await navigateTo('/')
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
        <h2 class="text-center text-lg font-medium">Log in</h2>

        <UAlert
          v-if="resetDone"
          color="success"
          variant="soft"
          title="Password updated"
          description="Sign in with your new password."
        />
        <UAlert v-if="serverError" color="error" variant="soft" :title="serverError ?? undefined" />

        <UForm :schema="LoginInputSchema" :state="state" class="space-y-4" @submit="onSubmit">
          <UFormField name="email" label="Email" required>
            <UInput
              v-model="state.email"
              name="email"
              type="email"
              autocomplete="email"
              placeholder="you@example.com"
            />
          </UFormField>

          <UFormField name="password" label="Password" required>
            <UInput
              v-model="state.password"
              name="password"
              type="password"
              autocomplete="current-password"
              placeholder="Your password"
            />
          </UFormField>

          <div class="flex justify-end">
            <NuxtLink
              to="/reset-password"
              class="text-sm text-gray-500 underline-offset-4 hover:text-gray-900 hover:underline dark:text-gray-400 dark:hover:text-gray-100"
            >
              Forgot password?
            </NuxtLink>
          </div>

          <UButton type="submit" block :disabled="pending">
            {{ pending ? 'Logging in…' : 'Log in' }}
          </UButton>
        </UForm>

        <p class="text-center text-sm text-gray-500 dark:text-gray-400">
          No account yet?
          <NuxtLink
            to="/register"
            class="font-medium text-gray-900 underline underline-offset-4 dark:text-gray-100"
          >
            Create one
          </NuxtLink>
        </p>
      </section>
    </div>
  </main>
</template>
