import type { VacantCleaningSettings } from '~/components/reservations/data/cleaning-schedule'
import type { ReservationEntry } from '~/components/reservations/data/reservations'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import CleaningSetupWizard from '~/components/cleaning/CleaningSetupWizard.vue'
import VacantCleaningPicker from '~/components/cleaning/VacantCleaningPicker.vue'
import { listings } from '~/components/listings/data/listings'
import ListingTypeChecklistSheet from '~/components/listings/ListingTypeChecklistSheet.vue'
import ReservationCleaningScheduleDialog from '~/components/reservations/ReservationCleaningScheduleDialog.vue'
import CleaningTemplateAssignDialog from '~/components/settings/CleaningTemplateAssignDialog.vue'
import CompanyCleaningScheduleCard from '~/components/settings/CompanyCleaningScheduleCard.vue'
import { Button } from '~/components/ui/button'
import { Card } from '~/components/ui/card'
import { useCleaningScheduleDefault } from '~/composables/useCleaningScheduleDefault'
import { useCleaningStepTemplates } from '~/composables/useCleaningStepTemplates'

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }))
vi.mock('vue-sonner', () => ({ toast }))

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
  Badge: passthrough,
  Input: true,
  Select: { name: 'Select', props: ['modelValue'], emits: ['update:modelValue'], template: '<div :data-value="modelValue"><slot /></div>' },
  SelectTrigger: passthrough,
  SelectValue: true,
  SelectContent: passthrough,
  SelectGroup: passthrough,
  SelectLabel: passthrough,
  SelectItem: { props: ['value'], template: '<div data-testid="option" :data-value="value"><slot /></div>' },
  NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
  TimePicker: true,
  DatePicker: true,
  StaffMultiSelectDropdown: true,
  // Picks the first two listings, or the ids a test names in `data-ids`.
  PropertyPicker: { props: ['modelValue', 'options'], emits: ['update:modelValue'], template: '<button data-testid="pick" @click="$emit(\'update:modelValue\', options.slice(0, 2).map(o => o.id))" />' },
}
const COMPONENTS = { Button, Card }

const lst = (id: string) => listings.value.find(l => l.id === id)!
const seededListings = listings.value

beforeEach(() => {
  localStorage.clear()
  listings.value = seededListings
})

function selectNamed(wrapper: ReturnType<typeof mount>, testid: string) {
  return wrapper.findAllComponents({ name: 'Select' }).find(s => s.attributes('data-testid') === testid)!
}

describe('listingTypeChecklistSheet', () => {
  function mountSheet(listingId: string, type: 'check_out' | 'daily') {
    return mount(ListingTypeChecklistSheet, {
      props: { listing: lst(listingId), type, open: true },
      global: { components: COMPONENTS, stubs: STUBS },
    })
  }

  it('starts on the listing\'s current choice and previews it', () => {
    // lst-1 overrides check-out with Deep clean (seed).
    const wrapper = mountSheet('lst-1', 'check_out')
    expect(wrapper.get('[data-testid="checklist-choice-template"]').attributes('aria-checked')).toBe('true')
    expect(wrapper.get('[data-testid="checklist-preview"]').text()).toContain('Deep clean')
  })

  it('saves the company default as null', async () => {
    const wrapper = mountSheet('lst-1', 'check_out')
    await wrapper.get('[data-testid="checklist-choice-default"]').trigger('click')
    expect(wrapper.get('[data-testid="checklist-preview"]').text()).toContain('Villa standard')
    await wrapper.get('[data-testid="checklist-save"]').trigger('click')
    expect(wrapper.emitted('save')![0]).toEqual(['check_out', null])
  })

  it('saves another template by id', async () => {
    const wrapper = mountSheet('lst-2', 'daily')
    await wrapper.get('[data-testid="checklist-choice-template"]').trigger('click')
    expect(wrapper.get('[data-testid="checklist-save"]').attributes('disabled')).toBeDefined()
    selectNamed(wrapper, 'checklist-template-select').vm.$emit('update:modelValue', 'cst-deep')
    await nextTick()
    await wrapper.get('[data-testid="checklist-save"]').trigger('click')
    expect(wrapper.emitted('save')![0]).toEqual(['daily', 'cst-deep'])
  })

  it('asks for custom steps when the listing has none yet', async () => {
    const listing = listings.value.find(l => !l.maintenance.cleaningSteps?.length)!
    const wrapper = mount(ListingTypeChecklistSheet, {
      props: { listing, type: 'daily', open: true },
      global: { components: COMPONENTS, stubs: STUBS },
    })
    await wrapper.get('[data-testid="checklist-choice-custom"]').trigger('click')
    expect(wrapper.get('[data-testid="checklist-save"]').attributes('disabled')).toBeDefined()
    await wrapper.get('[data-testid="checklist-edit-custom"]').trigger('click')
    expect(wrapper.emitted('editCustom')![0]).toEqual(['daily'])
  })
})

