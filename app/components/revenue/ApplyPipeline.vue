<script setup lang="ts">
import type { ApplyState } from '~/components/revenue/data/health'
import { computed } from 'vue'
import {
  APPLY_PIPELINE,
  applyStepIndex,
  failedStepIndex,
} from '~/components/revenue/data/contract'
import { Button } from '~/components/ui/button'

const props = defineProps<{
  state: ApplyState
  /**
   * The plain-language sentence for the current state, from the polled
   * `ApplyStatus.message`. The backend owns this copy — when present it is
   * rendered verbatim, falling back to the switch below only when it is
   * absent (e.g. before the first poll lands).
   */
  message?: string | null
}>()
const emit = defineEmits<{ revert: [] }>()

const STEP_LABELS: Record<typeof APPLY_PIPELINE[number], string> = {
  snapshot: 'Snapshot taken',
  saved: 'Saved in Elev8',
  written: 'Written',
  verified: 'Verified',
  recomputed: 'Recalculated',
  live: 'Live on channels',
}

const failedAt = computed(() => failedStepIndex(props.state))

const reached = computed(() =>
  failedAt.value !== null ? failedAt.value - 1 : applyStepIndex(props.state),
)

function stepStatus(index: number) {
  if (failedAt.value === index)
    return 'failed'
  if (index <= reached.value)
    return 'done'
  if (index === reached.value + 1 && props.state !== 'live')
    return 'active'
  return 'waiting'
}

/** Tone is driven by the state alone — it never depends on whose text is shown. */
function toneFor(state: ApplyState): 'muted' | 'ok' | 'warning' | 'destructive' | null {
  switch (state) {
    case 'snapshot':
    case 'saved':
    case 'written':
    case 'verified':
    case 'recomputed':
      return 'muted'
    case 'live':
      return 'ok'
    case 'recompute_unavailable':
      return 'warning'
    case 'push_failed':
      return 'destructive'
    default:
      return null
  }
}

/** Fallback prose, used only when the server has not sent a message yet. */
function fallbackText(state: ApplyState): string | null {
  switch (state) {
    case 'snapshot':
      return 'Prior state captured for every field this change touches. That snapshot is what a revert restores and what the outcome is measured against.'
    case 'saved':
      return 'Base price and minimum stay saved as a new policy version. Nothing is live yet.'
    case 'written':
    case 'verified':
      return 'Your settings are in place and confirmed. The new nightly prices are being computed now.'
    case 'recomputed':
      return 'New prices received. Pushing to the channels.'
    case 'live':
      return 'Live on three channels. Outcome measurement is scheduled — you can revert for seven days.'
    case 'recompute_unavailable':
      return 'Your settings are live; the new prices are not yet. The pricing engine could not recalculate on demand, so prices will update on the normal daily cycle. Any curve shown until then is Elev8\'s own estimate.'
    case 'push_failed':
      return 'Guests are still seeing the old price on 14 dates. The channel manager rejected 14 of 60 room-dates. Retrying automatically and escalated to the team.'
    default:
      return null
  }
}

const message = computed(() => {
  const tone = toneFor(props.state)
  if (tone === null)
    return null
  const text = props.message ?? fallbackText(props.state)
  if (!text)
    return null
  return { tone, text }
})
</script>

<template>
  <div v-if="state !== 'idle'" class="flex flex-col gap-4">
    <ol class="flex flex-wrap items-center gap-x-2 gap-y-2">
      <li
        v-for="(step, index) in APPLY_PIPELINE" :key="step"
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

        <span v-if="index < APPLY_PIPELINE.length - 1" class="hidden h-px w-6 bg-border sm:block" aria-hidden="true" />
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
        Revert
      </Button>
      <span class="text-xs text-muted-foreground">Available for 7 days</span>
    </div>
  </div>
</template>
