import type { Listing } from '~/components/listings/data/listings'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { hasCleaningSteps } from '~/components/cleaning/data/cleaning-steps'
import { listings } from '~/components/listings/data/listings'
import ListingMaintenanceTab from '~/components/listings/ListingMaintenanceTab.vue'
import { isTaskCompleted } from '~/components/tasks/data/schema'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Card } from '~/components/ui/card'
import { useCleaningJobs } from '~/composables/useCleaningJobs'
import { useCleaningStepTemplates } from '~/composables/useCleaningStepTemplates'
import { useTaskDetail } from '~/composables/useTaskDetail'
import { useTaskStore } from '~/composables/useTaskStore'

const passthrough = { template: '<div><slot /></div>' }
const STUBS = {
  Icon: true,
  Progress: true,
  // A plain switch: each trigger sets the parent's v-model.
  Tabs: { props: ['modelValue'], emits: ['update:modelValue'], template: '<div><slot /></div>', provide() { return { setTab: (v: string) => (this as any).$emit('update:modelValue', v) } } },
  TabsList: passthrough,
  TabsTrigger: { props: ['value'], inject: ['setTab'], template: '<button type="button" @click="setTab(value)"><slot /></button>' },
  Dialog: { props: ['open'], template: '<div v-if="open"><slot /></div>' },
  DialogContent: passthrough,
  DialogHeader: passthrough,
  DialogTitle: passthrough,
  DialogDescription: passthrough,
  DialogFooter: passthrough,
  OperationsCalendarCreateDialog: { props: ['open', 'listingId', 'dayKey', 'only'], template: '<div v-if="open" :data-testid="\'create-sheet-\' + only" :data-listing="listingId" :data-day="dayKey" />' },
  TaskDetailSheet: { props: ['open', 'task'], template: '<div v-if="open" data-testid="task-sheet">{{ task?.title }}</div>' },
  CalendarEventDetailDialog: { props: ['open', 'event'], template: '<div v-if="open" data-testid="cleaning-sheet">{{ event?.id }}</div>' },
  StaffMultiSelectDropdown: true,
  // Emits as the real sheet does: a choice for its type, or a request to write custom steps.
  ListingTypeChecklistSheet: { props: ['open', 'type'], emits: ['save', 'editCustom', 'update:open'], template: '<div v-if="open" data-testid="checklist-sheet" :data-type="type"><button data-testid="checklist-sheet-default" @click="$emit(\'save\', type, null)" /><button data-testid="checklist-sheet-custom" @click="$emit(\'editCustom\', type)" /></div>' },
  NuxtLink: true,
  ListingCleaningStepsSheet: { props: ['open', 'steps'], emits: ['save', 'update:open'], template: '<div v-if="open" data-testid="steps-sheet"><button data-testid="sheet-save" @click="$emit(\'save\', [{ id: \'s\', title: \'All\', steps: [{ id: \'1\', label: \'Mop\' }] }])" /></div>' },
}
const COMPONENTS = { Badge, Button, Card }

/** A listing with at least one open task, so the default (Open) view has rows. */
function listingWithTasks() {
  const { tasks } = useTaskStore()
  return listings.value.find(l => tasks.value.some(t => t.listing === l.name && !isTaskCompleted(t)))!
}

function mountTab(listing = listingWithTasks()) {
  return mount(ListingMaintenanceTab, { props: { listing }, global: { components: COMPONENTS, stubs: STUBS } })
}

