<script setup lang="ts">
import type { BookingMode, GuestOccupant, PaymentFeeMode, ReservationCharge, ReservationEntry, ReservationRoomLine, ReservationStatus } from '~/components/reservations/data/reservations'
import { CalendarDate, DateFormatter, getLocalTimeZone } from '@internationalized/date'
import { toast } from 'vue-sonner'
import { COUNTRIES, nightsBetween, reservationStatusLabels } from '~/components/reservations/data/reservations'
import ReservationRoomsSection from '~/components/reservations/ReservationRoomsSection.vue'
import { useReservationsModule } from '~/composables/useReservationsModule'

const props = defineProps<{
  reservation: ReservationEntry | null
  open: boolean
  focusGuestIndex?: number | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'saved': []
}>()

const { updateReservation } = useReservationsModule()
const { createRequest } = usePaymentRequests()

// Basic
const checkIn = ref('')
const checkOut = ref('')
const estimatedArrivalTime = ref('')

const df = new DateFormatter('en-US', { dateStyle: 'medium' })

function parseDateToCalendarDate(dateStr: string): any {
  if (!dateStr)
    return undefined
  const [year = 2026, month = 1, day = 1] = dateStr.split('-').map(Number)
  return new CalendarDate(year, month, day)
}

function calendarDateToString(date: any): string {
  if (!date)
    return ''
  return date.toDate(getLocalTimeZone()).toISOString().split('T')[0]
}

const dateRange = ref<any>({ start: undefined, end: undefined })

watch(() => dateRange.value, (val) => {
  checkIn.value = calendarDateToString(val.start)
  checkOut.value = calendarDateToString(val.end)
}, { deep: true })

// Status & Source
const status = ref<ReservationStatus>('inquiry')
const blocksAvailability = ref(false)
const inquiryExpiryHours = ref(24)

// Contact Details
const guestFirstName = ref('')
const guestLastName = ref('')
const phoneDialCode = ref('+62')
const phoneNumber = ref('')
const sendPaymentWhatsApp = ref(false)
const guestEmail = ref('')
const sendPaymentEmail = ref(false)
const guestAddress = ref('')
const guestCity = ref('')
const guestZip = ref('')
const guestCountry = ref('')

// Rooms & Price
const guestCount = ref(2)
const guestAdults = ref(2)
const guestChildren = ref(0)
const guestInfants = ref(0)
const totalPrice = ref(0)
const currency = ref('USD')

const rooms = ref<ReservationRoomLine[]>([])
const bookingMode = ref<BookingMode>('rooms')
const paymentFeeMode = ref<PaymentFeeMode>('card')
const paymentCustomFeePct = ref(0)
const charges = ref<ReservationCharge[]>([])

const roomsSectionModel = computed({
  get: () => ({
    rooms: rooms.value,
    bookingMode: bookingMode.value,
    paymentFeeMode: paymentFeeMode.value,
    paymentCustomFeePct: paymentCustomFeePct.value,
    charges: charges.value,
  }),
  set: (v) => {
    rooms.value = v.rooms
    bookingMode.value = v.bookingMode
    paymentFeeMode.value = v.paymentFeeMode
    paymentCustomFeePct.value = v.paymentCustomFeePct
    charges.value = v.charges
  },
})

const roomsTotal = computed(() => rooms.value.reduce((sum, r) => sum + r.lineTotal, 0) + charges.value.reduce((sum, c) => sum + c.amount, 0))

watch(roomsTotal, (total) => {
  if (total > 0)
    totalPrice.value = total
})

watch([guestAdults, guestChildren, guestInfants], ([a, c, i]) => {
  const total = a + c + i
  if (total > 0)
    guestCount.value = total
})

const computedNights = computed(() => {
  if (!checkIn.value || !checkOut.value)
    return 0
  return nightsBetween(checkIn.value, checkOut.value)
})

// Notes
const guestNotes = ref('')

const occupants = ref<GuestOccupant[]>([])

// Editing state for a single occupant (null = none being edited)
const editingIndex = ref<number | null>(null)
const editName = ref('')
const editCategory = ref<GuestOccupant['category']>('adult')
const editEmail = ref('')
const editPhone = ref('')
const editDob = ref('')
const editNationality = ref('')
const editIdType = ref<GuestOccupant['idType']>('passport')
const editIdNumber = ref('')
const editIsPrimary = ref(false)

