// House rules belong to each listing (its Guest Guide tab); the guide's
// section only shows or hides them. `normalizeHouseRules` still reads rules
// that older guides stored on the section, for the agreement PDF fallback.

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { normalizeHouseRules } from '~/components/guest-guides/data/house-rules'
import HouseRulesSectionEditor from '~/components/guest-guides/editor/sections/HouseRulesSectionEditor.vue'

function mountEditor(rules: unknown[]) {
  return mount(HouseRulesSectionEditor, {
    props: { modelValue: { rules } },
    global: {
      stubs: { Icon: true, NuxtLink: { template: '<a><slot /></a>' } },
      provide: { assignedListingIds: { value: [] } },
    },
  })
}

describe('normalizeHouseRules', () => {
  it('reads strings as titles and keeps descriptions', () => {
    expect(normalizeHouseRules([
      'No smoking',
      { title: 'Quiet Hours', description: 'From 22:00 to 08:00.' },
      { title: 'Pool', description: '  ' },
      { title: '', description: 'No title' },
      '  ',
    ])).toEqual([
      { title: 'No smoking' },
      { title: 'Quiet Hours', description: 'From 22:00 to 08:00.' },
      { title: 'Pool' },
    ])
  })

  it('returns nothing for a missing list', () => {
    expect(normalizeHouseRules(undefined)).toEqual([])
  })
})

describe('house rules section editor', () => {
  it('does not edit rules: it says the listing owns them and links each listing', () => {
    const wrapper = mountEditor([])
    expect(wrapper.find('textarea').exists()).toBe(false)
    expect(wrapper.get('[data-testid="listing-owned-content"]').text()).toContain('come from each listing')
  })

  it('lists the guide\'s listings with how many rules each has', () => {
    const wrapper = mount(HouseRulesSectionEditor, {
      props: { modelValue: { rules: [] } },
      global: {
        stubs: { Icon: true, NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } },
        provide: { assignedListingIds: { value: ['lst-1'] } },
      },
    })
    const row = wrapper.get('[data-testid="listing-owned-row"]')
    expect(row.attributes('href')).toBe('/listings/lst-1?tab=guest-guide')
    expect(row.text()).toMatch(/\d+ rules?/)
  })
})
