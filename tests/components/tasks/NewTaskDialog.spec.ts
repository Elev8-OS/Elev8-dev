import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import CreateTaskDialog from '~/components/inbox/CreateTaskDialog.vue'
import { readableTimestamp, roomIdFor } from '~/components/inbox/data/internal'
import NewTaskDialog from '~/components/tasks/NewTaskDialog.vue'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Textarea } from '~/components/ui/textarea'
import { useCurrentDashboardUser } from '~/composables/useCurrentDashboardUser'
import { useInternalInbox } from '~/composables/useInternalInbox'
import { useMessageActions } from '~/composables/useMessageActions'
import { useTaskStore } from '~/composables/useTaskStore'

const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }))
vi.mock('vue-sonner', () => ({ toast: toastMock }))

const HOUSEKEEPING_LST1 = roomIdFor('lst-1', 'role-housekeeping')
const LISTING = '5BR Pool the R Villa Luwa – Serene near Canggu'

const slot = { template: '<div><slot /></div>' }
const components = {
  // Under the auto-import name, or the inbox wrapper renders a bare tag.
  TasksNewTaskDialog: NewTaskDialog,
  Input,
  Label,
  Textarea,
}
const stubs = {
  Icon: { props: ['name'], template: '<i :data-icon="name" />' },
  // Re-emitting click would double-fire: the parent's handler falls through.
  Button: { props: ['variant', 'size', 'disabled'], template: '<button :disabled="disabled"><slot /></button>' },
  Badge: slot,
  Checkbox: { template: '<span />' },
  Dialog: { props: ['open'], template: '<div v-if="open"><slot /></div>' },
  DialogContent: slot,
  DialogHeader: slot,
  DialogTitle: { template: '<h2><slot /></h2>' },
  DialogDescription: { template: '<p><slot /></p>' },
  DialogFooter: slot,
  Popover: slot,
  PopoverTrigger: slot,
  PopoverContent: slot,
  Command: slot,
  CommandInput: { template: '<input data-command-input />' },
  CommandList: slot,
  CommandEmpty: slot,
  CommandGroup: slot,
  CommandItem: slot,
  Select: slot,
  SelectTrigger: slot,
  SelectValue: slot,
  SelectContent: slot,
  SelectItem: slot,
}

function mountWith(component: unknown, props: Record<string, unknown> = {}) {
  return mount(component as never, { props, global: { components, stubs } })
}

function createButton(wrapper: ReturnType<typeof mount>) {
  return wrapper.findAll('button').find(b => b.text() === 'Create Task')!
}

beforeEach(() => {
  useCurrentDashboardUser().setCurrentUserId('user-1')
  toastMock.success.mockClear()
})

describe('new task form', () => {
  it('asks for Instructions only: no Title, no Description', () => {
    const wrapper = mountWith(NewTaskDialog, { open: true })
    const labels = wrapper.findAll('label').map(l => l.text().replace(/\s+/g, ' ').trim())
    expect(labels).toContain('Instructions *')
    expect(labels.some(l => l.startsWith('Title'))).toBe(false)
    expect(labels).not.toContain('Description')
  })

  it('keeps Create disabled until there are instructions', async () => {
    const wrapper = mountWith(NewTaskDialog, { open: true })
    expect(createButton(wrapper).attributes('disabled')).toBeDefined()
    await wrapper.find('#new-task-instructions').setValue('Fix the pool pump')
    expect(createButton(wrapper).attributes('disabled')).toBeUndefined()
  })

  it('titles the task from the first line and stores the whole text as instructions', async () => {
    const { tasks } = useTaskStore()
    const before = tasks.value.length
    const wrapper = mountWith(NewTaskDialog, { 'open': true, 'onUpdate:open': () => {} })
    await wrapper.find('#new-task-instructions').setValue('Fix the pool pump\nTurn the breaker off before opening the housing.')
    await createButton(wrapper).trigger('click')

    expect(tasks.value).toHaveLength(before + 1)
    const created = tasks.value.find(t => t.title === 'Fix the pool pump')!
    expect(created.description).toBe('Fix the pool pump\nTurn the breaker off before opening the housing.')
  })

  it('fills in from a prefill when it opens', async () => {
    const wrapper = mountWith(NewTaskDialog, { open: false })
    await wrapper.setProps({
      open: true,
      prefill: { instructions: 'AC is warm\nCheck the filter.', listing: LISTING, images: ['blob:ac'] },
    })
    await nextTick()
    expect((wrapper.find('#new-task-instructions').element as HTMLTextAreaElement).value).toBe('AC is warm\nCheck the filter.')
    expect(wrapper.text()).toContain(LISTING)
    expect(wrapper.find('img[src="blob:ac"]').exists()).toBe(true)
  })

  it('clears itself when it closes, so the next task starts empty', async () => {
    const wrapper = mountWith(NewTaskDialog, { open: false })
    await wrapper.setProps({ open: true, prefill: { instructions: 'AC is warm' } })
    await nextTick()
    await wrapper.setProps({ open: false, prefill: null })
    await wrapper.setProps({ open: true })
    await nextTick()
    expect((wrapper.find('#new-task-instructions').element as HTMLTextAreaElement).value).toBe('')
  })
})

