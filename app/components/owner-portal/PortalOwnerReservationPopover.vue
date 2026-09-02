<script setup lang="ts">
// Owner-portal reservation popover.
//
// Guest reservations: read-only (dates + channel + status badge).
// Owner blocks: editable — emits edit / remove events for the parent
// to drive the edit form / delete confirmation.

import type { OwnerReservation, OwnerReservationChannel } from '~/components/owners/data/owner-reservations'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'

const props = defineProps<{
  open: boolean
  reservation: OwnerReservation | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'edit': [value: OwnerReservation]
  'remove': [value: OwnerReservation]
}>()

const channelLabel: Record<OwnerReservationChannel, string> = {
  airbnb: 'Airbnb',
  booking: 'Booking.com',
  direct: 'Direct',
  vrbo: 'Vrbo',
}

function variant(status: OwnerReservation['status']) {
  if (status === 'confirmed')
    return 'default'
  if (status === 'pending')
    return 'secondary'
  return 'destructive'
}
</script>

<template>
  <Dialog :open="props.open" @update:open="(v) => emit('update:open', v)">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>
          <template v-if="!props.reservation">
            Reservation
          </template>
          <template v-else-if="props.reservation.type === 'guest'">
            Guest stay
          </template>
          <template v-else>
            Owner block
          </template>
        </DialogTitle>
        <DialogDescription v-if="props.reservation">
          {{ props.reservation.checkIn }} → {{ props.reservation.checkOut }}
        </DialogDescription>
      </DialogHeader>
      <div v-if="props.reservation" class="space-y-3">
        <div v-if="props.reservation.type === 'guest'" class="space-y-2">
          <div class="flex items-center justify-between rounded-md border bg-card px-3 py-2">
            <div>
              <p class="text-sm font-medium">
                {{ props.reservation.guestName }}
              </p>
              <p class="text-xs text-muted-foreground">
                {{ channelLabel[props.reservation.channel!] }}
              </p>
            </div>
            <Badge :variant="variant(props.reservation.status)">
              {{ props.reservation.status }}
            </Badge>
          </div>
          <p class="text-xs text-muted-foreground">
            Contact the property manager to make changes to this reservation.
          </p>
        </div>
        <div v-else class="space-y-2">
          <div class="flex items-center justify-between rounded-md border bg-amber-50 px-3 py-2">
            <div>
              <p class="text-sm font-medium">
                {{ props.reservation.note || 'Owner block' }}
              </p>
              <p class="text-xs text-muted-foreground">
                Personal-use block — removes these nights from guest availability.
              </p>
            </div>
            <Badge variant="outline">
              Owner
            </Badge>
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" @click="emit('update:open', false)">
          Close
        </Button>
        <Button
          v-if="props.reservation?.type === 'owner_block'"
          @click="emit('edit', props.reservation)"
        >
          Edit
        </Button>
        <Button
          v-if="props.reservation?.type === 'owner_block'"
          variant="destructive"
          @click="emit('remove', props.reservation)"
        >
          Remove
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
