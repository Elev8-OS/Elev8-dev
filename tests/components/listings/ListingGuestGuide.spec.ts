import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { listingGuideItems } from '~/components/listings/data/guest-guide-content'
import { listings } from '~/components/listings/data/listings'
import GuideItemsEditor from '~/components/listings/guest-guide/GuideItemsEditor.vue'
import ListingGuideContentSheet from '~/components/listings/guest-guide/ListingGuideContentSheet.vue'
import ListingGuestGuideTab from '~/components/listings/ListingGuestGuideTab.vue'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Card } from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { Textarea } from '~/components/ui/textarea'
import { useGuideContentTemplates } from '~/composables/useGuideContentTemplates'

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }))
vi.mock('vue-sonner', () => ({ toast }))

const passthrough = { template: '<div><slot /></div>' }
const STUBS = {
  Icon: true,
  NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
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
  Select: { props: ['modelValue'], emits: ['update:modelValue'], template: '<select data-testid="select" :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value)"><slot /></select>' },
  SelectTrigger: { template: '<slot />' },
  SelectValue: true,
  SelectContent: { template: '<slot />' },
  SelectItem: { props: ['value'], template: '<option :value="value"><slot /></option>' },
  PropertyPicker: { props: ['modelValue', 'options'], emits: ['update:modelValue'], template: '<button data-testid="pick-two" @click="$emit(\'update:modelValue\', options.slice(0, 2).map(o => o.id))" />' },
  GuideAssignPopover: true,
  GuideStatusBadge: true,
}
const COMPONENTS = { Badge, Button, Card, Input, Textarea }

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

describe('guideItemsEditor', () => {
  function mountEditor(kind: 'checkin' | 'good_to_know', items = [] as Array<{ id: string, title: string, icon?: string }>) {
    const wrapper = mount(GuideItemsEditor, {
      props: { 'kind': kind, 'modelValue': items, 'onUpdate:modelValue': (v: unknown) => wrapper.setProps({ modelValue: v as never }) },
      global: { components: COMPONENTS, stubs: STUBS },
    })
    return wrapper
  }

  it('adds an item and reorders with the arrow keys on the handle', async () => {
    const wrapper = mountEditor('checkin', [{ id: 'a', title: 'First' }, { id: 'b', title: 'Second' }])
    await wrapper.findAll('[data-testid="guide-item-handle"]')[1]!.trigger('keydown', { key: 'ArrowUp' })
    expect((wrapper.props('modelValue') as Array<{ title: string }>).map(i => i.title)).toEqual(['Second', 'First'])
    await wrapper.get('[data-testid="guide-item-add"]').trigger('click')
    expect(wrapper.props('modelValue')).toHaveLength(3)
  })

  it('offers a photo for steps and Good to Know, and an icon only for Good to Know', async () => {
    const steps = mountEditor('checkin', [{ id: 'a', title: 'Park' }])
    await steps.get('[data-testid="guide-item-toggle"]').trigger('click')
    expect(steps.find('[data-testid="guide-item-photo-input"]').exists()).toBe(true)
    expect(steps.find('[data-testid="guide-item-icon"]').exists()).toBe(false)

    const tips = mountEditor('good_to_know', [{ id: 'g', title: 'Pool', icon: 'lucide:info' }])
    await tips.get('[data-testid="guide-item-toggle"]').trigger('click')
    expect(tips.find('[data-testid="guide-item-photo-input"]').exists()).toBe(true)
    await tips.findAll('[data-testid="guide-item-icon"]').find(b => b.attributes('aria-label') === 'waves')!.trigger('click')
    expect((tips.props('modelValue') as Array<{ icon: string }>)[0]!.icon).toBe('lucide:waves')
  })

  it('refuses a step photo that is not an image', async () => {
    const wrapper = mountEditor('checkin', [{ id: 'a', title: 'Park' }])
    await wrapper.get('[data-testid="guide-item-toggle"]').trigger('click')
    const input = wrapper.get('[data-testid="guide-item-photo-input"]')
    Object.defineProperty(input.element, 'files', { value: [new File(['x'], 'a.pdf', { type: 'application/pdf' })] })
    await input.trigger('change')
    expect(toast.error).toHaveBeenCalledWith('Use a PNG, JPG or WebP image')
  })
})

