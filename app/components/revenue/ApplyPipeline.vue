<script setup lang="ts">
import type { ApplyState } from '~/components/revenue/data/health'
import { computed } from 'vue'
import { Button } from '~/components/ui/button'

const props = defineProps<{
  state: ApplyState
}>()

const emit = defineEmits<{ revert: [] }>()

const STEPS = ['snapshot', 'saved', 'written', 'verified', 'recomputed', 'live'] as const
const STEP_LABELS: Record<typeof STEPS[number], string> = {
  snapshot: 'Snapshot taken',
  saved: 'Saved in Elev8',
  written: 'Written',
  verified: 'Verified',
  recomputed: 'Recalculated',
  live: 'Live on channels',
}

const ORDER: Record<string, number> = { idle: -1, snapshot: 0, saved: 1, written: 2, verified: 3, recomputed: 4, live: 5 }

/** Where the failure landed, so the strip can mark that step rather than the last one. */
const failedAt = computed(() => {
  if (props.state === 'recompute_unavailable')
    return 4
  if (props.state === 'push_failed')
    return 5
  return null
})

const reached = computed(() => {
  if (failedAt.value !== null)
    return failedAt.value - 1
  return ORDER[props.state] ?? -1
})

function stepStatus(index: number) {
  if (failedAt.value === index)
    return 'failed'
  if (index <= reached.value)
    return 'done'
  if (index === reached.value + 1 && props.state !== 'live')
    return 'active'
  return 'waiting'
}

const message = computed(() => {
  switch (props.state) {
    case 'snapshot':
      return { tone: 'muted', text: 'Prior state captured for every field this change touches. That snapshot is what a revert restores and what the outcome is measured against.' }
    case 'saved':
      return { tone: 'muted', text: 'Base price and minimum stay saved as a new policy version. Nothing is live yet.' }
    case 'written':
    case 'verified':
      return { tone: 'muted', text: 'Your settings are in place and confirmed. The new nightly prices are being computed now.' }
    case 'recomputed':
      return { tone: 'muted', text: 'New prices received. Pushing to the channels.' }
    case 'live':
      return { tone: 'ok', text: 'Live on three channels. Outcome measurement is scheduled — you can revert for seven days.' }
    case 'recompute_unavailable':
      return { tone: 'warning', text: 'Your settings are live; the new prices are not yet. The pricing engine could not recalculate on demand, so prices will update on the normal daily cycle. Any curve shown until then is Elev8\'s own estimate.' }
    case 'push_failed':
      return { tone: 'destructive', text: 'Guests are still seeing the old price on 14 dates. The channel manager rejected 14 of 60 room-dates. Retrying automatically and escalated to the team.' }
    default:
      return null
  }
})
</script>

<template>
  <div v-if="state !== 'idle'" class="flex flex-col gap-4">
    <ol class="flex flex-wrap items-center gap-x-2 gap-y-2">
      <li
        v-for="(step, index) in STEPS" :key="step"
        class="flex items-center gap-2"
      >
        <span
          class="flex size-4 shrink-0 items-center justify-center rounded-full border"
          :class="{
            'border-foreground bg-foreground text-background': stepStatus(index) === 'done',
            'border-warning bg-warning/40': stepStatus(index) === 'active',
            'border-destructive bg-destructive text-background': stepStatus(index) === 'failed',
            'border-border bg-background': stepStatus(index) === 'waiting',
          }"
        >
          <Icon v-if="stepStatus(index) === 'done'" name="lucide:check" class="size-2.5" />
          <Icon v-else-if="stepStatus(index) === 'failed'" name="lucide:x" class="size-2.5" />
        </span>

        <span
          class="text-xs font-medium whitespace-nowrap"
          :class="{
            'text-foreground': stepStatus(index) === 'done',
            'text-warning-foreground': stepStatus(index) === 'active',
            'text-destructive': stepStatus(index) === 'failed',
            'text-muted-foreground': stepStatus(index) === 'waiting',
          }"
        >{{ STEP_LABELS[step] }}</span>

        <span v-if="index < STEPS.length - 1" class="hidden h-px w-6 bg-border sm:block" aria-hidden="true" />
      </li>
    </ol>

    <div
      v-if="message"
      class="flex gap-3 rounded-lg border p-3 text-sm leading-relaxed"
      :class="{
        'border-border bg-muted/50': message.tone === 'muted',
        'border-border bg-background': message.tone === 'ok',
        'border-warning/60 bg-warning/15': message.tone === 'warning',
        'border-destructive/40 bg-destructive/10': message.tone === 'destructive',
      }"
    >
      <Icon
        :name="message.tone === 'destructive' ? 'lucide:triangle-alert' : message.tone === 'warning' ? 'lucide:info' : 'lucide:check-circle-2'"
        class="mt-0.5 size-4 shrink-0"
        :class="{
          'text-destructive': message.tone === 'destructive',
          'text-warning-foreground': message.tone === 'warning',
          'text-muted-foreground': message.tone === 'muted' || message.tone === 'ok',
        }"
      />
      <p>{{ message.text }}</p>
    </div>

    <div v-if="state === 'live'" class="flex items-center gap-3">
      <Button variant="outline" size="sm" @click="emit('revert')">
        <Icon name="lucide:undo-2" class="size-4" />
        Rückgängig machen
      </Button>
      <span class="text-xs text-muted-foreground">Available for 7 days</span>
    </div>
  </div>
</template>
