<script setup lang="ts">
import type { Listing, ListingFeeTaxItem, RateMealType, RatePlan, RatePlanOption, RateRateMode, RateSellMode, TaxDateRange, TaxSet, Unit, UnitType, UnitTypePricing } from '~/components/listings/data/listings'
import { toast } from 'vue-sonner'
import CancellationPolicyEditor from '~/components/listings/CancellationPolicyEditor.vue'
import { cancellationPolicySummary, createRatePlan, ratePlanMaxOccupancy, ratePlanNightlyRate } from '~/components/listings/data/listings'

const props = defineProps<{ listing: Listing, activeUnit?: Unit | null }>()
const emit = defineEmits<{ update: [listing: Listing] }>()

const currencies = [
  { code: 'USD', symbol: '$', label: 'USD' },
  { code: 'IDR', symbol: 'Rp', label: 'IDR' },
  { code: 'EUR', symbol: '€', label: 'EUR' },
  { code: 'GBP', symbol: '£', label: 'GBP' },
  { code: 'AUD', symbol: 'A$', label: 'AUD' },
  { code: 'SGD', symbol: 'S$', label: 'SGD' },
]

const unitTypes = computed(() => props.listing.unitTypes ?? [])

const expandedId = ref<string | null>(null)

watch(unitTypes, (uts) => {
  if (uts.length > 0 && expandedId.value === null)
    expandedId.value = uts[0]!.id
}, { immediate: true })

function toggleExpand(id: string) {
  expandedId.value = expandedId.value === id ? null : id
}

function symbolFor(code: string): string {
  return currencies.find(c => c.code === code)?.symbol ?? '$'
}

function guestCapacityLabel(ut: UnitType): string {
  const parts = [`${ut.maxAdults} adult${ut.maxAdults !== 1 ? 's' : ''}`]
  if (ut.maxChildren > 0)
    parts.push(`${ut.maxChildren} child${ut.maxChildren !== 1 ? 'ren' : ''}`)
  if (ut.maxInfants > 0)
    parts.push(`${ut.maxInfants} infant${ut.maxInfants !== 1 ? 's' : ''}`)
  return parts.join(', ')
}

function maxGuests(ut: UnitType): number {
  return ut.maxAdults + ut.maxChildren + ut.maxInfants
}

function patchUnitType(utId: string, patch: Partial<UnitType>) {
  emit('update', {
    ...props.listing,
    unitTypes: unitTypes.value.map(ut => ut.id === utId ? { ...ut, ...patch } : ut),
  })
}

function patchPricing(utId: string, patch: Partial<UnitTypePricing>) {
  const ut = unitTypes.value.find(u => u.id === utId)
  if (!ut)
    return
  patchUnitType(utId, { pricing: { ...ut.pricing, ...patch } })
}

function setCurrency(utId: string, code: string) {
  patchPricing(utId, { currency: code })
}

// Rate plans
const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function primaryOption(rp: RatePlan): RatePlanOption {
  return rp.options.find(o => o.isPrimary) ?? rp.options[0] ?? { occupancy: 2, isPrimary: true, derivedOption: null, rate: 0 }
}

function draftAddOption(draft: RatePlan) {
  const last = draft.options.at(-1)
  const occ = (last?.occupancy ?? 1) + 1
  const maxOcc = Math.max(...draft.options.map(o => o.occupancy), 1)
  draft.options = [
    ...draft.options,
    {
      occupancy: occ,
      isPrimary: false,
      derivedOption: null,
      rate: draft.options.find(o => o.occupancy === maxOcc)?.rate ?? 0,
    },
  ]
}

function draftRemoveOption(draft: RatePlan, index: number) {
  if (draft.options.length <= 1)
    return
  draft.options = draft.options.filter((_, i) => i !== index)
}

function patchRatePlan(utId: string, index: number, patch: Partial<RatePlan>) {
  const ut = unitTypes.value.find(u => u.id === utId)
  if (!ut)
    return
  const ratePlans = ut.pricing.ratePlans.map((rp, i) => i === index ? { ...rp, ...patch } : rp)
  patchPricing(utId, { ratePlans })
}

const showAddRatePlanSheet = ref(false)
const addRatePlanUnitTypeId = ref('')
const addRatePlanDraft = ref<RatePlan>(createRatePlan({}))

const showEditRatePlanSheet = ref(false)
const editRatePlanUnitTypeId = ref('')
const editRatePlanIndex = ref(-1)
const editRatePlanDraft = ref<RatePlan>(createRatePlan({}))

function openEditRatePlanSheet(utId: string, index: number) {
  const ut = unitTypes.value.find(u => u.id === utId)
  const rp = ut?.pricing.ratePlans[index]
  if (!ut || !rp)
    return
  editRatePlanUnitTypeId.value = utId
  editRatePlanIndex.value = index
  editRatePlanDraft.value = {
    ...rp,
    options: rp.options.map(o => ({ ...o, derivedOption: o.derivedOption ? JSON.parse(JSON.stringify(o.derivedOption)) : null })),
  }
  showEditRatePlanSheet.value = true
}

function saveEditedRatePlan() {
  const ut = unitTypes.value.find(u => u.id === editRatePlanUnitTypeId.value)
  if (!ut || editRatePlanIndex.value < 0 || !editRatePlanDraft.value.title.trim())
    return
  const draft = editRatePlanDraft.value
  patchRatePlan(ut.id, editRatePlanIndex.value, {
    ...draft,
    name: draft.title.trim(),
    title: draft.title.trim(),
  })
  showEditRatePlanSheet.value = false
  toast.success('Rate plan updated')
}

function closeEditRatePlanSheet() {
  showEditRatePlanSheet.value = false
  editRatePlanUnitTypeId.value = ''
  editRatePlanIndex.value = -1
}

function rateModeHint(mode: RateRateMode): string {
  const hints: Record<RateRateMode, string> = {
    manual: 'You set prices directly',
    derived: 'Priced from another rate plan',
    auto: 'Imported from your PMS',
    cascade: 'Inherits from the parent plan',
  }
  return hints[mode]
}

type StayField = 'minStayArrival' | 'minStayThrough' | 'maxStay'
type BoolField = 'closedToArrival' | 'closedToDeparture' | 'stopSell'

const stayRows: { field: StayField, label: string, min: number }[] = [
  { field: 'minStayArrival', label: 'Min Stay Arrival', min: 1 },
  { field: 'minStayThrough', label: 'Min Stay Through', min: 1 },
  { field: 'maxStay', label: 'Max Stay', min: 0 },
]

const boolRows: { field: BoolField, label: string }[] = [
  { field: 'closedToArrival', label: 'Closed To Arrival' },
  { field: 'closedToDeparture', label: 'Closed To Departure' },
  { field: 'stopSell', label: 'Stop Sell' },
]

function stayValue(draft: RatePlan, field: StayField): number {
  return Math.max(0, ...draft[field])
}

function setStayValue(draft: RatePlan, field: StayField, value: number, min: number) {
  const v = Math.max(min, value || 0)
  draft[field] = draft[field].map(() => v)
}

function boolDayChecked(draft: RatePlan, field: BoolField, day: number): boolean {
  return draft[field][day] === true
}

function toggleBoolDay(draft: RatePlan, field: BoolField, day: number) {
  draft[field] = draft[field].map((x, i) =>
    i === day ? !x : x,
  )
}

function openAddRatePlanSheet(utId: string) {
  const ut = unitTypes.value.find(u => u.id === utId)
  if (!ut)
    return
  const base = ut.pricing.ratePlans.find(rp => rp.isBase) ?? ut.pricing.ratePlans[0]
  addRatePlanUnitTypeId.value = utId
  addRatePlanDraft.value = {
    ...createRatePlan({}),
    name: `Rate Plan ${ut.pricing.ratePlans.length + 1}`,
    title: `Rate Plan ${ut.pricing.ratePlans.length + 1}`,
    currency: ut.pricing.currency,
    options: [{ occupancy: primaryOption(base ?? createRatePlan({})).occupancy, isPrimary: true, derivedOption: null, rate: base ? primaryOption(base).rate : 0 }],
    isBase: false,
  }
  showAddRatePlanSheet.value = true
}

function saveNewRatePlan() {
  const ut = unitTypes.value.find(u => u.id === addRatePlanUnitTypeId.value)
  if (!ut || !addRatePlanDraft.value.title.trim())
    return
  const newPlan: RatePlan = {
    ...addRatePlanDraft.value,
    id: `rp-${Date.now()}`,
    name: addRatePlanDraft.value.title.trim(),
    title: addRatePlanDraft.value.title.trim(),
  }
  patchPricing(ut.id, { ratePlans: [...ut.pricing.ratePlans, newPlan] })
  showAddRatePlanSheet.value = false
  toast.success('Rate plan added')
}

function closeAddRatePlanSheet() {
  showAddRatePlanSheet.value = false
  addRatePlanUnitTypeId.value = ''
}

function removeRatePlan(utId: string, index: number) {
  const ut = unitTypes.value.find(u => u.id === utId)
  if (!ut || ut.pricing.ratePlans[index]?.isBase)
    return
  patchPricing(utId, { ratePlans: ut.pricing.ratePlans.filter((_, i) => i !== index) })
  toast.success('Rate plan removed')
}

function setRatePlanPrimary(utId: string, index: number) {
  const ut = unitTypes.value.find(u => u.id === utId)
  if (!ut)
    return
  const ratePlans = ut.pricing.ratePlans.map((rp, i) => ({ ...rp, isBase: i === index }))
  patchPricing(utId, { ratePlans })
  toast.success('Base rate plan updated')
}

// Offerings
function updateOffering(utId: string, index: number, field: string, value: unknown) {
  const ut = unitTypes.value.find(u => u.id === utId)
  if (!ut)
    return
  const offerings = ut.pricing.offerings.map((o, i) => i === index ? { ...o, [field]: value } : o)
  patchPricing(utId, { offerings })
}

