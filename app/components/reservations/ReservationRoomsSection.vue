<script setup lang="ts">
import type { UnitType } from '~/components/listings/data/listings'
import type { BookingMode, PaymentFeeMode, ReservationCharge, ReservationChargeKind, ReservationRoomLine } from '~/components/reservations/data/reservations'
import { listings } from '~/components/listings/data/listings'
import { useReservationsModule } from '~/composables/useReservationsModule'

const props = withDefaults(defineProps<{
  listingId: string
  checkIn: string
  checkOut: string
  nights: number
  currency: string
  excludeReservationId?: string
}>(), {
  excludeReservationId: '',
})

const model = defineModel<{
  rooms: ReservationRoomLine[]
  bookingMode: BookingMode
  paymentFeeMode: PaymentFeeMode
  paymentCustomFeePct: number
  charges: ReservationCharge[]
}>({ required: true })

const { getUnitConflicts, getConflictedUnitIds } = useReservationsModule()

const listing = computed(() => listings.value.find(l => l.id === props.listingId))

/** Listings without unitTypes are treated as a single whole-property unit with the listing's nightly/seasonal rates. */
const unitTypes = computed<UnitType[]>(() => {
  const l = listing.value
  if (!l)
    return []
  if (l.unitTypes?.length)
    return l.unitTypes
  return [{
    id: `${l.id}-whole`,
    name: 'Whole property',
    quantity: 1,
    maxAdults: l.capacity,
    maxChildren: 0,
    maxInfants: 0,
    bedrooms: 1,
    bathrooms: 1,
    beds: [],
    photos: [],
    pricing: {
      currency: props.currency,
      ratePlans: [
        { id: 'standard', name: 'Standard Rate', pricePerNight: l.pricing.nightlyRate, pricePerAdditionalGuest: 0, isBase: true },
        ...l.pricing.seasonalRates.map(sr => ({
          id: `seasonal-${sr.label}`,
          name: sr.label,
          pricePerNight: sr.rate,
          pricePerAdditionalGuest: 0,
          isBase: false,
        })),
      ],
      offerings: [],
      lengthOfStayDiscounts: [],
      fees: [
        { id: 'cleaning', name: 'Cleaning Fee', enabled: true, amount: l.pricing.cleaningFee, type: 'cleaning' },
        { id: 'service', name: 'Service Fee', enabled: true, amount: l.pricing.serviceFee, type: 'early_checkin' },
      ],
    },
    units: [{ id: `${l.id}-whole`, name: l.name, identifier: 'W1' }],
  }]
})

interface UnitRef {
  unitId: string
  unitName: string
  unitTypeName: string
}

const allUnits = computed<UnitRef[]>(() => {
  const out: UnitRef[] = []
  for (const ut of unitTypes.value) {
    for (const u of ut.units)
      out.push({ unitId: u.id, unitName: u.name, unitTypeName: ut.name })
  }
  return out
})

const conflictedUnitIds = computed<Set<string>>(() => {
  if (!props.listingId || !props.checkIn || !props.checkOut)
    return new Set()
  return getConflictedUnitIds(props.listingId, props.checkIn, props.checkOut, props.excludeReservationId)
})

function conflictFor(unitId: string) {
  return getUnitConflicts(unitId, props.listingId, props.checkIn, props.checkOut, props.excludeReservationId)[0]
}

// Room picking state
const pickerOpen = ref(false)
const pickerUnitId = ref('')
const pickerRateId = ref('')
const pickerGuestNames = ref('')
const pendingConflict = ref<UnitRef | null>(null)
const entirePropertyConflictList = ref<UnitRef[]>([])
const overrideConfirmOpen = ref(false)

const pickedUnitType = computed(() =>
  unitTypes.value.find(ut => ut.units.some(u => u.id === pickerUnitId.value)))

const pickedUnit = computed(() =>
  pickedUnitType.value?.units.find(u => u.id === pickerUnitId.value))