describe('creating a task from messages', () => {
  const refs = [
    {
      sourceId: 'm1',
      sourceKind: 'internal' as const,
      roomId: HOUSEKEEPING_LST1,
      contextLabel: 'Villa Luwa',
      senderName: 'Ketut Antara',
      senderLabel: 'Housekeeping',
      content: 'Pool pump is making a grinding noise.',
      timestamp: '2026-08-26T09:15:00Z',
      mediaUrl: 'blob:pump',
    },
  ]

  async function openFromRoom() {
    const wrapper = mountWith(CreateTaskDialog)
    useMessageActions().openTask({
      refs,
      listingName: LISTING,
      assignee: 'housekeeping',
    })
    await nextTick()
    await nextTick()
    return wrapper
  }

  it('opens the same New Task form as the Tasks page', async () => {
    const wrapper = await openFromRoom()
    expect(wrapper.findComponent(NewTaskDialog).exists()).toBe(true)
    expect(wrapper.text()).toContain('New Task')
    expect(wrapper.text()).toContain('Built from 1 message')
    expect(wrapper.text()).not.toContain('the room will be told')
  })

  it('puts the messages into Instructions with a readable time, and their photos into Images', async () => {
    const wrapper = await openFromRoom()
    const instructions = (wrapper.find('#new-task-instructions').element as HTMLTextAreaElement).value
    expect(instructions.split('\n')[0]).toBe('Pool pump is making a grinding noise.')
    expect(instructions).toContain('(Ketut Antara, Housekeeping,')
    expect(instructions).toContain(readableTimestamp('2026-08-26T09:15:00Z'))
    expect(instructions).not.toContain('2026-08-26T09:15:00Z')
    expect(wrapper.find('img[src="blob:pump"]').exists()).toBe(true)
  })

  it('creates the task and closes, without posting into the room', async () => {
    const internal = useInternalInbox()
    const { tasks } = useTaskStore()
    const roomBefore = internal.messagesFor(HOUSEKEEPING_LST1).length
    const wrapper = await openFromRoom()

    await createButton(wrapper).trigger('click')
    await flushPromises()

    const created = tasks.value.find(t => t.title === 'Pool pump is making a grinding noise.')!
    expect(created).toBeTruthy()
    expect(created.listing).toBe(LISTING)
    expect(created.assignee).toBe('housekeeping')
    expect(created.assigneeType).toBe('role')
    expect(created.description).toContain('Pool pump is making a grinding noise.')
    expect(created.images).toEqual(['blob:pump'])

    // Nothing is posted back into the room.
    expect(internal.messagesFor(HOUSEKEEPING_LST1)).toHaveLength(roomBefore)
    expect(useMessageActions().taskOpen.value).toBe(false)
  })
})
