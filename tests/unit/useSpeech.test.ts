// useSpeech composable tests (development-plan §3.3). The composable reads
// window.speechSynthesis directly, so a full stub (getVoices/speak/cancel +
// voiceschanged listener registry) is installed on window before each test;
// SpeechSynthesisUtterance is stubbed as a plain record holder. Bare-vitest
// runs these outside a component instance, which exercises the synchronous
// refresh path of the composable.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSpeech } from '~/composables/useSpeech'

const VOICE_PREF_KEY = 'voc:tts-voice'

function makeVoice(uri: string, name: string, lang: string): SpeechSynthesisVoice {
  return { voiceURI: uri, name, lang, default: false, localService: true } as SpeechSynthesisVoice
}

class FakeUtterance {
  text: string
  lang = ''
  voice: SpeechSynthesisVoice | null = null
  rate = 1
  onend: (() => void) | null = null
  onerror: (() => void) | null = null
  constructor(text: string) {
    this.text = text
  }
}

const speakMock = vi.fn<(utterance: FakeUtterance) => void>()
const cancelMock = vi.fn<() => void>()
const addListenerMock = vi.fn<(type: string, listener: () => void) => void>()
const removeListenerMock = vi.fn<(type: string, listener: () => void) => void>()

let deviceVoices: SpeechSynthesisVoice[] = []

const synthStub = {
  getVoices: () => deviceVoices,
  speak: speakMock,
  cancel: cancelMock,
  addEventListener: addListenerMock,
  removeEventListener: removeListenerMock,
}

beforeEach(() => {
  deviceVoices = [
    makeVoice('v-en-us', 'Samantha', 'en-US'),
    makeVoice('v-en-gb', 'Daniel', 'en-GB'),
    makeVoice('v-zh', 'Ting-Ting', 'zh-CN'),
  ]
  speakMock.mockClear()
  cancelMock.mockClear()
  addListenerMock.mockClear()
  removeListenerMock.mockClear()
  window.localStorage.clear()
  Object.defineProperty(window, 'speechSynthesis', {
    value: synthStub,
    configurable: true,
    writable: true,
  })
  vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance)
})

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).speechSynthesis
  vi.unstubAllGlobals()
})

function dispatchVoicesChanged() {
  const listener = addListenerMock.mock.calls.find(call => call[0] === 'voiceschanged')?.[1] as
    (() => void) | undefined
  listener?.()
}