const pickedRates = computed(() => pickedUnitType.value?.pricing.ratePlans ?? [])

function unitNameOf(unitId: string): string {
  for (const ut of unitTypes.value) {
    const unit = ut.units.find(u => u.id === unitId)
    if (unit)
      return unit.name
  }
  return unitId
}

function buildEntirePropertyLines(): ReservationRoomLine[] {
  const lines: ReservationRoomLine[] = []
  for (const ut of unitTypes.value) {
    for (const unit of ut.units) {
      const base = ut.pricing.ratePlans.find(rp => rp.isBase) ?? ut.pricing.ratePlans[0]
      if (!base)
        continue
      const nights = Math.max(props.nights, 1)
      lines.push({
        id: `room-${unit.id}-${Date.now()}-${lines.length}`,
        unitTypeId: ut.id,
        unitId: unit.id,
        unitName: unit.name,
        ratePlanId: base.id,
        rateLabel: `${ut.name} — ${base.name}`,
        pricePerNight: base.pricePerNight,
        lineTotal: base.pricePerNight * nights,
      })
    }
  }
  return lines
}

const rooms = computed(() => model.value.rooms)

const bookingMode = computed({
  get: () => model.value.bookingMode,
  set: (v: BookingMode) => {
    if (v === 'entire_property') {
      const conflicted = allUnits.value.filter(u => conflictedUnitIds.value.has(u.unitId))
      if (conflicted.length > 0) {
        entirePropertyConflictList.value = conflicted
        pendingConflict.value = null
        overrideConfirmOpen.value = true
        return
      }
    }
    // Single write: props.modelValue stays stale within this synchronous
    // handler, so build the final state before assigning.
    model.value = {
      ...model.value,
      bookingMode: v,
      rooms: v === 'entire_property' ? buildEntirePropertyLines() : model.value.rooms,
    }
  },
})

function addRoom(unitId: string) {
  const ut = pickedUnitType.value ?? unitTypes.value.find(t => t.units.some(u => u.id === unitId))
  const unit = ut?.units.find(u => u.id === unitId)
  if (!ut || !unit)
    return
  const rate = pickedRates.value.find(r => r.id === pickerRateId.value)
    ?? ut.pricing.ratePlans.find(rp => rp.isBase)
    ?? ut.pricing.ratePlans[0]
  if (!rate)
    return
  const nights = Math.max(props.nights, 1)
  const line: ReservationRoomLine = {
    id: `room-${unit.id}-${Date.now()}`,
    unitTypeId: ut.id,
    unitId: unit.id,
    unitName: unit.name,
    ratePlanId: rate.id,
    rateLabel: `${ut.name} — ${rate.name}`,
    pricePerNight: rate.pricePerNight,
    lineTotal: rate.pricePerNight * nights,
    guestNames: pickerGuestNames.value.trim() || undefined,
  }
  model.value = { ...model.value, rooms: [...model.value.rooms, line] }
  pickerUnitId.value = ''
  pickerRateId.value = ''
  pickerGuestNames.value = ''
  pickerOpen.value = false
}

function removeRoom(roomId: string) {
  model.value = { ...model.value, rooms: model.value.rooms.filter(r => r.id !== roomId) }
}

function updateRoomPrice(roomId: string, price: number) {
  if (price < 0)
    return
  const nights = Math.max(props.nights, 1)
  model.value = {
    ...model.value,
    rooms: model.value.rooms.map((r) => {
      if (r.id !== roomId)
        return r
      const mode = r.priceMode ?? 'per_night'
      const perNight = mode === 'per_night' ? price : r.pricePerNight
      const perStay = mode === 'per_stay' ? price : (r.pricePerStay ?? r.pricePerNight * nights)
      return {
        ...r,
        pricePerNight: perNight,
        pricePerStay: perStay,
        lineTotal: mode === 'per_night' ? perNight * nights : perStay,
      }
    }),
  }
}

