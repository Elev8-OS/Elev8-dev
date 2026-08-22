<script setup lang="ts">
import type { MoneyEstimate, ObjectiveBasis } from '~/components/revenue/data/health'
import { computed } from 'vue'
import { basisLabels } from '~/components/revenue/data/health'

const props = withDefaults(defineProps<{
  estimate: MoneyEstimate
  basis: ObjectiveBasis
  size?: 'sm' | 'md' | 'lg'
  /** Show the band and basis beneath the figure. */
  detail?: boolean
}>(), { size: 'md', detail: false })

function format(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: props.estimate.currency,
    maximumFractionDigits: 0,
  }).format(value)
}

const sizeClass = computed(() => ({
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-3xl tracking-tight',
}[props.size]))

const isZero = computed(() => props.estimate.amount === 0)

/**
 * No green. The theme has no success token, so direction is carried by the
 * sign and the figure stays in ink — see the PR note on adding one.
 */
const display = computed(() => isZero.value ? '—' : `+ ${format(props.estimate.amount)}`)
const estimated = computed(() => props.basis === 'margin' && props.estimate.costInputsConfirmed === false)
</script>

<template>
  <div class="flex flex-col gap-1">
    <span
      class="font-semibold tabular-nums"
      :class="[sizeClass, isZero ? 'text-muted-foreground' : 'text-foreground']"
    >{{ display }}</span>

    <div v-if="detail && !isZero" class="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
      <span class="tabular-nums">band {{ format(estimate.low) }} – {{ format(estimate.high) }}</span>
      <span aria-hidden="true">·</span>
      <span>{{ basisLabels[basis].toLowerCase() }} basis</span>
      <span
        v-if="estimated"
        class="inline-flex items-center gap-1 rounded border border-warning/60 bg-warning/25 px-1.5 py-0.5 font-semibold text-warning-foreground"
      >
        <Icon name="lucide:triangle-alert" class="size-3" />
        costs estimated
      </span>
    </div>
  </div>
</template>
