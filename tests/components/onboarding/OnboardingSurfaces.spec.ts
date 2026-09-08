// The two surfaces the tenant sees after onboarding finishes: the dashboard
// checklist and the single priority banner. Both read `useOnboarding`, so the
// tests drive the composable and assert what renders.

import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ChecklistCard from '~/components/onboarding/ChecklistCard.vue'
import StatusBanner from '~/components/onboarding/StatusBanner.vue'
import { useOnboarding } from '~/composables/useOnboarding'

const passthrough = (tag: string) => ({ template: `<${tag}><slot /></${tag}>` })

const globalOptions = {
  stubs: {
    Card: passthrough('section'),
    CardHeader: passthrough('header'),
    CardTitle: passthrough('h2'),
    CardDescription: passthrough('p'),
    CardAction: passthrough('div'),
    CardContent: passthrough('div'),
    Progress: { props: ['modelValue'], template: '<div role="progressbar" :aria-valuenow="modelValue" />' },
    Button: {
      props: ['disabled', 'variant', 'size', 'asChild'],
      emits: ['click'],
      template: '<button :disabled="disabled" @click="$emit(\'click\', $event)"><slot /></button>',
    },
    Icon: { props: ['name'], template: '<i :data-icon="name" />' },
    NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
  },
}

function text(wrapper: ReturnType<typeof mount>): string {
  return wrapper.text().replace(/\s+/g, ' ')
}

beforeEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
})

describe('checklistCard', () => {
  it('renders every applicable item with the progress count', () => {
    const wrapper = mount(ChecklistCard, { global: globalOptions })
    expect(wrapper.find('[data-testid="onboarding-checklist"]').exists()).toBe(true)
    expect(text(wrapper)).toContain('0 of 7 done')
    expect(text(wrapper)).toContain('Set up your first listing')
    expect(text(wrapper)).toContain('Download ELEV8 Go')
  })

  it('leaves out items that do not apply to a PMS_ONLY tenant', () => {
    const ob = useOnboarding()
    ob.selectModel('PMS_ONLY')
    const wrapper = mount(ChecklistCard, { global: globalOptions })
    expect(text(wrapper)).toContain('0 of 6 done')
    expect(text(wrapper)).not.toContain('Connect Stripe')
  })

  it('shows an item as done once a system event completes it', async () => {
    const ob = useOnboarding()
    ob.completeChecklistItem('setup_cleaning')
    const wrapper = mount(ChecklistCard, { global: globalOptions })
    expect(text(wrapper)).toContain('1 of 7 done')
    // A completed item loses its call to action.
    const cleaningRow = wrapper.findAll('li').find(li => li.text().includes('Set up cleaning'))!
    expect(cleaningRow.text()).not.toContain('Go to Cleaning')
  })

  it('offers Skip only on optional items', () => {
    const wrapper = mount(ChecklistCard, { global: globalOptions })
    const rows = wrapper.findAll('li')
    const stripe = rows.find(r => r.text().includes('Connect Stripe'))!
    const listing = rows.find(r => r.text().includes('Set up your first listing'))!
    expect(stripe.text()).toContain('Skip')
    expect(listing.text()).not.toContain('Skip')
  })

  it('collapses to just the progress bar', async () => {
    const wrapper = mount(ChecklistCard, { global: globalOptions })
    expect(wrapper.findAll('li').length).toBeGreaterThan(0)
    await wrapper.findAll('button').find(b => b.text() === 'Collapse')!.trigger('click')
    expect(wrapper.findAll('li')).toHaveLength(0)
    expect(wrapper.find('[role="progressbar"]').exists()).toBe(true)
  })

  it('disappears once everything applicable is finished', () => {
    const ob = useOnboarding()
    for (const item of [...ob.state.value.checklist])
      ob.completeChecklistItem(item.code)
    const wrapper = mount(ChecklistCard, { global: globalOptions })
    expect(wrapper.find('[data-testid="onboarding-checklist"]').exists()).toBe(false)
  })

  it('stays hidden while onboarding is still running', () => {
    const ob = useOnboarding()
    ob.startTenant('new@example.com')
    const wrapper = mount(ChecklistCard, { global: globalOptions })
    expect(wrapper.find('[data-testid="onboarding-checklist"]').exists()).toBe(false)
  })
})

describe('statusBanner', () => {
  it('renders nothing when there is nothing to say', () => {
    const wrapper = mount(StatusBanner, { global: globalOptions })
    expect(wrapper.find('[data-testid="onboarding-banner"]').exists()).toBe(false)
  })

  it('shows the inactive plan banner above everything else', () => {
    const ob = useOnboarding()
    ob.state.value = { ...ob.state.value, subscription: { ...ob.state.value.subscription, status: 'pending' } }
    const wrapper = mount(StatusBanner, { global: globalOptions })
    expect(text(wrapper)).toContain('Your plan is not active yet')
    expect(text(wrapper)).toContain('Retry payment')
  })

  it('shows one banner only, never two at once', async () => {
    vi.useFakeTimers()
    const ob = useOnboarding()
    ob.state.value = {
      ...ob.state.value,
      pmsModel: 'MIGRATION',
      subscription: { ...ob.state.value.subscription, status: 'active' },
    }
    ob.startImport({ listings: 1, reservations: 2, guests: 1 })
    ob.completeOnboarding()

    const running = mount(StatusBanner, { global: globalOptions })
    expect(running.findAll('[data-testid="onboarding-banner"] > *')).toHaveLength(1)
    expect(text(running)).toContain('Importing your data')

    await vi.runAllTimersAsync()
    vi.useRealTimers()

    const finished = mount(StatusBanner, { global: globalOptions })
    expect(finished.findAll('[data-testid="onboarding-banner"] > *')).toHaveLength(1)
    expect(text(finished)).toContain('did not import')
  })

  it('nags a migration tenant until a channel is reconnected', () => {
    const ob = useOnboarding()
    ob.state.value = {
      ...ob.state.value,
      pmsModel: 'MIGRATION',
      subscription: { ...ob.state.value.subscription, status: 'active' },
    }
    ob.completeOnboarding()

    expect(text(mount(StatusBanner, { global: globalOptions }))).toContain('Your channels are not connected')
    ob.toggleChannel('airbnb', true)
    expect(mount(StatusBanner, { global: globalOptions }).find('[data-testid="onboarding-banner"]').exists()).toBe(false)
  })
})
