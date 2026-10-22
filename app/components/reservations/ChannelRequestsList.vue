<script setup lang="ts">
import type { ReservationEntry } from './data/reservations'
import { otaIcon } from '~/components/channels/data/channels'
import { useChannelRequests } from '~/composables/useChannelRequests'
import ChannelRequestActions from './ChannelRequestActions.vue'
import { requestTimeLeft } from './data/channel-requests'

/**
 * Top of the Reservations page: every request to book and guest change a
 * channel is waiting on, answerable in place. A row opens the reservation.
 */
const emit = defineEmits<{ open: [reservation: ReservationEntry] }>()

const { pending } = useChannelRequests()
</script>

<template>
  <section v-if="pending.length" class="flex flex-col gap-3" aria-labelledby="channel-requests-title">
    <h2 id="channel-requests-title" class="flex items-center gap-2 text-base font-semibold">
      Needs an answer
      <Badge variant="destructive">
        {{ pending.length }}
      </Badge>
    </h2>
    <ul class="flex flex-col divide-y rounded-lg border">
      <li
        v-for="r in pending"
        :key="r.id"
        class="flex cursor-pointer flex-wrap items-center gap-3 p-3 transition-colors hover:bg-muted/40"
        data-testid="channel-request-row"
        @click="emit('open', r)"
      >
        <Icon :name="otaIcon(r.channel)" class="size-5 shrink-0" aria-hidden="true" />
        <div class="min-w-[200px] flex-1">
          <p class="text-sm font-medium">
            {{ r.guestName }}
            <span class="font-normal text-muted-foreground">· {{ r.listingName }}</span>
          </p>
          <p class="text-xs text-muted-foreground">
            {{ r.status === 'request' ? 'Request to book' : 'Asks to change the booking' }}
            · {{ r.checkIn }} to {{ r.checkOut }} · {{ r.guestCount }} {{ r.guestCount === 1 ? 'guest' : 'guests' }}
          </p>
        </div>
        <span
          v-if="r.status === 'request'"
          class="text-xs"
          :class="requestTimeLeft(r.requestExpiresAt).expired ? 'text-destructive' : 'text-amber-700 dark:text-amber-400'"
        >
          {{ requestTimeLeft(r.requestExpiresAt).label }}
        </span>
        <ChannelRequestActions :reservation="r" />
      </li>
    </ul>
  </section>
</template>