const dialCodes = ['+62', '+41', '+1', '+44', '+61', '+49', '+33', '+31', '+48', '+43', '+65']

const hasPaymentLink = computed(() => Boolean(props.reservation?.paymentRequestId))

const formattedTotal = computed(() => {
  const locale = currency.value === 'IDR' ? 'id-ID' : 'de-CH'
  const digits = currency.value === 'IDR' ? 0 : 2
  return `${currency.value} ${totalPrice.value.toLocaleString(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`
})

watch(() => props.open, (open) => {
  if (open && props.reservation) {
    const r = props.reservation
    checkIn.value = r.checkIn
    checkOut.value = r.checkOut
    dateRange.value = {
      start: parseDateToCalendarDate(r.checkIn),
      end: parseDateToCalendarDate(r.checkOut),
    }
    estimatedArrivalTime.value = r.estimatedArrivalTime ?? ''
    status.value = r.status
    blocksAvailability.value = r.blocksAvailability ?? false
    inquiryExpiryHours.value = r.inquiryExpiryHours ?? 24
    // Fall back to splitting the combined guestName for older records
    const [first = '', ...rest] = (r.guestFirstName ? '' : r.guestName).split(' ')
    guestFirstName.value = r.guestFirstName ?? first
    guestLastName.value = r.guestLastName ?? rest.join(' ')
    const matchedDial = dialCodes.find(code => r.guestPhone?.startsWith(code))
    phoneDialCode.value = matchedDial ?? '+62'
    phoneNumber.value = matchedDial ? r.guestPhone.slice(matchedDial.length).trim() : (r.guestPhone ?? '')
    sendPaymentWhatsApp.value = false
    guestEmail.value = r.guestEmail
    sendPaymentEmail.value = false
    guestAddress.value = r.guestAddress ?? ''
    guestCity.value = r.guestCity ?? ''
    guestZip.value = r.guestZip ?? ''
    guestCountry.value = r.guestCountry ?? ''
    guestCount.value = r.guestCount
    guestAdults.value = r.guestAdults ?? r.guestCount
    guestChildren.value = r.guestChildren ?? 0
    guestInfants.value = r.guestInfants ?? 0
    totalPrice.value = r.totalPrice
    rooms.value = r.rooms?.map(room => ({ ...room })) ?? []
    bookingMode.value = r.bookingMode ?? 'rooms'
    paymentFeeMode.value = r.paymentFeeMode ?? 'card'
    paymentCustomFeePct.value = r.paymentCustomFeePct ?? 0
    charges.value = r.charges?.map(c => ({ ...c })) ?? []
    currency.value = r.currency
    guestNotes.value = r.guestNotes
    occupants.value = r.guests?.map(g => ({ ...g })) ?? []
    editingIndex.value = null
    if (props.focusGuestIndex != null && occupants.value[props.focusGuestIndex]) {
      startEdit(props.focusGuestIndex)
    }
  }
})

const attempted = ref(false)
const errors = computed(() => ({
  checkIn: !checkIn.value,
  checkOut: !checkOut.value || (checkIn.value !== '' && checkOut.value <= checkIn.value),
  firstName: !guestFirstName.value.trim(),
  lastName: !guestLastName.value.trim(),
  email: !guestEmail.value.trim(),
}))
const hasErrors = computed(() => Object.values(errors.value).some(Boolean))

const statusComplete = computed(() => {
  if (!status.value)
    return false
  if (status.value === 'inquiry')
    return inquiryExpiryHours.value > 0
  return true
})

function startEdit(index: number) {
  const g = occupants.value[index]
  if (!g)
    return
  editingIndex.value = index
  editName.value = g.name
  editCategory.value = g.category
  editEmail.value = g.email ?? ''
  editPhone.value = g.phone ?? ''
  editDob.value = g.dob ?? ''
  editNationality.value = g.nationality ?? ''
  editIdType.value = g.idType ?? 'passport'
  editIdNumber.value = g.idNumber ?? ''
  editIsPrimary.value = g.isPrimary ?? false
}

