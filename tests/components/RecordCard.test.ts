// RecordCard component test (development-plan §4): badge rendering and data
// binding. NuxtLink is stubbed to an anchor so the bare-vitest environment
// (no Nuxt runtime) can mount the SFC; assertions follow the mock layout in
// product-design §6.2.

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import RecordCard from '~/components/RecordCard.vue'
import type { RecordWithTags } from '~/composables/useRecords'

const NuxtLinkStub = {
  template: '<a :href="to"><slot /></a>',
  props: ['to'],
}

const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000 - 60_000).toISOString()

const record: RecordWithTags = {
  id: 'rec-1',
  user_id: 'user-1',
  type: 'phrase',
  content: "I'm all ears",
  meaning: '洗耳恭听',
  source: null,
  notes: null,
  created_at: twoDaysAgo,
  updated_at: twoDaysAgo,
  tags: [
    { id: 'tag-1', user_id: null, name: 'idiom', is_predefined: true, created_at: twoDaysAgo },
    { id: 'tag-2', user_id: 'user-1', name: 'daily', is_predefined: false, created_at: twoDaysAgo },
  ],
}

function mountCard(overrides: Partial<RecordWithTags> = {}) {
  return mount(RecordCard, {
    props: { record: { ...record, ...overrides } },
    global: { stubs: { NuxtLink: NuxtLinkStub } },
  })
}

describe('RecordCard', () => {
  it('renders quoted content and the type · meaning line', () => {
    const wrapper = mountCard()
    // `capitalize` is CSS-only, so the DOM keeps the raw lowercase type.
    expect(wrapper.text()).toContain('"I\'m all ears"')
    expect(wrapper.text()).toContain('phrase · 洗耳恭听')
  })

  it('links the whole card to the record detail page', () => {
    const wrapper = mountCard()
    expect(wrapper.find('a').attributes('href')).toBe('/records/rec-1')
  })

  it('shows tag chips and relative time', () => {
    const wrapper = mountCard()
    expect(wrapper.text()).toContain('#idiom')
    expect(wrapper.text()).toContain('#daily')
    expect(wrapper.find('time').text()).toBe('2d ago')
  })

  it('keeps the time row when the record has no tags', () => {
    const wrapper = mountCard({ tags: [] })
    expect(wrapper.text()).not.toContain('#idiom')
    expect(wrapper.find('time').text()).toBe('2d ago')
  })
})
