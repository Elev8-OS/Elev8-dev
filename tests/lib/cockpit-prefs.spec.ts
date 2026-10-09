// The Cockpit remembers period, view, tags, filters and folded listings per
// browser. These pin that a save comes back, that missing or broken data falls
// back to the defaults, and that new filter fields get their defaults.

import { beforeEach, describe, expect, it } from 'vitest'
import { COCKPIT_PREFS_KEY, DEFAULT_COCKPIT_PREFS, loadCockpitPrefs, saveCockpitPrefs } from '~/components/cockpit/data/cockpit-prefs'

describe('cockpit prefs', () => {
  beforeEach(() => localStorage.removeItem(COCKPIT_PREFS_KEY))

  it('falls back to the defaults when nothing is saved', () => {
    expect(loadCockpitPrefs()).toEqual(DEFAULT_COCKPIT_PREFS)
  })

  it('reads back what was saved', () => {
    const prefs = { ...DEFAULT_COCKPIT_PREFS, range: 'month' as const, tags: ['Bali'], collapsed: ['lst-1'] }
    saveCockpitPrefs(prefs)
    expect(loadCockpitPrefs()).toEqual(prefs)
  })

  it('ignores unreadable data', () => {
    localStorage.setItem(COCKPIT_PREFS_KEY, '{not json')
    expect(loadCockpitPrefs()).toEqual(DEFAULT_COCKPIT_PREFS)
  })

  it('fills filter fields an older save did not have', () => {
    localStorage.setItem(COCKPIT_PREFS_KEY, JSON.stringify({ range: '7', filters: { statuses: ['verified'] } }))
    const prefs = loadCockpitPrefs()
    expect(prefs.range).toBe('7')
    expect(prefs.filters).toEqual({ ...DEFAULT_COCKPIT_PREFS.filters, statuses: ['verified'] })
  })
})
