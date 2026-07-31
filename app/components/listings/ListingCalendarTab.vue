<script setup lang="ts">
import type { Booking, Listing, Unit } from '~/components/listings/data/listings'
import { bookingStatusMeta } from '~/components/listings/data/listings'

const props = defineProps<{ listing: Listing, activeUnit?: Unit | null }>()

const bookingStatusColors: Record<string, string> = Object.fromEntries(
  Object.entries(bookingStatusMeta).map(([key, meta]) => [key, meta.variant]),
)

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function monthKey(dateStr: string) {
  return dateStr.slice(0, 7)
}

function formatMonth(monthKey: string) {
  const [year, month] = monthKey.split('-')
  if (!year || !month)
    return monthKey
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

const sortedBookings = computed(() =>
  [...props.listing.bookings].sort((a, b) => new Date(a.checkIn).getTime() - new Date(b.checkIn).getTime()),
)

const bookingsByMonth = computed<Array<{ month: string, label: string, bookings: Booking[] }>>(() => {
  const groups = new Map<string, Booking[]>()
  for (const booking of sortedBookings.value) {
    const key = monthKey(booking.checkIn)
    const list = groups.get(key) ?? []
    list.push(booking)
    groups.set(key, list)
  }
  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, bookings]) => ({ month, label: formatMonth(month), bookings }))
})
</script>

<template>
  <div class="flex flex-col gap-6">
    <Card class="p-5">
      <div class="mb-4 flex items-center justify-between">
        <h3 class="text-sm font-semibold">
          All Bookings
        </h3>
        <span class="text-xs text-muted-foreground">{{ sortedBookings.length }} total</span>
      </div>
      <div v-if="sortedBookings.length > 0" class="flex flex-col gap-6">
        <div v-for="group in bookingsByMonth" :key="group.month" class="flex flex-col gap-3">
          <div class="flex items-center gap-2">
            <Icon name="lucide:calendar" class="size-3.5 text-muted-foreground" />
            <h4 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {{ group.label }}
            </h4>
            <span class="text-xs text-muted-foreground">· {{ group.bookings.length }} {{ group.bookings.length === 1 ? 'booking' : 'bookings' }}</span>
          </div>
          <div
            v-for="booking in group.bookings"
            :key="booking.id"
            class="flex items-center justify-between rounded-lg border p-4"
          >
            <div class="flex flex-col gap-1">
              <div class="flex items-center gap-2">
                <span class="text-sm font-medium">{{ booking.guestName }}</span>
                <Badge
                  v-if="booking.type === 'block'"
                  variant="outline"
                  class="bg-zinc-900 px-1.5 py-0 text-[10px] text-white"
                >
                  <Icon name="lucide:ban" class="mr-0.5 size-2.5" />
                  Block
                </Badge>
              </div>
              <span class="text-xs text-muted-foreground">
                {{ formatDate(booking.checkIn) }} → {{ formatDate(booking.checkOut) }} · {{ booking.nights }} nights
              </span>
              <span class="text-xs text-muted-foreground">
                <template v-if="booking.type === 'block' && booking.blockReason">
                  {{ booking.blockReason }}
                </template>
                <template v-else>
                  via {{ booking.source }}
                </template>
              </span>
            </div>
            <div class="flex flex-col items-end gap-1">
              <Badge
                :variant="(bookingStatusColors[booking.status] as any)"
                :class="['text-xs capitalize', bookingStatusMeta[booking.status]?.badgeClass]"
              >
                {{ bookingStatusMeta[booking.status]?.label ?? booking.status }}
              </Badge>
              <span v-if="booking.type !== 'block'" class="text-sm font-medium">${{ booking.revenue }}</span>
            </div>
          </div>
        </div>
      </div>
      <p v-else class="text-sm text-muted-foreground text-center py-4">
        No bookings yet
      </p>
    </Card>

    <Card class="p-5">
      <h3 class="text-sm font-semibold mb-4">
        Blocked Dates
      </h3>
      <div v-if="listing.blockedDates.length > 0" class="flex flex-wrap gap-2">
        <Badge v-for="date in listing.blockedDates" :key="date" variant="outline" class="text-xs">
          {{ formatDate(date) }}
        </Badge>
      </div>
      <p v-else class="text-sm text-muted-foreground">
        No blocked dates.
      </p>
    </Card>
  </div>
</template>
