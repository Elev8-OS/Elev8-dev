<script setup lang="ts">
import type { Dow, LosTier, PolicyIssue, PricingPolicy } from '~/components/revenue/data/revenue-policy'
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

const extraPersonIssue = computed(() => props.issues.find(i => i.field === 'extraPerson')?.message ?? null)

const activeCount = computed(() =>
  policy.value.los.length
  + (policy.value.lengthDiscounts.weeklyPct ? 1 : 0)
  + (policy.value.lengthDiscounts.monthlyPct ? 1 : 0)
  + (policy.value.extraPerson.enabled ? 1 : 0)
  + policy.value.checkInOut.closedToArrival.length
  + policy.value.checkInOut.closedToDeparture.length
  + Object.keys(policy.value.minStay.byDow).length,
)

// LOS tiers
function addLos() {
  const last = policy.value.los.at(-1)
  const tier: LosTier = { id: newId('los'), nights: (last?.nights ?? 2) + 1, adjustPct: -5 }
  policy.value = { ...policy.value, los: [...policy.value.los, tier] }
}

function patchLos(id: string, patch: Partial<LosTier>) {
  policy.value = { ...policy.value, los: policy.value.los.map(t => t.id === id ? { ...t, ...patch } : t) }
}

function removeLos(id: string) {
  policy.value = { ...policy.value, los: policy.value.los.filter(t => t.id !== id) }
}

function patchExtra(patch: Partial<PricingPolicy['extraPerson']>) {
  policy.value = { ...policy.value, extraPerson: { ...policy.value.extraPerson, ...patch } }
}

// Arrival / departure days
type Restriction = 'closedToArrival' | 'closedToDeparture'

function isClosed(kind: Restriction, day: Dow) {
  return policy.value.checkInOut[kind].includes(day)
}

function toggleClosed(kind: Restriction, day: Dow) {
  const list = policy.value.checkInOut[kind]
  const next = list.includes(day) ? list.filter(d => d !== day) : DOWS.filter(d => d === day || list.includes(d))
  policy.value = { ...policy.value, checkInOut: { ...policy.value.checkInOut, [kind]: next } }
}

// Minimum stay by arrival day
function setMinStayDow(day: Dow, value: number | null) {
  const { [day]: _drop, ...rest } = policy.value.minStay.byDow
  policy.value = { ...policy.value, minStay: { ...policy.value.minStay, byDow: value ? { ...rest, [day]: value } : rest } }
}
</script>

