<script setup lang="ts">
/**
 * The gate. Each funnel stage has its own set of causes and only one of them
 * is the price, so the first stage that fails decides what may be raised and
 * everything downstream waits. This panel is the reason the table's "worst
 * domain" is a statement rather than a label.
 */
import type { GateState, GateVerdict } from '~/components/revenue/data/diagnosis'
import { gateStageLabels } from '~/components/revenue/data/diagnosis'

defineProps<{ gate: GateState }>()

/**
 * Gold is the brand colour, so it must not double as "healthy" — an active nav
 * item and a passing gate would read alike. Healthy is neutral, failing is the
 * severity red, and every dot carries its word so the state never depends on
 * hue alone.
 */
const DOT: Record<GateVerdict, string> = {
  healthy: 'bg-foreground',
  failing: 'bg-destructive',
  unknown: 'bg-muted-foreground/40',
}

const TEXT: Record<GateVerdict, string> = {
  healthy: 'healthy',
  failing: 'below cohort',
  unknown: 'held',
}
</script>

<template>
  <div class="flex flex-col gap-3 rounded-lg border bg-muted/30 p-4">
    <div class="flex items-baseline justify-between gap-2">
      <p class="text-sm font-semibold">
        Gate state
      </p>
      <p class="text-xs text-muted-foreground">
        vs {{ gate.benchmark === 'cohort' ? `cohort of ${gate.cohortSize}` : 'own history' }}
      </p>
    </div>

    <ul class="flex flex-col gap-2">
      <li
        v-for="entry in gate.stages"
        :key="entry.stage"
        class="flex items-baseline gap-2.5 text-sm"
      >
        <span class="mt-1.5 size-2 shrink-0 rounded-full" :class="DOT[entry.verdict]" aria-hidden="true" />
        <span class="flex-1">
          {{ gateStageLabels[entry.stage] }}
          <span class="text-muted-foreground">— {{ entry.note ?? TEXT[entry.verdict] }}</span>
        </span>
      </li>
    </ul>

    <p class="border-t pt-3 text-xs leading-relaxed text-muted-foreground">
      {{ gate.releasedNote }}
    </p>

    <!-- Naming the yardstick is not a caveat, it is the honest claim. No
         provider sells competitor funnel data, so "market" would be a lie. -->
    <p class="text-xs text-muted-foreground">
      Measured against comparable rooms of ours, not against the market — competitor click rates are not available from any source.
    </p>
  </div>
</template>
