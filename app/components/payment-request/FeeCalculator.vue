<script setup lang="ts">
import type { FeeMode } from './data/payment-requests'
import { calculateFee, calculateTotal } from './data/payment-requests'

interface Props {
  amount: number
  feeMode: FeeMode
  customFeePercentage?: number
  currency: string
}

const { amount, feeMode, customFeePercentage, currency } = defineProps<Props>()

const feeAmount = computed(() => calculateFee(amount, feeMode, customFeePercentage))
const totalAmount = computed(() => calculateTotal(amount, feeAmount.value))

const code = computed(() => currency || 'USD')

const feeLabel = computed(() => {
  if (feeMode === 'card') return 'Card fee (3%)'
  if (feeMode === 'manual') return `Manual fee (${customFeePercentage ?? 0}%)`
  return 'No fee'
})

const feeDisplay = computed(() => {
  if (feeMode === 'no_fee') return '-'
  return `${code.value} ${fmt(feeAmount.value)}`
})

function fmt(n: number) {
  if (currency === 'IDR')
    return n.toLocaleString('id-ID')
  return n.toFixed(2)
}
</script>

<template>
  <div class="rounded-lg border bg-muted/20 p-4 space-y-3">
    <p class="text-sm font-medium">
      Fee calculation
    </p>

    <div class="space-y-2">
      <div class="flex items-center justify-between text-sm">
        <span class="text-muted-foreground">Amount</span>
        <span>{{ code }} {{ fmt(amount) }}</span>
      </div>
      <div class="flex items-center justify-between text-sm">
        <span class="text-muted-foreground">
          {{ feeLabel }}
        </span>
        <span>{{ feeDisplay }}</span>
      </div>
      <Separator />
      <div class="flex items-center justify-between text-sm font-medium">
        <span>Total</span>
        <span>{{ code }} {{ fmt(totalAmount) }}</span>
      </div>
    </div>

    <p class="text-xs text-muted-foreground">
      {{ feeMode === 'card'
        ? 'Guest pays total amount including processing fee.'
        : feeMode === 'manual'
          ? `Guest pays total amount including ${customFeePercentage ?? 0}% fee.`
          : 'No processing fee. Guest pays exact amount.' }}
    </p>
  </div>
</template>