describe('cleaningTemplateAssignDialog', () => {
  it('previews what each listing uses now, and assigns the template to them', async () => {
    const template = useCleaningStepTemplates().getTemplate('cst-studio')!
    const wrapper = mount(CleaningTemplateAssignDialog, {
      props: { template, open: true },
      global: { components: COMPONENTS, stubs: STUBS },
    })
    await wrapper.get('[data-testid="assign-type-check_out"]').trigger('click')
    expect(wrapper.get('[data-testid="assign-apply"]').attributes('disabled')).toBeDefined()
    await wrapper.get('[data-testid="pick"]').trigger('click')
    const [first, second] = listings.value
    const preview = wrapper.get('[data-testid="assign-preview"]').text()
    expect(preview).toContain(first!.name)
    expect(preview).toContain(second!.name)
    await wrapper.get('[data-testid="assign-apply"]').trigger('click')
    expect(lst(first!.id).maintenance.cleaningTemplates?.check_out).toBe('cst-studio')
    expect(lst(second!.id).maintenance.cleaningTemplates?.check_out).toBe('cst-studio')
  })
})

describe('cleaningSetupWizard', () => {
  it('offers When empty for the daily schedule and saves it', async () => {
    const wrapper = mount(CleaningSetupWizard, { global: { components: COMPONENTS, stubs: { ...STUBS, VacantCleaningPicker: { props: ['modelValue'], emits: ['update:modelValue'], template: '<button data-testid="pick-every-day" @click="$emit(\'update:modelValue\', { frequency: \'every_day\' })" />' } } } })
    await wrapper.get('[data-testid="setup-next"]').trigger('click')
    // A new tenant starts on check-out cleaning, which has no empty days to plan.
    expect(wrapper.find('[data-testid="schedule-when-empty"]').exists()).toBe(false)
    await wrapper.get('[data-testid="schedule-type-daily"]').trigger('click')
    expect(wrapper.find('[data-testid="schedule-when-empty"]').exists()).toBe(true)
    await wrapper.get('[data-testid="pick-every-day"]').trigger('click')
    await wrapper.get('[data-testid="setup-next"]').trigger('click')
    expect(useCleaningScheduleDefault().companyDefault.value.vacant).toEqual({ frequency: 'every_day' })
  })

  function mountWizard() {
    return mount(CleaningSetupWizard, { global: { components: COMPONENTS, stubs: STUBS } })
  }

  it('can be skipped, keeping the active defaults', async () => {
    const wrapper = mountWizard()
    await wrapper.get('[data-testid="setup-skip"]').trigger('click')
    expect(wrapper.emitted('done')).toHaveLength(1)
    expect(useCleaningStepTemplates().defaultFor('check_out')!.id).toBe('cst-villa')
  })

  it('sets the check-out default from what the tenant manages', async () => {
    const wrapper = mountWizard()
    await wrapper.get('[data-testid="setup-mix-apartments"]').trigger('click')
    await nextTick()
    expect(useCleaningStepTemplates().defaultFor('check_out')!.id).toBe('cst-studio')
  })

  it('overrides check-out on the picked apartments for a mix', async () => {
    const wrapper = mountWizard()
    await wrapper.get('[data-testid="setup-mix-mixed"]').trigger('click')
    await nextTick()
    await wrapper.get('[data-testid="setup-apartments"] [data-testid="pick"]').trigger('click')
    await wrapper.get('[data-testid="setup-next"]').trigger('click')
    const [first] = listings.value
    expect(lst(first!.id).maintenance.cleaningTemplates?.check_out).toBe('cst-studio')
    expect(useCleaningStepTemplates().defaultFor('check_out')!.id).toBe('cst-villa')
  })

  it('saves the schedule for new bookings and the default cleaners, then finishes', async () => {
    const wrapper = mountWizard()
    await wrapper.get('[data-testid="setup-next"]').trigger('click')
    await wrapper.get('[data-testid="schedule-type-checkout"]').trigger('click')
    await wrapper.get('[data-testid="setup-next"]').trigger('click')
    const cleaner = wrapper.findAll('[data-testid^="setup-cleaner-"]')[0]!
    await cleaner.trigger('click')
    await wrapper.get('[data-testid="setup-next"]').trigger('click')
    const { companyDefault } = useCleaningScheduleDefault()
    expect(companyDefault.value.type).toBe('checkout')
    expect(companyDefault.value.assigneeIds).toEqual([cleaner.attributes('data-testid')!.replace('setup-cleaner-', '')])
    expect(wrapper.emitted('done')).toHaveLength(1)
  })
})

