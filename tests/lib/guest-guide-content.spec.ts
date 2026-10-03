import { describe, expect, it } from 'vitest'
import { cleanGuideItems, cloneGuideItems, guideItemsAsText, guideItemsFromText, listingGuideContent, listingGuideItems } from '~/components/listings/data/guest-guide-content'

describe('listingGuideItems', () => {
  it('reads structured content first', () => {
    const l = { guestGuide: { checkin: [{ id: 'a', title: 'Park' }] }, checkInInstructions: 'Old text' }
    expect(listingGuideItems(l, 'checkin')).toEqual([{ id: 'a', title: 'Park' }])
  })

  it('falls back to the old free text so nothing disappears before a re-save', () => {
    const l = { checkInInstructions: 'Meet at the gate.', checkOutInstructions: 'Keys on the table.', resources: { basics: { houseRules: 'No smoking\n\nNo parties' } } }
    expect(listingGuideItems(l, 'checkin')).toEqual([{ id: 'legacy-checkin', title: 'On arrival', text: 'Meet at the gate.' }])
    expect(listingGuideItems(l, 'checkout')[0]!.text).toBe('Keys on the table.')
    expect(listingGuideItems(l, 'house_rules').map(r => r.title)).toEqual(['No smoking', 'No parties'])
    expect(listingGuideItems(l, 'good_to_know')).toEqual([])
  })

  it('treats an empty structured list as set, not as missing', () => {
    expect(listingGuideItems({ guestGuide: { checkin: [] }, checkInInstructions: 'Old' }, 'checkin')).toEqual([])
  })

  it('returns all four kinds for the guide endpoint', () => {
    expect(Object.keys(listingGuideContent(null))).toEqual(['checkin', 'checkout', 'house_rules', 'good_to_know'])
  })
})

describe('cleaning and copying items', () => {
  it('trims, drops untitled items and empty fields', () => {
    expect(cleanGuideItems([
      { id: 'a', title: ' Park ', text: '  ', icon: 'lucide:car' },
      { id: 'b', title: '  ' },
    ])).toEqual([{ id: 'a', title: 'Park', icon: 'lucide:car' }])
  })

  it('copies with fresh ids', () => {
    const [copy] = cloneGuideItems([{ id: 'a', title: 'Park', photoUrl: 'data:x' }])
    expect(copy).toMatchObject({ title: 'Park', photoUrl: 'data:x' })
    expect(copy!.id).not.toBe('a')
  })
})

describe('text round trip for ElevAI', () => {
  it('writes numbered or plain lines, and reads them back keeping matching photos', () => {
    const items = [{ id: 'a', title: 'Park', text: 'North gate', photoUrl: 'data:p' }, { id: 'b', title: 'Ring the bell' }]
    const text = guideItemsAsText(items, true)
    expect(text).toBe('1. Park: North gate\n2. Ring the bell')
    expect(guideItemsAsText(items, false)).toBe('Park: North gate\nRing the bell')
    const back = guideItemsFromText('1. Park: South gate\n- Wave hello', items)
    expect(back[0]).toEqual({ id: 'a', title: 'Park', text: 'South gate', photoUrl: 'data:p' })
    expect(back[1]!.title).toBe('Wave hello')
  })
})
