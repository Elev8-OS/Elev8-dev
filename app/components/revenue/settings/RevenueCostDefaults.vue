<script setup lang="ts">
import { computed } from 'vue'
import RevenueNumberField from '~/components/revenue/policy/RevenueNumberField.vue'
import { Card } from '~/components/ui/card'
import { Label } from '~/components/ui/label'
import { useRevenueSettings } from '~/composables/useRevenueSettings'

/**
 * Housekeeping rate and the other cost defaults every room's cost model is
 * derived from (§22.1). Money is kept per currency and never converted.
 */
const store = useRevenueSettings()
const costs = computed(() => store.settings.value.costs)

/** Every currency a room prices in, plus any already set up. */
const currencies = computed(() => [...new Set([
  ...store.rooms.value.map(r => r.currency),
  ...Object.keys(costs.value.byCurrency),
])].sort())

function roomsIn(currency: string) {
  return store.rooms.value.filter(r => r.currency === currency).length
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <Card class="gap-4 p-5" data-testid="cost-currency-defaults">
      <div>
        <h3 class="text-sm font-semibold">
          Housekeeping and consumables
        </h3>
        <p class="mt-0.5 text-xs text-muted-foreground">
          Cleaning per turnover is this rate times the room's measured cleaning time. Set per currency: a cost is never converted.
        </p>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[520px] text-sm">
          <thead>
            <tr class="text-left text-xs text-muted-foreground">
              <th class="py-2 pr-3 font-normal">
                Currency
              </th>
              <th class="py-2 pr-3 font-normal">
                Housekeeping rate per hour
              </th>
              <th class="py-2 font-normal">
                Linen and consumables per stay
              </th>
            </tr>
          </thead>
          <tbody class="divide-y">
            <tr v-for="currency in currencies" :key="currency" :data-testid="`cost-defaults-${currency}`">
              <td class="py-2 pr-3">
                <p class="font-medium">
                  {{ currency }}
                </p>
                <p class="text-xs text-muted-foreground">
                  {{ roomsIn(currency) }} room{{ roomsIn(currency) === 1 ? '' : 's' }}
                </p>
              </td>
              <td class="py-2 pr-3">
                <RevenueNumberField
                  :model-value="costs.byCurrency[currency]?.housekeepingRatePerHour ?? null"
                  :prefix="currency"
                  :min="0"
                  nullable
                  placeholder="Not set"
                  :aria-label="`Housekeeping rate per hour in ${currency}`"
                  @update:model-value="store.setCurrencyDefaults(currency, { housekeepingRatePerHour: $event ?? 0 })"
                />
              </td>
              <td class="py-2">
                <RevenueNumberField
                  :model-value="costs.byCurrency[currency]?.consumablesPerStay ?? null"
                  :prefix="currency"
                  :min="0"
                  nullable
                  placeholder="Not set"
                  :aria-label="`Consumables per stay in ${currency}`"
                  @update:model-value="store.setCurrencyDefaults(currency, { consumablesPerStay: $event ?? 0 })"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Card>

    <Card class="gap-4 p-5" data-testid="cost-general-defaults">
      <div>
        <h3 class="text-sm font-semibold">
          Other defaults
        </h3>
        <p class="mt-0.5 text-xs text-muted-foreground">
          The starting values for rooms that have not confirmed their own.
        </p>
      </div>
      <div class="grid gap-4 sm:grid-cols-2">
        <div class="flex flex-col gap-1.5">
          <Label>Cleaning time when none is measured</Label>
          <RevenueNumberField :model-value="costs.defaultCleaningMinutes" suffix="minutes" :min="0" aria-label="Default cleaning minutes" @update:model-value="store.patchCosts({ defaultCleaningMinutes: $event ?? 0 })" />
        </div>
        <div class="flex flex-col gap-1.5">
          <Label>Payment processing</Label>
          <RevenueNumberField :model-value="costs.paymentPct" suffix="%" :min="0" :max="20" :step="0.1" aria-label="Payment processing percent" @update:model-value="store.patchCosts({ paymentPct: $event ?? 0 })" />
        </div>
      </div>

      <div class="flex flex-col gap-2">
        <Label>Commission by channel</Label>
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div v-for="channel in store.channels.value" :key="channel" class="flex flex-col gap-1">
            <span class="text-xs text-muted-foreground">{{ channel }}</span>
            <RevenueNumberField
              :model-value="costs.commissionByChannel[channel] ?? null"
              suffix="%"
              :min="0"
              :max="50"
              :step="0.5"
              nullable
              placeholder="Not set"
              :aria-label="`${channel} commission`"
              @update:model-value="store.setCommission(channel, $event ?? 0)"
            />
          </div>
        </div>
      </div>
    </Card>
  </div>
</template>
