import type { CleaningJobInput } from '~/components/cleaning/data/cleaning-jobs'
import type { ReservationEntry } from '~/components/reservations/data/reservations'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import CleaningJobForm from '~/components/cleaning/CleaningJobForm.vue'
import { cleanerOptions } from '~/components/cleaning/data/cleaning-jobs'
import Button from '~/components/ui/button/Button.vue'
import Popover from '~/components/ui/popover/Popover.vue'
import PopoverContent from '~/components/ui/popover/PopoverContent.vue'
import PopoverTrigger from '~/components/ui/popover/PopoverTrigger.vue'
import { useReservationsModule } from '~/composables/useReservationsModule'

describe('cleaningJobForm in create operation', () => {
  it('allows assigning housekeeping staff and renders summary without error', async () => {
    const wrapper = mount(CleaningJobForm, {
      props: {
        mode: 'create',
        defaultListingId: 'lst-1',
        defaultScheduledAt: '2026-06-23T11:00',
      },
      global: {
        components: {
          Button,
          Popover,
          PopoverContent,
          PopoverTrigger,
        },
        stubs: {
          Icon: true,
          Switch: true,
          Select: true,
          SelectTrigger: true,
          SelectValue: true,
          SelectContent: true,
          SelectItem: true,
          ScrollArea: { template: '<div><slot /></div>' },
        },
      },
      attachTo: document.body,
    })

    await nextTick()

    // Find the housekeeping trigger button
    const buttons = wrapper.findAllComponents(Button)
    const housekeepingBtn = buttons.find(b => b.text().includes('Assign housekeeping'))
    expect(housekeepingBtn).toBeDefined()

    // Click trigger to open popover
    await housekeepingBtn!.trigger('click')
    await nextTick()
    await nextTick()

    const popoverContent = document.querySelector('[data-slot="popover-content"]')
    expect(popoverContent).not.toBeNull()

    const staffButtons = popoverContent!.querySelectorAll('button')
    expect(staffButtons.length).toBeGreaterThan(0)

    // Verify Housekeeping role is displayed for Made Surya
    const madeSuryaBtn = Array.from(staffButtons).find(b => b.textContent?.includes('Made Surya'))
    expect(madeSuryaBtn).toBeDefined()
    expect(madeSuryaBtn!.textContent).toContain('Housekeeping')

    // Click Made Surya to assign
    madeSuryaBtn!.click()
    await nextTick()
    await nextTick()

    // Trigger button now shows Made Surya · Housekeeping
    expect(housekeepingBtn!.text()).toContain('Made Surya · Housekeeping')

    // Cleaning details summary rendered without crashing
    const summary = wrapper.find('[data-testid="cleaning-details-summary"]')
    expect(summary.exists()).toBe(true)
    expect(summary.text()).toContain('Custom cleaning')
    expect(summary.text()).toContain('Made Surya')

    // Save button is now enabled
    const saveBtn = wrapper.findAllComponents(Button).find(b => b.text().includes('Save Cleaning Job'))
    expect(saveBtn!.attributes('disabled')).toBeUndefined()

    // Click save and verify emitted event
    await saveBtn!.trigger('click')
    const savedEvents = wrapper.emitted('save')
    expect(savedEvents).toBeTruthy()
    expect(savedEvents![0]![0]).toMatchObject({
      listingId: 'lst-1',
      cleanerIds: ['staff-3'],
      cleanerNames: ['Made Surya'],
      source: 'manual',
    })

    wrapper.unmount()
  })

  it('a cleaning started from a room row is saved for that room', async () => {
    const wrapper = mount(CleaningJobForm, {
      props: { mode: 'create', defaultListingId: 'lst-1', defaultUnitId: 'un-2', defaultScheduledAt: '2026-06-23T11:00' },
      global: {
        components: { Button, Popover, PopoverContent, PopoverTrigger },
        stubs: { Icon: true, Switch: true, Select: true, SelectTrigger: true, SelectValue: true, SelectContent: true, SelectItem: true, ScrollArea: { template: '<div><slot /></div>' } },
      },
      attachTo: document.body,
    })
    await nextTick()
    expect(wrapper.find('[data-testid="cleaning-room"]').text()).toContain('Garden Unit')
    await wrapper.findAllComponents(Button).find(b => b.text().includes('Assign housekeeping'))!.trigger('click')
    await nextTick()
    await nextTick()
    const madeSurya = Array.from(document.querySelectorAll('[data-slot="popover-content"] button')).find(b => b.textContent?.includes('Made Surya')) as HTMLButtonElement
    madeSurya.click()
    await nextTick()
    await nextTick()
    await wrapper.findAllComponents(Button).find(b => b.text().includes('Save Cleaning Job'))!.trigger('click')
    expect(wrapper.emitted('save')![0]![0]).toMatchObject({ listingId: 'lst-1', unitId: 'un-2', unitName: 'Garden Unit' })
    wrapper.unmount()
  })

  it('filters staff when searching "housekeeping"', async () => {
    const wrapper = mount(CleaningJobForm, {
      props: {
        mode: 'create',
        defaultListingId: 'lst-1',
        defaultScheduledAt: '2026-06-23T11:00',
      },
      global: {
        components: {
          Button,
          Popover,
          PopoverContent,
          PopoverTrigger,
        },
        stubs: {
          Icon: true,
          Switch: true,
          Select: true,
          SelectTrigger: true,
          SelectValue: true,
          SelectContent: true,
          SelectItem: true,
          ScrollArea: { template: '<div><slot /></div>' },
        },
      },
      attachTo: document.body,
    })

    await nextTick()

    // Open popover
    const housekeepingBtn = wrapper.findAllComponents(Button).find(b => b.text().includes('Assign housekeeping'))
    await housekeepingBtn!.trigger('click')
    await nextTick()

    // Type "housekeeping" into search input
    const searchInput = document.querySelector('input[placeholder="Search staff…"]') as HTMLInputElement
    expect(searchInput).not.toBeNull()
    searchInput.value = 'housekeeping'
    searchInput.dispatchEvent(new Event('input'))
    await nextTick()

    const popoverContent = document.querySelector('[data-slot="popover-content"]')
    const visibleStaff = Array.from(popoverContent!.querySelectorAll('button'))
    const visibleNames = visibleStaff.map(b => b.textContent?.trim())

    expect(visibleNames.some(n => n?.includes('Made Surya'))).toBe(true)
    expect(visibleNames.some(n => n?.includes('Wayan Adi'))).toBe(true)
    expect(visibleNames.some(n => n?.includes('Komang Juliantara'))).toBe(false)

    wrapper.unmount()
  })
})

