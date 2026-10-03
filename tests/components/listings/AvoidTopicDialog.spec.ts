import type { AvoidTopic } from '~/components/listings/data/listing-avoid-topics'
import type { Listing } from '~/components/listings/data/listings'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { nextTick, toRaw } from 'vue'
import AvoidTopicDialog from '~/components/listings/AvoidTopicDialog.vue'
import { avoidTopicActionLabel, avoidTopicActionReady, avoidTopicStagesLabel, listingAvoidTopics, removeAvoidTopic, saveAvoidTopic } from '~/components/listings/data/listing-avoid-topics'
import { listings } from '~/components/listings/data/listings'

const passthrough = { template: '<div><slot /></div>' }
// Select stand-in: a native select, so a test can pick a template.
const SelectStub = {
  props: ['modelValue'],
  emits: ['update:modelValue'],
  template: '<select data-testid="template" @change="$emit(\'update:modelValue\', $event.target.value)"><option value="" /><slot /></select>',
}
const SelectItemStub = { props: ['value'], template: '<option :value="value"><slot /></option>' }

function mountDialog(topic: AvoidTopic | null = null) {
  return mount(AvoidTopicDialog, {
    props: { open: true, topic },
    global: {
      stubs: {
        Icon: true,
        Dialog: passthrough,
        DialogContent: passthrough,
        DialogHeader: passthrough,
        DialogTitle: passthrough,
        DialogDescription: passthrough,
        DialogFooter: passthrough,
        Label: { template: '<label><slot /></label>' },
        Input: { props: ['modelValue'], emits: ['update:modelValue'], template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />' },
        Textarea: { props: ['modelValue'], emits: ['update:modelValue'], template: '<textarea :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />' },
        Select: SelectStub,
        SelectTrigger: passthrough,
        SelectValue: true,
        SelectContent: { template: '<slot />' },
        SelectItem: SelectItemStub,
        SelectSeparator: true,
        Badge: { template: '<span><slot /></span>' },
        Button: { props: ['disabled'], template: '<button :disabled="disabled"><slot /></button>' },
      },
    },
  })
}

const button = (w: ReturnType<typeof mountDialog>, text: string) => w.findAll('button').find(b => b.text().includes(text))!

describe('avoidTopicDialog', () => {
  it('a template fills in the topic and description', async () => {
    const w = mountDialog()
    await w.find('[data-testid="template"]').setValue('Refund requests')
    expect((w.find('#avoid-topic-name').element as HTMLInputElement).value).toBe('Refund requests')
    expect((w.find('#avoid-topic-description').element as HTMLTextAreaElement).value).toContain('money back')
  })

  it('custom topic clears a template\'s text so the host writes their own', async () => {
    const w = mountDialog()
    await w.find('[data-testid="template"]').setValue('Refund requests')
    await w.find('[data-testid="template"]').setValue('__custom__')
    expect((w.find('#avoid-topic-name').element as HTMLInputElement).value).toBe('')
    expect((w.find('#avoid-topic-description').element as HTMLTextAreaElement).value).toBe('')
    await w.find('#avoid-topic-name').setValue('Parties and events')
    await w.find('#avoid-topic-description').setValue('The guest wants to host a party.')
    await button(w, 'Next').trigger('click')
    await w.findAll('[role="radio"]').find(r => r.text().includes('Do not respond'))!.trigger('click')
    await button(w, 'Save topic').trigger('click')
    expect(w.emitted('save')![0]![0]).toMatchObject({ topic: 'Parties and events', description: 'The guest wants to host a party.', action: 'no_response' })
  })

  it('needs a topic before step 2 and an action before saving', async () => {
    const w = mountDialog()
    expect(button(w, 'Next').attributes('disabled')).toBeDefined()
    await w.find('[data-testid="template"]').setValue('Discount requests')
    await button(w, 'Next').trigger('click')
    expect(w.find('[data-testid="avoid-topic-step-2"]').exists()).toBe(true)
    expect(w.text()).toContain('ElevAI answers as the host')
    expect(w.text()).not.toContain('HostBuddy')
    expect(button(w, 'Save topic').attributes('disabled')).toBeDefined()
    await w.findAll('[role="radio"]').find(r => r.text().includes('Embody host'))!.trigger('click')
    await button(w, 'Save topic').trigger('click')
    const saved = w.emitted('save')![0]![0] as AvoidTopic
    expect(saved).toMatchObject({ topic: 'Discount requests', action: 'embody_host' })
    expect(w.emitted('update:open')!.at(-1)).toEqual([false])
  })

  it('defer to... asks for a name before it can save', async () => {
    const w = mountDialog()
    await w.find('#avoid-topic-name').setValue('Pool heating')
    await button(w, 'Next').trigger('click')
    await w.findAll('[role="radio"]').find(r => r.text().includes('Defer to...'))!.trigger('click')
    expect(button(w, 'Save topic').attributes('disabled')).toBeDefined()
    await w.find('[aria-label="Who ElevAI checks with"]').setValue('Wayan')
    await nextTick()
    await button(w, 'Save topic').trigger('click')
    expect(w.emitted('save')![0]![0]).toMatchObject({ topic: 'Pool heating', action: 'defer_to', deferTo: 'Wayan' })
  })

  it('applies to every stage by default and saves only the stages left ticked', async () => {
    const w = mountDialog()
    await w.find('[data-testid="template"]').setValue('Refund requests')
    await button(w, 'Next').trigger('click')
    await w.findAll('[role="radio"]').find(r => r.text().includes('Defer to host'))!.trigger('click')
    const stage = (label: string) => w.findAll('[data-testid="avoid-topic-stages"] [role="checkbox"]').find(c => c.text() === label)!
    expect(['Future', 'Inquiry / Past', 'Current'].every(l => stage(l).attributes('aria-checked') === 'true')).toBe(true)
    await stage('Inquiry / Past').trigger('click')
    await button(w, 'Save topic').trigger('click')
    expect(w.emitted('save')![0]![0]).toMatchObject({ stages: ['future', 'current'] })
  })

  it('cannot save with no stage ticked', async () => {
    const w = mountDialog()
    await w.find('#avoid-topic-name').setValue('Parties')
    await button(w, 'Next').trigger('click')
    await w.findAll('[role="radio"]')[0]!.trigger('click')
    for (const c of w.findAll('[data-testid="avoid-topic-stages"] [role="checkbox"]'))
      await c.trigger('click')
    expect(button(w, 'Save topic').attributes('disabled')).toBeDefined()
    expect(w.text()).toContain('Pick at least one stage.')
  })

  it('editing keeps the topic id and starts from its values', async () => {
    const w = mountDialog({ id: 'topic-9', topic: 'Late check-out requests', description: 'x', action: 'defer_team' })
    expect((w.find('#avoid-topic-name').element as HTMLInputElement).value).toBe('Late check-out requests')
    await button(w, 'Next').trigger('click')
    await button(w, 'Save topic').trigger('click')
    expect(w.emitted('save')![0]![0]).toMatchObject({ id: 'topic-9', action: 'defer_team' })
  })
})

describe('listing avoid topics', () => {
  const base = (): Listing => structuredClone(toRaw(listings.value[0]!))

  it('reads old plain topic names as topics deferred to the team', () => {
    const l = base()
    l.resources = { ...l.resources, avoidTopics: undefined, topicsToAvoid: ['competitor pricing'] }
    expect(listingAvoidTopics(l)).toEqual([{ id: 'legacy-0', topic: 'competitor pricing', description: '', action: 'defer_team' }])
  })

  it('saves new topics, replaces edited ones and removes them', () => {
    let l = base()
    const before = listingAvoidTopics(l).length
    l = saveAvoidTopic(l, { id: 'new', topic: 'Parties', description: '', action: 'no_response' })
    expect(listingAvoidTopics(l)).toHaveLength(before + 1)
    l = saveAvoidTopic(l, { id: 'new', topic: 'Parties', description: '', action: 'defer_host' })
    expect(listingAvoidTopics(l).find(t => t.id === 'new')!.action).toBe('defer_host')
    expect(listingAvoidTopics(removeAvoidTopic(l, 'new'))).toHaveLength(before)
  })

  it('labels the action and checks its extra detail', () => {
    expect(avoidTopicActionLabel({ id: 'a', topic: 't', description: '', action: 'defer_to', deferTo: 'Wayan' })).toBe('Defer to Wayan')
    expect(avoidTopicActionReady('share_contact', '', '')).toBe(false)
    expect(avoidTopicActionReady('share_contact', '', '+62 812')).toBe(true)
    expect(avoidTopicActionReady(undefined)).toBe(false)
  })

  it('treats a topic without stages as all stages', () => {
    const t = { id: 'a', topic: 't', description: '', action: 'defer_team' as const }
    expect(avoidTopicStagesLabel(t)).toBe('All stages')
    expect(avoidTopicStagesLabel({ ...t, stages: ['current', 'future'] })).toBe('Future, Current')
  })
})
