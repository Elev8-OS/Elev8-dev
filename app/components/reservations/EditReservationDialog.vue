<script setup lang="ts">
import type { ReservationEntry } from '~/components/reservations/data/reservations'
import { toast } from 'vue-sonner'
import { nightsBetween } from '~/components/reservations/data/reservations'
import { useReservationsModule } from '~/composables/useReservationsModule'

const props = defineProps<{
  reservation: ReservationEntry | null
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'saved': []
}>()

const { updateReservation } = useReservationsModule()

const checkIn = ref('')
const checkOut = ref('')
const guestCount = ref(2)
const totalPrice = ref(0)
const currency = ref('USD')
const channel = ref<ReservationEntry['channel']>('Direct')
const guestNotes = ref('')

watch(() => props.open, (open) => {
  if (open && props.reservation) {
    checkIn.value = props.reservation.checkIn
    checkOut.value = props.reservation.checkOut
    guestCount.value = props.reservation.guestCount
    totalPrice.value = props.reservation.totalPrice
    currency.value = props.reservation.currency
    channel.value = props.reservation.channel
    guestNotes.value = props.reservation.guestNotes
  }
})

const computedNights = computed(() => {
  if (!checkIn.value || !checkOut.value)
    return 0
  return nightsBetween(checkIn.value, checkOut.value)
})

function save() {
  if (!props.reservation || !checkIn.value || !checkOut.value) {
    toast.error('Check-in and check-out dates are required.')
    return
  }
  updateReservation(props.reservation.id, {
    checkIn: checkIn.value,
    checkOut: checkOut.value,
    nights: computedNights.value,
    guestCount: guestCount.value,
    totalPrice: totalPrice.value,
    currency: currency.value,
    channel: channel.value,
    guestNotes: guestNotes.value.trim(),
  })
  toast.success('Reservation updated')
  emit('update:open', false)
  emit('saved')
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>
          Edit Reservation
        </DialogTitle>
        <DialogDescription v-if="reservation">
          {{ reservation.id }} · {{ reservation.guestName }}
        </DialogDescription>
      </DialogHeader>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
        <div class="space-y-2">
          <Label>Check-in</Label>
          <Input v-model="checkIn" type="date" />
        </div>
        <div class="space-y-2">
          <Label>Check-out</Label>
          <Input v-model="checkOut" type="date" />
        </div>
        <div class="space-y-2">
          <Label>Guests</Label>
          <Input v-model.number="guestCount" type="number" min="1" />
        </div>
        <div class="space-y-2">
          <Label>Total price</Label>
          <Input v-model.number="totalPrice" type="number" min="0" />
        </div>
        <div class="space-y-2">
          <Label>Currency</Label>
          <Input v-model="currency" placeholder="USD" />
        </div>
        <div class="space-y-2">
          <Label>Channel</Label>
          <Select v-model="channel">
            <SelectTrigger>
              <SelectValue placeholder="Select channel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Airbnb">
                Airbnb
              </SelectItem>
              <SelectItem value="Booking.com">
                Booking.com
              </SelectItem>
              <SelectItem value="Direct">
                Direct
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="space-y-2 sm:col-span-2">
          <Label>Guest notes</Label>
          <Textarea v-model="guestNotes" rows="3" placeholder="Notes about this guest..." />
        </div>
      </div>

      <div class="rounded-md border bg-muted/40 p-3 text-sm">
        <div class="flex items-center justify-between">
          <span class="text-muted-foreground">Nights</span>
          <span class="font-medium">{{ computedNights }}</span>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="emit('update:open', false)">
          Cancel
        </Button>
        <Button @click="save">
          Save changes
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
