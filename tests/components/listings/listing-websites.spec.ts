import type { WebsiteChannelState } from '~/components/channels/data/website-channel'
import type { Website } from '~/components/website-builder/data/websites'
import { describe, expect, it } from 'vitest'
import { defaultWebsiteState, newRuleSet } from '~/components/channels/data/website-channel'
import { websitesForListing } from '~/components/listings/data/listing-websites'

type Site = Pick<Website, 'id' | 'name' | 'url' | 'status' | 'propertyIds'>

// prop-1 covers lst-1 and lst-5, prop-2 covers lst-12 (property-listings.ts).
const SITES: Site[] = [
  { id: 'a', name: 'Site A', url: 'a.com', status: 'published', propertyIds: ['prop-1'] },
  { id: 'b', name: 'Site B', url: 'b.com', status: 'draft', propertyIds: ['prop-2'] },
  { id: 'c', name: 'Site C', url: 'c.com', status: 'building', propertyIds: ['prop-1', 'prop-2'] },
  { id: 'd', name: 'No coverage', url: 'd.com', status: 'published' },
  { id: 'e', name: 'Empty coverage', url: 'e.com', status: 'published', propertyIds: [] },
]

function stateWith(...sets: { name: string, websiteIds: string[] }[]): WebsiteChannelState {
  return { enabled: true, ruleSets: sets.map(s => ({ ...newRuleSet(s.name), websiteIds: s.websiteIds })) }
}

describe('websitesForListing', () => {
  it('returns the sites whose properties cover the listing, in order', () => {
    expect(websitesForListing('lst-1', SITES, defaultWebsiteState()).map(r => r.websiteId)).toEqual(['a', 'c'])
    expect(websitesForListing('lst-12', SITES, defaultWebsiteState()).map(r => r.websiteId)).toEqual(['b', 'c'])
  })

  it('leaves out sites with no coverage set', () => {
    const ids = websitesForListing('lst-1', SITES, defaultWebsiteState()).map(r => r.websiteId)
    expect(ids).not.toContain('d')
    expect(ids).not.toContain('e')
  })

  it('returns nothing for a listing no site sells', () => {
    expect(websitesForListing('lst-999', SITES, defaultWebsiteState())).toEqual([])
  })

  it('copies the site fields and names the rule set, or null when in none', () => {
    const rows = websitesForListing('lst-1', SITES, stateWith({ name: 'Summer', websiteIds: ['c'] }))
    expect(rows).toEqual([
      { websiteId: 'a', name: 'Site A', url: 'a.com', status: 'published', ruleSetName: null },
      { websiteId: 'c', name: 'Site C', url: 'c.com', status: 'building', ruleSetName: 'Summer' },
    ])
  })
})
