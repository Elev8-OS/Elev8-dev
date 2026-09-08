// The wizard host. These tests walk the screens the way a tenant does, because
// the failure they guard against is a button that changes no state and so
// re-renders the screen it was meant to leave.

import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useOnboarding } from '~/composables/useOnboarding'
import OnboardingPage from '~/pages/onboarding/index.vue'

vi.mock('vue-sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}))

const passthrough = (tag: string) => ({ template: `<${tag}><slot /></${tag}>` })

const globalOptions = {
  stubs: {
    Card: passthrough('section'),
    CardHeader: passthrough('header'),
    CardTitle: passthrough('h2'),
    CardDescription: passthrough('p'),
    CardContent: passthrough('div'),
    CardFooter: passthrough('footer'),
    Button: {
      props: ['disabled', 'variant', 'size'],
      emits: ['click'],
      template: '<button :disabled="disabled" @click="$emit(\'click\', $event)"><slot /></button>',
    },
    Icon: { props: ['name'], template: '<i />' },
    // Each step is stubbed to its own marker plus a button that fires `next`,
    // so the assertions are about which screen shows, not about the forms.
    OnboardingStepper: { props: ['current'], template: '<nav :data-step="current" />' },
    OnboardingStepProfile: { emits: ['next'], template: '<form data-screen="profile"><button @click="$emit(\'next\')">next</button></form>' },
    OnboardingStepBranding: { emits: ['next', 'back'], template: '<div data-screen="branding"><button @click="$emit(\'next\')">next</button><button @click="$emit(\'back\')">back</button></div>' },
    OnboardingStepSelectModel: { emits: ['next', 'back'], template: '<div data-screen="select_model"><button @click="$emit(\'next\')">next</button></div>' },
    OnboardingStepSelectPlan: { emits: ['next', 'back'], template: '<div data-screen="select_plan"><button @click="$emit(\'next\')">next</button></div>' },
    OnboardingStepPayment: { emits: ['next', 'back'], template: '<div data-screen="payment"><button @click="$emit(\'next\')">next</button></div>' },
    OnboardingConnectChannels: { emits: ['done'], template: '<div data-screen="channels" />' },
    OnboardingConnectPms: { emits: ['connected'], template: '<div data-screen="pms"><button @click="$emit(\'connected\')">go</button></div>' },
    OnboardingImportProgress: { emits: ['background', 'done'], template: '<div data-screen="import"><button @click="$emit(\'done\')">done</button></div>' },
    OnboardingReconnectChannels: { emits: ['done'], template: '<div data-screen="reconnect" />' },
  },
}

/** A tenant that has just verified their email, which is where the wizard starts. */
function freshTenant(model: 'PMS_CM' | 'PMS_ONLY' | 'MIGRATION' = 'PMS_CM') {
  const ob = useOnboarding()
  ob.startTenant('owner@example.com')
  ob.markEmailVerified()
  return { ob, model }
}

function screen(wrapper: ReturnType<typeof mount>): string | null {
  return wrapper.find('[data-screen]').exists()
    ? wrapper.find('[data-screen]').attributes('data-screen')!
    : null
}

function clickText(wrapper: ReturnType<typeof mount>, label: string) {
  const button = wrapper.findAll('button').find(b => b.text().includes(label))
  if (!button)
    throw new Error(`No button matching "${label}". Buttons: ${wrapper.findAll('button').map(b => b.text()).join(' | ')}`)
  return button.trigger('click')
}

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal('definePageMeta', () => {})
  vi.stubGlobal('navigateTo', vi.fn())
})