function cancelEdit() {
  editingIndex.value = null
}

function saveOccupant() {
  if (!editName.value.trim()) {
    toast.error('Guest name is required.')
    return
  }
  const occupant: GuestOccupant = {
    id: editingIndex.value !== null ? occupants.value[editingIndex.value]!.id : `occ-${Date.now()}`,
    name: editName.value.trim(),
    category: editCategory.value,
    email: editEmail.value.trim() || undefined,
    phone: editPhone.value.trim() || undefined,
    dob: editDob.value || undefined,
    nationality: editNationality.value.trim() || undefined,
    idType: editIdNumber.value.trim() ? editIdType.value : undefined,
    idNumber: editIdNumber.value.trim() || undefined,
    isPrimary: editIsPrimary.value,
  }
  if (editingIndex.value !== null) {
    occupants.value = occupants.value.map((g, i) => (i === editingIndex.value ? occupant : g))
  }
  else {
    occupants.value = [...occupants.value, occupant]
  }
  guestCount.value = occupants.value.length
  guestAdults.value = occupants.value.length
  editingIndex.value = null
}

function removeOccupant(index: number) {
  occupants.value = occupants.value.filter((_, i) => i !== index)
  guestCount.value = occupants.value.length
  guestAdults.value = occupants.value.length
  if (editingIndex.value === index)
    editingIndex.value = null
}

function save() {
  attempted.value = true
  if (!props.reservation)
    return
  if (hasErrors.value) {
    toast.error('Please fill in all required fields.')
    return
  }

  const guestName = `${guestFirstName.value.trim()} ${guestLastName.value.trim()}`.trim()
  const guestPhone = phoneNumber.value.trim() ? `${phoneDialCode.value} ${phoneNumber.value.trim()}` : ''
  // Only inquiry/verified flow through this editor; other statuses are managed in the detail sheet.
  const statusManagedHere = status.value === 'inquiry' || status.value === 'verified'
  const patch: Partial<ReservationEntry> = {
    checkIn: checkIn.value,
    checkOut: checkOut.value,
    nights: computedNights.value,
    guestName,
    guestEmail: guestEmail.value.trim(),
    guestPhone,
    guestCount: guestCount.value,
    guestAdults: guestAdults.value,
    guestChildren: guestChildren.value,
    guestInfants: guestInfants.value,
    totalPrice: totalPrice.value,
    currency: currency.value,
    ...(statusManagedHere ? { status: status.value } : {}),
    estimatedArrivalTime: estimatedArrivalTime.value || undefined,
    inquiryExpiryHours: status.value === 'inquiry' ? inquiryExpiryHours.value : undefined,
    blocksAvailability: status.value === 'inquiry' ? blocksAvailability.value : undefined,
    guestFirstName: guestFirstName.value.trim(),
    guestLastName: guestLastName.value.trim(),
    guestAddress: guestAddress.value.trim() || undefined,
    guestCity: guestCity.value.trim() || undefined,
    guestZip: guestZip.value.trim() || undefined,
    guestCountry: guestCountry.value || undefined,
    guestNotes: guestNotes.value.trim(),
    guests: occupants.value,
    rooms: rooms.value.length ? rooms.value : undefined,
    bookingMode: rooms.value.length ? bookingMode.value : undefined,
    paymentFeeMode: rooms.value.length ? paymentFeeMode.value : undefined,
    paymentCustomFeePct: paymentFeeMode.value === 'manual' ? paymentCustomFeePct.value : undefined,
    charges: charges.value.length ? charges.value : undefined,
  }

  const channels: string[] = []
  if (!hasPaymentLink.value && (sendPaymentWhatsApp.value || sendPaymentEmail.value)) {
    const request = createRequest({
      guestName,
      guestEmail: guestEmail.value.trim(),
      guestPhone: guestPhone || undefined,
      listingId: props.reservation.listingId,
      title: `Reservation ${props.reservation.id}`,
      amount: totalPrice.value,
      currency: currency.value === 'IDR' ? 'IDR' : 'USD',
      feeMode: paymentFeeMode.value,
      customFeePercentage: paymentFeeMode.value === 'manual' ? paymentCustomFeePct.value : undefined,
      expiresInHours: status.value === 'inquiry' ? inquiryExpiryHours.value : 24,
    })
    patch.paymentRequestId = request.id
    if (sendPaymentWhatsApp.value)
      channels.push('WhatsApp')
    if (sendPaymentEmail.value)
      channels.push('Email')
  }

  updateReservation(props.reservation.id, patch)
  toast.success('Reservation updated')
  if (channels.length)
    toast.info(`Payment link sent via ${channels.join(' and ')} (mock)`)
  attempted.value = false
  emit('update:open', false)
  emit('saved')
}

