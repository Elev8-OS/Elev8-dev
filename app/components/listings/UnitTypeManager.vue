<script setup lang="ts">
import type { LengthOfStayDiscount, Listing, RatePlan, RatePlanOffering, RateRateMode, RateSellMode, UnitType } from '~/components/listings/data/listings'
import { toast } from 'vue-sonner'
import { buildOccupancyOptions, createRatePlan, ratePlanNightlyRate } from '~/components/listings/data/listings'
import RatePlanDerivedOptionsEditor from '~/components/listings/RatePlanDerivedOptionsEditor.vue'

const props = defineProps<{ listing: Listing }>()
const emit = defineEmits<{ update: [listing: Listing] }>()

const showAddDialog = ref(false)
const newTypeName = ref('')
const editingId = ref<string | null>(null)
const expandedId = ref<string | null>(null)
const activeTab = ref<'details' | 'pricing'>('details')

const unitTypes = computed(() => props.listing.unitTypes ?? [])

const bedTypes = ['Single Bed', 'Double Bed', 'Queen Bed', 'King Bed', 'Bunk Bed', 'Sofa Bed', 'Futon']
const currencies = [
  { code: 'USD', symbol: '$', label: 'USD' },
  { code: 'IDR', symbol: 'Rp', label: 'IDR' },
  { code: 'EUR', symbol: '€', label: 'EUR' },
  { code: 'GBP', symbol: '£', label: 'GBP' },
  { code: 'AUD', symbol: 'A$', label: 'AUD' },
  { code: 'SGD', symbol: 'S$', label: 'SGD' },
]

// Form state for editing
const form = ref<Partial<UnitType>>({
  name: '',
  identifier: '',
  description: '',
  quantity: 1,
  maxAdults: 2,
  maxChildren: 0,
  maxInfants: 0,
  bedrooms: 1,
  bathrooms: 1,
  beds: [],
  photos: [],
  pricing: {
    currency: 'USD',
    ratePlans: [],
    offerings: [],
    lengthOfStayDiscounts: [],
    fees: [],
  },
  units: [],
})

const showAdvancedPricing = ref(false)

const currencySymbol = computed(() => {
  const code = form.value.pricing?.currency ?? 'USD'
  return currencies.find(c => c.code === code)?.symbol ?? '$'
})

// Max guests the room type can host (adults + children + infants)
const maxOccupancy = computed(() =>
  Math.max(1, (form.value.maxAdults ?? 0) + (form.value.maxChildren ?? 0) + (form.value.maxInfants ?? 0)),
)

// All rate plans available for selection as parent (from all unit types in the listing)
const allAvailableRatePlans = computed(() => {
  const plans: Array<{ id: string, name: string, unitTypeName: string }> = []
  for (const ut of props.listing.unitTypes ?? []) {
    for (const rp of ut.pricing.ratePlans) {
      plans.push({ id: rp.id, name: rp.name, unitTypeName: ut.name })
    }
  }
  return plans
})

// Guest pricing rules: initial (included) guests + extra charge per additional
// guest per night, capped at the room type's max occupancy. The occupancy
// `options` are auto-generated from these settings.
function syncRatePlanOptions(rp: RatePlan): RatePlan {
  const included = Math.min(Math.max(1, Math.round(rp.includedGuests ?? rp.options.find(o => o.isPrimary)?.occupancy ?? 1)), maxOccupancy.value)
  const extra = Math.max(0, rp.extraGuestRate ?? 0)
  const base = ratePlanNightlyRate(rp)
  return {
    ...rp,
    includedGuests: included,
    extraGuestRate: extra,
    options: buildOccupancyOptions(included, extra, base, maxOccupancy.value, rp.sellMode),
  }
}

// Keep every rate plan in sync when the room type's guest settings change.
watch(maxOccupancy, () => {
  if (!form.value.pricing)
    return
  form.value.pricing = {
    ...form.value.pricing,
    ratePlans: form.value.pricing.ratePlans.map(rp => syncRatePlanOptions(rp)),
  }
})

function guestPricingHint(rp: RatePlan): string {
  const incl = rp.includedGuests ?? rp.options.find(o => o.isPrimary)?.occupancy ?? 1
  const extra = rp.extraGuestRate ?? 0
  const base = ratePlanNightlyRate(rp)
  const sym = currencySymbol.value
  const max = maxOccupancy.value
  if (extra <= 0 || incl >= max)
    return `${sym}${base} / night · up to ${max} guest${max !== 1 ? 's' : ''}`
  return `${sym}${base} includes ${incl} guest${incl !== 1 ? 's' : ''} · +${sym}${extra} per extra guest · ${max} guests = ${sym}${base + (max - incl) * extra}`
}

function onQuantityChange(newQuantity: number) {
  if (!form.value)
    return
  form.value.quantity = newQuantity
  const currentUnits = form.value.units ?? []
  const prefix = form.value.identifier || form.value.name?.toLowerCase().replace(/\s+/g, '') || 'unit'

  if (newQuantity > currentUnits.length) {
    // Add new units
    for (let i = currentUnits.length; i < newQuantity; i++) {
      currentUnits.push({
        id: `un-${Date.now()}-${i}`,
        name: `Unit ${i + 1}`,
        identifier: `${prefix}${i + 1}`,
      })
    }
  }
  else if (newQuantity < currentUnits.length) {
    // Remove excess units
    currentUnits.splice(newQuantity)
  }
  form.value.units = currentUnits
}

function startEdit(ut: UnitType) {
  editingId.value = ut.id
  expandedId.value = ut.id
  activeTab.value = 'details'
  form.value = {
    ...ut,
    beds: [...ut.beds],
    photos: [...ut.photos],
    pricing: {
      ...ut.pricing,
      ratePlans: [...ut.pricing.ratePlans],
      offerings: [...ut.pricing.offerings],
      lengthOfStayDiscounts: [...ut.pricing.lengthOfStayDiscounts],
      fees: [...ut.pricing.fees],
    },
    units: [...ut.units],
  }
}

function cancelEdit() {
  editingId.value = null
}

