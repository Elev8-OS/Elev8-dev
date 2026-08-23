<script setup lang="ts">
import type { GateStage } from '~/components/revenue/data/diagnosis'
import type { HealthDomain, HealthSeverity, ObjectiveBasis } from '~/components/revenue/data/health'
import { computed } from 'vue'
import { gateStageLabels } from '~/components/revenue/data/diagnosis'
import { basisLabels, domainLabels } from '~/components/revenue/data/health'
import HealthPortfolioTable from '~/components/revenue/HealthPortfolioTable.vue'
import { Button } from '~/components/ui/button'
import { Card, CardContent } from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '~/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipTrigger } from '~/components/ui/tooltip'
import { useRevenueHealth } from '~/composables/useRevenueHealth'

definePageMeta({ layout: 'default' })

const {
  applyFinding,
  applyStateFor,
  basis,
  expanded,
  filters,
  notAssessable,
  portfolioRows,
  rejectFinding,
  resetFilters,
  stats,
  summary,
  toggleExpanded,
} = useRevenueHealth()

const domainOptions = Object.keys(domainLabels) as HealthDomain[]
const severityOptions: HealthSeverity[] = ['critical', 'high', 'medium', 'low']
const gateOptions = Object.keys(gateStageLabels) as GateStage[]

const hasFilters = computed(() =>
  filters.value.search !== ''
  || filters.value.domain !== 'all'
  || filters.value.minSeverity !== 'all'
  || filters.value.gate !== 'all',
)

function money(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount)
}
</script>

