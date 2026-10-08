import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import DamageProtectionPanel from '~/components/settings/DamageProtectionPanel.vue'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { useDamageProtection } from '~/composables/useDamageProtection'
import { useReservationsModule } from '~/composables/useReservationsModule'
import { useTernActivation } from '~/composables/useTernActivation'
import { useUpsellServices } from '~/composables/useUpsellServices'

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }))
vi.mock('vue-sonner', () => ({ toast }))

const passthrough = { template: '<div><slot /></div>' }
const STUBS = {
  Icon: true,
  NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
  Card: passthrough,
  CardHeader: passthrough,
  CardTitle: passthrough,
  CardDescription: passthrough,
  CardContent: passthrough,
  Badge: passthrough,
  Dialog: { props: ['open'], template: '<div v-if="open"><slot /></div>' },
  Select: { name: 'SelectStub', props: ['modelValue'], emits: ['update:modelValue'], template: '<div :data-value="modelValue"><slot /></div>' },
  SelectTrigger: passthrough,
  SelectValue: true,
  SelectContent: passthrough,
  SelectItem: { props: ['value'], template: '<div><slot /></div>' },
  Switch: {
    name: 'SwitchStub',
    props: ['modelValue', 'disabled'],
    emits: ['update:modelValue'],
    template: '<input type="checkbox" :checked="modelValue" :disabled="disabled" @change="$emit(\'update:modelValue\', $event.target.checked)">',
  },
  CoverageBreakdown: true,
  UpsellDrawer: { name: 'UpsellDrawerStub', props: ['open', 'service', 'initialCategory'], template: '<div data-testid="upsell-drawer" />' },
  TernActivationWizard: true,
}

function mountPanel() {
  return mount(DamageProtectionPanel, { global: { components: { Button, Input, Label }, stubs: STUBS } })
}

function switchIn(wrapper: ReturnType<typeof mountPanel>, testid: string) {
  return wrapper.find(`[data-testid="${testid}"]`)
}

beforeEach(() => {
  useReservationsModule().reservations.value = []
  localStorage.clear()
  vi.clearAllMocks()
})

describe('settings, Damage protection', () => {
  it('sets protection once for every listing, with the activation card on top', () => {
    const wrapper = mountPanel()
    expect(wrapper.find('[data-testid="tern-activation-card"]').exists()).toBe(true)
    const rows = wrapper.findAll('[data-testid="protection-listing-row"]')
    expect(rows.length).toBeGreaterThan(3)
    expect(rows.find(r => r.text().includes('IDR'))?.text()).toContain('Not covered')
  })

  it('keeps the deposit on and locked while the waiver is on', async () => {
    const wrapper = mountPanel()
    const deposit = switchIn(wrapper, 'protection-deposit-switch')
    expect((deposit.element as HTMLInputElement).checked).toBe(true)
    expect(deposit.attributes('disabled')).toBeDefined()

    await switchIn(wrapper, 'protection-waiver-switch').setValue(false)
    await nextTick()
    expect(useDamageProtection().settings.value).toMatchObject({ waiver: false, deposit: true })
    expect(switchIn(wrapper, 'protection-deposit-switch').attributes('disabled')).toBeUndefined()

    await switchIn(wrapper, 'protection-deposit-switch').setValue(false)
    await switchIn(wrapper, 'protection-waiver-switch').setValue(true)
    await nextTick()
    // Switching the waiver back on brings the deposit with it.
    expect(useDamageProtection().settings.value).toMatchObject({ waiver: true, deposit: true })
  })

  it('shows the one package with no picker, and says when its upsell is paused', async () => {
    const wrapper = mountPanel()
    expect(wrapper.find('[data-testid="protection-package"]').text()).toContain('Elev8 Cover Bronze')
    expect(wrapper.findAllComponents({ name: 'SelectStub' }).some(c => c.props('modelValue') === 'svc-dp-bronze')).toBe(false)
    useUpsellServices().toggleStatus('svc-dp-bronze')
    await nextTick()
    expect(wrapper.find('[data-testid="protection-package-missing"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="protection-edit-package"]').exists()).toBe(true)
  })

  it('edits the one package the waiver uses, never adds another', async () => {
    const wrapper = mountPanel()
    expect(wrapper.find('[data-testid="protection-new-package"]').exists()).toBe(false)
    await wrapper.find('[data-testid="protection-edit-package"]').trigger('click')
    expect(wrapper.findComponent({ name: 'UpsellDrawerStub' }).props('service')?.id).toBe('svc-dp-bronze')
  })

  it('cannot switch the waiver on before activation, and offers the Activate button instead', () => {
    useTernActivation().replayActivation()
    useDamageProtection().setProtectionSettings({ waiver: false })
    const wrapper = mountPanel()
    expect(switchIn(wrapper, 'protection-waiver-switch').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-testid="protection-waiver-inactive"]').text()).toContain('Activate the damage waiver above')
    expect(wrapper.find('[data-testid="tern-activate-open"]').exists()).toBe(true)
  })
})
