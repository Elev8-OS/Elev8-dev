import type { Listing } from '~/components/listings/data/listings'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { toRaw } from 'vue'
import { listingGuideItems } from '~/components/listings/data/guest-guide-content'
import { listingGuestVerification } from '~/components/listings/data/guest-verification'
import { applyGuideSetup, copyGuideItemsToListings, copyGuideSetupToListings, removeGuideItems } from '~/components/listings/data/guide-bulk'
import { listings } from '~/components/listings/data/listings'

let snapshot: Listing[]
beforeEach(() => { snapshot = JSON.parse(JSON.stringify(toRaw(listings.value))) })
afterEach(() => { listings.value = snapshot })

const byId = (id: string) => listings.value.find(l => l.id === id)!

describe('guest guide bulk actions', () => {
  it('removes the selected items of one section', () => {
    const l = byId('lst-1')
    const [first, ...rest] = listingGuideItems(l, 'checkin')
    expect(listingGuideItems(removeGuideItems(l, 'checkin', [first!.id]), 'checkin').map(i => i.id)).toEqual(rest.map(i => i.id))
  })

  it('copies items to the end of other listings\' same section, with fresh ids and no room label', () => {
    const items = [{ id: 'a', title: 'Ring the bell', roomName: 'Master Suite' }]
    const before = listingGuideItems(byId('lst-2'), 'checkin').length
    expect(copyGuideItemsToListings('lst-1', 'checkin', items, ['lst-2', 'lst-1'])).toBe(1)
    const after = listingGuideItems(byId('lst-2'), 'checkin')
    expect(after).toHaveLength(before + 1)
    expect(after.at(-1)).toMatchObject({ title: 'Ring the bell' })
    expect(after.at(-1)!.id).not.toBe('a')
    expect(after.at(-1)).not.toHaveProperty('roomName')
  })
})

describe('copy the whole guest guide setup', () => {
  it('replaces the content and copies verification and pets, but not a room\'s own items', () => {
    const source = byId('lst-1')
    const next = applyGuideSetup(source, byId('lst-2'), ['content', 'verification', 'pets'])
    expect(listingGuideItems(next, 'checkin').map(i => i.title)).toEqual(listingGuideItems(source, 'checkin').map(i => i.title))
    expect(listingGuideItems(next, 'checkin')[0]!.id).not.toBe(listingGuideItems(source, 'checkin')[0]!.id)
    expect(next.guestVerification).toEqual(listingGuestVerification(source))
    expect(next.petPolicy).toEqual(source.petPolicy)
    expect(listingGuideItems(next, 'checkin').some(i => i.title === 'Find the Master Suite')).toBe(false)
  })

  it('leaves out the parts that are not picked', () => {
    const target = byId('lst-2')
    const next = applyGuideSetup(byId('lst-1'), target, ['pets'])
    expect(next.guestGuide).toEqual(target.guestGuide)
    expect(next.guestVerification).toEqual(target.guestVerification)
  })

  it('writes every picked listing, never the source', () => {
    expect(copyGuideSetupToListings(byId('lst-1'), ['lst-2', 'lst-3', 'lst-1'], ['pets'])).toBe(2)
    expect(byId('lst-3').petPolicy).toEqual(byId('lst-1').petPolicy)
  })
})
