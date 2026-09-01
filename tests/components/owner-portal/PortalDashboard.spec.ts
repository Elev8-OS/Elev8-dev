import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import PortalDashboard from '~/components/owner-portal/PortalDashboard.vue'

const ownerPortalStub = {
  currentOwner: { id: 'own-1', name: 'Wayan Sari', email: 'wayan@example.com' },
  selectedPropertyId: { value: null },
  assignedProperties: { value: [{ id: 'lst-1', name: '5BR Pool the R Villa Luwa – Serene near Canggu' }] },
  propertyMetrics: { value: null },
  dashboardMetricDescriptors: { value: [] },
  ownerUseNights: { value: 0 },
  canViewDashboardField: () => false,
}
vi.mock('~/composables/useOwnerPortal', () => ({
  useOwnerPortal: () => ownerPortalStub,
}))
vi.mock('~/composables/useOwnerStays', () => ({
  useOwnerStays: () => ({ stays: { value: [] }, createStay: vi.fn(), updateStay: vi.fn(), cancelStay: vi.fn(), retrySync: vi.fn() }),
}))
vi.mock('~/composables/useOwnerStatements', () => ({
  useOwnerStatements: () => ({ statements: { value: [] } }),
}))

// Stub PortalKpiCard and PortalPropertyPicker so the test does not need to
// mount their subtrees — the dashboard wiring is the only thing under test.
vi.mock('~/components/owner-portal/PortalKpiCard.vue', () => ({
  default: { name: 'PortalKpiCardStub', template: '<div class="kpi-stub"><slot /></div>' },
}))
vi.mock('~/components/owner-portal/PortalPropertyPicker.vue', () => ({
  default: { name: 'PortalPropertyPickerStub', template: '<div class="picker-stub" />' },
}))

const ButtonStub = {
  props: ['disabled', 'type'],
  emits: ['click'],
  template: '<button :type="type" :disabled="disabled" @click="$emit(\'click\', $event)"><slot /></button>',
}
const IconStub = { props: ['name'], template: '<i />' }

const globalOptions = {
  stubs: {
    Button: ButtonStub,
    Icon: IconStub,
    Card: { template: '<div class="card-stub"><slot /></div>' },
    CardContent: { template: '<div><slot /></div>' },
    CardHeader: { template: '<div><slot /></div>' },
    CardTitle: { template: '<h3><slot /></h3>' },
    Select: { props: ['modelValue'], emits: ['update:modelValue'], template: '<select :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value)" />' },
    SelectContent: { template: '<div><slot /></div>' },
    SelectItem: { props: ['value'], template: '<option :value="value"><slot /></option>' },
    SelectTrigger: { template: '<button><slot /></button>' },
    SelectValue: { template: '<span><slot /></span>' },
  },
}

async function flush() {
  await new Promise(r => setTimeout(r, 0))
}

describe('portalDashboard', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('renders the page heading and what the page covers', async () => {
    mount(PortalDashboard, { attachTo: document.body, global: globalOptions })
    await flush()
    const body = document.body.textContent ?? ''
    expect(body).toContain('Overview')
    expect(body).toMatch(/last 12 months/i)
  })
})
