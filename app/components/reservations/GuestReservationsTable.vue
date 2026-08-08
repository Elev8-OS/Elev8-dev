<script setup lang="ts">
import type { ReservationEntry } from '~/components/reservations/data/reservations'
import ReservationStatusBadge from '~/components/reservations/ReservationStatusBadge.vue'

defineProps<{ reservations: ReservationEntry[] }>()

const df = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

function fmtDate(iso: string): string {
  return df.format(new Date(`${iso}T00:00:00Z`))
}

function fmtCurrency(amount: number, currency: string): string {
  return `${amount.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${currency}`
}
</script>

<template>
  <Card>
    <CardContent class="p-0">
      <div class="rounded-md border overflow-hidden">
        <table class="w-full text-sm">
          <thead class="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
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
                Channel
              </th>
              <th class="text-right font-medium px-4 py-3">
                Total
              </th>
              <th class="text-left font-medium px-4 py-3">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="r in reservations"
              :key="r.id"
              class="border-t hover:bg-muted/30 transition-colors"
            >
              <td class="px-4 py-3">
                <NuxtLink :to="`/listings/${r.listingId}`" class="text-foreground hover:underline">
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
                {{ r.channel }}
              </td>
              <td class="px-4 py-3 text-right tabular-nums">
                {{ fmtCurrency(r.totalPrice, r.currency) }}
              </td>
              <td class="px-4 py-3">
                <ReservationStatusBadge :status="r.status" />
              </td>
            </tr>
            <tr v-if="reservations.length === 0">
              <td colspan="7" class="px-4 py-12 text-center text-sm text-muted-foreground">
                <div class="flex flex-col items-center gap-2">
                  <Icon name="lucide:calendar-x" class="size-8 opacity-50" />
                  No reservations yet.
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </CardContent>
  </Card>
</template>