function categoryLabel(category: string): string {
  const map: Record<string, string> = { adult: 'Adult', child: 'Child', infant: 'Infant' }
  return map[category] ?? category
}
</script>

<template>
  <Sheet :open="open" @update:open="emit('update:open', $event)">
    <SheetContent class="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg" side="right">
      <SheetHeader class="border-b px-6 py-4">
        <SheetTitle>
          Edit Reservation
        </SheetTitle>
        <SheetDescription v-if="reservation">
          {{ reservation.id }} · {{ reservation.guestName }}
        </SheetDescription>
      </SheetHeader>

      <ScrollArea class="h-full min-h-0 flex-1">
        <Accordion type="single" collapsible default-value="basic" class="w-full space-y-2 px-6 py-4">
          <!-- Basic -->
          <AccordionItem value="basic" class="rounded-md border">
            <AccordionTrigger class="px-4 py-3 hover:no-underline">
              <h3 class="text-sm font-semibold">
                Basic
              </h3>
            </AccordionTrigger>
            <AccordionContent class="px-4 pb-4">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div class="space-y-2 sm:col-span-2">
                  <Label>From - To <span class="text-destructive">*</span></Label>
                  <Popover>
                    <PopoverTrigger as-child>
                      <Button
                        variant="outline"
                        class="w-full justify-start text-left font-normal"
                        :class="attempted && errors.checkIn ? 'border-destructive' : ''"
                      >
                        <Icon name="lucide:calendar" class="size-4 mr-2" />
                        <template v-if="dateRange.start">
                          <template v-if="dateRange.end">
                            {{ df.format(dateRange.start.toDate(getLocalTimeZone())) }} - {{ df.format(dateRange.end.toDate(getLocalTimeZone())) }}
                          </template>
                          <template v-else>
                            {{ df.format(dateRange.start.toDate(getLocalTimeZone())) }}
                          </template>
                        </template>
                        <template v-else>
                          Pick a date range
                        </template>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent class="w-auto p-0" align="start">
                      <div class="p-3">
                        <RangeCalendar
                          v-model="dateRange"
                          weekday-format="short"
                          :number-of-months="2"
                          initial-focus
                          :placeholder="dateRange.start"
                          @update:start-value="(startDate: any) => dateRange.start = startDate"
                        />
                        <div class="mt-3 flex items-center justify-between border-t pt-3">
                          <p class="text-xs text-muted-foreground">
                            {{ computedNights ? `${computedNights} nights` : 'Select a date range' }}
                          </p>
                          <Button
                            v-if="dateRange.start"
                            variant="ghost"
                            size="sm"
                            class="h-7 text-xs text-muted-foreground"
                            @click="dateRange = { start: undefined, end: undefined }"
                          >
                            Clear
                          </Button>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                  <p v-if="attempted && errors.checkIn" class="text-xs text-destructive">
                    Check-in date is required.
                  </p>
                  <p v-else-if="attempted && errors.checkOut" class="text-xs text-destructive">
                    Check-out must be after check-in.
                  </p>
                </div>
                <div class="space-y-2">
                  <Label>Property</Label>
                  <Input :model-value="reservation?.listingName ?? ''" disabled />
                </div>
                <div class="space-y-2">
                  <Label>Estimated Arrival Time</Label>
                  <Input v-model="estimatedArrivalTime" type="time" />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          <!-- Status and Source -->
          <AccordionItem value="status" class="rounded-md border">
            <AccordionTrigger class="px-4 py-3 hover:no-underline">
              <span class="flex w-full items-center justify-between gap-3">
                <h3 class="text-sm font-semibold">
                  Status and Source
                </h3>
                <Badge :variant="statusComplete ? 'secondary' : 'outline'" :class="statusComplete ? 'text-green-700 border-green-500/30 bg-green-500/10' : 'text-muted-foreground'">
                  {{ statusComplete ? 'Complete' : 'Incomplete' }}
                </Badge>
              </span>
            </AccordionTrigger>
            <AccordionContent class="px-4 pb-4">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div class="space-y-2">
                  <Label>Status</Label>
                  <Select v-if="status === 'inquiry' || status === 'verified'" v-model="status">
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inquiry">
                        Inquiry
                      </SelectItem>
                      <SelectItem value="verified">
                        Verified
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <Input v-else :model-value="reservationStatusLabels[status]" disabled />
                  <p v-if="status !== 'inquiry' && status !== 'verified'" class="text-xs text-muted-foreground">
                    Managed in the reservation detail.
                  </p>
                </div>
                <div class="space-y-2">
                  <Label>Source</Label>
                  <Input :model-value="reservation?.channel ?? 'Direct'" disabled />
                </div>
                <template v-if="status === 'inquiry'">
                  <div class="space-y-2">
                    <Label>Availability</Label>
                    <Select :model-value="blocksAvailability ? 'block' : 'no_block'" @update:model-value="blocksAvailability = $event === 'block'">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="no_block">
                          Do not block availability
                        </SelectItem>
                        <SelectItem value="block">
                          Block availability
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div class="space-y-2">
                    <Label>Expiry (hours)</Label>
                    <Input v-model.number="inquiryExpiryHours" type="number" min="1" />
                  </div>
                </template>
              </div>
            </AccordionContent>
          </AccordionItem>

          <!-- Contact Details -->
          <AccordionItem value="contact" class="rounded-md border">
            <AccordionTrigger class="px-4 py-3 hover:no-underline">
              <span class="flex w-full items-center justify-between gap-3">
                <h3 class="text-sm font-semibold">
                  Contact Details
                </h3>
                <Badge v-if="hasPaymentLink" variant="secondary" class="text-green-700 border-green-500/30 bg-green-500/10">
                  Payment link created
                </Badge>
              </span>
            </AccordionTrigger>
            <AccordionContent class="px-4 pb-4">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div class="space-y-2">
                  <Label>First Name <span class="text-destructive">*</span></Label>
                  <Input v-model="guestFirstName" placeholder="Enter first name" :class="attempted && errors.firstName ? 'border-destructive' : ''" />
                  <p v-if="attempted && errors.firstName" class="text-xs text-destructive">
                    First name is required.
                  </p>
                </div>
                <div class="space-y-2">
                  <Label>Last Name <span class="text-destructive">*</span></Label>
                  <Input v-model="guestLastName" placeholder="Enter last name" :class="attempted && errors.lastName ? 'border-destructive' : ''" />
                  <p v-if="attempted && errors.lastName" class="text-xs text-destructive">
                    Last name is required.
                  </p>
                </div>
                <div class="space-y-2 sm:col-span-2">
                  <Label>Phone Number</Label>
                  <div class="flex gap-2">
                    <Select v-model="phoneDialCode">
                      <SelectTrigger class="w-24 shrink-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem v-for="code in dialCodes" :key="code" :value="code">
                          {{ code }}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <Input v-model="phoneNumber" type="tel" inputmode="numeric" placeholder="Enter phone number..." class="flex-1" />
                  </div>
                  <div class="flex items-center gap-2 pt-1">
                    <Checkbox
                      :model-value="sendPaymentWhatsApp"
                      :disabled="hasPaymentLink || !phoneNumber.trim()"
                      @update:model-value="sendPaymentWhatsApp = !!$event"
                    />
                    <span class="text-sm" :class="hasPaymentLink || !phoneNumber.trim() ? 'text-muted-foreground' : ''">
                      Send payment link via WhatsApp
                    </span>
                  </div>
                </div>
                <div class="space-y-2 sm:col-span-2">
                  <Label>Email <span class="text-destructive">*</span></Label>
                  <Input v-model="guestEmail" type="email" placeholder="Enter email address" :class="attempted && errors.email ? 'border-destructive' : ''" />
                  <p v-if="attempted && errors.email" class="text-xs text-destructive">
                    Email is required.
                  </p>
                  <div class="flex items-center gap-2 pt-1">
                    <Checkbox
                      :model-value="sendPaymentEmail"
                      :disabled="hasPaymentLink || !guestEmail.trim()"
                      @update:model-value="sendPaymentEmail = !!$event"
                    />
                    <span class="text-sm" :class="hasPaymentLink || !guestEmail.trim() ? 'text-muted-foreground' : ''">
                      Send payment link via Email
                    </span>
                  </div>
                </div>
                <div class="space-y-2 sm:col-span-2">
                  <Label>Address</Label>
                  <Input v-model="guestAddress" placeholder="Enter guest address" />
                </div>
                <div class="space-y-2">
                  <Label>City</Label>
                  <Input v-model="guestCity" placeholder="Enter guest city" />
                </div>
                <div class="space-y-2">
                  <Label>Zip Code</Label>
                  <Input v-model="guestZip" placeholder="Enter guest zip code" />
                </div>
                <div class="space-y-2">
                  <Label>Country</Label>
                  <Select v-model="guestCountry">
                    <SelectTrigger>
                      <SelectValue placeholder="Select a country" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem v-for="c in COUNTRIES" :key="c" :value="c">
                        {{ c }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          <!-- Rooms & Price -->
          <AccordionItem value="price" class="rounded-md border">
            <AccordionTrigger class="px-4 py-3 hover:no-underline">
              <span class="flex w-full items-center justify-between gap-3">
                <h3 class="text-sm font-semibold">
                  Rooms &amp; Price
                </h3>
                <span class="text-sm font-medium">{{ formattedTotal }}</span>
              </span>
            </AccordionTrigger>
            <AccordionContent class="px-4 pb-4">
              <ReservationRoomsSection
                v-model="roomsSectionModel"
                :listing-id="reservation?.listingId ?? ''"
                :check-in="checkIn"
                :check-out="checkOut"
                :nights="computedNights"
                :currency="currency"
                :exclude-reservation-id="reservation?.id ?? ''"
              />
              <div class="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div class="space-y-2 sm:col-span-2">
                  <Label>Guests</Label>
                  <div class="grid grid-cols-3 gap-2">
                    <div class="space-y-1">
                      <Label class="text-[10px] text-muted-foreground">Adults</Label>
                      <Input v-model.number="guestAdults" type="number" min="0" />
                    </div>
                    <div class="space-y-1">
                      <Label class="text-[10px] text-muted-foreground">Children</Label>
                      <Input v-model.number="guestChildren" type="number" min="0" />
                    </div>
                    <div class="space-y-1">
                      <Label class="text-[10px] text-muted-foreground">Infants</Label>
                      <Input v-model.number="guestInfants" type="number" min="0" />
                    </div>
                  </div>
                  <p class="text-xs text-muted-foreground">
                    {{ guestAdults + guestChildren + guestInfants }} total
                  </p>
                </div>
                <div class="space-y-2">
                  <Label>Nights</Label>
                  <Input :model-value="computedNights" disabled />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          <!-- Notes -->
          <AccordionItem value="notes" class="rounded-md border last:border-b">
            <AccordionTrigger class="px-4 py-3 hover:no-underline">
              <span class="flex items-center gap-2">
                <h3 class="text-sm font-semibold">
                  Notes
                </h3>
                <span class="text-xs text-muted-foreground">Optional</span>
              </span>
            </AccordionTrigger>
            <AccordionContent class="px-4 pb-4">
              <Textarea v-model="guestNotes" rows="3" placeholder="Write a note..." />
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <!-- Guests group editor -->
        <div class="space-y-3 border-t px-6 py-4">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-semibold">
              Guests
            </h3>
            <span class="text-xs text-muted-foreground">
              {{ occupants.length }} total
            </span>
          </div>

          <!-- Occupant list -->
          <div v-if="occupants.length" class="space-y-2">
            <div
              v-for="(g, i) in occupants"
              :key="g.id"
              class="flex items-center justify-between gap-2 border bg-muted/20 px-3 py-2"
            >
              <div class="min-w-0">
                <p class="truncate text-sm font-medium">
                  {{ g.name }}
                  <Badge v-if="g.isPrimary" variant="secondary" class="ml-1 text-[9px]">
                    Main
                  </Badge>
                </p>
                <p class="truncate text-xs text-muted-foreground">
                  {{ categoryLabel(g.category) }}
                  <template v-if="g.nationality">
                    · {{ g.nationality }}
                  </template>
                  <template v-if="g.idNumber">
                    · {{ g.idType }}: {{ g.idNumber }}
                  </template>
                </p>
              </div>
              <div class="flex shrink-0 items-center gap-1">
                <Button variant="ghost" size="sm" class="h-7 w-7 p-0" title="Edit" @click="startEdit(i)">
                  <Icon name="lucide:pencil" class="size-3.5" />
                </Button>
                <Button variant="ghost" size="sm" class="h-7 w-7 p-0 hover:text-destructive" title="Remove" @click="removeOccupant(i)">
                  <Icon name="lucide:trash-2" class="size-3.5" />
                </Button>
              </div>
            </div>
          </div>

          <!-- Add / edit occupant form -->
          <div class="rounded-md border p-3">
            <p class="mb-2 text-xs font-medium text-muted-foreground">
              {{ editingIndex !== null ? 'Edit guest' : 'Add guest' }}
            </p>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div class="space-y-1.5">
                <Label class="text-xs">Name</Label>
                <Input v-model="editName" placeholder="Guest name" class="h-8 text-sm" />
              </div>
              <div class="space-y-1.5">
                <Label class="text-xs">Category</Label>
                <Select v-model="editCategory">
                  <SelectTrigger class="h-8 text-sm">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="adult">
                      Adult
                    </SelectItem>
                    <SelectItem value="child">
                      Child
                    </SelectItem>
                    <SelectItem value="infant">
                      Infant
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div class="space-y-1.5">
                <Label class="text-xs">Email</Label>
                <Input v-model="editEmail" placeholder="guest@email.com" class="h-8 text-sm" />
              </div>
              <div class="space-y-1.5">
                <Label class="text-xs">Phone</Label>
                <Input v-model="editPhone" placeholder="+62..." class="h-8 text-sm" />
              </div>
              <div class="space-y-1.5">
                <Label class="text-xs">Date of birth</Label>
                <Input v-model="editDob" type="date" class="h-8 text-sm" />
              </div>
              <div class="space-y-1.5">
                <Label class="text-xs">Nationality</Label>
                <Input v-model="editNationality" placeholder="e.g. Indonesian" class="h-8 text-sm" />
              </div>
              <div class="space-y-1.5">
                <Label class="text-xs">ID type</Label>
                <Select v-model="editIdType">
                  <SelectTrigger class="h-8 text-sm">
                    <SelectValue placeholder="ID type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="passport">
                      Passport
                    </SelectItem>
                    <SelectItem value="id_card">
                      ID Card
                    </SelectItem>
                    <SelectItem value="drivers_license">
                      Driver's License
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div class="space-y-1.5">
                <Label class="text-xs">ID number</Label>
                <Input v-model="editIdNumber" placeholder="ID number" class="h-8 text-sm" />
              </div>
              <div class="flex items-center gap-2 text-sm sm:col-span-2">
                <Checkbox :model-value="editIsPrimary" @update:model-value="editIsPrimary = !!$event" />
                Main guest (booker)
              </div>
            </div>
            <div class="mt-3 flex justify-end gap-2">
              <Button v-if="editingIndex !== null" variant="ghost" size="sm" @click="cancelEdit">
                Cancel
              </Button>
              <Button size="sm" @click="saveOccupant">
                {{ editingIndex !== null ? 'Save guest' : 'Add guest' }}
              </Button>
            </div>
          </div>
        </div>
      </ScrollArea>

      <SheetFooter class="border-t px-6 py-4">
        <Button variant="outline" @click="emit('update:open', false)">
          Cancel
        </Button>
        <Button @click="save">
          Save changes
        </Button>
      </SheetFooter>
    </SheetContent>
  </Sheet>
</template>