<template>
  <PolicySection
    title="Stay and party"
    description="Length-of-stay pricing, weekly and monthly discounts, extra guests and arrival days."
    :summary="activeCount ? `${activeCount} active` : 'None set'"
    test-id="policy-stay"
  >
    <template #badges>
      <ProviderSupportBadge section="los" />
    </template>

    <!-- LOS tiers -->
    <section class="flex flex-col gap-3">
      <div>
        <h4 class="text-sm font-medium">
          Length-of-stay pricing
        </h4>
        <p class="text-xs text-muted-foreground">
          Stays of at least this many nights get this adjustment on every night.
        </p>
      </div>
      <div v-for="tier in policy.los" :key="tier.id" class="flex flex-wrap items-center gap-2 text-sm">
        <span class="text-muted-foreground">From</span>
        <RevenueNumberField :model-value="tier.nights" suffix="nights" :min="1" aria-label="Nights" class="w-32" @update:model-value="patchLos(tier.id, { nights: $event ?? 1 })" />
        <span class="text-muted-foreground">adjust</span>
        <RevenueNumberField :model-value="tier.adjustPct" suffix="%" aria-label="Adjustment" class="w-24" @update:model-value="patchLos(tier.id, { adjustPct: $event ?? 0 })" />
        <Button variant="ghost" size="icon" class="size-8" aria-label="Remove tier" @click="removeLos(tier.id)">
          <Icon name="lucide:trash-2" class="size-4" />
        </Button>
      </div>
      <Button variant="outline" size="sm" class="w-fit gap-1.5" @click="addLos">
        <Icon name="lucide:plus" class="size-3.5" />
        Add tier
      </Button>
    </section>

    <!-- Weekly / monthly -->
    <section class="grid gap-4 sm:grid-cols-2">
      <div class="flex flex-col gap-1.5">
        <Label>Weekly discount (7+ nights)</Label>
        <RevenueNumberField
          :model-value="policy.lengthDiscounts.weeklyPct" suffix="%" :min="0" :max="90"
          @update:model-value="policy = { ...policy, lengthDiscounts: { ...policy.lengthDiscounts, weeklyPct: $event ?? 0 } }"
        />
      </div>
      <div class="flex flex-col gap-1.5">
        <Label>Monthly discount (28+ nights)</Label>
        <RevenueNumberField
          :model-value="policy.lengthDiscounts.monthlyPct" suffix="%" :min="0" :max="90"
          @update:model-value="policy = { ...policy, lengthDiscounts: { ...policy.lengthDiscounts, monthlyPct: $event ?? 0 } }"
        />
      </div>
    </section>

    <!-- Extra person -->
    <section class="flex flex-col gap-3">
      <div class="flex items-start justify-between gap-4">
        <div>
          <div class="flex items-center gap-2">
            <h4 class="text-sm font-medium">
              Extra-person fee
            </h4>
            <ProviderSupportBadge section="extraPerson" />
          </div>
          <p class="text-xs text-muted-foreground">
            A nightly fee for each guest above the number included.
          </p>
        </div>
        <Switch :model-value="policy.extraPerson.enabled" aria-label="Extra-person fee" @update:model-value="patchExtra({ enabled: $event })" />
      </div>
      <div v-if="policy.extraPerson.enabled" class="flex flex-wrap items-center gap-2 text-sm">
        <span class="text-muted-foreground">Above</span>
        <RevenueNumberField :model-value="policy.extraPerson.threshold" suffix="guests" :min="1" aria-label="Guests included" class="w-32" @update:model-value="patchExtra({ threshold: $event ?? 1 })" />
        <span class="text-muted-foreground">charge</span>
        <RevenueNumberField :model-value="policy.extraPerson.feePerNight" :prefix="policy.currency" :min="0" aria-label="Fee per guest per night" class="w-40" :invalid="!!extraPersonIssue" @update:model-value="patchExtra({ feePerNight: $event ?? 0 })" />
        <span class="text-muted-foreground">per guest per night</span>
      </div>
      <p v-if="extraPersonIssue" class="text-xs text-destructive">
        {{ extraPersonIssue }}
      </p>
    </section>

    <!-- Arrival and departure days -->
    <section class="flex flex-col gap-3">
      <div>
        <h4 class="text-sm font-medium">
          Arrival and departure days
        </h4>
        <p class="text-xs text-muted-foreground">
          Days guests cannot check in or out, and a longer minimum stay for some arrival days.
        </p>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[480px] text-sm">
          <thead>
            <tr class="text-xs text-muted-foreground">
              <th class="py-1.5 pr-2 text-left font-normal" />
              <th v-for="day in DOWS" :key="day" class="px-1 py-1.5 text-center font-normal">
                {{ dowLabels[day] }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in ([['closedToArrival', 'No check-in'], ['closedToDeparture', 'No check-out']] as const)" :key="row[0]">
              <td class="py-1.5 pr-2 text-xs whitespace-nowrap text-muted-foreground">
                {{ row[1] }}
              </td>
              <td v-for="day in DOWS" :key="day" class="px-1 py-1.5 text-center">
                <button
                  type="button"
                  class="inline-flex size-5 items-center justify-center rounded-[4px] border"
                  :class="isClosed(row[0], day) ? 'border-primary bg-primary text-primary-foreground' : 'border-input'"
                  :aria-label="`${row[1]} on ${dowLabels[day]}`"
                  :aria-pressed="isClosed(row[0], day)"
                  @click="toggleClosed(row[0], day)"
                >
                  <Icon v-if="isClosed(row[0], day)" name="lucide:check" class="size-3" />
                </button>
              </td>
            </tr>
            <tr>
              <td class="py-1.5 pr-2 text-xs whitespace-nowrap text-muted-foreground">
                Min stay
              </td>
              <td v-for="day in DOWS" :key="day" class="px-1 py-1.5">
                <RevenueNumberField
                  :model-value="policy.minStay.byDow[day] ?? null"
                  :min="1"
                  nullable
                  :placeholder="String(policy.minStay.default)"
                  :aria-label="`Minimum stay for ${dowLabels[day]} arrivals`"
                  @update:model-value="setMinStayDow(day, $event)"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </PolicySection>
</template>