describe('useSpeech', () => {
  it('reports support and exposes the device voices filtered to English', () => {
    const { supported, englishVoices } = useSpeech()

    expect(supported.value).toBe(true)
    expect(englishVoices.value.map(v => v.uri)).toEqual(['v-en-us', 'v-en-gb'])
  })

  it('refreshes the English voice list when the engine emits voiceschanged', () => {
    const { englishVoices } = useSpeech()
    expect(englishVoices.value).toHaveLength(2)

    deviceVoices = [...deviceVoices, makeVoice('v-en-au', 'Karen', 'en-AU')]
    dispatchVoicesChanged()

    expect(englishVoices.value.map(v => v.uri)).toEqual(['v-en-us', 'v-en-gb', 'v-en-au'])
  })

  it('speak uses the saved voice when it is still installed', () => {
    window.localStorage.setItem(
      VOICE_PREF_KEY,
      JSON.stringify({ uri: 'v-en-gb', lang: 'en-GB', name: 'Daniel' }),
    )
    const { speak, savedVoice } = useSpeech()

    speak('Break a leg')

    expect(savedVoice.value?.uri).toBe('v-en-gb')
    expect(cancelMock).toHaveBeenCalledTimes(1)
    const utterance = speakMock.mock.calls[0]![0] as FakeUtterance
    expect(utterance.text).toBe('Break a leg')
    expect(utterance.voice?.voiceURI).toBe('v-en-gb')
    expect(utterance.lang).toBe('en-GB')
    expect(utterance.rate).toBe(1)
  })

  it('speak falls back to the first English voice when the saved one is missing', () => {
    window.localStorage.setItem(
      VOICE_PREF_KEY,
      JSON.stringify({ uri: 'ghost-voice', lang: 'en-GB', name: 'Ghost' }),
    )
    const { speak } = useSpeech()

    speak('hello')

    const utterance = speakMock.mock.calls[0]![0] as FakeUtterance
    expect(utterance.voice?.voiceURI).toBe('v-en-us')
    expect(utterance.lang).toBe('en-US')
  })

  it('speak falls back to the en-US language hint when no English voice exists', () => {
    deviceVoices = [makeVoice('v-zh', 'Ting-Ting', 'zh-CN')]
    const { speak } = useSpeech()

    speak('hello')

    const utterance = speakMock.mock.calls[0]![0] as FakeUtterance
    expect(utterance.voice).toBeNull()
    expect(utterance.lang).toBe('en-US')
  })

  it('speak ignores empty or whitespace-only text', () => {
    const { speak } = useSpeech()

    speak('   ')

    expect(speakMock).not.toHaveBeenCalled()
  })

  it('speak cancels the previous utterance before starting a new one', () => {
    const { speak } = useSpeech()

    speak('first')
    speak('second')

    expect(cancelMock).toHaveBeenCalledTimes(2)
    expect(speakMock).toHaveBeenCalledTimes(2)
  })

  it('selectVoice persists the pick and updates the reactive saved voice', () => {
    const { selectVoice, savedVoice, englishVoices } = useSpeech()

    selectVoice(englishVoices.value[1]!)

    expect(savedVoice.value?.uri).toBe('v-en-gb')
    expect(JSON.parse(window.localStorage.getItem(VOICE_PREF_KEY)!)).toMatchObject({
      uri: 'v-en-gb',
      lang: 'en-GB',
    })
  })

  it('selectVoice(null) clears the pick from storage', () => {
    const { selectVoice, savedVoice, englishVoices } = useSpeech()
    selectVoice(englishVoices.value[0]!)

    selectVoice(null)

    expect(savedVoice.value).toBeNull()
    expect(window.localStorage.getItem(VOICE_PREF_KEY)).toBeNull()
  })

  it('stops playback by cancelling the synth', () => {
    const { stop } = useSpeech()

    stop()

    expect(cancelMock).toHaveBeenCalledTimes(1)
  })

  it('flags speaking during playback and clears it on stop', () => {
    const { speak, stop, speaking } = useSpeech()

    speak('hello')
    expect(speaking.value).toBe(true)

    stop()
    expect(speaking.value).toBe(false)
  })

  it('clears the speaking flag when playback ends naturally', () => {
    const { speak, speaking } = useSpeech()

    speak('hello')
    expect(speaking.value).toBe(true)

    const utterance = speakMock.mock.calls[0]![0] as FakeUtterance
    utterance.onend?.()

    expect(speaking.value).toBe(false)
  })

  it('does not flag speaking for empty text', () => {
    const { speak, speaking } = useSpeech()

    speak('  ')

    expect(speaking.value).toBe(false)
  })

  it('setRate clamps to the supported bounds and persists', () => {
    const { setRate, rate } = useSpeech()

    setRate(3)
    expect(rate.value).toBe(2)
    expect(window.localStorage.getItem('voc:tts-rate')).toBe('2')

    setRate(0.1)
    expect(rate.value).toBe(0.5)
  })

  it('speak applies the saved rate, defaulting to 1x', () => {
    const { speak } = useSpeech()

    speak('hello')
    expect((speakMock.mock.calls[0]![0] as FakeUtterance).rate).toBe(1)

    // setRate persists immediately; the next speak() reads fresh state.
    window.localStorage.setItem('voc:tts-rate', '0.75')
    speak('again')
    expect((speakMock.mock.calls[1]![0] as FakeUtterance).rate).toBe(0.75)
  })
})
