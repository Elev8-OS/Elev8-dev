import type { Task } from '~/components/tasks/data/schema'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TaskDetailSheet from '~/components/tasks/TaskDetailSheet.vue'
import { useCurrentDashboardUser } from '~/composables/useCurrentDashboardUser'

const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }))
vi.mock('vue-sonner', () => ({ toast: toastMock }))

const slot = { template: '<div><slot /></div>' }
const stubs = {
  Icon: { props: ['name'], template: '<i :data-icon="name" />' },
  Button: { props: ['variant', 'size', 'disabled'], template: '<button :disabled="disabled"><slot /></button>' },
  Badge: { template: '<span><slot /></span>' },
  Sheet: { props: ['open'], template: '<div v-if="open"><slot /></div>' },
  SheetContent: slot,
  SheetHeader: slot,
  SheetTitle: { template: '<h2><slot /></h2>' },
  ScrollArea: slot,
  Dialog: { props: ['open'], template: '<div v-if="open"><slot /></div>' },
  DialogContent: slot,
  DialogHeader: slot,
  DialogTitle: slot,
  DialogDescription: slot,
  DialogFooter: slot,
  Input: { template: '<input />' },
  Label: { template: '<label><slot /></label>' },
  Slider: { template: '<div />' },
}

const task: Task = {
  id: 'TASK-003',
  title: 'Water pump service',
  status: 'in progress',
  priority: 'high',
  listing: 'Apartments Pererenan Public',
  statusUpdates: [
    { date: '2026-08-26T01:00:00Z', actor: { name: 'Kadek Dwi Prayoga', kind: 'staff' }, kind: 'created', progress: 0 },
    {
      date: '2026-08-26T05:00:00Z',
      actor: { name: 'Kadek Mia Pratiwi', kind: 'staff' },
      kind: 'progress',
      progress: 31,
      note: 'we already spoken with pak Andrew, and will discuss it again with ibu Inka to confirm what she would like',
    },
    { date: '2026-08-26T09:00:00Z', actor: { name: 'Kadek Dwi Prayoga', kind: 'staff' }, kind: 'completed', progress: 100 },
    { date: '2026-08-26T02:00:00Z', actor: { name: 'Wayan Sari', kind: 'owner' }, note: 'approved the cost of IDR 750,000', progress: 0 },
  ],
}

function text(wrapper: ReturnType<typeof mount>) {
  return wrapper.text().replace(/\s+/g, ' ')
}

beforeEach(() => {
  useCurrentDashboardUser().setCurrentUserId('user-1')
})

describe('task timeline', () => {
  it('reads each entry as a sentence about who did what', () => {
    const wrapper = mount(TaskDetailSheet, { props: { task, open: true }, global: { stubs } })
    const t = text(wrapper)
    expect(t).toContain('Kadek Dwi Prayoga has created a new task for Apartments Pererenan Public')
    expect(t).toContain('Kadek Mia Pratiwi is 31% through the task')
    expect(t).toContain('Kadek Dwi Prayoga has completed the task')
  })

  it('shows what the person wrote under the sentence', () => {
    const wrapper = mount(TaskDetailSheet, { props: { task, open: true }, global: { stubs } })
    const notes = wrapper.findAll('[data-testid="timeline-note"]').map(n => n.text())
    expect(notes).toEqual([
      'we already spoken with pak Andrew, and will discuss it again with ibu Inka to confirm what she would like',
    ])
  })

  it('keeps an entry with no kind reading as its own note', () => {
    const wrapper = mount(TaskDetailSheet, { props: { task, open: true }, global: { stubs } })
    expect(text(wrapper)).toContain('Wayan Sari approved the cost of IDR 750,000')
  })

  it('names the status with its label', () => {
    const wrapper = mount(TaskDetailSheet, { props: { task, open: true }, global: { stubs } })
    expect(text(wrapper)).toContain('In progress')
  })
})
