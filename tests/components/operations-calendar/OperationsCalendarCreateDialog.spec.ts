import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import OperationsCalendarCreateDialog from '~/components/operations-calendar/OperationsCalendarCreateDialog.vue'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'
import { Textarea } from '~/components/ui/textarea'

const passthrough = { template: '<div><slot /></div>' }
const STUBS = {
  Icon: true,
  Sheet: { props: ['open'], template: '<div v-if="open"><slot /></div>' },
  SheetContent: passthrough,
  SheetHeader: passthrough,
  SheetTitle: { template: '<h2 data-testid="title"><slot /></h2>' },
  SheetDescription: { template: '<p data-testid="description"><slot /></p>' },
  ScrollArea: passthrough,
  CleaningJobForm: { template: '<div data-testid="cleaning-form" />' },
  ListingPicker: true,
  DatePicker: true,
  Popover: passthrough,
  PopoverTrigger: passthrough,
  PopoverContent: passthrough,
  Label: passthrough,
}

function mountDialog(props: Record<string, unknown>) {
  return mount(OperationsCalendarCreateDialog, {
    props: { open: true, listingId: 'lst-1', ...props },
    global: { components: { Button, Input, Textarea, Tabs, TabsContent, TabsList, TabsTrigger }, stubs: STUBS },
  })
}

describe('operationsCalendarCreateDialog', () => {
  it('shows both tabs on the Operations Calendar', () => {
    const wrapper = mountDialog({ dayKey: '2026-10-05' })
    expect(wrapper.find('[data-testid="create-tabs"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="title"]').text()).toBe('Create operation')
    expect(wrapper.get('[data-testid="description"]').text()).toContain('on 2026-10-05')
  })

  it('is a cleaning-only form with only="cleaning"', () => {
    const wrapper = mountDialog({ only: 'cleaning', dayKey: '2026-10-05' })
    expect(wrapper.find('[data-testid="create-tabs"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="title"]').text()).toBe('New cleaning')
    expect(wrapper.find('[data-testid="cleaning-form"]').exists()).toBe(true)
  })

  it('is a task-only form with only="task", and leaves out the day when none is given', () => {
    const wrapper = mountDialog({ only: 'task' })
    expect(wrapper.find('[data-testid="create-tabs"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="title"]').text()).toBe('New task')
    expect(wrapper.find('[data-testid="cleaning-form"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="description"]').text()).not.toContain(' on ')
  })
})
