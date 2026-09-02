// The DATEV tile is a file-handoff integration, not a connection: it reports
// "Not set up" until configured (never "Not connected"), its action reads
// "Set up", and the deep-link query opens its settings sheet with content
// (a blank sheet was the original bug report).

import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive } from 'vue'
import { exampleDatevSettings } from '~/components/finance/data/datev'
import DatevExportSettings from '~/components/finance/DatevExportSettings.vue'
import DatevFieldsAccounts from '~/components/finance/DatevFieldsAccounts.vue'
import DatevFieldsAdvisor from '~/components/finance/DatevFieldsAdvisor.vue'
import DatevFieldsHandover from '~/components/finance/DatevFieldsHandover.vue'
import DatevLogo from '~/components/finance/DatevLogo.vue'
import DatevSetupWizard from '~/components/finance/DatevSetupWizard.vue'
import IntegrationsTab from '~/components/finance/IntegrationsTab.vue'
import { useDatev } from '~/composables/useDatev'

// Nuxt resolves these by name at runtime; Vitest needs them registered or the
// sheet body collapses to an empty tag — the exact symptom being guarded here.
const global = {
  components: {
    FinanceDatevExportSettings: DatevExportSettings,
    FinanceDatevSetupWizard: DatevSetupWizard,
    FinanceDatevFieldsAdvisor: DatevFieldsAdvisor,
    FinanceDatevFieldsAccounts: DatevFieldsAccounts,
    FinanceDatevFieldsHandover: DatevFieldsHandover,
    FinanceDatevLogo: DatevLogo,
  },
  config: { warnHandler: () => {} },
}

/** What finishing the setup wizard leaves behind. */
function configure() {
  useDatev().saveSettings({
    ...exampleDatevSettings,
    channelAccounts: { ...exampleDatevSettings.channelAccounts },
  })
}

function mountTab(query: Record<string, string>) {
  const reactiveQuery = reactive({ ...query })
  const replace = vi.fn()
  vi.stubGlobal('useRoute', () => ({ query: reactiveQuery }))
  vi.stubGlobal('useRouter', () => ({ replace }))
  return { wrapper: mount(IntegrationsTab, { global }), query: reactiveQuery, replace }
}

describe('integrationsTab — DATEV', () => {
  beforeEach(() => localStorage.clear())

  it('lists DATEV as not set up out of the box', () => {
    const { wrapper } = mountTab({})
    const text = wrapper.text()
    expect(text).toContain('DATEV')
    expect(text).toContain('Not set up')
    // Never connection wording — DATEV is a file handoff.
    expect(text).not.toContain('Configured')
  })

  it('flips the tile to Configured once setup is saved', async () => {
    const { wrapper } = mountTab({})
    configure()
    await nextTick()

    const text = wrapper.text()
    expect(text).toContain('Configured')
    expect(text).not.toContain('Not set up')
  })

  it('renders the guided setup when deep-linked unconfigured, not a blank sheet', async () => {
    const { wrapper } = mountTab({ integration: 'datev' })
    // The sheet is opened from onMounted, i.e. after the first render.
    await nextTick()
    const text = wrapper.text()
    expect(text).toContain('Your tax advisor provides these values.')
    expect(text).toContain('Step 1 of 3')
    expect(text).toContain('Beraternummer')
    // Step 2/3 titles show in the progress rail, but their fields wait their turn.
    expect(text).not.toContain('Debitorenkonto')
    expect(text).not.toContain('Tax advisor e-mail')
  })

  it('renders the flat settings form once configured', async () => {
    configure()
    const { wrapper } = mountTab({ integration: 'datev' })
    await nextTick()

    const text = wrapper.text()
    expect(text).toContain('Beraternummer')
    expect(text).toContain('Kontenrahmen')
    expect(text).toContain('Save settings')
    expect(text).not.toContain('Step 1 of 3')
  })

  it('opens the sheet when the query changes on an already-mounted tab', async () => {
    const { wrapper, query } = mountTab({})
    expect(wrapper.text()).not.toContain('Your tax advisor provides these values.')

    query.integration = 'datev'
    await nextTick()

    expect(wrapper.text()).toContain('Your tax advisor provides these values.')
  })

  it('consumes the query param so the same link re-opens later', () => {
    const { replace } = mountTab({ integration: 'datev' })
    expect(replace).toHaveBeenCalledWith({ query: {} })
  })

  // The Exports tab's Configure button hands the id over this way — no routing.
  it('opens the sheet from an in-page request made before it mounted', async () => {
    useState('finance-open-integration').value = 'datev'
    const { wrapper } = mountTab({})
    await nextTick()

    expect(wrapper.text()).toContain('Your tax advisor provides these values.')
    // Consumed, so asking again later re-opens it.
    expect(useState('finance-open-integration').value).toBeNull()
  })

  it('opens the sheet from an in-page request while already mounted', async () => {
    const { wrapper } = mountTab({})
    expect(wrapper.text()).not.toContain('Your tax advisor provides these values.')

    useState('finance-open-integration').value = 'datev'
    await nextTick()

    expect(wrapper.text()).toContain('Your tax advisor provides these values.')
  })

  it('ignores an unknown integration id', async () => {
    const { wrapper } = mountTab({ integration: 'nope' })
    await nextTick()
    expect(wrapper.text()).not.toContain('Your tax advisor provides these values.')
  })
})
