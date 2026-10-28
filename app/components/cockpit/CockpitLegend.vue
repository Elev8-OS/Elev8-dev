<script setup lang="ts">
import type { ReservationStatus } from '~/components/reservations/data/reservations'
import { cn } from '@/lib/utils'
import { stayBarClasses } from '~/components/listings/data/stay-bar'
import { reservationStatusLabels } from '~/components/reservations/data/reservations'
import { Button } from '~/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover'
import { Separator } from '~/components/ui/separator'

/** What the board's colours and marks mean, behind an info button. `compact` is the small borderless one beside "All listings". */
const { compact = false } = defineProps<{ compact?: boolean }>()
const LEGEND_STATUSES: ReservationStatus[] = ['verified', 'unverified', 'checked_in', 'checked_out', 'inquiry', 'owner_request', 'blocked']
const HATCH = {
  backgroundImage: 'repeating-linear-gradient(135deg, color-mix(in oklab, var(--background) 22%, transparent) 0 1.5px, transparent 1.5px 6px)',
}
</script>

<template>
  <Popover>
    <PopoverTrigger as-child>
      <Button variant="ghost" size="icon" :class="cn('shrink-0', compact ? 'size-6' : 'size-9 border bg-card')" aria-label="What the colours mean" title="What the colours mean" data-testid="cockpit-legend">
        <Icon name="lucide:info" class="size-4 text-muted-foreground" />
      </Button>
    </PopoverTrigger>
    <PopoverContent class="w-64 p-3" align="start">
      <ul class="flex flex-col gap-1.5 text-sm">
        <li v-for="s in LEGEND_STATUSES" :key="s" class="flex items-center gap-2">
          <span class="h-3 w-6 shrink-0 rounded-sm border" :class="stayBarClasses[s]" aria-hidden="true" />
          {{ reservationStatusLabels[s] }}
        </li>
        <li class="flex items-center gap-2">
          <span class="h-3 w-6 shrink-0 rounded-sm bg-muted-foreground/85" :style="HATCH" aria-hidden="true" />
          Cancelled
        </li>
      </ul>
      <Separator class="my-3" />
      <ul class="flex flex-col gap-1.5 text-sm">
        <li class="flex items-center gap-2">
          <span class="flex w-6 justify-center" aria-hidden="true"><span class="h-4 w-0.5 bg-primary" /></span>
          Now
        </li>
        <li class="flex items-center gap-2">
          <span class="flex w-6 justify-center" aria-hidden="true"><span class="size-2.5 rounded-full bg-primary ring-2 ring-card" /></span>
          Arrives or leaves today
        </li>
        <li class="flex items-center gap-2">
          <span class="flex w-6 justify-center" aria-hidden="true">
            <span class="flex size-4 items-center justify-center rounded-full bg-destructive text-white"><Icon name="lucide:alert-circle" class="size-3" /></span>
          </span>
          Action needed in the Inbox
        </li>
        <li class="flex items-center gap-2">
          <span class="h-3 w-6 shrink-0 rounded-sm ring-2 ring-destructive" aria-hidden="true" />
          Double booked
        </li>
        <li class="flex items-center gap-2">
          <span class="flex h-3 w-6 shrink-0 items-center justify-center rounded-sm bg-foreground/15 text-[8px] tabular-nums" aria-hidden="true">3/4</span>
          Rooms free that night
        </li>
      </ul>
    </PopoverContent>
  </Popover>
</template>
