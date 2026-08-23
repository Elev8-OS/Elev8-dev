<script setup lang="ts">
import type { BookingMode, PaymentFeeMode, ReservationCharge, ReservationEntry, ReservationRoomLine, ReservationStatus } from '~/components/reservations/data/reservations'
import { DateFormatter, getLocalTimeZone } from '@internationalized/date'
import { toast } from 'vue-sonner'
import { listings } from '~/components/listings/data/listings'
import { COUNTRIES, nightsBetween } from '~/components/reservations/data/reservations'
import ReservationRoomsSection from '~/components/reservations/ReservationRoomsSection.vue'
import { useReservationsModule } from '~/composables/useReservationsModule'

const props = defineProps<{ open: boolean }>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'created': [reservation: ReservationEntry]
}>()

const { createReservation, updateReservation, reservations } = useReservationsModule()
const { createRequest } = usePaymentRequests()

interface GuestSearchOption {
  id: string
  name: string
  email: string
  phone: string
  firstName?: string
  lastName?: string
  address?: string
  city?: string
  zip?: string
  country?: string
  listingId?: string
  listingName?: string
}

// Guest search
const guestPopoverOpen = ref(false)
const guestSearch = ref('')
const selectedGuest = ref<GuestSearchOption | null>(null)

const guestOptions = computed<GuestSearchOption[]>(() => {
  const seen = new Set<string>()
  const options: GuestSearchOption[] = []
  for (const r of reservations.value) {
    const key = r.guestName.toLowerCase()
    if (!key || key === '—' || seen.has(key))
      continue
    seen.add(key)
    options.push({
      id: r.id,
      name: r.guestName,
      email: r.guestEmail,
      phone: r.guestPhone,
      firstName: r.guestFirstName,
      lastName: r.guestLastName,
      address: r.guestAddress,
      city: r.guestCity,
      zip: r.guestZip,
      country: r.guestCountry,
      listingId: r.listingId,
      listingName: r.listingName,
    })
  }
  return options
})

const filteredGuests = computed(() => {
  const query = guestSearch.value.trim().toLowerCase()
  if (!query)
    return guestOptions.value
  return guestOptions.value.filter(g =>
    g.name.toLowerCase().includes(query)
    || g.email.toLowerCase().includes(query)
    || g.phone.toLowerCase().includes(query),
  )
})

// Basic
const checkIn = ref('')
const checkOut = ref('')
const listingId = ref('')
const estimatedArrivalTime = ref('')

const df = new DateFormatter('en-US', { dateStyle: 'medium' })

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
const totalPrice = ref(0)

// Notes
const guestNotes = ref('')

const guestCount = ref(2)

const dialCodes = ['+62', '+41', '+1', '+44', '+61', '+49', '+33', '+31', '+48', '+43', '+65']

function selectGuest(guest: GuestSearchOption) {
  guestFirstName.value = guest.firstName ?? guest.name.split(' ')[0] ?? ''
  guestLastName.value = guest.lastName ?? guest.name.split(' ').slice(1).join(' ')
  guestEmail.value = guest.email
  const matchedDial = dialCodes.find(code => guest.phone.startsWith(code))
  phoneDialCode.value = matchedDial ?? '+62'
  phoneNumber.value = matchedDial ? guest.phone.slice(matchedDial.length).trim() : guest.phone
  guestAddress.value = guest.address ?? ''
  guestCity.value = guest.city ?? ''
  guestZip.value = guest.zip ?? ''
  guestCountry.value = guest.country ?? ''
  selectedGuest.value = guest
  guestSearch.value = ''
  guestPopoverOpen.value = false
}

const listingOptions = computed(() => listings.value.map(l => ({ id: l.id, name: l.name, location: l.location })))

/** Options for SharedPropertyPicker (keyed by name, with city + region for tag filter). */
const propertyPickerOptions = computed(() =>
  listingOptions.value.map(l => ({
    name: l.name,
    city: l.location,
    region: l.location.includes('Bali') ? 'Bali' : 'Europe',
  })))

const selectedListing = computed(() => listingOptions.value.find(l => l.id === listingId.value))

/** Bali listings bill in IDR, everything else falls back to CHF (tenant currency). */
const currency = computed(() => selectedListing.value?.location?.includes('Bali') ? 'IDR' : 'CHF')

const computedNights = computed(() => {
  if (!checkIn.value || !checkOut.value)
    return 0
  return nightsBetween(checkIn.value, checkOut.value)
})

// Multi-room booking
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

watch(listingId, () => {
  rooms.value = []
  bookingMode.value = 'rooms'
  charges.value = []
})

const formattedTotal = computed(() => {
  const locale = currency.value === 'IDR' ? 'id-ID' : 'de-CH'
  const digits = currency.value === 'IDR' ? 0 : 2
  return `${currency.value} ${totalPrice.value.toLocaleString(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`
})

const basicComplete = computed(() => Boolean(checkIn.value && checkOut.value && listingId.value))
const contactComplete = computed(() => Boolean(guestFirstName.value.trim() && guestLastName.value.trim() && guestEmail.value.trim()))

