// The first-run DATEV setup. A tenant starts with nothing configured, so this
// wizard is the only path to a working export: three steps, each gating on its
// own fields, ending on the handover it exists for.

import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DatevFieldsAccounts from '~/components/finance/DatevFieldsAccounts.vue'
import DatevFieldsAdvisor from '~/components/finance/DatevFieldsAdvisor.vue'
import DatevFieldsHandover from '~/components/finance/DatevFieldsHandover.vue'
import DatevSetupWizard from '~/components/finance/DatevSetupWizard.vue'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { useDatev } from '~/composables/useDatev'

const global = {
  components: {
    Button,
    Input,
    Label,
    FinanceDatevFieldsAdvisor: DatevFieldsAdvisor,
    FinanceDatevFieldsAccounts: DatevFieldsAccounts,
    FinanceDatevFieldsHandover: DatevFieldsHandover,
  },
  config: { warnHandler: () => {} },
}

function findButton(wrapper: ReturnType<typeof mount>, label: string) {
  return wrapper.findAll('button').find(b => b.text().trim() === label)
}

/** Fills the two advisor numbers on step 1 the way a tenant would. */
async function fillAdvisor(wrapper: ReturnType<typeof mount>) {
  const inputs = wrapper.findAll('input')
  await inputs[0]!.setValue('7654321')
  await inputs[1]!.setValue('10234')
}

/** Advances past step 1 and 2 so the last step is on screen. */
async function reachLastStep(wrapper: ReturnType<typeof mount>) {
  await fillAdvisor(wrapper)
  await findButton(wrapper, 'Continue')!.trigger('click')
  await findButton(wrapper, 'Continue')!.trigger('click')
}

describe('datevSetupWizard', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('useRoute', () => ({ query: {} }))
    vi.stubGlobal('useRouter', () => ({ replace: vi.fn() }))
  })

  it('opens on step 1 with Back disabled and no Finish yet', () => {
    const wrapper = mount(DatevSetupWizard, { global })

    expect(wrapper.text()).toContain('Step 1 of 3 — Advisor & client')
    expect(findButton(wrapper, 'Back')!.attributes('disabled')).toBeDefined()
    expect(findButton(wrapper, 'Finish setup')).toBeUndefined()
  })

  it('refuses to advance while the advisor numbers are missing', async () => {
    const wrapper = mount(DatevSetupWizard, { global })
    await findButton(wrapper, 'Continue')!.trigger('click')

    expect(wrapper.text()).toContain('Step 1 of 3')
    expect(wrapper.text()).toContain('your tax advisor provides this')
  })

  it('walks all three steps and only then offers Finish', async () => {
    const wrapper = mount(DatevSetupWizard, { global })

    await fillAdvisor(wrapper)
    await findButton(wrapper, 'Continue')!.trigger('click')
    expect(wrapper.text()).toContain('Step 2 of 3 — Kontenrahmen & accounts')
    expect(wrapper.text()).toContain('Debitorenkonto')

    await findButton(wrapper, 'Continue')!.trigger('click')
    expect(wrapper.text()).toContain('Step 3 of 3 — Handover')
    expect(wrapper.text()).toContain('Tax advisor e-mail')
    // The review block repeats what is about to be saved.
    expect(wrapper.text()).toContain('7654321 / 10234')
    expect(findButton(wrapper, 'Finish setup')).toBeDefined()
  })

  it('leaves the tenant unconfigured until Finish is pressed', async () => {
    const { isConfigured } = useDatev()
    const wrapper = mount(DatevSetupWizard, { global })

    await reachLastStep(wrapper)
    expect(isConfigured.value).toBe(false)

    await findButton(wrapper, 'Finish setup')!.trigger('click')
    expect(isConfigured.value).toBe(true)
  })

  it('saves the entered values and keeps a success panel on screen', async () => {
    const { settings } = useDatev()
    const wrapper = mount(DatevSetupWizard, { global })

    await reachLastStep(wrapper)
    await findButton(wrapper, 'Finish setup')!.trigger('click')

    expect(settings.value.beraternummer).toBe('7654321')
    expect(settings.value.mandantennummer).toBe('10234')
    // Saving flips isConfigured — the panel must not vanish with it.
    expect(wrapper.text()).toContain('DATEV is set up')
    expect(wrapper.text()).toContain('What happens next')
  })

  it('gates each step on its own fields, not just the first', async () => {
    const wrapper = mount(DatevSetupWizard, { global })
    await fillAdvisor(wrapper)
    await findButton(wrapper, 'Continue')!.trigger('click')

    // Break the Erlöskonto on step 2 — the second account input on this step.
    const accountInputs = wrapper.findAll('input')
    await accountInputs[1]!.setValue('84')
    await findButton(wrapper, 'Continue')!.trigger('click')

    expect(wrapper.text()).toContain('Step 2 of 3')
    expect(wrapper.text()).toContain('Must be 4-8 digits.')
    expect(useDatev().isConfigured.value).toBe(false)
  })

  it('ends by leaving for the Exports tab and closing the sheet', async () => {
    const wrapper = mount(DatevSetupWizard, { global })
    useState('finance-integration-sheet-open').value = true

    await reachLastStep(wrapper)
    await findButton(wrapper, 'Finish setup')!.trigger('click')
    await findButton(wrapper, 'Go to Exports')!.trigger('click')

    expect(useState('finance-active-tab').value).toBe('exports')
    expect(useState('finance-integration-sheet-open').value).toBe(false)
  })

  it('hands over to the flat form when the tenant reviews the settings', async () => {
    const wrapper = mount(DatevSetupWizard, { global })

    await reachLastStep(wrapper)
    await findButton(wrapper, 'Finish setup')!.trigger('click')
    await findButton(wrapper, 'Review settings')!.trigger('click')

    expect(wrapper.emitted('done')).toHaveLength(1)
  })
})