function saveEdit() {
  if (!editingId.value)
    return
  emit('update', {
    ...props.listing,
    unitTypes: unitTypes.value.map(ut =>
      ut.id === editingId.value
        ? {
            ...ut,
            ...form.value,
            beds: [...(form.value.beds ?? [])],
            photos: [...(form.value.photos ?? [])],
            pricing: {
              ...form.value.pricing!,
              ratePlans: [...(form.value.pricing?.ratePlans ?? [])],
              offerings: [...(form.value.pricing?.offerings ?? [])],
              lengthOfStayDiscounts: [...(form.value.pricing?.lengthOfStayDiscounts ?? [])],
              fees: [...(form.value.pricing?.fees ?? [])],
            },
            units: [...(form.value.units ?? [])],
          }
        : ut,
    ),
  })
  editingId.value = null
  toast.success('Room type updated')
}

function addUnitType() {
  const name = newTypeName.value.trim()
  if (!name)
    return
  const newType: UnitType = {
    id: `ut-${Date.now()}`,
    name,
    identifier: '',
    description: '',
    quantity: 1,
    maxAdults: 2,
    maxChildren: 0,
    maxInfants: 0,
    bedrooms: 1,
    bathrooms: 1,
    beds: [{ id: `bed-${Date.now()}`, type: 'Double Bed', count: 1 }],
    photos: [],
    pricing: {
      currency: 'USD',
      ratePlans: [
        { ...createRatePlan({}), id: `rp-${Date.now()}`, name: 'Best Available Rate', title: 'Best Available Rate', isBase: true },
      ],
      offerings: [],
      lengthOfStayDiscounts: [],
      fees: [],
    },
    units: [],
  }
  emit('update', {
    ...props.listing,
    unitTypes: [...unitTypes.value, newType],
  })
  newTypeName.value = ''
  showAddDialog.value = false
  startEdit(newType)
  toast.success(`Room type "${name}" created`)
}

function deleteUnitType(id: string) {
  const ut = unitTypes.value.find(u => u.id === id)
  if (!ut)
    return
  emit('update', {
    ...props.listing,
    unitTypes: unitTypes.value.filter(u => u.id !== id),
  })
  if (editingId.value === id)
    editingId.value = null
  toast.success(`Room type "${ut.name}" deleted`)
}

function addUnitToType(typeId: string) {
  const ut = unitTypes.value.find(u => u.id === typeId)
  if (!ut)
    return
  const newUnit = {
    id: `un-${Date.now()}`,
    name: `Unit ${ut.units.length + 1}`,
    identifier: `${ut.identifier || ''}${ut.units.length + 1}`,
  }
  emit('update', {
    ...props.listing,
    unitTypes: unitTypes.value.map(u =>
      u.id === typeId ? { ...u, units: [...u.units, newUnit] } : u,
    ),
  })
  toast.success(`Unit added to "${ut.name}"`)
}

function removeUnitFromType(typeId: string, unitId: string) {
  emit('update', {
    ...props.listing,
    unitTypes: unitTypes.value.map(ut =>
      ut.id === typeId ? { ...ut, units: ut.units.filter(u => u.id !== unitId) } : ut,
    ),
  })
  toast.success('Unit removed')
}

function updateUnitField(typeId: string, unitId: string, field: string, value: any) {
  emit('update', {
    ...props.listing,
    unitTypes: unitTypes.value.map(ut =>
      ut.id === typeId
        ? { ...ut, units: ut.units.map(u => u.id === unitId ? { ...u, [field]: value } : u) }
        : ut,
    ),
  })
}

// Bed management
function addBed() {
  form.value.beds?.push({ id: `bed-${Date.now()}`, type: 'Double Bed', count: 1 })
}

function removeBed(index: number) {
  form.value.beds?.splice(index, 1)
}

function toggleExpand(id: string) {
  expandedId.value = expandedId.value === id ? null : id
}

// Photo management
function handlePhotoUpload(files: FileList | null) {
  if (!files)
    return
  const remaining = 10 - (form.value.photos?.length ?? 0)
  const toProcess = Array.from(files).slice(0, remaining)
  for (const file of toProcess) {
    if (file.size > 10 * 1024 * 1024) {
      toast.error(`${file.name} exceeds 10MB limit`)
      continue
    }
    const url = URL.createObjectURL(file)
    form.value.photos = [...(form.value.photos ?? []), url]
  }
}

function removePhoto(index: number) {
  form.value.photos = form.value.photos?.filter((_, i) => i !== index) ?? []
}

// Pricing - Rate Plans
const showAddRatePlanSheet = ref(false)
const addRatePlanDraft = ref<RatePlan>(createRatePlan({}))

// Keep the add-draft's occupancy options consistent with its guest-pricing settings.
function syncAddDraftOptions() {
  const synced = syncRatePlanOptions(addRatePlanDraft.value)
  addRatePlanDraft.value.includedGuests = synced.includedGuests
  addRatePlanDraft.value.extraGuestRate = synced.extraGuestRate
  addRatePlanDraft.value.options = synced.options
}

watch(() => addRatePlanDraft.value.sellMode, () => syncAddDraftOptions())

function setAddDraftIncludedGuests(value: unknown) {
  addRatePlanDraft.value.includedGuests = Math.max(1, Math.round(Number(value)) || 1)
  syncAddDraftOptions()
}

function setAddDraftExtraGuestRate(value: unknown) {
  addRatePlanDraft.value.extraGuestRate = Math.max(0, Number(value) || 0)
  syncAddDraftOptions()
}

function setAddDraftBaseRate(value: unknown) {
  const d = addRatePlanDraft.value
  d.options = d.options.map(o => o.isPrimary ? { ...o, rate: Math.max(0, Number(value) || 0) } : o)
  syncAddDraftOptions()
}

function openAddRatePlanSheet() {
  if (!form.value.pricing)
    return
  const base = form.value.pricing.ratePlans.find(rp => rp.isBase) ?? form.value.pricing.ratePlans[0]
  addRatePlanDraft.value = {
    ...createRatePlan({}),
    name: `Rate Plan ${(form.value.pricing.ratePlans.length ?? 0) + 1}`,
    title: `Rate Plan ${(form.value.pricing.ratePlans.length ?? 0) + 1}`,
    currency: form.value.pricing.currency ?? 'USD',
    options: [{ occupancy: maxOccupancy.value, isPrimary: true, derivedOption: null, rate: base ? ratePlanNightlyRate(base) : 0 }],
    includedGuests: Math.min(Math.max(1, base?.includedGuests ?? base?.options.find(o => o.isPrimary)?.occupancy ?? 2), maxOccupancy.value),
    extraGuestRate: Math.max(0, base?.extraGuestRate ?? 0),
    isBase: false,
  }
  showAddRatePlanSheet.value = true
}

