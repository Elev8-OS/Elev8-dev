// Regression: the Finance page must follow `?tab=` on EVERY query change, not
// just on mount. Tab links on this page only change the query — the page
// component is never remounted — so an onMounted-only read leaves in-app links
// (notably the Exports tab's "Configure" button) silently dead.

import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive } from 'vue'
import FinancePage from '~/pages/finance/index.vue'

const global = { config: { warnHandler: () => {} } }

function mountWithQuery(query: Record<string, string>) {
  const reactiveQuery = reactive({ ...query })
  vi.stubGlobal('useRoute', () => ({ query: reactiveQuery }))
  vi.stubGlobal('useRouter', () => ({ replace: vi.fn() }))
  const wrapper = mount(FinancePage, { global })
  return { wrapper, query: reactiveQuery }
}

describe('finance tab deep-linking', () => {
  beforeEach(() => localStorage.clear())

  it('opens on the tab named in the initial query', () => {
    mountWithQuery({ tab: 'exports' })
    expect(useState('finance-active-tab').value).toBe('exports')
  })

  it('follows a later query change without a remount', async () => {
    const { query } = mountWithQuery({ tab: 'exports' })
    expect(useState('finance-active-tab').value).toBe('exports')

    // What the "Configure" NuxtLink does: same page, new query.
    query.tab = 'integrations'
    await nextTick()

    expect(useState('finance-active-tab').value).toBe('integrations')
  })

  it('ignores an unknown tab name', async () => {
    const { query } = mountWithQuery({ tab: 'exports' })
    query.tab = 'not-a-tab'
    await nextTick()

    expect(useState('finance-active-tab').value).toBe('exports')
  })
})
