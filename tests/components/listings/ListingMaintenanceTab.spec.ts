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

  it('locks New cleaning and the default cleaning for a listing without steps', () => {
    const listing = listings.value.find(l => !hasCleaningSteps(l))!
    const wrapper = mountTab(listing)
    expect(wrapper.find('[data-testid="cleaning-steps-required"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="new-cleaning"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="configure-default-cleaning"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="edit-cleaning-steps"]').text()).toContain('Set up')
  })

  it('leaves them open for a listing with steps', () => {
    const listing = listings.value.find(l => hasCleaningSteps(l))!
    const wrapper = mountTab(listing)
    expect(wrapper.find('[data-testid="cleaning-steps-required"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="new-cleaning"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.get('[data-testid="configure-default-cleaning"]').attributes('disabled')).toBeUndefined()
  })

  it('saves steps from the sheet onto the listing', async () => {
    const listing = listings.value.find(l => !hasCleaningSteps(l))!
    const wrapper = mountTab(listing)
    await wrapper.get('[data-testid="edit-cleaning-steps"]').trigger('click')
    await wrapper.get('[data-testid="sheet-save"]').trigger('click')
    const updated = wrapper.emitted('update')![0]![0] as typeof listing
    expect(hasCleaningSteps(updated)).toBe(true)
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