function saveNewRatePlan() {
  if (!form.value.pricing || !addRatePlanDraft.value.title.trim())
    return
  const newPlan: RatePlan = {
    ...addRatePlanDraft.value,
    id: `rp-${Date.now()}`,
    name: addRatePlanDraft.value.title.trim(),
    title: addRatePlanDraft.value.title.trim(),
  }
  form.value.pricing = {
    ...form.value.pricing,
    ratePlans: [...form.value.pricing.ratePlans, newPlan],
  }
  showAddRatePlanSheet.value = false
}

function closeAddRatePlanSheet() {
  showAddRatePlanSheet.value = false
}

function removeRatePlan(index: number) {
  if (!form.value.pricing)
    return
  const plan = form.value.pricing.ratePlans[index]
  if (!plan || plan.isBase)
    return
  form.value.pricing = {
    ...form.value.pricing,
    ratePlans: form.value.pricing.ratePlans.filter((_, i) => i !== index),
  }
}

function updateRatePlan(index: number, field: string, value: any) {
  if (!form.value.pricing)
    return
  const plans = form.value.pricing.ratePlans.map((rp, i) =>
    i === index ? { ...rp, [field]: value } : rp,
  )
  form.value.pricing = { ...form.value.pricing, ratePlans: plans }
}

// Switching sell mode re-shapes the occupancy options: per_room collapses to a
// single option at the room type's max occupancy; per_person gets one option
// per guest count from included guests up to the max.
function updateRatePlanSellMode(index: number, sellMode: string) {
  if (!form.value.pricing)
    return
  const mode = sellMode as RateSellMode
  form.value.pricing = {
    ...form.value.pricing,
    ratePlans: form.value.pricing.ratePlans.map((rp, i) => i === index ? syncRatePlanOptions({ ...rp, sellMode: mode }) : rp),
  }
}

// Update includedGuests / extraGuestRate / base rate, then regenerate options.
function updateRatePlanGuestPricing(index: number, field: 'includedGuests' | 'extraGuestRate' | 'baseRate', value: unknown) {
  if (!form.value.pricing)
    return
  form.value.pricing = {
    ...form.value.pricing,
    ratePlans: form.value.pricing.ratePlans.map((rp, i) => {
      if (i !== index)
        return rp
      if (field === 'includedGuests')
        return syncRatePlanOptions({ ...rp, includedGuests: Math.max(1, Math.round(Number(value)) || 1) })
      if (field === 'extraGuestRate')
        return syncRatePlanOptions({ ...rp, extraGuestRate: Math.max(0, Number(value) || 0) })
      const options = rp.options.map(o => o.isPrimary ? { ...o, rate: Math.max(0, Number(value) || 0) } : o)
      return syncRatePlanOptions({ ...rp, options })
    }),
  }
}

function addOffering() {
  if (!form.value.pricing)
    return
  const newOffering: RatePlanOffering = {
    id: `off-${Date.now()}`,
    name: '',
    adjustmentType: 'fixed',
    adjustmentValue: 0,
  }
  form.value.pricing = {
    ...form.value.pricing,
    offerings: [...form.value.pricing.offerings, newOffering],
  }
}

function removeOffering(index: number) {
  if (!form.value.pricing)
    return
  form.value.pricing = {
    ...form.value.pricing,
    offerings: form.value.pricing.offerings.filter((_, i) => i !== index),
  }
}

function updateOffering(index: number, field: string, value: any) {
  if (!form.value.pricing)
    return
  const offerings = form.value.pricing.offerings.map((o, i) =>
    i === index ? { ...o, [field]: value } : o,
  )
  form.value.pricing = { ...form.value.pricing, offerings }
}

// Pricing - Length of Stay Discounts
function addLosDiscount() {
  if (!form.value.pricing)
    return
  const newDiscount: LengthOfStayDiscount = {
    id: `los-${Date.now()}`,
    minNights: 7,
    discountType: 'percent',
    value: 10,
  }
  form.value.pricing = {
    ...form.value.pricing,
    lengthOfStayDiscounts: [...form.value.pricing.lengthOfStayDiscounts, newDiscount],
  }
}

function removeLosDiscount(index: number) {
  if (!form.value.pricing)
    return
  form.value.pricing = {
    ...form.value.pricing,
    lengthOfStayDiscounts: form.value.pricing.lengthOfStayDiscounts.filter((_, i) => i !== index),
  }
}

function updateLosDiscount(index: number, field: string, value: any) {
  if (!form.value.pricing)
    return
  const discounts = form.value.pricing.lengthOfStayDiscounts.map((d, i) =>
    i === index ? { ...d, [field]: value } : d,
  )
  form.value.pricing = { ...form.value.pricing, lengthOfStayDiscounts: discounts }
}

// Pricing - Fees
function toggleFee(index: number) {
  if (!form.value.pricing)
    return
  const fees = form.value.pricing.fees.map((f, i) =>
    i === index ? { ...f, enabled: !f.enabled } : f,
  )
  form.value.pricing = { ...form.value.pricing, fees }
}

function updateFeeAmount(index: number, amount: number) {
  if (!form.value.pricing)
    return
  const fees = form.value.pricing.fees.map((f, i) =>
    i === index ? { ...f, amount } : f,
  )
  form.value.pricing = { ...form.value.pricing, fees }
}