describe('listingGuideContentSheet', () => {
  function mountSheet(items = [] as Array<{ id: string, title: string }>) {
    return mount(ListingGuideContentSheet, {
      props: { kind: 'checkin', items, listingId: 'lst-1', listingName: 'Villa', open: true },
      global: { components: COMPONENTS, stubs: STUBS },
    })
  }

  it('offers the default template by name and saves it as a copy', async () => {
    const def = useGuideContentTemplates().defaultTemplateOf('checkin')!
    const wrapper = mountSheet()
    const use = wrapper.get('[data-testid="guide-use-template"]')
    expect(use.text()).toBe(`Use ${def.name}`)
    await use.trigger('click')
    await nextTick()
    await wrapper.get('[data-testid="guide-save"]').trigger('click')
    const saved = wrapper.emitted('save')![0]![0] as Array<{ id: string, title: string }>
    expect(saved.map(i => i.title)).toEqual(def.items.map(i => i.title))
    expect(saved[0]!.id).not.toBe(def.items[0]!.id)
  })

  it('copies the draft to other listings, replacing that kind there', async () => {
    const snapshot = listings.value
    try {
      const wrapper = mountSheet([{ id: 'a', title: 'Ring the bell' }])
      await wrapper.get('[data-testid="guide-copy"]').trigger('click')
      await wrapper.get('[data-testid="pick-two"]').trigger('click')
      await wrapper.get('[data-testid="guide-copy-apply"]').trigger('click')
      const targets = listings.value.filter(l => l.id !== 'lst-1').slice(0, 2)
      expect(targets.every(l => listingGuideItems(l, 'checkin').map(i => i.title).join() === 'Ring the bell')).toBe(true)
    }
    finally {
      listings.value = snapshot
    }
  })
})

describe('listingGuestGuideTab', () => {
  it('shows each kind from the listing and saves edits onto the listing', async () => {
    const listing = listings.value.find(l => l.id === 'lst-1')!
    const wrapper = mount(ListingGuestGuideTab, { props: { listing }, global: { components: COMPONENTS, stubs: { ...STUBS, ListingGuideContentSheet: { props: ['open', 'kind'], emits: ['save'], template: '<button v-if="open" data-testid="fake-save" @click="$emit(\'save\', [{ id: \'n\', title: \'New step\' }])" />' } } } })
    for (const kind of ['checkin', 'checkout', 'house_rules', 'good_to_know'])
      expect(wrapper.get(`[data-testid="guide-nav-${kind}"]`).text()).toMatch(/\d+|Empty/)
    expect(wrapper.get('[data-testid="guide-content-checkin"]').text()).toContain('Arrive at the main gate')
    await wrapper.get('[data-testid="guide-nav-good_to_know"]').trigger('click')
    expect(wrapper.find('[data-testid="guide-content-checkin"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="guide-content-good_to_know"]').text()).toContain('Drinking water')
    await wrapper.get('[data-testid="guide-nav-checkin"]').trigger('click')
    await wrapper.get('[data-testid="guide-edit-checkin"]').trigger('click')
    await wrapper.get('[data-testid="fake-save"]').trigger('click')
    const updated = wrapper.emitted('update')![0]![0] as typeof listing
    expect(updated.guestGuide!.checkin!.map(i => i.title)).toEqual(['New step'])
    expect(updated.guestGuide!.house_rules).toEqual(listing.guestGuide!.house_rules)
  })
})

describe('guest verification', () => {
  it('shows the listing\'s setting and saves a new mode and toggles onto the listing', async () => {
    const listing = listings.value.find(l => l.id === 'lst-1')!
    const wrapper = mount(ListingGuestGuideTab, { props: { listing }, global: { components: COMPONENTS, stubs: { ...STUBS, ListingGuideContentSheet: true, Switch: { props: ['modelValue'], emits: ['update:modelValue'], template: '<button role="switch" :aria-checked="modelValue" @click="$emit(\'update:modelValue\', !modelValue)" />' } } } })
    expect(wrapper.get('[data-testid="guide-nav-verification"]').text()).toContain('Group')
    await wrapper.get('[data-testid="guide-nav-verification"]').trigger('click')
    expect(wrapper.get('[data-testid="verification-mode-group"]').attributes('aria-checked')).toBe('true')
    expect(wrapper.get('[data-testid="verification-description"]').text()).toContain('only one guest needs to upload a document')

    await wrapper.get('[data-testid="verification-mode-none"]').trigger('click')
    expect((wrapper.emitted('update')!.at(-1)![0] as typeof listing).guestVerification).toEqual({ mode: 'none', requireAddress: true, askBedConfiguration: true })

    await wrapper.get('[data-testid="verification-beds"]').trigger('click')
    expect((wrapper.emitted('update')!.at(-1)![0] as typeof listing).guestVerification!.askBedConfiguration).toBe(false)
  })

  it('defaults to verifying each person with no extra questions', async () => {
    const { listingGuestVerification } = await import('~/components/listings/data/guest-verification')
    expect(listingGuestVerification({})).toEqual({ mode: 'person', requireAddress: false, askBedConfiguration: false })
  })
})

