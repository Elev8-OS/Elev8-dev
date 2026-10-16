<script setup lang="ts">
import type { ActivityDayPoint } from '~/composables/useActivityReport'
import { formatDuration, parseLocalDateKey } from '~/components/activities/data/activities'

/** One bar per day. The dashed line is a full working day (hours per day). */
const props = defineProps<{ series: ActivityDayPoint[], targetPerDay: number }>()

const max = computed(() => Math.max(60, props.targetPerDay, ...props.series.map(p => p.minutes)))
const dayFmt = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
const label = (p: ActivityDayPoint) => `${dayFmt.format(parseLocalDateKey(p.date))}: ${p.minutes ? formatDuration(p.minutes) : 'nothing logged'}`
const dayNumber = (key: string) => parseLocalDateKey(key).getDate()

/** Label every bar up to two weeks, then every few so the numbers do not collide. */
const step = computed(() => props.series.length <= 16 ? 1 : Math.ceil(props.series.length / 16))
</script>

<template>
  <div class="space-y-1.5">
    <div class="relative flex h-32 items-end gap-1" role="img" aria-label="Time logged per day">
      <div
        v-if="targetPerDay > 0"
        class="pointer-events-none absolute inset-x-0 border-t border-dashed border-muted-foreground/50"
        :style="{ bottom: `${(targetPerDay / max) * 100}%` }"
      />
      <div
        v-for="p in series"
        :key="p.date"
        class="flex h-full min-w-0 flex-1 items-end"
        :title="label(p)"
      >
        <div
          class="w-full rounded-t-sm"
          :class="p.minutes > 0 ? (p.workDay ? 'bg-primary' : 'bg-primary/50') : 'bg-muted'"
          :style="{ height: p.minutes > 0 ? `${Math.max(3, (p.minutes / max) * 100)}%` : '3px' }"
        />
      </div>
    </div>
    <div class="flex gap-1 text-[10px] tabular-nums text-muted-foreground">
      <span v-for="(p, i) in series" :key="p.date" class="min-w-0 flex-1 text-center">
        {{ i % step === 0 ? dayNumber(p.date) : '' }}
      </span>
    </div>
  </div>
</template>
