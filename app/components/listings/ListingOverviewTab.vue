<script setup lang="ts">
import type { Listing, Unit } from '~/components/listings/data/listings'
import { bookingStatusMeta, getUnitTypeForUnit } from '~/components/listings/data/listings'

const props = defineProps<{ listing: Listing, activeUnit?: Unit | null }>()
const emit = defineEmits<{ switchTab: [tab: string] }>()

const activeUnitType = computed(() => {
  if (!props.activeUnit)
    return null
  return getUnitTypeForUnit(props.listing, props.activeUnit.id)
})

const stats = computed(() => [
  { label: 'Monthly Revenue', value: `$${props.listing.stats.monthlyRevenue.toLocaleString()}`, trend: props.listing.stats.revenueTrend, icon: 'lucide:dollar-sign' },
  { label: 'Occupancy Rate', value: `${props.listing.stats.occupancyRate}%`, trend: props.listing.stats.occupancyTrend, icon: 'lucide:calendar-check' },
  { label: 'Avg Rating', value: `${props.listing.stats.avgRating}`, subtitle: `${props.listing.stats.totalReviews} reviews`, icon: 'lucide:star' },
  { label: 'Nightly Rate', value: `$${props.listing.pricing.nightlyRate}`, subtitle: 'avg across OTAs', icon: 'lucide:bed-double' },
])

const upcomingBookings = computed(() =>
  props.listing.bookings.filter(b => b.status !== 'cancelled').slice(0, 3),
)

const recentReviews = computed(() => props.listing.reviews.slice(0, 2))

function formatDateRange(checkIn: string, checkOut: string) {
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  return `${new Date(checkIn).toLocaleDateString('en-US', opts)} \u2013 ${new Date(checkOut).toLocaleDateString('en-US', opts)}`
}

function renderStars(rating: number) {
  return '\u2605'.repeat(rating) + '\u2606'.repeat(5 - rating)
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <div v-if="activeUnit" class="flex items-center gap-2 rounded-lg border bg-muted/40 px-4 py-2.5">
      <Icon name="lucide:door-open" class="size-4 text-muted-foreground" />
      <span class="text-sm font-medium">{{ activeUnit.name }}</span>
      <span v-if="activeUnitType" class="text-xs text-muted-foreground">· {{ activeUnitType.maxAdults + activeUnitType.maxChildren }} guests</span>
    </div>
    <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <Card v-for="stat in stats" :key="stat.label" class="p-5">
        <div class="flex items-center gap-3">
          <div class="flex size-9 items-center justify-center rounded-full bg-muted">
            <Icon :name="stat.icon" class="size-4 text-muted-foreground" />
          </div>
          <div class="flex flex-col">
            <span class="text-xs text-muted-foreground">{{ stat.label }}</span>
            <span class="text-lg font-semibold">{{ stat.value }}</span>
            <span v-if="stat.trend !== undefined" class="text-xs" :class="stat.trend >= 0 ? 'text-green-500' : 'text-red-500'">
              {{ stat.trend >= 0 ? '\u2191' : '\u2193' }} {{ Math.abs(stat.trend) }}% vs last month
            </span>
            <span v-else-if="stat.subtitle" class="text-xs text-muted-foreground">{{ stat.subtitle }}</span>
          </div>
        </div>
      </Card>
    </div>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card class="p-5">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-sm font-semibold">
            Upcoming Bookings
          </h3>
          <Button variant="link" size="sm" class="h-auto p-0 text-xs" @click="emit('switchTab', 'calendar')">
            View Calendar →
          </Button>
        </div>
        <div class="flex flex-col gap-3">
          <div v-for="booking in upcomingBookings" :key="booking.id" class="flex items-center justify-between rounded-lg border p-3">
            <div class="flex flex-col gap-0.5">
              <span class="text-sm font-medium">{{ formatDateRange(booking.checkIn, booking.checkOut) }}</span>
              <span class="text-xs text-muted-foreground">{{ booking.guestName }} · {{ booking.nights }} nights</span>
            </div>
            <Badge
              :variant="(bookingStatusMeta[booking.status]?.variant ?? 'secondary') as any"
              :class="['text-xs capitalize', bookingStatusMeta[booking.status]?.badgeClass]"
            >
              {{ bookingStatusMeta[booking.status]?.label ?? booking.status }}
            </Badge>
          </div>
          <p v-if="upcomingBookings.length === 0" class="text-sm text-muted-foreground text-center py-4">
            No upcoming bookings
          </p>
        </div>
      </Card>

      <Card class="p-5">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-sm font-semibold">
            Recent Reviews
          </h3>
          <Button variant="link" size="sm" class="h-auto p-0 text-xs" @click="emit('switchTab', 'reviews')">
            View All →
          </Button>
        </div>
        <div class="flex flex-col gap-3">
          <div v-for="review in recentReviews" :key="review.id" class="rounded-lg border p-3">
            <div class="flex items-center justify-between mb-1">
              <span class="text-sm font-medium">{{ review.guestName }}</span>
              <span class="text-xs text-amber-500">{{ renderStars(review.rating) }}</span>
            </div>
            <p class="text-xs text-muted-foreground line-clamp-2">
              {{ review.text }}
            </p>
          </div>
          <p v-if="recentReviews.length === 0" class="text-sm text-muted-foreground text-center py-4">
            No reviews yet
          </p>
        </div>
      </Card>
    </div>
  </div>
</template>
