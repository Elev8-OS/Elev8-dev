<script setup lang="ts">
import type { CockpitStayFilters } from '~/components/cockpit/data/cockpit'
import type { ReservationStatus } from '~/components/reservations/data/reservations'
import { activeFilterCount, DEFAULT_STAY_FILTERS } from '~/components/cockpit/data/cockpit'
import { allTags, BOOKING_CHANNELS } from '~/components/listings/data/listings'
import { stayBarClasses } from '~/components/listings/data/stay-bar'
import { reservationStatusLabels } from '~/components/reservations/data/reservations'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover'
import { ScrollArea } from '~/components/ui/scroll-area'
import { Separator } from '~/components/ui/separator'
import { Switch } from '~/components/ui/switch'

/**
 * The board's tools: listing search, filters (status, channel, cancelled,
 * action needed, tags), what free nights show, the colour legend, and fold
 * all rooms. In the board's corner from `md` up; above the board on a phone,
 * where the listing column is too narrow for them.
 */
defineProps<{
  /** Fold all is offered only when a listing has rooms to fold. */
  canFold: boolean
  allCollapsed: boolean
}>()
const emit = defineEmits<{ toggleAll: [], newReservation: [] }>()

const search = defineModel<string>('search', { required: true })
const tags = defineModel<string[]>('tags', { required: true })
const filters = defineModel<CockpitStayFilters>('filters', { required: true })

/** The statuses a bar can have, cancelled aside (it has its own switch). */
const STATUSES: ReservationStatus[] = ['unverified', 'verified', 'checked_in', 'checked_out', 'inquiry', 'owner_request', 'blocked']

const activeCount = computed(() => activeFilterCount(filters.value, tags.value))

function toggleIn<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter(x => x !== item) : [...list, item]
}

function toggleStatus(status: string) {
  filters.value = { ...filters.value, statuses: toggleIn(filters.value.statuses, status) }
}

function toggleChannel(channel: string) {
  filters.value = { ...filters.value, channels: toggleIn(filters.value.channels, channel) }
}

function clearAll() {
  filters.value = { ...DEFAULT_STAY_FILTERS }
  tags.value = []
}

const tagQuery = ref('')
const tagOptions = computed(() => {
  const q = tagQuery.value.trim().toLowerCase()
  return q ? allTags.value.filter(t => t.toLowerCase().includes(q)) : allTags.value
})

