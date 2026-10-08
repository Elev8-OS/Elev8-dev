<script setup lang="ts">
import type { TodayKey } from '~/components/cockpit/data/cockpit'

/**
 * Today's work above the board. Each count focuses its stays on the board
 * (the rest fade back); clicking it again clears the focus. Owner requests
 * open their sheet instead. A count of zero is quiet; double bookings are
 * red when there are any.
 */
const props = defineProps<{
  counts: Record<TodayKey, number>
  ownerRequests: number
}>()
const emit = defineEmits<{ ownerRequests: [] }>()

const focus = defineModel<TodayKey | null>('focus', { default: null })

const ITEMS: Array<{ key: TodayKey, label: string, icon: string, alarm?: boolean }> = [
  { key: 'arrivals', label: 'Arrivals', icon: 'lucide:log-in' },
  { key: 'departures', label: 'Departures', icon: 'lucide:log-out' },
  { key: 'inHouse', label: 'In house', icon: 'lucide:house' },
  { key: 'unassigned', label: 'No room yet', icon: 'lucide:circle-help' },
  { key: 'actionNeeded', label: 'Action needed', icon: 'lucide:alert-circle', alarm: true },
  { key: 'conflicts', label: 'Double booked', icon: 'lucide:triangle-alert', alarm: true },
]

function toggle(key: TodayKey) {
  focus.value = focus.value === key ? null : key
}

const total = computed(() => Object.values(props.counts).reduce((a, b) => a + b, 0))
</script>

<template>
  <div class="flex flex-wrap items-center gap-2" role="group" aria-label="Today" data-testid="cockpit-today">
    <span class="mr-1 text-sm font-medium">Today</span>
    <button
      v-for="item in ITEMS"
      :key="item.key"
      type="button"
      class="flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-default disabled:opacity-50 motion-reduce:transition-none"
      :class="[
        focus === item.key ? 'border-foreground bg-foreground text-background' : 'bg-card hover:bg-accent',
        item.alarm && counts[item.key] > 0 && focus !== item.key && 'border-destructive/40 text-destructive',
      ]"
      :aria-pressed="focus === item.key"
      :disabled="counts[item.key] === 0 && focus !== item.key"
      :data-testid="`cockpit-today-${item.key}`"
      @click="toggle(item.key)"
    >
      <Icon :name="item.icon" class="size-3.5" />
      {{ item.label }}
      <span class="font-semibold tabular-nums">{{ counts[item.key] }}</span>
    </button>
    <button
      type="button"
      class="flex h-8 items-center gap-1.5 rounded-full border bg-card px-3 text-sm hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      :class="ownerRequests > 0 && 'border-destructive/40 text-destructive'"
      data-testid="cockpit-today-owner"
      @click="emit('ownerRequests')"
    >
      <Icon name="lucide:key-round" class="size-3.5" />
      Owner requests
      <span class="font-semibold tabular-nums">{{ ownerRequests }}</span>
    </button>
    <span v-if="focus" class="text-xs text-muted-foreground">Showing these stays. Click again to show all.</span>
    <span v-else-if="total === 0 && ownerRequests === 0" class="text-xs text-muted-foreground">Nothing due today.</span>
  </div>
</template>
