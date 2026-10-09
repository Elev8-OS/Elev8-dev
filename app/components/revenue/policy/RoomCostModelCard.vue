<script setup lang="ts">
import type { CostFieldKey, ResolvedCost, RevenueRoom } from '~/components/revenue/data/revenue-policy'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import { formatMoney } from '~/components/cockpit/data/cockpit'
import { costFieldLabels, resolveCost } from '~/components/revenue/data/revenue-policy'
import { DIRECT_CHANNEL } from '~/components/revenue/data/revenue-settings'
import RevenueNumberField from '~/components/revenue/policy/RevenueNumberField.vue'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Card } from '~/components/ui/card'
import { derivedCosts, useRevenuePolicy } from '~/composables/useRevenuePolicy'
import { useRevenueSettings } from '~/composables/useRevenueSettings'

/**
 * The room's cost model (§22.1): derived from data Elev8 already holds, every
 * value marked estimated or confirmed, and overridable for this room. It saves
 * at once and is not part of the price settings version.
 */
const props = defineProps<{ room: RevenueRoom, currency: string, basePrice: number }>()

const policyStore = useRevenuePolicy()
const { settings } = useRevenueSettings()

const MONEY_FIELDS: CostFieldKey[] = ['cleaningPerTurnover', 'consumablesPerStay', 'fixedPerNight']

interface Row {
  id: string
  label: string
  cost: ResolvedCost
  optional: boolean
  hasOverride: boolean
  kind: 'field' | 'commission'
}

const cost = computed(() => policyStore.costFor(props.room.key))
const derived = computed(() => derivedCosts(props.room, props.currency, settings.value.costs))

const channels = computed(() => [...new Set([...props.room.channels, DIRECT_CHANNEL])])

const rows = computed<Row[]>(() => {
  const fields = (['cleaningPerTurnover', 'consumablesPerStay', 'paymentPct', 'fixedPerNight'] as CostFieldKey[]).map(key => ({
    id: key,
    label: costFieldLabels[key],
    cost: resolveCost(cost.value.fields[key], derived.value[key], MONEY_FIELDS.includes(key) ? 'money' : 'pct'),
    optional: key === 'fixedPerNight',
    hasOverride: cost.value.fields[key].override != null,
    kind: 'field' as const,
  }))
  const commissions = channels.value.map((channel) => {
    const fallback = settings.value.costs.commissionByChannel[channel]
    return {
      id: channel,
      label: `${channel} commission`,
      cost: resolveCost(cost.value.commission[channel], { value: fallback ?? null, source: fallback == null ? 'No channel default yet' : 'Channel default' }, 'pct'),
      optional: false,
      hasOverride: cost.value.commission[channel]?.override != null,
      kind: 'commission' as const,
    }
  })
  return [...fields, ...commissions]
})

const unconfirmed = computed(() => rows.value.filter(r => !r.optional && r.cost.state !== 'confirmed').length)

function display(value: number | null, unit: ResolvedCost['unit']) {
  if (value == null)
    return 'Not set'
  return unit === 'money' ? formatMoney(value, props.currency) : `${value}%`
}

// Inline edit
const editing = ref<string | null>(null)
const draft = ref<number | null>(null)

function startEdit(row: Row) {
  editing.value = row.id
  draft.value = row.cost.value
}

function saveEdit(row: Row) {
  if (row.kind === 'field')
    policyStore.setCostOverride(props.room.key, row.id as CostFieldKey, draft.value)
  else
    policyStore.setCommissionOverride(props.room.key, row.id, draft.value)
  editing.value = null
  toast.success(`${row.label} confirmed for this room`)
}

function confirm(row: Row) {
  if (row.kind === 'field')
    policyStore.confirmCost(props.room.key, row.id as CostFieldKey)
  else
    policyStore.confirmCommission(props.room.key, row.id)
}

function reset(row: Row) {
  if (row.kind === 'field')
    policyStore.setCostOverride(props.room.key, row.id as CostFieldKey, null)
  else
    policyStore.setCommissionOverride(props.room.key, row.id, null)
}

