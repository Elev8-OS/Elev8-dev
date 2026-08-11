<script setup lang="ts">
import type { PaymentRequest } from '~/components/payment-request/data/payment-requests'

defineProps<{ requests: PaymentRequest[] }>()

const df = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

function fmtDate(iso: string): string {
  return df.format(new Date(iso))
}

function fmtCurrency(amount: number, currency: string): string {
  return `${amount.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${currency}`
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="text-base">
        Payment requests
      </CardTitle>
    </CardHeader>
    <CardContent class="px-6 pb-4">
      <div v-if="requests.length === 0" class="flex flex-col items-center gap-2 py-12 text-sm text-muted-foreground">
        <Icon name="lucide:link" class="size-8 opacity-50" />
        No payment requests.
      </div>
      <div v-else class="divide-y">
        <div
          v-for="r in requests"
          :key="r.id"
          class="flex items-center justify-between gap-3 py-3"
        >
          <div class="min-w-0">
            <p class="text-sm font-medium truncate">
              {{ r.title }}
            </p>
            <p class="text-xs text-muted-foreground">
              {{ fmtDate(r.createdAt) }} · {{ r.status }}
            </p>
          </div>
          <div class="text-sm font-semibold tabular-nums">
            {{ fmtCurrency(r.totalAmount, r.currency) }}
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
