<script setup lang="ts">
import type { Booking } from '~/components/listings/data/listings'
import { listings } from '~/components/listings/data/listings'

const props = defineProps<{
  listingId: string
  targetDate?: string
}>()

const guestBooking = computed<Booking | null>(() => {
  if (!props.listingId)
    return null
  const listing = listings.value.find(l => l.id === props.listingId)
  if (!listing?.bookings?.length)
    return null
  const target = props.targetDate || new Date().toISOString().slice(0, 10)
  const overlapping = listing.bookings
    .filter(b => b.status !== 'cancelled' && b.checkIn <= target && b.checkOut >= target)
    .sort((a, b) => a.checkIn.localeCompare(b.checkIn))[0]
  if (overlapping)
    return overlapping
  const upcoming = listing.bookings
    .filter(b => b.status !== 'cancelled' && b.checkIn > target)
    .sort((a, b) => a.checkIn.localeCompare(b.checkIn))[0]
  return upcoming ?? null
})

const isCurrentStay = computed(() => {
  if (!props.targetDate || !guestBooking.value)
    return false
  return guestBooking.value.checkIn <= props.targetDate
    && guestBooking.value.checkOut >= props.targetDate
})

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}
</script>

<template>
  <div
    v-if="guestBooking"
    class="flex items-center gap-3 rounded-lg border bg-muted/30 p-3"
    data-testid="guest-info-card"
  >
    <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
      {{ guestBooking.guestName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() }}
    </div>
    <div class="flex min-w-0 flex-1 flex-col gap-0.5">
      <div class="flex items-center gap-2">
        <span class="truncate text-sm font-semibold">{{ guestBooking.guestName }}</span>
        <Badge
          v-if="isCurrentStay"
          variant="default"
          class="text-[10px]"
        >
          In stay
        </Badge>
        <Badge
          v-else
          variant="secondary"
          class="text-[10px]"
        >
          Upcoming
        </Badge>
      </div>
      <p class="text-xs text-muted-foreground">
        {{ formatDate(guestBooking.checkIn) }} → {{ formatDate(guestBooking.checkOut) }}
        · {{ guestBooking.nights }} {{ guestBooking.nights === 1 ? 'night' : 'nights' }}
        · {{ guestBooking.source }}
      </p>
    </div>
    <div
      v-if="guestBooking.hasPet"
      class="flex h-7 shrink-0 items-center gap-1 rounded-full bg-amber-500/10 px-2 text-xs font-medium text-amber-700"
      data-testid="guest-has-pet"
    >
      <Icon name="lucide:paw-print" class="h-3.5 w-3.5" />
      Pet
    </div>
    <div
      v-else
      class="flex h-7 shrink-0 items-center gap-1 rounded-full bg-muted px-2 text-xs text-muted-foreground"
      data-testid="guest-no-pet"
    >
      <Icon name="lucide:paw-print" class="h-3.5 w-3.5" />
      No pet
    </div>
  </div>
</template>
