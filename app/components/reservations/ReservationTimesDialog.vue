<script setup lang="ts">
import type { ReservationEntry } from '~/components/reservations/data/reservations'
import { toast } from 'vue-sonner'
import { CHECK_IN_TIME_LOCKED_STATUSES, CHECK_OUT_TIME_LOCKED_STATUSES, useReservationsModule } from '~/composables/useReservationsModule'

const props = defineProps<{
  reservation: ReservationEntry | null
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const { getCheckInTime, getCheckOutTime, getListingCheckInTime, getListingCheckOutTime, updateReservationTimes } = useReservationsModule()

const checkInTime = ref('')
const checkOutTime = ref('')

watch(() => props.open, (open) => {
  if (open && props.reservation) {
    checkInTime.value = getCheckInTime(props.reservation)
    checkOutTime.value = getCheckOutTime(props.reservation)
  }
})

const checkInLocked = computed(() => Boolean(props.reservation && CHECK_IN_TIME_LOCKED_STATUSES.includes(props.reservation.status)))
const checkOutLocked = computed(() => Boolean(props.reservation && CHECK_OUT_TIME_LOCKED_STATUSES.includes(props.reservation.status)))

const listingCheckIn = computed(() => props.reservation ? getListingCheckInTime(props.reservation.listingId) : '')
const listingCheckOut = computed(() => props.reservation ? getListingCheckOutTime(props.reservation.listingId) : '')

const checkInPresets = computed(() => [...new Set(['10:00', '12:00', listingCheckIn.value, '16:00'])].filter(Boolean).sort())
const checkOutPresets = computed(() => [...new Set(['09:00', listingCheckOut.value, '14:00', '16:00'])].filter(Boolean).sort())

const checkInNote = computed(() => {
  if (!checkInTime.value || checkInTime.value === listingCheckIn.value)
    return ''
  return checkInTime.value < listingCheckIn.value ? 'Early check-in' : 'Late check-in'
})
const checkOutNote = computed(() => {
  if (!checkOutTime.value || checkOutTime.value === listingCheckOut.value)
    return ''
  return checkOutTime.value > listingCheckOut.value ? 'Late check-out' : 'Early check-out'
})

const canSave = computed(() => Boolean((checkInLocked.value || checkInTime.value) && (checkOutLocked.value || checkOutTime.value)))

function save() {
  if (!props.reservation || !canSave.value)
    return
  const result = updateReservationTimes(props.reservation.id, {
    ...(checkInLocked.value ? {} : { checkInTime: checkInTime.value }),
    ...(checkOutLocked.value ? {} : { checkOutTime: checkOutTime.value }),
  })
  if (!result.success) {
    toast.error(result.error ?? 'Could not update the reservation time.')
    return
  }
  toast.success('Reservation time updated')
  emit('update:open', false)
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="sm:max-w-sm">
      <DialogHeader>
        <DialogTitle>Edit reservation time</DialogTitle>
        <DialogDescription v-if="reservation">
          {{ reservation.id }} · {{ reservation.guestName }}
        </DialogDescription>
      </DialogHeader>

      <div v-if="reservation" class="space-y-5">
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <Label for="stay-checkin-time">Check-in time</Label>
            <Badge v-if="checkInNote" variant="secondary">
              {{ checkInNote }}
            </Badge>
          </div>
          <Input id="stay-checkin-time" v-model="checkInTime" type="time" step="900" :disabled="checkInLocked" />
          <div v-if="!checkInLocked" class="flex flex-wrap gap-2">
            <Button
              v-for="preset in checkInPresets"
              :key="preset"
              type="button"
              size="sm"
              :variant="checkInTime === preset ? 'default' : 'outline'"
              class="h-8"
              data-testid="checkin-preset"
              @click="checkInTime = preset"
            >
              {{ preset }}
            </Button>
          </div>
          <p class="text-xs text-muted-foreground">
            {{ checkInLocked ? 'The guest has already checked in.' : `Listing default is ${listingCheckIn}.` }}
          </p>
        </div>

        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <Label for="stay-checkout-time">Check-out time</Label>
            <Badge v-if="checkOutNote" variant="secondary">
              {{ checkOutNote }}
            </Badge>
          </div>
          <Input id="stay-checkout-time" v-model="checkOutTime" type="time" step="900" :disabled="checkOutLocked" />
          <div v-if="!checkOutLocked" class="flex flex-wrap gap-2">
            <Button
              v-for="preset in checkOutPresets"
              :key="preset"
              type="button"
              size="sm"
              :variant="checkOutTime === preset ? 'default' : 'outline'"
              class="h-8"
              data-testid="checkout-preset"
              @click="checkOutTime = preset"
            >
              {{ preset }}
            </Button>
          </div>
          <p class="text-xs text-muted-foreground">
            Listing default is {{ listingCheckOut }}.
          </p>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="emit('update:open', false)">
          Cancel
        </Button>
        <Button :disabled="!canSave" data-testid="stay-times-save" @click="save">
          Save
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
