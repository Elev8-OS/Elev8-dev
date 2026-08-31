import { computed, ref } from 'vue'
import type { ListingFeeTaxItem, TaxSet } from '~/components/listings/data/listings'

export interface ListingFeeTaxAssignment {
  feeTaxIds: string[]
  taxSetIds: string[]
}

const seedFeeTaxItems: ListingFeeTaxItem[] = [
  {
    id: 'ft-1',
    title: 'Cleaning Fee',
    type: 'fee',
    logic: 'per_booking',
    rate: 45,
    currency: 'USD',
    isInclusive: false,
    skipNights: null,
    maxNights: null,
    applicableDateRanges: [],
  },
  {
    id: 'ft-2',
    title: 'Local Tax',
    type: 'city_tax',
    logic: 'percent',
    rate: 10,
    isInclusive: true,
    skipNights: null,
    maxNights: null,
    applicableDateRanges: [],
  },
]

const seedTaxSets: TaxSet[] = [
  {
    id: 'ts-1',
    title: 'Standard Tax Set',
    currency: 'USD',
    taxes: [
      { id: 'ft-1', level: 1 },
      { id: 'ft-2', level: 0 },
    ],
    associatedRatePlanIds: [],
    isDefault: true,
  },
]

const seedAssignments: Record<string, ListingFeeTaxAssignment> = {
  'lst-1': { feeTaxIds: ['ft-1', 'ft-2'], taxSetIds: ['ts-1'] },
}

// Module-level singleton refs so state is shared across every component and
// page (settings ↔ listing detail) without being reset by SSR payload on
// client-side navigation. Matches the `listings` / `payoutAccounts` pattern.
const feeTaxItems = ref<ListingFeeTaxItem[]>(JSON.parse(JSON.stringify(seedFeeTaxItems)))
const taxSets = ref<TaxSet[]>(JSON.parse(JSON.stringify(seedTaxSets)))
const assignments = ref<Record<string, ListingFeeTaxAssignment>>(JSON.parse(JSON.stringify(seedAssignments)))

function assignmentFor(listingId: string): ListingFeeTaxAssignment {
  return assignments.value[listingId] ?? { feeTaxIds: [], taxSetIds: [] }
}

function setAssignment(listingId: string, assignment: ListingFeeTaxAssignment) {
  assignments.value = { ...assignments.value, [listingId]: assignment }
}

function getFeeTaxById(id: string): ListingFeeTaxItem | undefined {
  return feeTaxItems.value.find(item => item.id === id)
}

function getTaxSetById(id: string): TaxSet | undefined {
  return taxSets.value.find(set => set.id === id)
}

function getTaxSetsForListing(listingId: string): TaxSet[] {
  return assignmentFor(listingId).taxSetIds
    .map(id => getTaxSetById(id))
    .filter((set): set is TaxSet => !!set)
}

function getFeesTaxesForListing(listingId: string): ListingFeeTaxItem[] {
  const assignment = assignmentFor(listingId)
  const ids = new Set(assignment.feeTaxIds)
  // Include fee/tax items referenced by any tax set assigned to this listing.
  for (const set of getTaxSetsForListing(listingId))
    for (const ref of set.taxes)
      ids.add(ref.id)
  return [...ids]
    .map(id => getFeeTaxById(id))
    .filter((item): item is ListingFeeTaxItem => !!item)
}

// Tax sets (bundles) that reference a given fee/tax item.
function taxSetsForFeeTax(feeTaxId: string): TaxSet[] {
  return taxSets.value.filter(set => set.taxes.some(ref => ref.id === feeTaxId))
}

// Direct fee/tax ids for a listing (excluding those that come from a bundle).
function directFeeTaxIdsForListing(listingId: string): string[] {
  return assignmentFor(listingId).feeTaxIds
}

// ── Fee / tax item CRUD ────────────────────────────────────────────────
function upsertFeeTaxItem(item: ListingFeeTaxItem, listingId?: string): void {
  const existing = feeTaxItems.value.find(i => i.id === item.id)
  if (existing) {
    feeTaxItems.value = feeTaxItems.value.map(i => i.id === item.id ? item : i)
  }
  else {
    feeTaxItems.value = [...feeTaxItems.value, item]
  }

  // When created from a listing context, assign it to that listing too.
  if (listingId) {
    const current = assignmentFor(listingId)
    setAssignment(listingId, {
      ...current,
      feeTaxIds: current.feeTaxIds.includes(item.id) ? current.feeTaxIds : [...current.feeTaxIds, item.id],
    })
  }
}

function removeFeeTaxItem(id: string): void {
  feeTaxItems.value = feeTaxItems.value.filter(item => item.id !== id)
  assignments.value = Object.fromEntries(
    Object.entries(assignments.value).map(([listingId, assignment]) => [
      listingId,
      { ...assignment, feeTaxIds: assignment.feeTaxIds.filter(fid => fid !== id) },
    ]),
  )
  taxSets.value = taxSets.value.map(set => ({
    ...set,
    taxes: set.taxes.filter(ref => ref.id !== id),
  }))
}

