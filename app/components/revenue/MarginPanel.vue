<script setup lang="ts">
/**
 * Cost side and objective.
 *
 * Cost is per TURNOVER, never amortised per night — a cleaning happens once per
 * booking while a discount works per night, and that difference is the whole
 * mechanism behind the minimum-stay findings. Amortising quietly would delete
 * the effect we are trying to measure.
 *
 * The cleaning fee is read per channel because it is set per channel, so the
 * same night can be margin-positive on one and negative on the other.
 */
import type { ContractType, MarginBlock } from '~/components/revenue/data/diagnosis'
import {
  contractLabels,
  funnelChannelLabels,
  objectiveConflict,
  objectiveForContract,
  ownerSeesCost,
} from '~/components/revenue/data/diagnosis'
import { basisLabels } from '~/components/revenue/data/health'

const props = defineProps<{
  margin: MarginBlock
  contract: ContractType
}>()

function amount(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: props.margin.currency,
    maximumFractionDigits: 0,
  }).format(value)
}

const objective = computed(() => objectiveForContract(props.contract))
const conflict = computed(() => objectiveConflict(props.contract))
const shortfalls = computed(() => props.margin.fees.filter(fee => fee.shortfall > 0))
</script>

<template>
  <div class="flex min-w-0 flex-col gap-4 rounded-lg border p-4">
    <div>
      <p class="text-sm text-muted-foreground">
        Cost per turnover
      </p>
      <p class="mt-1 text-2xl font-semibold tabular-nums">
        {{ amount(margin.costPerTurnover) }}
      </p>
      <p class="mt-0.5 text-xs text-muted-foreground">
        {{ margin.costState }} · {{ margin.trackedCleanings }} of {{ margin.totalCleanings }} cleanings tracked
      </p>
      <p class="mt-1.5 text-xs text-muted-foreground">
        Blended location rate — individual pay is never shown.
      </p>
    </div>

    <div class="border-t pt-3">
      <p class="text-sm text-muted-foreground">
        Cleaning fee per channel
      </p>
      <ul class="mt-2 flex flex-col gap-1.5">
        <li
          v-for="fee in margin.fees"
          :key="fee.channel"
          class="flex items-baseline justify-between gap-3 text-sm"
        >
          <span>{{ funnelChannelLabels[fee.channel] }}</span>
          <span class="flex items-baseline gap-2 tabular-nums">
            <span>{{ amount(fee.cleaningFee) }}</span>
            <span v-if="fee.shortfall > 0" class="text-xs font-medium text-destructive">
              {{ amount(fee.shortfall) }} under cost
            </span>
          </span>
        </li>
      </ul>

      <p v-if="shortfalls.length" class="mt-2 text-xs leading-relaxed text-muted-foreground">
        A fee below the turnover cost subsidises every short stay on that channel. It also works as a soft minimum stay: two nights pay it once, so per night it is steep.
      </p>

      <div class="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-3 text-xs">
        <span class="inline-flex items-center gap-1.5">
          <span class="size-1.5 rounded-full bg-primary" aria-hidden="true" />
          <span class="text-muted-foreground">Objective</span>
          <span class="font-semibold">{{ basisLabels[objective] }}</span>
        </span>
        <span class="text-muted-foreground">
          derived from contract · {{ contractLabels[contract] }}
        </span>
        <span class="text-muted-foreground">
          · owner {{ ownerSeesCost(contract) ? 'sees' : 'does not see' }} the cost side
        </span>
      </div>

      <p v-if="conflict" class="mt-2 flex items-start gap-1.5 rounded-md bg-warning/15 px-3 py-2 text-xs text-warning-foreground">
        <Icon name="lucide:triangle-alert" class="mt-0.5 size-3 shrink-0" />
        {{ conflict }}
      </p>
    </div>
  </div>
</template>
