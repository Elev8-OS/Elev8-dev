<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { listings, type ListingFeeTaxItem, type TaxDateRange, type TaxSet } from '~/components/listings/data/listings'
import { useFeesTaxes } from '~/composables/useFeesTaxes'

const {
  feeTaxItems,
  taxSets,
  getFeesTaxesForListing,
  getTaxSetsForListing,
  upsertFeeTaxItem,
  removeFeeTaxItem,
  upsertTaxSet,
  removeTaxSet,
  setDefaultTaxSet,
  toggleListingFeeTax,
  toggleListingTaxSet,
  unassignFeeTax,
  unassignTaxSet,
  assignToMany,
  listingIdsForFeeTax,
  listingIdsForTaxSet,
} = useFeesTaxes()

const currencies = [
  { code: 'USD', symbol: '$', label: 'USD' },
  { code: 'IDR', symbol: 'IDR', label: 'IDR' },
  { code: 'EUR', symbol: '€', label: 'EUR' },
  { code: 'GBP', symbol: '£', label: 'GBP' },
  { code: 'AUD', symbol: 'A$', label: 'AUD' },
  { code: 'SGD', symbol: 'S$', label: 'SGD' },
]

const logicOptions = [
  { value: 'percent', label: 'Percent' },
  { value: 'per_room', label: 'Per Room' },
  { value: 'per_room_per_night', label: 'Per Room / Night' },
  { value: 'per_person', label: 'Per Person' },
  { value: 'per_person_per_night', label: 'Per Person / Night' },
  { value: 'per_night', label: 'Per Night' },
  { value: 'per_booking', label: 'Per Booking' },
] as const

const logicLabels: Record<string, string> = {
  percent: 'Percent',
  per_room: 'Per Room',
  per_room_per_night: 'Per Room / Night',
  per_person: 'Per Person',
  per_person_per_night: 'Per Person / Night',
  per_night: 'Per Night',
  per_booking: 'Per Booking',
}

function symbolFor(code: string): string {
  return currencies.find(c => c.code === code)?.symbol ?? '$'
}

function feeTaxSummary(tax: ListingFeeTaxItem): string {
  const amount = tax.logic === 'percent'
    ? `${tax.rate}%`
    : `${symbolFor(tax.currency ?? 'USD')}${tax.rate}`
  const parts = [amount, logicLabels[tax.logic] ?? tax.logic]
  if (tax.isInclusive)
    parts.push('included')
  if (tax.skipNights)
    parts.push(`skip ${tax.skipNights}`)
  if (tax.maxNights)
    parts.push(`max ${tax.maxNights}`)
  return parts.join(' · ')
}

function getListingName(id: string): string {
  return listings.value.find(l => l.id === id)?.name ?? id
}

// ── Fee / tax item form ────────────────────────────────────────────────
const showFeeTaxSheet = ref(false)
const editingFeeTaxId = ref<string | null>(null)
const feeTaxDraft = ref<ListingFeeTaxItem>(emptyFeeTaxDraft())

function emptyFeeTaxDraft(): ListingFeeTaxItem {
  return {
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
}

function isPercent(): boolean {
  return feeTaxDraft.value.logic === 'percent'
}

function openAddFeeTax() {
  editingFeeTaxId.value = null
  feeTaxDraft.value = emptyFeeTaxDraft()
  showFeeTaxSheet.value = true
}

function openEditFeeTax(id: string) {
  const found = feeTaxItems.value.find(t => t.id === id)
  if (!found)
    return
  editingFeeTaxId.value = id
  feeTaxDraft.value = {
    ...found,
    applicableDateRanges: found.applicableDateRanges.map(r => ({ ...r })),
  }
  showFeeTaxSheet.value = true
}

function saveFeeTax() {
  if (!feeTaxDraft.value.title.trim())
    return
  const item: ListingFeeTaxItem = {
    ...feeTaxDraft.value,
    id: editingFeeTaxId.value || `ft-${Date.now()}`,
    title: feeTaxDraft.value.title.trim(),
  }
  upsertFeeTaxItem(item)
  showFeeTaxSheet.value = false
  toast.success(editingFeeTaxId.value ? 'Fee or tax updated' : 'Fee or tax added')
}

function confirmRemoveFeeTax(id: string) {
  removeFeeTaxItem(id)
  toast.success('Fee or tax removed')
}

// ── Tax set form ───────────────────────────────────────────────────────
const showTaxSetSheet = ref(false)
const editingTaxSetId = ref<string | null>(null)
const taxSetDraft = ref<TaxSet>(emptyTaxSetDraft())

function emptyTaxSetDraft(): TaxSet {
  return { id: '', title: '', currency: 'USD', taxes: [], associatedRatePlanIds: [], isDefault: false }
}

function openAddTaxSet() {
  editingTaxSetId.value = null
  taxSetDraft.value = emptyTaxSetDraft()
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

function toggleTaxInDraft(taxId: string) {
  const exists = taxSetDraft.value.taxes.some(t => t.id === taxId)
  taxSetDraft.value.taxes = exists
    ? taxSetDraft.value.taxes.filter(t => t.id !== taxId)
    : [...taxSetDraft.value.taxes, { id: taxId, level: 0 }]
  normalizeTaxLevels()
}

function normalizeTaxLevels() {
  const n = taxSetDraft.value.taxes.length
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
    const tax = feeTaxItems.value.find(i => i.id === t.id)
    return {
      id: t.id,
      level: t.level,
      title: tax?.title ?? t.id,
      summary: tax ? feeTaxSummary(tax) : '',
      type: tax?.type,
    }
  }),
)

