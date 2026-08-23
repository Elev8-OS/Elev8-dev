<script setup lang="ts">
/**
 * Two questions, two sources, deliberately not merged.
 *
 * "Against whom" needs names, distances and the reason each property counts as
 * a competitor. "How the market stands" needs a percentile per date and the
 * supply behind it. One source answers each; presenting them as one number
 * would lose the half that makes the other actionable.
 */
import type { MarketPosition, MdvCompset } from '~/components/revenue/data/diagnosis'

const props = defineProps<{
  compset: MdvCompset
  market: MarketPosition
}>()

function percent(value: number, digits = 0) {
  return `${(value * 100).toFixed(digits)}%`
}

function signed(value: number) {
  return `${value > 0 ? '+' : ''}${value}%`
}

/** A room with almost no reviews loses in the result list whatever the price. */
const reviewHandicap = computed(() => props.compset.ourReviewCount < 5)
</script>

<template>
  <div class="flex flex-col divide-y rounded-lg border">
    <section class="flex flex-col gap-3 p-4">
      <div class="flex flex-wrap items-baseline justify-between gap-2">
        <p class="text-sm font-semibold">
          Against whom
        </p>
        <p class="text-xs text-muted-foreground">
          {{ compset.tracked }} tracked · observed {{ compset.observedAt }}
        </p>
      </div>

      <p class="text-xs text-muted-foreground">
        Match weighted by
        <span v-for="(weight, index) in compset.weights" :key="weight.label">
          {{ weight.label.toLowerCase() }} {{ weight.weight }}%{{ index < compset.weights.length - 1 ? ', ' : '' }}
        </span>
      </p>

      <ul class="grid gap-2 sm:grid-cols-3">
        <li
          v-for="competitor in compset.competitors"
          :key="competitor.name"
          class="flex flex-col gap-0.5 rounded-md bg-muted/40 px-3 py-2"
        >
          <span class="truncate text-sm font-medium">{{ competitor.name }}</span>
          <span class="text-xs tabular-nums text-muted-foreground">
            {{ competitor.distanceKm.toFixed(2) }} km · score {{ competitor.score }} · ADR {{ signed(competitor.adrDeltaPercent) }}
          </span>
          <span class="text-xs tabular-nums text-muted-foreground">
            <template v-if="competitor.reviewScore !== null">
              {{ competitor.reviewScore }} from {{ competitor.reviewCount }} reviews
            </template>
            <template v-else>
              no reviews yet
            </template>
          </span>
        </li>
      </ul>

      <p
        v-if="reviewHandicap"
        class="flex items-start gap-1.5 rounded-md bg-warning/15 px-3 py-2 text-xs text-warning-foreground"
      >
        <Icon name="lucide:triangle-alert" class="mt-0.5 size-3 shrink-0" />
        <span>
          This room shows
          {{ compset.ourReviewScore }} from {{ compset.ourReviewCount }}
          {{ compset.ourReviewCount === 1 ? 'review' : 'reviews' }}. Rating carries 18% of the competitor match, so review depth costs
          visibility in the result list — and no price change repairs that.
        </span>
      </p>
    </section>

    <section class="flex flex-col gap-2 p-4">
      <div class="flex flex-wrap items-baseline justify-between gap-2">
        <p class="text-sm font-semibold">
          How the market stands
        </p>
        <p class="text-xs text-muted-foreground">
          {{ market.panelSize }}-property panel · {{ market.bandLabel }} · {{ market.observedAt }}
        </p>
      </div>

      <p class="text-sm leading-relaxed">
        Our price sits at the
        <span class="font-semibold tabular-nums">{{ market.percentile }}th percentile</span>
        for {{ market.windowLabel }}. Market occupancy
        <span class="tabular-nums">{{ percent(market.marketOccupancy) }}</span>
        <template v-if="market.occupancyStly !== null">
          against <span class="tabular-nums">{{ percent(market.occupancyStly) }}</span> at the same point last year
        </template>.
      </p>

      <p class="text-xs text-muted-foreground">
        <span class="tabular-nums">{{ market.availableListings }}</span> listings available for those dates,
        <span class="tabular-nums">{{ signed(market.supplyDeltaPercent) }}</span> in 30 days.
      </p>
    </section>
  </div>
</template>