describe('good to Know layout', () => {
  it('lists items as rows like the steps, with a photo as a thumbnail in its own row', async () => {
    const base = listings.value.find(l => l.id === 'lst-1')!
    const listing = { ...base, guestGuide: { ...base.guestGuide, good_to_know: [
      { id: 'p', title: 'Pool', icon: 'lucide:waves', photoUrl: 'data:image/png;base64,AA' },
      { id: 'r', title: 'Rubbish', icon: 'lucide:trash-2' },
    ] } }
    const wrapper = mount(ListingGuestGuideTab, { props: { listing }, global: { components: COMPONENTS, stubs: { ...STUBS, ListingGuideContentSheet: true } } })
    await wrapper.get('[data-testid="guide-nav-good_to_know"]').trigger('click')
    const rows = wrapper.get('[data-testid="guide-items"]').findAll('li')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.find('[data-testid="guide-item-thumb"]').exists()).toBe(true)
    expect(rows[1]!.find('[data-testid="guide-item-thumb"]').exists()).toBe(false)
  })
})

describe('pets', () => {
  const SWITCH = { props: ['modelValue'], emits: ['update:modelValue'], template: '<button role="switch" :aria-checked="modelValue" @click="$emit(\'update:modelValue\', !modelValue)" />' }
  const POPOVER = { template: '<div><slot /></div>' }

  async function openPets(listingOverride?: Record<string, unknown>) {
    const base = listings.value.find(l => l.id === 'lst-1')!
    const listing = { ...base, ...listingOverride }
    const wrapper = mount(ListingGuestGuideTab, { props: { listing }, global: { components: COMPONENTS, stubs: { ...STUBS, ListingGuideContentSheet: true, Switch: SWITCH, Popover: POPOVER, PopoverTrigger: POPOVER, PopoverContent: POPOVER } } })
    await wrapper.get('[data-testid="guide-nav-pets"]').trigger('click')
    return { wrapper, listing }
  }

  it('shows pets allowed with no packages, as set on the listing', async () => {
    const { wrapper } = await openPets()
    expect(wrapper.get('[data-testid="guide-nav-pets"]').text()).toContain('Allowed')
    expect(wrapper.get('[data-testid="pets-no-packages"]').text()).toContain('no package selection or payment will be required')
  })

  it('assigns a Pet upsell as a package, and lists only Pet upsells to pick from', async () => {
    const { wrapper } = await openPets()
    const options = wrapper.findAll('[data-testid="pet-upsell-option"]')
    expect(options.map(o => o.text())).toEqual(expect.arrayContaining([expect.stringContaining('Pet stay'), expect.stringContaining('Pet welcome kit')]))
    expect(options.some(o => o.text().includes('Private Chef'))).toBe(false)
    await options.find(o => o.text().includes('Pet stay'))!.trigger('click')
    expect((wrapper.emitted('update')!.at(-1)![0] as any).petPolicy).toEqual({ allowed: true, packageIds: ['svc-pet-stay'] })
  })

  it('lists assigned packages with their price, and warns when the catalog does not offer one here', async () => {
    const { wrapper } = await openPets({ name: 'A listing the catalog does not know', petPolicy: { allowed: true, packageIds: ['svc-pet-stay'] } })
    const row = wrapper.get('[data-testid="pet-package"]')
    expect(row.text()).toContain('IDR 350,000 to 600,000')
    expect(row.find('[data-testid="pet-package-not-offered"]').exists()).toBe(true)
  })

  it('turns pets off', async () => {
    const { wrapper } = await openPets()
    await wrapper.get('[data-testid="pets-allowed"]').trigger('click')
    expect((wrapper.emitted('update')!.at(-1)![0] as any).petPolicy.allowed).toBe(false)
  })
})
