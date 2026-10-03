<script setup lang="ts">
const emit = defineEmits<{
  openSetup: []
  openTestAi: []
  openSchedule: []
}>()
</script>

<template>
  <div class="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1 rounded-full border bg-background px-2 py-1.5 shadow-lg">
    <Button variant="ghost" size="sm" class="rounded-full gap-2 text-xs" @click="emit('openSetup')">
      <Icon name="lucide:layout-panel-left" class="size-3.5" />
      Listing Setup
    </Button>
    <Separator orientation="vertical" class="h-4" />
    <Button variant="ghost" size="sm" class="rounded-full gap-2 text-xs" @click="emit('openTestAi')">
      <SharedAiIcon custom-class="size-3.5" />
      Test AI
    </Button>
    <Separator orientation="vertical" class="h-4" />
    <Button variant="ghost" size="sm" class="rounded-full gap-2 text-xs" @click="emit('openSchedule')">
      <Icon name="lucide:clock" class="size-3.5" />
      AI Schedule
    </Button>
  </div>
</template>
