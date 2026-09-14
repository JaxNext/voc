<script setup lang="ts">
// "Me" page per product-design §6.8: profile card (email + member since),
// Tags management link, the pronunciation voice picker (§3.3 — device TTS
// voices, choice persisted per-device in localStorage via useSpeech), and
// Log out. Export/Change password rows render as disabled placeholders —
// export lands in 3.1, in-app password change is not in the plan (the
// reset-password flow covers recovery). signOut() on the @supabase/ssr-backed
// client clears the HttpOnly cookie session; the global guard would catch the
// next navigation anyway, but we route to /login explicitly per the plan.

useHead({ title: 'Me — Voc' })

const user = useSupabaseUser()
const supabase = useSupabaseClient()
const toast = useToast()
const { supported, englishVoices, savedVoice, selectVoice, rate, setRate, speak } = useSpeech()

const signingOut = ref(false)
const voiceOpen = ref(false)

// created_at only exists on the full User object; useSupabaseUser() holds JWT
// claims since @nuxtjs/supabase v2, so read it from the session's user.
const createdAt = ref('')
onMounted(async () => {
  const { data } = await supabase.auth.getSession()
  createdAt.value = data.session?.user?.created_at ?? ''
})

const memberSince = computed(() =>
  createdAt.value
    ? new Date(createdAt.value).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
      })
    : '',
)

// Reka UI's Select forbids empty-string item values ("" means "clear to the
// placeholder"), so Automatic uses a sentinel URI no real voice will carry.
const AUTOMATIC = '__automatic__'

// The select binds to the persisted choice: the sentinel means Automatic
// (first English voice on the device), anything else resolves to the saved voice.
const selectedUri = computed({
  get: () => savedVoice.value?.uri ?? AUTOMATIC,
  set: uri =>
    selectVoice(
      uri === AUTOMATIC ? null : (englishVoices.value.find(voice => voice.uri === uri) ?? null),
    ),
})

const voiceItems = computed(() => [
  { label: 'Automatic', value: AUTOMATIC },
  ...englishVoices.value.map(voice => ({
    label: `${voice.name} (${voice.lang})`,
    value: voice.uri,
  })),
])

const previewSentence = 'Hello! This is how Voc will pronounce your records.'

// Slider binding for the playback speed (persists immediately via setRate).
const rateValue = computed({
  get: () => rate.value,
  set: value => setRate(Number(value)),
})

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
      <div v-if="supported" class="flex flex-col">
        <button
          type="button"
          class="flex w-full items-center justify-between px-4 py-3 text-sm transition-colors hover:bg-accented/50"
          :aria-expanded="voiceOpen"
          @click="voiceOpen = !voiceOpen"
        >
          Pronunciation voice
          <UIcon
            name="i-lucide-chevron-right"
            class="size-4 text-dimmed transition-transform"
            :class="{ 'rotate-90': voiceOpen }"
          />
        </button>
        <div v-if="voiceOpen" class="flex flex-col gap-3 px-4 pb-4">
          <USelect v-model="selectedUri" :items="voiceItems" size="sm" />
          <div class="flex flex-col gap-1">
            <div class="flex items-center justify-between text-xs text-muted">
              <span>Speed</span>
              <span class="tabular-nums">{{ rate.toFixed(1) }}×</span>
            </div>
            <USlider
              v-model="rateValue"
              :min="SPEECH_RATE_MIN"
              :max="SPEECH_RATE_MAX"
              :step="0.1"
              aria-label="Playback speed"
            />
          </div>
          <UButton
            label="Test"
            icon="i-lucide-volume-2"
            size="xs"
            variant="soft"
            block
            @click="speak(previewSentence)"
          />
        </div>
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
