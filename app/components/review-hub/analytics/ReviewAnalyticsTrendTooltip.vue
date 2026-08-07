<script setup lang="ts">
import { format } from 'date-fns'
import { computed } from 'vue'

const props = defineProps<{
  title?: string
  data?: {
    name: string
    color: string
    value: any
  }[]
}>()

// Format the week title like "Week of Jul 13, 2026"
const weekLabel = computed(() => {
  if (!props.title)
    return ''
  const parsed = new Date(props.title)
  if (Number.isNaN(parsed.getTime()))
    return props.title
  return `Week of ${format(parsed, 'MMM d, yyyy')}`
})

// Format a value: add % when it looks like a rate (>10 on a 0-100 scale), else /10-style
function formatValue(value: any) {
  if (typeof value !== 'number')
    return value
  const rounded = value.toFixed(1)
  return value > 10 ? `${rounded}%` : rounded
}
</script>

<template>
  <div class="pointer-events-none rounded-lg border bg-background p-3 shadow-md">
    <p v-if="weekLabel" class="mb-2 border-b pb-1 text-xs font-semibold text-foreground">
      {{ weekLabel }}
    </p>
    <div class="space-y-1">
      <div v-for="item in data" :key="item.name" class="flex items-center justify-between gap-4">
        <div class="flex items-center gap-2">
          <span class="size-2 rounded-full" :style="{ backgroundColor: item.color }" />
          <span class="text-xs text-muted-foreground">{{ item.name }}</span>
        </div>
        <span class="text-xs font-semibold text-foreground">
          {{ formatValue(item.value) }}
        </span>
      </div>
    </div>
  </div>
</template>
