<script setup lang="ts">
import type { Booking } from '~/components/listings/data/listings'
import { blockStatusMeta, bookingStatusMeta, listings } from '~/components/listings/data/listings'

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

const isBlock = computed(() => guestBooking.value?.type === 'block')

const isCurrentStay = computed(() => {
  if (!props.targetDate || !guestBooking.value)
    return false
  return guestBooking.value.checkIn <= props.targetDate
    && guestBooking.value.checkOut >= props.targetDate
})

const statusMeta = computed(() => {
  if (!guestBooking.value)
    return null
  if (isBlock.value)
    return blockStatusMeta
  return bookingStatusMeta[guestBooking.value.status] ?? null
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
    v-if="guestBooking && statusMeta"
    class="flex items-start gap-3 rounded-lg border p-3"
    :class="[statusMeta.cardClass, statusMeta.isStrikethrough && 'line-through opacity-70']"
    data-testid="guest-info-card"
    :data-booking-status="guestBooking.status"
  >
    <div
      class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
      :class="isBlock ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'"
    >
      <Icon
        v-if="isBlock"
        :name="statusMeta.icon"
        class="h-4 w-4"
      />
      <span v-else>{{ guestBooking.guestName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() }}</span>
    </div>
    <div class="flex min-w-0 flex-1 flex-col gap-0.5">
      <div class="flex flex-wrap items-center gap-2">
        <span class="truncate text-sm font-semibold">{{ guestBooking.guestName }}</span>
        <Badge
          :variant="statusMeta.variant"
          class="gap-1 text-[10px] font-medium"
          :class="statusMeta.badgeClass"
          data-testid="guest-status-badge"
        >
          <Icon :name="statusMeta.icon" class="h-3 w-3" />
          {{ statusMeta.label }}
        </Badge>
        <Badge
          v-if="isCurrentStay && !isBlock"
          variant="default"
          class="text-[10px]"
        >
          In stay
        </Badge>
      </div>
      <p
        class="text-xs"
        :class="isBlock ? 'text-white/70' : 'text-muted-foreground'"
      >
        {{ formatDate(guestBooking.checkIn) }} → {{ formatDate(guestBooking.checkOut) }}
        · {{ guestBooking.nights }} {{ guestBooking.nights === 1 ? 'night' : 'nights' }}
        <template v-if="!isBlock">· {{ guestBooking.source }}</template>
      </p>
      <p
        v-if="isBlock && guestBooking.blockReason"
        class="mt-0.5 text-xs text-white/80"
      >
        <Icon name="lucide:info" class="mr-0.5 inline h-3 w-3" />
        {{ guestBooking.blockReason }}
      </p>
    </div>
    <div
      v-if="!isBlock && guestBooking.hasPet"
      class="flex h-7 shrink-0 items-center gap-1 rounded-full bg-amber-500/10 px-2 text-xs font-medium text-amber-700"
      data-testid="guest-has-pet"
    >
      <Icon name="lucide:paw-print" class="h-3.5 w-3.5" />
      Pet
    </div>
    <div
      v-else-if="!isBlock"
      class="flex h-7 shrink-0 items-center gap-1 rounded-full bg-muted px-2 text-xs text-muted-foreground"
      data-testid="guest-no-pet"
    >
      <Icon name="lucide:paw-print" class="h-3.5 w-3.5" />
      No pet
    </div>
  </div>
</template>