describe('companyCleaningScheduleCard', () => {
  it('saves the company schedule, including how often an empty listing is cleaned', async () => {
    const wrapper = mount(CompanyCleaningScheduleCard, { global: { components: COMPONENTS, stubs: { ...STUBS, VacantCleaningPicker: { props: ['modelValue'], emits: ['update:modelValue'], template: '<button data-testid="pick-every-n" @click="$emit(\'update:modelValue\', { frequency: \'every_n_days\', dayInterval: 3 })" />' } } } })
    expect(wrapper.get('[data-testid="company-cleaning-schedule-save"]').attributes('disabled')).toBeDefined()
    await wrapper.get('[data-testid="schedule-type-daily"]').trigger('click')
    expect(wrapper.find('[data-testid="schedule-when-empty"]').exists()).toBe(true)
    await wrapper.get('[data-testid="pick-every-n"]').trigger('click')
    await wrapper.get('[data-testid="company-cleaning-schedule-save"]').trigger('click')
    expect(useCleaningScheduleDefault().companyDefault.value.vacant).toEqual({ frequency: 'every_n_days', dayInterval: 3 })
    expect(wrapper.get('[data-testid="company-cleaning-schedule-save"]').attributes('disabled')).toBeDefined()
  })

  it('starts on check-out cleaning, with no empty days to plan', () => {
    const wrapper = mount(CompanyCleaningScheduleCard, { global: { components: COMPONENTS, stubs: STUBS } })
    expect(wrapper.get('[data-testid="schedule-type-checkout"]').attributes('aria-checked')).toBe('true')
    expect(wrapper.find('[data-testid="schedule-when-empty"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="schedule-summary"]').text()).toBe('Cleaned once on check-out day at 11:00.')
  })
})

describe('vacantCleaningPicker', () => {
  it('shows Monday and Thursday when nothing is set', () => {
    const wrapper = mount(VacantCleaningPicker, { props: { modelValue: undefined }, global: { stubs: { Input: true } } })
    expect(wrapper.get('[data-testid="vacant-frequency-weekdays"]').attributes('aria-checked')).toBe('true')
    expect(wrapper.get('[data-testid="vacant-day-monday"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('[data-testid="vacant-day-thursday"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('[data-testid="vacant-day-tuesday"]').attributes('aria-pressed')).toBe('false')
  })

  it('emits each choice', async () => {
    const wrapper = mount(VacantCleaningPicker, { props: { modelValue: undefined }, global: { stubs: { Input: true } } })
    await wrapper.get('[data-testid="vacant-day-friday"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')!.at(-1)![0]).toEqual({ frequency: 'weekdays', weekDays: ['monday', 'thursday', 'friday'] })
    await wrapper.get('[data-testid="vacant-frequency-never"]').trigger('click')
    expect((wrapper.emitted('update:modelValue')!.at(-1)![0] as VacantCleaningSettings).frequency).toBe('never')
    await wrapper.get('[data-testid="vacant-frequency-every_n_days"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')!.at(-1)![0]).toEqual({ frequency: 'every_n_days', dayInterval: 2, weekDays: undefined })
  })
})

describe('useCleaningScheduleDefault', () => {
  it('uses the listing\'s own schedule, else the company default', () => {
    const { scheduleFor, companyDefault } = useCleaningScheduleDefault()
    const own = listings.value.find(l => l.maintenance.defaultCleaningSchedule)!
    expect(scheduleFor(own)).toEqual(own.maintenance.defaultCleaningSchedule)
    expect(scheduleFor({ maintenance: {} })).toEqual(companyDefault.value)
    expect(companyDefault.value.type).toBe('checkout')
    expect(companyDefault.value.vacant).toEqual({ frequency: 'weekdays', weekDays: ['monday', 'thursday'] })
  })
})

describe('reservationCleaningScheduleDialog checklists', () => {
  function reservation(listingId: string): ReservationEntry {
    const l = lst(listingId)
    return { id: 'res-x', listingId, listingName: l.name, checkIn: '2026-11-02', checkOut: '2026-11-06', status: 'confirmed' } as unknown as ReservationEntry
  }

  it('names the checklist each cleaning type will use before saving', () => {
    const wrapper = mount(ReservationCleaningScheduleDialog, {
      props: { open: true, reservation: reservation('lst-2'), cleanerOptions: [] },
      global: { components: COMPONENTS, stubs: STUBS },
    })
    const box = wrapper.find('[data-testid="cleaning-schedule-checklists"]')
    expect(box.exists()).toBe(true)
    expect(box.text()).toMatch(/Villa standard|Daily refresh|Deep clean/)
    expect(wrapper.find('[data-testid="cleaning-schedule-missing-checklist"]').exists()).toBe(false)
  })

  it('warns, before saving, about a type the listing has no checklist for', () => {
    const { typeDefaults } = useCleaningStepTemplates()
    typeDefaults.value = {}
    const listing = listings.value.find(l => !l.maintenance.cleaningSteps?.length && !l.maintenance.defaultCleaningSchedule)!
    const wrapper = mount(ReservationCleaningScheduleDialog, {
      props: { open: true, reservation: reservation(listing.id), cleanerOptions: [] },
      global: { components: COMPONENTS, stubs: STUBS },
    })
    expect(wrapper.get('[data-testid="cleaning-schedule-missing-checklist"]').text()).toContain('will not be scheduled')
  })
})
