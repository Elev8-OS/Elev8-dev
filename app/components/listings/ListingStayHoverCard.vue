<script setup lang="ts">
import type { Booking, Listing } from '~/components/listings/data/listings'
import { otaIcon } from '~/components/channels/data/channels'
import { stayUnitNames } from '~/components/listings/data/calendar-rooms'
import { stayBarClasses } from '~/components/listings/data/stay-bar'
import { bookingReservationStatus } from '~/components/operations-calendar/data/calendar-stays'
import { reservationStatusLabels } from '~/components/reservations/data/reservations'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '~/components/ui/hover-card'
import { useReservationsModule } from '~/composables/useReservationsModule'

const props = defineProps<{ booking: Booking, listing: Listing }>()

const { reservations, getCheckInTime, getCheckOutTime, getListingCheckInTime, getListingCheckOutTime } = useReservationsModule()

/** The Reservations-module record behind the stay, when there is one: it has the times, currency and booking note. */
const reservation = computed(() => reservations.value.find(r => r.id === props.booking.id) ?? null)

/** A multi-room listing names the stay's rooms (priced lines, else the rooms it was put in). */
const isMultiRoom = computed(() => props.listing.unitType === 'multi' && (props.listing.unitTypes ?? []).reduce((n, t) => n + t.units.length, 0) > 1)
const rooms = computed(() => stayUnitNames(props.booking, reservations.value, props.listing))

const isBlock = computed(() => props.booking.type === 'block')
const status = computed(() => bookingReservationStatus(props.booking))

const checkInTime = computed(() => reservation.value ? getCheckInTime(reservation.value) : getListingCheckInTime(props.listing.id))
const checkOutTime = computed(() => reservation.value ? getCheckOutTime(reservation.value) : getListingCheckOutTime(props.listing.id))

const currency = computed(() => reservation.value?.currency ?? props.listing.unitTypes?.[0]?.pricing.currency ?? 'USD')

const occupants = computed(() => [
  { icon: 'lucide:user', count: props.booking.adults ?? 0, one: 'Adult', many: 'Adults' },
  { icon: 'lucide:baby', count: props.booking.children ?? 0, one: 'Child', many: 'Children' },
  { icon: 'lucide:milk', count: props.booking.infants ?? 0, one: 'Infant', many: 'Infants' },
])

const pets = computed(() => props.booking.pets ?? (props.booking.hasPet ? 1 : 0))

const note = computed(() => reservation.value?.bookingNote || reservation.value?.guestNotes || '')

function formatLong(dateKey: string) {
  const [y, m, d] = dateKey.split('-').map(Number)
  return new Date(y!, m! - 1, d!).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

function formatAmount(amount: number) {
  const decimals = currency.value === 'IDR' ? 0 : 2
  const locale = currency.value === 'CHF' ? 'de-CH' : 'en-US'
  return `${currency.value} ${amount.toLocaleString(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`
}
</script>

<template>
  <HoverCard :open-delay="250" :close-delay="100">
    <HoverCardTrigger as-child>
      <slot />
    </HoverCardTrigger>
    <HoverCardContent class="w-80 p-4" side="bottom" align="start" data-testid="stay-hover-card">
      <div class="flex items-start justify-between gap-3">
        <div class="flex min-w-0 flex-col gap-1.5">
          <Badge class="w-fit border text-[10px]" :class="stayBarClasses[status]">
            {{ reservationStatusLabels[status] }}
          </Badge>
          <p class="truncate text-base font-semibold">
            {{ isBlock ? (booking.blockReason ?? 'Blocked') : booking.guestName }}
          </p>
        </div>
        <div
          v-if="!isBlock"
          class="flex size-9 shrink-0 items-center justify-center rounded-full border bg-background"
          :title="booking.source"
        >
          <Icon :name="otaIcon(booking.source)" class="size-5" />
        </div>
      </div>

      <div v-if="!isBlock" class="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span v-for="o in occupants" :key="o.one" class="flex items-center gap-1">
          <Icon :name="o.icon" class="size-3.5" />
          {{ o.count }} {{ o.count === 1 ? o.one : o.many }}
        </span>
        <span v-if="pets > 0" class="flex items-center gap-1">
          <Icon name="lucide:paw-print" class="size-3.5" />
          {{ pets }} {{ pets === 1 ? 'Pet' : 'Pets' }}
        </span>
      </div>

      <div class="mt-3 flex flex-col gap-1.5 text-xs">
        <div class="flex items-start gap-2">
          <Icon name="lucide:calendar-days" class="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
          <span>
            {{ formatLong(booking.checkIn) }} {{ checkInTime }}
            → {{ formatLong(booking.checkOut) }} {{ checkOutTime }}
            <span class="text-muted-foreground">· {{ booking.nights }} {{ booking.nights === 1 ? 'night' : 'nights' }}</span>
          </span>
        </div>
        <div class="flex items-start gap-2">
          <Icon name="lucide:map-pin" class="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
          <span>{{ listing.location }}</span>
        </div>
        <div v-if="isMultiRoom && !isBlock" class="flex items-start gap-2" data-testid="hover-rooms">
          <Icon name="lucide:bed-double" class="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
          <span :class="!rooms.length && 'text-muted-foreground'">{{ rooms.length ? rooms.join(', ') : 'Not assigned to a room' }}</span>
        </div>
      </div>

      <div v-if="!isBlock" class="mt-3 flex items-center justify-between border-t pt-3 text-sm">
        <span class="text-muted-foreground">Total amount</span>
        <span class="font-semibold">{{ formatAmount(booking.revenue) }}</span>
      </div>

      <p v-if="note && !isBlock" class="mt-3 line-clamp-4 border-t pt-3 text-xs text-muted-foreground">
        {{ note }}
      </p>
    </HoverCardContent>
  </HoverCard>
</template>
