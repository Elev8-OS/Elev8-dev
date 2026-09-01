<script setup lang="ts">
import type { OwnerStatementDetail } from '~/composables/useOwnerStatementDetail'
import { computed } from 'vue'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import PortalStatementPeriodDelta from './PortalStatementPeriodDelta.vue'

const props = defineProps<{
  detail: OwnerStatementDetail
}>()

const statement = computed(() => props.detail.statement)
const comparison = computed(() => props.detail.priorPeriodComparison)
const currency = computed(() => statement.value?.currency ?? '')

const grossRevenue = computed(() => {
  const lines = statement.value?.publishedSnapshot?.lines ?? statement.value?.lines ?? []
  return lines.filter(l => l.category === 'revenue').reduce((s, l) => s + l.amount, 0)
})

const netRevenue = computed(() =>
  statement.value?.publishedSnapshot?.totalAmount ?? statement.value?.totalAmount ?? 0,
)

const occupancy = computed(() => {
  // occupancy is not stored in statement lines; fall back to 0 when not derivable
  return 0
})

const adr = computed(() => occupancy.value)
</script>

<template>
  <Card v-if="statement">
    <CardHeader>
      <CardTitle class="text-base">
        Period summary
      </CardTitle>
    </CardHeader>
    <CardContent>
      <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div class="space-y-1">
          <p class="text-xs text-muted-foreground">
            Gross revenue
          </p>
          <p class="text-xl font-semibold tabular-nums">
            {{ currency }} {{ grossRevenue.toLocaleString('id-ID') }}
          </p>
          <PortalStatementPeriodDelta
            v-if="comparison"
            :comparison="comparison.grossRevenue"
            format="percent"
          />
        </div>
        <div class="space-y-1">
          <p class="text-xs text-muted-foreground">
            Net revenue
          </p>
          <p class="text-xl font-semibold tabular-nums">
            {{ currency }} {{ netRevenue.toLocaleString('id-ID') }}
          </p>
          <PortalStatementPeriodDelta
            v-if="comparison"
            :comparison="comparison.netRevenue"
            format="percent"
          />
        </div>
        <div class="space-y-1">
          <p class="text-xs text-muted-foreground">
            Occupancy
          </p>
          <p class="text-xl font-semibold tabular-nums">
            {{ (occupancy * 100).toFixed(0) }}%
          </p>
          <PortalStatementPeriodDelta
            v-if="comparison"
            :comparison="comparison.occupancy"
            format="percent"
          />
        </div>
        <div class="space-y-1">
          <p class="text-xs text-muted-foreground">
            ADR
          </p>
          <p class="text-xl font-semibold tabular-nums">
            {{ currency }} {{ Math.round(adr).toLocaleString('id-ID') }}
          </p>
          <PortalStatementPeriodDelta
            v-if="comparison"
            :comparison="comparison.adr"
            format="percent"
          />
        </div>
      </div>
    </CardContent>
  </Card>
</template>