describe('cleaningJobForm linked stay', () => {
  function mountAt(scheduledAt: string, modelValue: Record<string, unknown> | null = null) {
    return mount(CleaningJobForm, {
      props: { mode: modelValue ? 'edit' : 'create', defaultListingId: 'lst-1', defaultScheduledAt: scheduledAt, modelValue },
      global: {
        components: { Button, Popover, PopoverContent, PopoverTrigger },
        stubs: {
          Icon: true,
          Switch: true,
          Select: true,
          SelectTrigger: true,
          SelectValue: true,
          SelectContent: true,
          SelectItem: true,
          ScrollArea: { template: '<div><slot /></div>' },
        },
      },
    })
  }

  function seedStays() {
    useReservationsModule().reservations.value = [
      { id: 'res-a', listingId: 'lst-1', listingName: 'Villa', guestName: 'Anna Schmidt', checkIn: '2026-11-01', checkOut: '2026-11-05', status: 'verified' } as ReservationEntry,
    ]
  }

  it('says which stay a new cleaning will be linked to', async () => {
    seedStays()
    const wrapper = mountAt('2026-11-03T11:00')
    await nextTick()
    expect(wrapper.find('[data-testid="cleaning-linked-stay"]').text()).toBe('Linked to Anna Schmidt\'s stay, 1 Nov to 5 Nov')
  })

  it('says a cleaning on a date with no stay is created without a reservation', async () => {
    seedStays()
    const wrapper = mountAt('2026-11-20T11:00')
    await nextTick()
    expect(wrapper.find('[data-testid="cleaning-linked-stay"]').text()).toContain('No stay on this date')
  })

  it('keeps an existing link when the job is edited without moving', async () => {
    seedStays()
    const wrapper = mountAt('2026-11-20T11:00', {
      listingId: 'lst-1',
      scheduledAt: '2026-11-20T11:00:00+08:00',
      reservationId: 'res-a',
    })
    await nextTick()
    expect(wrapper.find('[data-testid="cleaning-linked-stay"]').text()).toContain('Anna Schmidt')
  })
})

