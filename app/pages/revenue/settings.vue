<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import RevenueBlackouts from '~/components/revenue/settings/RevenueBlackouts.vue'
import RevenueChannelMarkups from '~/components/revenue/settings/RevenueChannelMarkups.vue'
import RevenueCostDefaults from '~/components/revenue/settings/RevenueCostDefaults.vue'
import RevenueEngineSettings from '~/components/revenue/settings/RevenueEngineSettings.vue'
import RevenueEventsCalendar from '~/components/revenue/settings/RevenueEventsCalendar.vue'
import RevenueProviderSettings from '~/components/revenue/settings/RevenueProviderSettings.vue'
import RevenueSubstitutionGroups from '~/components/revenue/settings/RevenueSubstitutionGroups.vue'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'
import { useRevenueSettings } from '~/composables/useRevenueSettings'

definePageMeta({ layout: 'default' })

/**
 * Tenant-level revenue settings (spec §15.7). Per-room settings live on each
 * listing's Revenue tab. Every change here saves at once.
 */
const route = useRoute()
const router = useRouter()
const store = useRevenueSettings()

onMounted(() => store.hydrate())

const TABS = [
  { value: 'provider', label: 'Pricing engine', icon: 'lucide:plug-zap' },
  { value: 'engine', label: 'Basis and autonomy', icon: 'lucide:gauge' },
  { value: 'calendar', label: 'Calendar', icon: 'lucide:calendar-days' },
  { value: 'channels', label: 'Channel markups', icon: 'lucide:percent' },
  { value: 'costs', label: 'Costs', icon: 'lucide:receipt' },
  { value: 'groups', label: 'Substitution groups', icon: 'lucide:group' },
] as const

const isTab = (value: unknown) => TABS.some(t => t.value === value)
const activeTab = ref<string>(isTab(route.query.tab) ? String(route.query.tab) : 'provider')

watch(activeTab, (tab) => {
  router.replace({ query: { ...route.query, tab: tab === 'provider' ? undefined : tab } })
})

watch(() => route.query.tab, (tab) => {
  if (isTab(tab))
    activeTab.value = String(tab)
})
</script>

<template>
  <div class="flex flex-col gap-5 p-4 lg:p-6">
    <div>
      <NuxtLink to="/revenue" class="mb-2 flex w-fit items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
        <Icon name="lucide:chevron-left" class="size-3.5" />
        Listing health
      </NuxtLink>
      <h1 class="text-2xl font-bold tracking-tight">
        Revenue settings
      </h1>
      <p class="mt-1 text-sm text-muted-foreground">
        For the whole portfolio. Each room's prices, seasons and costs are set on its listing, under Revenue.
      </p>
    </div>

    <Tabs v-model="activeTab">
      <div class="overflow-x-auto">
        <TabsList>
          <TabsTrigger v-for="tab in TABS" :key="tab.value" :value="tab.value" :data-testid="`revenue-settings-tab-${tab.value}`">
            <Icon :name="tab.icon" class="mr-1.5 size-3.5" />
            {{ tab.label }}
          </TabsTrigger>
        </TabsList>
      </div>

      <div class="mt-5 max-w-4xl">
        <TabsContent value="provider">
          <RevenueProviderSettings />
        </TabsContent>
        <TabsContent value="engine">
          <RevenueEngineSettings />
        </TabsContent>
        <TabsContent value="calendar" class="flex flex-col gap-4">
          <RevenueBlackouts />
          <RevenueEventsCalendar />
        </TabsContent>
        <TabsContent value="channels">
          <RevenueChannelMarkups />
        </TabsContent>
        <TabsContent value="costs">
          <RevenueCostDefaults />
        </TabsContent>
        <TabsContent value="groups">
          <RevenueSubstitutionGroups />
        </TabsContent>
      </div>
    </Tabs>
  </div>
</template>