const attempted = ref(false)
const errors = computed(() => ({
  checkIn: !checkIn.value,
  checkOut: !checkOut.value || (checkIn.value !== '' && checkOut.value <= checkIn.value),
  listing: !listingId.value,
  firstName: !guestFirstName.value.trim(),
  lastName: !guestLastName.value.trim(),
  email: !guestEmail.value.trim(),
}))
const hasErrors = computed(() => Object.values(errors.value).some(Boolean))

function reset() {
  guestPopoverOpen.value = false
  guestSearch.value = ''
  selectedGuest.value = null
  checkIn.value = ''
  checkOut.value = ''
  dateRange.value = { start: undefined, end: undefined }
  listingId.value = ''
  estimatedArrivalTime.value = ''
  status.value = 'inquiry'
  blocksAvailability.value = false
  inquiryExpiryHours.value = 24
  guestFirstName.value = ''
  guestLastName.value = ''
  phoneDialCode.value = '+62'
  phoneNumber.value = ''
  sendPaymentWhatsApp.value = false
  guestEmail.value = ''
  sendPaymentEmail.value = false
  guestAddress.value = ''
  guestCity.value = ''
  guestZip.value = ''
  guestCountry.value = ''
  rooms.value = []
  bookingMode.value = 'rooms'
  paymentFeeMode.value = 'card'
  paymentCustomFeePct.value = 0
  charges.value = []
  totalPrice.value = 0
  guestNotes.value = ''
  guestCount.value = 2
  attempted.value = false
}

function handleSubmit() {
  attempted.value = true
  if (hasErrors.value) {
    toast.error('Please fill in all required fields.')
    return
  }

  const guestName = `${guestFirstName.value.trim()} ${guestLastName.value.trim()}`.trim()
  const guestPhone = phoneNumber.value.trim() ? `${phoneDialCode.value} ${phoneNumber.value.trim()}` : ''
  const result = createReservation({
    guestName,
    guestEmail: guestEmail.value.trim(),
    guestPhone,
    guestLanguage: 'English',
    guestNotes: guestNotes.value.trim(),
    listingId: listingId.value,
    listingName: selectedListing.value?.name ?? listingId.value,
    channel: 'Direct',
    checkIn: checkIn.value,
    checkOut: checkOut.value,
    nights: computedNights.value,
    guestCount: guestCount.value,
    totalPrice: totalPrice.value,
    currency: currency.value,
    status: status.value,
    estimatedArrivalTime: estimatedArrivalTime.value || undefined,
    inquiryExpiryHours: status.value === 'inquiry' ? inquiryExpiryHours.value : undefined,
    blocksAvailability: status.value === 'inquiry' ? blocksAvailability.value : undefined,
    guestFirstName: guestFirstName.value.trim(),
    guestLastName: guestLastName.value.trim(),
    guestAddress: guestAddress.value.trim() || undefined,
    guestCity: guestCity.value.trim() || undefined,
    guestZip: guestZip.value.trim() || undefined,
    guestCountry: guestCountry.value || undefined,
    rooms: rooms.value.length ? rooms.value : undefined,
    bookingMode: rooms.value.length ? bookingMode.value : undefined,
    paymentFeeMode: rooms.value.length ? paymentFeeMode.value : undefined,
    paymentCustomFeePct: paymentFeeMode.value === 'manual' ? paymentCustomFeePct.value : undefined,
    charges: charges.value.length ? charges.value : undefined,
  })
  if (!result.success) {
    toast.error('Please fill in all required fields.')
    return
  }

  const channels: string[] = []
  if ((sendPaymentWhatsApp.value || sendPaymentEmail.value) && result.id) {
    const request = createRequest({
      guestName,
      guestEmail: guestEmail.value.trim(),
      guestPhone: guestPhone || undefined,
      listingId: listingId.value,
      title: `Reservation ${result.id}`,
      amount: totalPrice.value,
      currency: currency.value === 'IDR' ? 'IDR' : 'USD',
      feeMode: paymentFeeMode.value,
      customFeePercentage: paymentFeeMode.value === 'manual' ? paymentCustomFeePct.value : undefined,
      expiresInHours: status.value === 'inquiry' ? inquiryExpiryHours.value : 24,
    })
    updateReservation(result.id, { paymentRequestId: request.id })
    if (sendPaymentWhatsApp.value)
      channels.push('WhatsApp')
    if (sendPaymentEmail.value)
      channels.push('Email')
  }

  toast.success('Reservation created')
  if (channels.length)
    toast.info(`Payment link sent via ${channels.join(' and ')} (mock)`)
  reset()
  emit('update:open', false)
}

watch(() => props.open, (open) => {
  if (!open)
    attempted.value = false
})
</script>