describe('cleaningJobForm checklist template', () => {
  function mountNew() {
    return mount(CleaningJobForm, {
      props: {
        mode: 'create',
        modelValue: { listingId: 'lst-1', scheduledAt: '2026-06-23T11:00:00+08:00', cleanerIds: [cleanerOptions[0]!.id], source: 'check_out' },
      },
      global: {
        components: { Button },
        stubs: {
          Icon: true,
          Switch: true,
          Select: { name: 'Select', props: ['modelValue'], emits: ['update:modelValue'], template: '<div><slot /></div>' },
          SelectTrigger: true,
          SelectValue: true,
          SelectContent: { template: '<div><slot /></div>' },
          SelectItem: { name: 'SelectItem', props: ['value'], template: '<div :data-value="value"><slot /></div>' },
          SelectGroup: { template: '<div><slot /></div>' },
          SelectLabel: { template: '<div><slot /></div>' },
          NuxtLink: true,
          GuestInfoCard: true,
          ListingPicker: true,
          Popover: true,
          PopoverTrigger: true,
          PopoverContent: true,
        },
      },
    })
  }

  async function openPicker(wrapper: ReturnType<typeof mountNew>) {
    await wrapper.get('[data-testid="cleaning-checklist-change"]').trigger('click')
    await nextTick()
  }

  function selectNamed(wrapper: ReturnType<typeof mountNew>, testid: string) {
    return wrapper.findAllComponents({ name: 'Select' }).find(s => s.attributes('data-testid') === testid)!
  }

  async function save(wrapper: ReturnType<typeof mountNew>) {
    await wrapper.findAllComponents(Button).find(b => b.text().includes('Save Cleaning Job'))!.trigger('click')
    return wrapper.emitted('save')![0]![0] as CleaningJobInput
  }

  it('shows the listing\'s checklist for the type, collapsed, and follows the type', async () => {
    const wrapper = mountNew()
    await nextTick()
    // lst-1 overrides check-out with Deep clean (seed); daily follows the company default.
    expect(wrapper.get('[data-testid="cleaning-checklist-current"]').text()).toContain('Deep clean')
    selectNamed(wrapper, 'cleaning-type').vm.$emit('update:modelValue', 'daily')
    await nextTick()
    expect(wrapper.get('[data-testid="cleaning-checklist-current"]').text()).toContain('Daily refresh')
    expect(wrapper.get('[data-testid="cleaning-checklist-summary"]').text()).toContain('Daily refresh')
    expect('steps' in await save(wrapper)).toBe(false)
  })

  it('offers every template on Change, after the listing\'s own', async () => {
    const wrapper = mountNew()
    await nextTick()
    await openPicker(wrapper)
    const items = selectNamed(wrapper, 'cleaning-checklist').findAll('[data-value]').map(i => i.attributes('data-value'))
    expect(items[0]).toBe('listing')
    expect(items).toEqual(expect.arrayContaining(['cst-villa', 'cst-studio', 'cst-deep', 'cst-daily']))
  })

  it('saves a copy of the picked template\'s steps, with its name', async () => {
    const wrapper = mountNew()
    await nextTick()
    await openPicker(wrapper)
    selectNamed(wrapper, 'cleaning-checklist').vm.$emit('update:modelValue', 'cst-studio')
    await nextTick()
    expect(wrapper.get('[data-testid="cleaning-checklist-summary"]').text()).toContain('Studio / apartment')
    const input = await save(wrapper)
    expect(input.steps!.map(s => s.title)).toEqual(['Room', 'Kitchenette', 'Bathroom'])
    expect(input.steps![0]!.id).not.toBe('studio-room')
    expect(input.checklistName).toBe('Studio / apartment')
  })
})
