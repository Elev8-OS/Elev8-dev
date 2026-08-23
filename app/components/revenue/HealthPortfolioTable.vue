<script setup lang="ts">
import type { RejectionReason } from '~/components/revenue/data/diagnosis'
import type { ApplyState, HealthSeverity, ObjectiveBasis, SyncState } from '~/components/revenue/data/health'
import type { useRevenueHealth } from '~/composables/useRevenueHealth'
import { contractLabels } from '~/components/revenue/data/diagnosis'
import { domainLabels } from '~/components/revenue/data/health'
import DiagnosisRow from '~/components/revenue/DiagnosisRow.vue'
import HealthMoney from '~/components/revenue/HealthMoney.vue'
import HealthSeverityBadge from '~/components/revenue/HealthSeverityBadge.vue'
import HealthSparkline from '~/components/revenue/HealthSparkline.vue'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '~/components/ui/table'

type PortfolioRow = ReturnType<typeof useRevenueHealth>['portfolioRows']['value'][number]

const props = defineProps<{
  rows: PortfolioRow[]
  basis: ObjectiveBasis
  /** Room whose diagnosis is open. One at a time keeps the table scannable. */
  expandedId: string | null
  applyStateFor: (findingId: string) => ApplyState
}>()

const emit = defineEmits<{
  toggle: [roomId: string]
  apply: [findingId: string]
  reject: [payload: { findingId: string, reason: RejectionReason }]
}>()

const SEVERITY_ORDER: HealthSeverity[] = ['critical', 'high', 'medium', 'low', 'info']

const SYNC_LABELS: Record<SyncState, string> = {
  live: 'Live',
  partial: 'Partial',
  paused: 'Paused',
  degraded: 'Degraded',
}

/**
 * Two of these come straight from the market-data side and are expected states
 * rather than errors — a blocked apply has to be able to name its reason.
 */
const SYNC_DETAIL: Partial<Record<SyncState, string>> = {
  partial: 'writes disabled',
  paused: 'not connected',
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

function isOpen(row: PortfolioRow) {
  return props.expandedId === row.room.id
}
</script>

<template>
  <div class="overflow-hidden rounded-xl border">
    <Table>
      <TableHeader>
        <TableRow class="bg-muted/40 hover:bg-muted/40">
          <TableHead class="w-[300px]">
            Listing
          </TableHead>
          <TableHead class="w-[130px]">
            At stake
          </TableHead>
          <TableHead class="w-[180px]">
            Findings
          </TableHead>
          <TableHead class="w-[160px]">
            Worst domain
          </TableHead>
          <TableHead class="w-[140px]">
            ADR vs set
          </TableHead>
          <TableHead class="w-[130px] text-right">
            Sync
          </TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        <template v-for="row in rows" :key="row.room.id">
          <TableRow
            class="cursor-pointer"
            :class="isOpen(row) ? 'bg-muted/40 hover:bg-muted/40' : ''"
            :aria-expanded="isOpen(row)"
            @click="emit('toggle', row.room.id)"
          >
            <TableCell>
              <div class="flex items-start gap-2">
                <Icon
                  :name="isOpen(row) ? 'lucide:chevron-down' : 'lucide:chevron-right'"
                  class="mt-1 size-3.5 shrink-0 text-muted-foreground"
                />
                <div>
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="font-semibold">{{ row.room.name }}</span>
                    <span
                      v-if="row.room.inHoldout"
                      class="rounded border bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground uppercase"
                    >holdout</span>
                    <!-- Contract type, because it decides the objective. -->
                    <span
                      v-if="row.diagnosis"
                      class="rounded border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                    >{{ contractLabels[row.diagnosis.contract] }}</span>
                  </div>
                  <div class="mt-0.5 flex flex-wrap items-center gap-2">
                    <span class="text-xs text-muted-foreground">{{ row.room.location }}</span>
                    <span
                      v-if="basis === 'margin' && !row.room.costInputsConfirmed"
                      class="rounded border border-warning/60 bg-warning/25 px-1.5 py-0.5 text-[10px] font-semibold text-warning-foreground"
                    >costs estimated</span>
                  </div>
                </div>
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
              <!-- Derived from the first failing gate, not set by hand. -->
              <div v-if="row.worstDomain" class="flex flex-col">
                <span class="text-sm">{{ domainLabels[row.worstDomain] }}</span>
                <span
                  v-if="row.diagnosis?.gate.firstFailing"
                  class="text-xs text-muted-foreground"
                >{{ row.diagnosis.gate.firstFailing === 'price' ? 'visibility holds' : `gate: ${row.diagnosis.gate.firstFailing}` }}</span>
              </div>
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
              <span class="inline-flex flex-col items-end">
                <span class="inline-flex items-center gap-1.5 text-xs" :class="syncClass(row.room.syncState)">
                  <span class="size-1.5 rounded-full" :class="syncDotClass(row.room.syncState)" aria-hidden="true" />
                  {{ SYNC_LABELS[row.room.syncState] }}
                </span>
                <span v-if="SYNC_DETAIL[row.room.syncState]" class="text-[10px] text-muted-foreground">
                  {{ SYNC_DETAIL[row.room.syncState] }}
                </span>
              </span>
            </TableCell>
          </TableRow>

          <TableRow v-if="isOpen(row)" class="hover:bg-transparent">
            <!--
              whitespace-normal is required: TableCell ships whitespace-nowrap,
              which inherits into every paragraph of the diagnosis and pushes
              prose straight through the panel borders.
            -->
            <TableCell colspan="6" class="p-0 whitespace-normal">
              <DiagnosisRow
                :room="row.room"
                :finding="row.worst"
                :diagnosis="row.diagnosis"
                :basis="basis"
                :apply-state="row.worst ? applyStateFor(row.worst.id) : 'idle'"
                @apply="id => emit('apply', id)"
                @reject="payload => emit('reject', payload)"
              />
            </TableCell>
          </TableRow>
        </template>

        <TableRow v-if="!rows.length" class="hover:bg-transparent">
          <TableCell colspan="6" class="py-10 text-center text-sm text-muted-foreground">
            No findings match these filters.
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>
</template>
