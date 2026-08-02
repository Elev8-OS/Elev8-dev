<script setup lang="ts">
import type { Integration, IntegrationStatus } from '@/components/finance/data/integrations'
import { computed, ref, watch } from 'vue'
import { integrations } from '@/components/finance/data/integrations'
import { useJurnal } from '@/composables/useJurnal'
import { useLexware } from '@/composables/useLexware'

const { isConnected: jurnalConnected } = useJurnal()
const { isConnected: lexwareConnected } = useLexware()

const selected = ref<Integration | null>(null)
const sheetOpen = ref(false)

// Close sheet when an integration is disconnected
watch(jurnalConnected, (val) => {
  if (!val)
    sheetOpen.value = false
})

watch(lexwareConnected, (val) => {
  if (!val)
    sheetOpen.value = false
})

function openIntegration(integration: Integration) {
  selected.value = integration
  sheetOpen.value = true
}

function effectiveStatus(integration: Integration): IntegrationStatus {
  if (integration.id === 'mekari-jurnal') {
    return jurnalConnected.value ? 'connected' : 'available'
  }
  if (integration.id === 'lexware') {
    return lexwareConnected.value ? 'connected' : 'available'
  }
  return integration.status
}

const byCategory = computed(() => {
  const map: Record<string, Integration[]> = {}
  for (const i of integrations) {
    if (!map[i.category])
      map[i.category] = [] as Integration[]
    map[i.category]!.push(i)
  }
  return map
})

const statusLabel: Record<string, string> = {
  connected: 'Connected',
  available: 'Not connected',
  coming_soon: 'Coming soon',
}

const statusClass: Record<string, string> = {
  connected: 'text-green-700 bg-green-50',
  available: 'text-slate-600 bg-slate-100',
  coming_soon: 'text-slate-400 bg-slate-50',
}

const statusDot: Record<string, string> = {
  connected: 'bg-green-500',
  available: 'bg-slate-400',
  coming_soon: 'bg-slate-300',
}

const componentMap: Record<string, ReturnType<typeof resolveComponent>> = {
  FinanceJurnalIntegration: resolveComponent('FinanceJurnalIntegration'),
  FinanceBexioIntegration: resolveComponent('FinanceBexioIntegration'),
  FinanceLexwareIntegration: resolveComponent('FinanceLexwareIntegration'),
  FinanceJurnalLogo: resolveComponent('FinanceJurnalLogo'),
  FinanceBexioLogo: resolveComponent('FinanceBexioLogo'),
  FinanceLexwareLogo: resolveComponent('FinanceLexwareLogo'),
}

const activeComponent = computed(() =>
  selected.value?.component ? componentMap[selected.value.component] : null,
)
</script>

<template>
  <div class="flex flex-col gap-8">
    <div v-for="(items, category) in byCategory" :key="category">
      <p class="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {{ category }}
      </p>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div
          v-for="integration in items"
          :key="integration.id"
          class="flex flex-col rounded-lg border bg-card p-4 transition-colors"
          :class="integration.status === 'coming_soon' ? 'opacity-60' : 'hover:border-border/80'"
        >
          <div class="mb-3 flex items-start justify-between">
            <div class="flex h-9 items-center justify-center">
              <component :is="componentMap[integration.logo]" v-if="integration.logo && componentMap[integration.logo]" class="h-5 w-auto" />
              <div v-else class="flex h-9 w-9 items-center justify-center rounded-md border bg-muted">
                <Icon :name="integration.icon" class="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
            <span
              class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
              :class="statusClass[effectiveStatus(integration)]"
            >
              <span class="h-1.5 w-1.5 rounded-full" :class="statusDot[effectiveStatus(integration)]" />
              {{ statusLabel[effectiveStatus(integration)] }}
            </span>
          </div>
          <p class="mb-1 text-sm font-medium">
            {{ integration.name }}
          </p>
          <p class="mb-4 flex-1 text-xs text-muted-foreground leading-relaxed">
            {{ integration.description }}
          </p>
          <Button
            v-if="effectiveStatus(integration) !== 'coming_soon'"
            variant="outline"
            size="sm"
            class="self-start"
            @click="openIntegration(integration)"
          >
            {{ effectiveStatus(integration) === 'connected' ? 'Manage' : 'Connect' }}
          </Button>
          <span v-else class="text-xs text-muted-foreground">Available soon</span>
        </div>
      </div>
    </div>
  </div>

  <!-- Integration config sheet -->
  <Sheet v-model:open="sheetOpen">
    <SheetContent class="flex w-full flex-col gap-0 p-0 sm:max-w-xl" side="right">
      <SheetHeader class="border-b px-6 py-4">
        <div class="flex items-center gap-3">
          <SheetTitle class="text-base">
            Accounting Software Integration
          </SheetTitle>
        </div>
      </SheetHeader>
      <ScrollArea class="flex-1">
        <div class="p-6">
          <component :is="activeComponent" v-if="activeComponent" />
          <p v-else class="text-sm text-muted-foreground">
            Configuration not available.
          </p>
        </div>
      </ScrollArea>
    </SheetContent>
  </Sheet>
</template>