<template>
  <div class="flex flex-col gap-5 p-4 lg:p-6">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="text-xs font-medium text-muted-foreground">
          Revenue
        </p>
        <h1 class="text-2xl font-bold tracking-tight">
          Listing health
        </h1>
      </div>
      <p class="text-xs text-muted-foreground">
        Last check {{ summary.lastCheckLabel }} ·
        <button type="button" class="font-medium text-foreground underline-offset-2 hover:underline">
          Re-check now
        </button>
      </p>
    </div>

    <!--
      Toolbar. The basis switch is a VIEW LENS: it re-ranks and re-labels the
      list, but what the engine optimises per room comes from the owner
      contract, which is why every row carries its contract type.
    -->
    <div class="flex flex-wrap items-center gap-3">
      <Tooltip>
        <TooltipTrigger as-child>
          <Tabs :model-value="basis" @update:model-value="value => basis = value as ObjectiveBasis">
            <TabsList>
              <TabsTrigger value="revenue">
                {{ basisLabels.revenue }}
              </TabsTrigger>
              <TabsTrigger value="margin">
                {{ basisLabels.margin }}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </TooltipTrigger>
        <TooltipContent class="max-w-72">
          Changes how the list is ranked and valued. What the engine optimises for a room follows its owner contract — shown on each row.
        </TooltipContent>
      </Tooltip>

      <Input v-model="filters.search" placeholder="Search listings" class="w-56" />

      <Select :model-value="filters.domain" @update:model-value="value => filters.domain = value as HealthDomain | 'all'">
        <SelectTrigger class="w-[190px]">
          <SelectValue placeholder="All domains" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">
            All domains
          </SelectItem>
          <SelectItem v-for="domain in domainOptions" :key="domain" :value="domain">
            {{ domainLabels[domain] }}
          </SelectItem>
        </SelectContent>
      </Select>

      <Select :model-value="filters.minSeverity" @update:model-value="value => filters.minSeverity = value as HealthSeverity | 'all'">
        <SelectTrigger class="w-[200px]">
          <SelectValue placeholder="Any severity" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">
            Any severity
          </SelectItem>
          <SelectItem v-for="severity in severityOptions" :key="severity" :value="severity">
            {{ severity }} and above
          </SelectItem>
        </SelectContent>
      </Select>

      <!-- Gate filter: work through every visibility problem in one pass. -->
      <Select :model-value="filters.gate" @update:model-value="value => filters.gate = value as GateStage | 'all'">
        <SelectTrigger class="w-[190px]">
          <SelectValue placeholder="Any gate" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">
            Any gate
          </SelectItem>
          <SelectItem v-for="stage in gateOptions" :key="stage" :value="stage">
            Gate: {{ gateStageLabels[stage].toLowerCase() }}
          </SelectItem>
        </SelectContent>
      </Select>

      <Button v-if="hasFilters" variant="ghost" size="sm" @click="resetFilters()">
        Clear
      </Button>
    </div>

    <!-- Stats -->
    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Card>
        <CardContent class="pt-0">
          <p class="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">
            Largest single opportunity
          </p>
          <p class="mt-2 text-2xl font-semibold tabular-nums">
            {{ stats.largest ? money(stats.largest.money[basis].amount) : '—' }}
          </p>
          <p class="mt-1.5 text-xs text-muted-foreground">
            <template v-if="stats.largest && stats.largestRoom">
              {{ stats.largestRoom.name }} · band
              {{ money(stats.largest.money[basis].low) }}–{{ money(stats.largest.money[basis].high) }}
            </template>
            <template v-else>
              Nothing open
            </template>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent class="pt-0">
          <p class="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">
            Open findings
          </p>
          <p class="mt-2 text-2xl font-semibold tabular-nums">
            {{ stats.open }}
          </p>
          <div class="mt-1.5 flex gap-3 text-xs text-muted-foreground">
            <span class="flex items-center gap-1.5">
              <span class="size-1.5 rounded-sm bg-destructive" aria-hidden="true" />
              {{ stats.critical }} critical
            </span>
            <span class="flex items-center gap-1.5">
              <span class="size-1.5 rounded-sm bg-warning" aria-hidden="true" />
              {{ stats.high }} high
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent class="pt-0">
          <p class="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">
            Applied this week
          </p>
          <p class="mt-2 text-2xl font-semibold tabular-nums">
            {{ summary.appliedThisWeek }}
          </p>
          <p class="mt-1.5 text-xs text-muted-foreground">
            {{ summary.appliedAutomatically }} automatic ·
            {{ summary.appliedThisWeek - summary.appliedAutomatically }} approved by you
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent class="pt-0">
          <p class="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">
            Measured uplift
          </p>
          <p class="mt-2 text-2xl font-semibold tabular-nums">
            +{{ summary.upliftPercent }}%
          </p>
          <p class="mt-1.5 text-xs text-muted-foreground">
            ADR vs holdout · {{ summary.upliftRoomsMeasured }} of {{ summary.roomsTotal }} rooms
          </p>
        </CardContent>
      </Card>
    </div>

    <!--
      Deliberately a line, not a fifth card: completeness matters, but it must
      not compete with the money figure for attention. Without it a portfolio
      with eight findings reads as healthy while a dozen rooms were never
      assessed at all.
    -->
    <div
      v-if="notAssessable.length"
      class="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground"
    >
      <Icon name="lucide:eye-off" class="size-3.5 shrink-0" />
      <span class="font-medium text-foreground">
        {{ notAssessable.length }} rooms not assessable
      </span>
      <span>—</span>
      <span v-for="(room, index) in notAssessable" :key="room.roomId">
        {{ room.name }} ({{ room.missing }}){{ index < notAssessable.length - 1 ? ' · ' : '' }}
      </span>
    </div>

    <HealthPortfolioTable
      :rows="portfolioRows"
      :basis="basis"
      :expanded-id="expanded"
      :apply-state-for="applyStateFor"
      @toggle="toggleExpanded"
      @apply="applyFinding"
      @reject="payload => rejectFinding(payload.findingId, payload.reason)"
    />

    <!-- Legend and the one honesty note the ranking depends on -->
    <div class="flex flex-wrap items-center gap-x-6 gap-y-2 px-1 text-xs text-muted-foreground">
      <span class="flex items-center gap-2">
        <svg width="20" height="8" viewBox="0 0 20 8" fill="none" aria-hidden="true">
          <path d="M1 6 L19 2" class="stroke-foreground" stroke-width="2" stroke-linecap="round" />
        </svg>
        Our realised ADR, 30 days
      </span>
      <span class="flex items-center gap-2">
        <svg width="20" height="8" viewBox="0 0 20 8" fill="none" aria-hidden="true">
          <path d="M1 4 L19 4" class="stroke-muted-foreground" stroke-width="1.5" stroke-dasharray="3 3" stroke-linecap="round" />
        </svg>
        Comparable-set median
      </span>
      <span>Each row shows its largest single opportunity — never a sum, because findings can overlap the same nights.</span>
      <span>Worst domain is the first funnel gate that fails: a listing shown and not clicked has no price problem, so no price finding is raised for it.</span>
    </div>
  </div>
</template>
