<script setup lang="ts">
import type { ReservationEntry } from '~/components/reservations/data/reservations'
import { listings } from '~/components/listings/data/listings'

defineProps<{
  reservation: ReservationEntry | null
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'openGuest': [id: string]
}>()

const df = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

function fmtDate(iso: string): string {
  return df.format(new Date(`${iso}T00:00:00Z`))
}

function fmtCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
}

function listingPhoto(listingId: string): string {
  return listings.value.find(l => l.id === listingId)?.photos?.[0] ?? ''
}

function channelIcon(channel: string): string {
  if (channel === 'Airbnb')
    return 'logos:airbnb'
  if (channel === 'Booking.com')
    return 'simple-icons:bookingdotcom'
  return 'lucide:globe'
}

function partyLabel(count: number): string {
  if (count <= 0)
    return ''
  return count === 1 ? '1 Guest' : `${count} Guests`
}

function initials(name: string): string {
  return name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()
}
</script>

<template>
  <Sheet :open="open" @update:open="emit('update:open', $event)">
    <SheetContent class="flex w-full flex-col gap-0 overflow-hidden bg-neutral-50 p-0 sm:max-w-md" side="right">
      <template v-if="reservation">
        <ScrollArea class="flex-1">
          <div class="flex flex-col gap-4 p-4">
            <!-- Photo hero (rounded, Airbnb-style) -->
            <div class="relative h-40 w-full shrink-0 overflow-hidden rounded-2xl">
              <img
                :src="listingPhoto(reservation.listingId)"
                :alt="reservation.listingName"
                class="h-full w-full object-cover"
              >
              <div class="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
              <!-- Status chip -->
              <div class="absolute top-3 left-3">
                <ReservationStatusBadge :status="reservation.status" />
              </div>
              <!-- Channel logo -->
              <div class="absolute top-3 right-3 flex size-9 items-center justify-center rounded-full bg-white/90 shadow-sm">
                <Icon :name="channelIcon(reservation.channel)" class="size-5" />
              </div>
              <!-- Listing name on banner -->
              <div class="absolute bottom-3 left-4 right-4">
                <NuxtLink :to="`/listings/${reservation.listingId}`" class="text-white hover:underline text-lg font-semibold leading-tight">
                  {{ reservation.listingName }}
                </NuxtLink>
              </div>
            </div>

            <!-- Reservation id + price card -->
            <div class="rounded-2xl border bg-white p-4 shadow-sm">
              <div class="flex items-center justify-between">
                <div>
                  <div class="text-[11px] font-medium text-neutral-500 uppercase tracking-wide">
                    Reservation
                  </div>
                  <div class="font-mono text-sm font-semibold text-neutral-900">
                    {{ reservation.id }}
                  </div>
                </div>
                <div class="text-right">
                  <div class="text-[11px] font-medium text-neutral-500 uppercase tracking-wide">
                    Total
                  </div>
                  <div class="text-xl font-bold text-neutral-900">
                    {{ fmtCurrency(reservation.totalPrice, reservation.currency) }}
                  </div>
                </div>
              </div>
            </div>

            <!-- Guest card -->
            <div class="rounded-2xl border bg-white p-4 shadow-sm">
              <div class="flex items-center gap-3">
                <Avatar class="size-11">
                  <AvatarFallback class="bg-[#FF385C]/10 text-[#FF385C] text-sm">
                    {{ initials(reservation.guestName) }}
                  </AvatarFallback>
                </Avatar>
                <div class="min-w-0 flex-1">
                  <button
                    type="button"
                    class="block text-left hover:underline"
                    @click="emit('openGuest', reservation.guestId)"
                  >
                    <span class="font-semibold text-neutral-900">{{ reservation.guestName }}</span>
                  </button>
                  <p class="text-xs text-neutral-500 truncate">
                    {{ reservation.guestEmail }} · {{ reservation.guestPhone }}
                  </p>
                </div>
              </div>
              <div v-if="partyLabel(reservation.guestCount)" class="mt-2.5 flex items-center gap-1.5 text-xs text-neutral-500">
                <Icon name="lucide:users" class="size-3.5" />
                {{ partyLabel(reservation.guestCount) }}
              </div>
              <div v-if="reservation.guestNotes" class="mt-3 flex items-start gap-2 rounded-xl bg-neutral-50 p-3 text-xs text-neutral-600">
                <Icon name="lucide:notebook-pen" class="mt-0.5 size-3.5 shrink-0" />
                {{ reservation.guestNotes }}
              </div>
            </div>

            <!-- Dates card -->
            <div class="rounded-2xl border bg-white p-4 shadow-sm">
              <div class="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <div>
                  <div class="text-[11px] font-medium text-neutral-500 uppercase tracking-wide">
                    Check-in
                  </div>
                  <div class="text-base font-semibold text-neutral-900">
                    {{ fmtDate(reservation.checkIn) }}
                  </div>
                  <div class="text-xs text-neutral-500">
                    2:00 PM
                  </div>
                </div>
                <div class="flex flex-col items-center gap-1">
                  <div class="flex h-9 w-9 items-center justify-center rounded-full bg-[#FF385C]/10 text-[#FF385C]">
                    <Icon name="lucide:moon-star" class="size-4" />
                  </div>
                  <span class="text-[11px] font-medium text-neutral-500">
                    {{ reservation.nights }} nights
                  </span>
                </div>
                <div class="text-right">
                  <div class="text-[11px] font-medium text-neutral-500 uppercase tracking-wide">
                    Check-out
                  </div>
                  <div class="text-base font-semibold text-neutral-900">
                    {{ fmtDate(reservation.checkOut) }}
                  </div>
                  <div class="text-xs text-neutral-500">
                    11:00 AM
                  </div>
                </div>
              </div>
            </div>

            <!-- Details row -->
            <div class="grid grid-cols-2 gap-4 rounded-2xl border bg-white p-4 shadow-sm">
              <div class="flex items-center gap-2.5">
                <Icon name="lucide:users" class="size-4 text-neutral-400" />
                <div>
                  <div class="text-[11px] font-medium text-neutral-500 uppercase tracking-wide">
                    Guests
                  </div>
                  <div class="text-sm font-medium text-neutral-900">
                    {{ reservation.guestCount }}
                  </div>
                </div>
              </div>
              <div class="flex items-center gap-2.5">
                <Icon :name="channelIcon(reservation.channel)" class="size-4 text-neutral-400" />
                <div>
                  <div class="text-[11px] font-medium text-neutral-500 uppercase tracking-wide">
                    Channel
                  </div>
                  <div class="text-sm font-medium text-neutral-900">
                    {{ reservation.channel }}
                  </div>
                </div>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex gap-2">
              <Button variant="outline" size="sm" class="flex-1 gap-1.5 rounded-full border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-100" @click="emit('openGuest', reservation.guestId)">
                <Icon name="lucide:user-round" class="size-3.5" />
                Guest profile
              </Button>
              <Button variant="outline" size="sm" class="flex-1 gap-1.5 rounded-full border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-100" as-child>
                <NuxtLink :to="`/listings/${reservation.listingId}`">
                  <Icon name="lucide:building-2" class="size-3.5" />
                  View listing
                </NuxtLink>
              </Button>
            </div>
          </div>
        </ScrollArea>
      </template>

      <template v-else>
        <SheetHeader class="border-b px-6 py-4">
          <SheetTitle>
            Reservation
          </SheetTitle>
        </SheetHeader>
        <div class="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
          No reservation selected.
        </div>
      </template>
    </SheetContent>
  </Sheet>
</template>
