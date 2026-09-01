<script setup lang="ts">
import type { OwnerStatementAdjustment } from '~/composables/useOwnerStatementDetail'
import { computed } from 'vue'
import { Badge } from '~/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'

const props = defineProps<{
  adjustments: OwnerStatementAdjustment[]
  currency: string
}>()

const totalImpact = computed(() => props.adjustments.reduce((s, a) => s + a.amount, 0))
</script>

<template>
  <Card v-if="adjustments.length > 0">
    <CardHeader>
      <CardTitle class="flex items-center justify-between text-base">
        <span>Adjustments</span>
        <Badge variant="outline">
          {{ adjustments.length }} {{ adjustments.length === 1 ? 'item' : 'items' }}
        </Badge>
      </CardTitle>
    </CardHeader>
    <CardContent class="space-y-3">
      <div
        v-for="adj in adjustments"
        :key="adj.id"
        class="rounded-md border p-3"
      >
        <div class="flex items-center justify-between">
          <p class="text-sm font-medium">
            {{ adj.label }}
          </p>
          <span
            class="text-sm font-semibold tabular-nums"
            :class="adj.amount < 0 ? 'text-destructive' : 'text-emerald-600'"
          >
            {{ currency }} {{ adj.amount.toLocaleString('id-ID') }}
          </span>
        </div>
        <p class="mt-1 text-xs text-muted-foreground">
          Affects period {{ adj.adjustsPeriod }}
        </p>
        <p v-if="adj.reason" class="mt-2 text-sm text-muted-foreground">
          {{ adj.reason }}
        </p>
      </div>
      <div class="flex items-center justify-between border-t pt-3">
        <p class="text-sm font-medium">
          Total adjustment impact
        </p>
        <span
          class="text-sm font-semibold tabular-nums"
          :class="totalImpact < 0 ? 'text-destructive' : 'text-emerald-600'"
        >
          {{ currency }} {{ totalImpact.toLocaleString('id-ID') }}
        </span>
      </div>
    </CardContent>
  </Card>
</template>