const feeIcons: Record<string, string> = {
  cleaning: 'lucide:spray-can',
  early_checkin: 'lucide:clock-arrow-up',
  late_checkout: 'lucide:clock-arrow-down',
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center justify-between">
      <div>
        <h3 class="text-sm font-medium">
          Room Types
        </h3>
        <p class="text-xs text-muted-foreground">
          Configure room types with shared settings for all units within each type
        </p>
      </div>
      <Button variant="outline" size="sm" class="gap-1.5" @click="showAddDialog = true">
        <Icon name="lucide:plus" class="size-3.5" />
        Add Room Type
      </Button>
    </div>

    <!-- Empty state -->
    <div v-if="unitTypes.length === 0" class="flex flex-col items-center gap-2 py-8 text-center">
      <Icon name="lucide:layers" class="size-8 text-muted-foreground/50" />
      <p class="text-sm text-muted-foreground">
        No room types yet
      </p>
      <p class="text-xs text-muted-foreground">
        Add a room type to organize your units
      </p>
    </div>

    <!-- Unit type list -->
    <div v-else class="flex flex-col gap-3">
      <div
        v-for="ut in unitTypes"
        :key="ut.id"
        class="border rounded-lg overflow-hidden"
      >
        <!-- Unit type header -->
        <div
          class="flex items-center justify-between gap-2 p-3 cursor-pointer hover:bg-accent/50 transition-colors"
          @click="toggleExpand(ut.id)"
        >
          <div class="flex items-center gap-2 flex-1 min-w-0">
            <Icon name="lucide:layers" class="size-4 text-muted-foreground shrink-0" />
            <span class="text-sm font-medium truncate">{{ ut.name }}</span>
            <Badge variant="secondary" class="text-[10px] px-1.5 shrink-0">
              {{ ut.units.length }} unit{{ ut.units.length !== 1 ? 's' : '' }}
            </Badge>
          </div>

          <div class="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="sm" class="h-7 w-7 p-0" @click.stop="startEdit(ut)">
              <Icon name="lucide:pencil" class="size-3.5" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger as-child @click.stop>
                <Button variant="ghost" size="sm" class="h-7 w-7 p-0">
                  <Icon name="lucide:more-vertical" class="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" class="w-40">
                <DropdownMenuItem class="gap-2" @click="startEdit(ut)">
                  <Icon name="lucide:pencil" class="size-3.5" />
                  Edit Details
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem class="gap-2 text-destructive" @click="deleteUnitType(ut.id)">
                  <Icon name="lucide:trash-2" class="size-3.5" />
                  Delete Type
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Icon
              name="lucide:chevron-down"
              class="size-4 text-muted-foreground transition-transform"
              :class="expandedId === ut.id ? 'rotate-180' : ''"
            />
          </div>
        </div>

        <!-- Expanded content -->
        <div v-if="expandedId === ut.id" class="border-t">
          <!-- Edit mode with tabs -->
          <div v-if="editingId === ut.id">
            <div class="flex border-b px-4 pt-2">
              <button
                class="px-3 py-2 text-sm font-medium transition-colors"
                :class="activeTab === 'details' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'"
                @click="activeTab = 'details'"
              >
                Details
              </button>
              <button
                class="px-3 py-2 text-sm font-medium transition-colors"
                :class="activeTab === 'pricing' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'"
                @click="activeTab = 'pricing'"
              >
                Pricing
              </button>
            </div>

            <!-- Details Tab -->
            <div v-if="activeTab === 'details'" class="p-4 flex flex-col gap-5">
              <div class="flex flex-col gap-4">
                <h4 class="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Details
                </h4>

                <div class="grid grid-cols-2 gap-4">
                  <div class="flex flex-col gap-1.5">
                    <Label>Unit Name *</Label>
                    <Input v-model="form.name" placeholder="e.g., Kingbed" />
                  </div>
                  <div class="flex flex-col gap-1.5">
                    <Label>Unit Number / Identifier</Label>
                    <Input v-model="form.identifier" placeholder="e.g., king" />
                  </div>
                </div>

                <div class="grid grid-cols-2 gap-4">
                  <div class="flex flex-col gap-1.5">
                    <Label>Quantity</Label>
                    <Input type="number" :model-value="form.quantity ?? 1" min="1" @update:model-value="onQuantityChange(Number($event) || 1)" />
                    <p class="text-[10px] text-muted-foreground">
                      Number of rooms of this type
                    </p>
                  </div>
                  <div class="flex flex-col gap-1.5">
                    <Label>Description</Label>
                    <Textarea v-model="form.description" rows="3" placeholder="Describe this unit type..." />
                  </div>
                </div>
              </div>

              <!-- Guest Capacity -->
              <div class="flex flex-col gap-4">
                <h4 class="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Guest Capacity
                </h4>
                <p class="text-xs text-muted-foreground">
                  Settings apply to all units within this type
                </p>

                <div class="grid grid-cols-3 gap-4">
                  <div class="flex flex-col gap-1.5">
                    <Label>Max Adults</Label>
                    <Input v-model.number="form.maxAdults" type="number" min="1" />
                  </div>
                  <div class="flex flex-col gap-1.5">
                    <Label>Max Children</Label>
                    <Input v-model.number="form.maxChildren" type="number" min="0" />
                  </div>
                  <div class="flex flex-col gap-1.5">
                    <Label>Max Infants</Label>
                    <Input v-model.number="form.maxInfants" type="number" min="0" />
                  </div>
                </div>
              </div>

              <!-- Bedroom & Bathroom Details -->
              <div class="flex flex-col gap-4">
                <h4 class="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Bedroom & Bathroom Details
                </h4>

                <div class="grid grid-cols-2 gap-4">
                  <div class="flex flex-col gap-1.5">
                    <Label>Bedrooms</Label>
                    <Input v-model.number="form.bedrooms" type="number" min="1" />
                  </div>
                  <div class="flex flex-col gap-1.5">
                    <Label>Bathrooms</Label>
                    <Input v-model.number="form.bathrooms" type="number" min="1" />
                  </div>
                </div>

                <!-- Beds -->
                <div class="flex flex-col gap-2">
                  <Label>Beds</Label>
                  <div v-for="(bed, idx) in form.beds" :key="bed.id" class="flex items-center gap-2">
                    <Select v-model="bed.type">
                      <SelectTrigger class="flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem v-for="bt in bedTypes" :key="bt" :value="bt">
                          {{ bt }}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <span class="text-xs text-muted-foreground">x</span>
                    <Input v-model.number="bed.count" type="number" min="1" class="w-16" />
                    <Button variant="ghost" size="sm" class="h-8 w-8 p-0 shrink-0" @click="removeBed(idx)">
                      <Icon name="lucide:x" class="size-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                  <Button variant="outline" size="sm" class="w-fit gap-1.5" @click="addBed">
                    <Icon name="lucide:plus" class="size-3.5" />
                    Add Bed
                  </Button>
                </div>
              </div>

              <!-- Property Images -->
              <div class="flex flex-col gap-2">
                <Label>Property Images</Label>
                <div
                  class="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  @click="($refs.photoInput as HTMLInputElement)?.click()"
                >
                  <Icon name="lucide:image-plus" class="size-6 text-muted-foreground mx-auto mb-2" />
                  <p class="text-sm text-muted-foreground">
                    Drag and drop your images
                  </p>
                  <p class="text-xs text-muted-foreground">
                    or <span class="text-primary underline">browse files</span>
                  </p>
                  <p class="text-[10px] text-muted-foreground mt-2">
                    Max 10MB per file - JPEG, PNG, WebP
                  </p>
                </div>
                <input
                  ref="photoInput"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  class="hidden"
                  @change="handlePhotoUpload(($event.target as HTMLInputElement).files)"
                >

                <div v-if="form.photos?.length" class="flex flex-wrap gap-2 mt-2">
                  <div
                    v-for="(photo, idx) in form.photos"
                    :key="idx"
                    class="relative group size-16 rounded-md overflow-hidden border"
                  >
                    <img :src="photo" class="size-full object-cover">
                    <button
                      class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                      @click="removePhoto(idx)"
                    >
                      <Icon name="lucide:trash-2" class="size-4 text-white" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Pricing Tab -->
            <div v-else-if="activeTab === 'pricing'" class="p-4 flex flex-col gap-6">
              <!-- Mode indicator -->
              <div class="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                <Icon name="lucide:info" class="size-4 text-muted-foreground" />
                <span class="text-xs text-muted-foreground">Per Listing Mode</span>
              </div>

              <!-- Currency -->
              <div class="flex flex-col gap-1.5">
                <Label>Currency</Label>
                <Select :model-value="form.pricing?.currency ?? 'USD'" @update:model-value="(v) => { if (form.pricing) form.pricing.currency = String(v) }">
                  <SelectTrigger class="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem v-for="c in currencies" :key="c.code" :value="c.code">
                      {{ c.symbol }} {{ c.label }}
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p class="text-[10px] text-muted-foreground">
                  Using your account currency
                </p>
              </div>

              <!-- Rate Plans -->
              <div class="flex flex-col gap-4">
                <div class="flex items-center justify-between">
                  <div>
                    <h4 class="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Rate Plans
                    </h4>
                    <p class="text-[10px] text-muted-foreground mt-0.5">
                      Create multiple rate plans for this room type (e.g., Standard, Weekly, Monthly). The base rate plan cannot be deleted.
                    </p>
                  </div>
                  <Button variant="outline" size="sm" class="gap-1.5" @click="openAddRatePlanSheet">
                    <Icon name="lucide:plus" class="size-3.5" />
                    Add Rate Plan
                  </Button>
                </div>

                <div v-if="(form.pricing?.ratePlans?.length ?? 0) === 0" class="text-xs text-muted-foreground italic py-2">
                  No rate plans yet. Add one to set nightly pricing.
                </div>

                <div v-else class="flex flex-col gap-3">
                  <div
                    v-for="(rp, idx) in form.pricing?.ratePlans"
                    :key="rp.id"
                    class="border rounded-lg p-4 space-y-4"
                    :class="rp.isBase ? 'bg-muted/30' : ''"
                  >
                    <div class="flex items-center justify-between gap-2">
                      <div class="flex items-center gap-2 flex-1 min-w-0">
                        <Input
                          :model-value="rp.title"
                          placeholder="Rate plan name"
                          class="max-w-[240px]"
                          @update:model-value="(v) => { const t = String(v); updateRatePlan(idx, 'title', t); updateRatePlan(idx, 'name', t) }"
                        />
                        <Badge v-if="rp.isBase" variant="secondary" class="text-[10px] shrink-0">
                          Base
                        </Badge>
                      </div>
                      <Button
                        v-if="!rp.isBase"
                        variant="ghost"
                        size="sm"
                        class="h-7 w-7 p-0 shrink-0"
                        @click="removeRatePlan(idx)"
                      >
                        <Icon name="lucide:trash-2" class="size-3.5 text-muted-foreground" />
                      </Button>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                      <div class="flex flex-col gap-2">
                        <Label>Sell Mode</Label>
                        <Tabs :model-value="rp.sellMode" @update:model-value="(v) => updateRatePlanSellMode(idx, String(v))" class="w-full">
                          <TabsList class="grid w-full grid-cols-2 h-8">
                            <TabsTrigger value="per_room" class="text-xs">Room</TabsTrigger>
                            <TabsTrigger value="per_person" class="text-xs">Person</TabsTrigger>
                          </TabsList>
                        </Tabs>
                      </div>
                      <div class="flex flex-col gap-2">
                        <Label>Rate Mode</Label>
                        <div class="opacity-50 pointer-events-none">
                          <Tabs :model-value="rp.rateMode" class="w-full">
                            <TabsList class="grid w-full grid-cols-2 h-8">
                              <TabsTrigger value="manual" class="text-xs" disabled>Manual</TabsTrigger>
                              <TabsTrigger value="derived" class="text-xs" disabled>Derived Options</TabsTrigger>
                              <TabsTrigger value="auto" class="text-xs" disabled>Auto</TabsTrigger>
                              <TabsTrigger value="cascade" class="text-xs" disabled>Cascade</TabsTrigger>
                            </TabsList>
                          </Tabs>
                        </div>
                        <p class="text-[10px] text-muted-foreground">(cannot be changed)</p>
                      </div>
                    </div>

                    <!-- Derived Options (only for derived rate mode) -->
                    <div v-if="rp.rateMode === 'derived'" class="space-y-3">
                      <div class="flex flex-col gap-1.5">
                        <Label class="text-sm">Parent Rate Plan</Label>
                        <Select :model-value="rp.parentRatePlanId ?? ''" @update:model-value="(v) => updateRatePlan(idx, 'parentRatePlanId', v || null)">
                          <SelectTrigger class="h-8">
                            <SelectValue placeholder="Select parent rate plan..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem v-for="plan in allAvailableRatePlans" :key="plan.id" :value="plan.id">
                              {{ plan.name }} ({{ plan.unitTypeName }})
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <RatePlanDerivedOptionsEditor
                        :model-value="rp.derivedOptions"
                        :base-rate="ratePlanNightlyRate(rp)"
                        :currency-symbol="currencySymbol"
                        @update:model-value="(v) => updateRatePlan(idx, 'derivedOptions', v)"
                      />
                    </div>

                    <!-- Per person pricing -->
                    <div v-if="rp.sellMode === 'per_person'" class="flex flex-col gap-3">
                      <div class="flex items-center justify-between">
                        <Label>Guest Pricing</Label>
                        <span class="text-[10px] text-muted-foreground">max {{ maxOccupancy }} guests (room type)</span>
                      </div>
                      <div class="grid grid-cols-3 gap-3">
                        <div class="flex flex-col gap-1.5">
                          <Label class="text-xs text-muted-foreground">Included Guests</Label>
                          <Input
                            type="number"
                            :model-value="rp.includedGuests ?? rp.options.find(o => o.isPrimary)?.occupancy ?? 1"
                            min="1"
                            :max="maxOccupancy"
                            class="h-8"
                            @update:model-value="(v) => updateRatePlanGuestPricing(idx, 'includedGuests', v)"
                          />
                        </div>
                        <div class="flex flex-col gap-1.5">
                          <Label class="text-xs text-muted-foreground">Extra Guest / Night ({{ currencySymbol }})</Label>
                          <Input
                            type="number"
                            :model-value="rp.extraGuestRate ?? 0"
                            min="0"
                            class="h-8"
                            @update:model-value="(v) => updateRatePlanGuestPricing(idx, 'extraGuestRate', v)"
                          />
                        </div>
                        <div class="flex flex-col gap-1.5">
                          <Label class="text-xs text-muted-foreground">Base Rate / Night ({{ currencySymbol }})</Label>
                          <Input
                            type="number"
                            :model-value="ratePlanNightlyRate(rp)"
                            min="0"
                            class="h-8"
                            @update:model-value="(v) => updateRatePlanGuestPricing(idx, 'baseRate', v)"
                          />
                        </div>
                      </div>
                      <p class="text-[10px] text-muted-foreground">
                        {{ guestPricingHint(rp) }}
                      </p>
                    </div>

                    <!-- Per room pricing -->
                    <div v-else class="flex flex-col gap-3">
                      <div class="flex items-center justify-between">
                        <Label>Base Rate / Night</Label>
                        <span class="text-[10px] text-muted-foreground">all {{ maxOccupancy }} guests included</span>
                      </div>
                      <Input
                        type="number"
                        :model-value="ratePlanNightlyRate(rp)"
                        min="0"
                        class="h-8"
                        @update:model-value="(v) => updateRatePlanGuestPricing(idx, 'baseRate', v)"
                      />
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                      <div class="flex flex-col gap-1.5">
                        <Label>Children Fee / Night ({{ currencySymbol }})</Label>
                        <Input
                          type="number"
                          :model-value="rp.childrenFee"
                          min="0"
                          @update:model-value="(v) => updateRatePlan(idx, 'childrenFee', Number(v) || 0)"
                        />
                      </div>
                      <div class="flex flex-col gap-1.5">
                        <Label>Infant Fee / Night ({{ currencySymbol }})</Label>
                        <Input
                          type="number"
                          :model-value="rp.infantFee"
                          min="0"
                          @update:model-value="(v) => updateRatePlan(idx, 'infantFee', Number(v) || 0)"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Offerings -->
              <div class="flex flex-col gap-4">
                <div class="flex items-center justify-between">
                  <div>
                    <h4 class="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Offerings
                    </h4>
                    <p class="text-[10px] text-muted-foreground mt-0.5">
                      Create rate plans derived from the base. Each offering adjusts the base price by a fixed amount or percentage.
                    </p>
                  </div>
                  <Button variant="outline" size="sm" class="gap-1.5" @click="addOffering">
                    <Icon name="lucide:plus" class="size-3.5" />
                    Add Offering
                  </Button>
                </div>

                <div v-if="(form.pricing?.offerings?.length ?? 0) === 0" class="text-xs text-muted-foreground italic py-2">
                  No offerings added yet.
                </div>

                <div v-else class="flex flex-col gap-3">
                  <div v-for="(offering, idx) in form.pricing?.offerings" :key="offering.id" class="border rounded-lg p-3 space-y-3">
                    <div class="flex items-center justify-between">
                      <Input
                        :model-value="offering.name"
                        placeholder="Offering name"
                        class="max-w-[200px]"
                        @update:model-value="(v) => updateOffering(idx, 'name', String(v))"
                      />
                      <Button variant="ghost" size="sm" class="h-7 w-7 p-0" @click="removeOffering(idx)">
                        <Icon name="lucide:trash-2" class="size-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                    <div class="flex items-center gap-2">
                      <Select :model-value="offering.adjustmentType" @update:model-value="(v) => updateOffering(idx, 'adjustmentType', v)">
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
                        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{{ offering.adjustmentType === 'percent' ? '%' : currencySymbol }}</span>
                        <Input
                          type="number"
                          :model-value="offering.adjustmentValue"
                          class="pl-7"
                          @update:model-value="(v) => updateOffering(idx, 'adjustmentValue', Number(v) || 0)"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Length of Stay Discounts -->
              <div class="flex flex-col gap-4">
                <div class="flex items-center justify-between">
                  <h4 class="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Length of Stay Discounts
                  </h4>
                  <Button variant="outline" size="sm" class="gap-1.5" @click="addLosDiscount">
                    <Icon name="lucide:plus" class="size-3.5" />
                    Add Discount
                  </Button>
                </div>

                <div v-if="(form.pricing?.lengthOfStayDiscounts?.length ?? 0) === 0" class="text-xs text-muted-foreground italic py-2">
                  No discounts configured.
                </div>

                <div v-else class="flex flex-col gap-2">
                  <div v-for="(discount, idx) in form.pricing?.lengthOfStayDiscounts" :key="discount.id" class="flex items-center gap-2">
                    <div class="flex items-center gap-1.5">
                      <Label class="text-xs whitespace-nowrap">Min nights:</Label>
                      <Input
                        type="number"
                        :model-value="discount.minNights"
                        class="w-16 h-8"
                        min="1"
                        @update:model-value="(v) => updateLosDiscount(idx, 'minNights', Number(v) || 1)"
                      />
                    </div>
                    <Select :model-value="discount.discountType" @update:model-value="(v) => updateLosDiscount(idx, 'discountType', v)">
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
                      <span class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{{ discount.discountType === 'percent' ? '%' : currencySymbol }}</span>
                      <Input
                        type="number"
                        :model-value="discount.value"
                        class="pl-7 h-8"
                        @update:model-value="(v) => updateLosDiscount(idx, 'value', Number(v) || 0)"
                      />
                    </div>
                    <Button variant="ghost" size="sm" class="h-8 w-8 p-0 shrink-0" @click="removeLosDiscount(idx)">
                      <Icon name="lucide:x" class="size-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              </div>

              <!-- Advanced Pricing Settings -->
              <div>
                <button
                  class="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  @click="showAdvancedPricing = !showAdvancedPricing"
                >
                  <Icon
                    name="lucide:chevron-right"
                    class="size-4 transition-transform"
                    :class="showAdvancedPricing ? 'rotate-90' : ''"
                  />
                  Advanced Pricing Settings
                </button>
                <div v-if="showAdvancedPricing" class="mt-3 space-y-4">
                  <!-- Fees -->
                  <div class="flex flex-col gap-4">
                    <div>
                      <h4 class="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Fees
                      </h4>
                      <p class="text-[10px] text-muted-foreground mt-0.5">
                        One-time fees charged per booking. Toggle on the fees you want to charge.
                      </p>
                    </div>

                    <div class="flex flex-col gap-3">
                      <div
                        v-for="(fee, idx) in form.pricing?.fees"
                        :key="fee.id"
                        class="flex items-center justify-between p-3 border rounded-lg"
                        :class="fee.enabled ? 'bg-muted/30' : 'opacity-60'"
                      >
                        <div class="flex items-center gap-3">
                          <div class="flex size-8 items-center justify-center rounded-md bg-muted">
                            <Icon :name="feeIcons[fee.type] ?? 'lucide:banknote'" class="size-4 text-muted-foreground" />
                          </div>
                          <div class="flex flex-col">
                            <span class="text-sm font-medium">{{ fee.name }}</span>
                            <span v-if="fee.enabled" class="text-xs text-muted-foreground">
                              {{ currencySymbol }}{{ fee.amount }} per booking
                            </span>
                          </div>
                        </div>

                        <div class="flex items-center gap-3">
                          <div v-if="fee.enabled" class="relative">
                            <span class="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">{{ currencySymbol }}</span>
                            <Input
                              type="number"
                              :model-value="fee.amount"
                              class="h-8 w-24 pl-6 text-sm"
                              min="0"
                              @update:model-value="(v) => updateFeeAmount(idx, Number(v) || 0)"
                            />
                          </div>
                          <Switch
                            :model-value="fee.enabled"
                            @update:model-value="toggleFee(idx)"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Save/Cancel -->
            <div class="flex items-center gap-2 justify-end px-4 pb-4">
              <Button variant="ghost" size="sm" @click="cancelEdit">
                Cancel
              </Button>
              <Button size="sm" @click="saveEdit">
                <Icon name="lucide:check" class="size-3.5 mr-1.5" />
                Save Changes
              </Button>
            </div>
          </div>

          <!-- View mode - Units list -->
          <div v-else class="p-4">
            <!-- Quick summary -->
            <div class="flex flex-wrap gap-4 mb-4 text-xs text-muted-foreground">
              <span class="flex items-center gap-1">
                <Icon name="lucide:hash" class="size-3" /> {{ ut.quantity }} room{{ ut.quantity > 1 ? 's' : '' }}
              </span>
              <span v-if="ut.description" class="flex items-center gap-1">
                <Icon name="lucide:info" class="size-3" /> {{ ut.description }}
              </span>
              <span class="flex items-center gap-1">
                <Icon name="lucide:users" class="size-3" /> {{ ut.maxAdults }} adults, {{ ut.maxChildren }} children
              </span>
              <span class="flex items-center gap-1">
                <Icon name="lucide:bed-double" class="size-3" /> {{ ut.bedrooms }} bed{{ ut.bedrooms > 1 ? 's' : '' }}, {{ ut.bathrooms }} bath{{ ut.bathrooms > 1 ? 's' : '' }}
              </span>
              <span class="flex items-center gap-1">
                <Icon name="lucide:dollar-sign" class="size-3" />
                {{ ut.pricing.ratePlans[0] ? ratePlanNightlyRate(ut.pricing.ratePlans[0]) : 0 }}/night
              </span>
            </div>

            <!-- Units -->
            <div class="flex flex-col gap-1.5 ml-2">
              <div
                v-for="unit in ut.units"
                :key="unit.id"
                class="flex items-center gap-2 group"
              >
                <Icon name="lucide:door-open" class="size-3.5 text-muted-foreground shrink-0" />
                <Input
                  :model-value="unit.name"
                  class="h-7 text-xs flex-1"
                  @update:model-value="(v) => updateUnitField(ut.id, unit.id, 'name', String(v))"
                />
                <Input
                  :model-value="unit.identifier ?? ''"
                  class="h-7 text-xs w-20"
                  placeholder="ID"
                  @update:model-value="(v) => updateUnitField(ut.id, unit.id, 'identifier', String(v))"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  class="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  @click="removeUnitFromType(ut.id, unit.id)"
                >
                  <Icon name="lucide:x" class="size-3.5 text-muted-foreground" />
                </Button>
              </div>

              <Button
                variant="ghost"
                size="sm"
                class="h-7 gap-1.5 text-xs text-muted-foreground justify-start w-fit"
                @click="addUnitToType(ut.id)"
              >
                <Icon name="lucide:plus" class="size-3" />
                Add Unit
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Add unit type dialog -->
    <Dialog v-model:open="showAddDialog">
      <DialogContent class="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Room Type</DialogTitle>
          <DialogDescription>
            Create a new category for grouping rooms (e.g., Kingbed, Twin, Suite)
          </DialogDescription>
        </DialogHeader>
        <div class="flex flex-col gap-4 py-2">
          <div class="flex flex-col gap-1.5">
            <Label>Type Name</Label>
            <Input v-model="newTypeName" placeholder="e.g., Kingbed, Single Bed" @keydown.enter="addUnitType" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" @click="showAddDialog = false">
            Cancel
          </Button>
          <Button size="sm" :disabled="!newTypeName.trim()" @click="addUnitType">
            <Icon name="lucide:check" class="size-3.5 mr-1.5" />
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Add Rate Plan Sheet -->
    <Sheet v-model:open="showAddRatePlanSheet">
      <SheetContent class="w-full sm:max-w-md p-0">
        <SheetHeader>
          <SheetTitle>Add Rate Plan</SheetTitle>
          <SheetDescription>
            New rate plans get Channex defaults: per_room, manual, min stay 1, stop sell off. You can fine-tune them later.
          </SheetDescription>
        </SheetHeader>

        <div class="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
          <div class="flex flex-col gap-1.5">
            <Label>Title</Label>
            <Input v-model="addRatePlanDraft.title" placeholder="e.g., Best Available Rate" />
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div class="flex flex-col gap-2">
              <Label>Sell Mode</Label>
              <Tabs :model-value="addRatePlanDraft.sellMode" @update:model-value="(v) => addRatePlanDraft.sellMode = String(v) as RateSellMode" class="w-full">
                <TabsList class="grid w-full grid-cols-2 h-8">
                  <TabsTrigger value="per_room" class="text-xs">Room</TabsTrigger>
                  <TabsTrigger value="per_person" class="text-xs">Person</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <div class="flex flex-col gap-2">
              <Label>Rate Mode</Label>
              <Tabs :model-value="addRatePlanDraft.rateMode" @update:model-value="(v) => addRatePlanDraft.rateMode = String(v) as RateRateMode" class="w-full">
                <TabsList class="grid w-full grid-cols-2 h-8">
                  <TabsTrigger value="manual" class="text-xs">Manual</TabsTrigger>
                  <TabsTrigger value="derived" class="text-xs">Derived Options</TabsTrigger>
                  <TabsTrigger value="auto" class="text-xs">Auto</TabsTrigger>
                  <TabsTrigger value="cascade" class="text-xs">Cascade</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>

          <!-- Derived Options (only for derived rate mode) -->
          <div v-if="addRatePlanDraft.rateMode === 'derived'" class="space-y-3">
            <div class="flex flex-col gap-1.5">
              <Label>Parent Rate Plan</Label>
              <Select :model-value="addRatePlanDraft.parentRatePlanId ?? ''" @update:model-value="(v) => addRatePlanDraft.parentRatePlanId = v || null">
                <SelectTrigger class="h-8">
                  <SelectValue placeholder="Select parent rate plan..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="plan in allAvailableRatePlans" :key="plan.id" :value="plan.id">
                    {{ plan.name }} ({{ plan.unitTypeName }})
                  </SelectItem>
                </SelectContent>
              </Select>
              <p class="text-[10px] text-muted-foreground">This rate plan will inherit from and modify the parent rate plan</p>
            </div>
            <RatePlanDerivedOptionsEditor
              :model-value="addRatePlanDraft.derivedOptions"
              :base-rate="ratePlanNightlyRate(addRatePlanDraft)"
              :currency-symbol="currencySymbol"
              @update:model-value="(v) => addRatePlanDraft.derivedOptions = v"
            />
          </div>

          <!-- Per person pricing -->
          <div v-if="addRatePlanDraft.sellMode === 'per_person'" class="flex flex-col gap-3">
            <div class="flex items-center justify-between">
              <Label>Guest Pricing</Label>
              <span class="text-[10px] text-muted-foreground">max {{ maxOccupancy }} guests (room type)</span>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div class="flex flex-col gap-1.5">
                <Label class="text-xs text-muted-foreground">Included Guests</Label>
                <Input
                  type="number"
                  :model-value="addRatePlanDraft.includedGuests ?? 1"
                  min="1"
                  :max="maxOccupancy"
                  class="h-8"
                  @update:model-value="setAddDraftIncludedGuests"
                />
              </div>
              <div class="flex flex-col gap-1.5">
                <Label class="text-xs text-muted-foreground">Extra Guest / Night</Label>
                <div class="relative">
                  <span class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{{ currencySymbol }}</span>
                  <Input
                    type="number"
                    :model-value="addRatePlanDraft.extraGuestRate ?? 0"
                    class="pl-7 h-8"
                    min="0"
                    @update:model-value="setAddDraftExtraGuestRate"
                  />
                </div>
              </div>
            </div>
            <div class="flex flex-col gap-1.5">
              <Label class="text-xs text-muted-foreground">Base Rate / Night ({{ addRatePlanDraft.includedGuests ?? 1 }} guest{{ (addRatePlanDraft.includedGuests ?? 1) !== 1 ? 's' : '' }} included)</Label>
              <div class="relative">
                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{{ currencySymbol }}</span>
                <Input
                  type="number"
                  :model-value="ratePlanNightlyRate(addRatePlanDraft)"
                  class="pl-7 h-8"
                  min="0"
                  @update:model-value="setAddDraftBaseRate"
                />
              </div>
            </div>
            <p class="text-[10px] text-muted-foreground">
              {{ guestPricingHint(addRatePlanDraft) }}
            </p>
          </div>

          <!-- Per room pricing -->
          <div v-else class="flex flex-col gap-3">
            <div class="flex items-center justify-between">
              <Label>Base Rate / Night</Label>
              <span class="text-[10px] text-muted-foreground">all {{ maxOccupancy }} guests included</span>
            </div>
            <div class="relative">
              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{{ currencySymbol }}</span>
              <Input
                type="number"
                :model-value="ratePlanNightlyRate(addRatePlanDraft)"
                class="pl-7 h-8"
                min="0"
                @update:model-value="setAddDraftBaseRate"
              />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div class="flex flex-col gap-1.5">
              <Label>Children Fee / Night ({{ currencySymbol }})</Label>
              <Input
                type="number"
                :model-value="addRatePlanDraft.childrenFee"
                min="0"
                @update:model-value="(v) => addRatePlanDraft.childrenFee = Number(v) || 0"
              />
            </div>
            <div class="flex flex-col gap-1.5">
              <Label>Infant Fee / Night ({{ currencySymbol }})</Label>
              <Input
                type="number"
                :model-value="addRatePlanDraft.infantFee"
                min="0"
                @update:model-value="(v) => addRatePlanDraft.infantFee = Number(v) || 0"
              />
            </div>
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
  </div>
</template>
