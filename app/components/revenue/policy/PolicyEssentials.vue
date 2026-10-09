<script setup lang="ts">
import type { PolicyIssue, PricingPolicy, RoundingMode } from '~/components/revenue/data/revenue-policy'
import { computed } from 'vue'
import { roundingLabels } from '~/components/revenue/data/revenue-policy'
import ProviderSupportBadge from '~/components/revenue/policy/ProviderSupportBadge.vue'
import RevenueNumberField from '~/components/revenue/policy/RevenueNumberField.vue'
import { Card } from '~/components/ui/card'
import { Label } from '~/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'

const props = defineProps<{ issues: PolicyIssue[] }>()
const policy = defineModel<PricingPolicy>('policy', { required: true })

const CURRENCIES = ['USD', 'IDR', 'AUD', 'EUR', 'CHF', 'SGD']

const currencies = computed(() => CURRENCIES.includes(policy.value.currency) ? CURRENCIES : [policy.value.currency, ...CURRENCIES])

function issueFor(field: string) {
  return props.issues.find(i => i.field === field)?.message ?? null
}

function setBase(field: keyof PricingPolicy['base'], value: number | null) {
  policy.value = { ...policy.value, base: { ...policy.value.base, [field]: value ?? 0 } }
}
</script>

<template>
  <Card class="gap-5 p-5">
    <div>
      <h3 class="text-sm font-semibold">
        Essentials
      </h3>
      <p class="mt-0.5 text-xs text-muted-foreground">
        The anchors. The pricing engine moves the nightly price around the base, never below the minimum or above the maximum.
      </p>
    </div>

    <div class="grid gap-4 sm:grid-cols-3">
      <div class="flex flex-col gap-1.5">
        <div class="flex items-center justify-between gap-2">
          <Label for="rev-base">Base price</Label>
          <ProviderSupportBadge section="basePrice" />
        </div>
        <RevenueNumberField id="rev-base" :model-value="policy.base.price" :prefix="policy.currency" :min="0" :invalid="!!issueFor('base')" @update:model-value="setBase('price', $event)" />
        <p v-if="issueFor('base')" class="text-xs text-destructive">
          {{ issueFor('base') }}
        </p>
      </div>
      <div class="flex flex-col gap-1.5">
        <div class="flex items-center justify-between gap-2">
          <Label for="rev-min">Minimum price</Label>
          <ProviderSupportBadge section="minPrice" />
        </div>
        <RevenueNumberField id="rev-min" :model-value="policy.base.minPrice" :prefix="policy.currency" :min="0" :invalid="!!issueFor('minPrice')" @update:model-value="setBase('minPrice', $event)" />
        <p v-if="issueFor('minPrice')" class="text-xs text-destructive">
          {{ issueFor('minPrice') }}
        </p>
      </div>
      <div class="flex flex-col gap-1.5">
        <div class="flex items-center justify-between gap-2">
          <Label for="rev-max">Maximum price</Label>
          <ProviderSupportBadge section="maxPrice" />
        </div>
        <RevenueNumberField id="rev-max" :model-value="policy.base.maxPrice" :prefix="policy.currency" :min="0" :invalid="!!issueFor('maxPrice')" @update:model-value="setBase('maxPrice', $event)" />
        <p v-if="issueFor('maxPrice')" class="text-xs text-destructive">
          {{ issueFor('maxPrice') }}
        </p>
      </div>
    </div>

    <div class="grid gap-4 sm:grid-cols-3">
      <div class="flex flex-col gap-1.5">
        <div class="flex items-center justify-between gap-2">
          <Label for="rev-minstay">Default minimum stay</Label>
          <ProviderSupportBadge section="minStay" />
        </div>
        <RevenueNumberField
          id="rev-minstay"
          :model-value="policy.minStay.default"
          suffix="nights"
          :min="1"
          :invalid="!!issueFor('minStay')"
          @update:model-value="policy = { ...policy, minStay: { ...policy.minStay, default: $event ?? 1 } }"
        />
        <p v-if="issueFor('minStay')" class="text-xs text-destructive">
          {{ issueFor('minStay') }}
        </p>
      </div>
      <div class="flex flex-col gap-1.5">
        <Label>Currency</Label>
        <Select :model-value="policy.currency" @update:model-value="policy = { ...policy, currency: String($event) }">
          <SelectTrigger class="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="code in currencies" :key="code" :value="code">
              {{ code }}
            </SelectItem>
          </SelectContent>
        </Select>
        <p class="text-xs text-muted-foreground">
          Amounts are not converted when this changes.
        </p>
      </div>
      <div class="flex flex-col gap-1.5">
        <Label>Rounding</Label>
        <div class="flex gap-2">
          <Select :model-value="policy.rounding.mode" @update:model-value="policy = { ...policy, rounding: { ...policy.rounding, mode: $event as RoundingMode } }">
            <SelectTrigger class="min-w-0 flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="(label, mode) in roundingLabels" :key="mode" :value="mode">
                {{ label }}
              </SelectItem>
            </SelectContent>
          </Select>
          <RevenueNumberField
            v-if="policy.rounding.mode === 'nearest' || policy.rounding.mode === 'up'"
            :model-value="policy.rounding.step"
            :min="1"
            aria-label="Rounding step"
            class="w-28"
            @update:model-value="policy = { ...policy, rounding: { ...policy.rounding, step: $event ?? 1 } }"
          />
        </div>
      </div>
    </div>
  </Card>
</template>