function updateRoomPriceMode(roomId: string, mode: 'per_night' | 'per_stay') {
  const nights = Math.max(props.nights, 1)
  model.value = {
    ...model.value,
    rooms: model.value.rooms.map((r) => {
      if (r.id !== roomId)
        return r
      const perStay = r.pricePerStay ?? r.pricePerNight * nights
      return {
        ...r,
        priceMode: mode,
        pricePerStay: perStay,
        lineTotal: mode === 'per_night' ? r.pricePerNight * nights : perStay,
      }
    }),
  }
}

function roomInputValue(room: ReservationRoomLine): number {
  return room.priceMode === 'per_stay' ? (room.pricePerStay ?? 0) : room.pricePerNight
}

watch(() => props.nights, (nights) => {
  if (!nights || !model.value.rooms.length)
    return
  model.value = {
    ...model.value,
    rooms: model.value.rooms.map(r => ({
      ...r,
      lineTotal: r.priceMode === 'per_stay' ? (r.pricePerStay ?? r.lineTotal) : r.pricePerNight * nights,
    })),
  }
})

function openPicker(unitId: string) {
  const conflicts = getUnitConflicts(unitId, props.listingId, props.checkIn, props.checkOut, props.excludeReservationId)
  if (conflicts.length > 0) {
    pendingConflict.value = { unitId, unitName: unitNameOf(unitId), unitTypeName: '' }
    overrideConfirmOpen.value = true
    return
  }
  addRoom(unitId)
}

function confirmOverride() {
  if (pendingConflict.value) {
    addRoom(pendingConflict.value.unitId)
    pendingConflict.value = null
  }
  else if (entirePropertyConflictList.value.length > 0) {
    model.value = {
      ...model.value,
      bookingMode: 'entire_property',
      rooms: buildEntirePropertyLines(),
    }
    entirePropertyConflictList.value = []
  }
  overrideConfirmOpen.value = false
}

const roomLinesTotal = computed(() => model.value.rooms.reduce((sum, r) => sum + r.lineTotal, 0))

// Taxes & fees (charges)
const chargeKindLabels: Record<ReservationChargeKind, string> = {
  cleaning: 'Cleaning Fee',
  city_tax: 'City Tax',
  service: 'Service Fee',
  other: 'Other',
}

const chargeKindInput = ref<ReservationChargeKind>('cleaning')
const chargeLabelInput = ref('')
const chargeAmountInput = ref(0)

const chargesTotal = computed(() => model.value.charges.reduce((sum, c) => sum + c.amount, 0))

function kindOfFeeType(type: 'cleaning' | 'early_checkin' | 'late_checkout'): ReservationChargeKind {
  return type === 'cleaning' ? 'cleaning' : 'other'
}

/** Auto-fill charges from the property's configured fees when the listing changes. */
const propertyFees = computed(() => {
  const l = listing.value
  if (!l)
    return []
  if (l.unitTypes?.length) {
    const out: Array<{ name: string, amount: number, kind: ReservationChargeKind }> = []
    for (const ut of l.unitTypes) {
      for (const fee of ut.pricing.fees) {
        if (!fee.enabled || fee.amount <= 0)
          continue
        const name = fee.name === 'Cleaning Fee'
          ? `${ut.name} — Cleaning Fee`
          : `${ut.name} — ${fee.name}`
        if (!out.some(f => f.name === name))
          out.push({ name, amount: fee.amount, kind: kindOfFeeType(fee.type) })
      }
    }
    return out
  }
  return [
    { name: 'Cleaning Fee', amount: l.pricing.cleaningFee, kind: 'cleaning' as ReservationChargeKind },
    { name: 'Service Fee', amount: l.pricing.serviceFee, kind: 'service' as ReservationChargeKind },
  ]
})

