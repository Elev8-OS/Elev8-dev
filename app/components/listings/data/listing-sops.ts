import type { ListingDetailGroup } from './listing-details'
import type { Listing } from './listings'
import { listings } from './listings'

/** A host-written SOP, shown under one of the `SOP_GROUPS`. */
export interface CustomSop {
  id: string
  title: string
  text: string
  /** The `SOP_GROUPS` key it sits under. Missing (SOPs added before groups had their own) means `other`. */
  group?: string
}

/** Listing Setup > SOPs: how the team (and ElevAI) handles each situation. */
export interface ListingSops {
  checkInProcedure?: string
  checkOutProcedure?: string
  requestsHandled?: string
  requestsApproval?: string
  ruleBreaks?: string
  maintenanceIssues?: string
  complaints?: string
  emergencyProcedure?: string
  custom?: CustomSop[]
  /** Default questions (field keys) deleted from this listing. Their groups stay, possibly with 0 fields. */
  removed?: string[]
}

type SopKey = Exclude<keyof ListingSops, 'custom' | 'removed'>

function sop(key: SopKey, label: string, placeholder: string) {
  return {
    key: `sop:${key}`,
    label,
    input: 'textarea' as const,
    placeholder,
    read: (l: Listing) => l.sops?.[key] ?? '',
    write: (l: Listing, value: string): Listing => ({ ...l, sops: { ...l.sops, [key]: value } }),
  }
}

export const SOP_GROUPS: ListingDetailGroup[] = [
  {
    key: 'check-in-out',
    label: 'Check-In & Check-Out',
    icon: 'lucide:log-in',
    fields: [
      sop('checkInProcedure', 'What happens when a guest checks in?', 'e.g. Staff meet the guest at the gate, show them around and hand over the keys.'),
      sop('checkOutProcedure', 'What happens when a guest checks out?', 'e.g. Keys go back in the lockbox; staff check the villa within an hour.'),
    ],
  },
  {
    key: 'requests',
    label: 'Guest Requests',
    icon: 'lucide:user',
    fields: [
      sop('requestsHandled', 'Which requests can be handled straight away?', 'e.g. Extra towels, airport pickup, restaurant bookings.'),
      sop('requestsApproval', 'Which requests need the host\'s approval?', 'e.g. Extra guests, events, discounts.'),
    ],
  },
  {
    key: 'rules',
    label: 'Rules',
    icon: 'lucide:list',
    fields: [
      sop('ruleBreaks', 'What happens when a guest breaks a house rule?', 'e.g. A first friendly reminder, then the manager calls the guest.'),
    ],
  },
  {
    key: 'issues',
    label: 'Guest Issues',
    icon: 'lucide:triangle-alert',
    fields: [
      sop('maintenanceIssues', 'How are maintenance issues handled?', 'e.g. AC not working: send the on-call technician and update the guest within 30 minutes.'),
      sop('complaints', 'How are complaints and refund requests handled?', 'e.g. Apologise, collect photos, and pass refund requests to the manager.'),
    ],
  },
  {
    key: 'emergencies',
    label: 'Emergencies',
    icon: 'lucide:siren',
    fields: [
      sop('emergencyProcedure', 'What should be done in an emergency?', 'Emergency numbers, the nearest hospital, and who to call first.'),
    ],
  },
  {
    key: 'other',
    label: 'Other',
    icon: 'lucide:ellipsis',
    fields: [
      {
        // The original free-text SOPs. ElevAI reads it and host corrections write it (`ai-knowledge.ts`).
        key: 'sops',
        label: 'General procedures',
        input: 'textarea',
        placeholder: 'Anything not covered above.',
        optional: true,
        read: l => l.resources.sops ?? '',
        write: (l, value) => ({ ...l, resources: { ...l.resources, sops: value } }),
      },
    ],
  },
]

export const customSopGroup = (sop: CustomSop) => sop.group ?? 'other'

export function customSopsIn(listing: Listing, group: string): CustomSop[] {
  return (listing.sops?.custom ?? []).filter(s => customSopGroup(s) === group)
}

/** Custom SOPs per group key, for the group headers' field counts. */
export function customSopCounts(listing: Listing): Record<string, number> {
  return Object.fromEntries(SOP_GROUPS.map(g => [g.key, customSopsIn(listing, g.key).length]))
}

/** `FieldConfigDialog` key for a custom SOP's pencil. */
export const customSopConfigKey = (id: string) => `sop-custom:${id}`

