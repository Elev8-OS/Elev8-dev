<script setup lang="ts">
import type { Booking, Listing } from '~/components/listings/data/listings'
import { otaIcon } from '~/components/channels/data/channels'
import { stayBarClasses } from '~/components/listings/data/stay-bar'
import ListingStayHoverCard from '~/components/listings/ListingStayHoverCard.vue'
import { bookingReservationStatus } from '~/components/operations-calendar/data/calendar-stays'
import { reservationStatusLabels } from '~/components/reservations/data/reservations'

/**
 * One stay's bar on the listing calendar, in both views (the month grid and
 * the rooms timeline): solid status colour, channel logo, guest name and
 * count, the hover card, and a click that opens the stay. Rounded and inset
 * only at a real check-in or check-out, flat where the stay runs off the view.
 */
const props = defineProps<{
  booking: Booking
  listing: Listing
  continuesBefore: boolean
  continuesAfter: boolean
  /** Grid placement from the parent (column span and row/lane). */
  gridStyle: Record<string, string>
  /** The rooms timeline lets this stay be dragged onto a room. */
  draggable?: boolean
  /**
   * Which room(s), shown after the name where the view does not say so
   * itself: the month grid of a multi-room listing. The rooms timeline's rows
   * already name the room, so it passes none.
   */
  roomLabel?: string
}>()
const emit = defineEmits<{ open: [booking: Booking], dragStart: [booking: Booking], dragEnd: [] }>()

/** The drag payload type the rooms timeline accepts. */
const STAY_DRAG_TYPE = 'application/x-elev8-stay'

function onDragStart(event: DragEvent) {
  event.dataTransfer?.setData(STAY_DRAG_TYPE, props.booking.id)
  event.dataTransfer?.setData('text/plain', props.booking.guestName)
  if (event.dataTransfer)
    event.dataTransfer.effectAllowed = 'move'
  emit('dragStart', props.booking)
}

const isBlock = computed(() => props.booking.type === 'block')
const guests = computed(() => (props.booking.adults ?? 0) + (props.booking.children ?? 0) + (props.booking.infants ?? 0))

function formatShort(dateKey: string) {
  const [y, m, d] = dateKey.split('-').map(Number)
  return new Date(y!, m! - 1, d!).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

const label = computed(() => {
  const status = reservationStatusLabels[bookingReservationStatus(props.booking)]
  const who = isBlock.value ? (props.booking.blockReason ?? 'Blocked') : props.booking.guestName
  const room = props.roomLabel && !isBlock.value ? `, ${props.roomLabel}` : ''
  return `${who}${room}, ${formatShort(props.booking.checkIn)} to ${formatShort(props.booking.checkOut)}, ${status}`
})
</script>

<template>
  <ListingStayHoverCard :booking="booking" :listing="listing">
    <button
      type="button"
      class="z-10 my-0.5 flex h-7 min-w-0 items-center gap-1.5 border px-1.5 text-left text-xs font-medium shadow-sm transition-[filter] hover:brightness-95 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      :class="[
        stayBarClasses[bookingReservationStatus(booking)],
        !continuesBefore && 'ml-1 rounded-l-md',
        !continuesAfter && 'mr-1 rounded-r-md',
        continuesBefore && 'border-l-0',
        continuesAfter && 'border-r-0',
      ]"
      :style="gridStyle"
      :aria-label="label"
      :draggable="draggable ? 'true' : undefined"
      :data-draggable="draggable || undefined"
      data-testid="calendar-stay-bar"
      @click="emit('open', booking)"
      @dragstart="draggable && onDragStart($event)"
      @dragend="emit('dragEnd')"
    >
      <Icon v-if="draggable" name="lucide:grip-vertical" class="-ml-0.5 size-3 shrink-0 cursor-grab opacity-70" />
      <Icon v-if="isBlock" name="lucide:ban" class="size-3 shrink-0" />
      <span v-else class="flex size-4 shrink-0 items-center justify-center rounded-full bg-white">
        <Icon :name="otaIcon(booking.source)" class="size-2.5" />
      </span>
      <span class="truncate">
        {{ isBlock ? (booking.blockReason ?? 'Blocked') : booking.guestName }}<span v-if="roomLabel && !isBlock" class="font-normal opacity-80" data-testid="stay-bar-room"> · {{ roomLabel }}</span>
      </span>
      <span v-if="!isBlock && guests > 0" class="ml-auto hidden shrink-0 items-center gap-0.5 opacity-80 sm:flex">
        <Icon name="lucide:users" class="size-3" />
        {{ guests }}
      </span>
    </button>
  </ListingStayHoverCard>
</template>
