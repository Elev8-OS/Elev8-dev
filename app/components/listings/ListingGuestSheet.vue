<script setup lang="ts">
import type { Booking, Listing } from '~/components/listings/data/listings'
import { otaIcon } from '~/components/channels/data/channels'
import { bookingReservationStatus } from '~/components/operations-calendar/data/calendar-stays'
import ReservationStatusBadge from '~/components/reservations/ReservationStatusBadge.vue'
import { useReservationsModule } from '~/composables/useReservationsModule'

const props = defineProps<{ booking: Booking | null, listing: Listing }>()
const open = defineModel<boolean>('open', { default: false })

// Only for listing bookings: a Reservations-module stay opens `ReservationDetailSheet` instead.
const { getListingCheckInTime, getListingCheckOutTime } = useReservationsModule()

const isBlock = computed(() => props.booking?.type === 'block')

const currency = computed(() => props.listing.unitTypes?.[0]?.pricing.currency ?? 'USD')

const checkInTime = computed(() => getListingCheckInTime(props.listing.id))
const checkOutTime = computed(() => getListingCheckOutTime(props.listing.id))

const guestBreakdown = computed(() => {
  const b = props.booking
  if (!b)
    return []
  const parts: Array<{ label: string, count: number }> = [
    { label: 'Adults', count: b.adults ?? 0 },
    { label: 'Children', count: b.children ?? 0 },
    { label: 'Infants', count: b.infants ?? 0 },
  ]
  const pets = b.pets ?? (b.hasPet ? 1 : 0)
  if (pets > 0)
    parts.push({ label: pets === 1 ? 'Pet' : 'Pets', count: pets })
  return parts.filter(p => p.count > 0)
})

function formatLong(dateKey: string) {
  const [y, m, d] = dateKey.split('-').map(Number)
  return new Date(y!, m! - 1, d!).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
}

function formatAmount(amount: number) {
  const decimals = currency.value === 'IDR' ? 0 : 2
  const locale = currency.value === 'CHF' ? 'de-CH' : 'en-US'
  return `${currency.value} ${amount.toLocaleString(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`
}

function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
}
</script>

<template>
  <Sheet v-model:open="open">
    <SheetContent class="flex w-full flex-col gap-0 p-0 sm:max-w-md">
      <template v-if="booking">
        <SheetHeader class="border-b p-5">
          <div class="flex items-center gap-3">
            <div
              class="flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
              :class="isBlock ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'"
            >
              <Icon v-if="isBlock" name="lucide:ban" class="size-5" />
              <span v-else>{{ initials(booking.guestName) }}</span>
            </div>
            <div class="flex min-w-0 flex-col gap-1">
              <SheetTitle class="truncate">
                {{ isBlock ? (booking.blockReason ?? 'Blocked') : booking.guestName }}
              </SheetTitle>
              <SheetDescription class="flex flex-wrap items-center gap-2">
                <ReservationStatusBadge :status="bookingReservationStatus(booking)" class="text-[10px]" />
                <span v-if="!isBlock" class="flex items-center gap-1 text-xs">
                  <Icon :name="otaIcon(booking.source)" class="size-3" />
                  {{ booking.source }}
                </span>
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div class="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-5">
          <section class="flex flex-col gap-3">
            <h4 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Stay
            </h4>
            <div class="grid grid-cols-2 gap-3">
              <div class="rounded-lg border p-3">
                <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Icon name="lucide:log-in" class="size-3.5" />
                  Check-in
                </div>
                <p class="mt-1 text-sm font-medium">
                  {{ formatLong(booking.checkIn) }}
                </p>
                <p v-if="checkInTime" class="text-xs text-muted-foreground">
                  from {{ checkInTime }}
                </p>
              </div>
              <div class="rounded-lg border p-3">
                <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Icon name="lucide:log-out" class="size-3.5" />
                  Check-out
                </div>
                <p class="mt-1 text-sm font-medium">
                  {{ formatLong(booking.checkOut) }}
                </p>
                <p v-if="checkOutTime" class="text-xs text-muted-foreground">
                  by {{ checkOutTime }}
                </p>
              </div>
            </div>
            <div class="flex flex-wrap gap-2 text-sm">
              <Badge variant="outline" class="gap-1">
                <Icon name="lucide:moon" class="size-3" />
                {{ booking.nights }} {{ booking.nights === 1 ? 'night' : 'nights' }}
              </Badge>
              <Badge v-for="part in guestBreakdown" :key="part.label" variant="outline">
                {{ part.count }} {{ part.label }}
              </Badge>
            </div>
          </section>

          <section v-if="!isBlock" class="flex flex-col gap-3">
            <h4 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Booking
            </h4>
            <div class="flex items-center justify-between rounded-lg border p-3">
              <span class="text-sm text-muted-foreground">Total</span>
              <span class="text-sm font-semibold">{{ formatAmount(booking.revenue) }}</span>
            </div>
          </section>

          <p v-if="!isBlock" class="text-xs text-muted-foreground">
            Contact details are kept on reservations made in Elev8. This stay was imported with the listing.
          </p>
        </div>
      </template>
    </SheetContent>
  </Sheet>
</template>
