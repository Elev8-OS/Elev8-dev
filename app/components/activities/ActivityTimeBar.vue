<script setup lang="ts">
import { formatDuration } from '~/components/activities/data/activities'

/** Logged time against the person's target (hours per day times working days so far). */
const props = defineProps<{ minutes: number, target: number }>()

const pct = computed(() => props.target > 0 ? Math.round((props.minutes / props.target) * 100) : undefined)
</script>

<template>
  <div class="flex flex-col items-end gap-1">
    <span class="tabular-nums">{{ formatDuration(minutes) }}</span>
    <div v-if="pct !== undefined" class="flex items-center gap-2" :title="`${pct}% of ${formatDuration(target)} target`">
      <div class="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
        <div class="h-full rounded-full bg-primary" :style="{ width: `${Math.min(100, pct)}%` }" />
      </div>
      <span class="w-9 text-right text-xs tabular-nums text-muted-foreground">{{ pct }}%</span>
    </div>
  </div>
</template>
