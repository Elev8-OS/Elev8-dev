// The DATEV tile is a file-handoff integration, not a connection: it reports
// "configured", its action reads "Set up", and the deep-link query opens its
// settings sheet with content (a blank sheet was the original bug report).

import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive } from 'vue'
import DatevExportSettings from '~/components/finance/DatevExportSettings.vue'
import DatevLogo from '~/components/finance/DatevLogo.vue'
import IntegrationsTab from '~/components/finance/IntegrationsTab.vue'

// Nuxt resolves these by name at runtime; Vitest needs them registered or the
// sheet body collapses to an empty tag — the exact symptom being guarded here.
const global = {
  components: {
    FinanceDatevExportSettings: DatevExportSettings,
    FinanceDatevLogo: DatevLogo,
  },
  config: { warnHandler: () => {} },
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

  it('lists DATEV as configured with a Manage action', () => {
    const { wrapper } = mountTab({})
    const text = wrapper.text()
    expect(text).toContain('DATEV')
    expect(text).toContain('Configured')
    // Never "Connected" — DATEV is a file handoff, not a live connection.
    expect(text).not.toContain('Not set up')
  })

  it('renders the settings panel when deep-linked, not a blank sheet', async () => {
    const { wrapper } = mountTab({ integration: 'datev' })
    // The sheet is opened from onMounted, i.e. after the first render.
    await nextTick()
    const text = wrapper.text()
    expect(text).toContain('Your tax advisor provides these values.')
    expect(text).toContain('Beraternummer')
    expect(text).toContain('Kontenrahmen')
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
