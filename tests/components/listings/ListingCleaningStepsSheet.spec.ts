import type { CleaningStepSection } from '~/components/cleaning/data/cleaning-steps'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { hasCleaningSteps } from '~/components/cleaning/data/cleaning-steps'
import { listings } from '~/components/listings/data/listings'
import ListingCleaningStepsSheet from '~/components/listings/ListingCleaningStepsSheet.vue'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'

const passthrough = { template: '<div><slot /></div>' }
const STUBS = {
  Icon: true,
  Sheet: { props: ['open'], template: '<div v-if="open"><slot /></div>' },
  SheetContent: passthrough,
  SheetHeader: passthrough,
  SheetTitle: passthrough,
  SheetDescription: passthrough,
  SheetFooter: passthrough,
  Dialog: { props: ['open'], template: '<div v-if="open"><slot /></div>' },
  DialogContent: passthrough,
  DialogHeader: passthrough,
  DialogTitle: passthrough,
  DialogDescription: passthrough,
  DialogFooter: passthrough,
  Label: passthrough,
  // A native select so the test can pick a listing.
  Select: { props: ['modelValue'], emits: ['update:modelValue'], template: '<select data-testid="import-listing-select" :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value)"><slot /></select>' },
  SelectTrigger: { template: '<slot />' },
  SelectValue: true,
  SelectContent: { template: '<slot />' },
  SelectItem: { props: ['value'], template: '<option :value="value"><slot /></option>' },
  NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
  PropertyPicker: { props: ['modelValue', 'options'], emits: ['update:modelValue'], template: '<button data-testid="pick-two" @click="$emit(\'update:modelValue\', options.slice(0, 2).map(o => o.id))" />' },
}

function mountSheet(steps: CleaningStepSection[] = []) {
  return mount(ListingCleaningStepsSheet, {
    props: { steps, listingId: 'lst-1', listingName: 'Villa', open: true },
    global: { components: { Button, Input }, stubs: STUBS },
  })
}

