import type { CalendarEvent } from '~/components/operations-calendar/data/operations-calendar'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { cleaningDisplayStatus } from '~/components/cleaning/data/cleaning-jobs'
import { listings } from '~/components/listings/data/listings'
import CalendarEventDetailDialog from '~/components/operations-calendar/CalendarEventDetailDialog.vue'
import { addMinutesKeepingOffset } from '~/components/operations-calendar/data/operations-calendar'
import Button from '~/components/ui/button/Button.vue'
import { useCleaningJobs } from '~/composables/useCleaningJobs'

describe('calendarEventDetailDialog - reschedule future cleaning', () => {
  it('renders Reschedule button for future scheduled cleanings', async () => {
    const { createJob } = useCleaningJobs()
    const job = createJob({
      listingId: 'lst-1',
      listingName: '5BR Pool Villa',
      scheduledAt: '2028-10-15T11:00:00+08:00',
      cleanerIds: ['staff-3'],
      cleanerNames: ['Made Surya'],
      teamName: 'Housekeeping',
      status: 'scheduled',
      priority: 'normal',
      durationMinutes: 120,
      notes: 'Future cleaning test',
      source: 'custom',
    })

    const futureEvent: CalendarEvent = {
      id: job.id,
      type: 'cleaning',
      title: 'Custom cleaning',
      listingId: 'lst-1',
      listingName: '5BR Pool Villa',
      start: '2028-10-15T11:00:00+08:00',
      end: '2028-10-15T13:00:00+08:00',
      status: 'scheduled',
      cleaningType: 'custom',
      cleaningTypeLabel: 'Custom cleaning',
    }

    const wrapper = mount(CalendarEventDetailDialog, {
      props: {
        open: true,
        event: futureEvent,
      },
      global: {
        components: { Button },
        stubs: {
          Icon: true,
          Badge: true,
          Switch: true,
          Sheet: { template: '<div><slot /></div>' },
          SheetContent: { template: '<div><slot /></div>' },
          SheetHeader: { template: '<div><slot /></div>' },
          SheetTitle: { template: '<div><slot /></div>' },
          SheetDescription: { template: '<div><slot /></div>' },
          SheetFooter: { template: '<div><slot /></div>' },
          ScrollArea: { template: '<div><slot /></div>' },
          StaffMultiSelectDropdown: true,
          DatePicker: true,
          TimePicker: true,
        },
      },
    })

    await nextTick()

    // Reschedule button in schedule section
    const detailRescheduleBtn = wrapper.find('[data-testid="detail-reschedule-btn"]')
    expect(detailRescheduleBtn.exists()).toBe(true)
    expect(detailRescheduleBtn.text()).toContain('Reschedule')

    // Reschedule button is removed from footer
    const footerRescheduleBtn = wrapper.find('[data-testid="footer-reschedule-btn"]')
    expect(footerRescheduleBtn.exists()).toBe(false)
  })

  it('does NOT render Reschedule button for past cleanings (locked)', async () => {
    const { createJob } = useCleaningJobs()
    const job = createJob({
      listingId: 'lst-1',
      listingName: '5BR Pool Villa',
      scheduledAt: '2025-01-10T11:00:00+08:00',
      cleanerIds: ['staff-3'],
      cleanerNames: ['Made Surya'],
      teamName: 'Housekeeping',
      status: 'scheduled',
      priority: 'normal',
      durationMinutes: 120,
      notes: 'Past cleaning test',
      source: 'custom',
    })

    const pastEvent: CalendarEvent = {
      id: job.id,
      type: 'cleaning',
      title: 'Custom cleaning',
      listingId: 'lst-1',
      listingName: '5BR Pool Villa',
      start: '2025-01-10T11:00:00+08:00',
      end: '2025-01-10T13:00:00+08:00',
      status: 'scheduled',
      cleaningType: 'custom',
      cleaningTypeLabel: 'Custom cleaning',
    }

    const wrapper = mount(CalendarEventDetailDialog, {
      props: {
        open: true,
        event: pastEvent,
      },
      global: {
        components: { Button },
        stubs: {
          Icon: true,
          Badge: true,
          Switch: true,
          Sheet: { template: '<div><slot /></div>' },
          SheetContent: { template: '<div><slot /></div>' },
          SheetHeader: { template: '<div><slot /></div>' },
          SheetTitle: { template: '<div><slot /></div>' },
          SheetDescription: { template: '<div><slot /></div>' },
          SheetFooter: { template: '<div><slot /></div>' },
          ScrollArea: { template: '<div><slot /></div>' },
          StaffMultiSelectDropdown: true,
          DatePicker: true,
          TimePicker: true,
        },
      },
    })

    await nextTick()

    expect(wrapper.find('[data-testid="detail-reschedule-btn"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="footer-reschedule-btn"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="detail-lock-banner"]').exists()).toBe(true)
  })

  it('opens reschedule panel with DatePicker and TimePicker when Reschedule is clicked', async () => {
    const { createJob } = useCleaningJobs()
    const job = createJob({
      listingId: 'lst-1',
      listingName: '5BR Pool Villa',
      scheduledAt: '2028-10-15T11:00:00+08:00',
      cleanerIds: ['staff-3'],
      cleanerNames: ['Made Surya'],
      teamName: 'Housekeeping',
      status: 'scheduled',
      priority: 'normal',
      durationMinutes: 120,
      notes: 'Future cleaning test',
      source: 'custom',
    })

    const futureEvent: CalendarEvent = {
      id: job.id,
      type: 'cleaning',
      title: 'Custom cleaning',
      listingId: 'lst-1',
      listingName: '5BR Pool Villa',
      start: '2028-10-15T11:00:00+08:00',
      end: '2028-10-15T13:00:00+08:00',
      status: 'scheduled',
      cleaningType: 'custom',
      cleaningTypeLabel: 'Custom cleaning',
    }

    const wrapper = mount(CalendarEventDetailDialog, {
      props: {
        open: true,
        event: futureEvent,
      },
      global: {
        components: { Button },
        stubs: {
          Icon: true,
          Badge: true,
          Switch: true,
          Sheet: { template: '<div><slot /></div>' },
          SheetContent: { template: '<div><slot /></div>' },
          SheetHeader: { template: '<div><slot /></div>' },
          SheetTitle: { template: '<div><slot /></div>' },
          SheetDescription: { template: '<div><slot /></div>' },
          SheetFooter: { template: '<div><slot /></div>' },
          ScrollArea: { template: '<div><slot /></div>' },
          StaffMultiSelectDropdown: true,
          DatePicker: {
            props: ['modelValue', 'min'],
            template: '<div class="date-picker-stub">{{ modelValue }}</div>',
          },
          TimePicker: {
            props: ['modelValue'],
            template: '<div class="time-picker-stub">{{ modelValue }}</div>',
          },
        },
      },
    })

    await nextTick()

    // Panel is initially closed
    expect(wrapper.find('[data-testid="reschedule-panel"]').exists()).toBe(false)

    // Click Reschedule button
    await wrapper.find('[data-testid="detail-reschedule-btn"]').trigger('click')
    await nextTick()

    // Panel is now open
    const panel = wrapper.find('[data-testid="reschedule-panel"]')
    expect(panel.exists()).toBe(true)
    expect(panel.find('[data-testid="reschedule-date-picker"]').exists()).toBe(true)
    expect(panel.find('[data-testid="reschedule-time-picker"]').exists()).toBe(true)

    // Save button exists
    const saveBtn = wrapper.find('[data-testid="reschedule-save-btn"]')
    expect(saveBtn.exists()).toBe(true)
  })

  it('successfully updates scheduledAt when rescheduled', async () => {
    const { createJob, jobs } = useCleaningJobs()
    const job = createJob({
      listingId: 'lst-1',
      listingName: '5BR Pool Villa',
      scheduledAt: '2028-10-15T11:00:00+08:00',
      cleanerIds: ['staff-3'],
      cleanerNames: ['Made Surya'],
      teamName: 'Housekeeping',
      status: 'scheduled',
      priority: 'normal',
      durationMinutes: 120,
      notes: 'Future cleaning test',
      source: 'custom',
    })

    const futureEvent: CalendarEvent = {
      id: job.id,
      type: 'cleaning',
      title: 'Custom cleaning',
      listingId: 'lst-1',
      listingName: '5BR Pool Villa',
      start: '2028-10-15T11:00:00+08:00',
      end: '2028-10-15T13:00:00+08:00',
      status: 'scheduled',
      cleaningType: 'custom',
      cleaningTypeLabel: 'Custom cleaning',
    }

    const wrapper = mount(CalendarEventDetailDialog, {
      props: {
        open: true,
        event: futureEvent,
      },
      global: {
        components: { Button },
        stubs: {
          Icon: true,
          Badge: true,
          Switch: true,
          Sheet: { template: '<div><slot /></div>' },
          SheetContent: { template: '<div><slot /></div>' },
          SheetHeader: { template: '<div><slot /></div>' },
          SheetTitle: { template: '<div><slot /></div>' },
          SheetDescription: { template: '<div><slot /></div>' },
          SheetFooter: { template: '<div><slot /></div>' },
          ScrollArea: { template: '<div><slot /></div>' },
          StaffMultiSelectDropdown: true,
          DatePicker: {
            props: ['modelValue', 'min'],
            emits: ['update:modelValue'],
            template: '<button class="date-picker-btn" @click="$emit(\'update:modelValue\', \'2028-10-20\')">{{ modelValue }}</button>',
          },
          TimePicker: {
            props: ['modelValue'],
            emits: ['update:modelValue'],
            template: '<button class="time-picker-btn" @click="$emit(\'update:modelValue\', \'14:00\')">{{ modelValue }}</button>',
          },
        },
      },
    })

    await nextTick()

    // Open reschedule panel
    await wrapper.find('[data-testid="detail-reschedule-btn"]').trigger('click')
    await nextTick()

    // Select new date
    await wrapper.find('[data-testid="reschedule-date-picker"]').trigger('click')
    await nextTick()

    // Select new time
    await wrapper.find('[data-testid="reschedule-time-picker"]').trigger('click')
    await nextTick()

    // Click Save Schedule
    await wrapper.find('[data-testid="reschedule-save-btn"]').trigger('click')
    await nextTick()

    // Verify job in store was updated with new scheduledAt
    const updatedJob = jobs.value.find(j => j.id === futureEvent.id)
    expect(updatedJob).toBeDefined()
    expect(updatedJob!.scheduledAt).toBe('2028-10-20T14:00:00+08:00')

    // Panel is now closed
    expect(wrapper.find('[data-testid="reschedule-panel"]').exists()).toBe(false)
  })
})

