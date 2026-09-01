// Render-level smoke tests for the DATEV Exports tab. The format writer is
// covered in tests/lib/datev-extf.spec.ts and the flow in
// tests/composables/useDatev.spec.ts — here we verify the SFCs compile and the
// three states (not configured / generator / preview) wire up to the composable.

import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DatevExportTab from '~/components/finance/DatevExportTab.vue'
import DatevLogo from '~/components/finance/DatevLogo.vue'
import DatevPreview from '~/components/finance/DatevPreview.vue'
import { Button } from '~/components/ui/button'
import { useDatev } from '~/composables/useDatev'

// Nuxt auto-imports these by name at runtime; Vitest needs them registered so
// the child components actually render instead of collapsing to empty tags.
const global = {
  components: {
    // The real Button, so the Configure click path is exercised end to end.
    Button,
    FinanceDatevLogo: DatevLogo,
    FinanceDatevPreview: DatevPreview,
  },
  config: { warnHandler: () => {} },
}

function findButton(wrapper: ReturnType<typeof mount>, label: string) {
  return wrapper.findAll('button').find(b => b.text().trim() === label)
}

describe('datevExportTab', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('useRoute', () => ({ query: {} }))
    vi.stubGlobal('useRouter', () => ({ replace: vi.fn() }))
  })

  // Regression: this button switches a LOCAL tab, so it must not depend on a
  // route change. It previously navigated to ?tab=integrations on the same page,
  // which never remounted anything and left the button dead.
  it('switches to the Integrations tab and requests the DATEV sheet on Configure', async () => {
    const wrapper = mount(DatevExportTab, { global })

    const configure = findButton(wrapper, 'Configure')
    expect(configure).toBeDefined()
    await configure!.trigger('click')

    expect(useState('finance-active-tab').value).toBe('integrations')
    expect(useState('finance-open-integration').value).toBe('datev')
  })

  it('does the same from the unconfigured state via Set up DATEV', async () => {
    const { settings } = useDatev()
    settings.value = { ...settings.value, beraternummer: '', mandantennummer: '' }
    const wrapper = mount(DatevExportTab, { global })

    const setup = findButton(wrapper, 'Set up DATEV')
    expect(setup).toBeDefined()
    await setup!.trigger('click')

    expect(useState('finance-active-tab').value).toBe('integrations')
    expect(useState('finance-open-integration').value).toBe('datev')
  })

  it('prompts for setup when Berater/Mandant are missing', () => {
    const { settings } = useDatev()
    settings.value = { ...settings.value, beraternummer: '', mandantennummer: '' }

    const wrapper = mount(DatevExportTab, { global })
    expect(wrapper.text()).toContain('Set up DATEV')
    expect(wrapper.text()).not.toContain('Create DATEV file')
  })

  it('shows the generator with a live scope line once configured', () => {
    const { setPeriod } = useDatev()
    setPeriod('2026-08-01', '2026-08-31')

    const wrapper = mount(DatevExportTab, { global })
    const text = wrapper.text()
    expect(text).toContain('DATEV Buchungsstapel')
    expect(text).toContain('Create DATEV file')
    // Scope line reflects the 11 eligible August bookings.
    expect(text).toContain('11')
    expect(text).toContain('19.290,00')
    // The one cancelled August booking is reported.
    expect(text).toContain('1 cancelled')
  })

  it('renders the export history seeded from mock data', () => {
    const wrapper = mount(DatevExportTab, { global })
    const text = wrapper.text()
    expect(text).toContain('Export history')
    expect(text).toContain('EXTF_Buchungsstapel_2026-07.csv')
  })

  it('swaps the generator for the reviewable file after generating', async () => {
    const { setPeriod, generate } = useDatev()
    setPeriod('2026-08-01', '2026-08-31')

    const wrapper = mount(DatevExportTab, { global })
    await generate()
    await wrapper.vm.$nextTick()

    const text = wrapper.text()
    expect(text).toContain('EXTF_Buchungsstapel_2026-08.csv')
    expect(text).toContain('Buchungssätze')
    expect(text).toContain('CP1252')
    // Generator is replaced by the review view.
    expect(text).not.toContain('Create DATEV file')
  })
})
