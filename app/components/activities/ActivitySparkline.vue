<script setup lang="ts">
import { formatDuration } from '~/components/activities/data/activities'

/** Minutes per day as tiny bars. Decorative: the numbers sit in the cells beside it. */
const props = defineProps<{ values: number[] }>()

const max = computed(() => Math.max(1, ...props.values))
const total = computed(() => props.values.reduce((a, b) => a + b, 0))
</script>

<template>
  <div class="flex h-6 w-24 items-end gap-px" role="img" :aria-label="`${values.length} days, ${formatDuration(total)} in total`">
    <span
      v-for="(v, i) in values"
      :key="i"
      class="min-w-px flex-1 rounded-[1px]"
      :class="v > 0 ? 'bg-primary' : 'bg-muted'"
      :style="{ height: v > 0 ? `${Math.max(12, (v / max) * 100)}%` : '8%' }"
    />
  </div>
</template>