describe('calendarEventDetailDialog - guest card', () => {
  const stubs = {
    Icon: true,
    Badge: { template: '<span><slot /></span>' },
    Switch: true,
    Sheet: { template: '<div><slot /></div>' },
    SheetContent: { template: '<div><slot /></div>' },
    SheetHeader: { template: '<div><slot /></div>' },
    SheetTitle: { template: '<div><slot /></div>' },
    SheetDescription: { template: '<div><slot /></div>' },
    SheetFooter: { template: '<div><slot /></div>' },
    ScrollArea: { template: '<div><slot /></div>' },
    StaffMultiSelectDropdown: true,
    DatePicker: true,
    TimePicker: true,
  }

  it('shows the departing guest, their stay, the checkout time and the time range for a check-out cleaning', async () => {
    const listing = listings.value.find(l => l.bookings.some(b => b.type !== 'block' && b.status !== 'cancelled' && b.status !== 'inquiry'))!
    const booking = listing.bookings.find(b => b.type !== 'block' && b.status !== 'cancelled' && b.status !== 'inquiry')!
    const { createJob } = useCleaningJobs()
    const job = createJob({
      listingId: listing.id,
      listingName: listing.name,
      scheduledAt: `${booking.checkOut}T10:00:00+08:00`,
      cleanerIds: [],
      cleanerNames: [],
      teamName: null,
      status: 'scheduled',
      priority: 'normal',
      durationMinutes: 300,
      notes: '',
      source: 'check_out',
    })
    const event: CalendarEvent = {
      id: job.id,
      type: 'cleaning',
      title: 'Check-out Cleaning',
      listingId: listing.id,
      listingName: listing.name,
      start: job.scheduledAt,
      end: `${booking.checkOut}T15:00:00+08:00`,
      source: 'custom',
      cleaningType: 'check_out',
      cleaningTypeLabel: 'Check-out Cleaning',
      colorIndex: 0,
    }

    const wrapper = mount(CalendarEventDetailDialog, {
      props: { open: true, event },
      global: { components: { Button }, stubs },
    })
    await nextTick()

    const card = wrapper.find('[data-testid="guest-in-stay"]')
    expect(card.exists()).toBe(true)
    expect(card.text()).toContain(booking.guestName)
    expect(card.text()).toContain(`${booking.nights} night`)
    expect(wrapper.find('[data-testid="guest-checkout-time"]').text())
      .toContain(listing.resources.basics.checkOutTime ?? '11:00')
    expect(wrapper.find('[data-testid="detail-time-range"]').text()).toContain('10:00 – 15:00')
    // The Source section and the Mark as done button are gone.
    expect(wrapper.text()).not.toContain('Source')
    expect(wrapper.text()).not.toContain('Mark as')
  })
})

