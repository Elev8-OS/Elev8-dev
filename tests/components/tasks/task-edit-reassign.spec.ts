import type { Task } from '~/components/tasks/data/schema'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { listings } from '~/components/listings/data/listings'
import { canEditTask, canReassignTask, reassignTargets } from '~/components/tasks/data/task-permissions'
import { timelineSentence } from '~/components/tasks/data/timeline'
import NewTaskDialog from '~/components/tasks/NewTaskDialog.vue'
import TaskDetailSheet from '~/components/tasks/TaskDetailSheet.vue'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Textarea } from '~/components/ui/textarea'
import { useCurrentDashboardUser } from '~/composables/useCurrentDashboardUser'
import { useTaskStore } from '~/composables/useTaskStore'
import { useUsers } from '~/composables/useUsers'

const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }))
vi.mock('vue-sonner', () => ({ toast: toastMock }))

const LUWA = '5BR Pool the R Villa Luwa – Serene near Canggu'

/** Made Wirawan (a manager) created it and gave it to Komang Juliantara, who is 20% in. */
function handover(over: Partial<Task> = {}): Task {
  return {
    id: 'T-HAND',
    title: 'Check the outdoor shower drain',
    status: 'in progress',
    assignee: 'komang-juliantara',
    assigneeType: 'person',
    priority: 'medium',
    listing: LUWA,
    progress: 20,
    statusUpdates: [
      { date: '2026-10-12T01:00:00Z', actor: { name: 'Made Wirawan', kind: 'staff' }, kind: 'created', progress: 0 },
      { date: '2026-10-12T04:00:00Z', actor: { name: 'Komang Juliantara', kind: 'staff' }, kind: 'progress', progress: 20 },
    ],
    ...over,
  }
}

function seed(task: Task) {
  const { tasks } = useTaskStore()
  tasks.value = [task, ...tasks.value.filter(t => t.id !== task.id)]
}

function stored(id = 'T-HAND'): Task {
  return useTaskStore().tasks.value.find(t => t.id === id)!
}

const juli = { name: 'Komang Juliantara', roleId: 'role-guest-experience-manager' as const }
const creator = { name: 'Ni Putu Sari', roleId: 'role-housekeeping-manager' as const }
const bystander = { name: 'Wayan Adi', roleId: 'role-listing-manager' as const }
const manager = { name: 'Made Wirawan', roleId: 'role-general-manager' as const }

beforeEach(() => {
  useCurrentDashboardUser().setCurrentUserId('user-1')
  toastMock.success.mockClear()
})

describe('who may edit and reassign', () => {
  const byPutu = handover({
    statusUpdates: [{ date: '2026-10-12T01:00:00Z', actor: { name: 'Ni Putu Sari', kind: 'staff' }, kind: 'created' }],
  })

  it('lets the creator and managers edit, not the assignee', () => {
    expect(canEditTask(byPutu, creator)).toBe(true)
    expect(canEditTask(byPutu, manager)).toBe(true)
    expect(canEditTask(byPutu, juli)).toBe(false)
  })

  it('lets the assignee, the creator and managers reassign, not anyone else', () => {
    expect(canReassignTask(byPutu, juli)).toBe(true)
    expect(canReassignTask(byPutu, creator)).toBe(true)
    expect(canReassignTask(byPutu, manager)).toBe(true)
    expect(canReassignTask(byPutu, bystander)).toBe(false)
  })

  it('treats a role task as anyone\'s to pass on', () => {
    expect(canReassignTask({ ...byPutu, assignee: 'maintenance', assigneeType: 'role' }, bystander)).toBe(true)
    expect(canReassignTask({ ...byPutu, assignee: undefined, assigneeType: undefined }, bystander)).toBe(true)
  })

  it('locks a completed task', () => {
    const done = { ...byPutu, status: 'completed' as const }
    expect(canEditTask(done, manager)).toBe(false)
    expect(canReassignTask(done, manager)).toBe(false)
  })

  it('offers every role and only the people with access to the listing', () => {
    const { users } = useUsers()
    const targets = reassignTargets(handover(), { users: users.value, listings: listings.value }).map(o => o.value)
    expect(targets).toContain('maintenance')
    expect(targets).toContain('made-surya')
    // Wayan Adi's listings do not include Villa Luwa.
    expect(targets).not.toContain('wayan-adi')
    // The current assignee is not offered.
    expect(targets).not.toContain('komang-juliantara')
  })
})

