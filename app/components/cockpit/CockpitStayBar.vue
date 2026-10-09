<script setup lang="ts">
import type { Booking, Listing } from '~/components/listings/data/listings'
import { otaIcon } from '~/components/channels/data/channels'
import { stayBarClasses } from '~/components/listings/data/stay-bar'
import ListingStayHoverCard from '~/components/listings/ListingStayHoverCard.vue'
import { bookingReservationStatus } from '~/components/operations-calendar/data/calendar-stays'
import { reservationStatusLabels } from '~/components/reservations/data/reservations'

/**
 * One reservation on the Cockpit: a one-line bar with slanted ends. A guest
 * arrives after midday and leaves before it, so each real check-in and
 * check-out is drawn as a slant (the bar leans like the clock moving on);
 * an end that runs off the view stays square. On a turnover day the
 * departing and arriving slants sit side by side.
 *
 * Status colours are the listing calendar's (`stayBarClasses`), unchanged. A
 * stay that has already left is drawn lighter. A cancelled stay is grey and
 * hatched, tucked under the live bars by the board. The booking channel's logo
 * sits on a small round chip before the name, so it reads on any status
 * colour. After the name: the check-in time, the guest count and a bag when
 * the stay has upsell orders. They give way as the bar narrows (container
 * queries): the details go first, the upsell bag last, the name never.
 * Check-out time and the guest breakdown are in the hover card.
 *
 * The root carries the grid placement; the bar is one button, and the Action
 * needed marker is a second button beside it (a button cannot sit inside
 * another), which opens the guest's Inbox conversation.
 */
const props = defineProps<{
  booking: Booking
  listing: Listing
  continuesBefore: boolean
  continuesAfter: boolean
  /** Grid placement from the board (columns, lane, alignment, stacking). */
  gridStyle: Record<string, string | number>
  /** The stay has checked out before today: drawn lighter. */
  past?: boolean
  /** The reservation's Inbox conversation is marked Action needed. */
  actionNeeded?: boolean
  /** `HH:mm`, the reservation's check-in time or the listing default. */
  checkInTime?: string
  /** Upsell orders on the stay, declined ones left out. */
  upsells?: number
  /** Double booked: another live stay holds this room on a shared night. */
  conflict?: boolean
  /** The today strip focuses other stays; this one fades back. */
  dimmed?: boolean
  /** Can be dragged onto a room (a multi-unit stay with no priced rooms). */
  draggable?: boolean
  /** For keyboard moves between bars: the row's index and the bar's first column. */
  rowIndex: number
  startHalf: number
}>()
const emit = defineEmits<{
  open: [booking: Booking]
  openInbox: [booking: Booking]
  dragStart: [booking: Booking]
  dragEnd: []
}>()

/** The drag payload type the board's room rows accept. */
const STAY_DRAG_TYPE = 'application/x-elev8-stay'
/** How far a slanted end leans. */
const SLANT = '0.6rem'

const status = computed(() => bookingReservationStatus(props.booking))
const isCancelled = computed(() => status.value === 'cancelled')
const isBlock = computed(() => props.booking.type === 'block')
const title = computed(() => isBlock.value ? (props.booking.blockReason ?? 'Blocked') : props.booking.guestName)