describe('calendarEventDetailDialog - reschedule end time', () => {
  it('shows the end time, blocks an end before the start, and saves the new duration', async () => {
    const { createJob, jobs } = useCleaningJobs()
    const job = createJob({
      listingId: 'lst-1',
      listingName: '5BR Pool Villa',
      scheduledAt: '2028-10-15T11:00:00+08:00',
      cleanerIds: [],
      cleanerNames: [],
      teamName: null,
      status: 'scheduled',
      priority: 'normal',
      durationMinutes: 120,
      notes: '',
      source: 'daily',
    })
    const event: CalendarEvent = {
      id: job.id,
      type: 'cleaning',
      title: 'Daily cleaning',
      listingId: 'lst-1',
      listingName: '5BR Pool Villa',
      start: job.scheduledAt,
      end: '2028-10-15T13:00:00+08:00',
      cleaningType: 'daily',
      cleaningTypeLabel: 'Daily cleaning',
      colorIndex: 0,
    }
    const TimePicker = {
      props: ['modelValue'],
      emits: ['update:modelValue'],
      template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)">',
    }
    const wrapper = mount(CalendarEventDetailDialog, {
      props: { open: true, event },
      global: {
        components: { Button },
        stubs: {
          Icon: true,
          Badge: true,
          Switch: true,
          Label: { template: '<label><slot /></label>' },
          Sheet: { template: '<div><slot /></div>' },
          SheetContent: { template: '<div><slot /></div>' },
          SheetHeader: { template: '<div><slot /></div>' },
          SheetTitle: { template: '<div><slot /></div>' },
          SheetDescription: { template: '<div><slot /></div>' },
          SheetFooter: { template: '<div><slot /></div>' },
          ScrollArea: { template: '<div><slot /></div>' },
          StaffMultiSelectDropdown: true,
          DatePicker: true,
          TimePicker,
        },
      },
    })
    await nextTick()
    expect(wrapper.find('[data-testid="detail-schedule-section"]').text()).toContain('11:00 – 13:00')
    expect(wrapper.find('[data-testid="detail-status"]').text()).toContain('Not started')

    await wrapper.find('[data-testid="detail-reschedule-btn"]').trigger('click')
    const start = wrapper.find('[data-testid="reschedule-time-picker"]')
    const end = wrapper.find('[data-testid="reschedule-end-time-picker"]')
    expect((end.element as HTMLInputElement).value).toBe('13:00')

    // Moving the start keeps the two-hour length.
    await start.setValue('12:00')
    expect((end.element as HTMLInputElement).value).toBe('14:00')

    // An end before the start cannot be saved.
    await end.setValue('10:00')
    expect(wrapper.find('[data-testid="reschedule-end-time-error"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="reschedule-save-btn"]').attributes('disabled')).toBeDefined()

    await end.setValue('15:00')
    expect(wrapper.find('[data-testid="reschedule-end-time-error"]').exists()).toBe(false)
    await wrapper.find('[data-testid="reschedule-save-btn"]').trigger('click')
    const saved = jobs.value.find(j => j.id === job.id)!
    expect(saved.scheduledAt).toBe('2028-10-15T12:00:00+08:00')
    expect(saved.durationMinutes).toBe(180)
  })
})