<template>
  <Sheet :open="open" @update:open="emit('update:open', $event)">
    <SheetContent class="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg" side="right">
      <SheetHeader class="border-b px-6 py-4">
        <SheetTitle>
          New Reservation
        </SheetTitle>
        <SheetDescription>
          Create a direct reservation for a guest.
        </SheetDescription>
      </SheetHeader>

      <ScrollArea class="h-full min-h-0 flex-1">
        <Accordion type="single" collapsible default-value="basic" class="w-full space-y-2 px-6 py-4">
          <!-- Basic -->
          <AccordionItem value="basic" class="rounded-md border">
            <AccordionTrigger class="px-4 py-3 hover:no-underline">
              <span class="flex w-full items-center justify-between gap-3">
                <h3 class="text-sm font-semibold">
                  Basic
                </h3>
                <Badge :variant="basicComplete ? 'secondary' : 'outline'" :class="basicComplete ? 'text-green-700 border-green-500/30 bg-green-500/10' : 'text-muted-foreground'">
                  {{ basicComplete ? 'Complete' : 'Incomplete' }}
                </Badge>
              </span>
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
                  <Label>Select Property <span class="text-destructive">*</span></Label>
                  <SharedPropertyPicker
                    :model-value="listingId ? [selectedListing?.name ?? ''] : []"
                    :options="propertyPickerOptions"
                    :multi-select="false"
                    @update:model-value="(names: string[]) => { listingId = names[0] ? listingOptions.find(l => l.name === names[0])?.id ?? '' : '' }"
                  />
                  <p v-if="attempted && errors.listing" class="text-xs text-destructive">
                    Property is required.
                  </p>
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
              <h3 class="text-sm font-semibold">
                Status and Source
              </h3>
            </AccordionTrigger>
            <AccordionContent class="px-4 pb-4">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div class="space-y-2">
                  <Label>Status</Label>
                  <Select v-model="status">
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
                </div>
                <div class="space-y-2">
                  <Label>Source</Label>
                  <Input model-value="Direct" disabled />
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
                <Badge :variant="contactComplete ? 'secondary' : 'outline'" :class="contactComplete ? 'text-green-700 border-green-500/30 bg-green-500/10' : 'text-muted-foreground'">
                  {{ contactComplete ? 'Complete' : 'Incomplete' }}
                </Badge>
              </span>
            </AccordionTrigger>
            <AccordionContent class="px-4 pb-4">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div class="space-y-2 sm:col-span-2">
                  <Label>Search Guest</Label>
                  <Popover v-model:open="guestPopoverOpen">
                    <PopoverTrigger as-child>
                      <Button variant="outline" class="w-full justify-between">
                        {{ selectedGuest?.name || 'Search guest...' }}
                        <Icon name="lucide:chevrons-up-down" class="size-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent class="w-[380px] p-0" align="start">
                      <Command>
                        <CommandInput v-model="guestSearch" placeholder="Search guest by name or email..." />
                        <CommandList>
                          <CommandEmpty v-if="!guestSearch.trim()">
                            Type to search guests...
                          </CommandEmpty>
                          <CommandEmpty v-else>
                            No guest found.
                          </CommandEmpty>
                          <CommandGroup heading="Previous Guests">
                            <CommandItem
                              v-for="guest in filteredGuests"
                              :key="guest.id"
                              :value="guest.name"
                              class="cursor-pointer"
                              @select="selectGuest(guest)"
                            >
                              <div class="flex items-center gap-2">
                                <div class="flex size-6 items-center justify-center rounded-full bg-muted text-[10px]">
                                  {{ guest.name.charAt(0) }}
                                </div>
                                <div class="min-w-0">
                                  <p class="text-sm font-medium">
                                    {{ guest.name }}
                                  </p>
                                  <p class="text-xs text-muted-foreground">
                                    {{ guest.email }}
                                  </p>
                                </div>
                              </div>
                            </CommandItem>
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <p v-if="selectedGuest" class="text-xs text-green-700">
                    Guest details auto-filled.
                  </p>
                  <p v-else class="text-xs text-muted-foreground">
                    Select a previous guest to auto-fill their contact details.
                  </p>
                </div>
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
                      :disabled="!phoneNumber.trim()"
                      @update:model-value="sendPaymentWhatsApp = !!$event"
                    />
                    <span class="text-sm" :class="!phoneNumber.trim() ? 'text-muted-foreground' : ''">
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
                      :disabled="!guestEmail.trim()"
                      @update:model-value="sendPaymentEmail = !!$event"
                    />
                    <span class="text-sm" :class="!guestEmail.trim() ? 'text-muted-foreground' : ''">
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
                <div class="space-y-2">
                  <Label>Guests</Label>
                  <Input v-model.number="guestCount" type="number" min="1" />
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
                :listing-id="listingId"
                :check-in="checkIn"
                :check-out="checkOut"
                :nights="computedNights"
                :currency="currency"
              />
              <div class="mt-3 rounded-md border bg-muted/40 p-3 text-sm">
                <div class="flex items-center justify-between">
                  <span class="text-muted-foreground">Nights</span>
                  <span class="font-medium">{{ computedNights }}</span>
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
      </ScrollArea>

      <SheetFooter class="border-t px-6 py-4">
        <Button variant="outline" @click="emit('update:open', false)">
          Cancel
        </Button>
        <Button @click="handleSubmit">
          Create Reservation
        </Button>
      </SheetFooter>
    </SheetContent>
  </Sheet>
</template>
