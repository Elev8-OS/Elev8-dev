import type { CalendarEvent } from '~/components/operations-calendar/data/operations-calendar'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import CalendarEventDetailDialog from '~/components/operations-calendar/CalendarEventDetailDialog.vue'
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
