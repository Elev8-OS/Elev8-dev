<script setup lang="ts">
import type { GmDayBookings } from '~/components/gm/data/gm-dashboard'
import { formatDayLong, formatDayNumber, formatPercent, formatWeekday } from '~/components/gm/data/gm-dashboard'

const props = defineProps<{
  stripDays: string[]
  /** ISO date -> occupancy 0..1, for the load bar under each day. */
  stripOccupancy: Map<string, number>
  selectedDate: string
  anchorDate: string
  bookings: GmDayBookings
}>()

const emit = defineEmits<{
  select: [iso: string]
  shift: [days: number]
  today: []
}>()

const totalMovements = computed(() =>
  props.bookings.arrivals.length + props.bookings.departures.length)

function occupancyFor(iso: string): number {
  return props.stripOccupancy.get(iso) ?? 0
}
</script>

<template>
  <Card class="flex h-full flex-col">
    <CardHeader>
      <CardTitle>Bookings</CardTitle>
      <CardDescription>
        {{ totalMovements }} movements · {{ bookings.stayovers.length }} staying on
      </CardDescription>
      <CardAction class="flex items-center gap-1">
        <Button variant="ghost" size="icon" aria-label="Previous days" @click="emit('shift', -7)">
          <Icon name="lucide:chevron-left" class="size-4" />
        </Button>
        <Button variant="outline" size="sm" @click="emit('today')">
          Today
        </Button>
        <Button variant="ghost" size="icon" aria-label="Next days" @click="emit('shift', 7)">
          <Icon name="lucide:chevron-right" class="size-4" />
        </Button>
      </CardAction>
    </CardHeader>

    <CardContent class="flex min-h-0 flex-1 flex-col gap-4">
      <!-- Date strip navigator: each day carries its own occupancy bar, so
           picking a date is also reading how full it is. -->
      <div class="grid grid-cols-7 gap-1" data-testid="gm-date-strip">
        <button
          v-for="iso in stripDays"
          :key="iso"
          type="button"
          data-testid="gm-strip-day"
          class="flex flex-col items-center gap-1 rounded-md border px-1 py-2 transition-colors"
          :class="iso === selectedDate
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-transparent hover:bg-muted'"
          :aria-current="iso === selectedDate ? 'date' : undefined"
          :aria-label="`${formatDayLong(iso)}, ${formatPercent(occupancyFor(iso))} occupied`"
          @click="emit('select', iso)"
        >
          <span
            class="text-[10px] uppercase"
            :class="iso === selectedDate ? 'text-primary-foreground/80' : 'text-muted-foreground'"
          >
            {{ formatWeekday(iso) }}
          </span>
          <span class="text-sm font-semibold tabular-nums">{{ formatDayNumber(iso) }}</span>
          <span
            class="h-1 w-full overflow-hidden rounded-full"
            :class="iso === selectedDate ? 'bg-primary-foreground/25' : 'bg-muted'"
          >
            <span
              class="block h-full rounded-full"
              :class="iso === selectedDate ? 'bg-primary-foreground' : 'bg-primary'"
              :style="{ width: `${Math.round(occupancyFor(iso) * 100)}%` }"
            />
          </span>
          <span
            v-if="iso === anchorDate"
            class="text-[10px]"
            :class="iso === selectedDate ? 'text-primary-foreground/80' : 'text-muted-foreground'"
          >
            today
          </span>
        </button>
      </div>

      <div class="flex items-baseline justify-between border-b pb-2">
        <span class="text-sm font-medium">{{ formatDayLong(selectedDate) }}</span>
        <span class="text-xs tabular-nums text-muted-foreground">
          {{ formatPercent(occupancyFor(selectedDate)) }} occupied
        </span>
      </div>

      <!-- min-h-0 is required: without it this flex child cannot shrink below
           its content and the panel grows instead of scrolling. -->
      <ScrollArea class="min-h-0 flex-1">
        <div class="flex flex-col gap-3 pr-3">
          <Collapsible v-if="bookings.arrivals.length" default-open>
            <CollapsibleTrigger class="group flex w-full items-center gap-2 text-sm font-medium">
              <Icon
                name="lucide:chevron-down"
                class="size-4 text-muted-foreground transition-transform group-data-[state=closed]:-rotate-90"
              />
              Arrivals
              <Badge variant="secondary">
                {{ bookings.arrivals.length }}
              </Badge>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <GmBookingRow
                v-for="stay in bookings.arrivals"
                :key="stay.id"
                :stay="stay"
                kind="arrival"
              />
            </CollapsibleContent>
          </Collapsible>

          <Collapsible v-if="bookings.departures.length" default-open>
            <CollapsibleTrigger class="group flex w-full items-center gap-2 text-sm font-medium">
              <Icon
                name="lucide:chevron-down"
                class="size-4 text-muted-foreground transition-transform group-data-[state=closed]:-rotate-90"
              />
              Departures
              <Badge variant="secondary">
                {{ bookings.departures.length }}
              </Badge>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <GmBookingRow
                v-for="stay in bookings.departures"
                :key="stay.id"
                :stay="stay"
                kind="departure"
              />
            </CollapsibleContent>
          </Collapsible>

          <Collapsible v-if="bookings.stayovers.length">
            <CollapsibleTrigger class="group flex w-full items-center gap-2 text-sm font-medium">
              <Icon
                name="lucide:chevron-down"
                class="size-4 text-muted-foreground transition-transform group-data-[state=closed]:-rotate-90"
              />
              Staying on
              <Badge variant="secondary">
                {{ bookings.stayovers.length }}
              </Badge>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <GmBookingRow
                v-for="stay in bookings.stayovers"
                :key="stay.id"
                :stay="stay"
                kind="stayover"
              />
            </CollapsibleContent>
          </Collapsible>

          <div
            v-if="!bookings.arrivals.length && !bookings.departures.length && !bookings.stayovers.length"
            class="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground"
          >
            Nothing booked on this date.
          </div>
        </div>
      </ScrollArea>
    </CardContent>
  </Card>
</template>
