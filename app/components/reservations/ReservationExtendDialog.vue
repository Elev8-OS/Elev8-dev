<script setup lang="ts">
import type { DateValue } from '@internationalized/date'
import type { ExtensionDirection, ExtensionPaymentMethod, ReservationEntry } from '~/components/reservations/data/reservations'
import type { ExtensionFeeMode } from '~/composables/useStayExtension'
import { getLocalTimeZone, parseDate, today } from '@internationalized/date'
import { toast } from 'vue-sonner'
import { NON_EARLY_ARRIVAL_STATUSES, useReservationsModule } from '~/composables/useReservationsModule'
import { PAYMENT_LINK_TOKEN, savedCardFor, useStayExtension } from '~/composables/useStayExtension'

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

const { defaultNightlyRate, earlyArrivalEnd } = useReservationsModule()
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
const nightlyRate = ref(0)
const calendarOpen = ref(false)
const method = ref<ExtensionPaymentMethod>('payment_link')
const feeMode = ref<ExtensionFeeMode>('card')
const notifyGuest = ref(true)
const message = ref('')
const messageEdited = ref(false)
const saving = ref(false)

const savedCard = computed(() => props.reservation ? savedCardFor(props.reservation) : undefined)

const isBefore = computed(() => direction.value === 'before')

const view = computed(() => props.reservation && newDate.value
  ? preview(props.reservation, newDate.value, nightlyRate.value, direction.value)
  : null)
const quote = computed(() => view.value?.quote ?? null)
const isLinked = computed(() => view.value?.mode === 'linked_booking')
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
    nightlyRate.value = defaultNightlyRate(props.reservation)
    calendarOpen.value = false
    method.value = 'payment_link'
    feeMode.value = 'card'
    notifyGuest.value = true
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

function quickDate(n: number): string {
  const base = parseDate(anchor.value)
  return (isBefore.value ? base.subtract({ days: n }) : base.add({ days: n })).toString()
}

