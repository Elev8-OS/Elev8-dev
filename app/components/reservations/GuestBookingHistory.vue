<script setup lang="ts">
import type { GuestBookingHistoryItem } from '~/components/reservations/data/reservations'

defineProps<{ bookings: GuestBookingHistoryItem[] }>()

const df = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

function fmtDate(iso: string): string {
  return df.format(new Date(`${iso}T00:00:00Z`))
}

function fmtCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="text-base">
        Booking history
      </CardTitle>
    </CardHeader>
    <CardContent class="p-0">
      <div class="rounded-md border overflow-hidden">
        <table class="w-full text-sm">
          <thead class="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th class="text-left font-medium px-4 py-3">
                Stay
              </th>
              <th class="text-left font-medium px-4 py-3">
                Listing
              </th>
              <th class="text-right font-medium px-4 py-3">
                Total
              </th>
              <th class="text-left font-medium px-4 py-3">
                Ratings
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="b in bookings"
              :key="b.id"
              class="border-t hover:bg-muted/30 transition-colors"
            >
              <td class="px-4 py-3">
                <span class="font-medium">{{ fmtDate(b.checkIn) }}</span>
                <span class="text-muted-foreground"> · {{ b.nights }} nights</span>
              </td>
              <td class="px-4 py-3">
                {{ b.listingName }}
              </td>
              <td class="px-4 py-3 text-right tabular-nums">
                {{ fmtCurrency(b.totalPrice, b.currency) }}
              </td>
              <td class="px-4 py-3">
                <div v-if="b.hostReviewOfGuest || b.guestReviewOfProperty" class="flex items-center gap-3 text-xs text-muted-foreground">
                  <span v-if="b.hostReviewOfGuest" title="Host review of guest">
                    <Icon name="lucide:star" class="mr-1 inline size-3 text-amber-500" />
                    {{ b.hostReviewOfGuest.rating }}
                  </span>
                  <span v-if="b.guestReviewOfProperty" title="Guest review of property">
                    <Icon name="lucide:star" class="mr-1 inline size-3 text-amber-500" />
                    {{ b.guestReviewOfProperty.rating }}
                  </span>
                </div>
                <span v-else class="text-xs text-muted-foreground">—</span>
              </td>
            </tr>
            <tr v-if="bookings.length === 0">
              <td colspan="4" class="px-4 py-12 text-center text-sm text-muted-foreground">
                <div class="flex flex-col items-center gap-2">
                  <Icon name="lucide:history" class="size-8 opacity-50" />
                  No previous stays recorded.
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </CardContent>
  </Card>
</template>
