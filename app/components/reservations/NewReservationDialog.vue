<script setup lang="ts">
import type { ReservationEntry } from '~/components/reservations/data/reservations'
import { nightsBetween } from '~/components/reservations/data/reservations'
import { listings } from '~/components/listings/data/listings'
import { useReservationsModule } from '~/composables/useReservationsModule'
import { toast } from 'vue-sonner'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{
  'update:open': [value: boolean]
  created: [reservation: ReservationEntry]
}>()

const { createReservation } = useReservationsModule()

const guestName = ref('')
const guestEmail = ref('')
const guestPhone = ref('')
const listingId = ref('')
const checkIn = ref('')
const checkOut = ref('')
const guestCount = ref(2)
const totalPrice = ref(0)
const currency = ref('USD')

const listingOptions = computed(() => listings.value.map(l => ({ id: l.id, name: l.name })))

const computedNights = computed(() => {
  if (!checkIn.value || !checkOut.value)
    return 0
  return nightsBetween(checkIn.value, checkOut.value)
})

const channel = computed(() => 'Direct' as const)

function reset() {
  guestName.value = ''
  guestEmail.value = ''
  guestPhone.value = ''
  listingId.value = ''
  checkIn.value = ''
  checkOut.value = ''
  guestCount.value = 2
  totalPrice.value = 0
  currency.value = 'USD'
}

function handleSubmit() {
  const listing = listingOptions.value.find(l => l.id === listingId.value)
  const result = createReservation({
    guestName: guestName.value.trim(),
    guestEmail: guestEmail.value.trim(),
    guestPhone: guestPhone.value.trim(),
    guestLanguage: 'English',
    guestNotes: '',
    listingId: listingId.value,
    listingName: listing?.name ?? listingId.value,
    channel: channel.value,
    checkIn: checkIn.value,
    checkOut: checkOut.value,
    nights: computedNights.value,
    guestCount: guestCount.value,
    totalPrice: totalPrice.value,
    currency: currency.value,
  })
  if (!result.success) {
    toast.error('Please fill in guest name, listing, and check-in/check-out dates.')
    return
  }
  toast.success('Reservation created')
  reset()
  emit('update:open', false)
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>
          New Reservation
        </DialogTitle>
        <DialogDescription>
          Create a direct reservation for a guest.
        </DialogDescription>
      </DialogHeader>

      <div class="grid gap-4 py-2">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div class="space-y-2">
            <Label>Guest name</Label>
            <Input v-model="guestName" placeholder="Guest name" />
          </div>
          <div class="space-y-2">
            <Label>Email</Label>
            <Input v-model="guestEmail" type="email" placeholder="guest@email.com" />
          </div>
          <div class="space-y-2">
            <Label>Phone</Label>
            <Input v-model="guestPhone" placeholder="+62 812..." />
          </div>
          <div class="space-y-2">
            <Label>Listing</Label>
            <Select v-model="listingId">
              <SelectTrigger>
                <SelectValue placeholder="Select a listing" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="l in listingOptions" :key="l.id" :value="l.id">
                  {{ l.name }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
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
        </div>

        <div class="rounded-md border bg-muted/40 p-3 text-sm">
          <div class="flex items-center justify-between">
            <span class="text-muted-foreground">Nights</span>
            <span class="font-medium">{{ computedNights }}</span>
          </div>
          <div class="flex items-center justify-between mt-1">
            <span class="text-muted-foreground">Channel</span>
            <span class="font-medium">Direct</span>
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="emit('update:open', false)">
          Cancel
        </Button>
        <Button @click="handleSubmit">
          Create Reservation
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