describe('listingCleaningStepsSheet', () => {
  it('cannot save with no steps', () => {
    expect(mountSheet().get('[data-testid="steps-save"]').attributes('disabled')).toBeDefined()
  })

  it('fills from the template and saves it', async () => {
    const wrapper = mountSheet()
    await wrapper.get('[data-testid="steps-use-template"]').trigger('click')
    await nextTick()
    expect(wrapper.findAll('[data-testid="steps-section"]').length).toBeGreaterThan(0)
    await wrapper.get('[data-testid="steps-save"]').trigger('click')
    const saved = wrapper.emitted('save')![0]![0] as Array<{ steps: unknown[] }>
    expect(saved.length).toBeGreaterThan(0)
    expect(saved.every(s => s.steps.length > 0)).toBe(true)
  })

  it('drops a blank step on save', async () => {
    const wrapper = mountSheet()
    await wrapper.findAll('button').find(b => b.text().includes('Add section'))!.trigger('click')
    await nextTick()
    const inputs = wrapper.findAll('[data-testid="steps-step-input"]')
    await inputs[0]!.setValue('Mop floors')
    await wrapper.findAll('button').find(b => b.text().includes('Add step'))!.trigger('click')
    await wrapper.get('[data-testid="steps-save"]').trigger('click')
    const saved = wrapper.emitted('save')![0]![0] as Array<{ steps: Array<{ label: string }> }>
    expect(saved[0]!.steps.map(s => s.label)).toEqual(['Mop floors'])
  })

  it('collapses and expands a section, keeping its steps', async () => {
    const wrapper = mountSheet()
    await wrapper.get('[data-testid="steps-use-template"]').trigger('click')
    await nextTick()
    const first = () => wrapper.findAll('[data-testid="steps-section"]')[0]!
    expect(first().find('[data-testid="steps-section-body"]').exists()).toBe(true)
    await first().get('[data-testid="steps-section-toggle"]').trigger('click')
    expect(first().find('[data-testid="steps-section-body"]').exists()).toBe(false)
    expect(first().get('[data-testid="steps-section-count"]').text()).toMatch(/\d+ steps?/)
    await first().get('[data-testid="steps-section-toggle"]').trigger('click')
    expect(first().find('[data-testid="steps-section-body"]').exists()).toBe(true)
  })

  it('collapses and expands every section at once', async () => {
    const wrapper = mountSheet()
    await wrapper.get('[data-testid="steps-use-template"]').trigger('click')
    await nextTick()
    await wrapper.get('[data-testid="steps-toggle-all"]').trigger('click')
    expect(wrapper.findAll('[data-testid="steps-section-body"]')).toHaveLength(0)
    expect(wrapper.get('[data-testid="steps-toggle-all"]').text()).toContain('Expand all')
    await wrapper.get('[data-testid="steps-toggle-all"]').trigger('click')
    expect(wrapper.findAll('[data-testid="steps-section-body"]')).toHaveLength(wrapper.findAll('[data-testid="steps-section"]').length)
  })

  it('opens a newly added section', async () => {
    const wrapper = mountSheet()
    await wrapper.findAll('button').find(b => b.text().includes('Add section'))!.trigger('click')
    await nextTick()
    expect(wrapper.findAll('[data-testid="steps-section-body"]')).toHaveLength(1)
  })

  const two: CleaningStepSection[] = [
    { id: 'a', title: 'Kitchen', steps: [{ id: 'a1', label: 'Fridge' }] },
    { id: 'b', title: 'Pool', steps: [{ id: 'b1', label: 'Skim' }] },
  ]

  function sectionTitles(wrapper: ReturnType<typeof mountSheet>) {
    return wrapper.findAll('[data-testid="steps-section"] input[aria-label$="title"]').map(i => (i.element as HTMLInputElement).value)
  }

  it('reorders sections from the drag handle with the arrow keys', async () => {
    const wrapper = mountSheet(two)
    await nextTick()
    await wrapper.findAll('[data-testid="steps-section-handle"]')[1]!.trigger('keydown', { key: 'ArrowUp' })
    expect(sectionTitles(wrapper)).toEqual(['Pool', 'Kitchen'])
    await wrapper.findAll('[data-testid="steps-section-handle"]')[1]!.trigger('keydown', { key: 'ArrowDown' })
    expect(sectionTitles(wrapper)).toEqual(['Pool', 'Kitchen'])
  })

  it('imports another listing\'s steps into the draft, replacing or adding', async () => {
    const source = listings.value.find(l => l.id !== 'lst-1' && hasCleaningSteps(l))!
    const wrapper = mountSheet(two)
    await nextTick()
    await wrapper.get('[data-testid="steps-import"]').trigger('click')
    await wrapper.get('[data-testid="import-source-listing"]').trigger('click')
    await wrapper.get('[data-testid="import-listing-select"]').setValue(source.id)
    expect(wrapper.get('[data-testid="import-preview"]').text()).toContain('steps')
    await wrapper.get('[data-testid="import-mode-append"]').trigger('click')
    await wrapper.get('[data-testid="import-apply"]').trigger('click')
    expect(sectionTitles(wrapper).slice(0, 2)).toEqual(['Kitchen', 'Pool'])
    expect(sectionTitles(wrapper)).toHaveLength(2 + source.maintenance.cleaningSteps!.length)
    expect(wrapper.emitted('save')).toBeUndefined()
  })

  it('imports a CSV file', async () => {
    const wrapper = mountSheet()
    await wrapper.get('[data-testid="steps-import"]').trigger('click')
    await wrapper.get('[data-testid="import-source-file"]').trigger('click')
    const input = wrapper.get('[data-testid="import-file"]')
    const file = new File(['Section,Step\nPool,Skim pool\nPool,Check pump'], 'steps.csv', { type: 'text/csv' })
    Object.defineProperty(input.element, 'files', { value: [file] })
    await input.trigger('change')
    await new Promise(r => setTimeout(r, 0))
    await nextTick()
    expect(wrapper.get('[data-testid="import-preview"]').text()).toContain('2 steps in 1 section')
    await wrapper.get('[data-testid="import-apply"]').trigger('click')
    expect(sectionTitles(wrapper)).toEqual(['Pool'])
  })

  it('copies the draft to the listings picked, replacing their steps', async () => {
    const snapshot = listings.value
    try {
      const wrapper = mountSheet(two)
      await nextTick()
      await wrapper.get('[data-testid="steps-copy"]').trigger('click')
      await wrapper.get('[data-testid="pick-two"]').trigger('click')
      expect(wrapper.get('[data-testid="copy-apply"]').text()).toContain('Copy to 2 listings')
      await wrapper.get('[data-testid="copy-apply"]').trigger('click')
      const targets = listings.value.filter(l => l.id !== 'lst-1').slice(0, 2)
      expect(targets.every(l => l.maintenance.cleaningSteps?.map(s => s.title).join() === 'Kitchen,Pool')).toBe(true)
    }
    finally {
      listings.value = snapshot
    }
  })

  it('offers the default template by name when there are no steps', async () => {
    const { useCleaningStepTemplates } = await import('~/composables/useCleaningStepTemplates')
    const name = useCleaningStepTemplates().defaultTemplate.value!.name
    expect(mountSheet().get('[data-testid="steps-use-template"]').text()).toBe(`Use ${name}`)
  })

  it('imports a chosen template as a copy', async () => {
    const { useCleaningStepTemplates } = await import('~/composables/useCleaningStepTemplates')
    const template = useCleaningStepTemplates().templates.value.find(t => !t.isDefault)!
    const wrapper = mountSheet()
    await wrapper.get('[data-testid="steps-choose-template"]').trigger('click')
    await wrapper.findAll('[data-testid="import-listing-select"]')[0]!.setValue(template.id)
    await wrapper.get('[data-testid="import-apply"]').trigger('click')
    expect(sectionTitles(wrapper)).toEqual(template.sections.map(sec => sec.title))
  })
})
