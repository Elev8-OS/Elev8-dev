<script setup lang="ts">
import type { ReservationStatus } from '~/components/reservations/data/reservations'
import { reservationStatusClasses, reservationStatusLabels } from '~/components/reservations/data/reservations'

const props = defineProps<{ status: ReservationStatus }>()
</script>

<template>
  <Badge variant="outline" :class="reservationStatusClasses[props.status]">
    <template v-if="props.status === 'blocked'">
      <Icon name="lucide:calendar-off" class="mr-1 size-3" />
      {{ reservationStatusLabels[props.status] }}
    </template>
    <template v-else-if="props.status === 'owner_request'">
      <Icon name="lucide:user-round-check" class="mr-1 size-3" />
      {{ reservationStatusLabels[props.status] }}
    </template>
    <template v-else>
      {{ reservationStatusLabels[props.status] }}
    </template>
  </Badge>
</template>
