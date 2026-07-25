<script setup lang="ts">
const props = defineProps<{ label: string, value: string }>()
</script>

<template>
  <div class="rounded-lg border bg-card p-4">
    <p class="text-sm text-muted-foreground">
      {{ props.label }}
    </p><p class="mt-2 text-xl font-semibold">
      {{ props.value }}
    </p>
  </div>
</template>
