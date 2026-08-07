<script setup lang="ts">
defineProps<{
  title?: string
  data?: {
    name: string
    color: string
    value: any
  }[]
}>()

// Show the score value formatted to /10
function scoreValue(item: { value: any }) {
  if (typeof item.value !== 'number')
    return item.value
  return `${item.value.toFixed(2)} / 10`
}
</script>

<template>
  <div class="pointer-events-none rounded-lg border bg-background p-3 shadow-md">
    <p class="mb-2 border-b pb-1 text-xs font-semibold text-foreground">
      {{ title || 'Category' }}
    </p>
    <div v-for="item in data" :key="item.name" class="flex items-center justify-between gap-4">
      <div class="flex items-center gap-2">
        <span class="size-2 rounded-full" :style="{ backgroundColor: item.color }" />
        <span class="text-xs text-muted-foreground">Average score</span>
      </div>
      <span class="text-xs font-semibold text-foreground">
        {{ scoreValue(item) }}
      </span>
    </div>
  </div>
</template>