/** What the board's colours and marks mean. */
const LEGEND_STATUSES: ReservationStatus[] = ['verified', 'unverified', 'checked_in', 'checked_out', 'inquiry', 'owner_request', 'blocked']
const HATCH = {
  backgroundImage: 'repeating-linear-gradient(135deg, color-mix(in oklab, var(--background) 22%, transparent) 0 1.5px, transparent 1.5px 6px)',
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <!-- Icon tools, as in the reference board: filters, legend, fold, new reservation -->
    <div class="flex items-center gap-1.5">
      <Popover>
        <PopoverTrigger as-child>
          <Button variant="ghost" size="icon" class="relative size-9 shrink-0 border bg-card" aria-label="Filters" data-testid="cockpit-filters">
            <Icon name="lucide:filter" class="size-4" :class="activeCount ? 'text-foreground' : 'text-muted-foreground'" />
            <span v-if="activeCount" class="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-foreground text-[10px] text-background">{{ activeCount }}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent class="w-72 p-0" align="start">
          <ScrollArea class="h-[26rem] overflow-hidden">
            <div class="flex flex-col gap-3 p-3">
              <div class="flex items-center justify-between gap-3">
                <span class="text-sm">Action needed only</span>
                <Switch
                  :model-value="filters.actionOnly"
                  aria-label="Show only listings with an action needed"
                  @update:model-value="filters = { ...filters, actionOnly: $event }"
                />
              </div>
              <div class="flex items-center justify-between gap-3">
                <span class="text-sm">Show cancelled</span>
                <Switch
                  :model-value="filters.showCancelled"
                  aria-label="Show cancelled stays"
                  @update:model-value="filters = { ...filters, showCancelled: $event }"
                />
              </div>

              <Separator />

              <div class="flex flex-col gap-0.5">
                <span class="mb-1 text-xs font-medium text-muted-foreground">Status</span>
                <div
                  v-for="s in STATUSES"
                  :key="s"
                  class="flex cursor-pointer items-center gap-2 rounded-sm px-1 py-1 text-sm hover:bg-accent"
                  @click="toggleStatus(s)"
                >
                  <div
                    class="flex size-4 items-center justify-center rounded-[4px] border"
                    :class="filters.statuses.includes(s) ? 'border-primary bg-primary text-primary-foreground' : 'border-input'"
                  >
                    <Icon v-if="filters.statuses.includes(s)" name="lucide:check" class="size-3" />
                  </div>
                  <span class="size-2.5 rounded-full border" :class="stayBarClasses[s]" aria-hidden="true" />
                  <span>{{ reservationStatusLabels[s] }}</span>
                </div>
              </div>

              <div class="flex flex-col gap-0.5">
                <span class="mb-1 text-xs font-medium text-muted-foreground">Channel</span>
                <div
                  v-for="c in BOOKING_CHANNELS"
                  :key="c"
                  class="flex cursor-pointer items-center gap-2 rounded-sm px-1 py-1 text-sm hover:bg-accent"
                  @click="toggleChannel(c)"
                >
                  <div
                    class="flex size-4 items-center justify-center rounded-[4px] border"
                    :class="filters.channels.includes(c) ? 'border-primary bg-primary text-primary-foreground' : 'border-input'"
                  >
                    <Icon v-if="filters.channels.includes(c)" name="lucide:check" class="size-3" />
                  </div>
                  <span>{{ c }}</span>
                </div>
              </div>

              <div class="flex flex-col gap-1">
                <span class="text-xs font-medium text-muted-foreground">Tags</span>
                <Input v-model="tagQuery" placeholder="Search tags" class="h-8" aria-label="Search tags" />
                <div class="flex flex-col gap-0.5">
                  <div
                    v-for="tag in tagOptions"
                    :key="tag"
                    class="flex cursor-pointer items-center gap-2 rounded-sm px-1 py-1 text-sm hover:bg-accent"
                    @click="tags = toggleIn(tags, tag)"
                  >
                    <div
                      class="flex size-4 items-center justify-center rounded-[4px] border"
                      :class="tags.includes(tag) ? 'border-primary bg-primary text-primary-foreground' : 'border-input'"
                    >
                      <Icon v-if="tags.includes(tag)" name="lucide:check" class="size-3" />
                    </div>
                    <span class="truncate">{{ tag }}</span>
                  </div>
                  <p v-if="!tagOptions.length" class="px-1 py-2 text-xs text-muted-foreground">
                    No tags found
                  </p>
                </div>
              </div>
            </div>
          </ScrollArea>
          <div class="border-t p-1">
            <Button variant="ghost" size="sm" class="w-full" :disabled="!activeCount" @click="clearAll">
              Clear all
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      <Popover>
        <PopoverTrigger as-child>
          <Button variant="ghost" size="icon" class="size-9 shrink-0 border bg-card" aria-label="What the colours mean" title="What the colours mean" data-testid="cockpit-legend">
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
      <Button
        v-if="canFold"
        variant="ghost"
        size="icon"
        class="size-9 shrink-0 border bg-card"
        :aria-label="allCollapsed ? 'Expand all rooms' : 'Collapse all rooms'"
        :title="allCollapsed ? 'Expand all rooms' : 'Collapse all rooms'"
        @click="emit('toggleAll')"
      >
        <Icon :name="allCollapsed ? 'lucide:chevrons-up-down' : 'lucide:chevrons-down-up'" class="size-4" />
      </Button>
      <Button variant="ghost" size="icon" class="size-9 shrink-0 border bg-card" aria-label="New reservation" title="New reservation" data-testid="cockpit-new" @click="emit('newReservation')">
        <Icon name="lucide:plus" class="size-4" />
      </Button>
    </div>
    <div class="flex items-center gap-1">
      <Icon name="lucide:search" class="ml-1 size-4 shrink-0 text-muted-foreground" />
      <Input
        v-model="search"
        placeholder="Search listing"
        aria-label="Search listing"
        class="h-8 border-0 px-1 shadow-none focus-visible:ring-0"
      />
    </div>
  </div>
</template>
