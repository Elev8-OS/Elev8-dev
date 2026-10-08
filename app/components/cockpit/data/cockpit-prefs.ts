import type { CockpitRange, CockpitStayFilters } from './cockpit'
import { DEFAULT_STAY_FILTERS } from './cockpit'

/**
 * The Cockpit remembers how each person left it: period, tags, filters and
 * folded listings. Per browser, in `localStorage`;
 * the start date is not kept, so the board always opens on today.
 */
export interface CockpitPrefs {
  range: CockpitRange
  customDays: number
  tags: string[]
  filters: CockpitStayFilters
  collapsed: string[]
}

export const COCKPIT_PREFS_KEY = 'elev8.cockpit.prefs'

export const DEFAULT_COCKPIT_PREFS: CockpitPrefs = {
  range: '28',
  customDays: 28,
  tags: [],
  filters: DEFAULT_STAY_FILTERS,
  collapsed: [],
}

/** Saved prefs over the defaults; anything missing or unreadable falls back. */
export function loadCockpitPrefs(): CockpitPrefs {
  try {
    if (typeof localStorage === 'undefined')
      return DEFAULT_COCKPIT_PREFS
    const raw = localStorage.getItem(COCKPIT_PREFS_KEY)
    if (!raw)
      return DEFAULT_COCKPIT_PREFS
    const saved = JSON.parse(raw) as Partial<CockpitPrefs>
    return {
      range: saved.range ?? DEFAULT_COCKPIT_PREFS.range,
      customDays: saved.customDays ?? DEFAULT_COCKPIT_PREFS.customDays,
      tags: saved.tags ?? DEFAULT_COCKPIT_PREFS.tags,
      filters: { ...DEFAULT_STAY_FILTERS, ...saved.filters },
      collapsed: saved.collapsed ?? DEFAULT_COCKPIT_PREFS.collapsed,
    }
  }
  catch {
    return DEFAULT_COCKPIT_PREFS
  }
}

export function saveCockpitPrefs(prefs: CockpitPrefs) {
  try {
    if (typeof localStorage !== 'undefined')
      localStorage.setItem(COCKPIT_PREFS_KEY, JSON.stringify(prefs))
  }
  catch {
    // Private mode or full storage: the board still works, it just forgets.
  }
}