// ── Tax set CRUD ───────────────────────────────────────────────────────
function upsertTaxSet(set: TaxSet, listingId?: string): void {
  const existing = taxSets.value.find(s => s.id === set.id)
  if (existing) {
    taxSets.value = taxSets.value.map(s => s.id === set.id ? set : s)
  }
  else {
    if (taxSets.value.length === 0)
      set.isDefault = true
    taxSets.value = [...taxSets.value, set]
  }

  if (listingId) {
    const current = assignmentFor(listingId)
    setAssignment(listingId, {
      ...current,
      taxSetIds: current.taxSetIds.includes(set.id) ? current.taxSetIds : [...current.taxSetIds, set.id],
    })
  }
}

function removeTaxSet(id: string): void {
  taxSets.value = taxSets.value.filter(set => set.id !== id)
  assignments.value = Object.fromEntries(
    Object.entries(assignments.value).map(([listingId, assignment]) => [
      listingId,
      { ...assignment, taxSetIds: assignment.taxSetIds.filter(sid => sid !== id) },
    ]),
  )
}

function setDefaultTaxSet(id: string): void {
  taxSets.value = taxSets.value.map(set => ({ ...set, isDefault: set.id === id }))
}

// ── Assignment helpers ─────────────────────────────────────────────────
function unassignFeeTax(listingId: string, feeTaxId: string): void {
  const current = assignmentFor(listingId)
  setAssignment(listingId, {
    ...current,
    feeTaxIds: current.feeTaxIds.filter(id => id !== feeTaxId),
  })
}

function unassignTaxSet(listingId: string, taxSetId: string): void {
  const current = assignmentFor(listingId)
  setAssignment(listingId, {
    ...current,
    taxSetIds: current.taxSetIds.filter(id => id !== taxSetId),
  })
}

function toggleListingFeeTax(listingId: string, feeTaxId: string): void {
  const current = assignmentFor(listingId)
  const next = current.feeTaxIds.includes(feeTaxId)
    ? current.feeTaxIds.filter(id => id !== feeTaxId)
    : [...current.feeTaxIds, feeTaxId]
  setAssignment(listingId, { ...current, feeTaxIds: next })
}

function toggleListingTaxSet(listingId: string, taxSetId: string): void {
  const current = assignmentFor(listingId)
  const next = current.taxSetIds.includes(taxSetId)
    ? current.taxSetIds.filter(id => id !== taxSetId)
    : [...current.taxSetIds, taxSetId]
  setAssignment(listingId, { ...current, taxSetIds: next })
}

function setListingFeeTaxes(listingId: string, feeTaxIds: string[]): void {
  const current = assignmentFor(listingId)
  setAssignment(listingId, { ...current, feeTaxIds: [...feeTaxIds] })
}

function setListingTaxSets(listingId: string, taxSetIds: string[]): void {
  const current = assignmentFor(listingId)
  setAssignment(listingId, { ...current, taxSetIds: [...taxSetIds] })
}

// Bulk-assign a set of items to many listings.
function assignToMany(listingIds: string[], feeTaxIds: string[] = [], taxSetIds: string[] = []): void {
  const updated = { ...assignments.value }
  for (const listingId of listingIds) {
    const current = updated[listingId] ?? { feeTaxIds: [], taxSetIds: [] }
    updated[listingId] = {
      feeTaxIds: Array.from(new Set([...current.feeTaxIds, ...feeTaxIds])),
      taxSetIds: Array.from(new Set([...current.taxSetIds, ...taxSetIds])),
    }
  }
  assignments.value = updated
}

function listingIdsForFeeTax(feeTaxId: string): string[] {
  return Object.entries(assignments.value)
    .filter(([, assignment]) => assignment.feeTaxIds.includes(feeTaxId))
    .map(([listingId]) => listingId)
}

function listingIdsForTaxSet(taxSetId: string): string[] {
  return Object.entries(assignments.value)
    .filter(([, assignment]) => assignment.taxSetIds.includes(taxSetId))
    .map(([listingId]) => listingId)
}

export function useFeesTaxes() {
  const assignedListingCount = computed(() => Object.keys(assignments.value).length)

  return {
    feeTaxItems,
    taxSets,
    assignments,
    assignedListingCount,
    getFeeTaxById,
    getTaxSetById,
    getFeesTaxesForListing,
    getTaxSetsForListing,
    taxSetsForFeeTax,
    directFeeTaxIdsForListing,
    upsertFeeTaxItem,
    removeFeeTaxItem,
    upsertTaxSet,
    removeTaxSet,
    setDefaultTaxSet,
    unassignFeeTax,
    unassignTaxSet,
    toggleListingFeeTax,
    toggleListingTaxSet,
    setListingFeeTaxes,
    setListingTaxSets,
    assignToMany,
    listingIdsForFeeTax,
    listingIdsForTaxSet,
  }
}
