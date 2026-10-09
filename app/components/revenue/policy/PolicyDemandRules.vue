<script setup lang="ts">
import type { Dow, LastMinuteRule, OccupancyRule, PolicyIssue, PricingPolicy } from '~/components/revenue/data/revenue-policy'
import { computed } from 'vue'
import { dowLabels, DOWS, newId } from '~/components/revenue/data/revenue-policy'
import PolicySection from '~/components/revenue/policy/PolicySection.vue'
import ProviderSupportBadge from '~/components/revenue/policy/ProviderSupportBadge.vue'
import RevenueNumberField from '~/components/revenue/policy/RevenueNumberField.vue'
import { Button } from '~/components/ui/button'
import { Label } from '~/components/ui/label'
import { Switch } from '~/components/ui/switch'

const props = defineProps<{ issues: PolicyIssue[] }>()
const policy = defineModel<PricingPolicy>('policy', { required: true })

const ruleCount = computed(() =>
  policy.value.occupancy.length
  + policy.value.lastMinute.length
  + (policy.value.orphanGap.enabled ? 1 : 0)
  + DOWS.filter(d => (policy.value.dow[d] ?? 1) !== 1).length,
)

function hasIssue(prefix: string, id: string) {
  return props.issues.some(i => i.field === `${prefix}-${id}`)
}

// Occupancy
function addOccupancy() {
  const rule: OccupancyRule = { id: newId('occ'), horizonDays: 30, occupancyFrom: 0, occupancyTo: 40, adjustPct: -10 }
  policy.value = { ...policy.value, occupancy: [...policy.value.occupancy, rule] }
}

function patchOccupancy(id: string, patch: Partial<OccupancyRule>) {
  policy.value = { ...policy.value, occupancy: policy.value.occupancy.map(r => r.id === id ? { ...r, ...patch } : r) }
}

function removeOccupancy(id: string) {
  policy.value = { ...policy.value, occupancy: policy.value.occupancy.filter(r => r.id !== id) }
}

// Last minute
function addLastMinute() {
  const rule: LastMinuteRule = { id: newId('lm'), daysFrom: 0, daysTo: 3, adjustPct: -15, minStay: 1 }
  policy.value = { ...policy.value, lastMinute: [...policy.value.lastMinute, rule] }
}

function patchLastMinute(id: string, patch: Partial<LastMinuteRule>) {
  policy.value = { ...policy.value, lastMinute: policy.value.lastMinute.map(r => r.id === id ? { ...r, ...patch } : r) }
}

function removeLastMinute(id: string) {
  policy.value = { ...policy.value, lastMinute: policy.value.lastMinute.filter(r => r.id !== id) }
}

// Orphan gap
function patchOrphan(patch: Partial<PricingPolicy['orphanGap']>) {
  policy.value = { ...policy.value, orphanGap: { ...policy.value.orphanGap, ...patch } }
}

// Day of week: stored as a multiplier, edited as a percentage.
function dowPct(day: Dow): number {
  return Math.round(((policy.value.dow[day] ?? 1) - 1) * 100)
}

function setDowPct(day: Dow, pct: number | null) {
  const { [day]: _drop, ...rest } = policy.value.dow
  const value = pct ? 1 + pct / 100 : null
  policy.value = { ...policy.value, dow: value ? { ...rest, [day]: Math.round(value * 1000) / 1000 } : rest }
}
</script>

