import type { Listing } from '~/components/listings/data/listings'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { toRaw } from 'vue'
import { listingGuideItems } from '~/components/listings/data/guest-guide-content'
import { applyListingInfo, copyListingInfoToListings, listingInfoPartCount } from '~/components/listings/data/listing-info-copy'
import { listings } from '~/components/listings/data/listings'

let snapshot: Listing[]
beforeEach(() => { snapshot = JSON.parse(JSON.stringify(toRaw(listings.value))) })
afterEach(() => { listings.value = snapshot })

const byId = (id: string) => listings.value.find(l => l.id === id)!

describe('copy listing info', () => {
  it('copies only the chosen parts and leaves the source alone', () => {
    const source = { ...byId('lst-1'), amenities: ['Pool'], details: { ...byId('lst-1').details, parking: 'Free on site' } }
    const target = byId('lst-2')
    const next = applyListingInfo(source, target, ['arrival'])
    expect(next.details?.parking).toBe('Free on site')
    expect(next.amenities).toEqual(target.amenities)
    expect(next.name).toBe(target.name)
  })

  it('never copies Wi-Fi or the descriptions', () => {
    const source = { ...byId('lst-1'), wifiSsid: 'Villa-Net', wifiPassword: 'secret' }
    const target = { ...byId('lst-2'), wifiSsid: 'Other' }
    const next = applyListingInfo(source, target, ['details'])
    expect(next.wifiSsid).toBe('Other')
    expect(next.wifiPassword).toBe(target.wifiPassword)
  })

  it('does not wipe an answer with an empty one, but replaces amenities', () => {
    const source = { ...byId('lst-1'), amenities: ['Pool'], details: { ...byId('lst-1').details, trash: '' } }
    const target = { ...byId('lst-2'), details: { trash: 'Behind the gate' } }
    const next = applyListingInfo(source, target, ['arrival', 'amenities'])
    expect(next.details?.trash).toBe('Behind the gate')
    expect(next.amenities).toEqual(['Pool'])
  })

  it('writes the picked listings, never the source', () => {
    expect(copyListingInfoToListings(byId('lst-1'), ['lst-2', 'lst-1'], ['amenities'])).toBe(1)
    expect(byId('lst-2').amenities).toEqual(byId('lst-1').amenities)
  })

  it('counts what a listing has for a part', () => {
    expect(listingInfoPartCount({ ...byId('lst-1'), amenities: [] }, 'amenities')).toBe(0)
    expect(listingInfoPartCount(byId('lst-1'), 'guide_checkin')).toBeGreaterThan(0)
  })

  it('copies guest guide pieces one by one', () => {
    const source = byId('lst-1')
    const target = { ...byId('lst-2'), petPolicy: { allowed: false, packageIds: [] } }
    const next = applyListingInfo(source, target, ['guide_checkin'])
    expect(listingGuideItems(next, 'checkin').map(i => i.title)).toEqual(listingGuideItems(source, 'checkin').map(i => i.title))
    expect(listingGuideItems(next, 'checkin')[0]!.id).not.toBe(listingGuideItems(source, 'checkin')[0]!.id)
    expect(next.petPolicy).toEqual(target.petPolicy)
    expect(listingGuideItems(next, 'checkout')).toEqual(listingGuideItems(target, 'checkout'))
    const withVisibility = applyListingInfo({ ...source, checkinStepsVisibility: { mode: 'always', hoursBefore: 24 } }, target, ['guide_checkin_visibility'])
    expect(withVisibility.checkinStepsVisibility?.mode).toBe('always')
  })
})
