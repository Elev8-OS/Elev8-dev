import type { Listing } from '~/components/listings/data/listings'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { toRaw } from 'vue'
import { listingGuideItems } from '~/components/listings/data/guest-guide-content'
import { listingGuestVerification } from '~/components/listings/data/guest-verification'
import { applyGuideSetup, copyGuideItemsToListings, copyGuideSetupToListings, importGuestVerification, importGuideItems, importPetPolicy, removeGuideItems } from '~/components/listings/data/guide-bulk'
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
  it('replaces the content (pets come with the house rules) and copies verification, but not a room\'s own items', () => {
    const source = byId('lst-1')
    const next = applyGuideSetup(source, byId('lst-2'), ['content', 'verification'])
    expect(listingGuideItems(next, 'checkin').map(i => i.title)).toEqual(listingGuideItems(source, 'checkin').map(i => i.title))
    expect(listingGuideItems(next, 'checkin')[0]!.id).not.toBe(listingGuideItems(source, 'checkin')[0]!.id)
    expect(next.guestVerification).toEqual(listingGuestVerification(source))
    expect(next.petPolicy).toEqual(source.petPolicy)
    expect(listingGuideItems(next, 'checkin').some(i => i.title === 'Find the Master Suite')).toBe(false)
  })

  it('leaves out the parts that are not picked', () => {
    const target = byId('lst-2')
    const next = applyGuideSetup(byId('lst-1'), target, ['verification'])
    expect(next.guestGuide).toEqual(target.guestGuide)
    expect(next.petPolicy).toEqual(target.petPolicy)
  })

  it('writes every picked listing, never the source', () => {
    expect(copyGuideSetupToListings(byId('lst-1'), ['lst-2', 'lst-3', 'lst-1'], ['content'])).toHaveLength(2)
    expect(byId('lst-3').petPolicy).toEqual(byId('lst-1').petPolicy)
  })

  it('imports another listing\'s items to the end, as copies without a room label', () => {
    const target = byId('lst-1')
    const source = [{ id: 'z', title: 'Ring the bell', roomName: 'Master Suite' }]
    const before = listingGuideItems(target, 'checkout')
    const next = listingGuideItems(importGuideItems(target, 'checkout', source, 'append'), 'checkout')
    expect(next).toHaveLength(before.length + 1)
    expect(next.slice(0, before.length).map(i => i.id)).toEqual(before.map(i => i.id))
    expect(next.at(-1)).toMatchObject({ title: 'Ring the bell' })
    expect(next.at(-1)!.id).not.toBe('z')
    expect(next.at(-1)).not.toHaveProperty('roomName')
  })

  it('replaces the section when importing in replace mode, and leaves the other sections alone', () => {
    const target = byId('lst-1')
    const next = importGuideItems(target, 'checkout', [{ id: 'z', title: 'Ring the bell' }], 'replace')
    expect(listingGuideItems(next, 'checkout').map(i => i.title)).toEqual(['Ring the bell'])
    expect(listingGuideItems(next, 'checkin')).toEqual(listingGuideItems(target, 'checkin'))
  })

  it('brings the check-in steps timing along with the content', () => {
    const source = { ...byId('lst-1'), checkinStepsVisibility: { mode: 'always' as const, hoursBefore: 24 } }
    expect(applyGuideSetup(source, byId('lst-2'), ['content']).checkinStepsVisibility).toEqual({ mode: 'always', hoursBefore: 24 })
    expect(applyGuideSetup(source, byId('lst-2'), ['verification']).checkinStepsVisibility).toEqual(byId('lst-2').checkinStepsVisibility)
  })

  it('leaves out a pet package the target does not offer, and reports it', () => {
    const source = { ...byId('lst-1'), petPolicy: { allowed: true, packageIds: ['keep', 'drop'] } }
    const target = byId('lst-2')
    const results = copyGuideSetupToListings(source, [target.id], ['content'], (id, name) => id === 'keep' && name === target.name)
    expect(results).toEqual([{ listingId: target.id, listingName: target.name, skippedPackageIds: ['drop'] }])
    expect(byId(target.id).petPolicy).toEqual({ allowed: true, packageIds: ['keep'] })
  })

  it('imports guest verification and pets from another listing, replacing the target\'s', () => {
    const source = { ...byId('lst-1'), guestVerification: { mode: 'none' as const, requireAddress: true, askBedConfiguration: false, allGuestsUploadDocuments: false }, petPolicy: { allowed: true, packageIds: ['a', 'b'] } }
    const target = byId('lst-2')
    expect(importGuestVerification(target, source).guestVerification).toEqual(source.guestVerification)
    const { listing, skippedPackageIds } = importPetPolicy(target, source, id => id === 'a')
    expect(listing.petPolicy).toEqual({ allowed: true, packageIds: ['a'] })
    expect(skippedPackageIds).toEqual(['b'])
  })
})