<template>
  <PolicySection
    title="Demand rules"
    description="Move the price with occupancy, lead time and the day of the week."
    :summary="ruleCount ? `${ruleCount} active` : 'None set'"
    test-id="policy-demand"
  >
    <template #badges>
      <ProviderSupportBadge section="occupancy" />
    </template>

    <!-- Occupancy -->
    <section class="flex flex-col gap-3">
      <div>
        <h4 class="text-sm font-medium">
          Occupancy adjustments
        </h4>
        <p class="text-xs text-muted-foreground">
          When the room is this full over the next days, move the price.
        </p>
      </div>
      <div v-for="rule in policy.occupancy" :key="rule.id" class="flex flex-wrap items-center gap-2 rounded-md border p-3 text-sm" :class="hasIssue('occupancy', rule.id) ? 'border-destructive' : ''">
        <span class="text-muted-foreground">Next</span>
        <RevenueNumberField :model-value="rule.horizonDays" suffix="days" :min="1" aria-label="Look-ahead days" class="w-32" @update:model-value="patchOccupancy(rule.id, { horizonDays: $event ?? 1 })" />
        <span class="text-muted-foreground">at</span>
        <RevenueNumberField :model-value="rule.occupancyFrom" suffix="%" :min="0" :max="100" aria-label="Occupancy from" class="w-24" @update:model-value="patchOccupancy(rule.id, { occupancyFrom: $event ?? 0 })" />
        <span class="text-muted-foreground">to</span>
        <RevenueNumberField :model-value="rule.occupancyTo" suffix="%" :min="0" :max="100" aria-label="Occupancy to" class="w-24" @update:model-value="patchOccupancy(rule.id, { occupancyTo: $event ?? 0 })" />
        <span class="text-muted-foreground">occupied, adjust</span>
        <RevenueNumberField :model-value="rule.adjustPct" suffix="%" aria-label="Adjustment" class="w-24" @update:model-value="patchOccupancy(rule.id, { adjustPct: $event ?? 0 })" />
        <Button variant="ghost" size="icon" class="ml-auto size-8" aria-label="Remove occupancy rule" @click="removeOccupancy(rule.id)">
          <Icon name="lucide:trash-2" class="size-4" />
        </Button>
      </div>
      <Button variant="outline" size="sm" class="w-fit gap-1.5" @click="addOccupancy">
        <Icon name="lucide:plus" class="size-3.5" />
        Add occupancy rule
      </Button>
    </section>

    <!-- Last minute -->
    <section class="flex flex-col gap-3">
      <div>
        <h4 class="text-sm font-medium">
          Last-minute rules
        </h4>
        <p class="text-xs text-muted-foreground">
          Nights this close to today get a different price, and can take a shorter stay.
        </p>
      </div>
      <div v-for="rule in policy.lastMinute" :key="rule.id" class="flex flex-wrap items-center gap-2 rounded-md border p-3 text-sm" :class="hasIssue('lastminute', rule.id) ? 'border-destructive' : ''">
        <RevenueNumberField :model-value="rule.daysFrom" :min="0" aria-label="From days out" class="w-20" @update:model-value="patchLastMinute(rule.id, { daysFrom: $event ?? 0 })" />
        <span class="text-muted-foreground">to</span>
        <RevenueNumberField :model-value="rule.daysTo" suffix="days out" :min="0" aria-label="To days out" class="w-36" @update:model-value="patchLastMinute(rule.id, { daysTo: $event ?? 0 })" />
        <span class="text-muted-foreground">adjust</span>
        <RevenueNumberField :model-value="rule.adjustPct" suffix="%" aria-label="Adjustment" class="w-24" @update:model-value="patchLastMinute(rule.id, { adjustPct: $event ?? 0 })" />
        <span class="text-muted-foreground">min stay</span>
        <RevenueNumberField :model-value="rule.minStay" suffix="nights" :min="1" nullable placeholder="Same" aria-label="Minimum stay" class="w-32" @update:model-value="patchLastMinute(rule.id, { minStay: $event })" />
        <Button variant="ghost" size="icon" class="ml-auto size-8" aria-label="Remove last-minute rule" @click="removeLastMinute(rule.id)">
          <Icon name="lucide:trash-2" class="size-4" />
        </Button>
      </div>
      <Button variant="outline" size="sm" class="w-fit gap-1.5" @click="addLastMinute">
        <Icon name="lucide:plus" class="size-3.5" />
        Add last-minute rule
      </Button>
    </section>

    <!-- Orphan gaps -->
    <section class="flex flex-col gap-3">
      <div class="flex items-start justify-between gap-4">
        <div>
          <h4 class="text-sm font-medium">
            Orphan gaps
          </h4>
          <p class="text-xs text-muted-foreground">
            Short gaps between two bookings that would otherwise stay empty.
          </p>
        </div>
        <Switch :model-value="policy.orphanGap.enabled" aria-label="Orphan gap rule" @update:model-value="patchOrphan({ enabled: $event })" />
      </div>
      <div v-if="policy.orphanGap.enabled" class="flex flex-wrap items-center gap-2 text-sm">
        <span class="text-muted-foreground">Gaps up to</span>
        <RevenueNumberField :model-value="policy.orphanGap.maxGapNights" suffix="nights" :min="1" aria-label="Largest gap" class="w-32" @update:model-value="patchOrphan({ maxGapNights: $event ?? 1 })" />
        <span class="text-muted-foreground">adjust</span>
        <RevenueNumberField :model-value="policy.orphanGap.adjustPct" suffix="%" aria-label="Gap adjustment" class="w-24" @update:model-value="patchOrphan({ adjustPct: $event ?? 0 })" />
        <span class="text-muted-foreground">and allow</span>
        <RevenueNumberField :model-value="policy.orphanGap.minStay" suffix="nights" :min="1" aria-label="Gap minimum stay" class="w-32" @update:model-value="patchOrphan({ minStay: $event ?? 1 })" />
      </div>
    </section>

    <!-- Day of week -->
    <section class="flex flex-col gap-3">
      <div>
        <h4 class="text-sm font-medium">
          Day of week
        </h4>
        <p class="text-xs text-muted-foreground">
          Percent on top of the base for nights starting on that day. 0 leaves it as is.
        </p>
      </div>
      <div class="grid grid-cols-4 gap-2 sm:grid-cols-7">
        <div v-for="day in DOWS" :key="day" class="flex flex-col gap-1">
          <Label class="text-xs text-muted-foreground">{{ dowLabels[day] }}</Label>
          <RevenueNumberField :model-value="dowPct(day)" suffix="%" :aria-label="`${dowLabels[day]} adjustment`" @update:model-value="setDowPct(day, $event)" />
        </div>
      </div>
    </section>
  </PolicySection>
</template>
