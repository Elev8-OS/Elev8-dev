<script setup lang="ts">
import { GENERATION_STAGES } from '~/components/website-builder/data/wizard'

// Mock engine: one stage per tick, nothing is sent anywhere.
const emit = defineEmits<{
  done: []
  back: []
}>()

const STAGE_MS = 700
const stage = ref(0)
const finished = computed(() => stage.value >= GENERATION_STAGES.length)
let timer: ReturnType<typeof setInterval> | undefined
let after: ReturnType<typeof setTimeout> | undefined

onMounted(() => {
  timer = setInterval(() => {
    stage.value++
    if (finished.value) {
      clearInterval(timer)
      after = setTimeout(() => emit('done'), 900)
    }
  }, STAGE_MS)
})
onBeforeUnmount(() => {
  clearInterval(timer)
  clearTimeout(after)
})
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-8 py-16" data-testid="wz-generating">
    <Spinner v-if="!finished" class="size-12 text-primary" />
    <Icon v-else name="lucide:circle-check" class="size-12 text-success" aria-hidden="true" />

    <ol class="flex w-full max-w-md flex-col gap-3" aria-live="polite">
      <li v-for="(label, i) in GENERATION_STAGES.slice(0, Math.min(stage + 1, GENERATION_STAGES.length))" :key="label" class="flex items-start gap-3">
        <Icon v-if="i < stage" name="lucide:circle-check" class="mt-0.5 size-[18px] shrink-0 text-success" aria-hidden="true" />
        <span v-else class="mt-0.5 size-[18px] shrink-0 animate-pulse rounded-full bg-primary" />
        <span class="text-sm" :class="i < stage ? 'text-foreground' : 'text-muted-foreground'">{{ label }}</span>
      </li>
    </ol>

    <div v-if="!finished" class="text-xs text-muted-foreground">
      Step {{ Math.min(stage + 1, GENERATION_STAGES.length) }} of {{ GENERATION_STAGES.length }}
    </div>
    <Button v-if="!finished" variant="ghost" size="sm" @click="emit('back')">
      <Icon name="lucide:arrow-left" class="mr-2 size-4" aria-hidden="true" />
      Cancel
    </Button>
  </div>
</template>
