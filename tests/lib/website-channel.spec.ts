import type { WebsiteRuleSet } from '~/components/channels/data/website-channel'
import { afterEach, describe, expect, it } from 'vitest'
import { resolveWidgetBookingRules, resolveWidgetStayDiscounts } from '~/components/booking-widget/data/widgets'
import {
  defaultWebsiteState,
  newRuleSet,
  parseWebsiteState,
  ruleSetForWebsite,
  ruleSetIssues,
  unassignedWebsiteIds,
  upsertRuleSet,
  websiteChannel,
} from '~/components/channels/data/website-channel'
import { useWebsiteChannel } from '~/composables/useWebsiteChannel'

// Module-level ref: the useState reset in setup.ts does not touch it.
afterEach(() => {
  websiteChannel.value = defaultWebsiteState()
  localStorage.removeItem('elev8-website-channel')
})

function set(id: string, name: string, websiteIds: string[] = []): WebsiteRuleSet {
  return { ...newRuleSet(name), id, websiteIds }
}

describe('ruleSetIssues', () => {
  it('needs a name and at least one website', () => {
    expect(ruleSetIssues(newRuleSet(), []).map(i => i.field)).toEqual(['name', 'websites'])
    expect(ruleSetIssues(set('a', 'Bali', ['1']), [])).toEqual([])
  })

  it('needs a unique name, ignoring case', () => {
    const existing = [set('a', 'Long stay', ['1'])]
    expect(ruleSetIssues(set('b', 'long STAY', ['2']), existing).map(i => i.field)).toEqual(['name'])
    expect(ruleSetIssues(set('a', 'Long stay', ['1']), existing)).toEqual([])
  })

  it('flags duplicate tiers, bad percents and a 1-night tier', () => {
    const s = set('a', 'A', ['1'])
    s.lengthOfStayDiscounts = [
      { id: 'x', minNights: 7, pct: 10 },
      { id: 'y', minNights: 7, pct: 120 },
      { id: 'z', minNights: 1, pct: 5 },
    ]
    expect(ruleSetIssues(s, []).map(i => i.field)).toEqual(['los-y', 'los-y', 'los-z'])
  })

  it('refuses a last minute window that overlaps early bird, and max below min stay', () => {
    const s = { ...set('a', 'A', ['1']), minNights: 5, maxNights: 3 }
    s.earlyBird = { enabled: true, days: 10, pct: 5 }
    s.lastMinute = { enabled: true, days: 10, pct: 5 }
    expect(ruleSetIssues(s, []).map(i => i.field)).toEqual(['lastMinute', 'maxNights'])
  })
})

describe('website assignment', () => {
  const ruleSets = [set('long', 'Long stay', ['1', '2']), set('beach', 'Beach', ['3'])]
  const state = { enabled: true, ruleSets }

  it('finds the rule set of a website, or none', () => {
    expect(ruleSetForWebsite(state, '1')?.id).toBe('long')
    expect(ruleSetForWebsite(state, '4')).toBeUndefined()
    expect(unassignedWebsiteIds(state, ['1', '2', '3', '4'])).toEqual(['4'])
  })

  it('moves a website out of its old rule set, keeping order', () => {
    const next = upsertRuleSet(ruleSets, set('city', 'City', ['2', '4']))
    expect(next.map(r => r.id)).toEqual(['long', 'beach', 'city'])
    expect(next[0]!.websiteIds).toEqual(['1'])

    const edited = upsertRuleSet(next, { ...next[0]!, websiteIds: ['1', '3'] })
    expect(edited.map(r => r.id)).toEqual(['long', 'beach', 'city'])
    expect(edited[1]!.websiteIds).toEqual([])
  })
})

describe('useWebsiteChannel', () => {
  it('is added by saving the first rule set, and keeps rule sets when removed', () => {
    const { disable, enable, ruleSets, saveRuleSet, websiteChannel: state } = useWebsiteChannel()
    expect(state.value.enabled).toBe(false)
    expect(saveRuleSet(set('b', 'Beach'))).toHaveLength(1)
    expect(state.value.enabled).toBe(false)
    expect(saveRuleSet(set('b', 'Beach', ['1']))).toEqual([])
    expect(state.value.enabled).toBe(true)
    disable()
    enable()
    expect(ruleSets.value.map(r => r.id)).toEqual(['b'])
  })

  it('deletes a rule set, leaving its websites in none', () => {
    const { saveRuleSet, deleteRuleSet, ruleSets } = useWebsiteChannel()
    saveRuleSet(set('b', 'Beach', ['1']))
    expect(deleteRuleSet('missing')).toBe(false)
    expect(deleteRuleSet('b')).toBe(true)
    expect(ruleSets.value).toEqual([])
    expect(ruleSetForWebsite(websiteChannel.value, '1')).toBeUndefined()
  })
})

