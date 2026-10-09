<script setup lang="ts">
import type { PreviewNight, PricingPolicy } from '~/components/revenue/data/revenue-policy'
import { computed, ref } from 'vue'
import { formatMoney } from '~/components/cockpit/data/cockpit'
import { parseIsoDate, previewPolicy, summarisePreview } from '~/components/revenue/data/revenue-policy'
import { Card } from '~/components/ui/card'

/**
 * The next 90 nights at the settings being edited, before they are saved
 * (§15.5). This is Elev8's own policy-derived price: the pricing engine adds
 * its market curve on top, and occupancy rules need live occupancy, so the
 * preview says what it leaves out.
 */
const props = defineProps<{ policy: PricingPolicy, valid: boolean }>()

const DAYS = 90

const nights = computed(() => props.valid ? previewPolicy(props.policy, new Date(), DAYS) : [])
const summary = computed(() => summarisePreview(nights.value))

const hovered = ref<PreviewNight | null>(null)
const focus = computed(() => hovered.value ?? nights.value[0] ?? null)

/** Bars run from just under the floor to the ceiling, so the floor never sits at zero. */
const scale = computed(() => {
  const low = Math.min(props.policy.base.minPrice, summary.value.low) * 0.9
  const high = Math.max(props.policy.base.maxPrice, summary.value.high)
  return { low, span: Math.max(high - low, 1) }
})

function heightPct(price: number) {
  return Math.max(2, ((price - scale.value.low) / scale.value.span) * 100)
}

const floorPct = computed(() => heightPct(props.policy.base.minPrice))
const basePct = computed(() => heightPct(props.policy.base.price))

const minStayMix = computed(() => {
  const counts = new Map<number, number>()
  for (const n of nights.value)
    counts.set(n.minStay, (counts.get(n.minStay) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => a[0] - b[0])
})

const closedArrivals = computed(() => nights.value.filter(n => n.closedToArrival).length)

function money(value: number) {
  return formatMoney(value, props.policy.currency)
}

function breakdown(night: PreviewNight) {
  const parts = [`Base ${money(props.policy.base.price)}`, ...night.steps]
  if (night.clamped)
    parts.push(`held at the ${night.clamped === 'floor' ? 'minimum' : 'maximum'} price`)
  return parts.join(', ')
}

function dateLabel(date: string) {
  return parseIsoDate(date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}
</script>

<template>
  <Card class="gap-4 p-5" data-testid="policy-preview">
    <div>
      <h3 class="text-sm font-semibold">
        Preview, next {{ DAYS }} nights
      </h3>
      <p class="mt-0.5 text-xs text-muted-foreground">
        Elev8's price from these settings, before they are saved. The pricing engine adds its market curve on top. Occupancy and orphan-gap rules need live bookings, so they are left out here.
      </p>
    </div>

    <template v-if="valid">
      <div class="grid grid-cols-3 gap-2 text-center">
        <div class="rounded-md bg-muted/50 p-2">
          <p class="text-[11px] text-muted-foreground">
            Average
          </p>
          <p class="text-sm font-semibold tabular-nums">
            {{ money(Math.round(summary.average)) }}
          </p>
        </div>
        <div class="rounded-md bg-muted/50 p-2">
          <p class="text-[11px] text-muted-foreground">
            Lowest
          </p>
          <p class="text-sm font-semibold tabular-nums">
            {{ money(summary.low) }}
          </p>
        </div>
        <div class="rounded-md bg-muted/50 p-2">
          <p class="text-[11px] text-muted-foreground">
            Highest
          </p>
          <p class="text-sm font-semibold tabular-nums">
            {{ money(summary.high) }}
          </p>
        </div>
      </div>

      <!-- What the hovered night is made of -->
      <div v-if="focus" class="min-h-10 text-xs" data-testid="preview-focus">
        <p class="font-medium">
          {{ dateLabel(focus.date) }} · {{ money(focus.price) }} · min {{ focus.minStay }} night{{ focus.minStay === 1 ? '' : 's' }}
          <span v-if="focus.closedToArrival" class="text-muted-foreground"> · no check-in</span>
        </p>
        <p class="text-muted-foreground">
          {{ breakdown(focus) }}
        </p>
      </div>

      <div class="relative h-36" @mouseleave="hovered = null">
        <div class="absolute inset-x-0 border-t border-dashed border-destructive/50" :style="{ bottom: `${floorPct}%` }" aria-hidden="true" />
        <div class="absolute inset-x-0 border-t border-dashed border-foreground/30" :style="{ bottom: `${basePct}%` }" aria-hidden="true" />
        <div class="absolute inset-0 flex items-end gap-px">
          <button
            v-for="night in nights"
            :key="night.date"
            type="button"
            class="min-w-0 flex-1 rounded-t-[2px] transition-opacity"
            :class="[
              night.clamped ? 'bg-muted-foreground/50' : night.season ? 'bg-primary' : 'bg-primary/60',
              hovered && hovered.date !== night.date ? 'opacity-50' : '',
            ]"
            :style="{ height: `${heightPct(night.price)}%` }"
            :aria-label="`${dateLabel(night.date)}: ${money(night.price)}`"
            @mouseenter="hovered = night"
            @focus="hovered = night"
          />
        </div>
      </div>
      <div class="flex justify-between text-[10px] text-muted-foreground">
        <span>{{ dateLabel(nights[0]!.date) }}</span>
        <span>{{ dateLabel(nights[nights.length - 1]!.date) }}</span>
      </div>

      <div class="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span class="flex items-center gap-1.5"><span class="size-2 rounded-sm bg-primary/60" />Regular</span>
        <span class="flex items-center gap-1.5"><span class="size-2 rounded-sm bg-primary" />In a season</span>
        <span class="flex items-center gap-1.5"><span class="size-2 rounded-sm bg-muted-foreground/50" />Held at min or max</span>
        <span class="flex items-center gap-1.5"><span class="w-3 border-t border-dashed border-destructive/50" />Minimum</span>
        <span class="flex items-center gap-1.5"><span class="w-3 border-t border-dashed border-foreground/30" />Base</span>
      </div>

      <ul class="flex flex-col gap-1 border-t pt-3 text-xs">
        <li v-for="[stay, count] in minStayMix" :key="stay" class="flex justify-between">
          <span class="text-muted-foreground">Minimum stay {{ stay }} night{{ stay === 1 ? '' : 's' }}</span>
          <span class="tabular-nums">{{ count }} nights</span>
        </li>
        <li v-if="summary.atFloor || summary.atCeiling" class="flex justify-between">
          <span class="text-muted-foreground">Held at the minimum / maximum</span>
          <span class="tabular-nums">{{ summary.atFloor }} / {{ summary.atCeiling }}</span>
        </li>
        <li v-if="closedArrivals" class="flex justify-between">
          <span class="text-muted-foreground">No check-in</span>
          <span class="tabular-nums">{{ closedArrivals }} nights</span>
        </li>
      </ul>
    </template>

    <div v-else class="flex items-center gap-2 rounded-md bg-muted/50 p-4 text-xs text-muted-foreground">
      <Icon name="lucide:circle-alert" class="size-4 shrink-0" />
      Fix the highlighted settings to see the preview.
    </div>
  </Card>
</template>
