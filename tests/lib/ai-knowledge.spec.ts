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

  it('reads a top-level listing field', () => {
    expect(readAiKnowledge(listing(), 'checkInInstructions')).toBe('Meet at the gate.')
  })

  it('renders amenities as a comma list, because that is how they are edited', () => {
    expect(readAiKnowledge(listing(), 'amenities')).toBe('Pool, WiFi')
  })

  it('reads an unset field as empty rather than undefined', () => {
    expect(readAiKnowledge(listing(), 'houseRules')).toBe('')
    expect(readAiKnowledge(listing({ checkOutInstructions: undefined }), 'checkOutInstructions')).toBe('')
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
      expect(spec.section, field).toContain('Listing Setup')
      expect(['text', 'textarea', 'list'], field).toContain(spec.input)
    }
  })

  it('resolves a spec by field', () => {
    expect(aiKnowledgeFieldSpec('amenities').input).toBe('list')
  })
})
