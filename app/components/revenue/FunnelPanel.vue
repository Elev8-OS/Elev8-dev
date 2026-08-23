<script setup lang="ts">
/**
 * One channel's funnel. Never two channels in one panel: Booking counts
 * impressions backwards over a trailing window and Airbnb reports forward per
 * stay date, so a combined figure would be invented. Rates lead, absolute
 * counts follow — and a thin denominator is marked rather than dressed up.
 */
import type { ChannelFunnel, FunnelStageValue } from '~/components/revenue/data/diagnosis'
import { funnelChannelLabels } from '~/components/revenue/data/diagnosis'

const props = defineProps<{ funnel: ChannelFunnel }>()

function percent(value: number | null, digits = 2) {
  return value === null ? '—' : `${(value * 100).toFixed(digits)}%`
}

function count(value: number) {
  return new Intl.NumberFormat('en-US').format(value)
}

/** Signed distance to the cohort, the only yardstick we actually have. */
function delta(stage: FunnelStageValue) {
  if (stage.rate === null || !stage.cohortRate)
    return undefined
  const ratio = (stage.rate - stage.cohortRate) / stage.cohortRate
  return { ratio, label: `${ratio > 0 ? '+' : ''}${Math.round(ratio * 100)}%` }
}

const viewDelta = computed(() => delta(props.funnel.view))
const bookingDelta = computed(() => delta(props.funnel.booking))
</script>

<template>
  <div class="flex flex-col gap-3 rounded-lg border p-4">
    <div class="flex items-baseline justify-between gap-2">
      <p class="text-sm font-semibold">
        {{ funnelChannelLabels[funnel.channel] }}
      </p>
      <p class="text-xs text-muted-foreground">
        {{ funnel.direction === 'forward' ? 'forward' : 'trailing' }} · {{ funnel.windowLabel }}
      </p>
    </div>

    <dl class="flex flex-col gap-2.5">
      <div class="flex items-baseline justify-between gap-3">
        <dt class="text-sm text-muted-foreground">
          Impressions
        </dt>
        <dd class="text-sm tabular-nums">
          {{ count(funnel.impressions) }}
        </dd>
      </div>

      <div class="flex flex-col gap-1">
        <div class="flex items-baseline justify-between gap-3">
          <dt class="text-sm text-muted-foreground">
            Click rate
          </dt>
          <dd
            class="text-sm font-semibold tabular-nums"
            :class="funnel.thinData ? 'text-muted-foreground' : ''"
          >
            {{ percent(funnel.view.rate) }}
          </dd>
        </div>
        <p class="flex items-center gap-2 text-xs text-muted-foreground">
          <span
            v-if="viewDelta"
            class="h-0.5 w-8 rounded-full"
            :class="viewDelta.ratio >= 0 ? 'bg-foreground' : 'bg-destructive/60'"
            aria-hidden="true"
          />
          <span>
            cohort {{ percent(funnel.view.cohortRate) }}
            <template v-if="viewDelta"> · {{ viewDelta.label }}</template>
          </span>
        </p>
      </div>

      <div class="flex flex-col gap-1">
        <div class="flex items-baseline justify-between gap-3">
          <dt class="text-sm text-muted-foreground">
            Conversion
          </dt>
          <!-- A zero here would read as an alarm. It is an unmeasurable stage. -->
          <dd
            v-if="!funnel.bookingMeasurable"
            class="text-xs text-muted-foreground"
          >
            not yet measurable
          </dd>
          <dd v-else class="text-sm font-semibold tabular-nums">
            {{ percent(funnel.booking.rate) }}
          </dd>
        </div>
        <p v-if="!funnel.bookingMeasurable" class="text-xs text-muted-foreground">
          {{ funnel.unmeasurableReason }}
        </p>
        <p v-else class="flex items-center gap-2 text-xs text-muted-foreground">
          <span
            v-if="bookingDelta"
            class="h-0.5 w-8 rounded-full"
            :class="bookingDelta.ratio >= 0 ? 'bg-foreground' : 'bg-destructive/60'"
            aria-hidden="true"
          />
          <span>
            cohort {{ percent(funnel.booking.cohortRate) }}
            <template v-if="bookingDelta"> · {{ bookingDelta.label }}</template>
            · {{ funnel.booking.count }} bookings
          </span>
        </p>
      </div>
    </dl>

    <p v-if="funnel.thinData" class="flex items-start gap-1.5 text-xs text-warning-foreground">
      <Icon name="lucide:triangle-alert" class="mt-0.5 size-3 shrink-0" />
      Thin denominator — the rate is directional, not decisive.
    </p>
  </div>
</template>