describe('listingMaintenanceTab', () => {
  it('lists this listing\'s open tasks from the Tasks store', () => {
    const listing = listingWithTasks()
    const { tasks } = useTaskStore()
    const expected = tasks.value.filter(t => t.listing === listing.name && !isTaskCompleted(t)).map(t => t.title).sort()
    const shown = mountTab(listing).findAll('[data-testid="task-row"]').map(r => r.text())
    expect(shown).toHaveLength(expected.length)
    for (const title of expected)
      expect(shown.some(t => t.includes(title))).toBe(true)
  })

  it('switches to completed tasks', async () => {
    const listing = listingWithTasks()
    const { tasks } = useTaskStore()
    const completed = tasks.value.filter(t => t.listing === listing.name && isTaskCompleted(t))
    const wrapper = mountTab(listing)
    await wrapper.get('[data-testid="tasks-completed"]').trigger('click')
    await nextTick()
    expect(wrapper.findAll('[data-testid="task-row"]')).toHaveLength(completed.length)
  })

  it('opens the task detail sheet', async () => {
    const wrapper = mountTab()
    const row = wrapper.findAll('[data-testid="task-row"]')[0]!
    await row.trigger('click')
    await nextTick()
    expect(useTaskDetail().selectedTask.value).not.toBeNull()
    expect(wrapper.get('[data-testid="task-sheet"]').text()).toBe(useTaskDetail().selectedTask.value!.title)
    useTaskDetail().closeTaskDetail()
  })

  it('opens the create sheet as a task-only form for this listing, with no due date', async () => {
    const listing = listingWithTasks()
    const wrapper = mountTab(listing)
    await wrapper.findAll('button').find(b => b.text() === 'New task')!.trigger('click')
    const sheet = wrapper.get('[data-testid="create-sheet-task"]')
    expect(sheet.attributes('data-listing')).toBe(listing.id)
    expect(sheet.attributes('data-day')).toBeUndefined()
  })

  it('splits this listing\'s cleaning jobs into upcoming and past, and opens one', async () => {
    const { jobsForListing } = useCleaningJobs()
    const listing = listings.value.find(l => jobsForListing(l.id).length > 0)!
    const total = jobsForListing(listing.id).length
    const wrapper = mountTab(listing)
    const upcoming = wrapper.findAll('[data-testid="cleaning-row"]').length
    await wrapper.get('[data-testid="cleanings-past"]').trigger('click')
    await nextTick()
    const past = wrapper.findAll('[data-testid="cleaning-row"]')
    expect(upcoming + past.length).toBe(total)
    const row = past[0] ?? (await (async () => {
      await wrapper.get('[data-testid="cleanings-upcoming"]').trigger('click')
      return wrapper.findAll('[data-testid="cleaning-row"]')[0]!
    })())
    await row.trigger('click')
    await nextTick()
    expect(wrapper.find('[data-testid="cleaning-sheet"]').exists()).toBe(true)
  })

  describe('checklists', () => {
    /** No company default for any type, so a listing without overrides has no checklist. */
    function withoutCompanyDefaults(run: () => void) {
      const { typeDefaults } = useCleaningStepTemplates()
      const saved = typeDefaults.value
      typeDefaults.value = {}
      try {
        run()
      }
      finally {
        typeDefaults.value = saved
      }
    }
    const lst = (id: string) => listings.value.find(l => l.id === id)!

    it('shows each type\'s checklist and where it comes from', () => {
      // lst-1 overrides check-out with Deep clean (seed).
      const wrapper = mountTab(lst('lst-1'))
      expect(wrapper.get('[data-testid="type-checklist-check_out"]').text()).toContain('Deep clean')
      expect(wrapper.get('[data-testid="type-checklist-origin-check_out"]').text()).toBe('Override')
      expect(wrapper.get('[data-testid="type-checklist-daily"]').text()).toContain('Daily refresh')
      expect(wrapper.get('[data-testid="type-checklist-origin-daily"]').text()).toBe('Default')
    })

    it('leaves a listing with no own steps open, on the company defaults', () => {
      const wrapper = mountTab(listings.value.find(l => !hasCleaningSteps(l))!)
      expect(wrapper.find('[data-testid="cleaning-steps-required"]').exists()).toBe(false)
      expect(wrapper.get('[data-testid="new-cleaning"]').attributes('disabled')).toBeUndefined()
      expect(wrapper.get('[data-testid="configure-default-cleaning"]').attributes('disabled')).toBeUndefined()
    })

    it('locks New cleaning and the default cleaning when no type has a checklist', () => {
      withoutCompanyDefaults(() => {
        const wrapper = mountTab(listings.value.find(l => !hasCleaningSteps(l))!)
        expect(wrapper.find('[data-testid="cleaning-steps-required"]').exists()).toBe(true)
        expect(wrapper.get('[data-testid="new-cleaning"]').attributes('disabled')).toBeDefined()
        expect(wrapper.get('[data-testid="configure-default-cleaning"]').attributes('disabled')).toBeDefined()
        expect(wrapper.get('[data-testid="type-checklist-daily"]').text()).toContain('No checklist')
      })
    })

    it('saves a type\'s choice from its sheet, back to the default', async () => {
      const wrapper = mountTab(lst('lst-1'))
      await wrapper.get('[data-testid="type-checklist-check_out"]').trigger('click')
      expect(wrapper.get('[data-testid="checklist-sheet"]').attributes('data-type')).toBe('check_out')
      await wrapper.get('[data-testid="checklist-sheet-default"]').trigger('click')
      const updated = wrapper.emitted('update')![0]![0] as Listing
      expect(updated.maintenance.cleaningTemplates).toEqual({})
    })

    it('saves custom steps and points the type that asked for them at them', async () => {
      const wrapper = mountTab(lst('lst-2'))
      await wrapper.get('[data-testid="type-checklist-daily"]').trigger('click')
      await wrapper.get('[data-testid="checklist-sheet-custom"]').trigger('click')
      await nextTick()
      await wrapper.get('[data-testid="sheet-save"]').trigger('click')
      const updated = wrapper.emitted('update')![0]![0] as Listing
      expect(updated.maintenance.cleaningTemplates).toEqual({ daily: 'custom' })
      expect(updated.maintenance.cleaningSteps).toEqual([{ id: 's', title: 'All', steps: [{ id: '1', label: 'Mop' }] }])
    })

    it('shows the company schedule for new bookings until the listing overrides it', () => {
      const plain = { ...lst('lst-2'), maintenance: { ...lst('lst-2').maintenance, defaultCleaningSchedule: undefined } }
      const wrapper = mountTab(plain)
      expect(wrapper.get('[data-testid="default-cleaning-origin"]').text()).toBe('Default')
      expect(wrapper.find('[data-testid="default-cleaning-reset"]').exists()).toBe(false)
    })

    it('resets an overridden schedule to the company default', async () => {
      const listing = listings.value.find(l => l.maintenance.defaultCleaningSchedule)!
      const wrapper = mountTab(listing)
      expect(wrapper.get('[data-testid="default-cleaning-origin"]').text()).toBe('Override')
      await wrapper.get('[data-testid="default-cleaning-reset"]').trigger('click')
      const updated = wrapper.emitted('update')![0]![0] as Listing
      expect(updated.maintenance.defaultCleaningSchedule).toBeUndefined()
    })
  })

  it('opens the Operations Calendar create sheet for this listing, today', async () => {
    const listing = listings.value.find(l => hasCleaningSteps(l))!
    const wrapper = mountTab(listing)
    await wrapper.get('[data-testid="new-cleaning"]').trigger('click')
    const sheet = wrapper.get('[data-testid="create-sheet-cleaning"]')
    expect(sheet.attributes('data-listing')).toBe(listing.id)
    expect(sheet.attributes('data-day')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
