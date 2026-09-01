<script setup lang="ts">
import type { Integration, IntegrationStatus } from '@/components/finance/data/integrations'
import { computed, onMounted, ref, watch } from 'vue'
import { integrations } from '@/components/finance/data/integrations'
import { useDatev } from '@/composables/useDatev'
import { useJurnal } from '@/composables/useJurnal'
import { useLexware } from '@/composables/useLexware'

const { isConnected: jurnalConnected } = useJurnal()
const { isConnected: lexwareConnected } = useLexware()
const { isConfigured: datevConfigured, hydrate: hydrateDatev } = useDatev()

const selected = ref<Integration | null>(null)
const sheetOpen = ref(false)

// Deep-link support: /finance?tab=integrations&integration=datev opens that
// integration's sheet directly, so "Configure" from the Exports tab lands here.
//
// Two paths have to work: arriving with the query already set (this tab mounts
// fresh -> onMounted), and the query changing while this tab is already mounted
// (-> watcher). The param is consumed once opened so closing the sheet and
// clicking the same link again re-opens it.
const route = useRoute()
const router = useRouter()

// In-page requests (the Exports tab's Configure button) hand the id over via
// shared state — no navigation, so nothing depends on a route change firing.
const integrationToOpen = useState<string | null>('finance-open-integration', () => null)

function openById(id: unknown): boolean {
  if (typeof id !== 'string')
    return false
  const match = integrations.find(i => i.id === id)
  if (!match || match.status === 'coming_soon')
    return false
  openIntegration(match)
  return true
}

/** Consumed once so closing the sheet and asking again re-opens it. */
function consumeRequest() {
  if (openById(integrationToOpen.value))
    integrationToOpen.value = null

  if (openById(route.query.integration)) {
    const { integration: _consumed, ...rest } = route.query
    router.replace({ query: rest })
  }
}

// Both entry points have to work: this tab mounting with a request already
// pending, and a request arriving while it is already mounted.
onMounted(() => {
  hydrateDatev()
  consumeRequest()
})

watch(integrationToOpen, consumeRequest)
watch(() => route.query.integration, consumeRequest)

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
  // DATEV is a file handoff, not a connection — it is configured, not connected.
  if (integration.id === 'datev') {
    return datevConfigured.value ? 'configured' : 'available'
  }
  return integration.status
}

/** File-handoff integrations are "set up", not "connected". */
function actionLabel(integration: Integration): string {
  const status = effectiveStatus(integration)
  if (status === 'connected' || status === 'configured')
    return 'Manage'
  return integration.id === 'datev' ? 'Set up' : 'Connect'
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
  configured: 'Configured',
  available: 'Not connected',
  coming_soon: 'Coming soon',
}

const statusClass: Record<string, string> = {
  connected: 'text-green-700 bg-green-50',
  configured: 'text-green-700 bg-green-50',
  available: 'text-slate-600 bg-slate-100',
  coming_soon: 'text-slate-400 bg-slate-50',
}

const statusDot: Record<string, string> = {
  connected: 'bg-green-500',
  configured: 'bg-green-500',
  available: 'bg-slate-400',
  coming_soon: 'bg-slate-300',
}

const componentMap: Record<string, ReturnType<typeof resolveComponent>> = {
  FinanceJurnalIntegration: resolveComponent('FinanceJurnalIntegration'),
  FinanceBexioIntegration: resolveComponent('FinanceBexioIntegration'),
  FinanceLexwareIntegration: resolveComponent('FinanceLexwareIntegration'),
  FinanceDatevExportSettings: resolveComponent('FinanceDatevExportSettings'),
  FinanceJurnalLogo: resolveComponent('FinanceJurnalLogo'),
  FinanceBexioLogo: resolveComponent('FinanceBexioLogo'),
  FinanceLexwareLogo: resolveComponent('FinanceLexwareLogo'),
  FinanceDatevLogo: resolveComponent('FinanceDatevLogo'),
}

const activeComponent = computed(() => {
  const name = selected.value?.component
  if (!name)
    return null
  const resolved = componentMap[name]
  // resolveComponent() hands back the bare NAME as a string when Nuxt has not
  // registered the component — typically a stale dev server after a new file was
  // added. Rendering that string produces an empty sheet with no clue why, so
  // fall through to the visible fallback below instead.
  return typeof resolved === 'string' ? null : resolved ?? null
})

const unresolvedComponent = computed(() =>
  Boolean(selected.value?.component) && activeComponent.value === null,
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
              <component
                :is="componentMap[integration.logo]"
                v-if="integration.logo && componentMap[integration.logo]"
                :class="integration.logoClass ?? 'h-5 w-auto'"
              />
              <div v-else class="flex h-9 w-9 items-center justify-center rounded-md border bg-muted">
                <Icon :name="integration.icon" class="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
            <span
              class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
              :class="statusClass[effectiveStatus(integration)]"
            >
              <span class="h-1.5 w-1.5 rounded-full" :class="statusDot[effectiveStatus(integration)]" />
              {{ effectiveStatus(integration) === 'available' && integration.id === 'datev'
                ? 'Not set up'
                : statusLabel[effectiveStatus(integration)] }}
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
            {{ actionLabel(integration) }}
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
        <div class="flex flex-col gap-1">
          <SheetTitle class="text-base">
            {{ selected?.name ?? 'Integration' }}
          </SheetTitle>
          <SheetDescription class="text-xs">
            {{ selected?.description ?? 'Accounting software integration.' }}
          </SheetDescription>
        </div>
      </SheetHeader>
      <ScrollArea class="min-h-0 flex-1">
        <div class="p-6">
          <component :is="activeComponent" v-if="activeComponent" />
          <div v-else-if="unresolvedComponent" class="flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50/60 p-4">
            <p class="text-sm font-medium text-amber-900">
              Could not load the settings panel
            </p>
            <p class="text-xs leading-relaxed text-amber-800">
              <code class="font-mono">{{ selected?.component }}</code> is not registered. If you just
              pulled new files, restart the dev server so Nuxt picks up the component.
            </p>
          </div>
          <p v-else class="text-sm text-muted-foreground">
            Configuration not available.
          </p>
        </div>
      </ScrollArea>
    </SheetContent>
  </Sheet>
</template>
