<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { revenueStats } from '@/components/finance/data/revenue'
import { useCosts } from '@/composables/useCosts'
import { useReservations } from '@/composables/useReservations'
import { useUpsells } from '@/composables/useUpsells'

const activeTab = useState<string>('finance-active-tab', () => 'overview')

// Deep-link support: /finance?tab=integrations (alert routes, banners) lands on that tab.
onMounted(() => {
  const route = useRoute()
  const tab = route.query.tab
  if (typeof tab === 'string' && ['overview', 'revenue', 'costs', 'integrations'].includes(tab))
    activeTab.value = tab
})

const { costs, unsyncedCount: unsyncedCosts } = useCosts()
const { unsyncedCount: unsyncedReservations } = useReservations()
const { upsells, unsyncedCount: unsyncedUpsells } = useUpsells()

const currentMonth = '2026-05'

const IDR_TO_CHF = 18_524

const totalCostsCHF = computed(() =>
  costs.value
    .filter(c => c.date.startsWith(currentMonth))
    .reduce((sum, c) => sum + (c.currency === 'IDR' ? c.amount / IDR_TO_CHF : c.amount), 0),
)

const upsellRevenueCHF = computed(() =>
  upsells.value
    .filter(u => u.date.startsWith(currentMonth))
    .reduce((sum, u) => sum + u.amount, 0),
)

const netRevenueCHF = computed(() =>
  revenueStats.totalRevenue + upsellRevenueCHF.value,
)

const totalUnsynced = computed(() =>
  unsyncedCosts.value + unsyncedReservations.value + unsyncedUpsells.value,
)

function formatCHF(amount: number) {
  return `CHF ${amount.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- Page header -->
    <div>
      <h2 class="text-2xl font-bold tracking-tight">
        Finance
      </h2>
      <p class="text-sm text-muted-foreground">
        Revenue, costs, and operational spending across all listings.
      </p>
    </div>

    <!-- Summary cards -->
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-4">
      <!-- Net Revenue -->
      <div class="rounded-lg border bg-card p-5">
        <p class="text-sm text-muted-foreground">
          Net Revenue (May)
        </p>
        <p class="mt-1 text-2xl font-bold tracking-tight">
          {{ formatCHF(netRevenueCHF) }}
        </p>
        <p class="mt-1 text-xs text-muted-foreground">
          incl. {{ formatCHF(upsellRevenueCHF) }} upsells
        </p>
      </div>

      <!-- Total Costs -->
      <div class="rounded-lg border bg-card p-5">
        <p class="text-sm text-muted-foreground">
          Total Costs (May)
        </p>
        <p class="mt-1 text-2xl font-bold tracking-tight">
          {{ formatCHF(totalCostsCHF) }}
        </p>
        <p class="mt-1 text-xs text-muted-foreground">
          {{ costs.filter(c => c.date.startsWith(currentMonth)).length }} entries this month
        </p>
      </div>

      <!-- Upsell Revenue -->
      <div class="rounded-lg border bg-card p-5">
        <p class="text-sm text-muted-foreground">
          Upsell Revenue (May)
        </p>
        <p class="mt-1 text-2xl font-bold tracking-tight">
          {{ formatCHF(upsellRevenueCHF) }}
        </p>
        <p class="mt-1 text-xs text-muted-foreground">
          {{ upsells.filter(u => u.date.startsWith(currentMonth)).length }} upsells
        </p>
      </div>

      <!-- Unsynced Entries -->
      <div class="rounded-lg border bg-card p-5" :class="totalUnsynced > 0 ? 'border-amber-200 bg-amber-50/40' : ''">
        <p class="text-sm text-muted-foreground">
          Unsynced Entries
        </p>
        <p class="mt-1 text-2xl font-bold tracking-tight" :class="totalUnsynced > 0 ? 'text-amber-700' : ''">
          {{ totalUnsynced }}
        </p>
        <p class="mt-1 text-xs text-muted-foreground">
          <template v-if="totalUnsynced === 0">
            All synced to Jurnal
          </template>
          <template v-else>
            {{ unsyncedReservations }} reserv · {{ unsyncedCosts }} costs · {{ unsyncedUpsells }} upsells
          </template>
        </p>
      </div>
    </div>

    <!-- Tabs -->
    <Tabs v-model="activeTab">
      <TabsList>
        <TabsTrigger value="overview">
          Overview
        </TabsTrigger>
        <TabsTrigger value="revenue">
          Revenue
        </TabsTrigger>
        <TabsTrigger value="costs">
          Costs
        </TabsTrigger>
        <TabsTrigger value="integrations">
          Integrations
        </TabsTrigger>
      </TabsList>

      <TabsContent value="overview" class="mt-4">
        <FinanceOverviewTab />
      </TabsContent>

      <TabsContent value="revenue" class="mt-4">
        <FinanceRevenueTab />
      </TabsContent>

      <TabsContent value="costs" class="mt-4">
        <FinanceCostsTab />
      </TabsContent>

      <TabsContent value="integrations" class="mt-4">
        <FinanceIntegrationsTab />
      </TabsContent>
    </Tabs>
  </div>
</template>
