<script setup lang="ts">
import type { ReservationStatus } from '~/components/reservations/data/reservations'
import { reservationStatusLabels } from '~/components/reservations/data/reservations'

const props = defineProps<{ status: ReservationStatus }>()

const classes: Record<ReservationStatus, string> = {
  inquiry: 'bg-amber-500/10 text-amber-700 border-amber-500/30',
  confirmed: 'bg-primary/10 text-primary border-primary/30',
  checked_in: 'bg-blue-500/10 text-blue-700 border-blue-500/30',
  checked_out: 'bg-muted text-muted-foreground border-border',
  cancelled: 'bg-red-500/10 text-red-700 border-red-500/30',
}
</script>

<template>
  <Badge variant="outline" :class="classes[props.status]">
    {{ reservationStatusLabels[props.status] }}
  </Badge>
</template>
