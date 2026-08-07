<script setup lang="ts">
import type { UpsellItem } from '~/components/inbox/data/conversations'

defineProps<{ items: UpsellItem[] }>()

function fmtCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
}

const statusMeta: Record<UpsellItem['status'], { label: string, tone: string }> = {
  confirmed: { label: 'Confirmed', tone: 'bg-green-500/10 text-green-700 border-green-500/30' },
  pending: { label: 'Pending', tone: 'bg-amber-500/10 text-amber-700 border-amber-500/30' },
  cancelled: { label: 'Cancelled', tone: 'bg-muted text-muted-foreground border-border' },
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="text-base">
        Upsells
      </CardTitle>
    </CardHeader>
    <CardContent class="p-0">
      <div v-if="items.length === 0" class="flex flex-col items-center gap-2 py-12 text-sm text-muted-foreground">
        <Icon name="lucide:tag" class="size-8 opacity-50" />
        No upsells.
      </div>
      <div v-else class="divide-y">
        <div
          v-for="item in items"
          :key="item.id"
          class="flex items-center justify-between gap-3 px-4 py-3"
        >
          <div class="min-w-0">
            <p class="text-sm font-medium truncate">
              {{ item.name }}
            </p>
            <p class="text-xs text-muted-foreground">
              Purchased {{ new Date(item.purchasedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }}
            </p>
          </div>
          <div class="flex items-center gap-2">
            <Badge variant="outline" :class="statusMeta[item.status].tone">
              {{ statusMeta[item.status].label }}
            </Badge>
            <span class="text-sm font-semibold tabular-nums">
              {{ fmtCurrency(item.price, item.currency) }}
            </span>
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
