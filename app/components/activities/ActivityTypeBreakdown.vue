<script setup lang="ts">
import type { ActivityLogType } from '~/components/activities/data/activities'
import type { ActivityByType } from '~/composables/useActivityReport'
import { activityLogTypeMeta, formatDuration } from '~/components/activities/data/activities'

const props = withDefaults(defineProps<{
  byType: ActivityByType
  /** Which types to show. A type nobody here can log is left out instead of showing 0m. */
  types?: ActivityLogType[]
}>(), { types: () => ['cleaning', 'task', 'tracker'] })

const SHADES = { cleaning: 'bg-chart-3', task: 'bg-chart-2', tracker: 'bg-chart-1' } as const
const total = computed(() => props.types.reduce((sum, t) => sum + props.byType[t], 0))
</script>

<template>
  <div class="space-y-2">
    <div class="flex h-2 overflow-hidden rounded-full bg-muted" role="img" aria-label="Time by type of work">
      <div
        v-for="t in types"
        :key="t"
        :class="SHADES[t]"
        :style="{ width: total ? `${(byType[t] / total) * 100}%` : '0%' }"
      />
    </div>
    <ul class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <li v-for="t in types" :key="t" class="inline-flex items-center gap-1.5">
        <span class="size-2 rounded-full" :class="SHADES[t]" />
        {{ activityLogTypeMeta[t].label }}
        <span class="tabular-nums text-foreground">{{ formatDuration(byType[t]) }}</span>
      </li>
    </ul>
  </div>
</template>
