<script setup lang="ts">
import type { HealthSeverity, ObjectiveBasis, SyncState } from '~/components/revenue/data/health'
import type { useRevenueHealth } from '~/composables/useRevenueHealth'
import { domainLabels } from '~/components/revenue/data/health'
import HealthMoney from '~/components/revenue/HealthMoney.vue'
import HealthSeverityBadge from '~/components/revenue/HealthSeverityBadge.vue'
import HealthSparkline from '~/components/revenue/HealthSparkline.vue'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '~/components/ui/table'

type PortfolioRow = ReturnType<typeof useRevenueHealth>['portfolioRows']['value'][number]

defineProps<{
  rows: PortfolioRow[]
  basis: ObjectiveBasis
}>()

const SEVERITY_ORDER: HealthSeverity[] = ['critical', 'high', 'medium', 'low', 'info']

const SYNC_LABELS: Record<SyncState, string> = {
  live: 'Live',
  partial: 'Partial',
  paused: 'Paused',
  degraded: 'Degraded',
}

function syncClass(state: SyncState) {
  return {
    live: 'text-muted-foreground',
    partial: 'text-warning-foreground',
    paused: 'text-warning-foreground',
    degraded: 'text-destructive font-semibold',
  }[state]
}

function syncDotClass(state: SyncState) {
  return {
    live: 'bg-foreground',
    partial: 'bg-warning',
    paused: 'bg-warning',
    degraded: 'bg-destructive',
  }[state]
}
</script>

<template>
  <div class="overflow-hidden rounded-xl border">
    <Table>
      <TableHeader>
        <TableRow class="bg-muted/40 hover:bg-muted/40">
          <TableHead class="w-[280px]">
            Listing
          </TableHead>
          <TableHead class="w-[130px]">
            At stake
          </TableHead>
          <TableHead class="w-[200px]">
            Findings
          </TableHead>
          <TableHead class="w-[150px]">
            Worst domain
          </TableHead>
          <TableHead class="w-[140px]">
            ADR vs set
          </TableHead>
          <TableHead class="w-[110px] text-right">
            Sync
          </TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        <TableRow
          v-for="row in rows" :key="row.room.id"
          class="cursor-pointer"
          @click="row.worst ? $router.push(`/revenue/${row.worst.id}`) : undefined"
        >
          <TableCell>
            <div class="flex flex-wrap items-center gap-2">
              <span class="font-semibold">{{ row.room.name }}</span>
              <span
                v-if="row.room.inHoldout"
                class="rounded border bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground uppercase"
              >holdout</span>
            </div>
            <div class="mt-0.5 flex flex-wrap items-center gap-2">
              <span class="text-xs text-muted-foreground">{{ row.room.location }}</span>
              <span
                v-if="basis === 'margin' && !row.room.costInputsConfirmed"
                class="rounded border border-warning/60 bg-warning/25 px-1.5 py-0.5 text-[10px] font-semibold text-warning-foreground"
              >costs estimated</span>
            </div>
          </TableCell>

          <TableCell>
            <HealthMoney
              v-if="row.worst"
              :estimate="row.worst.money[basis]"
              :basis="basis"
            />
            <span v-else class="text-sm text-muted-foreground">—</span>
          </TableCell>

          <TableCell>
            <div class="flex flex-wrap gap-1.5">
              <HealthSeverityBadge
                v-for="severity in SEVERITY_ORDER.filter(s => row.counts[s])"
                :key="severity"
                :severity="severity"
                :count="row.counts[severity]"
                :compact="severity !== 'critical' && severity !== 'high'"
              />
              <span v-if="!row.findings.length" class="text-xs text-muted-foreground">None open</span>
            </div>
          </TableCell>

          <TableCell>
            <span v-if="row.worst" class="text-sm">{{ domainLabels[row.worst.domain] }}</span>
            <span v-else class="text-sm text-muted-foreground">Not assessed</span>
          </TableCell>

          <TableCell>
            <div class="flex items-center gap-2">
              <HealthSparkline :values="row.room.trend" :reference="row.room.trendReference" />
              <span class="text-xs tabular-nums text-muted-foreground">
                {{ row.room.trend.length ? `${row.room.adrVsSet > 0 ? '+' : ''}${row.room.adrVsSet}%` : 'n/a' }}
              </span>
            </div>
          </TableCell>

          <TableCell class="text-right">
            <span class="inline-flex items-center gap-1.5 text-xs" :class="syncClass(row.room.syncState)">
              <span class="size-1.5 rounded-full" :class="syncDotClass(row.room.syncState)" aria-hidden="true" />
              {{ SYNC_LABELS[row.room.syncState] }}
            </span>
          </TableCell>
        </TableRow>

        <TableRow v-if="!rows.length" class="hover:bg-transparent">
          <TableCell colspan="6" class="py-10 text-center text-sm text-muted-foreground">
            No findings match these filters.
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>
</template>
