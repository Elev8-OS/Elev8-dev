<script setup lang="ts">
import type { DateValue } from '@internationalized/date'
import type { BookingMode, ExtensionDirection, ExtensionPaymentMethod, PaymentFeeMode, ReservationCharge, ReservationEntry, ReservationRoomLine } from '~/components/reservations/data/reservations'
import type { ExtensionPricing } from '~/composables/useReservationsModule'
import type { GuestMessageChannel } from '~/composables/useStayExtension'
import { getLocalTimeZone, parseDate, today } from '@internationalized/date'
import { toast } from 'vue-sonner'
import { billableChargesTotal } from '~/components/reservations/data/reservations'
import ReservationRoomsSection from '~/components/reservations/ReservationRoomsSection.vue'
import { NON_EARLY_ARRIVAL_STATUSES, useReservationsModule } from '~/composables/useReservationsModule'
import { LINK_EXPIRY_OPTIONS, PAYMENT_LINK_TOKEN, savedCardFor, useStayExtension } from '~/composables/useStayExtension'

// Three steps: which way (later check-out or earlier arrival), when and at what rate, how the guest pays, then a review of
// everything the extension touches (cleaning, door codes, city tax) with the
// message the guest will get. All writes happen in useStayExtension on confirm.
const props = defineProps<{
  reservation: ReservationEntry | null
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const { defaultNightlyRate, earlyArrivalEnd, getExtensionConflicts } = useReservationsModule()
const { preview, confirmExtension, defaultExtensionMessage, formatSavedCard } = useStayExtension()

type Step = 'dates' | 'payment' | 'review'
const STEPS: { id: Step, label: string }[] = [
  { id: 'dates', label: 'Dates & price' },
  { id: 'payment', label: 'Payment' },
  { id: 'review', label: 'Review' },
]
const QUICK_NIGHTS = [1, 2, 3, 7]
const DIRECTION_OPTIONS: { id: ExtensionDirection, label: string, icon: string }[] = [
  { id: 'after', label: 'Stay longer', icon: 'lucide:log-out' },
  { id: 'before', label: 'Arrive earlier', icon: 'lucide:log-in' },
]

const step = ref<Step>('dates')
const direction = ref<ExtensionDirection>('after')
/** The new check-out, or for an early arrival the new check-in. */
const newDate = ref('')
/** What the New Reservation pricing section edits: rooms and rates, taxes and fees, the payment charge. */
interface PricingModel { rooms: ReservationRoomLine[], bookingMode: BookingMode, paymentFeeMode: PaymentFeeMode, paymentCustomFeePct: number, charges: ReservationCharge[] }
const pricingModel = ref<PricingModel>({ rooms: [], bookingMode: 'rooms', paymentFeeMode: 'card', paymentCustomFeePct: 3, charges: [] })
const calendarOpen = ref(false)
const method = ref<ExtensionPaymentMethod>('payment_link')
const linkExpiry = ref(24)
const blockNights = ref(true)
const extraAdults = ref(0)
const extraChildren = ref(0)
const extraInfants = ref(0)
const notifyGuest = ref(true)
const guestChannels = ref<GuestMessageChannel[]>([])
const message = ref('')
const messageEdited = ref(false)
const saving = ref(false)

const savedCard = computed(() => props.reservation ? savedCardFor(props.reservation) : undefined)

const isBefore = computed(() => direction.value === 'before')

/** The stay's own rooms and rates for the first added night; the section re-prices them as the nights change. */
function seedPricing(r: ReservationEntry): PricingModel {
  const perNight = (r.rooms ?? []).filter(l => (l.priceMode ?? 'per_night') === 'per_night').map(l => ({ ...l, lineTotal: l.pricePerNight }))
  const wholeLine: ReservationRoomLine = {
    id: 'room-entire-property',
    unitTypeId: `${r.listingId}-whole`,
    unitId: `${r.listingId}-whole`,
    unitName: r.listingName,
    ratePlanId: 'entire',
    rateLabel: 'Entire property',
    pricePerNight: defaultNightlyRate(r),
    lineTotal: defaultNightlyRate(r),
  }
  const hasRooms = Boolean(r.rooms?.length)
  return {
    rooms: hasRooms ? perNight : [wholeLine],
    bookingMode: hasRooms ? 'rooms' : 'entire_property',
    paymentFeeMode: 'card',
    paymentCustomFeePct: 3,
    charges: [],
  }
}

const pricing = computed<ExtensionPricing>(() => ({
  rooms: pricingModel.value.rooms,
  // A stay that had no room lines stays without them, priced by the one line.
  asRooms: Boolean(props.reservation?.rooms?.length) || pricingModel.value.bookingMode === 'rooms',
  bookingMode: pricingModel.value.bookingMode,
  charges: pricingModel.value.charges,
}))

const view = computed(() => props.reservation && newDate.value
  ? preview(props.reservation, newDate.value, undefined, direction.value, pricing.value)
  : null)
const quote = computed(() => view.value?.quote ?? null)
const isLinked = computed(() => view.value?.mode === 'linked_booking')
const isDirect = computed(() => props.reservation?.channel === 'Direct')
/** The boundary that moves: the current check-out, or the current check-in. */
const anchor = computed(() => view.value?.anchor ?? (isBefore.value ? props.reservation?.checkIn : props.reservation?.checkOut) ?? '')

const todayDate = computed(() => today(getLocalTimeZone()))

/** Early arrival is open until the guest is in, with at least tonight still free to add. */
const canArriveEarly = computed(() => {
  const r = props.reservation
  if (!r || NON_EARLY_ARRIVAL_STATUSES.includes(r.status))
    return false
  return parseDate(earlyArrivalEnd(r)).compare(todayDate.value) > 0
})

function initialDate(r: ReservationEntry, dir: ExtensionDirection): string {
  return dir === 'before'
    ? parseDate(earlyArrivalEnd(r)).subtract({ days: 1 }).toString()
    : parseDate(preview(r, r.checkOut).from).add({ days: 1 }).toString()
}

function setDirection(dir: ExtensionDirection) {
  if (!props.reservation || direction.value === dir)
    return
  direction.value = dir
  newDate.value = initialDate(props.reservation, dir)
  calendarOpen.value = false
}

watch(() => props.open, (open) => {
  if (open && props.reservation) {
    step.value = 'dates'
    direction.value = 'after'
    newDate.value = initialDate(props.reservation, 'after')
    pricingModel.value = seedPricing(props.reservation)
    calendarOpen.value = false
    method.value = 'payment_link'
    linkExpiry.value = 24
    blockNights.value = true
    extraAdults.value = 0
    extraChildren.value = 0
    extraInfants.value = 0
    notifyGuest.value = true
    guestChannels.value = defaultChannels(props.reservation)
    message.value = ''
    messageEdited.value = false
    saving.value = false
  }
})

// Later check-out: from the night after the current one. Earlier arrival:
// from today up to the night before the current check-in.
const minDate = computed(() => {
  if (!anchor.value)
    return undefined
  return isBefore.value ? todayDate.value : parseDate(anchor.value).add({ days: 1 })
})
const maxDate = computed(() => isBefore.value && anchor.value ? parseDate(anchor.value).subtract({ days: 1 }) : undefined)

const calendarValue = computed<DateValue | undefined>({
  get: () => newDate.value ? parseDate(newDate.value) : undefined,
  set: (val) => {
    if (val) {
      newDate.value = val.toString()
      calendarOpen.value = false
    }
  },
})

/** A date is out when another stay holds any of the nights the extension would add. */
function isUnavailable(iso: string): boolean {
  return Boolean(props.reservation) && getExtensionConflicts(props.reservation!.id, iso, direction.value).length > 0
}

function isDateUnavailable(date: DateValue): boolean {
  return isUnavailable(date.toString())
}

function quickDate(n: number): string {
  const base = parseDate(anchor.value)
  return (isBefore.value ? base.subtract({ days: n }) : base.add({ days: n })).toString()
}

/** An early arrival cannot start in the past. */
function quickDisabled(n: number): boolean {
  if (!anchor.value)
    return false
  return (isBefore.value && parseDate(quickDate(n)).compare(todayDate.value) < 0) || isUnavailable(quickDate(n))
}

function addNights(n: number) {
  if (anchor.value && !quickDisabled(n))
    newDate.value = quickDate(n)
}

const datesValid = computed(() => Boolean(quote.value && quote.value.extraNights > 0 && !view.value?.conflicts.length))

const PAYMENT_OPTIONS = computed(() => [
  {
    id: 'payment_link' as const,
    icon: 'lucide:link',
    label: 'Send payment link',
    hint: 'The guest pays online. The link is valid for 24 hours.',
    disabled: false,
  },
  {
    id: 'saved_card' as const,
    icon: 'lucide:credit-card',
    label: 'Charge saved card',
    hint: savedCard.value ? formatSavedCard(savedCard.value) : 'No card saved on this stay',
    disabled: !savedCard.value,
  },
  {
    id: 'at_property' as const,
    icon: 'lucide:hand-coins',
    label: 'Collect at the property',
    hint: 'Stays outstanding until you mark it paid.',
    disabled: false,
  },
  {
    id: 'already_paid' as const,
    icon: 'lucide:circle-check',
    label: 'Already paid',
    hint: 'Bank transfer or cash already received.',
    disabled: false,
  },
])

/** Paid at confirm (saved card, already paid): door codes move now. Otherwise when it is marked paid. */
const paidNow = computed(() => method.value === 'saved_card' || method.value === 'already_paid')

const methodLabel = computed(() => PAYMENT_OPTIONS.value.find(o => o.id === method.value)?.label ?? '')

/** The night picked for the cleaning; falls back to the first added night when the range moves. */
const midstayDate = ref('')
const addedNights = computed(() => {
  const v = view.value
  if (!v)
    return []
  const out: string[] = []
  for (let d = parseDate(v.from); d.toString() < v.to; d = d.add({ days: 1 }))
    out.push(d.toString())
  return out
})
const midstayDay = computed(() => addedNights.value.includes(midstayDate.value) ? midstayDate.value : (addedNights.value[0] ?? ''))

const MIDSTAY_ID = 'chg-midstay-cleaning'
/** The mid-stay cleaning charge, kept in the section's charges so it shows up in Taxes & fees too. */
const midstay = computed(() => pricingModel.value.charges.find(c => c.id === MIDSTAY_ID))

function setMidstay(on: boolean) {
  const others = pricingModel.value.charges.filter(c => c.id !== MIDSTAY_ID)
  const charge: ReservationCharge = { id: MIDSTAY_ID, kind: 'cleaning', label: 'Mid-stay cleaning', amount: props.reservation?.priceDetails?.cleaningFee ?? 0 }
  pricingModel.value = { ...pricingModel.value, charges: on ? [...others, charge] : others }
}

function setMidstayAmount(value: string | number) {
  pricingModel.value = {
    ...pricingModel.value,
    charges: pricingModel.value.charges.map(c => c.id === MIDSTAY_ID ? { ...c, amount: Math.max(Number(value) || 0, 0) } : c),
  }
}

const chargesTotal = computed(() => billableChargesTotal(pricingModel.value.charges))
/** Nights plus taxes and fees: what the guest is billed, before any payment charge. */
const payable = computed(() => (quote.value?.amount ?? 0) + chargesTotal.value)

const feePercent = computed(() => pricingModel.value.paymentFeeMode === 'card' ? 3 : pricingModel.value.paymentFeeMode === 'manual' ? Math.min(Math.max(Number(pricingModel.value.paymentCustomFeePct) || 0, 0), 100) : 0)
const feeAmount = computed(() => quote.value && method.value === 'payment_link'
  ? Math.round(payable.value * feePercent.value) / 100
  : 0)

const GUEST_ROWS = [
  { key: 'adults', label: 'Adults', ref: extraAdults },
  { key: 'children', label: 'Children', ref: extraChildren },
  { key: 'infants', label: 'Infants', ref: extraInfants },
] as const
const extraGuestTotal = computed(() => extraAdults.value + extraChildren.value + extraInfants.value)

const guestPaysLine = computed(() => {
  if (!quote.value)
    return ''
  const total = `Guest pays ${fmtMoney(payable.value + feeAmount.value)}`
  return feeAmount.value ? `${total}, including ${fmtMoney(feeAmount.value)} card fee.` : `${total}.`
})

function freshMessage(): string {
  if (!props.reservation || !quote.value || !view.value)
    return ''
  return defaultExtensionMessage(props.reservation, {
    checkOut: newDate.value,
    direction: direction.value,
    quote: { ...quote.value, amount: payable.value },
    mode: view.value.mode,
    method: method.value,
    codesExtended: view.value.codesToExtend,
  })
}

function goTo(next: Step) {
  // Rebuilt on every visit until staff type in it, so a changed date or
  // payment method never leaves a stale message behind.
  if (next === 'review' && !messageEdited.value)
    message.value = freshMessage()
  step.value = next
}

function onMessageInput(value: string | number) {
  message.value = String(value)
  messageEdited.value = true
}

function resetMessage() {
  messageEdited.value = false
  message.value = freshMessage()
}

/** Email when the guest has one, else WhatsApp. */
function defaultChannels(r: ReservationEntry): GuestMessageChannel[] {
  return r.guestEmail?.trim() ? ['email'] : r.guestPhone?.trim() ? ['whatsapp'] : []
}

const CHANNEL_OPTIONS = computed(() => [
  { id: 'email' as const, icon: 'lucide:mail', label: 'Email', disabled: !props.reservation?.guestEmail?.trim() },
  { id: 'whatsapp' as const, icon: 'lucide:message-circle', label: 'WhatsApp', disabled: !props.reservation?.guestPhone?.trim() },
])

function toggleChannel(id: GuestMessageChannel) {
  guestChannels.value = guestChannels.value.includes(id)
    ? guestChannels.value.filter(c => c !== id)
    : [...guestChannels.value, id]
}

const stepIndex = computed(() => STEPS.findIndex(s => s.id === step.value))

const canConfirm = computed(() => datesValid.value
  && !saving.value
  && !(method.value === 'saved_card' && !savedCard.value)
  && !(notifyGuest.value && (!message.value.trim() || !guestChannels.value.length)))

function fmtDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtMoney(amount: number, currency = props.reservation?.currency ?? 'USD'): string {
  const locale = currency === 'CHF' ? 'de-CH' : 'en-US'
  const digits = currency === 'IDR' ? 0 : 2
  return `${currency} ${amount.toLocaleString(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

async function confirm() {
  if (!props.reservation || !canConfirm.value)
    return
  saving.value = true
  // Read before saving: once the nights are booked, the live quote drops to 0.
  const n = quote.value?.extraNights ?? 0
  const result = await confirmExtension({
    reservationId: props.reservation.id,
    direction: direction.value,
    ...(isBefore.value ? { checkIn: newDate.value } : { checkOut: newDate.value }),
    pricing: pricing.value,
    ...(midstay.value && midstayDay.value ? { midstayCleaning: { date: midstayDay.value } } : {}),
    extraGuests: { adults: extraAdults.value, children: extraChildren.value, infants: extraInfants.value },
    payment: { method: method.value, feeMode: pricingModel.value.paymentFeeMode, expiresInHours: linkExpiry.value, blocksAvailability: blockNights.value, ...(pricingModel.value.paymentFeeMode === 'manual' ? { customFeePercentage: feePercent.value } : {}) },
    guestMessage: notifyGuest.value ? message.value : '',
    guestChannels: guestChannels.value,
  })
  saving.value = false
  if (!result.success) {
    toast.error(result.error ?? 'Could not extend the stay.')
    return
  }
  const details = [
    result.linkedReservationId ? `Direct booking ${result.linkedReservationId} created` : '',
    result.paymentLink ? 'payment link sent' : '',
    result.cleaningsAdded ? 'cleaning scheduled' : '',
    result.guestNotified ? 'guest notified' : '',
  ].filter(Boolean).join(', ')
  toast.success(isBefore.value ? `Arrival moved ${plural(n, 'night')} earlier` : `Stay extended by ${plural(n, 'night')}`, details ? { description: details.charAt(0).toUpperCase() + details.slice(1) } : undefined)
  emit('update:open', false)
}
</script>

<template>
  <Sheet :open="open" @update:open="emit('update:open', $event)">
    <SheetContent class="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg" side="right">
      <SheetHeader class="border-b px-6 py-4">
        <SheetTitle>Extend reservation</SheetTitle>
        <SheetDescription v-if="reservation">
          {{ reservation.id }} · {{ reservation.guestName }}
        </SheetDescription>
      </SheetHeader>

      <!-- Step indicator -->
      <ol class="flex items-center gap-2 border-b px-6 py-3 text-xs" data-testid="extend-steps">
        <li v-for="(s, i) in STEPS" :key="s.id" class="flex items-center gap-2">
          <span
            class="flex size-5 items-center justify-center rounded-full border text-[10px] font-medium"
            :class="i < stepIndex ? 'border-primary bg-primary text-primary-foreground' : i === stepIndex ? 'border-primary text-primary' : 'text-muted-foreground'"
          >
            <Icon v-if="i < stepIndex" name="lucide:check" class="size-3" />
            <template v-else>{{ i + 1 }}</template>
          </span>
          <span :class="i === stepIndex ? 'font-medium' : 'text-muted-foreground'">{{ s.label }}</span>
          <Icon v-if="i < STEPS.length - 1" name="lucide:chevron-right" class="size-3.5 text-muted-foreground" />
        </li>
      </ol>

      <ScrollArea v-if="reservation" class="h-full min-h-0 flex-1">
        <div class="space-y-4 px-6 py-4">
          <!-- Step 1: dates and price -->
          <template v-if="step === 'dates'">
            <div v-if="canArriveEarly" class="grid grid-cols-2 gap-1 rounded-md bg-muted p-1" role="radiogroup" aria-label="Extend direction" data-testid="extend-direction">
              <button
                v-for="option in DIRECTION_OPTIONS"
                :key="option.id"
                type="button"
                role="radio"
                :aria-checked="direction === option.id"
                :data-testid="`extend-direction-${option.id}`"
                class="flex items-center justify-center gap-2 rounded-sm px-3 py-1.5 text-sm font-medium transition-colors"
                :class="direction === option.id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'"
                @click="setDirection(option.id)"
              >
                <Icon :name="option.icon" class="size-4" />
                {{ option.label }}
              </button>
            </div>

            <div class="grid grid-cols-2 gap-3 rounded-md border bg-muted/40 p-3 text-sm">
              <div>
                <p class="text-xs text-muted-foreground">
                  {{ isBefore ? 'Current check-in' : 'Current check-out' }}
                </p>
                <p class="font-medium">
                  {{ fmtDate(anchor) }}
                </p>
              </div>
              <div>
                <p class="text-xs text-muted-foreground">
                  Current stay
                </p>
                <p class="font-medium">
                  {{ plural(reservation.nights, 'night') }}
                </p>
              </div>
            </div>

            <Alert v-if="isLinked" data-testid="extend-ota-notice">
              <Icon name="lucide:link-2" class="size-4" />
              <AlertTitle>{{ isDirect ? 'Added as a linked booking' : `Booked on ${reservation.channel}` }}</AlertTitle>
              <AlertDescription v-if="isDirect">
                The reservation stays unchanged. The extra nights {{ isBefore ? 'before it ' : '' }}become a new booking linked to it, with its own price and payment.
              </AlertDescription>
              <AlertDescription v-else>
                The {{ reservation.channel }} reservation stays unchanged. The extra nights {{ isBefore ? 'before it ' : '' }}become a direct booking linked to it, billed by you.
              </AlertDescription>
            </Alert>

            <div class="space-y-2">
              <Label>{{ isBefore ? 'New check-in' : 'New check-out' }}</Label>
              <div class="flex flex-wrap gap-2">
                <Button
                  v-for="n in QUICK_NIGHTS"
                  :key="n"
                  type="button"
                  size="sm"
                  :variant="quote?.extraNights === n ? 'default' : 'outline'"
                  :disabled="quickDisabled(n)"
                  class="h-8"
                  @click="addNights(n)"
                >
                  {{ isBefore ? `${plural(n, 'night')} earlier` : `+${plural(n, 'night')}` }}
                </Button>
              </div>
              <Popover v-model:open="calendarOpen">
                <PopoverTrigger as-child>
                  <Button variant="outline" class="w-full justify-start font-normal">
                    <Icon name="lucide:calendar" class="mr-2 size-4" />
                    {{ newDate ? fmtDate(newDate) : 'Pick a date' }}
                  </Button>
                </PopoverTrigger>
                <PopoverContent class="w-auto p-0" align="start">
                  <Calendar v-model="calendarValue" :min-value="minDate" :max-value="maxDate" :is-date-unavailable="isDateUnavailable" class="[&_[data-unavailable]]:bg-destructive/10 [&_[data-unavailable]]:text-destructive [&_[data-unavailable]]:line-through [&_[data-unavailable]]:opacity-60" initial-focus />
                  <p class="w-0 min-w-full border-t px-3 py-2 text-xs text-muted-foreground">
                    Struck-through dates are not available: another stay holds a night in between.
                  </p>
                </PopoverContent>
              </Popover>
            </div>

            <div class="space-y-2" data-testid="extend-guests">
              <Label>Guests for the extra nights</Label>
              <p class="text-xs text-muted-foreground">
                Currently {{ plural(reservation.guestCount, 'guest') }}. Add anyone joining for the added nights.
              </p>
              <div class="grid grid-cols-3 gap-2">
                <div v-for="row in GUEST_ROWS" :key="row.key" class="flex items-center justify-between rounded-md border p-2">
                  <span class="text-sm">{{ row.label }}</span>
                  <div class="flex items-center gap-1.5">
                    <Button type="button" variant="outline" size="icon" class="size-6" :aria-label="`Fewer ${row.label.toLowerCase()}`" :disabled="row.ref.value <= 0" @click="row.ref.value--">
                      <Icon name="lucide:minus" class="size-3" />
                    </Button>
                    <span class="w-4 text-center text-sm tabular-nums">{{ row.ref.value }}</span>
                    <Button type="button" variant="outline" size="icon" class="size-6" :aria-label="`More ${row.label.toLowerCase()}`" @click="row.ref.value++">
                      <Icon name="lucide:plus" class="size-3" />
                    </Button>
                  </div>
                </div>
              </div>
              <p v-if="extraGuestTotal" class="text-xs text-muted-foreground">
                The extension booking will have {{ plural(reservation.guestCount + extraGuestTotal, 'guest') }}.
              </p>
            </div>

            <div class="space-y-2 rounded-md border p-3" data-testid="extend-cleaning">
              <div class="flex items-center justify-between gap-3">
                <Label for="extend-cleaning-switch" class="text-sm">Charge a mid-stay cleaning fee</Label>
                <Switch id="extend-cleaning-switch" :model-value="Boolean(midstay)" @update:model-value="setMidstay(Boolean($event))" />
              </div>
              <div v-if="midstay" class="space-y-2">
                <Label class="text-xs text-muted-foreground">Cleaning day (a job is scheduled for housekeeping)</Label>
                <Select :model-value="midstayDay" @update:model-value="midstayDate = String($event)">
                  <SelectTrigger data-testid="extend-cleaning-day">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem v-for="d in addedNights" :key="d" :value="d">
                      {{ fmtDate(d) }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div v-if="midstay" class="relative">
                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">{{ reservation.currency }}</span>
                <Input :model-value="midstay.amount" type="number" min="0" class="pl-14" aria-label="Mid-stay cleaning fee" data-testid="extend-cleaning-fee" @update:model-value="setMidstayAmount($event)" />
              </div>
            </div>

            <div v-if="view && quote && quote.extraNights > 0" class="space-y-2" data-testid="extend-pricing">
              <Label>Rooms &amp; price</Label>
              <ReservationRoomsSection
                v-model="pricingModel"
                :listing-id="reservation.listingId"
                :check-in="view.from"
                :check-out="view.to"
                :nights="quote.extraNights"
                :currency="reservation.currency"
                :exclude-reservation-id="reservation.id"
                :auto-import-fees="false"
                fee-base="all"
              />
            </div>

            <Alert v-if="view?.conflicts.length" variant="destructive">
              <Icon name="lucide:calendar-x" class="size-4" />
              <AlertTitle>Not available</AlertTitle>
              <AlertDescription>
                <p v-for="c in view.conflicts" :key="c.id">
                  {{ c.guestName }} is booked {{ fmtDate(c.checkIn) }} to {{ fmtDate(c.checkOut) }}.
                </p>
              </AlertDescription>
            </Alert>
          </template>

          <!-- Step 2: payment -->
          <template v-else-if="step === 'payment' && quote">
            <div class="flex items-center justify-between rounded-md border bg-muted/40 p-3 text-sm">
              <span class="text-muted-foreground">Amount for {{ plural(quote.extraNights, 'night') }}</span>
              <span class="font-semibold">{{ fmtMoney(payable) }}</span>
            </div>

            <div class="space-y-2" role="radiogroup" aria-label="Payment method">
              <button
                v-for="option in PAYMENT_OPTIONS"
                :key="option.id"
                type="button"
                role="radio"
                :aria-checked="method === option.id"
                :disabled="option.disabled"
                :data-testid="`extend-pay-${option.id}`"
                class="flex w-full items-start gap-3 rounded-md border p-3 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                :class="method === option.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'"
                @click="method = option.id"
              >
                <Icon :name="option.icon" class="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span class="min-w-0 flex-1">
                  <span class="block font-medium">{{ option.label }}</span>
                  <span class="block text-xs text-muted-foreground">{{ option.hint }}</span>
                </span>
                <span
                  class="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border"
                  :class="method === option.id ? 'border-primary' : 'border-input'"
                >
                  <span v-if="method === option.id" class="size-2 rounded-full bg-primary" />
                </span>
              </button>
            </div>

            <div v-if="method === 'payment_link'" class="space-y-2">
              <p class="text-xs text-muted-foreground">
                {{ guestPaysLine }}
              </p>
              <div class="grid grid-cols-2 gap-3">
                <div class="space-y-2">
                  <Label>Link valid for</Label>
                  <Select :model-value="String(linkExpiry)" @update:model-value="linkExpiry = Number($event)">
                    <SelectTrigger data-testid="extend-link-expiry">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem v-for="h in LINK_EXPIRY_OPTIONS" :key="h" :value="String(h)">
                        {{ plural(h, 'hour') }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div class="space-y-2">
                  <Label>Availability</Label>
                  <Select :model-value="blockNights ? 'block' : 'no_block'" @update:model-value="blockNights = $event === 'block'">
                    <SelectTrigger data-testid="extend-link-block">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="block">
                        Block availability
                      </SelectItem>
                      <SelectItem value="no_block">
                        Do not block availability
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p v-if="isLinked" class="text-xs text-muted-foreground">
                {{ reservation.channel }} may hide links to off-platform payments in its messages. The link also stays on Payment requests.
              </p>
            </div>
          </template>

          <!-- Step 3: review -->
          <template v-else-if="step === 'review' && quote && view">
            <dl class="space-y-2 rounded-md border p-3 text-sm">
              <div class="flex justify-between gap-3">
                <dt class="text-muted-foreground">
                  Dates
                </dt>
                <dd class="text-right">
                  {{ fmtDate(view.from) }} to {{ fmtDate(view.to) }} · +{{ plural(quote.extraNights, 'night') }}
                </dd>
              </div>
              <div class="flex justify-between gap-3">
                <dt class="text-muted-foreground">
                  Booking
                </dt>
                <dd class="text-right">
                  {{ isLinked ? `New direct booking, linked to ${reservation.id}` : `${isBefore ? 'Check-in' : 'Check-out'} of ${reservation.id} moves` }}
                </dd>
              </div>
              <div class="flex justify-between gap-3">
                <dt class="text-muted-foreground">
                  Amount
                </dt>
                <dd class="text-right font-medium">
                  {{ fmtMoney(payable) }}{{ chargesTotal ? ` (incl. ${fmtMoney(chargesTotal)} taxes & fees)` : '' }} · {{ methodLabel }}
                </dd>
              </div>
              <div v-if="extraGuestTotal" class="flex justify-between gap-3">
                <dt class="text-muted-foreground">
                  Guests
                </dt>
                <dd class="text-right">
                  {{ plural(reservation.guestCount + extraGuestTotal, 'guest') }} (+{{ extraGuestTotal }})
                </dd>
              </div>
            </dl>

            <div class="space-y-2">
              <p class="text-xs font-medium text-muted-foreground">
                What else changes
              </p>
              <ul class="space-y-2 text-sm" data-testid="extend-effects">
                <li class="flex items-start gap-2">
                  <Icon name="lucide:brush-cleaning" class="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <span v-if="isBefore" class="text-muted-foreground">Check-out cleaning stays on {{ fmtDate(reservation.checkOut) }}. Have the house ready by {{ fmtDate(newDate) }}</span>
                  <span v-else-if="view.cleaningsToMove">Check-out cleaning moves to {{ fmtDate(newDate) }}</span>
                  <span v-else class="text-muted-foreground">No check-out cleaning is booked on {{ fmtDate(view.from) }}</span>
                </li>
                <li class="flex items-start gap-2">
                  <Icon name="lucide:key-round" class="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <span v-if="view.codesToExtend && isBefore">{{ plural(view.codesToExtend, 'door code') }} {{ paidNow ? `now start${view.codesToExtend === 1 ? 's' : ''}` : 'will start' }} on {{ fmtDate(newDate) }}{{ paidNow ? '' : ' once the extension is paid' }}</span>
                  <span v-else-if="view.codesToExtend">{{ plural(view.codesToExtend, 'door code') }} {{ paidNow ? 'extended' : 'will be extended' }} to {{ fmtDate(newDate) }}{{ paidNow ? '' : ' once the extension is paid' }}</span>
                  <span v-else class="text-muted-foreground">No door code {{ isBefore ? 'starts on the old check-in' : 'ends on the old check-out' }}</span>
                </li>
              </ul>
            </div>

            <div class="space-y-2 rounded-md border p-3">
              <div class="flex items-center justify-between gap-3">
                <Label for="extend-notify" class="text-sm">Message the guest</Label>
                <Switch id="extend-notify" :model-value="notifyGuest" @update:model-value="notifyGuest = $event" />
              </div>
              <template v-if="notifyGuest">
                <div class="flex flex-wrap gap-2" data-testid="extend-channels">
                  <div
                    v-for="option in CHANNEL_OPTIONS"
                    :key="option.id"
                    role="checkbox"
                    :aria-checked="guestChannels.includes(option.id)"
                    :aria-disabled="option.disabled"
                    :data-testid="`extend-channel-${option.id}`"
                    class="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm"
                    :class="option.disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-muted/50'"
                    @click="!option.disabled && toggleChannel(option.id)"
                  >
                    <div
                      class="flex size-4 items-center justify-center rounded-[4px] border"
                      :class="guestChannels.includes(option.id) ? 'border-primary bg-primary text-primary-foreground' : 'border-input'"
                    >
                      <Icon v-if="guestChannels.includes(option.id)" name="lucide:check" class="size-3" />
                    </div>
                    <Icon :name="option.icon" class="size-4 text-muted-foreground" />
                    <span>{{ option.label }}</span>
                  </div>
                </div>
                <Textarea
                  :model-value="message"
                  rows="8"
                  class="text-sm"
                  data-testid="extend-message"
                  @update:model-value="onMessageInput"
                />
                <div class="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span v-if="method === 'payment_link'">{{ PAYMENT_LINK_TOKEN }} becomes the link when sent.</span>
                  <span v-else>Sent in the guest's conversation.</span>
                  <Button v-if="messageEdited" type="button" variant="link" size="sm" class="h-auto p-0 text-xs" @click="resetMessage">
                    Reset
                  </Button>
                </div>
              </template>
            </div>
          </template>
        </div>
      </ScrollArea>

      <SheetFooter class="flex-row items-center justify-between gap-2 border-t px-6 py-4">
        <Button v-if="step !== 'dates'" variant="ghost" :disabled="saving" @click="goTo(STEPS[stepIndex - 1]!.id)">
          <Icon name="lucide:arrow-left" class="size-4" />
          Back
        </Button>
        <Button v-if="step !== 'review'" class="ml-auto" :disabled="!datesValid" data-testid="extend-next" @click="goTo(STEPS[stepIndex + 1]!.id)">
          Next
          <Icon name="lucide:arrow-right" class="size-4" />
        </Button>
        <Button v-else :disabled="!canConfirm" data-testid="extend-confirm" @click="confirm">
          <Icon v-if="saving" name="lucide:loader-2" class="size-4 animate-spin" />
          {{ saving && method === 'saved_card' ? 'Charging card…' : isBefore ? 'Move arrival' : 'Extend stay' }}
        </Button>
      </SheetFooter>
    </SheetContent>
  </Sheet>
</template>
