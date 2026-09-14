// Flashcard component test (development-plan §4): flip state and grade
// emissions. UButton is stubbed as a native button (the bare-vitest
// environment has no Nuxt UI plugin); the flip is class-driven, so assertions
// check the `revealed` class on the flip container rather than computed
// styles, which happy-dom does not evaluate.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import Flashcard from '~/components/Flashcard.vue'
import type { ReviewSessionItem } from '~/composables/useReview'

const UButtonStub = {
  template:
    '<button :disabled="disabled || loading" :class="color" @click="$emit(\'click\')"><slot /></button>',
  props: ['disabled', 'loading', 'color'],
  // Declared so the parent's onClick is NOT inherited as a native listener
  // (attrs fallthrough) in addition to the $emit path — that would double-fire.
  emits: ['click'],
}

const NOW = '2026-01-01T00:00:00.000Z'

function makeItem(id: string): ReviewSessionItem {
  return {
    record: {
      id,
      user_id: 'user-1',
      type: 'phrase',
      content: "I'm all ears",
      meaning: '洗耳恭听',
      source: 'Podcast ep. 12',
      notes: 'Used when listening',
      created_at: NOW,
      updated_at: NOW,
      tags: [
        { id: 'tag-1', user_id: null, name: 'idiom', is_predefined: true, created_at: NOW },
        { id: 'tag-2', user_id: 'user-1', name: 'daily', is_predefined: false, created_at: NOW },
      ],
    },
    state: { status: 'learning', interval_days: 1, consecutive_pass: 1, next_review_at: NOW },
  }
}

function mountCard(item: ReviewSessionItem = makeItem('rec-1'), grading = false) {
  return mount(Flashcard, {
    props: { item, grading },
    global: { stubs: { UButton: UButtonStub } },
  })
}

// Installs a speechSynthesis stub on window (happy-dom has none natively) and
// an utterance record holder so pronunciation wiring can be asserted.
function stubSpeech() {
  const speak = vi.fn<(utterance: FakeUtterance) => void>()
  const cancel = vi.fn<() => void>()
  const synth = {
    getVoices: () => [],
    speak,
    cancel,
    addEventListener: vi.fn<(type: string, listener: () => void) => void>(),
    removeEventListener: vi.fn<(type: string, listener: () => void) => void>(),
  }
  class FakeUtterance {
    text: string
    lang = ''
    voice: unknown = null
    rate = 1
    constructor(text: string) {
      this.text = text
    }
  }
  Object.defineProperty(window, 'speechSynthesis', {
    value: synth,
    configurable: true,
    writable: true,
  })
  vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance)
  return { speak, cancel }
}

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).speechSynthesis
  vi.unstubAllGlobals()
})

describe('Flashcard', () => {
  it('starts face-down: front shows the meaning and type, not the expression', () => {
    const wrapper = mountCard()
    // `uppercase` is CSS-only, so the DOM keeps the raw lowercase type.
    expect(wrapper.text()).toContain('洗耳恭听')
    expect(wrapper.text()).toContain('phrase')
    expect(wrapper.text()).toContain('Show expression')
    expect(wrapper.find('.flip-card').classes()).not.toContain('revealed')
  })

  it('reveals the back with the recorded content and context on tap', async () => {
    const wrapper = mountCard()
    await wrapper.find('button').trigger('click')

    expect(wrapper.find('.flip-card').classes()).toContain('revealed')
    expect(wrapper.text()).toContain('"I\'m all ears"')
    expect(wrapper.text()).toContain('#idiom')
    expect(wrapper.text()).toContain('#daily')
    expect(wrapper.text()).toContain('Source: Podcast ep. 12')
    expect(wrapper.text()).toContain('Used when listening')
    expect(wrapper.text()).toContain('Could you express it?')
  })

  it('emits the tapped grade', async () => {
    const wrapper = mountCard()
    const buttons = wrapper.findAll('button')
    // Buttons: [Show expression, Forgot, Hazy, Know, Easy]
    expect(buttons).toHaveLength(5)

    await buttons[1]!.trigger('click')
    await buttons[4]!.trigger('click')

    expect(wrapper.emitted('grade')).toEqual([['forgot'], ['easy']])
  })

  it('labels the four grades in wireframe order', () => {
    const wrapper = mountCard()
    const labels = wrapper.findAll('button').map(button => button.text())
    expect(labels).toEqual(['Show expression', 'Forgot', 'Hazy', 'Know', 'Easy'])
  })

  it('disables every button while a grade POST is in flight', () => {
    const wrapper = mountCard(makeItem('rec-1'), true)
    const disabled = wrapper
      .findAll('button')
      .filter(button => button.attributes('disabled') !== undefined)
    expect(disabled).toHaveLength(5)
  })

  it('resets to face-down when the next card arrives', async () => {
    const wrapper = mountCard()
    await wrapper.find('button').trigger('click')
    expect(wrapper.find('.flip-card').classes()).toContain('revealed')

    const next = makeItem('rec-2')
    next.record.content = 'Break a leg'
    await wrapper.setProps({ item: next })
    expect(wrapper.find('.flip-card').classes()).not.toContain('revealed')
    expect(wrapper.text()).not.toContain('"I\'m all ears"')
  })

  it('keeps the card revealed when a grade fails and the same item stays', async () => {
    const wrapper = mountCard()
    await wrapper.find('button').trigger('click')
    // Parent keeps the same record on failure (retry path).
    await wrapper.setProps({ item: makeItem('rec-1') })
    expect(wrapper.find('.flip-card').classes()).toContain('revealed')
  })

  it('omits optional context rows the record does not have', () => {
    const item = makeItem('rec-1')
    item.record.source = null
    item.record.notes = null
    item.record.tags = []
    const wrapper = mountCard(item)

    expect(wrapper.text()).not.toContain('Source:')
    expect(wrapper.text()).not.toContain('#idiom')
  })

  it('hides the pronunciation button when the device has no speech support', () => {
    // happy-dom exposes no speechSynthesis, so `supported` stays false.
    const wrapper = mountCard()

    expect(wrapper.find('[aria-label="Play pronunciation"]').exists()).toBe(false)
  })

  it('speaks the record content from a button on the revealed back', async () => {
    const { speak } = stubSpeech()
    const wrapper = mountCard()
    expect(speak).not.toHaveBeenCalled()

    // Front stays silent — hearing audio there would leak a recall hint.
    expect(wrapper.find('[aria-label="Play pronunciation"]').exists()).toBe(false)

    await wrapper.find('button').trigger('click')
    const playButton = wrapper.find('[aria-label="Play pronunciation"]')
    expect(playButton.exists()).toBe(true)
    await playButton.trigger('click')

    expect(speak).toHaveBeenCalledTimes(1)
    expect(speak.mock.calls[0]![0].text).toBe("I'm all ears")
  })

  it('cancels playback when the next card arrives', async () => {
    const { cancel } = stubSpeech()
    const wrapper = mountCard()
    await wrapper.find('button').trigger('click')

    await wrapper.setProps({ item: makeItem('rec-2') })

    expect(cancel).toHaveBeenCalled()
  })

  it('highlights the pronunciation button while speech plays', async () => {
    const { speak } = stubSpeech()
    const wrapper = mountCard()
    await wrapper.find('button').trigger('click')

    const playButton = wrapper.find('[aria-label="Play pronunciation"]')
    expect(playButton.classes()).toContain('neutral')

    await playButton.trigger('click')
    expect(speak).toHaveBeenCalledTimes(1)
    expect(wrapper.find('[aria-label="Play pronunciation"]').classes()).toContain('primary')
  })
})
