import type { GuideContentKind } from '~/components/listings/data/guest-guide-content'
import type { Listing } from '~/components/listings/data/listings'
import { GUIDE_CONTENT_META, guideItemsAsText, guideItemsFromText, listingGuideItems } from '~/components/listings/data/guest-guide-content'

/**
 * The listing fields ElevAI answers from, and which a host can correct when a
 * reply came out wrong. Deliberately a small allowlist rather than a free path
 * into `Listing`: an editor that can write anywhere is an editor nobody can
 * review.
 */
export type AiKnowledgeField
  = | 'description'
    | 'houseRules'
    | 'neighborhood'
    | 'checkInTime'
    | 'checkOutTime'
    | 'listingDetails'
    | 'sops'
    | 'amenities'
    | 'checkInInstructions'
    | 'checkOutInstructions'

/** Points a reply at the one listing field it leaned on. */
export interface AiKnowledgeSource {
  listingId: string
  field: AiKnowledgeField
}

export interface AiKnowledgeFieldSpec {
  /** What the host sees, e.g. "House rules". */
  label: string
  /** Where the field lives in Listing Setup, so the host can find it again. */
  section: string
  input: 'text' | 'textarea' | 'list'
  placeholder: string
  read: (listing: Listing) => string
  /** Returns a new Listing. Never mutates the one passed in. */
  write: (listing: Listing, value: string) => Listing
}

function writeBasics(listing: Listing, key: 'description' | 'neighborhood' | 'checkInTime' | 'checkOutTime', value: string): Listing {
  return {
    ...listing,
    resources: {
      ...listing.resources,
      basics: { ...listing.resources.basics, [key]: value },
    },
  }
}

/**
 * Guest guide content as text for ElevAI, and back. The listing owns it
 * (`guest-guide-content.ts`); a host correction rewrites the items line by
 * line, keeping the photo of any item whose title is unchanged.
 */
function guideField(kind: GuideContentKind, label: string, placeholder: string): AiKnowledgeFieldSpec {
  return {
    label,
    section: 'Listing → Guest Guide',
    input: 'textarea',
    placeholder,
    read: l => guideItemsAsText(listingGuideItems(l, kind), GUIDE_CONTENT_META[kind].numbered),
    write: (l, v) => ({ ...l, guestGuide: { ...l.guestGuide, [kind]: guideItemsFromText(v, listingGuideItems(l, kind)) } }),
  }
}

export const aiKnowledgeFields: Record<AiKnowledgeField, AiKnowledgeFieldSpec> = {
  description: {
    label: 'Property description',
    section: 'Listing Setup → Basics',
    input: 'textarea',
    placeholder: 'Describe the property the way you want ElevAI to describe it.',
    read: l => l.resources.basics.description ?? '',
    write: (l, v) => writeBasics(l, 'description', v),
  },
  houseRules: guideField('house_rules', 'House rules', 'One rule per line. "Rule: why" adds a description.'),
  neighborhood: {
    label: 'Neighbourhood',
    section: 'Listing Setup → Basics',
    input: 'textarea',
    placeholder: 'What is nearby, and how far.',
    read: l => l.resources.basics.neighborhood ?? '',
    write: (l, v) => writeBasics(l, 'neighborhood', v),
  },
  checkInTime: {
    label: 'Check-in time',
    section: 'Listing Setup → Basics',
    input: 'text',
    placeholder: '14:00',
    read: l => l.resources.basics.checkInTime ?? '',
    write: (l, v) => writeBasics(l, 'checkInTime', v),
  },
  checkOutTime: {
    label: 'Check-out time',
    section: 'Listing Setup → Basics',
    input: 'text',
    placeholder: '11:00',
    read: l => l.resources.basics.checkOutTime ?? '',
    write: (l, v) => writeBasics(l, 'checkOutTime', v),
  },
  listingDetails: {
    label: 'Listing details',
    section: 'Listing Setup → Listing Details',
    input: 'textarea',
    placeholder: 'Anything ElevAI should know that is not in the basics.',
    read: l => l.resources.listingDetails ?? '',
    write: (l, v) => ({ ...l, resources: { ...l.resources, listingDetails: v } }),
  },
  sops: {
    label: 'SOPs',
    section: 'Listing Setup → SOPs',
    input: 'textarea',
    placeholder: 'How the team handles things at this property.',
    read: l => l.resources.sops ?? '',
    write: (l, v) => ({ ...l, resources: { ...l.resources, sops: v } }),
  },
  amenities: {
    label: 'Amenities',
    section: 'Listing Setup → Amenities',
    input: 'list',
    placeholder: 'Pool, WiFi, AC, Parking',
    read: l => l.amenities.join(', '),
    write: (l, v) => ({
      ...l,
      amenities: v.split(',').map(a => a.trim()).filter(Boolean),
    }),
  },
  checkInInstructions: guideField('checkin', 'Check-in steps', 'One step per line, in order. "Step: details" adds details.'),
  checkOutInstructions: guideField('checkout', 'Check-out steps', 'One step per line, in order.'),
}

export function aiKnowledgeFieldSpec(field: AiKnowledgeField): AiKnowledgeFieldSpec {
  return aiKnowledgeFields[field]
}

export function readAiKnowledge(listing: Listing, field: AiKnowledgeField): string {
  return aiKnowledgeFields[field].read(listing)
}

/**
 * Returns a new list with the one corrected listing replaced, or the list
 * unchanged when the listing is gone. Pure, so the rules stay testable without
 * the listings store.
 */
export function applyAiKnowledge(
  listings: Listing[],
  source: AiKnowledgeSource,
  value: string,
): Listing[] {
  const index = listings.findIndex(l => l.id === source.listingId)
  if (index === -1)
    return listings

  const next = [...listings]
  next[index] = aiKnowledgeFields[source.field].write(listings[index]!, value)
  return next
}
