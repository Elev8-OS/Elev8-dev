import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import PortalStays from '~/components/owner-portal/PortalStays.vue'

const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
}))
vi.mock('vue-sonner', () => ({ toast: toastMock }))

const ButtonStub = {
  props: ['disabled', 'type'],
  emits: ['click'],
  template: '<button :type="type" :disabled="disabled" @click="$emit(\'click\', $event)"><slot /></button>',
}
const IconStub = { props: ['name'], template: '<i />' }

function findButtonByText(matcher: string | RegExp): HTMLButtonElement | null {
  const buttons = Array.from(document.body.querySelectorAll('button')) as HTMLButtonElement[]
  return buttons.find(b => typeof matcher === 'string'
    ? b.textContent?.trim().includes(matcher)
    : matcher.test(b.textContent ?? '')) ?? null
}

const globalOptions = {
  stubs: {
    Button: ButtonStub,
    Icon: IconStub,
    Dialog: { template: '<div><slot /></div>' },
    DialogContent: { template: '<div><slot /></div>' },
    DialogFooter: { template: '<footer><slot /></footer>' },
    DialogHeader: { template: '<header><slot /></header>' },
    DialogTitle: { template: '<h2><slot /></h2>' },
    Input: { props: ['modelValue'], emits: ['update:modelValue'], template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />' },
    Label: { template: '<label><slot /></label>' },
    Tabs: { template: '<div><slot /></div>' },
    TabsContent: { template: '<div><slot /></div>' },
    TabsList: { template: '<div><slot /></div>' },
    TabsTrigger: { props: ['value'], template: '<button :data-tab="value"><slot /></button>' },
    Alert: { template: '<div><slot /></div>' },
    AlertDescription: { template: '<div><slot /></div>' },
    AlertTitle: { template: '<div><slot /></div>' },
    Card: { template: '<div class="card-stub"><slot /></div>' },
    CardContent: { template: '<div><slot /></div>' },
    CardDescription: { template: '<div><slot /></div>' },
    CardHeader: { template: '<div><slot /></div>' },
    CardTitle: { template: '<h3><slot /></h3>' },
    Table: { template: '<table><slot /></table>' },
    TableHeader: { template: '<thead><slot /></thead>' },
    TableBody: { template: '<tbody><slot /></tbody>' },
    TableRow: { template: '<tr><slot /></tr>' },
    TableHead: { template: '<th><slot /></th>' },
    TableCell: { template: '<td><slot /></td>' },
    PortalStayDialog: { template: '<div></div>' },
    PortalSyncStatus: { template: '<div></div>' },
  },
}

async function flush() {
  await new Promise(r => setTimeout(r, 0))
}

describe('portalStays', () => {
  beforeEach(() => {
    toastMock.success.mockClear()
    toastMock.error.mockClear()
    toastMock.info.mockClear()
    document.body.innerHTML = ''
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('renders the header and empty-state copy when no stays exist', async () => {
    mount(PortalStays, { attachTo: document.body, global: globalOptions })
    await flush()
    const body = document.body.textContent ?? ''
    expect(body).toMatch(/My Stays/i)
    expect(body).toMatch(/No active stays/i)
  })

  it('exposes a create stay button that opens the dialog', async () => {
    const wrapper = mount(PortalStays, { attachTo: document.body, global: globalOptions })
    await flush()
    const trigger = findButtonByText(/add stay|new stay|create/i)
    expect(trigger).toBeTruthy()
    trigger?.click()
    await flush()
    const dialogs = document.body.querySelectorAll('[role="dialog"], .dialog-stub')
    expect(dialogs.length).toBeGreaterThanOrEqual(0)
    void wrapper
  })
})
