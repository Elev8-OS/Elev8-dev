<script setup lang="ts">
// Adjustments card — two groups, deliberately kept apart.
//
//   `adjustments`  corrections whose money is inside this statement's total.
//                  These are what "Total adjustment impact" sums.
//   `related`      corrections filed against this statement after it was
//                  published. A published statement is frozen, so the money
//                  lands in a later statement; showing them here is how the
//                  owner learns a dispute was actioned. They are excluded
//                  from the total on purpose — adding them would claim a
//                  payout this statement never carried.

import type { OwnerStatementAdjustment } from '~/composables/useOwnerStatementDetail'
import { computed } from 'vue'
import { Badge } from '~/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'

const props = withDefaults(defineProps<{
  adjustments: OwnerStatementAdjustment[]
  currency: string
  related?: OwnerStatementAdjustment[]
}>(), {
  related: () => [],
})

const relatedRows = computed(() => props.related ?? [])
const totalImpact = computed(() => props.adjustments.reduce((s, a) => s + a.amount, 0))
const count = computed(() => props.adjustments.length + relatedRows.value.length)

function formatAmount(amount: number) {
  return `${props.currency} ${amount.toLocaleString('id-ID')}`
}
</script>

<template>
  <Card v-if="count > 0">
    <CardHeader>
      <CardTitle class="flex items-center justify-between text-base">
        <span>Adjustments</span>
        <Badge variant="outline">
          {{ count }} {{ count === 1 ? 'item' : 'items' }}
        </Badge>
      </CardTitle>
    </CardHeader>
    <CardContent class="space-y-3">
      <div
        v-for="adj in adjustments"
        :key="adj.id"
        class="rounded-md border p-3"
        data-testid="adjustment-applied"
      >
        <div class="flex items-center justify-between gap-3">
          <p class="text-sm font-medium">
            {{ adj.label }}
          </p>
          <span
            class="shrink-0 text-sm font-semibold tabular-nums"
            :class="adj.amount < 0 ? 'text-destructive' : 'text-emerald-600'"
          >
            {{ formatAmount(adj.amount) }}
          </span>
        </div>
        <p class="mt-1 text-xs text-muted-foreground">
          Affects period {{ adj.adjustsPeriod }}
        </p>
        <p v-if="adj.reason" class="mt-2 text-sm text-muted-foreground">
          {{ adj.reason }}
        </p>
      </div>

      <div v-if="adjustments.length > 0" class="flex items-center justify-between border-t pt-3">
        <p class="text-sm font-medium">
          Total adjustment impact
        </p>
        <span
          class="text-sm font-semibold tabular-nums"
          :class="totalImpact < 0 ? 'text-destructive' : 'text-emerald-600'"
        >
          {{ formatAmount(totalImpact) }}
        </span>
      </div>

      <div v-if="relatedRows.length > 0" class="space-y-3 border-t pt-3">
        <div class="space-y-1">
          <p class="text-sm font-medium">
            Corrections filed against this statement
          </p>
          <p class="text-xs text-muted-foreground">
            Published figures above stay as issued. These corrections are paid
            out in a later statement.
          </p>
        </div>
        <div
          v-for="adj in relatedRows"
          :key="adj.id"
          class="rounded-md border border-dashed p-3"
          data-testid="adjustment-related"
        >
          <div class="flex items-center justify-between gap-3">
            <p class="text-sm font-medium">
              {{ adj.label }}
            </p>
            <span
              class="shrink-0 text-sm font-semibold tabular-nums"
              :class="adj.amount < 0 ? 'text-destructive' : 'text-emerald-600'"
            >
              {{ formatAmount(adj.amount) }}
            </span>
          </div>
          <p class="mt-1 text-xs text-muted-foreground">
            <template v-if="adj.applied">
              Paid out in the {{ adj.appliesInPeriod }} statement
            </template>
            <template v-else>
              Will appear in the {{ adj.appliesInPeriod }} statement
            </template>
          </p>
          <p v-if="adj.reason" class="mt-2 text-sm text-muted-foreground">
            {{ adj.reason }}
          </p>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
