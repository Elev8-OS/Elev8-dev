<script setup lang="ts">
import type { ReservationEntry } from '~/components/reservations/data/reservations'
import ReservationGuestCell from '~/components/reservations/ReservationGuestCell.vue'
import ReservationStatusBadge from '~/components/reservations/ReservationStatusBadge.vue'

defineProps<{ reservations: ReservationEntry[] }>()

const emit = defineEmits<{
  openGuest: [id: string]
  openDetail: [reservation: ReservationEntry]
  copyId: [id: string]
}>()

const df = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

function fmtDate(iso: string): string {
  return df.format(new Date(`${iso}T00:00:00Z`))
}

function fmtCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
}
</script>

<template>
  <div class="rounded-md border">
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="bg-muted/50 text-xs uppercase text-muted-foreground">
          <tr>
            <th class="text-left font-medium px-4 py-3">
              Guest
            </th>
            <th class="text-left font-medium px-4 py-3">
              Listing
            </th>
            <th class="text-left font-medium px-4 py-3">
              Check-in
            </th>
            <th class="text-left font-medium px-4 py-3">
              Check-out
            </th>
            <th class="text-left font-medium px-4 py-3">
              Nights
            </th>
            <th class="text-left font-medium px-4 py-3">
              Guests
            </th>
            <th class="text-left font-medium px-4 py-3">
              Channel
            </th>
            <th class="text-right font-medium px-4 py-3">
              Total
            </th>
            <th class="text-left font-medium px-4 py-3">
              Status
            </th>
            <th class="text-left font-medium px-4 py-3">
              <span class="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="r in reservations"
            :key="r.id"
            class="border-t hover:bg-muted/30 transition-colors cursor-pointer"
            @click="emit('openDetail', r)"
          >
            <td class="px-4 py-3" @click.stop>
              <button
                type="button"
                class="text-left hover:underline"
                @click="emit('openGuest', r.guestId)"
              >
                <ReservationGuestCell :name="r.guestName" :email="r.guestEmail" />
              </button>
            </td>
            <td class="px-4 py-3">
              <NuxtLink :to="`/listings/${r.listingId}`" class="text-primary hover:underline">
                {{ r.listingName }}
              </NuxtLink>
            </td>
            <td class="px-4 py-3">
              {{ fmtDate(r.checkIn) }}
            </td>
            <td class="px-4 py-3">
              {{ fmtDate(r.checkOut) }}
            </td>
            <td class="px-4 py-3">
              {{ r.nights }}
            </td>
            <td class="px-4 py-3">
              {{ r.guestCount }}
            </td>
            <td class="px-4 py-3">
              {{ r.channel }}
            </td>
            <td class="px-4 py-3 text-right tabular-nums">
              {{ fmtCurrency(r.totalPrice, r.currency) }}
            </td>
            <td class="px-4 py-3">
              <ReservationStatusBadge :status="r.status" />
            </td>
            <td class="px-4 py-3" @click.stop>
              <DropdownMenu>
                <DropdownMenuTrigger as-child>
                  <Button variant="ghost" size="sm" class="h-8 w-8 p-0">
                    <Icon name="lucide:more-horizontal" class="size-4" />
                    <span class="sr-only">Actions</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem @click="emit('openDetail', r)">
                    <Icon name="lucide:eye" class="mr-2 size-4" />
                    View Reservation
                  </DropdownMenuItem>
                  <DropdownMenuItem @click="emit('openGuest', r.guestId)">
                    <Icon name="lucide:user" class="mr-2 size-4" />
                    Open Guest
                  </DropdownMenuItem>
                  <DropdownMenuItem @click="emit('copyId', r.id)">
                    <Icon name="lucide:copy" class="mr-2 size-4" />
                    Copy booking ID
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </td>
          </tr>
          <tr v-if="reservations.length === 0">
            <td colspan="10" class="px-4 py-12 text-center text-sm text-muted-foreground">
              <div class="flex flex-col items-center gap-2">
                <Icon name="lucide:calendar-x" class="size-8 opacity-50" />
                No reservations match your filters.
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
