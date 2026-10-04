import type { Listing } from '~/components/listings/data/listings'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { toRaw } from 'vue'
import { draftFromBrief, findSopConversations, sopAiTopic } from '~/components/listings/data/listing-sop-ai'
import { listings } from '~/components/listings/data/listings'
import SopAiDialog from '~/components/listings/SopAiDialog.vue'

const lst1 = (): Listing => structuredClone(toRaw(listings.value[0]!))
const passthrough = { template: '<div><slot /></div>' }

function mountDialog(props: { fieldKey: string | null, title: string, currentText?: string }) {
  return mount(SopAiDialog, {
    props: { open: true, listing: lst1(), currentText: '', ...props },
    global: {
      stubs: {
        Icon: true,
        SharedAiIcon: true,
        Dialog: passthrough,
        DialogContent: passthrough,
        DialogHeader: passthrough,
        DialogTitle: passthrough,
        DialogDescription: passthrough,
        DialogFooter: passthrough,
        Label: { template: '<label><slot /></label>' },
        Shimmer: { template: '<p><slot /></p>' },
        Input: { props: ['modelValue'], emits: ['update:modelValue'], template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />' },
        Textarea: { props: ['modelValue'], emits: ['update:modelValue'], template: '<textarea :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />' },
        Button: { props: ['disabled'], template: '<button :disabled="disabled"><slot /></button>' },
      },
    },
  })
}

describe('sop AI drafting', () => {
  it('finds this listing\'s guest conversations about the topic, matching whole words', () => {
    const topic = sopAiTopic('sop:checkOutProcedure', 'What happens when a guest checks out?')
    const found = findSopConversations(lst1(), topic)
    expect(found.length).toBeGreaterThan(0)
    expect(found.every(m => /check-?out|leaving|depart|luggage/i.test(m.snippet))).toBe(true)
    // "cat" must not match "location".
    expect(findSopConversations(lst1(), sopAiTopic('sop:requestsApproval', 'x')).some(m => /location/i.test(m.snippet) && !/pet|dog|party|event|guest|visitor|friend|discount/i.test(m.snippet))).toBe(false)
  })

  it('a custom SOP gets general questions and searches by its title words', () => {
    const topic = sopAiTopic(null, 'Restaurant bookings')
    expect(topic.questions.map(q => q.id)).toEqual(['when', 'steps', 'who'])
    expect(topic.keywords).toEqual(['restaurant', 'bookings'])
  })

  it('strict: only the host\'s points as steps, with guest type and tone noted', () => {
    const topic = sopAiTopic('sop:checkInProcedure', 'Check-in')
    const text = draftFromBrief(topic, { guest: 'Families with kids', tone: 'Warm & empathetic', cover: 'Wayan meets guests. Show the pool', mode: 'strict' })
    expect(text).toBe('Check-in\nFor: Families with kids\nTone with guests: Warm & empathetic\n\n1. Wayan meets guests.\n2. Show the pool.')
  })

  it('creative: adds a guest-type step, a message in the tone, exceptions and a best practice', () => {
    const topic = sopAiTopic('sop:checkInProcedure', 'Check-in')
    const text = draftFromBrief(topic, { guest: 'Families with kids', tone: 'Luxury concierge', cover: 'Wayan meets guests', mode: 'creative' })
    expect(text).toContain('2. Point out child safety')
    expect(text).toContain('Example message to the guest:')
    expect(text).toContain('Dear {guest}')
    expect(text).toContain('Exceptions:')
    expect(text).toContain('Best practice:')
  })
})

describe('sopAiDialog', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  /** Runs the staged animation and the typing to the end. */
  async function runAnimation() {
    await vi.advanceTimersByTimeAsync(6000)
    await flushPromises()
  }
  const next = (w: ReturnType<typeof mountDialog>) => w.find('[data-testid="sop-ai-next"]').trigger('click')

  it('guided brief: typical guest and tone are optional, cover and AI mode are required, AI mode is last', async () => {
    const w = mountDialog({ fieldKey: 'sop:checkInProcedure', title: 'What happens when a guest checks in?' })
    await w.find('[data-testid="sop-ai-from-brief"]').trigger('click')
    // Step 1: typical guest, skippable
    expect(w.find('[data-testid="sop-ai-brief-1"]').text()).toContain('Typical guest')
    expect(w.find('[data-testid="sop-ai-next"]').text()).toContain('Skip')
    await w.findAll('[role="radio"]').find(r => r.text() === 'Families with kids')!.trigger('click')
    expect(w.find('[data-testid="sop-ai-next"]').text()).toContain('Next')
    await next(w)
    // Step 2: tone
    expect(w.find('[data-testid="sop-ai-brief-2"]').text()).toContain('Tone')
    expect(w.text()).toContain('Luxury concierge')
    await w.findAll('[role="radio"]').find(r => r.text() === 'Warm & empathetic')!.trigger('click')
    await next(w)
    // Step 3: what it should cover (required)
    expect(w.find('[data-testid="sop-ai-next"]').attributes('disabled')).toBeDefined()
    await w.find('#sop-ai-cover').setValue('Wayan meets guests at the gate')
    await next(w)
    // Step 4: AI mode (required), last
    expect(w.find('[data-testid="sop-ai-brief-4"]').text()).toContain('AI mode')
    expect(w.find('[data-testid="sop-ai-generate"]').attributes('disabled')).toBeDefined()
    await w.findAll('[role="radio"]').find(r => r.text().includes('Strict'))!.trigger('click')
    await w.find('[data-testid="sop-ai-generate"]').trigger('click')
    // Generating animation with the brief's stages
    expect(w.find('[data-testid="sop-ai-generating"]').text()).toContain('Thinking about families with kids')
    expect(w.text()).toContain('Matching a warm & empathetic tone')
    await runAnimation()
    const draft = w.find('#sop-ai-draft')
    expect((draft.element as HTMLTextAreaElement).value).toContain('Tone with guests: Warm & empathetic')
    await draft.setValue('Edited SOP')
    await w.find('[data-testid="sop-ai-apply"]').trigger('click')
    expect(w.emitted('apply')![0]).toEqual(['Edited SOP'])
  })

  it('other lets the host describe the guest in their own words', async () => {
    const w = mountDialog({ fieldKey: null, title: 'Pool rules' })
    await w.find('[data-testid="sop-ai-from-brief"]').trigger('click')
    await w.findAll('[role="radio"]').find(r => r.text() === 'Other')!.trigger('click')
    expect(w.find('[aria-label="Describe your typical guest"]').exists()).toBe(true)
  })

  it('past conversations: no picking, goes straight to generating and drafts from what guests asked', async () => {
    const w = mountDialog({ fieldKey: 'sop:checkOutProcedure', title: 'Check-out' })
    await w.find('[data-testid="sop-ai-from-conversations"]').trigger('click')
    expect(w.find('[data-testid="sop-ai-generating"]').text()).toContain('Searching this listing\'s conversations')
    expect(w.find('[role="checkbox"]').exists()).toBe(false)
    await runAnimation()
    expect((w.find('#sop-ai-draft').element as HTMLTextAreaElement).value).toMatch(/Based on \d+ past conversation/)
  })

  it('past conversations that find nothing stop on a message and offer the questions', async () => {
    const w = mountDialog({ fieldKey: 'sop:emergencyProcedure', title: 'Emergencies' })
    await w.find('[data-testid="sop-ai-from-conversations"]').trigger('click')
    await runAnimation()
    expect(w.find('[data-testid="sop-ai-none"]').text()).toContain('No past conversations found')
    expect(w.find('#sop-ai-draft').exists()).toBe(false)
    await w.find('[data-testid="sop-ai-none-brief"]').trigger('click')
    expect(w.find('[data-testid="sop-ai-brief-1"]').exists()).toBe(true)
  })

  it('warns that applying replaces existing text', async () => {
    const w = mountDialog({ fieldKey: 'sop:checkOutProcedure', title: 'Check-out', currentText: 'Old text' })
    await w.find('[data-testid="sop-ai-from-conversations"]').trigger('click')
    await runAnimation()
    expect(w.text()).toContain('Using it replaces the current text.')
  })
})
