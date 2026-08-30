<script setup lang="ts">
import type { LengthOfStayDiscount, Listing, RatePlan, RatePlanOffering, RateRateMode, RateSellMode, UnitType } from '~/components/listings/data/listings'
import { toast } from 'vue-sonner'
import { createRatePlan, ratePlanNightlyRate } from '~/components/listings/data/listings'

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

function openAddRatePlanSheet() {
  if (!form.value.pricing)
    return
  const base = form.value.pricing.ratePlans.find(rp => rp.isBase) ?? form.value.pricing.ratePlans[0]
  addRatePlanDraft.value = {
    ...createRatePlan({}),
    name: `Rate Plan ${(form.value.pricing.ratePlans.length ?? 0) + 1}`,
    title: `Rate Plan ${(form.value.pricing.ratePlans.length ?? 0) + 1}`,
    currency: form.value.pricing.currency ?? 'USD',
    options: [{ occupancy: base?.options[0]?.occupancy ?? 2, isPrimary: true, derivedOption: null, rate: base ? ratePlanNightlyRate(base) : 0 }],
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
                      <div class="flex flex-col gap-1.5">
                        <Label>Sell Mode</Label>
                        <Select :model-value="rp.sellMode" @update:model-value="(v) => updateRatePlan(idx, 'sellMode', String(v))">
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
                        <Label>Rate Mode</Label>
                        <Select :model-value="rp.rateMode" @update:model-value="(v) => updateRatePlan(idx, 'rateMode', String(v))">
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
                      </div>
                    </div>

                    <div class="flex flex-col gap-2">
                      <div class="flex items-center justify-between">
                        <Label>Occupancy Options</Label>
                        <span class="text-[10px] text-muted-foreground">per_room = single option at max occupancy</span>
                      </div>
                      <div v-for="(opt, oi) in rp.options" :key="oi" class="flex items-center gap-2 border rounded-lg p-2">
                        <Icon name="lucide:users" class="size-3.5 text-muted-foreground shrink-0" />
                        <Input
                          type="number"
                          :model-value="opt.occupancy"
                          min="1"
                          class="w-16 h-8 text-xs"
                          @update:model-value="(v) => updateRatePlan(idx, 'options', rp.options.map((o, i) => i === oi ? { ...o, occupancy: Math.max(1, Number(v) || 1) } : o))"
                        />
                        <span class="text-xs text-muted-foreground whitespace-nowrap">guest{{ opt.occupancy !== 1 ? 's' : '' }}</span>
                        <div class="relative flex-1">
                          <span class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{{ currencySymbol }}</span>
                          <Input
                            type="number"
                            :model-value="opt.rate"
                            class="pl-7 h-8 text-xs"
                            min="0"
                            @update:model-value="(v) => updateRatePlan(idx, 'options', rp.options.map((o, i) => i === oi ? { ...o, rate: Number(v) || 0 } : o))"
                          />
                        </div>
                      </div>
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
            </div>
          </div>

          <div class="flex flex-col gap-2">
            <Label>Occupancy Options</Label>
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
                  <span class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{{ currencySymbol }}</span>
                  <Input
                    type="number"
                    :model-value="opt.rate"
                    class="pl-7 h-8 text-xs"
                    min="0"
                    @update:model-value="(v) => addRatePlanDraft.options[oi] = { ...opt, rate: Number(v) || 0 }"
                  />
                </div>
              </div>
            </div>
            <p v-if="addRatePlanDraft.sellMode === 'per_room'" class="text-[10px] text-muted-foreground">
              Per room plans use a single option at max occupancy.
            </p>
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