function addOffering(utId: string) {
  const ut = unitTypes.value.find(u => u.id === utId)
  if (!ut)
    return
  patchPricing(utId, {
    offerings: [
      ...ut.pricing.offerings,
      { id: `off-${Date.now()}`, name: '', adjustmentType: 'fixed', adjustmentValue: 0 },
    ],
  })
}

function removeOffering(utId: string, index: number) {
  const ut = unitTypes.value.find(u => u.id === utId)
  if (!ut)
    return
  patchPricing(utId, { offerings: ut.pricing.offerings.filter((_, i) => i !== index) })
}

// Length of stay discounts
function updateLosDiscount(utId: string, index: number, field: string, value: unknown) {
  const ut = unitTypes.value.find(u => u.id === utId)
  if (!ut)
    return
  const lengthOfStayDiscounts = ut.pricing.lengthOfStayDiscounts.map((d, i) => i === index ? { ...d, [field]: value } : d)
  patchPricing(utId, { lengthOfStayDiscounts })
}

function addLosDiscount(utId: string) {
  const ut = unitTypes.value.find(u => u.id === utId)
  if (!ut)
    return
  patchPricing(utId, {
    lengthOfStayDiscounts: [
      ...ut.pricing.lengthOfStayDiscounts,
      { id: `los-${Date.now()}`, minNights: 7, discountType: 'percent', value: 10 },
    ],
  })
}

function removeLosDiscount(utId: string, index: number) {
  const ut = unitTypes.value.find(u => u.id === utId)
  if (!ut)
    return
  patchPricing(utId, { lengthOfStayDiscounts: ut.pricing.lengthOfStayDiscounts.filter((_, i) => i !== index) })
}

// ── Legacy property-level pricing (listings without unit types) ──────────
const editForm = ref({
  nightlyRate: props.listing.pricing.nightlyRate,
  cleaningFee: props.listing.pricing.cleaningFee,
  serviceFee: props.listing.pricing.serviceFee,
  weeklyDiscount: props.listing.pricing.weeklyDiscount,
  monthlyDiscount: props.listing.pricing.monthlyDiscount,
})

watch(() => props.listing.pricing, (p) => {
  editForm.value = { nightlyRate: p.nightlyRate, cleaningFee: p.cleaningFee, serviceFee: p.serviceFee, weeklyDiscount: p.weeklyDiscount, monthlyDiscount: p.monthlyDiscount }
})

function patchLegacyPricing(patch: Partial<typeof editForm.value>) {
  editForm.value = { ...editForm.value, ...patch }
  emit('update', { ...props.listing, pricing: { ...props.listing.pricing, ...editForm.value } })
}

// ── Property-level Fees & Taxes ──────────────────────────────────────────
const feesTaxes = computed(() => props.listing.pricing.feesTaxes ?? [])

const showFeeTaxSheet = ref(false)
const editingFeeTaxId = ref<string | null>(null)
const editingFromTaxSet = ref(false)
const feeTaxDraft = ref<ListingFeeTaxItem>({
  id: '',
  title: '',
  type: 'tax',
  logic: 'percent',
  rate: 0,
  currency: undefined,
  isInclusive: false,
  skipNights: null,
  maxNights: null,
  applicableDateRanges: [],
})

const logicOptions = [
  { value: 'percent', label: 'Percent' },
  { value: 'per_room', label: 'Per Room' },
  { value: 'per_room_per_night', label: 'Per Room / Night' },
  { value: 'per_person', label: 'Per Person' },
  { value: 'per_person_per_night', label: 'Per Person / Night' },
  { value: 'per_night', label: 'Per Night' },
  { value: 'per_booking', label: 'Per Booking' },
] as const

function isPercent() {
  return feeTaxDraft.value.logic === 'percent'
}

function openFeeTaxSheet() {
  editingFeeTaxId.value = null
  editingFromTaxSet.value = false
  feeTaxDraft.value = {
    id: '',
    title: '',
    type: 'tax',
    logic: 'percent',
    rate: 0,
    currency: undefined,
    isInclusive: false,
    skipNights: null,
    maxNights: null,
    applicableDateRanges: [],
  }
  showFeeTaxSheet.value = true
}

function openEditFeeTaxSheet(id: string) {
  const found = feesTaxes.value.find(t => t.id === id)
  if (!found)
    return
  editingFeeTaxId.value = id
  editingFromTaxSet.value = false
  feeTaxDraft.value = {
    ...found,
    applicableDateRanges: found.applicableDateRanges.map(r => ({ ...r })),
  }
  showFeeTaxSheet.value = true
}

function closeFeeTaxSheet() {
  showFeeTaxSheet.value = false
  editingFeeTaxId.value = null
}

// When the fee/tax sheet closes, return to the tax set if that's where the
// edit originated from (covers Cancel, Save, backdrop click, and the X button).
watch(showFeeTaxSheet, (open) => {
  if (!open && editingFromTaxSet.value) {
    editingFromTaxSet.value = false
    showTaxSetSheet.value = true
  }
})

function patchFeesTaxes(items: ListingFeeTaxItem[]) {
  emit('update', { ...props.listing, pricing: { ...props.listing.pricing, feesTaxes: items } })
}

function saveFeeTaxItem() {
  if (!feeTaxDraft.value.title.trim())
    return

  if (editingFeeTaxId.value) {
    patchFeesTaxes(feesTaxes.value.map(t =>
      t.id === editingFeeTaxId.value
        ? { ...feeTaxDraft.value, title: feeTaxDraft.value.title.trim() }
        : t,
    ))
    toast.success('Fee or tax updated')
  }
  else {
    const item: ListingFeeTaxItem = {
      ...feeTaxDraft.value,
      id: `ft-${Date.now()}`,
      title: feeTaxDraft.value.title.trim(),
    }
    patchFeesTaxes([...feesTaxes.value, item])
    toast.success(`${item.type === 'fee' ? 'Fee' : 'Tax'} added`)
  }
  closeFeeTaxSheet()
}

function removeFeeTaxItem(index: number) {
  patchFeesTaxes(feesTaxes.value.filter((_, i) => i !== index))
  toast.success('Removed')
}

// ── Applicable date ranges ────────────────────────────────────────────────
function addDateRange() {
  const today = new Date().toISOString().split('T')[0]!
  feeTaxDraft.value.applicableDateRanges.push({ after: today, before: today })
}

function updateDateRange(index: number, field: keyof TaxDateRange, value: string) {
  const ranges = feeTaxDraft.value.applicableDateRanges.map((r, i) =>
    i === index ? { ...r, [field]: value } : r,
  )
  feeTaxDraft.value.applicableDateRanges = ranges
}

function removeDateRange(index: number) {
  feeTaxDraft.value.applicableDateRanges = feeTaxDraft.value.applicableDateRanges.filter((_, i) => i !== index)
}

// ── Tax Sets ──────────────────────────────────────────────────────────────
const taxSets = computed(() => props.listing.pricing.taxSets ?? [])

const showTaxSetSheet = ref(false)
const editingTaxSetId = ref<string | null>(null)
const taxSetDraft = ref<TaxSet>({
  id: '',
  title: '',
  currency: 'USD',
  taxes: [],
  associatedRatePlanIds: [],
  isDefault: false,
})

function feeTaxLabel(id: string): string {
  return feesTaxes.value.find(t => t.id === id)?.title ?? id
}

function feeTaxById(id: string): ListingFeeTaxItem | undefined {
  return feesTaxes.value.find(t => t.id === id)
}

const logicLabels: Record<string, string> = {
  percent: 'Percent',
  per_room: 'Per Room',
  per_room_per_night: 'Per Room / Night',
  per_person: 'Per Person',
  per_person_per_night: 'Per Person / Night',
  per_night: 'Per Night',
  per_booking: 'Per Booking',
}

function feeTaxSummary(tax: ListingFeeTaxItem): string {
  const sym = tax.logic === 'percent' ? '%' : symbolFor(tax.currency ?? 'USD')
  const parts = [
    `${sym}${tax.rate}`,
    logicLabels[tax.logic] ?? tax.logic,
  ]
  if (tax.isInclusive)
    parts.push('included')
  if (tax.skipNights)
    parts.push(`skip ${tax.skipNights}`)
  if (tax.maxNights)
    parts.push(`max ${tax.maxNights}`)
  return parts.join(' · ')
}

const allRatePlans = computed(() => {
  const map = new Map<string, { id: string, name: string, unitTypeName: string }>()
  for (const ut of unitTypes.value) {
    for (const rp of ut.pricing.ratePlans) {
      map.set(rp.id, { id: rp.id, name: rp.name, unitTypeName: ut.name })
    }
  }
  return [...map.values()]
})

function ratePlanLabel(id: string): string {
  const rp = allRatePlans.value.find(r => r.id === id)
  return rp ? `${rp.name} (${rp.unitTypeName})` : id
}

function toggleRatePlanInDraft(rpId: string) {
  const ids = taxSetDraft.value.associatedRatePlanIds
  taxSetDraft.value.associatedRatePlanIds = ids.includes(rpId)
    ? ids.filter(id => id !== rpId)
    : [...ids, rpId]
}

function openCreateTaxSet() {
  editingTaxSetId.value = null
  taxSetDraft.value = {
    id: '',
    title: '',
    currency: 'USD',
    taxes: [],
    associatedRatePlanIds: [],
    isDefault: false,
  }
  showTaxSetSheet.value = true
}

function openEditTaxSet(id: string) {
  const found = taxSets.value.find(ts => ts.id === id)
  if (!found)
    return
  editingTaxSetId.value = id
  taxSetDraft.value = {
    ...found,
    taxes: found.taxes.map(t => ({ ...t })),
    associatedRatePlanIds: [...found.associatedRatePlanIds],
  }
  showTaxSetSheet.value = true
}

function patchTaxSets(items: TaxSet[]) {
  emit('update', { ...props.listing, pricing: { ...props.listing.pricing, taxSets: items } })
}

