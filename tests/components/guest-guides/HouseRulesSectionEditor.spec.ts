// House rules are a title with a description, as in Property > Guest Guides >
// House Rules. The editor must still open guides that stored one-line rules,
// and every edit must emit titled rules so the agreement PDF can print both.

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { normalizeHouseRules } from '~/components/guest-guides/data/house-rules'
import HouseRulesSectionEditor from '~/components/guest-guides/editor/sections/HouseRulesSectionEditor.vue'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Textarea } from '~/components/ui/textarea'

function mountEditor(rules: unknown[]) {
  return mount(HouseRulesSectionEditor, {
    props: { modelValue: { rules } },
    global: {
      components: { Button, Input, Textarea },
      stubs: { Icon: true },
      provide: { assignedListingIds: { value: [] } },
    },
  })
}

function lastRules(wrapper: ReturnType<typeof mountEditor>) {
  const events = wrapper.emitted('update:modelValue') ?? []
  return (events.at(-1)?.[0] as { rules: unknown[] }).rules
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
  it('shows a title and description field for every rule, including old one-line rules', () => {
    const wrapper = mountEditor(['No smoking', { title: 'Quiet Hours', description: 'From 22:00.' }])

    expect(wrapper.findAll('[data-testid="house-rule-row"]')).toHaveLength(2)
    const titles = wrapper.findAll('input').map(i => (i.element as HTMLInputElement).value)
    const descriptions = wrapper.findAll('textarea').map(t => (t.element as HTMLTextAreaElement).value)
    expect(titles).toEqual(['No smoking', 'Quiet Hours'])
    expect(descriptions).toEqual(['', 'From 22:00.'])
  })

  it('emits titled rules when a description is typed', async () => {
    const wrapper = mountEditor(['No smoking'])

    await wrapper.find('textarea').setValue('Not inside the villa.')

    expect(lastRules(wrapper)).toEqual([{ title: 'No smoking', description: 'Not inside the villa.' }])
  })

  it('adds an empty rule and removes one', async () => {
    const wrapper = mountEditor([{ title: 'A' }, { title: 'B' }])

    await wrapper.find('[aria-label="Remove rule"]').trigger('click')
    expect(lastRules(wrapper)).toEqual([{ title: 'B' }])

    const add = wrapper.findAll('button').find(b => b.text().includes('Add rule'))!
    await add.trigger('click')
    expect(lastRules(wrapper)).toEqual([{ title: 'A' }, { title: 'B' }, { title: '', description: '' }])
  })
})