describe('cleaningDisplayStatus', () => {
  const now = new Date('2026-09-27T09:00:00+08:00')
  it('collapses the stored status into Not started, Ongoing, Completed and Missed', () => {
    expect(cleaningDisplayStatus('scheduled', '2026-10-01T11:00:00+08:00', now)).toBe('not_started')
    expect(cleaningDisplayStatus('draft', '2026-10-01T11:00:00+08:00', now)).toBe('not_started')
    expect(cleaningDisplayStatus('confirmed', '2026-10-01T11:00:00+08:00', now)).toBe('not_started')
    expect(cleaningDisplayStatus('in_progress', '2026-09-27T11:00:00+08:00', now)).toBe('ongoing')
    expect(cleaningDisplayStatus('done', '2026-09-20T11:00:00+08:00', now)).toBe('completed')
    expect(cleaningDisplayStatus('missed', '2026-09-20T11:00:00+08:00', now)).toBe('missed')
    // Its date passed without being started: missed.
    expect(cleaningDisplayStatus('scheduled', '2026-09-20T11:00:00+08:00', now)).toBe('missed')
  })
})

describe('addMinutesKeepingOffset', () => {
  it('keeps the start offset so the chip reads local time', () => {
    expect(addMinutesKeepingOffset('2026-10-01T11:00:00+08:00', 120)).toBe('2026-10-01T13:00:00+08:00')
    expect(addMinutesKeepingOffset('2026-10-01T23:00:00+08:00', 90)).toBe('2026-10-02T00:30:00+08:00')
    expect(addMinutesKeepingOffset('2026-10-01T11:00:00Z', 30)).toBe('2026-10-01T11:30:00Z')
  })
})