describe('resolveWidgetStayDiscounts', () => {
  const own = [{ id: 'w', minNights: 5, discountType: 'fixed' as const, value: 50 }]
  const tiers = [
    { id: 'wlos-1', minNights: 7, discountType: '%', value: 10 },
    { id: 'wlos-2', minNights: 28, discountType: '%', value: 20 },
  ]

  it('uses the picked rule set while the channel is added, else its own', () => {
    expect(resolveWidgetStayDiscounts({ lengthOfStayDiscounts: own, websiteRuleSetId: 'b' })).toEqual(own)
    const { saveRuleSet, disable, deleteRuleSet } = useWebsiteChannel()
    saveRuleSet(set('b', 'Beach', ['1']))
    expect(resolveWidgetStayDiscounts({ lengthOfStayDiscounts: own, websiteRuleSetId: null })).toEqual(own)
    expect(resolveWidgetStayDiscounts({ lengthOfStayDiscounts: own, websiteRuleSetId: 'b' })).toEqual(tiers)
    disable()
    expect(resolveWidgetStayDiscounts({ lengthOfStayDiscounts: own, websiteRuleSetId: 'b' })).toEqual(own)
    useWebsiteChannel().enable()
    deleteRuleSet('b')
    expect(resolveWidgetStayDiscounts({ lengthOfStayDiscounts: own, websiteRuleSetId: 'b' })).toEqual(own)
  })
})

describe('resolveWidgetBookingRules', () => {
  const widget = {
    lengthOfStayDiscounts: [],
    minDaysBeforeArrival: 2,
    arrivalDays: [6],
    departureDays: undefined,
    prepayment: { mode: 'currency' as const, value: 100 },
  }

  it('replaces the widget rules wholesale with the rule set', () => {
    const { saveRuleSet } = useWebsiteChannel()
    saveRuleSet({ ...set('b', 'Beach', ['1']), minNights: 3, maxNights: 14, minDaysBeforeArrival: 1, arrivalDays: [], prepaymentPct: 40, lastMinute: { enabled: true, days: 3, pct: 10 } })
    const rules = resolveWidgetBookingRules({ ...widget, websiteRuleSetId: 'b' })
    expect(rules).toMatchObject({
      ruleSetName: 'Beach',
      minNights: 3,
      maxNights: 14,
      minDaysBeforeArrival: 1,
      arrivalDays: null,
      prepayment: { mode: 'percent', value: 40 },
      earlyBird: null,
      lastMinute: { enabled: true, days: 3, pct: 10 },
    })
  })

  it('keeps the widget rules without a rule set', () => {
    expect(resolveWidgetBookingRules({ ...widget, websiteRuleSetId: null })).toMatchObject({
      ruleSetName: null,
      minDaysBeforeArrival: 2,
      arrivalDays: [6],
      prepayment: { mode: 'currency', value: 100 },
    })
  })
})

describe('persistence', () => {
  it('saves to localStorage and reads it back, dropping old promo code ids', () => {
    useWebsiteChannel().saveRuleSet(set('b', 'Beach', ['1']))
    const raw = localStorage.getItem('elev8-website-channel')
    expect(parseWebsiteState(raw)?.ruleSets.map(r => r.name)).toEqual(['Beach'])
    const legacy = JSON.stringify({ enabled: true, ruleSets: [{ id: 'x', name: 'Old', websiteIds: ['2'], promoCodeIds: ['p'] }] })
    const parsed = parseWebsiteState(legacy)!
    expect(parsed.ruleSets[0]).not.toHaveProperty('promoCodeIds')
    expect(parsed.ruleSets[0]!.prepaymentPct).toBe(30)
    expect(parseWebsiteState('{bad')).toBeNull()
  })
})

describe('assignWebsite', () => {
  it('moves one website between rule sets or out of all', () => {
    const { saveRuleSet, assignWebsite, ruleSets } = useWebsiteChannel()
    saveRuleSet(set('a', 'A', ['1']))
    saveRuleSet(set('b', 'B', ['2']))
    assignWebsite('1', 'b')
    expect(ruleSets.value.map(r => r.websiteIds)).toEqual([[], ['2', '1']])
    assignWebsite('2', null)
    expect(ruleSets.value.map(r => r.websiteIds)).toEqual([[], ['1']])
  })
})
