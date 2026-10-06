<script setup lang="ts">
import type { CoverageLine, TernTier } from '~/components/reservations/data/tern-products'
import { formatProtectionAmount } from '~/components/reservations/data/damage-protection'
import { ternPriceFor, ternProduct } from '~/components/reservations/data/tern-products'

/**
 * What one Elev8 Cover tier covers, area by area (Tern's product fields:
 * unit, personal, real property, liability, bed bugs, endorsements). Staff
 * facing: shown where a package is picked, never to the guest.
 */
const props = defineProps<{
  tier: TernTier
  currency: string
}>()

const price = computed(() => ternPriceFor(props.tier, props.currency))

function money(amount: number): string {
  return formatProtectionAmount(amount, props.currency)
}

/** "Max USD 1'000.00 per item · USD 100.00 deductible", or "No deductible". */
function terms(line: CoverageLine): string {
  const parts: string[] = []
  if (line.maxPerItem)
    parts.push(`Max ${money(line.maxPerItem)} per item`)
  parts.push(line.deductible > 0 ? `${money(line.deductible)} deductible` : 'No deductible')
  return parts.join(' · ')
}

const rows = computed(() => {
  const c = price.value?.coverage
  if (!c)
    return []
  return [
    { key: 'unit', icon: 'lucide:armchair', label: 'Rental unit and contents', value: `Up to ${money(c.unit.limit)}`, detail: terms(c.unit) },
    { key: 'personal', icon: 'lucide:luggage', label: 'Guest\'s belongings', value: `Up to ${money(c.personal.limit)}`, detail: terms(c.personal) },
    { key: 'realProperty', icon: 'lucide:house', label: 'Building', value: `Up to ${money(c.realProperty.limit)}`, detail: terms(c.realProperty) },
    {
      key: 'liability',
      icon: 'lucide:scale',
      label: 'Host liability',
      value: `Up to ${money(c.liability.limit)}`,
      detail: `${c.liability.type ? `${c.liability.type}, ` : ''}${money(c.liability.aggregate)} in total · ${terms(c.liability)}`,
    },
    {
      key: 'bedBug',
      icon: 'lucide:bug',
      label: 'Bed bugs',
      value: `Up to ${money(c.bedBug.limit)}`,
      detail: `${c.bedBug.type ? `${c.bedBug.type} · ` : ''}${terms(c.bedBug)}`,
    },
    { key: 'smoking', icon: 'lucide:cigarette', label: 'Smoking damage', value: c.smokingEndorsement ? 'Covered' : 'Not covered', detail: '' },
    { key: 'pets', icon: 'lucide:paw-print', label: 'Damage by pets', value: c.pets ? 'Covered' : 'Not covered', detail: '' },
  ]
})
</script>

<template>
  <div class="rounded-md border" data-testid="coverage-breakdown">
    <div class="flex items-center justify-between gap-2 border-b px-3 py-2">
      <p class="text-xs font-medium">
        What Elev8 Cover {{ ternProduct(tier).name }} covers
      </p>
      <span v-if="price" class="text-[11px] text-muted-foreground">{{ price.coverage.productCode }}</span>
    </div>
    <p v-if="!price" class="px-3 py-2 text-xs text-muted-foreground">
      Not available in {{ currency }} yet.
    </p>
    <ul v-else class="divide-y">
      <li v-for="row in rows" :key="row.key" class="flex items-start gap-2 px-3 py-2" :data-testid="`coverage-${row.key}`">
        <Icon :name="row.icon" class="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
        <div class="min-w-0 flex-1">
          <p class="text-xs">
            {{ row.label }}
          </p>
          <p v-if="row.detail" class="text-[11px] text-muted-foreground">
            {{ row.detail }}
          </p>
        </div>
        <span
          class="shrink-0 text-xs tabular-nums"
          :class="row.value === 'Not covered' ? 'text-muted-foreground' : 'font-medium'"
        >
          {{ row.value }}
        </span>
      </li>
    </ul>
    <p class="border-t px-3 py-2 text-[11px] text-muted-foreground">
      Placeholder figures until Elev8 Cover's product list is final. Wear and tear is never covered.
    </p>
  </div>
</template>
