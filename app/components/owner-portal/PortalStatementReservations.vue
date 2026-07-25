<script setup lang="ts">
import type { OwnerReservationForStatement } from '~/components/owners/data/owner-statement-reservations'
import { ref } from 'vue'
import { Badge } from '~/components/ui/badge'
import { Card, CardContent } from '~/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '~/components/ui/collapsible'

defineProps<{
  reservations: OwnerReservationForStatement[]
  currency: string
}>()

const open = ref(false)
</script>

<template>
  <Card v-if="reservations.length > 0">
    <Collapsible v-model:open="open">
      <CollapsibleTrigger class="w-full">
        <CardContent class="flex items-center justify-between p-4">
          <div>
            <p class="text-base font-medium">
              Reservations
            </p>
            <p class="text-sm text-muted-foreground">
              {{ reservations.length }} reservations contributed to this period.
            </p>
          </div>
          <Icon
            :name="open ? 'lucide:chevron-up' : 'lucide:chevron-down'"
            class="size-5 text-muted-foreground"
            aria-hidden="true"
          />
        </CardContent>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div class="overflow-x-auto border-t">
          <table class="w-full min-w-[42rem] text-sm">
            <thead class="border-b bg-muted/40 text-left text-muted-foreground">
              <tr>
                <th class="px-4 py-3 font-medium">
                  Guest
                </th>
                <th class="px-4 py-3 font-medium">
                  Dates
                </th>
                <th class="px-4 py-3 font-medium">
                  Source
                </th>
                <th class="px-4 py-3 text-right font-medium">
                  Nights
                </th>
                <th class="px-4 py-3 text-right font-medium">
                  Gross
                </th>
                <th class="px-4 py-3 text-right font-medium">
                  Channel fee
                </th>
                <th class="px-4 py-3 text-right font-medium">
                  Net to owner
                </th>
              </tr>
            </thead>
            <tbody class="divide-y">
              <tr v-for="res in reservations" :key="res.id">
                <td class="px-4 py-3 font-medium">
                  {{ res.guestName }}
                </td>
                <td class="px-4 py-3 text-muted-foreground">
                  {{ res.checkIn }} → {{ res.checkOut }}
                </td>
                <td class="px-4 py-3">
                  <Badge variant="outline">
                    {{ res.source === 'booking_com' ? 'Booking.com' : res.source }}
                  </Badge>
                </td>
                <td class="px-4 py-3 text-right tabular-nums">
                  {{ res.nights }}
                </td>
                <td class="px-4 py-3 text-right font-medium tabular-nums">
                  {{ currency }} {{ res.grossAmount.toLocaleString() }}
                </td>
                <td class="px-4 py-3 text-right tabular-nums text-muted-foreground">
                  {{ currency }} {{ res.channelFee.toLocaleString() }}
                </td>
                <td class="px-4 py-3 text-right font-semibold tabular-nums">
                  {{ currency }} {{ res.netToOwner.toLocaleString() }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </CollapsibleContent>
    </Collapsible>
  </Card>
</template>