describe('timeline sentences', () => {
  it('lists what an edit changed', () => {
    expect(timelineSentence({ kind: 'edited', changes: ['title'] }, {})).toBe('changed the title')
    expect(timelineSentence({ kind: 'edited', changes: ['title', 'priority', 'due date'] }, {})).toBe('changed the title, priority and due date')
  })

  it('names who a task went to, or that the actor took it', () => {
    expect(timelineSentence({ kind: 'reassigned', assignedTo: 'Made Surya', actor: { name: 'Komang Juliantara' } }, {})).toBe('reassigned the task to Made Surya')
    expect(timelineSentence({ kind: 'reassigned', assignedTo: 'Komang Juliantara', actor: { name: 'Komang Juliantara' } }, {})).toBe('took over the task')
  })
})

describe('task store', () => {
  it('logs only the fields an edit changed, and nothing for no change', () => {
    seed(handover())
    const { editTask } = useTaskStore()
    expect(editTask('T-HAND', { title: 'Check the outdoor shower drain', priority: 'medium' })).toEqual([])
    expect(stored().statusUpdates).toHaveLength(2)

    expect(editTask('T-HAND', { title: 'Clear the outdoor shower drain', priority: 'high' })).toEqual(['title', 'priority'])
    const last = stored().statusUpdates!.at(-1)!
    expect(last).toMatchObject({ kind: 'edited', changes: ['title', 'priority'], actor: { name: 'Komang Juliantara' } })
    expect(stored().title).toBe('Clear the outdoor shower drain')
  })

  it('reassigns with a reason and keeps status and progress', () => {
    seed(handover())
    const { reassignTask } = useTaskStore()
    const surya = { value: 'made-surya', label: 'Made Surya', type: 'person' as const }
    expect(reassignTask('T-HAND', surya, '   ')).toBe(false)
    expect(stored().assignee).toBe('komang-juliantara')

    expect(reassignTask('T-HAND', surya, 'Made is on site today.')).toBe(true)
    const task = stored()
    expect(task).toMatchObject({ assignee: 'made-surya', assigneeType: 'person', status: 'in progress', progress: 20 })
    expect(task.statusUpdates!.at(-1)).toMatchObject({ kind: 'reassigned', assignedTo: 'Made Surya', note: 'Made is on site today.' })
  })
})

const slot = { template: '<div><slot /></div>' }
const components = { TasksNewTaskDialog: NewTaskDialog, Input, Label, Textarea }
const stubs = {
  Icon: { props: ['name'], template: '<i :data-icon="name" />' },
  Button: { props: ['variant', 'size', 'disabled'], template: '<button :disabled="disabled"><slot /></button>' },
  Badge: slot,
  Checkbox: { template: '<span />' },
  Sheet: { props: ['open'], template: '<div v-if="open"><slot /></div>' },
  SheetContent: slot,
  SheetHeader: slot,
  SheetTitle: { template: '<h2><slot /></h2>' },
  ScrollArea: slot,
  Slider: { template: '<div />' },
  Dialog: { props: ['open'], template: '<div v-if="open"><slot /></div>' },
  DialogContent: slot,
  DialogHeader: slot,
  DialogTitle: { template: '<h2><slot /></h2>' },
  DialogDescription: { template: '<p><slot /></p>' },
  DialogFooter: slot,
  Popover: slot,
  PopoverTrigger: slot,
  PopoverContent: slot,
  Tabs: slot,
  TabsList: slot,
  TabsTrigger: slot,
  Command: slot,
  CommandInput: { template: '<input data-command-input />' },
  CommandList: slot,
  CommandEmpty: slot,
  CommandGroup: slot,
  CommandItem: { emits: ['select'], template: '<div v-bind="$attrs" @click="$emit(\'select\')"><slot /></div>' },
  Select: slot,
  SelectTrigger: slot,
  SelectValue: slot,
  SelectContent: slot,
  SelectItem: slot,
}

function mountSheet(task: Task) {
  seed(task)
  return mount(TaskDetailSheet, { props: { task, open: true }, global: { components, stubs } })
}

function button(wrapper: ReturnType<typeof mount>, label: string) {
  return wrapper.findAll('button').find(b => b.text() === label)
}