export function addCustomSop(listing: Listing, group = 'other'): Listing {
  const custom = [...(listing.sops?.custom ?? []), { id: `sop-${Date.now()}`, title: '', text: '', group }]
  return { ...listing, sops: { ...listing.sops, custom } }
}

export function updateCustomSop(listing: Listing, id: string, patch: Partial<Omit<CustomSop, 'id'>>): Listing {
  const custom = (listing.sops?.custom ?? []).map(s => s.id === id ? { ...s, ...patch } : s)
  return { ...listing, sops: { ...listing.sops, custom } }
}

export function removeCustomSop(listing: Listing, id: string): Listing {
  return { ...listing, sops: { ...listing.sops, custom: (listing.sops?.custom ?? []).filter(s => s.id !== id) } }
}

// --- Removing default questions ------------------------------------------------

const sopFields = () => SOP_GROUPS.flatMap(g => g.fields)
const removedKeys = (listing: Listing) => listing.sops?.removed ?? []

/** `SOP_GROUPS` without the default questions this listing deleted. Every group stays, even with no fields. */
export function visibleSopGroups(listing: Listing): ListingDetailGroup[] {
  const removed = removedKeys(listing)
  return SOP_GROUPS.map(g => ({ ...g, fields: g.fields.filter(f => !removed.includes(f.key)) }))
}

/** Deleted default questions of one group, for its Restore button. */
export function removedSopFieldsIn(listing: Listing, group: string) {
  const removed = removedKeys(listing)
  return (SOP_GROUPS.find(g => g.key === group)?.fields ?? []).filter(f => removed.includes(f.key))
}

/** Brings a group's deleted default questions back, empty. */
export function restoreSopGroup(listing: Listing, group: string): Listing {
  const keys = removedSopFieldsIn(listing, group).map(f => f.key)
  return { ...listing, sops: { ...listing.sops, removed: removedKeys(listing).filter(k => !keys.includes(k)) } }
}

// --- Selecting SOPs: default questions (by field key) and custom SOPs (`custom:<id>`) ----

export const customSopSelectionId = (id: string) => `custom:${id}`

/** Everything on the SOPs tab that can be selected: every shown default question (answered or not) and custom SOPs. */
export function selectableSopIds(listing: Listing): string[] {
  return [
    ...visibleSopGroups(listing).flatMap(g => g.fields).map(f => f.key),
    ...(listing.sops?.custom ?? []).map(s => customSopSelectionId(s.id)),
  ]
}

/** Deletes the selected default questions (answer cleared, question hidden) and custom SOPs. Groups stay. */
export function deleteSops(listing: Listing, ids: string[]): Listing {
  const fields = sopFields().filter(f => ids.includes(f.key))
  const next = fields.reduce((l, f) => f.write(l, ''), listing)
  const removed = [...new Set([...removedKeys(next), ...fields.map(f => f.key)])]
  const custom = (next.sops?.custom ?? []).filter(s => !ids.includes(customSopSelectionId(s.id)))
  return { ...next, sops: { ...next.sops, removed, custom } }
}

/**
 * Applies the selected SOPs of `source` to `target`: answers replace the
 * target's (bringing the question back if the target had deleted it), custom
 * SOPs are added with fresh ids. A selected question with no answer is
 * skipped, so copying never wipes the target's own answer.
 */
export function applySops(source: Listing, target: Listing, ids: string[]): Listing {
  const answered = sopFields().filter(f => ids.includes(f.key) && f.read(source).trim())
  let next = answered.reduce((l, f) => f.write(l, f.read(source)), target)
  if (next.sops?.removed?.some(k => answered.some(f => f.key === k)))
    next = { ...next, sops: { ...next.sops, removed: next.sops.removed.filter(k => !answered.some(f => f.key === k)) } }
  const picked = (source.sops?.custom ?? []).filter(s => ids.includes(customSopSelectionId(s.id)))
  if (picked.length) {
    const custom = [...(next.sops?.custom ?? []), ...picked.map((s, i) => ({ ...s, id: `sop-${Date.now()}-${i}` }))]
    next = { ...next, sops: { ...next.sops, custom } }
  }
  return next
}

/** Copies the selected SOPs to other listings. Returns how many listings were written. */
export function copySopsToListings(source: Listing, ids: string[], targetIds: string[]): number {
  const targets = new Set(targetIds.filter(id => id !== source.id))
  listings.value = listings.value.map(l => targets.has(l.id) ? applySops(source, l, ids) : l)
  return targets.size
}
