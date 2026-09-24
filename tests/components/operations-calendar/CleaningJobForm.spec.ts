import type { ReservationEntry } from '~/components/reservations/data/reservations'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import CleaningJobForm from '~/components/cleaning/CleaningJobForm.vue'
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