/** An early arrival cannot start in the past. */
function quickDisabled(n: number): boolean {
  return isBefore.value && Boolean(anchor.value) && parseDate(quickDate(n)).compare(todayDate.value) < 0
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

const methodLabel = computed(() => PAYMENT_OPTIONS.value.find(o => o.id === method.value)?.label ?? '')

const feeAmount = computed(() => quote.value && method.value === 'payment_link' && feeMode.value === 'card'
  ? Math.round(quote.value.amount * 3) / 100
  : 0)

const guestPaysLine = computed(() => {
  if (!quote.value)
    return ''
  const total = `Guest pays ${fmtMoney(quote.value.amount + feeAmount.value)}`
  return feeAmount.value ? `${total}, including ${fmtMoney(feeAmount.value)} card fee.` : `${total}.`
})

function freshMessage(): string {
  if (!props.reservation || !quote.value || !view.value)
    return ''
  return defaultExtensionMessage(props.reservation, {
    checkOut: newDate.value,
    direction: direction.value,
    quote: quote.value,
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

const stepIndex = computed(() => STEPS.findIndex(s => s.id === step.value))

const canConfirm = computed(() => datesValid.value
  && !saving.value
  && !(method.value === 'saved_card' && !savedCard.value)
  && !(notifyGuest.value && !message.value.trim()))

function fmtDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtMoney(amount: number, currency = props.reservation?.currency ?? 'USD'): string {
  const locale = currency === 'CHF' ? 'de-CH' : 'en-US'
  const digits = currency === 'IDR' ? 0 : 2
  return `${currency} ${amount.toLocaleString(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`
}

function fmtTotals(totals: { amount: number, currency: string }[]): string {
  return totals.length ? totals.map(t => fmtMoney(t.amount, t.currency)).join(' + ') : fmtMoney(0)
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
    nightlyRate: nightlyRate.value,
    payment: { method: method.value, feeMode: feeMode.value },
    guestMessage: notifyGuest.value ? message.value : '',
  })
  saving.value = false
  if (!result.success) {
    toast.error(result.error ?? 'Could not extend the stay.')
    return
  }
  const details = [
    result.linkedReservationId ? `Direct booking ${result.linkedReservationId} created` : '',
    result.paymentLink ? 'payment link sent' : '',
    result.guestNotified ? 'guest notified' : '',
  ].filter(Boolean).join(', ')
  toast.success(isBefore.value ? `Arrival moved ${plural(n, 'night')} earlier` : `Stay extended by ${plural(n, 'night')}`, details ? { description: details.charAt(0).toUpperCase() + details.slice(1) } : undefined)
  emit('update:open', false)
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Extend reservation</DialogTitle>
        <DialogDescription v-if="reservation">
          {{ reservation.id }} · {{ reservation.guestName }}
        </DialogDescription>
      </DialogHeader>

      <!-- Step indicator -->
      <ol class="flex items-center gap-2 text-xs" data-testid="extend-steps">
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

      <div v-if="reservation" class="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
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
            <AlertTitle>Booked on {{ reservation.channel }}</AlertTitle>
            <AlertDescription>
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
                <Calendar v-model="calendarValue" :min-value="minDate" :max-value="maxDate" initial-focus />
              </PopoverContent>
            </Popover>
          </div>

          <div v-if="quote && !quote.rateFromRooms" class="space-y-2">
            <Label for="extend-rate">Nightly rate</Label>
            <div class="relative">
              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">{{ reservation.currency }}</span>
              <Input id="extend-rate" v-model.number="nightlyRate" type="number" min="0" class="pl-14" />
            </div>
            <p class="text-xs text-muted-foreground">
              Defaults to the average nightly rate of the current stay.
            </p>
          </div>
          <p v-else-if="quote" class="text-xs text-muted-foreground">
            Priced from the booked room rates ({{ fmtMoney(quote.nightlyRate) }} per night). Flat-rate rooms do not change.
          </p>

          <Alert v-if="view?.conflicts.length" variant="destructive">
            <Icon name="lucide:calendar-x" class="size-4" />
            <AlertTitle>Not available</AlertTitle>
            <AlertDescription>
              <p v-for="c in view.conflicts" :key="c.id">
                {{ c.guestName }} is booked {{ fmtDate(c.checkIn) }} to {{ fmtDate(c.checkOut) }}.
              </p>
            </AlertDescription>
          </Alert>

          <div v-if="quote && quote.extraNights > 0" class="space-y-1.5 rounded-md border p-3 text-sm">
            <div class="flex justify-between">
              <span class="text-muted-foreground">Extra nights</span>
              <span>{{ quote.extraNights }} × {{ fmtMoney(quote.nightlyRate) }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-muted-foreground">{{ isLinked ? 'New direct booking' : 'Added to the stay' }}</span>
              <span class="font-medium">{{ fmtMoney(quote.amount) }}</span>
            </div>
            <template v-if="!isLinked">
              <Separator class="my-1" />
              <div class="flex justify-between font-semibold">
                <span>New total ({{ quote.newNights }} nights)</span>
                <span>{{ fmtMoney(quote.newTotal) }}</span>
              </div>
            </template>
          </div>
        </template>

        <!-- Step 2: payment -->
        <template v-else-if="step === 'payment' && quote">
          <div class="flex items-center justify-between rounded-md border bg-muted/40 p-3 text-sm">
            <span class="text-muted-foreground">Amount for {{ plural(quote.extraNights, 'night') }}</span>
            <span class="font-semibold">{{ fmtMoney(quote.amount) }}</span>
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
            <Label>Card fee</Label>
            <div class="flex gap-2">
              <Button type="button" size="sm" class="h-8" :variant="feeMode === 'card' ? 'default' : 'outline'" @click="feeMode = 'card'">
                Guest pays 3%
              </Button>
              <Button type="button" size="sm" class="h-8" :variant="feeMode === 'no_fee' ? 'default' : 'outline'" @click="feeMode = 'no_fee'">
                No fee
              </Button>
            </div>
            <p class="text-xs text-muted-foreground">
              {{ guestPaysLine }}
            </p>
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
                {{ fmtMoney(quote.amount) }} · {{ methodLabel }}
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
                <span v-if="view.codesToExtend && isBefore">{{ plural(view.codesToExtend, 'door code') }} now start{{ view.codesToExtend === 1 ? 's' : '' }} on {{ fmtDate(newDate) }}</span>
                <span v-else-if="view.codesToExtend">{{ plural(view.codesToExtend, 'door code') }} extended to {{ fmtDate(newDate) }}</span>
                <span v-else class="text-muted-foreground">No door code {{ isBefore ? 'starts on the old check-in' : 'ends on the old check-out' }}</span>
              </li>
              <li v-if="view.cityTax.kind !== 'none'" class="flex items-start gap-2">
                <Icon name="lucide:landmark" class="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span v-if="view.cityTax.kind === 'due'">City tax due goes from {{ fmtTotals(view.cityTax.before) }} to {{ fmtTotals(view.cityTax.after) }}</span>
                <span v-else-if="view.cityTax.kind === 'linked_due'">The new booking owes {{ fmtTotals(view.cityTax.totals) }} city tax</span>
                <span v-else class="text-amber-700 dark:text-amber-400">City tax was already settled for the original nights. Undo it in City tax to collect the added nights.</span>
              </li>
            </ul>
          </div>

          <div class="space-y-2 rounded-md border p-3">
            <div class="flex items-center justify-between gap-3">
              <Label for="extend-notify" class="text-sm">Message the guest</Label>
              <Switch id="extend-notify" :model-value="notifyGuest" @update:model-value="notifyGuest = $event" />
            </div>
            <template v-if="notifyGuest">
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

      <DialogFooter class="gap-2 sm:justify-between">
        <Button v-if="step !== 'dates'" variant="ghost" :disabled="saving" @click="goTo(STEPS[stepIndex - 1]!.id)">
          <Icon name="lucide:arrow-left" class="size-4" />
          Back
        </Button>
        <Button v-else variant="outline" @click="emit('update:open', false)">
          Cancel
        </Button>
        <Button v-if="step !== 'review'" :disabled="!datesValid" data-testid="extend-next" @click="goTo(STEPS[stepIndex + 1]!.id)">
          Next
          <Icon name="lucide:arrow-right" class="size-4" />
        </Button>
        <Button v-else :disabled="!canConfirm" data-testid="extend-confirm" @click="confirm">
          <Icon v-if="saving" name="lucide:loader-2" class="size-4 animate-spin" />
          {{ saving && method === 'saved_card' ? 'Charging card…' : isBefore ? 'Move arrival' : 'Extend stay' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
