// Device TTS pronunciation (development-plan §3.3, design in docs/3.3 §2):
// plays a record's content through the browser's built-in Web Speech API —
// no Nitro route and no third-party service. The voice pick is per-device by
// design (installed voices differ across platforms), so it persists in
// localStorage rather than Supabase, with a resolution chain saved voice ->
// first English voice -> en-US language hint.

import { getCurrentInstance, onMounted, onUnmounted, ref } from 'vue'

export interface SpeechVoiceOption {
  /** Stable per-device identifier (`voiceURI`). */
  uri: string
  name: string
  lang: string
}

const VOICE_PREF_KEY = 'voc:tts-voice'
const RATE_PREF_KEY = 'voc:tts-rate'

/** Bounds for the user-adjustable playback speed (1 = normal speech). */
export const SPEECH_RATE_MIN = 0.5
export const SPEECH_RATE_MAX = 2

function getSynth(): SpeechSynthesis | null {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
    ? window.speechSynthesis
    : null
}

function isEnglish(lang: string): boolean {
  return lang.toLowerCase().startsWith('en')
}

function readSavedVoice(): SpeechVoiceOption | null {
  if (typeof window === 'undefined' || !('localStorage' in window)) return null
  try {
    const raw = window.localStorage.getItem(VOICE_PREF_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<SpeechVoiceOption>
    if (typeof parsed.uri !== 'string' || typeof parsed.lang !== 'string') return null
    return {
      uri: parsed.uri,
      lang: parsed.lang,
      name: typeof parsed.name === 'string' ? parsed.name : parsed.uri,
    }
  } catch {
    return null
  }
}

function readSavedRate(): number {
  if (typeof window === 'undefined' || !('localStorage' in window)) return 1
  const saved = Number.parseFloat(window.localStorage.getItem(RATE_PREF_KEY) ?? '')
  if (!Number.isFinite(saved)) return 1
  return Math.min(SPEECH_RATE_MAX, Math.max(SPEECH_RATE_MIN, saved))
}

export function useSpeech() {
  const supported = ref(false)
  const englishVoices = ref<SpeechVoiceOption[]>([])
  const savedVoice = ref<SpeechVoiceOption | null>(null)
  // True while an utterance started by speak() is still playing — lets the
  // UI highlight the active 🔊 button. Reset on natural end, error, or stop.
  const speaking = ref(false)
  // User-adjustable playback speed (1 = normal), persisted per-device.
  const rate = ref(1)

  // The voiceschanged listener refreshes the reactive list when the engine
  // finishes loading voices (getVoices() returns [] on the first call in
  // Chrome until then).
  function refresh() {
    const synth = getSynth()
    if (!synth) return
    supported.value = true
    englishVoices.value = synth
      .getVoices()
      .filter(voice => isEnglish(voice.lang))
      .map(voice => ({ uri: voice.voiceURI, name: voice.name, lang: voice.lang }))
  }

  if (typeof window !== 'undefined' && getSynth()) {
    if (getCurrentInstance()) {
      // Defer to onMounted so client-only state lands after hydration —
      // SSR rendered the markup without the speak buttons.
      onMounted(() => {
        refresh()
        savedVoice.value = readSavedVoice()
        rate.value = readSavedRate()
        getSynth()?.addEventListener('voiceschanged', refresh)
      })
      onUnmounted(() => {
        const synth = getSynth()
        synth?.removeEventListener('voiceschanged', refresh)
        // No audio bleeding past the page (e.g. leaving a review session).
        synth?.cancel()
        speaking.value = false
      })
    } else {
      // Called outside a component instance (tests): refresh synchronously.
      refresh()
      savedVoice.value = readSavedVoice()
      rate.value = readSavedRate()
      getSynth()?.addEventListener('voiceschanged', refresh)
    }
  }

  function resolveVoice(): SpeechSynthesisVoice | null {
    const synth = getSynth()
    if (!synth) return null
    const all = synth.getVoices()
    const saved = readSavedVoice()
    if (saved) {
      const match = all.find(voice => voice.voiceURI === saved.uri)
      if (match) return match
    }
    return all.find(voice => isEnglish(voice.lang)) ?? null
  }

  function speak(text: string): void {
    const synth = getSynth()
    if (!synth || !text.trim()) return
    synth.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    const voice = resolveVoice()
    if (voice) {
      utterance.voice = voice
      utterance.lang = voice.lang
    } else {
      utterance.lang = 'en-US'
    }
    utterance.rate = readSavedRate()
    // cancel() does not reliably fire onend in every engine, so stop() and
    // unmount clear the flag explicitly; the events cover natural playback.
    utterance.onend = () => {
      speaking.value = false
    }
    utterance.onerror = () => {
      speaking.value = false
    }
    speaking.value = true
    synth.speak(utterance)
  }

  function stop(): void {
    getSynth()?.cancel()
    speaking.value = false
  }

  function selectVoice(option: SpeechVoiceOption | null): void {
    if (typeof window === 'undefined' || !('localStorage' in window)) return
    if (option) {
      window.localStorage.setItem(VOICE_PREF_KEY, JSON.stringify(option))
    } else {
      window.localStorage.removeItem(VOICE_PREF_KEY)
    }
    savedVoice.value = option
  }

  function setRate(value: number): void {
    if (typeof window === 'undefined' || !('localStorage' in window)) return
    const clamped = Math.min(SPEECH_RATE_MAX, Math.max(SPEECH_RATE_MIN, value))
    window.localStorage.setItem(RATE_PREF_KEY, String(clamped))
    rate.value = clamped
  }

  return {
    supported,
    speaking,
    englishVoices,
    savedVoice,
    rate,
    selectVoice,
    setRate,
    speak,
    stop,
  }
}
