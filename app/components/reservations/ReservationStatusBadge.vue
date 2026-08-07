<script setup lang="ts">
import type { ReservationStatus } from '~/components/reservations/data/reservations'
import { reservationStatusLabels } from '~/components/reservations/data/reservations'

const props = defineProps<{ status: ReservationStatus }>()

const classes: Record<ReservationStatus, string> = {
  unverified: 'bg-muted text-muted-foreground border-border',
  verified: 'bg-green-500/10 text-green-700 border-green-500/30',
  checked_in: 'bg-orange-500/10 text-orange-700 border-orange-500/30',
  checked_out: 'bg-blue-500/10 text-blue-700 border-blue-500/30',
  cancelled: 'bg-muted text-muted-foreground border-border line-through',
  blocked: 'bg-black/80 text-white border-black/80',
  inquiry: 'bg-amber-500/10 text-amber-700 border-amber-500/30',
}
</script>

<template>
  <Badge variant="outline" :class="classes[props.status]">
    <template v-if="props.status === 'blocked'">
      <Icon name="lucide:calendar-off" class="mr-1 size-3" />
      {{ reservationStatusLabels[props.status] }}
    </template>
    <template v-else>
      {{ reservationStatusLabels[props.status] }}
    </template>
  </Badge>
</template>