/** What a 3-night stay at the base price leaves after costs, on the first channel. */
const example = computed(() => {
  const nights = 3
  const channel = props.room.channels[0] ?? DIRECT_CHANNEL
  const value = (id: string) => rows.value.find(r => r.id === id)?.cost.value ?? 0
  const revenue = props.basePrice * nights
  const commission = revenue * (value(channel) / 100)
  const payment = revenue * (value('paymentPct') / 100)
  const contribution = revenue - commission - payment - value('cleaningPerTurnover') - value('consumablesPerStay') - value('fixedPerNight') * nights
  return { nights, channel, revenue, contribution }
})
</script>

<template>
  <Card class="gap-4 p-5" data-testid="cost-model">
    <div class="flex flex-wrap items-start justify-between gap-2">
      <div>
        <h3 class="text-sm font-semibold">
          Cost model
        </h3>
        <p class="mt-0.5 text-xs text-muted-foreground">
          Used by the contribution margin basis. Elev8 starts from data it holds; confirm the values that are right. Saves straight away.
        </p>
      </div>
      <Badge v-if="unconfirmed" variant="outline" class="gap-1 border-warning/50 text-[11px] font-normal">
        <Icon name="lucide:circle-dashed" class="size-3" />
        {{ unconfirmed }} estimated
      </Badge>
      <Badge v-else variant="outline" class="gap-1 text-[11px] font-normal">
        <Icon name="lucide:circle-check" class="size-3" />
        All confirmed
      </Badge>
    </div>

    <ul class="divide-y rounded-md border">
      <li v-for="row in rows" :key="row.id" class="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5" :data-testid="`cost-row-${row.id}`">
        <div class="min-w-0 flex-1">
          <p class="text-sm">
            {{ row.label }}
          </p>
          <p class="text-xs text-muted-foreground">
            {{ row.cost.source }}
          </p>
        </div>

        <template v-if="editing === row.id">
          <RevenueNumberField
            v-model="draft"
            :prefix="row.cost.unit === 'money' ? currency : undefined"
            :suffix="row.cost.unit === 'pct' ? '%' : undefined"
            :min="0"
            nullable
            :aria-label="row.label"
            class="w-40"
          />
          <Button size="sm" class="h-8" @click="saveEdit(row)">
            Save
          </Button>
          <Button size="sm" variant="ghost" class="h-8" @click="editing = null">
            Cancel
          </Button>
        </template>
        <template v-else>
          <span class="text-sm font-medium tabular-nums">{{ display(row.cost.value, row.cost.unit) }}</span>
          <Badge
            v-if="row.cost.state === 'confirmed'"
            variant="outline"
            class="text-[11px] font-normal"
          >
            Confirmed
          </Badge>
          <Badge
            v-else-if="row.cost.state === 'estimated'"
            variant="outline"
            class="border-dashed text-[11px] font-normal text-muted-foreground"
          >
            Estimated
          </Badge>
          <Badge v-else-if="!row.optional" variant="destructive" class="text-[11px] font-normal">
            Missing
          </Badge>
          <div class="flex items-center gap-1">
            <Button v-if="row.cost.state === 'estimated'" size="sm" variant="ghost" class="h-7 px-2 text-xs" @click="confirm(row)">
              Confirm
            </Button>
            <Button size="sm" variant="ghost" class="h-7 px-2 text-xs" @click="startEdit(row)">
              {{ row.cost.value == null ? 'Set' : 'Edit' }}
            </Button>
            <Button v-if="row.hasOverride" size="icon" variant="ghost" class="size-7" :aria-label="`Use the derived ${row.label}`" @click="reset(row)">
              <Icon name="lucide:rotate-ccw" class="size-3.5" />
            </Button>
          </div>
        </template>
      </li>
    </ul>

    <p class="text-xs text-muted-foreground">
      A {{ example.nights }}-night stay on {{ example.channel }} at the base price brings {{ formatMoney(example.revenue, currency) }}
      and contributes <span class="font-medium text-foreground">{{ formatMoney(Math.round(example.contribution * 100) / 100, currency) }}</span> after these costs.
    </p>
  </Card>
</template>