function importPropertyFees() {
  if (!propertyFees.value.length)
    return
  const existing = new Set(model.value.charges.map(c => c.label))
  const additions = propertyFees.value
    .filter(f => f.amount > 0 && !existing.has(f.name))
    .map(f => ({
      id: `chg-${f.name}-${Date.now()}`,
      kind: f.kind,
      label: f.name,
      amount: f.amount,
    }))
  if (!additions.length)
    return
  model.value = { ...model.value, charges: [...model.value.charges, ...additions] }
}

watch(listing, (newListing, oldListing) => {
  if (newListing?.id !== oldListing?.id) {
    model.value = { ...model.value, charges: [] }
    importPropertyFees()
  }
})

// Accordion content can mount after the property is already picked; import fees on mount.
onMounted(() => {
  if (!model.value.charges.length)
    importPropertyFees()
})

function addCharge() {
  const amount = chargeAmountInput.value
  if (amount <= 0)
    return
  const label = chargeKindInput.value === 'other'
    ? (chargeLabelInput.value.trim() || 'Other')
    : chargeKindLabels[chargeKindInput.value]
  const charge: ReservationCharge = {
    id: `chg-${Date.now()}`,
    kind: chargeKindInput.value,
    label,
    amount,
  }
  model.value = { ...model.value, charges: [...model.value.charges, charge] }
  chargeKindInput.value = 'cleaning'
  chargeLabelInput.value = ''
  chargeAmountInput.value = 0
}

function removeCharge(chargeId: string) {
  model.value = { ...model.value, charges: model.value.charges.filter(c => c.id !== chargeId) }
}

// Payment charge
const feeLabel = computed(() => {
  if (model.value.paymentFeeMode === 'card')
    return 'Card (+3%)'
  if (model.value.paymentFeeMode === 'manual')
    return `Custom (${model.value.paymentCustomFeePct}%)`
  return 'No fee'
})

const feeAmount = computed(() => {
  if (model.value.paymentFeeMode === 'card')
    return Math.round(roomLinesTotal.value * 0.03 * 100) / 100
  if (model.value.paymentFeeMode === 'manual')
    return Math.round(roomLinesTotal.value * (model.value.paymentCustomFeePct / 100) * 100) / 100
  return 0
})

const grandTotal = computed(() => roomLinesTotal.value + chargesTotal.value + feeAmount.value)

function fmt(value: number): string {
  const locale = props.currency === 'IDR' ? 'id-ID' : 'de-CH'
  const digits = props.currency === 'IDR' ? 0 : 2
  return `${props.currency} ${value.toLocaleString(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`
}
</script>