function formatShort(dateKey: string) {
  const [y, m, d] = dateKey.split('-').map(Number)
  return new Date(y!, m! - 1, d!).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

const guests = computed(() => (props.booking.adults ?? 0) + (props.booking.children ?? 0) + (props.booking.infants ?? 0))
const guestsLabel = computed(() => `${guests.value} ${guests.value === 1 ? 'guest' : 'guests'}`)
const upsellsLabel = computed(() => `${props.upsells} upsell ${props.upsells === 1 ? 'order' : 'orders'}`)

const label = computed(() => {
  const flags = `${props.actionNeeded ? ', action needed' : ''}${props.conflict ? ', double booked' : ''}`
  if (isBlock.value)
    return `${title.value}, ${formatShort(props.booking.checkIn)} to ${formatShort(props.booking.checkOut)}, ${reservationStatusLabels[status.value]}${flags}`
  const details = [
    props.checkInTime && `check-in ${props.checkInTime}`,
    guests.value > 0 && guestsLabel.value,
    props.upsells && upsellsLabel.value,
  ].filter(Boolean).map(d => `, ${d}`).join('')
  return `${title.value}, ${props.booking.source}, ${formatShort(props.booking.checkIn)} to ${formatShort(props.booking.checkOut)}${details}, ${reservationStatusLabels[status.value]}${flags}`
})

/** Slanted where the stay really starts or ends, square where it runs off the view. */
const shape = computed(() => {
  const left = props.continuesBefore ? ['0 0', '0 100%'] : [`${SLANT} 0`, '0 100%']
  const right = props.continuesAfter ? ['100% 0', '100% 100%'] : ['100% 0', `calc(100% - ${SLANT}) 100%`]
  return `polygon(${left[0]}, ${right[0]}, ${right[1]}, ${left[1]})`
})

// Diagonal hatching for a cancelled stay, from theme tokens so it follows dark mode.
const HATCH = 'repeating-linear-gradient(135deg, color-mix(in oklab, var(--background) 22%, transparent) 0 1.5px, transparent 1.5px 6px)'

// The hover card closes when the bar is clicked, so it never sits on top of the sheet that opens.
const hoverOpen = ref(false)

function open() {
  hoverOpen.value = false
  emit('open', props.booking)
}

function openInbox() {
  hoverOpen.value = false
  emit('openInbox', props.booking)
}

function onDragStart(event: DragEvent) {
  hoverOpen.value = false
  event.dataTransfer?.setData(STAY_DRAG_TYPE, props.booking.id)
  event.dataTransfer?.setData('text/plain', props.booking.guestName)
  if (event.dataTransfer)
    event.dataTransfer.effectAllowed = 'move'
  emit('dragStart', props.booking)
}
</script>

<template>
  <div
    class="relative my-1 flex h-8 min-w-0 transition-opacity motion-reduce:transition-none"
    :class="[dimmed ? 'opacity-30' : past && 'opacity-55']"
    :style="{ zIndex: isCancelled ? 5 : 10, ...gridStyle }"
  >
    <ListingStayHoverCard v-model:open="hoverOpen" :booking="booking" :listing="listing">
      <button
        type="button"
        class="@container flex size-full min-w-0 items-center gap-1.5 text-left text-xs font-medium transition-[filter] hover:brightness-95 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset"
        :class="[
          isCancelled ? 'bg-muted-foreground/85 text-background' : stayBarClasses[status],
          // The text clears the slant; a square end needs only a little room.
          continuesBefore ? 'pl-2' : 'pl-4',
          continuesAfter ? 'pr-2' : 'pr-4',
          conflict && 'ring-2 ring-destructive ring-inset',
          draggable && 'cursor-grab active:cursor-grabbing',
        ]"
        :style="{ clipPath: shape, backgroundImage: isCancelled ? HATCH : undefined }"
        :aria-label="label"
        :draggable="draggable ? 'true' : undefined"
        :data-testid="isCancelled ? 'cockpit-cancelled-bar' : 'calendar-stay-bar'"
        data-cockpit-bar
        :data-row-index="rowIndex"
        :data-start="startHalf"
        @click="open"
        @dragstart="draggable && onDragStart($event)"
        @dragend="emit('dragEnd')"
      >
        <span v-if="actionNeeded" class="w-3 shrink-0" aria-hidden="true" />
        <Icon v-if="isBlock" name="lucide:ban" class="size-3 shrink-0" />
        <Icon v-if="conflict" name="lucide:triangle-alert" class="size-3 shrink-0" />
        <span
          v-if="!isBlock && booking.source"
          class="flex size-5 shrink-0 items-center justify-center rounded-full bg-background text-foreground"
          :title="booking.source"
          data-testid="cockpit-bar-channel"
        >
          <Icon :name="otaIcon(booking.source)" class="size-3" aria-hidden="true" />
        </span>
        <span class="min-w-0 truncate">{{ title }}</span>
        <template v-if="!isBlock">
          <span
            v-if="checkInTime"
            class="hidden shrink-0 items-center gap-0.5 font-normal tabular-nums opacity-80 @min-[14rem]:inline-flex"
            :title="`Check-in ${checkInTime}`"
            data-testid="cockpit-bar-checkin"
          >
            <Icon name="lucide:clock" class="size-3" aria-hidden="true" />{{ checkInTime }}
          </span>
          <span
            v-if="guests > 0"
            class="hidden shrink-0 items-center gap-0.5 font-normal tabular-nums opacity-80 @min-[10rem]:inline-flex"
            :title="guestsLabel"
            data-testid="cockpit-bar-guests"
          >
            <Icon name="lucide:users" class="size-3" aria-hidden="true" />{{ guests }}
          </span>
          <span
            v-if="upsells"
            class="hidden size-5 shrink-0 items-center justify-center rounded-full bg-background text-foreground @min-[6rem]:inline-flex"
            :title="upsellsLabel"
            data-testid="cockpit-bar-upsells"
          >
            <Icon name="lucide:shopping-bag" class="size-3" aria-hidden="true" />
          </span>
        </template>
      </button>
    </ListingStayHoverCard>

    <!-- A red dot at the bar's start, outside the bar button. -->
    <button
      v-if="actionNeeded"
      type="button"
      class="absolute top-1/2 flex size-3.5 -translate-y-1/2 items-center justify-center rounded-full bg-destructive ring-2 ring-card hover:scale-110 focus-visible:ring-ring focus-visible:outline-none motion-reduce:hover:scale-100"
      :class="continuesBefore ? 'left-1.5' : 'left-3'"
      :aria-label="`Action needed: open ${booking.guestName}'s conversation in the Inbox`"
      title="Action needed. Open in the Inbox"
      data-testid="cockpit-action-needed"
      @click.stop="openInbox"
    />
  </div>
</template>
