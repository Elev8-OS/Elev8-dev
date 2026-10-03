import type { Listing } from '~/components/listings/data/listings'
import { describe, expect, it } from 'vitest'
import {
  aiKnowledgeFields,
  aiKnowledgeFieldSpec,
  applyAiKnowledge,
  readAiKnowledge,
} from '~/lib/ai-knowledge'

function listing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: 'lst-1',
    name: 'Villa Luwa',
    amenities: ['Pool', 'WiFi'],
    checkInInstructions: 'Meet at the gate.',
    resources: {
      documents: [],
      basics: { description: 'A serene villa.', checkInTime: '14:00' },
      listingDetails: 'Two floors.',
      topicsToAvoid: [],
      propertyUpsells: [],
    },
    ...overrides,
  } as unknown as Listing
}

describe('reading what ElevAI answered from', () => {
  it('reads a basics field', () => {
    expect(readAiKnowledge(listing(), 'description')).toBe('A serene villa.')
    expect(readAiKnowledge(listing(), 'checkInTime')).toBe('14:00')
  })

  it('reads old free-text check-in instructions as a single step', () => {
    expect(readAiKnowledge(listing(), 'checkInInstructions')).toBe('1. On arrival: Meet at the gate.')
  })

  it('reads the listing\'s guest guide steps and rules as one line each', () => {
    const l = listing({
      guestGuide: {
        checkin: [{ id: 'a', title: 'Park at the gate' }, { id: 'b', title: 'Ring the bell', text: 'Staff answer within a minute.' }],
        house_rules: [{ id: 'r', title: 'No smoking inside' }],
      },
    })
    expect(readAiKnowledge(l, 'checkInInstructions')).toBe('1. Park at the gate\n2. Ring the bell: Staff answer within a minute.')
    expect(readAiKnowledge(l, 'houseRules')).toBe('No smoking inside')
  })

  it('renders amenities as a comma list, because that is how they are edited', () => {
    expect(readAiKnowledge(listing(), 'amenities')).toBe('Pool, WiFi')
  })

  it('reads an unset field as empty rather than undefined', () => {
    expect(readAiKnowledge(listing(), 'houseRules')).toBe('')
    expect(readAiKnowledge(listing({ checkOutInstructions: undefined }), 'checkOutInstructions')).toBe('')
  })
})

describe('correcting guest guide content from the reasoning dialog', () => {
  it('rewrites the steps, keeping the photo of a step whose title did not change', () => {
    const before = listing({ guestGuide: { checkin: [{ id: 'a', title: 'Park at the gate', photoUrl: 'data:image/png;base64,A' }] } })
    const [after] = applyAiKnowledge([before], { listingId: 'lst-1', field: 'checkInInstructions' }, '1. Park at the gate: North side\n2. Ring the bell')
    expect(after!.guestGuide!.checkin!.map(i => i.title)).toEqual(['Park at the gate', 'Ring the bell'])
    expect(after!.guestGuide!.checkin![0]).toMatchObject({ id: 'a', text: 'North side', photoUrl: 'data:image/png;base64,A' })
  })
})

describe('correcting a listing from the reasoning dialog', () => {
  it('writes a basics field without touching the rest of the listing', () => {
    const before = listing()
    const after = applyAiKnowledge([before], { listingId: 'lst-1', field: 'description' }, 'A heated-pool villa.')

    expect(after[0]!.resources.basics.description).toBe('A heated-pool villa.')
    expect(after[0]!.resources.basics.checkInTime).toBe('14:00')
    expect(after[0]!.resources.listingDetails).toBe('Two floors.')
  })

  it('never mutates the listing it was given', () => {
    const before = listing()
    applyAiKnowledge([before], { listingId: 'lst-1', field: 'description' }, 'Changed.')

    expect(before.resources.basics.description).toBe('A serene villa.')
  })

  it('returns a new array, so the store assignment triggers reactivity', () => {
    const list = [listing()]
    expect(applyAiKnowledge(list, { listingId: 'lst-1', field: 'description' }, 'x')).not.toBe(list)
  })

  it('splits amenities back into a list and drops the blanks', () => {
    const after = applyAiKnowledge([listing()], { listingId: 'lst-1', field: 'amenities' }, 'Pool, WiFi , Heated Pool, ,')
    expect(after[0]!.amenities).toEqual(['Pool', 'WiFi', 'Heated Pool'])
  })

  it('leaves the other listings alone', () => {
    const other = listing({ id: 'lst-2', name: 'Other' })
    const after = applyAiKnowledge([listing(), other], { listingId: 'lst-1', field: 'description' }, 'Changed.')

    expect(after[1]).toBe(other)
  })

  it('is a no-op when the listing is gone, rather than throwing at the host', () => {
    const list = [listing()]
    expect(applyAiKnowledge(list, { listingId: 'lst-99', field: 'description' }, 'x')).toBe(list)
  })
})

describe('the editable field allowlist', () => {
  it('gives every field a label, a section and an input kind', () => {
    for (const [field, spec] of Object.entries(aiKnowledgeFields)) {
      expect(spec.label, field).toBeTruthy()
      // Where the host finds it: Listing Setup, or the listing's Guest Guide tab for guide content.
      expect(spec.section, field).toMatch(/^Listing (Setup|→ Guest Guide)/)
      expect(['text', 'textarea', 'list'], field).toContain(spec.input)
    }
  })

  it('resolves a spec by field', () => {
    expect(aiKnowledgeFieldSpec('amenities').input).toBe('list')
  })
})
