<script setup lang="ts">
import { useOAuthConsent } from '~/composables/useOAuthConsent'

useHead({ title: 'Authorize application — Voc' })

const { status, errorMessage, details, scopes, pendingDecision, init, decide } = useOAuthConsent()

onMounted(init)
</script>

<template>
  <main class="flex min-h-dvh items-center justify-center px-4 py-10">
    <div class="w-full max-w-sm space-y-6">
      <header class="space-y-1 text-center">
        <h1 class="text-2xl font-semibold tracking-tight">Voc</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400">Authorize application</p>
      </header>

      <section class="space-y-4">
        <p
          v-if="status === 'loading'"
          class="flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400"
        >
          <UIcon name="i-lucide-loader-circle" class="size-4 animate-spin" />
          Checking the authorization request…
        </p>

        <UAlert
          v-else-if="status === 'error'"
          color="error"
          variant="soft"
          title="Authorization error"
          :description="errorMessage ?? undefined"
        />

        <template v-else-if="status === 'consent' && details">
          <p class="text-center text-sm text-gray-500 dark:text-gray-400">
            <span class="font-medium text-gray-900 dark:text-gray-100">{{
              details.client.name
            }}</span>
            wants to access the Voc data of
            <span class="font-medium text-gray-900 dark:text-gray-100">{{
              details.user.email
            }}</span
            >.
          </p>

          <ul class="space-y-2 rounded-lg bg-gray-50 p-4 text-sm dark:bg-gray-800/50">
            <li v-for="scope in scopes" :key="scope" class="flex items-center gap-2">
              <UIcon
                name="i-lucide-check"
                class="size-4 shrink-0 text-gray-500 dark:text-gray-400"
              />
              <span>{{ scope }}</span>
            </li>
          </ul>

          <p class="text-center text-xs text-gray-400 dark:text-gray-500">
            After your decision you will be returned to {{ details.redirect_uri }}
          </p>

          <div class="flex gap-3">
            <UButton
              color="neutral"
              variant="outline"
              block
              :disabled="pendingDecision !== null"
              @click="decide('deny')"
            >
              Deny
            </UButton>
            <UButton
              block
              :loading="pendingDecision === 'approve'"
              :disabled="pendingDecision !== null"
              @click="decide('approve')"
            >
              Approve
            </UButton>
          </div>
        </template>
      </section>
    </div>
  </main>
</template>