function toggleTaxInDraft(taxId: string) {
  const exists = taxSetDraft.value.taxes.some(t => t.id === taxId)
  if (exists) {
    taxSetDraft.value.taxes = taxSetDraft.value.taxes.filter(t => t.id !== taxId)
  }
  else {
    taxSetDraft.value.taxes = [...taxSetDraft.value.taxes, { id: taxId, level: 0 }]
  }
  normalizeTaxLevels()
}

function normalizeTaxLevels() {
  const n = taxSetDraft.value.taxes.length
  // First item is calculated first (deepest/highest level). Last item is level 0.
  taxSetDraft.value.taxes = taxSetDraft.value.taxes.map((t, i) => ({ ...t, level: n - 1 - i }))
}

function moveTaxUp(taxId: string) {
  const idx = taxSetDraft.value.taxes.findIndex(t => t.id === taxId)
  if (idx <= 0)
    return
  const arr = [...taxSetDraft.value.taxes]
  ;[arr[idx - 1], arr[idx]] = [arr[idx]!, arr[idx - 1]!]
  taxSetDraft.value.taxes = arr
  normalizeTaxLevels()
}

function moveTaxDown(taxId: string) {
  const idx = taxSetDraft.value.taxes.findIndex(t => t.id === taxId)
  if (idx < 0 || idx >= taxSetDraft.value.taxes.length - 1)
    return
  const arr = [...taxSetDraft.value.taxes]
  ;[arr[idx], arr[idx + 1]] = [arr[idx + 1]!, arr[idx]!]
  taxSetDraft.value.taxes = arr
  normalizeTaxLevels()
}

// ── Drag & drop reorder ──────────────────────────────────────────────────
const dragTaxId = ref<string | null>(null)
const dragOverTaxId = ref<string | null>(null)

function onTaxDragStart(taxId: string) {
  dragTaxId.value = taxId
}

function onTaxDragOver(e: DragEvent, taxId: string) {
  e.preventDefault()
  if (dragOverTaxId.value !== taxId)
    dragOverTaxId.value = taxId
}

function onTaxDrop(taxId: string) {
  const from = dragTaxId.value
  const to = taxId
  dragTaxId.value = null
  dragOverTaxId.value = null

  if (!from || from === to)
    return

  const arr = [...taxSetDraft.value.taxes]
  const fromIdx = arr.findIndex(t => t.id === from)
  const toIdx = arr.findIndex(t => t.id === to)
  if (fromIdx < 0 || toIdx < 0)
    return

  const [moved] = arr.splice(fromIdx, 1)
  arr.splice(toIdx, 0, moved!)
  taxSetDraft.value.taxes = arr
  normalizeTaxLevels()
}

function onTaxDragEnd() {
  dragTaxId.value = null
  dragOverTaxId.value = null
}

const draftTaxOrder = computed(() =>
  taxSetDraft.value.taxes.map((t) => {
    const tax = feeTaxById(t.id)
    return {
      id: t.id,
      level: t.level,
      title: feeTaxLabel(t.id),
      summary: tax ? feeTaxSummary(tax) : '',
      type: tax?.type,
    }
  }),
)