// Edit a fee/tax inline from the tax set, then return to the tax set sheet.
const editingFromTaxSet = ref(false)

watch(showFeeTaxSheet, (open) => {
  if (!open && editingFromTaxSet.value) {
    editingFromTaxSet.value = false
    showTaxSetSheet.value = true
  }
})

function editTaxFromSet(taxId: string) {
  showTaxSetSheet.value = false
  const found = feeTaxItems.value.find(t => t.id === taxId)
  if (!found)
    return
  editingFeeTaxId.value = taxId
  feeTaxDraft.value = {
    ...found,
    applicableDateRanges: found.applicableDateRanges.map(r => ({ ...r })),
  }
  editingFromTaxSet.value = true
  showFeeTaxSheet.value = true
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`
}

// ── Price preview calculator ─────────────────────────────────────────────
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

  let running = baseTotal
  const lines: CalcLine[] = []

  for (const ref of [...taxSetDraft.value.taxes].sort((a, b) => b.level - a.level)) {
    const tax = feeTaxItems.value.find(t => t.id === ref.id)
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
  const set: TaxSet = {
    ...taxSetDraft.value,
    id: editingTaxSetId.value || `ts-${Date.now()}`,
    title: taxSetDraft.value.title.trim(),
    taxes: [...taxSetDraft.value.taxes].sort((a, b) => b.level - a.level),
  }
  upsertTaxSet(set)
  showTaxSetSheet.value = false
  toast.success(editingTaxSetId.value ? 'Tax set updated' : 'Tax set created')
}

function confirmRemoveTaxSet(id: string) {
  removeTaxSet(id)
  toast.success('Tax set removed')
}

// ── Assignment dialog ──────────────────────────────────────────────────
const assignDialogOpen = ref(false)
const assignTarget = ref<{ kind: 'feeTax' | 'taxSet', id: string } | null>(null)
const assignSearch = ref('')
const assignTagSearch = ref('')
const assignTagPopoverOpen = ref(false)
// Draft selection while the dialog is open; committed only on "Assign".
const assignDraftIds = ref<string[]>([])

const listingOptions = computed(() =>
  listings.value.map(l => ({ id: l.id, name: l.name, location: l.location, tags: l.tags })),
)

const assignTags = computed(() => Array.from(new Set(listings.value.flatMap(l => l.tags))).sort())

const currentAssignedIds = computed<string[]>(() => {
  const target = assignTarget.value
  if (!target)
    return []
  return target.kind === 'feeTax'
    ? listingIdsForFeeTax(target.id)
    : listingIdsForTaxSet(target.id)
})

const assignableListings = computed(() => {
  const query = assignSearch.value.trim().toLowerCase()
  const tag = assignTagSearch.value.trim().toLowerCase()
  return listingOptions.value.filter((listing) => {
    if (query && !`${listing.name} ${listing.location}`.toLowerCase().includes(query))
      return false
    if (tag && !listing.tags.some(t => t.toLowerCase().includes(tag)))
      return false
    return true
  })
})

const allVisibleAssigned = computed(() => {
  if (!assignableListings.value.length)
    return false
  return assignableListings.value.every(l => assignDraftIds.value.includes(l.id))
})

function openAssignDialog(kind: 'feeTax' | 'taxSet', id: string) {
  assignTarget.value = { kind, id }
  assignSearch.value = ''
  assignTagSearch.value = ''
  assignDraftIds.value = [...currentAssignedIds.value]
  assignDialogOpen.value = true
}

function toggleAssignListing(listingId: string) {
  assignDraftIds.value = assignDraftIds.value.includes(listingId)
    ? assignDraftIds.value.filter(id => id !== listingId)
    : [...assignDraftIds.value, listingId]
}

function toggleAssignAllVisible() {
  const visibleIds = assignableListings.value.map(l => l.id)
  if (allVisibleAssigned.value) {
    assignDraftIds.value = assignDraftIds.value.filter(id => !visibleIds.includes(id))
  }
  else {
    assignDraftIds.value = Array.from(new Set([...assignDraftIds.value, ...visibleIds]))
  }
}

function cancelAssign() {
  assignDialogOpen.value = false
  assignTarget.value = null
  assignDraftIds.value = []
}

function commitAssign() {
  const target = assignTarget.value
  if (!target)
    return

  const draftSet = new Set(assignDraftIds.value)
  const currentIds = target.kind === 'feeTax'
    ? listingIdsForFeeTax(target.id)
    : listingIdsForTaxSet(target.id)
  const affected = new Set([...currentIds, ...assignDraftIds.value])

  for (const listingId of affected) {
    const shouldAssign = draftSet.has(listingId)
    const alreadyAssigned = currentIds.includes(listingId)
    if (shouldAssign && !alreadyAssigned) {
      if (target.kind === 'feeTax')
        toggleListingFeeTax(listingId, target.id)
      else
        toggleListingTaxSet(listingId, target.id)
    }
    else if (!shouldAssign && alreadyAssigned) {
      if (target.kind === 'feeTax')
        unassignFeeTax(listingId, target.id)
      else
        unassignTaxSet(listingId, target.id)
    }
  }

  toast.success(`${assignDraftIds.value.length} listing${assignDraftIds.value.length !== 1 ? 's' : ''} assigned`)
  cancelAssign()
}

function assignTargetTitle(): string {
  const target = assignTarget.value
  if (!target)
    return ''
  if (target.kind === 'feeTax')
    return feeTaxItems.value.find(i => i.id === target.id)?.title ?? 'Item'
  return taxSets.value.find(s => s.id === target.id)?.title ?? 'Tax set'
}

// ── Add/remove date ranges on fee/tax form ─────────────────────────────
function addDateRange() {
  const today = new Date().toISOString().split('T')[0]!
  feeTaxDraft.value.applicableDateRanges.push({ after: today, before: today })
}

function updateDateRange(index: number, field: keyof TaxDateRange, value: string) {
  feeTaxDraft.value.applicableDateRanges = feeTaxDraft.value.applicableDateRanges.map((r, i) =>
    i === index ? { ...r, [field]: value } : r,
  )
}

function removeDateRange(index: number) {
  feeTaxDraft.value.applicableDateRanges = feeTaxDraft.value.applicableDateRanges.filter((_, i) => i !== index)
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-end justify-between gap-4">
      <div class="space-y-1">
        <h3 class="text-lg font-medium">Fees &amp; Taxes</h3>
        <p class="text-sm text-muted-foreground">Create fees and taxes once, then assign them to many listings at the same time.</p>
      </div>
    </div>

    <Tabs default-value="fees-taxes" class="space-y-4">
      <TabsList>
        <TabsTrigger value="fees-taxes">Fees &amp; Taxes</TabsTrigger>
        <TabsTrigger value="tax-sets">Tax Sets</TabsTrigger>
      </TabsList>

      <!-- Fees & Taxes library -->
      <TabsContent value="fees-taxes" class="space-y-4">
        <div class="flex justify-end">
          <Button class="gap-2" @click="openAddFeeTax">
            <Icon name="lucide:plus" class="size-4" />
            Add fee or tax
          </Button>
        </div>

        <div v-if="feeTaxItems.length === 0" class="border border-dashed bg-card/40 p-10 text-center">
          <p class="text-sm text-muted-foreground">No fees or taxes yet. Create one to start assigning it to listings.</p>
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="item in feeTaxItems"
            :key="item.id"
            class="flex items-center justify-between gap-3 rounded-lg border bg-card p-4"
          >
            <div class="flex items-center gap-3 min-w-0">
              <div class="flex size-10 shrink-0 items-center justify-center rounded-md border bg-muted/30">
                <Icon :name="item.type === 'fee' ? 'lucide:receipt' : 'lucide:landmark'" class="size-4 text-muted-foreground" />
              </div>
              <div class="flex flex-col min-w-0">
                <div class="flex items-center gap-2">
                  <span class="text-sm font-medium truncate">{{ item.title }}</span>
                  <Badge variant="secondary" class="text-[10px] px-1.5 shrink-0">
                    {{ item.type === 'fee' ? 'Fee' : item.type === 'city_tax' ? 'City Tax' : 'Tax' }}
                  </Badge>
                </div>
                <span class="text-xs text-muted-foreground">{{ feeTaxSummary(item) }}</span>
              </div>
            </div>

            <div class="flex items-center gap-1 shrink-0">
              <Button variant="outline" size="sm" class="h-8 gap-1.5" @click="openAssignDialog('feeTax', item.id)">
                <Icon name="lucide:building-2" class="size-3.5" />
                {{ listingIdsForFeeTax(item.id).length }} listing{{ listingIdsForFeeTax(item.id).length !== 1 ? 's' : '' }}
              </Button>
              <Button variant="ghost" size="sm" class="h-8 w-8 p-0" @click="openEditFeeTax(item.id)">
                <Icon name="lucide:pencil" class="size-3.5 text-muted-foreground" />
              </Button>
              <Button variant="ghost" size="sm" class="h-8 w-8 p-0 text-destructive" @click="confirmRemoveFeeTax(item.id)">
                <Icon name="lucide:trash-2" class="size-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </TabsContent>

      <!-- Tax Sets library -->
      <TabsContent value="tax-sets" class="space-y-4">
        <div class="flex justify-end">
          <Button class="gap-2" @click="openAddTaxSet">
            <Icon name="lucide:plus" class="size-4" />
            Add tax set
          </Button>
        </div>

        <div v-if="taxSets.length === 0" class="border border-dashed bg-card/40 p-10 text-center">
          <p class="text-sm text-muted-foreground">No tax sets yet. Group your fees and taxes into a set to reuse them.</p>
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="set in taxSets"
            :key="set.id"
            class="flex items-center justify-between gap-3 rounded-lg border bg-card p-4"
          >
            <div class="flex items-center gap-3 min-w-0">
              <div class="flex size-10 shrink-0 items-center justify-center rounded-md border bg-muted/30">
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
                  {{ set.taxes.length === 0 ? 'No taxes' : set.taxes.map(t => feeTaxItems.find(i => i.id === t.id)?.title ?? t.id).join(' + ') }}
                </span>
              </div>
            </div>

            <div class="flex items-center gap-1 shrink-0">
              <Button v-if="!set.isDefault" variant="ghost" size="sm" class="h-8 px-2 text-xs text-muted-foreground" @click="setDefaultTaxSet(set.id); toast.success('Default tax set updated')">
                Make default
              </Button>
              <Button variant="outline" size="sm" class="h-8 gap-1.5" @click="openAssignDialog('taxSet', set.id)">
                <Icon name="lucide:building-2" class="size-3.5" />
                {{ listingIdsForTaxSet(set.id).length }} listing{{ listingIdsForTaxSet(set.id).length !== 1 ? 's' : '' }}
              </Button>
              <Button variant="ghost" size="sm" class="h-8 w-8 p-0" @click="openEditTaxSet(set.id)">
                <Icon name="lucide:pencil" class="size-3.5 text-muted-foreground" />
              </Button>
              <Button variant="ghost" size="sm" class="h-8 w-8 p-0 text-destructive" @click="confirmRemoveTaxSet(set.id)">
                <Icon name="lucide:trash-2" class="size-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </TabsContent>
    </Tabs>

    <!-- Fee/Tax form sheet -->
    <Sheet v-model:open="showFeeTaxSheet">
      <SheetContent class="w-full sm:max-w-md p-0">
        <SheetHeader>
          <SheetTitle>{{ editingFeeTaxId ? 'Edit Fee or Tax' : 'Add Fee or Tax' }}</SheetTitle>
          <SheetDescription>Applied to direct bookings only. OTAs manage their own charges.</SheetDescription>
        </SheetHeader>

        <div class="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
          <div class="flex flex-col gap-1.5">
            <Label>Type</Label>
            <Select :model-value="feeTaxDraft.type" @update:model-value="(v) => feeTaxDraft.type = v as ListingFeeTaxItem['type']">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="tax">Tax</SelectItem>
                <SelectItem value="fee">Fee</SelectItem>
                <SelectItem value="city_tax">City Tax</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div class="flex flex-col gap-1.5">
            <Label>Title</Label>
            <Input v-model="feeTaxDraft.title" placeholder="e.g., VAT, Cleaning Fee, City Tax" />
          </div>

          <div class="flex flex-col gap-1.5">
            <Label>Logic</Label>
            <Select :model-value="feeTaxDraft.logic" @update:model-value="(v) => feeTaxDraft.logic = v as ListingFeeTaxItem['logic']">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem v-for="opt in logicOptions" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div class="flex flex-col gap-1.5">
              <Label>Rate</Label>
              <div class="relative">
                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{{ isPercent() ? '%' : symbolFor(feeTaxDraft.currency ?? 'USD') }}</span>
                <Input v-model.number="feeTaxDraft.rate" type="number" class="pl-7" min="0" />
              </div>
            </div>
            <div v-if="!isPercent()" class="flex flex-col gap-1.5">
              <Label>Currency</Label>
              <Select :model-value="feeTaxDraft.currency ?? 'USD'" @update:model-value="(v) => feeTaxDraft.currency = String(v)">
                <SelectTrigger><SelectValue /></SelectTrigger>
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
              <span class="text-sm font-medium">Include in room price</span>
              <span class="text-xs text-muted-foreground">When on, the tax is folded into the nightly rate.</span>
            </div>
            <Switch :model-value="feeTaxDraft.isInclusive" @update:model-value="(v) => feeTaxDraft.isInclusive = Boolean(v)" />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div class="flex flex-col gap-1.5">
              <Label>Skip Nights</Label>
              <Input :model-value="feeTaxDraft.skipNights ?? ''" type="number" min="0" placeholder="0" @update:model-value="(v) => feeTaxDraft.skipNights = v === '' ? null : Number(v)" />
            </div>
            <div class="flex flex-col gap-1.5">
              <Label>Max Nights</Label>
              <Input :model-value="feeTaxDraft.maxNights ?? ''" type="number" min="0" placeholder="None" @update:model-value="(v) => feeTaxDraft.maxNights = v === '' ? null : Number(v)" />
            </div>
          </div>

          <div class="flex flex-col gap-2">
            <div class="flex items-center justify-between">
              <Label>Applicable Date Ranges</Label>
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
                <Input type="date" :model-value="range.after" class="h-8 text-xs" @update:model-value="(v) => updateDateRange(idx, 'after', String(v))" />
                <span class="text-xs text-muted-foreground">to</span>
                <Input type="date" :model-value="range.before" class="h-8 text-xs" @update:model-value="(v) => updateDateRange(idx, 'before', String(v))" />
                <Button variant="ghost" size="sm" class="h-8 w-8 p-0 shrink-0" @click="removeDateRange(idx)">
                  <Icon name="lucide:x" class="size-3.5 text-muted-foreground" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        <SheetFooter class="border-t">
          <Button variant="outline" size="sm" @click="showFeeTaxSheet = false">Cancel</Button>
          <Button size="sm" :disabled="!feeTaxDraft.title.trim()" @click="saveFeeTax">
            <Icon name="lucide:check" class="size-3.5 mr-1.5" />
            {{ editingFeeTaxId ? 'Save' : 'Add' }}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>

    <!-- Tax set form sheet -->
    <Sheet v-model:open="showTaxSetSheet">
      <SheetContent class="w-full sm:max-w-md p-0">
        <SheetHeader>
          <SheetTitle>{{ editingTaxSetId ? 'Edit Tax Set' : 'Add Tax Set' }}</SheetTitle>
          <SheetDescription>Group taxes together and set the order they are calculated.</SheetDescription>
        </SheetHeader>

        <div class="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
          <div class="flex flex-col gap-1.5">
            <Label>Title</Label>
            <Input v-model="taxSetDraft.title" placeholder="e.g., Standard Tax Set" />
          </div>

          <div class="flex flex-col gap-1.5">
            <Label>Currency</Label>
            <Select :model-value="taxSetDraft.currency ?? 'USD'" @update:model-value="(v) => taxSetDraft.currency = String(v)">
              <SelectTrigger><SelectValue /></SelectTrigger>
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

            <p v-if="feeTaxItems.length === 0" class="text-xs text-muted-foreground italic">
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
                v-for="tax in feeTaxItems.filter(t => !taxSetDraft.taxes.some(s => s.id === t.id))"
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

          <!-- Price preview calculator -->
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
          <Button variant="outline" size="sm" @click="showTaxSetSheet = false">Cancel</Button>
          <Button size="sm" :disabled="!taxSetDraft.title.trim()" @click="saveTaxSet">
            <Icon name="lucide:check" class="size-3.5 mr-1.5" />
            {{ editingTaxSetId ? 'Save' : 'Add' }}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>

    <!-- Assignment dialog -->
    <Dialog v-model:open="assignDialogOpen">
      <DialogContent class="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Assign listings</DialogTitle>
          <DialogDescription>Choose which listings should use {{ assignTargetTitle() }}.</DialogDescription>
        </DialogHeader>

        <div class="space-y-3">
          <div class="flex flex-wrap items-center gap-2">
            <div class="relative min-w-[260px] flex-1">
              <Icon name="lucide:search" class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input v-model="assignSearch" placeholder="Search listing or location" class="h-10 pl-9" />
            </div>
            <Popover v-model:open="assignTagPopoverOpen">
              <PopoverTrigger as-child>
                <Button variant="outline" class="gap-2">
                  <Icon name="lucide:tags" class="size-4" />
                  Tags
                  <Badge variant="secondary" class="ml-1">{{ assignTagSearch ? 1 : 0 }}</Badge>
                </Button>
              </PopoverTrigger>
              <PopoverContent class="w-72 p-0" align="start" :side-offset="4">
                <div class="space-y-2 p-2">
                  <Input v-model="assignTagSearch" placeholder="Search tags..." class="h-8 text-xs" />
                  <div class="max-h-56 space-y-1 overflow-auto">
                    <button
                      v-for="tag in assignTags.filter(t => t.toLowerCase().includes(assignTagSearch.trim().toLowerCase()))"
                      :key="tag"
                      type="button"
                      class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                      @click="assignTagSearch = assignTagSearch === tag ? '' : tag"
                    >
                      <Checkbox :model-value="assignTagSearch === tag" class="size-3.5" />
                      <span>{{ tag }}</span>
                    </button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div class="max-h-[360px] space-y-2 overflow-auto pr-1">
            <div
              v-for="listing in assignableListings"
              :key="listing.id"
              class="flex cursor-pointer items-start gap-3 rounded-lg border bg-background p-3 text-sm"
              @click="toggleAssignListing(listing.id)"
            >
              <div
                class="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-[4px] border"
                :class="assignDraftIds.includes(listing.id) ? 'border-primary bg-primary text-primary-foreground' : 'border-input'"
              >
                <Icon v-if="assignDraftIds.includes(listing.id)" name="lucide:check" class="size-3" />
              </div>
              <div class="min-w-0 flex-1">
                <p class="truncate font-medium">{{ listing.name }}</p>
                <p class="text-xs text-muted-foreground">{{ listing.location }}</p>
                <div class="mt-2 flex flex-wrap gap-1.5">
                  <Badge v-for="tag in listing.tags" :key="tag" variant="outline" class="text-[10px]">
                    {{ tag }}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          <div class="flex items-center justify-between rounded-lg border bg-muted/20 px-4 py-3 text-sm">
            <p class="text-muted-foreground">{{ assignDraftIds.length }} listing{{ assignDraftIds.length !== 1 ? 's' : '' }} selected</p>
            <Button
              v-if="assignableListings.length"
              variant="outline"
              size="sm"
              class="h-7 text-xs"
              @click="toggleAssignAllVisible"
            >
              {{ allVisibleAssigned ? 'Unassign all' : 'Assign all' }}
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="cancelAssign">Cancel</Button>
          <Button @click="commitAssign">
            <Icon name="lucide:check" class="size-3.5 mr-1.5" />
            Assign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
