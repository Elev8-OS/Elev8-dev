<script setup lang="ts">
import type { PeriodKey } from '~/components/cockpit/data/cockpit'

/**
 * The period's work above the board (`periodSummary`), so it changes as the
 * period moves. No visible heading: the page title already names the period;
 * the dates are only in the group's `aria-label`. Each count focuses its stays on the board
 * (the rest fade back); clicking it again clears the focus. Owner requests
 * open their sheet instead. A count of zero is quiet; double bookings are
 * red when there are any.
 */
const props = defineProps<{
  counts: Record<PeriodKey, number>
  /** The period shown, e.g. "1 Oct to 31 Oct 2026", for the `aria-label` only. */
  periodLabel: string
  ownerRequests: number
}>()
const emit = defineEmits<{ ownerRequests: [] }>()

const focus = defineModel<PeriodKey | null>('focus', { default: null })

const ITEMS: Array<{ key: PeriodKey, label: string, icon: string, alarm?: boolean }> = [
  { key: 'arrivals', label: 'Arrivals', icon: 'lucide:log-in' },
  { key: 'departures', label: 'Departures', icon: 'lucide:log-out' },
  { key: 'staying', label: 'Staying', icon: 'lucide:house' },
  { key: 'unassigned', label: 'No room yet', icon: 'lucide:circle-help' },
  { key: 'actionNeeded', label: 'Action needed', icon: 'lucide:alert-circle', alarm: true },
  { key: 'conflicts', label: 'Double booked', icon: 'lucide:triangle-alert', alarm: true },
]

function toggle(key: PeriodKey) {
  focus.value = focus.value === key ? null : key
}

const total = computed(() => Object.values(props.counts).reduce((a, b) => a + b, 0))
</script>

<template>
  <div class="flex flex-wrap items-center gap-2" role="group" :aria-label="`In view: ${periodLabel}`" data-testid="cockpit-today">
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
    <span v-else-if="total === 0 && ownerRequests === 0" class="text-xs text-muted-foreground">Nothing in this period.</span>
  </div>
</template>
