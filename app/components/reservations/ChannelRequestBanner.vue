<script setup lang="ts">
import type { ReservationEntry } from './data/reservations'
import { computed } from 'vue'
import { otaIcon } from '~/components/channels/data/channels'
import { formatMoney } from '~/components/cockpit/data/cockpit'
import ChannelRequestActions from './ChannelRequestActions.vue'
import { alterationChanges, requestTimeLeft } from './data/channel-requests'

/**
 * What the channel is waiting for on this reservation, with Accept and Decline:
 * a request to book (time left, the guest's message) or a change the guest
 * asked for (only the fields that change, old to new). Renders nothing otherwise.
 */
const props = defineProps<{ reservation: ReservationEntry }>()

const time = computed(() => requestTimeLeft(props.reservation.requestExpiresAt))
const changes = computed(() => alterationChanges(props.reservation, formatMoney))
</script>

<template>
  <div
    v-if="reservation.status === 'request' || reservation.alteration"
    class="flex flex-col gap-3 rounded-lg border border-sky-500/40 bg-sky-500/5 p-4"
    role="region"
    :aria-label="reservation.status === 'request' ? 'Request to book' : 'Change requested'"
    data-testid="channel-request-banner"
  >
    <div class="flex flex-wrap items-start gap-3">
      <Icon :name="otaIcon(reservation.channel)" class="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <div class="min-w-0 flex-1">
        <template v-if="reservation.status === 'request'">
          <p class="text-sm font-semibold">
            Request to book from {{ reservation.channel }}
          </p>
          <p class="text-xs" :class="time.expired ? 'text-destructive' : 'text-muted-foreground'">
            {{ time.expired ? `Expired. ${reservation.channel} may have withdrawn it.` : `${time.label}, or ${reservation.channel} withdraws it.` }}
          </p>
        </template>
        <template v-else>
          <p class="text-sm font-semibold">
            {{ reservation.guestName }} asks to change this booking
          </p>
          <ul class="mt-1 flex flex-col gap-0.5 text-xs">
            <li v-for="c in changes" :key="c.key">
              <span class="text-muted-foreground">{{ c.label }}:</span>
              <span class="line-through decoration-muted-foreground/60"> {{ c.from }}</span>
              <Icon name="lucide:arrow-right" class="mx-1 inline size-3" aria-label="to" />
              <span class="font-medium">{{ c.to }}</span>
            </li>
          </ul>
        </template>
      </div>
      <ChannelRequestActions :reservation="reservation" />
    </div>
    <p
      v-if="reservation.status === 'request' ? reservation.bookingNote : reservation.alteration?.note"
      class="rounded-md bg-background px-3 py-2 text-sm"
    >
      "{{ reservation.status === 'request' ? reservation.bookingNote : reservation.alteration?.note }}"
    </p>
  </div>
</template>