describe('onboarding page', () => {
  it('greets a freshly verified tenant', () => {
    freshTenant()
    const wrapper = mount(OnboardingPage, { global: globalOptions })
    expect(wrapper.find('[data-testid="onboarding-welcome"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Your email is verified')
  })

  it('setup my profile leaves the welcome screen and opens the profile form', async () => {
    freshTenant()
    const wrapper = mount(OnboardingPage, { global: globalOptions })

    await clickText(wrapper, 'Setup my profile')

    expect(wrapper.find('[data-testid="onboarding-welcome"]').exists()).toBe(false)
    expect(screen(wrapper)).toBe('profile')
  })

  it('walks profile to branding to model to plan to payment', async () => {
    freshTenant()
    const wrapper = mount(OnboardingPage, { global: globalOptions })
    await clickText(wrapper, 'Setup my profile')

    expect(screen(wrapper)).toBe('profile')
    await clickText(wrapper, 'next')
    expect(screen(wrapper)).toBe('branding')
    await clickText(wrapper, 'next')
    expect(screen(wrapper)).toBe('select_model')
    await clickText(wrapper, 'next')
    await flushPromises()
    expect(screen(wrapper)).toBe('select_plan')
    await clickText(wrapper, 'next')
    await flushPromises()
    expect(screen(wrapper)).toBe('payment')
  })

  it('goes back from branding to profile without rewinding saved progress', async () => {
    const { ob } = freshTenant()
    const wrapper = mount(OnboardingPage, { global: globalOptions })
    await clickText(wrapper, 'Setup my profile')
    await clickText(wrapper, 'next')
    expect(screen(wrapper)).toBe('branding')

    await clickText(wrapper, 'back')
    expect(screen(wrapper)).toBe('profile')
    // The saved status never moves backwards, only the view does.
    expect(ob.status.value).toBe('email_verified')
  })

  it('keeps the stepper on Select plan across all three plan screens', async () => {
    freshTenant()
    const wrapper = mount(OnboardingPage, { global: globalOptions })
    await clickText(wrapper, 'Setup my profile')
    await clickText(wrapper, 'next')
    await clickText(wrapper, 'next')
    expect(wrapper.find('nav').attributes('data-step')).toBe('plan')
  })

  it('shows the channel screen after payment for a PMS_CM tenant', () => {
    const ob = useOnboarding()
    ob.startTenant('owner@example.com')
    ob.markEmailVerified()
    ob.selectModel('PMS_CM')
    ob.setStatus('integration_pending')

    const wrapper = mount(OnboardingPage, { global: globalOptions })
    expect(screen(wrapper)).toBe('channels')
  })

  it('shows the PMS sign in for a PMS_ONLY tenant, then the import', async () => {
    const ob = useOnboarding()
    ob.startTenant('owner@example.com')
    ob.markEmailVerified()
    ob.selectModel('PMS_ONLY')
    ob.setStatus('integration_pending')

    const wrapper = mount(OnboardingPage, { global: globalOptions })
    expect(screen(wrapper)).toBe('pms')

    await clickText(wrapper, 'go')
    expect(screen(wrapper)).toBe('import')
  })

  it('sends a migration tenant to reconnect channels before the dashboard', async () => {
    const ob = useOnboarding()
    ob.startTenant('owner@example.com')
    ob.markEmailVerified()
    ob.selectModel('MIGRATION')
    ob.setStatus('integration_pending')

    const wrapper = mount(OnboardingPage, { global: globalOptions })
    await clickText(wrapper, 'go')
    expect(screen(wrapper)).toBe('import')

    await clickText(wrapper, 'done')
    expect(screen(wrapper)).toBe('reconnect')
  })

  it('shows the finished panel to a tenant who is already onboarded', () => {
    const wrapper = mount(OnboardingPage, { global: globalOptions })
    expect(wrapper.text()).toContain('Onboarding is complete')
    expect(wrapper.find('[data-testid="onboarding-welcome"]').exists()).toBe(false)
  })

  it('skips the welcome screen for a tenant who already filled in their profile', () => {
    const ob = useOnboarding()
    ob.startTenant('owner@example.com')
    ob.markEmailVerified()
    ob.state.value = {
      ...ob.state.value,
      profile: { ...ob.state.value.profile, companyName: 'PT Elev8' },
    }

    const wrapper = mount(OnboardingPage, { global: globalOptions })
    expect(wrapper.find('[data-testid="onboarding-welcome"]').exists()).toBe(false)
    expect(screen(wrapper)).toBe('profile')
  })

  it('resets onboarding back to welcome screen when clicking reset onboarding', async () => {
    const wrapper = mount(OnboardingPage, { global: globalOptions })
    expect(wrapper.text()).toContain('Onboarding is complete')

    await clickText(wrapper, 'Reset onboarding')

    expect(wrapper.find('[data-testid="onboarding-welcome"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Welcome to ELEV8')
  })

  it('provides a logout button on every step that navigates to /login', async () => {
    freshTenant()
    const wrapper = mount(OnboardingPage, { global: globalOptions })

    // 1. Visible on welcome screen
    const logoutBtn = wrapper.find('[data-testid="onboarding-logout-button"]')
    expect(logoutBtn.exists()).toBe(true)
    expect(logoutBtn.text()).toContain('Log out')

    await logoutBtn.trigger('click')
    expect(navigateTo).toHaveBeenCalledWith('/login')

    // 2. Visible after entering profile step
    await clickText(wrapper, 'Setup my profile')
    expect(screen(wrapper)).toBe('profile')
    const profileLogoutBtn = wrapper.find('[data-testid="onboarding-logout-button"]')
    expect(profileLogoutBtn.exists()).toBe(true)

    await profileLogoutBtn.trigger('click')
    expect(navigateTo).toHaveBeenCalledWith('/login')
  })
})
