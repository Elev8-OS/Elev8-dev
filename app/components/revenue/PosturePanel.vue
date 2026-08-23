<script setup lang="ts">
/**
 * The commercial stack, summed. Discounts cut what the guest pays and
 * commissions take a share of what is left, so the positions multiply rather
 * than add — which is why the total is always larger than the parts look, and
 * why it is invisible today: every position lives in a different screen.
 *
 * No comparison to the comp-set: competitor programme settings are not sold by
 * anyone, so that line would be an estimate wearing a measurement's clothes.
 */
import type { Posture, Programme } from '~/components/revenue/data/diagnosis'

const props = defineProps<{ posture: Posture }>()

function percent(value: number, digits = 1) {
  return `${(value * 100).toFixed(digits)}%`
}

/** One string, so the chip never loses the space between label and detail. */
function chipLabel(programme: Programme) {
  const base = programme.detail ? `${programme.label} ${programme.detail}` : programme.label
  return programme.active ? base : `${base} · off`
}

const cohortDelta = computed(() => {
  if (props.posture.cohortTakeRate === null)
    return undefined
  const diff = props.posture.effectiveTakeRate - props.posture.cohortTakeRate
  return { diff, label: `${diff > 0 ? '+' : ''}${(diff * 100).toFixed(1)} pts vs cohort` }
})
</script>

<template>
  <div class="flex min-w-0 flex-col gap-4 rounded-lg border p-4">
    <div>
      <p class="text-sm text-muted-foreground">
        Effective take rate
      </p>
      <p class="mt-1 text-2xl font-semibold tabular-nums">
        {{ percent(posture.effectiveTakeRate) }}
      </p>
      <p
        v-if="cohortDelta"
        class="mt-0.5 text-xs tabular-nums"
        :class="cohortDelta.diff > 0 ? 'text-warning-foreground' : 'text-muted-foreground'"
      >
        {{ cohortDelta.label }}
      </p>
      <p class="mt-1.5 text-xs leading-relaxed text-muted-foreground">
        {{ posture.contributors.join(' + ') }}
      </p>
    </div>

    <div class="border-t pt-3">
      <p class="text-sm text-muted-foreground">
        Active programmes
      </p>
      <ul class="mt-2 flex flex-wrap gap-1.5">
        <li
          v-for="programme in posture.programmes"
          :key="programme.label"
          class="rounded-full border px-2.5 py-1 text-xs"
          :class="programme.active
            ? 'border-warning/60 bg-warning/20 font-medium text-warning-foreground'
            : 'border-border bg-muted/40 text-muted-foreground'"
        >
          {{ chipLabel(programme) }}
        </li>
      </ul>
      <p class="mt-2 text-xs text-muted-foreground">
        Positions multiply rather than add, so the stack is always deeper than the individual figures suggest. Compared against our own cohort — competitor programme settings are not available from any source.
      </p>
    </div>
  </div>
</template>