function editTaxFromSet(taxId: string) {
  // Open the fee/tax sheet in edit mode, remembering to return to the tax set.
  showTaxSetSheet.value = false
  openEditFeeTaxSheet(taxId)
  editingFromTaxSet.value = true
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`
}

// ── Pricing calculator simulation ────────────────────────────────────────
const sampleNights = ref(3)
const sampleBasePrice = ref(100)

interface CalcLine {
  id: string
  title: string
  amount: number
  detail: string
}

const taxSetCalc = computed(() => {
  const currency = taxSetDraft.value.currency ?? 'USD'
  const sym = symbolFor(currency)
  const nights = Math.max(1, sampleNights.value || 1)
  const base = Math.max(0, sampleBasePrice.value || 0)
  const baseTotal = base * nights

  // Process in calculation order: already sorted deepest-first in draft.
  // Rebuild each tax's contribution based on its own logic against the running base.
  let running = baseTotal
  const lines: CalcLine[] = []

  for (const ref of [...taxSetDraft.value.taxes].sort((a, b) => b.level - a.level)) {
    const tax = feesTaxes.value.find(t => t.id === ref.id)
    if (!tax)
      continue

    const logic = tax.logic
    const rate = tax.rate

    if (logic === 'percent') {
      const amount = running * rate / 100
      lines.push({ id: tax.id, title: tax.title, amount, detail: `${rate}% of ${sym}${running.toFixed(2)}` })
      running += amount
    }
    else if (logic === 'per_room') {
      const amount = rate
      lines.push({ id: tax.id, title: tax.title, amount, detail: `${sym}${rate} per room` })
      running += amount
    }
    else if (logic === 'per_room_per_night') {
      const amount = rate * nights
      lines.push({ id: tax.id, title: tax.title, amount, detail: `${sym}${rate} per room per night × ${nights} nights` })
      running += amount
    }
    else if (logic === 'per_person') {
      const amount = rate
      lines.push({ id: tax.id, title: tax.title, amount, detail: `${sym}${rate} per person` })
      running += amount
    }
    else if (logic === 'per_person_per_night') {
      const amount = rate * nights
      lines.push({ id: tax.id, title: tax.title, amount, detail: `${sym}${rate} per person per night × ${nights} nights` })
      running += amount
    }
    else if (logic === 'per_night') {
      const amount = rate * nights
      lines.push({ id: tax.id, title: tax.title, amount, detail: `${sym}${rate} per night × ${nights} nights` })
      running += amount
    }
    else if (logic === 'per_booking') {
      const amount = rate
      lines.push({ id: tax.id, title: tax.title, amount, detail: `${sym}${rate} per booking` })
      running += amount
    }
  }

  return { currency, sym, nights, base, baseTotal, running, lines }
})

function saveTaxSet() {
  if (!taxSetDraft.value.title.trim())
    return

  // Sort by level descending so deepest (highest number) is processed first,
  // matching Channex calculation order.
  const taxes = [...taxSetDraft.value.taxes].sort((a, b) => b.level - a.level)

  if (editingTaxSetId.value) {
    patchTaxSets(taxSets.value.map(ts =>
      ts.id === editingTaxSetId.value
        ? { ...taxSetDraft.value, title: taxSetDraft.value.title.trim(), taxes }
        : ts,
    ))
    toast.success('Tax set updated')
  }
  else {
    const set: TaxSet = {
      ...taxSetDraft.value,
      id: `ts-${Date.now()}`,
      title: taxSetDraft.value.title.trim(),
      taxes,
    }
    // First tax set becomes default automatically.
    if (taxSets.value.length === 0)
      set.isDefault = true
    patchTaxSets([...taxSets.value, set])
    toast.success('Tax set created')
  }
  showTaxSetSheet.value = false
}

function setDefaultTaxSet(id: string) {
  patchTaxSets(taxSets.value.map(ts => ({ ...ts, isDefault: ts.id === id })))
  toast.success('Default tax set updated')
}

function removeTaxSet(id: string) {
  patchTaxSets(taxSets.value.filter(ts => ts.id !== id))
  toast.success('Tax set removed')
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- Property-level Fees & Taxes -->
    <Card class="p-5">
      <div class="flex items-start justify-between gap-3">
        <div class="flex flex-col gap-1">
          <h3 class="text-sm font-semibold">
            Fees &amp; Taxes
          </h3>
          <p class="text-xs text-muted-foreground">
            Your extras, your call. Applies to direct bookings only, so guests always see a clean total.
          </p>
        </div>
        <Button variant="outline" size="sm" class="gap-1.5 shrink-0" @click="openFeeTaxSheet">
          <Icon name="lucide:plus" class="size-3.5" />
          Add fee or tax
        </Button>
      </div>

      <div class="mt-5">
        <p v-if="feesTaxes.length === 0" class="text-xs text-muted-foreground italic">
          No fees or taxes yet. Add one so direct guests see a clear total.
        </p>

        <div v-else class="flex flex-col gap-2">
          <div
            v-for="(item, idx) in feesTaxes"
            :key="item.id"
            class="flex items-center justify-between gap-3 border rounded-lg p-3"
          >
            <div class="flex items-center gap-3 min-w-0">
              <div class="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
                <Icon :name="item.type === 'fee' ? 'lucide:receipt' : 'lucide:landmark'" class="size-4 text-muted-foreground" />
              </div>
              <div class="flex flex-col min-w-0">
                <div class="flex items-center gap-2">
                  <span class="text-sm font-medium truncate">{{ item.title }}</span>
                  <Badge variant="secondary" class="text-[10px] px-1.5 shrink-0">
                    {{ item.type === 'fee' ? 'Fee' : 'Tax' }}
                  </Badge>
                </div>
                <span class="text-xs text-muted-foreground">
                  {{ item.logic === 'percent' ? `${item.rate}%` : `${item.currency ? symbolFor(item.currency) : '$'}${item.rate}` }}{{ item.isInclusive ? ' · included' : '' }}
                </span>
              </div>
            </div>

            <div class="flex items-center gap-1 shrink-0">
              <Button variant="ghost" size="sm" class="h-7 w-7 p-0" @click="openEditFeeTaxSheet(item.id)">
                <Icon name="lucide:pencil" class="size-3.5 text-muted-foreground" />
              </Button>
              <Button variant="ghost" size="sm" class="h-7 w-7 p-0" @click="removeFeeTaxItem(idx)">
                <Icon name="lucide:trash-2" class="size-3.5 text-muted-foreground" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Card>

    <!-- Tax Sets -->
    <Card class="p-5">
      <div class="flex items-start justify-between gap-3">
        <div class="flex flex-col gap-1">
          <h3 class="text-sm font-semibold">
            Tax Sets
          </h3>
          <p class="text-xs text-muted-foreground">
            Group taxes and apply them together. The default set is added to every new rate plan automatically.
          </p>
        </div>
        <Button variant="outline" size="sm" class="gap-1.5 shrink-0" @click="openCreateTaxSet">
          <Icon name="lucide:plus" class="size-3.5" />
          Add tax set
        </Button>
      </div>

      <div class="mt-5">
        <p v-if="taxSets.length === 0" class="text-xs text-muted-foreground italic">
          No tax sets yet. Group your fees and taxes into a set to reuse them across rate plans.
        </p>

        <div v-else class="flex flex-col gap-2">
          <div
            v-for="set in taxSets"
            :key="set.id"
            class="flex items-center justify-between gap-3 border rounded-lg p-3"
          >
            <div class="flex items-center gap-3 min-w-0">
              <div class="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
                <Icon name="lucide:layers" class="size-4 text-muted-foreground" />
              </div>
              <div class="flex flex-col min-w-0">
                <div class="flex items-center gap-2">
                  <span class="text-sm font-medium truncate">{{ set.title }}</span>
                  <Badge v-if="set.isDefault" variant="secondary" class="text-[10px] px-1.5 shrink-0">
                    Default
                  </Badge>
                </div>
                <span class="text-xs text-muted-foreground truncate">
                  {{ set.taxes.length === 0 ? 'No taxes' : set.taxes.map(t => feeTaxLabel(t.id)).join(' + ') }}
                </span>
                <span v-if="set.associatedRatePlanIds.length > 0" class="text-xs text-muted-foreground truncate">
                  {{ set.associatedRatePlanIds.map(ratePlanLabel).join(', ') }}
                </span>
              </div>
            </div>

            <div class="flex items-center gap-1 shrink-0">
              <Button
                v-if="!set.isDefault"
                variant="ghost"
                size="sm"
                class="h-7 px-2 text-xs text-muted-foreground"
                @click="setDefaultTaxSet(set.id)"
              >
                Make default
              </Button>
              <Button variant="ghost" size="sm" class="h-7 w-7 p-0" @click="openEditTaxSet(set.id)">
                <Icon name="lucide:pencil" class="size-3.5 text-muted-foreground" />
              </Button>
              <Button variant="ghost" size="sm" class="h-7 w-7 p-0" @click="removeTaxSet(set.id)">
                <Icon name="lucide:trash-2" class="size-3.5 text-muted-foreground" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Card>

    <!-- Add/Edit Tax Set Sheet -->
    <Sheet v-model:open="showTaxSetSheet">
      <SheetContent class="w-full sm:max-w-md p-0">
        <SheetHeader>
          <SheetTitle>{{ editingTaxSetId ? 'Edit Tax Set' : 'Add Tax Set' }}</SheetTitle>
          <SheetDescription>
            Group taxes together and set the order they are calculated.
          </SheetDescription>
        </SheetHeader>

        <div class="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
          <div class="flex flex-col gap-1.5">
            <Label>Title</Label>
            <Input v-model="taxSetDraft.title" placeholder="e.g., Standard Tax Set" />
          </div>

          <!-- Associated rate plans -->
          <div class="flex flex-col gap-2">
            <div class="flex items-center gap-1">
              <Label>Rate Plans</Label>
              <TooltipProvider :delay-duration="200">
                <Tooltip>
                  <TooltipTrigger as-child>
                    <button type="button" class="text-muted-foreground/60 hover:text-muted-foreground">
                      <Icon name="lucide:info" class="size-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" class="max-w-[260px] text-xs">
                    Apply this tax set to specific rate plans. When empty, it is available to all rate plans on this property.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            <p v-if="allRatePlans.length === 0" class="text-xs text-muted-foreground italic">
              No rate plans on this property yet.
            </p>

            <div v-else class="flex flex-col gap-2">
              <div
                v-for="rp in allRatePlans"
                :key="rp.id"
                class="flex items-center gap-3 border rounded-lg p-3 cursor-pointer"
                :class="taxSetDraft.associatedRatePlanIds.includes(rp.id) ? 'bg-muted/30' : ''"
                @click="toggleRatePlanInDraft(rp.id)"
              >
                <div class="flex size-4 shrink-0 items-center justify-center rounded-[4px] border" :class="taxSetDraft.associatedRatePlanIds.includes(rp.id) ? 'border-primary bg-primary text-primary-foreground' : 'border-input'">
                  <Icon v-if="taxSetDraft.associatedRatePlanIds.includes(rp.id)" name="lucide:check" class="size-3" />
                </div>
                <div class="flex flex-col min-w-0">
                  <span class="text-sm font-medium truncate">{{ rp.name }}</span>
                  <span class="text-xs text-muted-foreground truncate">{{ rp.unitTypeName }}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="flex flex-col gap-1.5">
            <Label>Currency</Label>
            <Select :model-value="taxSetDraft.currency ?? 'USD'" @update:model-value="(v) => taxSetDraft.currency = String(v)">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="c in currencies" :key="c.code" :value="c.code">
                  {{ c.symbol }} {{ c.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div class="flex flex-col gap-2">
            <div class="flex items-center gap-1">
              <Label>Taxes</Label>
              <TooltipProvider :delay-duration="200">
                <Tooltip>
                  <TooltipTrigger as-child>
                    <button type="button" class="text-muted-foreground/60 hover:text-muted-foreground">
                      <Icon name="lucide:info" class="size-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" class="max-w-[260px] text-xs">
                    Select the taxes to include, then drag them into calculation order. The top item is calculated first, so a VAT on top of a cleaning fee should sit below the fee.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            <p v-if="feesTaxes.length === 0" class="text-xs text-muted-foreground italic">
              Create a fee or tax first before building a set.
            </p>

            <div v-else class="flex flex-col gap-2">
              <!-- Selected taxes (ordered) -->
              <div
                v-for="tax in draftTaxOrder"
                :key="tax.id"
                class="flex items-start justify-between gap-2 border rounded-lg p-3 bg-muted/30 cursor-grab active:cursor-grabbing transition-colors"
                :class="dragOverTaxId === tax.id ? 'border-primary bg-primary/5' : ''"
                draggable="true"
                @dragstart="onTaxDragStart(tax.id)"
                @dragover="onTaxDragOver($event, tax.id)"
                @drop="onTaxDrop(tax.id)"
                @dragend="onTaxDragEnd"
              >
                <div class="flex items-start gap-2 min-w-0">
                  <Icon name="lucide:grip-vertical" class="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
                  <div class="flex flex-col min-w-0">
                    <div class="flex items-center gap-2">
                      <span class="text-sm font-medium truncate">{{ tax.title }}</span>
                      <Badge variant="secondary" class="text-[10px] px-1.5 shrink-0">
                        {{ ordinal(draftTaxOrder.indexOf(tax) + 1) }}
                      </Badge>
                    </div>
                    <span v-if="tax.summary" class="text-xs text-muted-foreground truncate">
                      {{ tax.summary }}
                    </span>
                  </div>
                </div>
                <div class="flex items-center gap-0.5 shrink-0">
                  <Button variant="ghost" size="sm" class="h-7 w-7 p-0" :disabled="draftTaxOrder.indexOf(tax) === 0" @click="moveTaxUp(tax.id)">
                    <Icon name="lucide:chevron-up" class="size-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" class="h-7 w-7 p-0" :disabled="draftTaxOrder.indexOf(tax) === draftTaxOrder.length - 1" @click="moveTaxDown(tax.id)">
                    <Icon name="lucide:chevron-down" class="size-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" class="h-7 w-7 p-0" title="Edit tax" @click="editTaxFromSet(tax.id)">
                    <Icon name="lucide:pencil" class="size-3.5 text-muted-foreground" />
                  </Button>
                  <Button variant="ghost" size="sm" class="h-7 w-7 p-0" title="Remove from set" @click="toggleTaxInDraft(tax.id)">
                    <Icon name="lucide:x" class="size-3.5 text-muted-foreground" />
                  </Button>
                </div>
              </div>

              <!-- Unselected taxes -->
              <div
                v-for="tax in feesTaxes.filter(t => !taxSetDraft.taxes.some(s => s.id === t.id))"
                :key="tax.id"
                class="flex items-center gap-3 border rounded-lg p-3 cursor-pointer hover:bg-accent/50 transition-colors"
                @click="toggleTaxInDraft(tax.id)"
              >
                <div class="flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-dashed border-input">
                  <Icon name="lucide:plus" class="size-3 text-muted-foreground" />
                </div>
                <span class="text-sm font-medium truncate text-muted-foreground">{{ tax.title }}</span>
                <Badge variant="secondary" class="text-[10px] px-1.5 shrink-0">
                  {{ tax.type === 'fee' ? 'Fee' : 'Tax' }}
                </Badge>
              </div>
            </div>
          </div>

          <!-- Pricing calculator -->
          <div class="flex flex-col gap-2 rounded-lg border bg-muted/30 p-4">
            <div class="flex items-center gap-1">
              <Icon name="lucide:calculator" class="size-3.5 text-muted-foreground" />
              <span class="text-sm font-medium">Price Preview</span>
            </div>
            <p class="text-xs text-muted-foreground">
              See how this tax set adds up on a sample stay.
            </p>

            <div class="grid grid-cols-2 gap-3 mt-1">
              <div class="flex flex-col gap-1.5">
                <Label>Base Price / Night</Label>
                <Input v-model.number="sampleBasePrice" type="number" min="0" class="h-8 text-xs" />
              </div>
              <div class="flex flex-col gap-1.5">
                <Label>Nights</Label>
                <Input v-model.number="sampleNights" type="number" min="1" class="h-8 text-xs" />
              </div>
            </div>

            <div class="flex flex-col gap-1.5 mt-2 text-sm">
              <div class="flex items-center justify-between">
                <span class="text-muted-foreground">Base total</span>
                <span>{{ taxSetCalc.sym }}{{ taxSetCalc.baseTotal.toFixed(2) }}</span>
              </div>
              <div
                v-for="line in taxSetCalc.lines"
                :key="line.id"
                class="flex items-start justify-between gap-2"
              >
                <div class="flex flex-col min-w-0">
                  <span class="font-medium truncate">{{ line.title }}</span>
                  <span class="text-xs text-muted-foreground">{{ line.detail }}</span>
                </div>
                <span class="shrink-0">+{{ taxSetCalc.sym }}{{ line.amount.toFixed(2) }}</span>
              </div>
              <div class="border-t pt-2 flex items-center justify-between font-semibold">
                <span>Total</span>
                <span>{{ taxSetCalc.sym }}{{ taxSetCalc.running.toFixed(2) }}</span>
              </div>
            </div>
          </div>
        </div>

        <SheetFooter class="border-t">
          <Button variant="outline" size="sm" @click="showTaxSetSheet = false">
            Cancel
          </Button>
          <Button size="sm" :disabled="!taxSetDraft.title.trim()" @click="saveTaxSet">
            <Icon name="lucide:check" class="size-3.5 mr-1.5" />
            {{ editingTaxSetId ? 'Save' : 'Add' }}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>

    <!-- Add Fee/Tax Sheet -->
    <Sheet v-model:open="showFeeTaxSheet">
      <SheetContent class="w-full sm:max-w-md p-0">
        <SheetHeader>
          <SheetTitle>{{ editingFeeTaxId ? 'Edit Fee or Tax' : 'Add Fee or Tax' }}</SheetTitle>
          <SheetDescription>
            Applied to direct bookings only. OTAs manage their own charges.
          </SheetDescription>
        </SheetHeader>

        <div class="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
          <div class="flex flex-col gap-1.5">
            <div class="flex items-center gap-1">
              <Label>Type</Label>
              <TooltipProvider :delay-duration="200">
                <Tooltip>
                  <TooltipTrigger as-child>
                    <button type="button" class="text-muted-foreground/60 hover:text-muted-foreground">
                      <Icon name="lucide:info" class="size-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" class="max-w-[220px] text-xs">
                    Tax is a percentage or amount charged on top. Fee is a fixed charge. City Tax is a locality-specific levy.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Select :model-value="feeTaxDraft.type" @update:model-value="(v) => feeTaxDraft.type = v as ListingFeeTaxItem['type']">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tax">
                  Tax
                </SelectItem>
                <SelectItem value="fee">
                  Fee
                </SelectItem>
                <SelectItem value="city_tax">
                  City Tax
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div class="flex flex-col gap-1.5">
            <div class="flex items-center gap-1">
              <Label>Title</Label>
              <TooltipProvider :delay-duration="200">
                <Tooltip>
                  <TooltipTrigger as-child>
                    <button type="button" class="text-muted-foreground/60 hover:text-muted-foreground">
                      <Icon name="lucide:info" class="size-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" class="max-w-[220px] text-xs">
                    The name guests will see on their booking, like VAT or Cleaning Fee.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Input v-model="feeTaxDraft.title" placeholder="e.g., VAT, Cleaning Fee, City Tax" />
          </div>

          <div class="flex flex-col gap-1.5">
            <div class="flex items-center gap-1">
              <Label>Logic</Label>
              <TooltipProvider :delay-duration="200">
                <Tooltip>
                  <TooltipTrigger as-child>
                    <button type="button" class="text-muted-foreground/60 hover:text-muted-foreground">
                      <Icon name="lucide:info" class="size-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" class="max-w-[240px] text-xs">
                    How the charge is calculated. Percent applies to the total, while per-night or per-person apply per unit of stay.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Select :model-value="feeTaxDraft.logic" @update:model-value="(v) => feeTaxDraft.logic = v as ListingFeeTaxItem['logic']">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="opt in logicOptions" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div class="flex flex-col gap-1.5">
              <div class="flex items-center gap-1">
                <Label>Rate</Label>
                <TooltipProvider :delay-duration="200">
                  <Tooltip>
                    <TooltipTrigger as-child>
                      <button type="button" class="text-muted-foreground/60 hover:text-muted-foreground">
                        <Icon name="lucide:info" class="size-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" class="max-w-[220px] text-xs">
                      The percentage (0 to 100) or the fixed amount charged.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div class="relative">
                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{{ isPercent() ? '%' : symbolFor(feeTaxDraft.currency ?? 'USD') }}</span>
                <Input
                  v-model.number="feeTaxDraft.rate"
                  type="number"
                  class="pl-7"
                  min="0"
                />
              </div>
            </div>
            <div v-if="!isPercent()" class="flex flex-col gap-1.5">
              <div class="flex items-center gap-1">
                <Label>Currency</Label>
                <TooltipProvider :delay-duration="200">
                  <Tooltip>
                    <TooltipTrigger as-child>
                      <button type="button" class="text-muted-foreground/60 hover:text-muted-foreground">
                        <Icon name="lucide:info" class="size-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" class="max-w-[220px] text-xs">
                      Only needed for fixed amounts. Percent charges use the property currency.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Select :model-value="feeTaxDraft.currency ?? 'USD'" @update:model-value="(v) => feeTaxDraft.currency = String(v)">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="c in currencies" :key="c.code" :value="c.code">
                    {{ c.symbol }} {{ c.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div class="flex items-center justify-between rounded-lg border p-3">
            <div class="flex flex-col gap-0.5">
              <div class="flex items-center gap-1">
                <span class="text-sm font-medium">Include in room price</span>
                <TooltipProvider :delay-duration="200">
                  <Tooltip>
                    <TooltipTrigger as-child>
                      <button type="button" class="text-muted-foreground/60 hover:text-muted-foreground">
                        <Icon name="lucide:info" class="size-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" class="max-w-[240px] text-xs">
                      When on, this charge is already folded into the nightly rate. When off, it is added on top of the total.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <span class="text-xs text-muted-foreground">When on, the tax is folded into the nightly rate.</span>
            </div>
            <Switch :model-value="feeTaxDraft.isInclusive" @update:model-value="(v) => feeTaxDraft.isInclusive = Boolean(v)" />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div class="flex flex-col gap-1.5">
              <div class="flex items-center gap-1">
                <Label>Skip Nights</Label>
                <TooltipProvider :delay-duration="200">
                  <Tooltip>
                    <TooltipTrigger as-child>
                      <button type="button" class="text-muted-foreground/60 hover:text-muted-foreground">
                        <Icon name="lucide:info" class="size-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" class="max-w-[220px] text-xs">
                      Number of initial nights not charged. Useful for long-stay taxes that start later.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Input :model-value="feeTaxDraft.skipNights ?? ''" type="number" min="0" placeholder="0" @update:model-value="(v) => feeTaxDraft.skipNights = v === '' ? null : Number(v)" />
            </div>
            <div class="flex flex-col gap-1.5">
              <div class="flex items-center gap-1">
                <Label>Max Nights</Label>
                <TooltipProvider :delay-duration="200">
                  <Tooltip>
                    <TooltipTrigger as-child>
                      <button type="button" class="text-muted-foreground/60 hover:text-muted-foreground">
                        <Icon name="lucide:info" class="size-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" class="max-w-[220px] text-xs">
                      Cap on the number of nights counted as taxable. Useful for short-stay taxes.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Input :model-value="feeTaxDraft.maxNights ?? ''" type="number" min="0" placeholder="None" @update:model-value="(v) => feeTaxDraft.maxNights = v === '' ? null : Number(v)" />
            </div>
          </div>

          <div class="flex flex-col gap-2">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-1">
                <Label>Applicable Date Ranges</Label>
                <TooltipProvider :delay-duration="200">
                  <Tooltip>
                    <TooltipTrigger as-child>
                      <button type="button" class="text-muted-foreground/60 hover:text-muted-foreground">
                        <Icon name="lucide:info" class="size-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" class="max-w-[240px] text-xs">
                      Optional windows when this charge applies. Useful for seasonal City Tax, like a tourist tax from June to August.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Button variant="outline" size="sm" class="gap-1.5" @click="addDateRange">
                <Icon name="lucide:plus" class="size-3.5" />
                Add range
              </Button>
            </div>

            <p v-if="feeTaxDraft.applicableDateRanges.length === 0" class="text-xs text-muted-foreground italic">
              No date restrictions. This charge always applies.
            </p>

            <div v-else class="flex flex-col gap-2">
              <div v-for="(range, idx) in feeTaxDraft.applicableDateRanges" :key="idx" class="flex items-center gap-2">
                <Input
                  type="date"
                  :model-value="range.after"
                  class="h-8 text-xs"
                  @update:model-value="(v) => updateDateRange(idx, 'after', String(v))"
                />
                <span class="text-xs text-muted-foreground">to</span>
                <Input
                  type="date"
                  :model-value="range.before"
                  class="h-8 text-xs"
                  @update:model-value="(v) => updateDateRange(idx, 'before', String(v))"
                />
                <Button variant="ghost" size="sm" class="h-8 w-8 p-0 shrink-0" @click="removeDateRange(idx)">
                  <Icon name="lucide:x" class="size-3.5 text-muted-foreground" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        <SheetFooter class="border-t">
          <Button variant="outline" size="sm" @click="closeFeeTaxSheet">
            Cancel
          </Button>
          <Button size="sm" :disabled="!feeTaxDraft.title.trim()" @click="saveFeeTaxItem">
            <Icon name="lucide:check" class="size-3.5 mr-1.5" />
            {{ editingFeeTaxId ? 'Save' : 'Add' }}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>

    <!-- Add Rate Plan Sheet -->
    <Sheet v-model:open="showAddRatePlanSheet">
      <SheetContent class="w-full sm:max-w-md p-0">
        <SheetHeader>
          <SheetTitle>Add Rate Plan</SheetTitle>
          <SheetDescription>
            Set the name, price and selling rules for this new plan.
          </SheetDescription>
        </SheetHeader>

        <div class="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-5">
          <div class="flex flex-col gap-1.5">
            <Label>Rate Plan Name</Label>
            <Input v-model="addRatePlanDraft.title" placeholder="e.g., Best Available Rate, Weekly, Non-refundable" />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div class="flex flex-col gap-1.5">
              <Label>Currency</Label>
              <Select :model-value="addRatePlanDraft.currency" @update:model-value="(v) => addRatePlanDraft.currency = String(v)">
                <SelectTrigger class="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="c in currencies" :key="c.code" :value="c.code">
                    {{ c.symbol }} {{ c.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div class="flex flex-col gap-1.5">
              <Label>Sell Mode</Label>
              <Select :model-value="addRatePlanDraft.sellMode" @update:model-value="(v) => addRatePlanDraft.sellMode = String(v) as RateSellMode">
                <SelectTrigger class="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="per_room">
                    Per Room
                  </SelectItem>
                  <SelectItem value="per_person">
                    Per Person
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div class="flex flex-col gap-1.5">
            <Label>Rate Mode</Label>
            <Select :model-value="addRatePlanDraft.rateMode" @update:model-value="(v) => addRatePlanDraft.rateMode = String(v) as RateRateMode">
              <SelectTrigger class="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">
                  Manual
                </SelectItem>
                <SelectItem value="derived">
                  Derived
                </SelectItem>
                <SelectItem value="auto">
                  Auto
                </SelectItem>
                <SelectItem value="cascade">
                  Cascade
                </SelectItem>
              </SelectContent>
            </Select>
            <p class="text-[10px] text-muted-foreground">
              {{ rateModeHint(addRatePlanDraft.rateMode) }}
            </p>
          </div>

          <CancellationPolicyEditor v-model:config="addRatePlanDraft.cancellationPolicyConfig" />

          <div class="flex flex-col gap-2">
            <div class="flex items-center justify-between">
              <Label>Occupancy Options</Label>
              <Button
                variant="outline"
                size="sm"
                class="h-7 gap-1"
                :disabled="addRatePlanDraft.sellMode === 'per_room'"
                title="Per room plans use a single option at max occupancy"
                @click="draftAddOption(addRatePlanDraft)"
              >
                <Icon name="lucide:plus" class="size-3" />
                Option
              </Button>
            </div>
            <div class="flex flex-col gap-2">
              <div v-for="(opt, oi) in addRatePlanDraft.options" :key="oi" class="flex items-center gap-2 border rounded-lg p-2">
                <Icon name="lucide:users" class="size-3.5 text-muted-foreground shrink-0" />
                <Input
                  type="number"
                  :model-value="opt.occupancy"
                  min="1"
                  class="w-16 h-8 text-xs"
                  @update:model-value="(v) => addRatePlanDraft.options[oi] = { ...opt, occupancy: Math.max(1, Number(v) || 1) }"
                />
                <span class="text-xs text-muted-foreground whitespace-nowrap">guest{{ opt.occupancy !== 1 ? 's' : '' }}</span>
                <div class="relative flex-1">
                  <span class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{{ symbolFor(addRatePlanDraft.currency) }}</span>
                  <Input
                    type="number"
                    :model-value="opt.rate"
                    class="pl-7 h-8 text-xs"
                    min="0"
                    @update:model-value="(v) => addRatePlanDraft.options[oi] = { ...opt, rate: Number(v) || 0 }"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  class="h-7 w-7 p-0 shrink-0"
                  :disabled="addRatePlanDraft.options.length <= 1"
                  title="Remove option"
                  @click="draftRemoveOption(addRatePlanDraft, oi)"
                >
                  <Icon name="lucide:x" class="size-3.5 text-muted-foreground" />
                </Button>
              </div>
            </div>
            <p v-if="addRatePlanDraft.sellMode === 'per_room'" class="text-[10px] text-muted-foreground">
              Per room plans use a single option at max occupancy.
            </p>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div class="flex flex-col gap-1.5">
              <Label>Children Fee / Night</Label>
              <div class="relative">
                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{{ symbolFor(addRatePlanDraft.currency) }}</span>
                <Input
                  type="number"
                  :model-value="addRatePlanDraft.childrenFee"
                  class="pl-7 h-8"
                  min="0"
                  @update:model-value="(v) => addRatePlanDraft.childrenFee = Number(v) || 0"
                />
              </div>
            </div>
            <div class="flex flex-col gap-1.5">
              <Label>Infant Fee / Night</Label>
              <div class="relative">
                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{{ symbolFor(addRatePlanDraft.currency) }}</span>
                <Input
                  type="number"
                  :model-value="addRatePlanDraft.infantFee"
                  class="pl-7 h-8"
                  min="0"
                  @update:model-value="(v) => addRatePlanDraft.infantFee = Number(v) || 0"
                />
              </div>
            </div>
          </div>

          <!-- Stay + availability restrictions -->
          <div class="flex flex-col gap-4 rounded-lg border p-3">
            <div class="flex flex-col gap-2">
              <Label>Stay Restrictions</Label>
              <div class="flex flex-col gap-2">
                <div
                  v-for="row in stayRows"
                  :key="row.field"
                  class="flex items-center justify-between gap-3"
                >
                  <span class="text-xs font-medium">{{ row.label }}</span>
                  <div class="flex items-center gap-1.5">
                    <Input
                      type="number"
                      :model-value="stayValue(addRatePlanDraft, row.field)"
                      :min="row.min"
                      class="h-8 w-16 text-sm text-right"
                      @update:model-value="(v) => setStayValue(addRatePlanDraft, row.field, Number(v), row.min)"
                    />
                    <span class="text-xs text-muted-foreground">nights</span>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            <div class="flex flex-col gap-3">
              <Label>Availability Restrictions (Mon–Sun)</Label>
              <div
                v-for="row in boolRows"
                :key="row.field"
                class="flex flex-col gap-2"
              >
                <span class="text-xs font-medium">{{ row.label }}</span>
                <div class="grid grid-cols-7 gap-1">
                  <label
                    v-for="(label, d) in WEEKDAY_LABELS"
                    :key="label"
                    class="flex flex-col items-center gap-1 rounded-md border py-1.5 cursor-pointer transition-colors"
                    :class="boolDayChecked(addRatePlanDraft, row.field, d) ? 'border-primary bg-primary/5' : 'hover:bg-accent/50'"
                  >
                    <span class="text-[10px] font-medium" :class="boolDayChecked(addRatePlanDraft, row.field, d) ? 'text-primary' : 'text-muted-foreground'">
                      {{ label }}
                    </span>
                    <Checkbox
                      :model-value="boolDayChecked(addRatePlanDraft, row.field, d)"
                      @update:model-value="toggleBoolDay(addRatePlanDraft, row.field, d)"
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>

          <!-- Meal type -->
          <div class="flex flex-col gap-1.5">
            <Label>Meal Type</Label>
            <Select :model-value="addRatePlanDraft.mealType" @update:model-value="(v) => addRatePlanDraft.mealType = String(v) as RateMealType">
              <SelectTrigger class="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  None
                </SelectItem>
                <SelectItem value="breakfast">
                  Breakfast
                </SelectItem>
                <SelectItem value="half_board">
                  Half Board
                </SelectItem>
                <SelectItem value="full_board">
                  Full Board
                </SelectItem>
                <SelectItem value="all_inclusive">
                  All Inclusive
                </SelectItem>
                <SelectItem value="room_only">
                  Room Only
                </SelectItem>
                <SelectItem value="bed_and_breakfast">
                  Bed &amp; Breakfast
                </SelectItem>
                <SelectItem value="self_catering">
                  Self Catering
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <SheetFooter class="border-t">
          <Button variant="outline" size="sm" @click="closeAddRatePlanSheet">
            Cancel
          </Button>
          <Button size="sm" :disabled="!addRatePlanDraft.title.trim()" @click="saveNewRatePlan">
            <Icon name="lucide:check" class="size-3.5 mr-1.5" />
            Add
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>

    <!-- Edit Rate Plan Sheet -->
    <Sheet v-model:open="showEditRatePlanSheet">
      <SheetContent class="w-full sm:max-w-md p-0">
        <SheetHeader>
          <SheetTitle>Edit Rate Plan</SheetTitle>
          <SheetDescription>
            Adjust pricing, occupancy options and restrictions for this rate plan.
          </SheetDescription>
        </SheetHeader>

        <div class="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
          <div class="flex items-center justify-between gap-2">
            <div class="flex flex-col gap-0.5 min-w-0">
              <Input
                :model-value="editRatePlanDraft.title"
                placeholder="Rate plan name"
                class="max-w-[240px]"
                @update:model-value="(v) => editRatePlanDraft.title = String(v)"
              />
              <div class="flex items-center gap-2">
                <Badge v-if="editRatePlanDraft.isBase" variant="default" class="text-[10px] px-1.5">
                  Base
                </Badge>
                <span class="text-[10px] text-muted-foreground">
                  Base plans cannot be deleted.
                </span>
              </div>
            </div>
            <Button
              v-if="!editRatePlanDraft.isBase"
              variant="outline"
              size="sm"
              class="h-7 gap-1 shrink-0"
              @click="setRatePlanPrimary(editRatePlanUnitTypeId, editRatePlanIndex); showEditRatePlanSheet = false"
            >
              Make base
            </Button>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div class="flex flex-col gap-1.5">
              <Label>Sell Mode</Label>
              <Select :model-value="editRatePlanDraft.sellMode" @update:model-value="(v) => editRatePlanDraft.sellMode = String(v) as RateSellMode">
                <SelectTrigger class="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="per_room">
                    Per Room
                  </SelectItem>
                  <SelectItem value="per_person">
                    Per Person
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div class="flex flex-col gap-1.5">
              <Label>Currency</Label>
              <Select :model-value="editRatePlanDraft.currency" @update:model-value="(v) => editRatePlanDraft.currency = String(v)">
                <SelectTrigger class="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="c in currencies" :key="c.code" :value="c.code">
                    {{ c.symbol }} {{ c.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div class="flex flex-col gap-1.5">
            <Label>Rate Mode</Label>
            <Select :model-value="editRatePlanDraft.rateMode" @update:model-value="(v) => editRatePlanDraft.rateMode = String(v) as RateRateMode">
              <SelectTrigger class="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">
                  Manual
                </SelectItem>
                <SelectItem value="derived">
                  Derived
                </SelectItem>
                <SelectItem value="auto">
                  Auto
                </SelectItem>
                <SelectItem value="cascade">
                  Cascade
                </SelectItem>
              </SelectContent>
            </Select>
            <p class="text-[10px] text-muted-foreground">
              {{ rateModeHint(editRatePlanDraft.rateMode) }}
            </p>
          </div>

          <CancellationPolicyEditor v-model:config="editRatePlanDraft.cancellationPolicyConfig" />

          <!-- Occupancy options -->
          <div class="flex flex-col gap-2">
            <div class="flex items-center justify-between">
              <Label>Occupancy Options</Label>
              <Button
                variant="outline"
                size="sm"
                class="h-7 gap-1"
                :disabled="editRatePlanDraft.sellMode === 'per_room'"
                title="Per room plans use a single option at max occupancy"
                @click="draftAddOption(editRatePlanDraft)"
              >
                <Icon name="lucide:plus" class="size-3" />
                Option
              </Button>
            </div>

            <div v-for="(opt, oi) in editRatePlanDraft.options" :key="oi" class="flex items-center gap-2 border rounded-lg p-2">
              <Icon name="lucide:users" class="size-3.5 text-muted-foreground shrink-0" />
              <Input
                type="number"
                :model-value="opt.occupancy"
                min="1"
                class="w-16 h-8 text-xs"
                @update:model-value="(v) => editRatePlanDraft.options[oi] = { ...opt, occupancy: Math.max(1, Number(v) || 1) }"
              />
              <span class="text-xs text-muted-foreground whitespace-nowrap">guest{{ opt.occupancy !== 1 ? 's' : '' }}</span>
              <div class="relative flex-1">
                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{{ symbolFor(editRatePlanDraft.currency) }}</span>
                <Input
                  type="number"
                  :model-value="opt.rate"
                  class="pl-7 h-8 text-xs"
                  min="0"
                  @update:model-value="(v) => editRatePlanDraft.options[oi] = { ...opt, rate: Number(v) || 0 }"
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                class="h-7 w-7 p-0 shrink-0"
                :disabled="editRatePlanDraft.options.length <= 1"
                title="Remove option"
                @click="draftRemoveOption(editRatePlanDraft, oi)"
              >
                <Icon name="lucide:x" class="size-3.5 text-muted-foreground" />
              </Button>
            </div>
          </div>

          <!-- Children / infant fee -->
          <div class="grid grid-cols-2 gap-4">
            <div class="flex flex-col gap-1.5">
              <Label>Children Fee / Night</Label>
              <div class="relative">
                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{{ symbolFor(editRatePlanDraft.currency) }}</span>
                <Input
                  type="number"
                  :model-value="editRatePlanDraft.childrenFee"
                  class="pl-7 h-8"
                  min="0"
                  @update:model-value="(v) => editRatePlanDraft.childrenFee = Number(v) || 0"
                />
              </div>
            </div>
            <div class="flex flex-col gap-1.5">
              <Label>Infant Fee / Night</Label>
              <div class="relative">
                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{{ symbolFor(editRatePlanDraft.currency) }}</span>
                <Input
                  type="number"
                  :model-value="editRatePlanDraft.infantFee"
                  class="pl-7 h-8"
                  min="0"
                  @update:model-value="(v) => editRatePlanDraft.infantFee = Number(v) || 0"
                />
              </div>
            </div>
          </div>

          <!-- Stay + availability restrictions -->
          <div class="flex flex-col gap-4 rounded-lg border p-3">
            <!-- Stay restrictions -->
            <div class="flex flex-col gap-2">
              <Label>Stay Restrictions</Label>
              <div class="flex flex-col gap-2">
                <div
                  v-for="row in stayRows"
                  :key="row.field"
                  class="flex items-center justify-between gap-3"
                >
                  <span class="text-xs font-medium">{{ row.label }}</span>
                  <div class="flex items-center gap-1.5">
                    <Input
                      type="number"
                      :model-value="stayValue(editRatePlanDraft, row.field)"
                      :min="row.min"
                      class="h-8 w-16 text-sm text-right"
                      @update:model-value="(v) => setStayValue(editRatePlanDraft, row.field, Number(v), row.min)"
                    />
                    <span class="text-xs text-muted-foreground">nights</span>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            <!-- Availability restrictions per weekday -->
            <div class="flex flex-col gap-3">
              <Label>Availability Restrictions (Mon–Sun)</Label>
              <div
                v-for="row in boolRows"
                :key="row.field"
                class="flex flex-col gap-2"
              >
                <span class="text-xs font-medium">{{ row.label }}</span>
                <div class="grid grid-cols-7 gap-1">
                  <label
                    v-for="(label, d) in WEEKDAY_LABELS"
                    :key="label"
                    class="flex flex-col items-center gap-1 rounded-md border py-1.5 cursor-pointer transition-colors"
                    :class="boolDayChecked(editRatePlanDraft, row.field, d) ? 'border-primary bg-primary/5' : 'hover:bg-accent/50'"
                  >
                    <span class="text-[10px] font-medium" :class="boolDayChecked(editRatePlanDraft, row.field, d) ? 'text-primary' : 'text-muted-foreground'">
                      {{ label }}
                    </span>
                    <Checkbox
                      :model-value="boolDayChecked(editRatePlanDraft, row.field, d)"
                      @update:model-value="toggleBoolDay(editRatePlanDraft, row.field, d)"
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>

          <!-- Meal type -->
          <div class="flex flex-col gap-1.5">
            <Label>Meal Type</Label>
            <Select :model-value="editRatePlanDraft.mealType" @update:model-value="(v) => editRatePlanDraft.mealType = String(v) as RateMealType">
              <SelectTrigger class="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  None
                </SelectItem>
                <SelectItem value="breakfast">
                  Breakfast
                </SelectItem>
                <SelectItem value="half_board">
                  Half Board
                </SelectItem>
                <SelectItem value="full_board">
                  Full Board
                </SelectItem>
                <SelectItem value="all_inclusive">
                  All Inclusive
                </SelectItem>
                <SelectItem value="room_only">
                  Room Only
                </SelectItem>
                <SelectItem value="bed_and_breakfast">
                  Bed &amp; Breakfast
                </SelectItem>
                <SelectItem value="self_catering">
                  Self Catering
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <SheetFooter class="border-t">
          <Button variant="outline" size="sm" @click="closeEditRatePlanSheet">
            Cancel
          </Button>
          <Button size="sm" :disabled="!editRatePlanDraft.title.trim()" @click="saveEditedRatePlan">
            <Icon name="lucide:check" class="size-3.5 mr-1.5" />
            Save
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>

    <!-- Per-unit-type pricing -->
    <template v-if="unitTypes.length > 0">
      <div
        v-for="ut in unitTypes"
        :key="ut.id"
        class="border rounded-lg overflow-hidden"
      >
        <button
          type="button"
          class="flex w-full items-center justify-between gap-3 p-4 hover:bg-accent/50 transition-colors text-left"
          @click="toggleExpand(ut.id)"
        >
          <div class="flex items-center gap-2 min-w-0">
            <Icon name="lucide:layers" class="size-4 text-muted-foreground shrink-0" />
            <h3 class="text-sm font-semibold truncate">
              {{ ut.name }}
            </h3>
            <Badge variant="secondary" class="text-[10px] px-1.5 shrink-0">
              {{ ut.units.length }} unit{{ ut.units.length !== 1 ? 's' : '' }}
            </Badge>
            <Badge variant="outline" class="text-[10px] px-1.5 shrink-0 gap-1">
              <Icon name="lucide:users" class="size-3" />
              {{ maxGuests(ut) }} guest{{ maxGuests(ut) !== 1 ? 's' : '' }}
            </Badge>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <span class="text-xs text-muted-foreground">
              {{ symbolFor(ut.pricing.currency) }}{{ ratePlanNightlyRate(ut.pricing.ratePlans.find(rp => rp.isBase) ?? ut.pricing.ratePlans[0] ?? createRatePlan({})) }}/night
            </span>
            <Icon
              name="lucide:chevron-down"
              class="size-4 text-muted-foreground transition-transform"
              :class="expandedId === ut.id ? 'rotate-180' : ''"
            />
          </div>
        </button>

        <div v-if="expandedId === ut.id" class="border-t p-5 flex flex-col gap-6">
          <div class="flex items-center justify-between gap-3">
            <span class="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Currency
            </span>
            <Select :model-value="ut.pricing.currency" @update:model-value="(v) => setCurrency(ut.id, String(v))">
              <SelectTrigger class="w-32 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="c in currencies" :key="c.code" :value="c.code">
                  {{ c.symbol }} {{ c.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <!-- Guest capacity -->
          <div class="flex items-center gap-2 rounded-lg border p-3 bg-muted/30">
            <Icon name="lucide:users" class="size-4 text-muted-foreground shrink-0" />
            <div class="flex flex-col gap-0.5">
              <span class="text-sm font-medium">Up to {{ maxGuests(ut) }} guests</span>
              <span class="text-xs text-muted-foreground">{{ guestCapacityLabel(ut) }}</span>
            </div>
          </div>

          <!-- Rate plans -->
          <div class="flex flex-col gap-3">
            <div class="flex items-center justify-between">
              <div>
                <h4 class="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Rate Plans
                </h4>
                <p class="text-[10px] text-muted-foreground mt-0.5">
                  The base rate plan cannot be deleted. Prices follow the Channex rate plan format.
                </p>
              </div>
              <Button variant="outline" size="sm" class="gap-1.5" @click="openAddRatePlanSheet(ut.id)">
                <Icon name="lucide:plus" class="size-3.5" />
                Add Rate Plan
              </Button>
            </div>

            <div
              v-if="ut.pricing.ratePlans.length === 0"
              class="text-xs text-muted-foreground italic"
            >
              No rate plans yet. Add one to set nightly pricing.
            </div>

            <div v-else class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div
                v-for="(rp, idx) in ut.pricing.ratePlans"
                :key="rp.id"
                class="flex flex-col rounded-xl border p-4 gap-3 transition-colors"
                :class="rp.isBase ? 'border-primary/40 bg-primary/5' : 'bg-card hover:border-foreground/20'"
              >
                <!-- Header -->
                <div class="flex items-start justify-between gap-2">
                  <div class="flex flex-col gap-0.5 min-w-0">
                    <div class="flex items-center gap-2 min-w-0">
                      <span class="text-sm font-semibold truncate">{{ rp.title }}</span>
                      <Badge v-if="rp.isBase" variant="default" class="text-[10px] px-1.5 shrink-0">
                        Base
                      </Badge>
                    </div>
                    <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span class="capitalize">{{ rp.sellMode === 'per_room' ? 'Per Room' : 'Per Person' }}</span>
                      <span>·</span>
                      <span class="capitalize">{{ rp.rateMode }}</span>
                      <span>·</span>
                      <span class="uppercase">{{ rp.currency }}</span>
                    </div>
                  </div>
                  <div class="flex items-center gap-0.5 shrink-0">
                    <Button variant="ghost" size="sm" class="h-7 w-7 p-0" title="Edit rate plan" @click="openEditRatePlanSheet(ut.id, idx)">
                      <Icon name="lucide:pencil" class="size-3.5 text-muted-foreground" />
                    </Button>
                    <Button
                      v-if="!rp.isBase"
                      variant="ghost"
                      size="sm"
                      class="h-7 w-7 p-0"
                      title="Delete rate plan"
                      @click="removeRatePlan(ut.id, idx)"
                    >
                      <Icon name="lucide:trash-2" class="size-3.5 text-muted-foreground hover:text-destructive" />
                    </Button>
                  </div>
                </div>

                <!-- Rate + occupancy -->
                <div class="flex items-end justify-between gap-2">
                  <div>
                    <p class="text-xl font-bold leading-none">
                      {{ symbolFor(ut.pricing.currency) }}{{ primaryOption(rp).rate }}
                    </p>
                    <p class="text-[10px] text-muted-foreground mt-1">
                      {{ rp.sellMode === 'per_person' ? 'per guest / night' : 'per night' }}
                    </p>
                  </div>
                  <Badge variant="secondary" class="gap-1 text-[10px]">
                    <Icon name="lucide:users" class="size-3" />
                    up to {{ ratePlanMaxOccupancy(rp) }} guests
                  </Badge>
                </div>

                <!-- Occupancy options -->
                <div class="flex flex-wrap gap-1.5">
                  <span
                    v-for="opt in rp.options"
                    :key="opt.occupancy"
                    class="rounded-md border bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                  >
                    {{ opt.occupancy }} guest{{ opt.occupancy !== 1 ? 's' : '' }} · {{ symbolFor(ut.pricing.currency) }}{{ opt.rate }}
                  </span>
                </div>

                <!-- Restrictions summary -->
                <div class="flex flex-wrap gap-x-3 gap-y-1 border-t pt-2.5 text-[10px] text-muted-foreground">
                  <span>Min stay {{ Math.max(...rp.minStayArrival) }}</span>
                  <span>Max stay {{ Math.max(...rp.maxStay) || '∞' }}</span>
                  <span v-if="rp.childrenFee > 0">Child +{{ symbolFor(ut.pricing.currency) }}{{ rp.childrenFee }}</span>
                  <span v-if="rp.infantFee > 0">Infant +{{ symbolFor(ut.pricing.currency) }}{{ rp.infantFee }}</span>
                  <span v-if="rp.stopSell[0]" class="text-destructive">Stop sell</span>
                  <span v-if="rp.mealType !== 'none'" class="capitalize">{{ rp.mealType.replace(/_/g, ' ') }}</span>
                  <span>{{ cancellationPolicySummary(rp.cancellationPolicyConfig) }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Offerings -->
          <div class="flex flex-col gap-3 mt-6">
            <div class="flex items-center justify-between">
              <div>
                <h4 class="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Offerings
                </h4>
                <p class="text-[10px] text-muted-foreground mt-0.5">
                  Adjust base price by fixed amount or percentage.
                </p>
              </div>
              <Button variant="outline" size="sm" class="gap-1.5" @click="addOffering(ut.id)">
                <Icon name="lucide:plus" class="size-3.5" />
                Add Offering
              </Button>
            </div>

            <p v-if="ut.pricing.offerings.length === 0" class="text-xs text-muted-foreground italic">
              No offerings added yet.
            </p>

            <div v-else class="flex flex-col gap-3">
              <div v-for="(offering, idx) in ut.pricing.offerings" :key="offering.id" class="border rounded-lg p-3 space-y-3">
                <div class="flex items-center justify-between">
                  <Input
                    :model-value="offering.name"
                    placeholder="Offering name"
                    class="max-w-[200px]"
                    @update:model-value="(v) => updateOffering(ut.id, idx, 'name', String(v))"
                  />
                  <Button variant="ghost" size="sm" class="h-7 w-7 p-0" @click="removeOffering(ut.id, idx)">
                    <Icon name="lucide:trash-2" class="size-3.5 text-muted-foreground" />
                  </Button>
                </div>
                <div class="flex items-center gap-2">
                  <Select :model-value="offering.adjustmentType" @update:model-value="(v) => updateOffering(ut.id, idx, 'adjustmentType', v)">
                    <SelectTrigger class="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed">
                        Fixed
                      </SelectItem>
                      <SelectItem value="percent">
                        Percent
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <div class="relative flex-1">
                    <span class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{{ offering.adjustmentType === 'percent' ? '%' : symbolFor(ut.pricing.currency) }}</span>
                    <Input
                      type="number"
                      :model-value="offering.adjustmentValue"
                      class="pl-7"
                      @update:model-value="(v) => updateOffering(ut.id, idx, 'adjustmentValue', Number(v) || 0)"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Length of stay discounts -->
          <div class="flex flex-col gap-3 mt-6">
            <div class="flex items-center justify-between">
              <h4 class="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Length of Stay Discounts
              </h4>
              <Button variant="outline" size="sm" class="gap-1.5" @click="addLosDiscount(ut.id)">
                <Icon name="lucide:plus" class="size-3.5" />
                Add Discount
              </Button>
            </div>

            <p v-if="ut.pricing.lengthOfStayDiscounts.length === 0" class="text-xs text-muted-foreground italic">
              No discounts configured.
            </p>

            <div v-else class="flex flex-col gap-2">
              <div v-for="(discount, idx) in ut.pricing.lengthOfStayDiscounts" :key="discount.id" class="flex items-center gap-2">
                <div class="flex items-center gap-1.5">
                  <Label class="text-xs whitespace-nowrap">Min nights:</Label>
                  <Input
                    type="number"
                    :model-value="discount.minNights"
                    class="w-16 h-8"
                    min="1"
                    @update:model-value="(v) => updateLosDiscount(ut.id, idx, 'minNights', Number(v) || 1)"
                  />
                </div>
                <Select :model-value="discount.discountType" @update:model-value="(v) => updateLosDiscount(ut.id, idx, 'discountType', v)">
                  <SelectTrigger class="w-24 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">
                      Percent
                    </SelectItem>
                    <SelectItem value="fixed">
                      Fixed
                    </SelectItem>
                  </SelectContent>
                </Select>
                <div class="relative flex-1">
                  <span class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{{ discount.discountType === 'percent' ? '%' : symbolFor(ut.pricing.currency) }}</span>
                  <Input
                    type="number"
                    :model-value="discount.value"
                    class="pl-7 h-8"
                    @update:model-value="(v) => updateLosDiscount(ut.id, idx, 'value', Number(v) || 0)"
                  />
                </div>
                <Button variant="ghost" size="sm" class="h-8 w-8 p-0 shrink-0" @click="removeLosDiscount(ut.id, idx)">
                  <Icon name="lucide:x" class="size-3.5 text-muted-foreground" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Legacy property-level pricing -->
    <template v-else>
      <Card class="p-5">
        <h3 class="text-sm font-semibold mb-4">
          Base Pricing
        </h3>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div class="flex flex-col gap-1.5">
            <Label>Nightly Rate ($)</Label>
            <Input :model-value="editForm.nightlyRate" type="number" @update:model-value="(v) => patchLegacyPricing({ nightlyRate: Number(v) || 0 })" />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label>Cleaning Fee ($)</Label>
            <Input :model-value="editForm.cleaningFee" type="number" @update:model-value="(v) => patchLegacyPricing({ cleaningFee: Number(v) || 0 })" />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label>Service Fee ($)</Label>
            <Input :model-value="editForm.serviceFee" type="number" @update:model-value="(v) => patchLegacyPricing({ serviceFee: Number(v) || 0 })" />
          </div>
        </div>
      </Card>

      <Card class="p-5">
        <h3 class="text-sm font-semibold mb-4">
          Discounts
        </h3>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div class="flex flex-col gap-1.5">
            <Label>Weekly Discount (%)</Label>
            <Input :model-value="editForm.weeklyDiscount" type="number" @update:model-value="(v) => patchLegacyPricing({ weeklyDiscount: Number(v) || 0 })" />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label>Monthly Discount (%)</Label>
            <Input :model-value="editForm.monthlyDiscount" type="number" @update:model-value="(v) => patchLegacyPricing({ monthlyDiscount: Number(v) || 0 })" />
          </div>
        </div>
      </Card>

      <Card class="p-5">
        <h3 class="text-sm font-semibold mb-4">
          Seasonal Rates
        </h3>
        <Table v-if="listing.pricing.seasonalRates.length > 0">
          <TableHeader>
            <TableRow>
              <TableHead>Season</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead>Rate</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="season in listing.pricing.seasonalRates" :key="season.label">
              <TableCell class="font-medium">
                {{ season.label }}
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ season.startDate }} → {{ season.endDate }}
              </TableCell>
              <TableCell>${{ season.rate }}/night</TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <p v-else class="text-sm text-muted-foreground">
          No seasonal rates configured.
        </p>
      </Card>
    </template>
  </div>
</template>
