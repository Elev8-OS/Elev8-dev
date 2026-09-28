<script setup lang="ts">
import type { DateValue } from '@internationalized/date'
import type { ReservationEntry } from '~/components/reservations/data/reservations'
import { parseDate } from '@internationalized/date'
import { toast } from 'vue-sonner'
import { useReservationsModule } from '~/composables/useReservationsModule'

const props = defineProps<{
  reservation: ReservationEntry | null
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const { quoteExtension, getExtensionConflicts, extendReservation, defaultNightlyRate } = useReservationsModule()

const QUICK_NIGHTS = [1, 2, 3, 7]

const newCheckOut = ref('')
const nightlyRate = ref(0)
const calendarOpen = ref(false)

watch(() => props.open, (open) => {
  if (open && props.reservation) {
    newCheckOut.value = parseDate(props.reservation.checkOut).add({ days: 1 }).toString()
    nightlyRate.value = defaultNightlyRate(props.reservation)
    calendarOpen.value = false
  }
})

const minCheckOut = computed(() => props.reservation ? parseDate(props.reservation.checkOut).add({ days: 1 }) : undefined)

const calendarValue = computed<DateValue | undefined>({
  get: () => newCheckOut.value ? parseDate(newCheckOut.value) : undefined,
  set: (val) => {
    if (val) {
      newCheckOut.value = val.toString()
      calendarOpen.value = false
    }
  },
})

function addNights(n: number) {
  if (props.reservation)
    newCheckOut.value = parseDate(props.reservation.checkOut).add({ days: n }).toString()
}

const quote = computed(() => props.reservation && newCheckOut.value
  ? quoteExtension(props.reservation, newCheckOut.value, nightlyRate.value)
  : null)

const conflicts = computed(() => props.reservation && newCheckOut.value
  ? getExtensionConflicts(props.reservation.id, newCheckOut.value)
  : [])

const canSave = computed(() => Boolean(quote.value && quote.value.extraNights > 0 && !conflicts.value.length))

function fmtDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtMoney(amount: number): string {
  const currency = props.reservation?.currency ?? 'USD'
  const locale = currency === 'CHF' ? 'de-CH' : 'en-US'
  const digits = currency === 'IDR' ? 0 : 2
  return `${currency} ${amount.toLocaleString(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`
}

function save() {
  if (!props.reservation || !canSave.value)
    return
  const result = extendReservation(props.reservation.id, { checkOut: newCheckOut.value, nightlyRate: nightlyRate.value })
  if (!result.success) {
    toast.error(result.error ?? 'Could not extend the stay.')
    return
  }
  const n = quote.value!.extraNights
  toast.success(`Stay extended by ${n} night${n === 1 ? '' : 's'}`)
  emit('update:open', false)
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Extend reservation</DialogTitle>
        <DialogDescription v-if="reservation">
          {{ reservation.id }} · {{ reservation.guestName }}
        </DialogDescription>
      </DialogHeader>

      <div v-if="reservation" class="space-y-4">
        <div class="grid grid-cols-2 gap-3 rounded-md border bg-muted/40 p-3 text-sm">
          <div>
            <p class="text-xs text-muted-foreground">
              Current check-out
            </p>
            <p class="font-medium">
              {{ fmtDate(reservation.checkOut) }}
            </p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">
              Current stay
            </p>
            <p class="font-medium">
              {{ reservation.nights }} night{{ reservation.nights === 1 ? '' : 's' }}
            </p>
          </div>
        </div>

        <div class="space-y-2">
          <Label>New check-out</Label>
          <div class="flex flex-wrap gap-2">
            <Button
              v-for="n in QUICK_NIGHTS"
              :key="n"
              type="button"
              size="sm"
              :variant="quote?.extraNights === n ? 'default' : 'outline'"
              class="h-8"
              @click="addNights(n)"
            >
              +{{ n }} night{{ n === 1 ? '' : 's' }}
            </Button>
          </div>
          <Popover v-model:open="calendarOpen">
            <PopoverTrigger as-child>
              <Button variant="outline" class="w-full justify-start font-normal">
                <Icon name="lucide:calendar" class="mr-2 size-4" />
                {{ newCheckOut ? fmtDate(newCheckOut) : 'Pick a date' }}
              </Button>
            </PopoverTrigger>
            <PopoverContent class="w-auto p-0" align="start">
              <Calendar v-model="calendarValue" :min-value="minCheckOut" initial-focus />
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

        <Alert v-if="conflicts.length" variant="destructive">
          <Icon name="lucide:calendar-x" class="size-4" />
          <AlertTitle>Not available</AlertTitle>
          <AlertDescription>
            <p v-for="c in conflicts" :key="c.id">
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
            <span class="text-muted-foreground">Added to the stay</span>
            <span class="font-medium">{{ fmtMoney(quote.amount) }}</span>
          </div>
          <Separator class="my-1" />
          <div class="flex justify-between font-semibold">
            <span>New total ({{ quote.newNights }} nights)</span>
            <span>{{ fmtMoney(quote.newTotal) }}</span>
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="emit('update:open', false)">
          Cancel
        </Button>
        <Button :disabled="!canSave" data-testid="extend-confirm" @click="save">
          Extend stay
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