describe('detail sheet', () => {
  it('shows Reassign but not Edit to the assignee', () => {
    const wrapper = mountSheet(handover())
    expect(wrapper.find('[data-testid="task-reassign"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="task-edit"]').exists()).toBe(false)
  })

  it('shows Edit to the creator', () => {
    useCurrentDashboardUser().setCurrentUserId('user-5')
    const wrapper = mountSheet(handover())
    expect(wrapper.find('[data-testid="task-edit"]').exists()).toBe(true)
  })

  it('hides both on a completed task', () => {
    const wrapper = mountSheet(handover({ status: 'completed' }))
    expect(wrapper.find('[data-testid="task-reassign"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="task-edit"]').exists()).toBe(false)
  })

  it('needs a person and a reason before it reassigns', async () => {
    const wrapper = mountSheet(handover())
    await wrapper.find('[data-testid="task-reassign"]').trigger('click')
    const submit = () => wrapper.find('[data-testid="task-reassign-submit"]')

    expect(wrapper.find('[data-testid="reassign-option-wayan-adi"]').exists()).toBe(false)
    await wrapper.find('[data-testid="reassign-option-made-surya"]').trigger('click')
    expect(submit().attributes('disabled')).toBeDefined()

    await wrapper.find('#task-reassign-reason').setValue('Made is on site today.')
    expect(submit().attributes('disabled')).toBeUndefined()
    await submit().trigger('click')

    expect(stored()).toMatchObject({ assignee: 'made-surya', progress: 20 })
    // The new assignee and the creator are told.
    expect(toastMock.success).toHaveBeenCalledWith('Reassigned to Made Surya. Made Surya and Made Wirawan are notified.')
  })

  it('lets anyone take a role task without a reason', async () => {
    const wrapper = mountSheet(handover({ assignee: 'maintenance', assigneeType: 'role' }))
    await wrapper.find('[data-testid="task-take"]').trigger('click')
    expect(stored()).toMatchObject({ assignee: 'komang-juliantara', assigneeType: 'person' })
    expect(stored().statusUpdates!.at(-1)).toMatchObject({ kind: 'reassigned', assignedTo: 'Komang Juliantara', note: 'Taken from Maintenance.' })
  })

  it('reads a handover in the timeline with the reason under it', () => {
    const wrapper = mountSheet(handover({
      statusUpdates: [
        ...handover().statusUpdates!,
        { date: '2026-10-12T06:00:00Z', actor: { name: 'Komang Juliantara', kind: 'staff' }, kind: 'reassigned', assignedTo: 'Made Surya', note: 'Made is on site today.' },
      ],
    }))
    expect(wrapper.text().replace(/\s+/g, ' ')).toContain('Komang Juliantara reassigned the task to Made Surya')
    expect(wrapper.findAll('[data-testid="timeline-note"]').map(n => n.text())).toContain('Made is on site today.')
  })
})

describe('edit task form', () => {
  async function openEdit(task: Task) {
    seed(task)
    const wrapper = mount(NewTaskDialog as never, {
      props: { 'open': false, 'onUpdate:open': () => {} },
      global: { components, stubs },
    })
    await wrapper.setProps({ open: true, task } as never)
    await nextTick()
    return wrapper
  }

  it('opens filled in, without Assignee, Repeat or owner approval', async () => {
    const wrapper = await openEdit(handover())
    expect(wrapper.find('h2').text()).toBe('Edit Task')
    expect((wrapper.find('#new-task-title').element as HTMLInputElement).value).toBe('Check the outdoor shower drain')
    const labels = wrapper.findAll('label').map(l => l.text().trim())
    expect(labels).not.toContain('Assignee')
    expect(labels).not.toContain('Repeat')
    expect(wrapper.text()).not.toContain('Needs owner approval')
  })

  it('saves only once something changed, and logs it', async () => {
    const wrapper = await openEdit(handover())
    const save = () => button(wrapper, 'Save Changes')!
    expect(save().attributes('disabled')).toBeDefined()

    await wrapper.find('#new-task-title').setValue('Clear the outdoor shower drain')
    expect(save().attributes('disabled')).toBeUndefined()
    await save().trigger('click')

    expect(stored()).toMatchObject({ title: 'Clear the outdoor shower drain', assignee: 'komang-juliantara', progress: 20 })
    expect(stored().statusUpdates!.at(-1)).toMatchObject({ kind: 'edited', changes: ['title'] })
  })

  it('locks the listing once an owner was asked to approve a quote', async () => {
    const wrapper = await openEdit(handover({ ownerApprovalRequired: true, ownerApprovalStatus: 'pending' }))
    expect(wrapper.text()).toContain('the listing cannot change')
  })
})