<template>
  <div class="space-y-3">
    <!-- Mode toggle -->
    <div class="flex rounded-md border bg-muted/40 p-0.5">
      <button
        type="button"
        class="flex-1 rounded-sm px-3 py-1.5 text-xs font-medium transition-colors"
        :class="bookingMode === 'entire_property' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'"
        @click="bookingMode = 'entire_property'"
      >
        Entire property
      </button>
      <button
        type="button"
        class="flex-1 rounded-sm px-3 py-1.5 text-xs font-medium transition-colors"
        :class="bookingMode === 'rooms' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'"
        @click="bookingMode = 'rooms'"
      >
        Rooms
      </button>
    </div>

    <p v-if="!listingId" class="text-xs text-muted-foreground">
      Select a property and dates first.
    </p>

    <!-- Room lines -->
    <div v-if="listingId" class="space-y-2">
      <div
        v-for="room in rooms"
        :key="room.id"
        class="rounded-md border p-3"
        :class="conflictedUnitIds.has(room.unitId) ? 'border-destructive/50 bg-destructive/5' : ''"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="text-sm font-medium">
              {{ room.unitName }}
              <Badge v-if="conflictedUnitIds.has(room.unitId)" variant="destructive" class="ml-1 text-[9px]">
                Conflict
              </Badge>
            </p>
            <p class="text-xs text-muted-foreground">
              {{ room.rateLabel }}
            </p>
            <p v-if="room.guestNames" class="text-xs text-muted-foreground">
              Guests: {{ room.guestNames }}
            </p>
          </div>
          <div class="flex shrink-0 items-center gap-2">
            <span class="text-sm font-semibold">{{ fmt(room.lineTotal) }}</span>
            <Button variant="ghost" size="sm" class="h-7 w-7 p-0 hover:text-destructive" title="Remove room" @click="removeRoom(room.id)">
              <Icon name="lucide:x" class="size-3.5" />
            </Button>
          </div>
        </div>
        <div class="mt-3 flex items-center gap-2 border-t pt-3">
          <Label class="shrink-0 text-xs text-muted-foreground">Price</Label>
          <Input
            :model-value="roomInputValue(room)"
            type="number"
            min="0"
            class="h-8 w-32 text-right text-sm"
            @update:model-value="(v: any) => updateRoomPrice(room.id, Number(v))"
          />
          <Select :model-value="room.priceMode ?? 'per_night'" @update:model-value="(v: any) => updateRoomPriceMode(room.id, v)">
            <SelectTrigger class="h-8 w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="per_night">
                per night
              </SelectItem>
              <SelectItem value="per_stay">
                per stay
              </SelectItem>
            </SelectContent>
          </Select>
          <span class="ml-auto text-xs text-muted-foreground">
            {{ (room.priceMode ?? 'per_night') === 'per_stay' ? 'flat rate' : `× ${Math.max(nights, 1)} nights` }}
          </span>
        </div>
      </div>

      <!-- Unit picker (rooms mode) -->
      <template v-if="bookingMode === 'rooms'">
        <div class="space-y-1.5">
          <Label class="text-xs">Add room</Label>
          <Popover v-model:open="pickerOpen">
            <PopoverTrigger as-child>
              <Button variant="outline" class="w-full justify-between">
                {{ pickedUnit ? `${pickedUnit.name} — ${pickedUnitType?.name}` : 'Select a unit' }}
                <Icon name="lucide:chevrons-up-down" class="size-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent class="w-[320px] p-0" align="start">
              <div class="max-h-64 overflow-y-auto p-1">
                <template v-for="ut in unitTypes" :key="ut.id">
                  <p class="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                    {{ ut.name }}
                  </p>
                  <button
                    v-for="unit in ut.units"
                    :key="unit.id"
                    type="button"
                    class="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                    @click="pickerUnitId = unit.id"
                  >
                    <span>{{ unit.name }}</span>
                    <Badge v-if="conflictedUnitIds.has(unit.id)" variant="destructive" class="text-[9px]">
                      Booked
                    </Badge>
                  </button>
                </template>
              </div>
              <div class="border-t p-2">
                <div class="space-y-1.5">
                  <Label class="text-xs">Rate</Label>
                  <Select v-model="pickerRateId">
                    <SelectTrigger class="h-8 text-sm">
                      <SelectValue placeholder="Select a rate" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem v-for="r in pickedRates" :key="r.id" :value="r.id">
                        {{ r.name }} — {{ fmt(r.pricePerNight) }}/night
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div class="mt-1.5 space-y-1.5">
                  <Label class="text-xs">Guests in this room (optional)</Label>
                  <Input v-model="pickerGuestNames" placeholder="e.g. John & Jane" class="h-8 text-sm" />
                </div>
                <Button
                  size="sm"
                  class="mt-2 w-full"
                  :disabled="!pickerUnitId"
                  @click="openPicker(pickerUnitId)"
                >
                  Add room
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </template>

      <p v-else class="text-xs text-muted-foreground">
        All {{ rooms.length }} units are booked for this stay.
      </p>
    </div>

    <!-- Taxes & fees -->
    <div class="space-y-2">
      <div class="flex items-center justify-between">
        <Label>Taxes &amp; fees</Label>
        <Button
          v-if="propertyFees.length"
          variant="ghost"
          size="sm"
          class="h-7 text-xs text-muted-foreground"
          @click="importPropertyFees"
        >
          Add property fees
        </Button>
      </div>
      <div v-for="charge in model.charges" :key="charge.id" class="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
        <span class="text-sm">{{ charge.label }}</span>
        <div class="flex shrink-0 items-center gap-2">
          <span class="text-sm font-medium">{{ fmt(charge.amount) }}</span>
          <Button variant="ghost" size="sm" class="h-7 w-7 p-0 hover:text-destructive" title="Remove charge" @click="removeCharge(charge.id)">
            <Icon name="lucide:x" class="size-3.5" />
          </Button>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <Select v-model="chargeKindInput">
          <SelectTrigger class="h-8 w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="cleaning">
              Cleaning Fee
            </SelectItem>
            <SelectItem value="city_tax">
              City Tax
            </SelectItem>
            <SelectItem value="service">
              Service Fee
            </SelectItem>
            <SelectItem value="other">
              Other
            </SelectItem>
          </SelectContent>
        </Select>
        <Input
          v-if="chargeKindInput === 'other'"
          v-model="chargeLabelInput"
          placeholder="Label"
          class="h-8 flex-1 text-sm"
        />
        <Input
          v-model.number="chargeAmountInput"
          type="number"
          min="0"
          placeholder="Amount"
          class="h-8 w-28 text-right text-sm"
        />
        <Button size="sm" class="h-8" :disabled="chargeAmountInput <= 0" @click="addCharge">
          Add
        </Button>
      </div>
    </div>

    <!-- Payment charge -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div class="space-y-2">
        <Label>Payment charge</Label>
        <Select
          :model-value="model.paymentFeeMode"
          @update:model-value="(v: any) => model = { ...model, paymentFeeMode: v }"
        >
          <SelectTrigger>
            <SelectValue placeholder="Select charge" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="card">
              Card (+3%)
            </SelectItem>
            <SelectItem value="manual">
              Custom (%)
            </SelectItem>
            <SelectItem value="no_fee">
              No fee
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div v-if="model.paymentFeeMode === 'manual'" class="space-y-2">
        <Label>Custom fee %</Label>
        <Input
          :model-value="model.paymentCustomFeePct"
          type="number"
          min="0"
          max="100"
          step="0.1"
          @update:model-value="(v: any) => model = { ...model, paymentCustomFeePct: Number(v) }"
        />
      </div>
    </div>

    <div class="rounded-md border bg-muted/40 p-3 text-sm">
      <div class="flex items-center justify-between">
        <span class="text-muted-foreground">Rooms total</span>
        <span class="font-medium">{{ fmt(roomLinesTotal) }}</span>
      </div>
      <div v-for="charge in model.charges" :key="charge.id" class="flex items-center justify-between">
        <span class="text-muted-foreground">{{ charge.label }}</span>
        <span class="font-medium">{{ fmt(charge.amount) }}</span>
      </div>
      <div class="flex items-center justify-between">
        <span class="text-muted-foreground">{{ feeLabel }}</span>
        <span class="font-medium">{{ fmt(feeAmount) }}</span>
      </div>
      <div class="mt-1 flex items-center justify-between border-t pt-1">
        <span class="text-muted-foreground">Guest pays via payment link</span>
        <span class="font-semibold">{{ fmt(grandTotal) }}</span>
      </div>
    </div>

    <!-- Override confirm dialog -->
    <AlertDialog v-model:open="overrideConfirmOpen">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Unit already booked</AlertDialogTitle>
          <AlertDialogDescription>
            <template v-if="pendingConflict">
              {{ pendingConflict.unitName }} is already booked for this date range by
              {{ conflictFor(pendingConflict.unitId)?.guestName }} ({{ conflictFor(pendingConflict.unitId)?.reservationId }}).
              Book anyway?
            </template>
            <template v-else>
              Some units are already booked for this date range. Book the whole property anyway?
            </template>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction @click="confirmOverride">
            Override
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
