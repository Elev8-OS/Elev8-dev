<script setup lang="ts">
import type { ReservationEntry } from '~/components/reservations/data/reservations'
import { reservationStatusLabels } from '~/components/reservations/data/reservations'
import ReservationGuestCell from '~/components/reservations/ReservationGuestCell.vue'

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
</script>

<template>
  <Sheet :open="open" @update:open="emit('update:open', $event)">
    <SheetContent class="w-full sm:max-w-md">
      <SheetHeader>
        <SheetTitle>
          Reservation
        </SheetTitle>
        <SheetDescription v-if="reservation">
          {{ reservation.id }} · {{ reservationStatusLabels[reservation.status] }}
        </SheetDescription>
      </SheetHeader>

      <template v-if="reservation">
        <ScrollArea class="flex-1 pr-4">
          <div class="space-y-6 py-4">
            <!-- Guest -->
            <div>
              <div class="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                Guest
              </div>
              <div class="flex items-center justify-between gap-2">
                <button
                  type="button"
                  class="text-left hover:underline"
                  @click="emit('openGuest', reservation.guestId)"
                >
                  <ReservationGuestCell :name="reservation.guestName" :email="reservation.guestEmail" />
                </button>
              </div>
              <p class="mt-1 text-xs text-muted-foreground">
                {{ reservation.guestPhone }}
              </p>
            </div>

            <Separator />

            <!-- Listing -->
            <div>
              <div class="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                Listing
              </div>
              <NuxtLink :to="`/listings/${reservation.listingId}`" class="text-primary hover:underline text-sm font-medium">
                {{ reservation.listingName }}
              </NuxtLink>
            </div>

            <Separator />

            <!-- Dates -->
            <div class="grid grid-cols-2 gap-4">
              <div>
                <div class="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Check-in
                </div>
                <div class="text-sm font-medium">
                  {{ fmtDate(reservation.checkIn) }}
                </div>
              </div>
              <div>
                <div class="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Check-out
                </div>
                <div class="text-sm font-medium">
                  {{ fmtDate(reservation.checkOut) }}
                </div>
              </div>
            </div>

            <Separator />

            <!-- Details -->
            <div class="grid grid-cols-2 gap-4">
              <div>
                <div class="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Nights
                </div>
                <div class="text-sm font-medium">
                  {{ reservation.nights }}
                </div>
              </div>
              <div>
                <div class="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Guests
                </div>
                <div class="text-sm font-medium">
                  {{ reservation.guestCount }}
                </div>
              </div>
              <div>
                <div class="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Channel
                </div>
                <div class="text-sm font-medium">
                  {{ reservation.channel }}
                </div>
              </div>
              <div>
                <div class="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Total
                </div>
                <div class="text-sm font-semibold">
                  {{ fmtCurrency(reservation.totalPrice, reservation.currency) }}
                </div>
              </div>
            </div>

            <Separator />

            <!-- Notes -->
            <div>
              <div class="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                Guest notes
              </div>
              <p class="text-sm" :class="reservation.guestNotes ? '' : 'text-muted-foreground italic'">
                {{ reservation.guestNotes || 'No notes' }}
              </p>
            </div>
          </div>
        </ScrollArea>
      </template>
    </SheetContent>
  </Sheet>
</template>
