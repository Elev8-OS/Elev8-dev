<script setup lang="ts">
import type {
  ApiCall,
  CapabilityAccess,
  FeedState,
  PriceLabsCapability,
  PriceLabsUnit,
} from '~/composables/usePriceLabs'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import {
  capabilityAccessLabels,
  feedStateLabels,
  PROVISIONAL_API,
} from '~/composables/usePriceLabs'

const pl = usePriceLabs()

const connectDialogOpen = ref(false)
const disconnectDialogOpen = ref(false)
const isConnecting = ref(false)
const connectError = ref('')
const busy = ref<string | null>(null)
const expandedCall = ref<string | null>(null)
const logOpen = ref(true)

const accountName = ref('')
const apiKey = ref('')

const connection = computed(() => pl.connection.value)
const isConnected = computed(() => pl.isConnected.value)

const feedStateClass: Record<FeedState, string> = {
  live: 'text-green-700',
  partial: 'text-amber-700',
  paused: 'text-muted-foreground',
  degraded: 'text-destructive',
  never: 'text-muted-foreground',
}

const feedDotClass: Record<FeedState, string> = {
  live: 'bg-green-500',
  partial: 'bg-amber-500',
  paused: 'bg-muted-foreground/40',
  degraded: 'bg-destructive',
  never: 'bg-muted-foreground/25',
}

const accessClass: Record<CapabilityAccess, string> = {
  read_write: 'border-green-500/30 bg-green-500/10 text-green-700',
  read_only: 'border-amber-500/30 bg-amber-500/10 text-amber-700',
  unsupported: 'border-destructive/30 bg-destructive/5 text-destructive',
  unverified: 'border-muted-foreground/30 bg-muted text-muted-foreground',
}

const accessOptions: { value: CapabilityAccess, label: string }[] = [
  { value: 'unverified', label: capabilityAccessLabels.unverified },
  { value: 'read_write', label: capabilityAccessLabels.read_write },
  { value: 'read_only', label: capabilityAccessLabels.read_only },
  { value: 'unsupported', label: capabilityAccessLabels.unsupported },
]

const maskedKey = computed(() => {
  const key = connection.value?.apiKey ?? ''
  if (key.length <= 10)
    return key
  return `${key.slice(0, 6)}${'•'.repeat(12)}${key.slice(-4)}`
})

function roomName(roomId: string | null): string {
  if (!roomId)
    return ''
  return pl.rooms.value.find(r => r.id === roomId)?.name ?? roomId
}

/** One Room takes one unit, so rooms already claimed elsewhere are hidden. */
function availableRooms(unit: PriceLabsUnit) {
  const taken = new Set(
    pl.units.value.filter(u => u.providerUnitId !== unit.providerUnitId && u.roomId).map(u => u.roomId),
  )
  return pl.rooms.value.filter(r => !taken.has(r.id))
}

function driftFor(unit: PriceLabsUnit) {
  return pl.drift.value.filter(d => d.providerUnitId === unit.providerUnitId)
}

const unitPickers = ref<Record<string, boolean>>({})
function togglePicker(id: string, open: boolean) {
  unitPickers.value = { ...unitPickers.value, [id]: open }
}

function statusClass(status: number) {
  if (status >= 200 && status < 300)
    return 'text-green-700 bg-green-500/10 border-green-500/30'
  if (status >= 400)
    return 'text-destructive bg-destructive/5 border-destructive/30'
  return 'text-muted-foreground bg-muted border-muted-foreground/30'
}

function methodClass(method: string) {
  return method === 'GET'
    ? 'text-sky-700 bg-sky-500/10 border-sky-500/30'
    : 'text-violet-700 bg-violet-500/10 border-violet-500/30'
}

function pretty(value: unknown): string {
  if (value === null || value === undefined)
    return '(no body)'
  return JSON.stringify(value, null, 2)
}

function formatTime(iso: string | null): string {
  if (!iso)
    return 'never'
  return new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
}

function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour12: false })
}

async function handleConnect() {
  if (isConnecting.value)
    return
  isConnecting.value = true
  connectError.value = ''
  const result = await pl.connect(accountName.value, apiKey.value)
  isConnecting.value = false
  if (!result.success) {
    connectError.value = result.error
    return
  }
  toast.success(`Connected. ${result.listingCount} listings returned by PriceLabs.`)
  connectDialogOpen.value = false
  accountName.value = ''
  apiKey.value = ''
}

async function withBusy(key: string, fn: () => Promise<unknown>) {
  if (busy.value)
    return
  busy.value = key
  try {
    await fn()
  }
  finally {
    busy.value = null
  }
}

function handleFullSync() {
  return withBusy('sync', async () => {
    await pl.runFullSync()
    toast.success('Sync cycle complete. See the API activity log for the calls made.')
  })
}

function handleRunFeed(id: string) {
  const runners: Record<string, () => Promise<unknown>> = {
    listings: pl.pushListings,
    availability: pl.pushAvailability,
    reservations: pl.pushReservations,
    prices: pl.pullPrices,
    market_data: pl.pullMarketData,
  }
  const runner = runners[id]
  if (!runner)
    return
  return withBusy(`feed-${id}`, async () => {
    await runner()
    toast.success(`${id.replace('_', ' ')} feed ran.`)
  })
}

function handleReconcileAll() {
  return withBusy('reconcile', async () => {
    const res = await pl.reconcileAll()
    if (res.fields === 0)
      toast.info('Nothing to reconcile.')
    else
      toast.success(`${res.fields} field${res.fields !== 1 ? 's' : ''} written and verified across ${res.units} unit${res.units !== 1 ? 's' : ''}.`)
  })
}

function handleReconcileUnit(unit: PriceLabsUnit) {
  return withBusy(`unit-${unit.providerUnitId}`, async () => {
    const res = await pl.reconcileUnit(unit.providerUnitId)
    if (res.written === 0)
      toast.info('No difference to write.')
    else if (res.verified)
      toast.success(`${res.written} field${res.written !== 1 ? 's' : ''} written and verified by read-back.`)
    else
      toast.error('Write returned 200 but read-back did not match.')
  })
}

function handleProviderEdit() {
  const rows = pl.simulateProviderEdit()
  if (rows.length === 0)
    toast.info('Enable sync on a mapped unit first.')
  else
    toast.warning(`Provider-side edit applied. ${rows.length} field${rows.length !== 1 ? 's' : ''} now differ from Elev8.`)
}

function handleWebhook() {
  return withBusy('webhook', async () => {
    await pl.simulateInboundWebhook()
    toast.success('Inbound webhook received, signature verified, prices re-pulled.')
  })
}

function handleMapUnit(unit: PriceLabsUnit, roomId: string | null) {
  pl.mapUnit(unit.providerUnitId, roomId)
  togglePicker(unit.providerUnitId, false)
  toast.success(roomId ? `Mapped to ${roomName(roomId)}.` : 'Unit unmapped.')
}

function handleSyncToggle(unit: PriceLabsUnit, value: boolean) {
  pl.setSyncEnabled(unit.providerUnitId, value)
  toast.info(value ? `Sync enabled for ${unit.providerName}.` : `Sync paused for ${unit.providerName}.`)
}

function handleAccessChange(cap: PriceLabsCapability, value: unknown) {
  pl.setCapability(cap.key, value as CapabilityAccess)
}

function handleDisconnect() {
  pl.disconnect()
  disconnectDialogOpen.value = false
  toast.info('PriceLabs disconnected. Recorded API answers were kept.')
}

async function copyValue(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value)
    toast.success(`${label} copied.`)
  }
  catch {
    toast.error('Could not copy to clipboard.')
  }
}

function toggleCall(call: ApiCall) {
  expandedCall.value = expandedCall.value === call.id ? null : call.id
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-end justify-between gap-4">
      <div class="space-y-1">
        <h3 class="text-lg font-medium">
          PriceLabs (Revenue Management)
        </h3>
        <p class="text-sm text-muted-foreground">
          Push listings, availability and reservations to PriceLabs, read computed prices and market data back, and keep every pricing setting mastered in Elev8.
        </p>
      </div>
      <Button v-if="isConnected" class="shrink-0 gap-2" :disabled="!!busy" @click="handleFullSync">
        <Icon name="lucide:refresh-cw" class="size-4" :class="busy === 'sync' ? 'animate-spin' : ''" />
        {{ busy === 'sync' ? 'Syncing…' : 'Run sync' }}
      </Button>
    </div>

    <!-- Not connected -->
    <div v-if="!isConnected" class="border border-dashed bg-card/40 p-10 text-center">
      <div class="mx-auto flex max-w-md flex-col items-center gap-4">
        <div class="flex size-12 items-center justify-center rounded-full border bg-background">
          <Icon name="lucide:trending-up" class="size-5 text-muted-foreground" />
        </div>
        <div class="space-y-2">
          <p class="text-base font-medium">
            No PriceLabs account connected
          </p>
          <p class="text-sm text-muted-foreground">
            Paste the API key from your PriceLabs account. Elev8 calls
            <code class="font-mono text-xs">GET {{ PROVISIONAL_API.endpoints.listings }}</code>
            with it and maps whatever listings come back to your rooms.
          </p>
        </div>
        <Button class="gap-2" @click="connectDialogOpen = true">
          <Icon name="lucide:plug" class="size-4" />
          Connect PriceLabs
        </Button>
      </div>
    </div>

    <template v-else>
      <!-- Account -->
      <div class="rounded-lg border bg-card p-4">
        <div class="flex items-start gap-3">
          <div class="flex size-10 shrink-0 items-center justify-center rounded-md border bg-card">
            <Icon name="lucide:trending-up" class="size-5 text-violet-600" />
          </div>
          <div class="min-w-0 flex-1 space-y-1">
            <p class="truncate text-sm font-medium">
              {{ connection?.accountName }}
            </p>
            <p class="font-mono text-xs text-muted-foreground">
              {{ maskedKey }}
            </p>
            <dl class="grid gap-x-4 gap-y-0.5 pt-1 text-[11px] text-muted-foreground sm:grid-cols-2">
              <div class="flex gap-1.5">
                <dt class="shrink-0">
                  Customer API
                </dt>
                <dd class="truncate font-mono">
                  {{ PROVISIONAL_API.customerBaseUrl }}
                </dd>
              </div>
              <div class="flex gap-1.5">
                <dt class="shrink-0">
                  Sync API
                </dt>
                <dd class="truncate font-mono">
                  {{ PROVISIONAL_API.syncBaseUrl }}
                </dd>
              </div>
              <div class="flex gap-1.5">
                <dt class="shrink-0">
                  Last sync
                </dt>
                <dd>{{ formatTime(connection?.lastSyncAt ?? null) }}</dd>
              </div>
              <div class="flex gap-1.5">
                <dt class="shrink-0">
                  Rate limit
                </dt>
                <dd>{{ connection?.rateLimitRemaining }} / {{ PROVISIONAL_API.rateLimitPerMinute }} remaining</dd>
              </div>
            </dl>
            <div class="flex flex-wrap gap-2 pt-2">
              <Button size="sm" variant="outline" class="h-8 gap-1.5" :disabled="!!busy" @click="handleWebhook">
                <Icon v-if="busy === 'webhook'" name="lucide:loader-circle" class="size-3.5 animate-spin" />
                <Icon v-else name="lucide:radio-tower" class="size-3.5" />
                Simulate inbound webhook
              </Button>
              <Button size="sm" variant="outline" class="h-8 gap-1.5" @click="handleProviderEdit">
                <Icon name="lucide:pencil-line" class="size-3.5" />
                Simulate provider edit
              </Button>
              <Button
                size="sm"
                variant="outline"
                class="h-8 gap-1.5 text-destructive hover:text-destructive"
                @click="disconnectDialogOpen = true"
              >
                <Icon name="lucide:unplug" class="size-3.5" />
                Disconnect
              </Button>
            </div>
          </div>
          <span class="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
            <span class="h-1.5 w-1.5 rounded-full bg-green-500" />
            Connected
          </span>
        </div>
      </div>

      <!-- Unit mapping -->
      <div class="space-y-3">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h4 class="text-sm font-medium">
              Unit mapping
            </h4>
            <p class="text-xs text-muted-foreground leading-relaxed">
              One PriceLabs unit maps to exactly one Elev8 Room. Nothing is sent for a unit until sync is enabled on it, so mapping and enabling are separate acts.
            </p>
          </div>
          <Badge v-if="pl.unmappedUnits.value.length > 0" variant="secondary" class="shrink-0">
            {{ pl.unmappedUnits.value.length }} unmapped
          </Badge>
        </div>

        <div v-if="pl.unmappedRooms.value.length > 0" class="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
          <div class="flex items-start gap-2">
            <Icon name="lucide:circle-alert" class="mt-0.5 size-3.5 shrink-0 text-amber-600" />
            <p class="text-xs text-amber-800 leading-relaxed">
              {{ pl.unmappedRooms.value.length }} Elev8 Room{{ pl.unmappedRooms.value.length !== 1 ? 's have' : ' has' }} no PriceLabs unit and will never receive a computed price:
              {{ pl.unmappedRooms.value.map(r => r.name).join(', ') }}.
            </p>
          </div>
        </div>

        <div class="overflow-hidden rounded-lg border bg-card">
          <div class="grid grid-cols-[1fr_240px_78px] gap-2 border-b bg-muted/40 px-3 py-2 text-[11px] font-medium text-muted-foreground">
            <span>PriceLabs unit</span>
            <span>Elev8 Room</span>
            <span class="text-right">Sync</span>
          </div>
          <div class="divide-y">
            <div
              v-for="unit in pl.units.value"
              :key="unit.providerUnitId"
              class="grid grid-cols-[1fr_240px_78px] items-center gap-2 px-3 py-2"
            >
              <div class="min-w-0">
                <div class="flex items-center gap-1.5">
                  <p class="truncate text-xs font-medium">
                    {{ unit.providerName }}
                  </p>
                  <span
                    v-if="driftFor(unit).length > 0"
                    class="shrink-0 rounded border border-amber-500/30 bg-amber-500/10 px-1 py-px text-[10px] font-medium text-amber-700"
                  >
                    {{ driftFor(unit).length }} drift
                  </span>
                </div>
                <p class="font-mono text-[10px] text-muted-foreground">
                  {{ unit.providerUnitId }} · pms={{ unit.pms }}
                </p>
              </div>

              <Popover
                :open="unitPickers[unit.providerUnitId] ?? false"
                @update:open="(v) => togglePicker(unit.providerUnitId, v)"
              >
                <PopoverTrigger as-child>
                  <Button variant="outline" class="h-8 w-full justify-between gap-2 px-2 text-xs font-normal">
                    <span class="truncate" :class="unit.roomId ? '' : 'text-muted-foreground'">
                      {{ roomName(unit.roomId) || 'Unmapped' }}
                    </span>
                    <Icon name="lucide:chevrons-up-down" class="size-3.5 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent class="w-[300px] p-0" align="end" :side-offset="4">
                  <Command>
                    <CommandInput placeholder="Search room..." class="h-8 border-0 focus:ring-0" />
                    <CommandList>
                      <CommandEmpty class="py-3 text-center text-xs text-muted-foreground">
                        No room found.
                      </CommandEmpty>
                      <CommandGroup>
                        <CommandItem value="unmapped" class="gap-2" @select="handleMapUnit(unit, null)">
                          <Icon name="lucide:unlink" class="size-3.5 text-muted-foreground" />
                          <span class="text-xs">Unmapped</span>
                        </CommandItem>
                        <CommandItem
                          v-for="room in availableRooms(unit)"
                          :key="room.id"
                          :value="room.name"
                          class="gap-2"
                          @select="handleMapUnit(unit, room.id)"
                        >
                          <Icon name="lucide:bed-double" class="size-3.5 shrink-0 text-muted-foreground" />
                          <span class="truncate text-xs">{{ room.name }}</span>
                          <Icon v-if="unit.roomId === room.id" name="lucide:check" class="ml-auto size-3.5 shrink-0" />
                        </CommandItem>
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              <div class="flex justify-end">
                <Switch
                  :model-value="unit.syncEnabled"
                  :disabled="!unit.roomId"
                  :aria-label="`Sync ${unit.providerName}`"
                  @update:model-value="(v) => handleSyncToggle(unit, !!v)"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Feeds -->
      <div class="space-y-3">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h4 class="text-sm font-medium">
              Feeds
            </h4>
            <p class="text-xs text-muted-foreground leading-relaxed">
              Each row is one endpoint. Run them individually or use Run sync to execute the whole cycle in order.
            </p>
          </div>
          <Badge v-if="pl.feedsNeedingAttention.value > 0" variant="secondary" class="shrink-0">
            {{ pl.feedsNeedingAttention.value }} need attention
          </Badge>
        </div>

        <div class="overflow-hidden rounded-lg border bg-card">
          <div class="divide-y">
            <div v-for="feed in pl.feeds.value" :key="feed.id" class="flex items-center gap-3 px-3 py-2">
              <span class="size-1.5 shrink-0 rounded-full" :class="feedDotClass[feed.state]" aria-hidden="true" />
              <Icon
                :name="feed.direction === 'outbound' ? 'lucide:upload' : 'lucide:download'"
                class="size-3.5 shrink-0 text-muted-foreground"
              />
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-1.5">
                  <p class="truncate text-xs font-medium">
                    {{ feed.label }}
                  </p>
                  <span class="shrink-0 rounded border bg-muted px-1 py-px font-mono text-[10px] text-muted-foreground">
                    {{ feed.client }}
                  </span>
                </div>
                <p class="truncate font-mono text-[10px] text-muted-foreground">
                  {{ feed.endpoint }}
                </p>
                <p v-if="feed.detail" class="mt-0.5 text-[11px] text-amber-700">
                  {{ feed.detail }}
                </p>
              </div>
              <div class="shrink-0 text-right">
                <p class="text-[11px] font-medium" :class="feedStateClass[feed.state]">
                  {{ feedStateLabels[feed.state] }}
                </p>
                <p class="text-[10px] text-muted-foreground">
                  <span v-if="feed.recordCount > 0">{{ feed.recordCount.toLocaleString('en-US') }} rec · </span>
                  {{ feed.lastRunAt ? clockTime(feed.lastRunAt) : 'never' }}
                </p>
              </div>
              <Button
                v-if="feed.id !== 'settings'"
                size="sm"
                variant="ghost"
                class="h-7 w-16 shrink-0 justify-center text-xs"
                :disabled="!!busy"
                @click="handleRunFeed(feed.id)"
              >
                <Icon v-if="busy === `feed-${feed.id}`" name="lucide:loader-circle" class="size-3.5 animate-spin" />
                <span v-else>Run</span>
              </Button>
              <span v-else class="w-16 shrink-0" />
            </div>
          </div>
        </div>
      </div>

      <!-- Reconcile -->
      <div class="space-y-3">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h4 class="text-sm font-medium">
              Reconcile
            </h4>
            <p class="text-xs text-muted-foreground leading-relaxed">
              Elev8 is master, so a difference is a provider-side divergence to correct. Reconciling writes the Elev8 value, then reads it back and compares. A 200 on the write is not on its own evidence the value took.
            </p>
          </div>
          <Button
            v-if="pl.drift.value.length > 0"
            size="sm"
            variant="outline"
            class="h-8 shrink-0 gap-1.5"
            :disabled="!!busy"
            @click="handleReconcileAll"
          >
            <Icon v-if="busy === 'reconcile'" name="lucide:loader-circle" class="size-3.5 animate-spin" />
            <Icon v-else name="lucide:git-compare-arrows" class="size-3.5" />
            Reconcile all
          </Button>
        </div>

        <div v-if="pl.drift.value.length === 0" class="rounded-lg border bg-card px-3 py-6 text-center">
          <p class="text-xs text-muted-foreground">
            {{ pl.syncingUnits.value.length === 0
              ? 'No unit has sync enabled, so there is nothing to reconcile.'
              : 'Desired state matches the provider on every synced unit.' }}
          </p>
        </div>

        <div v-else class="overflow-hidden rounded-lg border bg-card">
          <div class="divide-y">
            <div v-for="row in pl.drift.value" :key="`${row.providerUnitId}-${row.field}`" class="flex items-center gap-3 px-3 py-2">
              <Icon name="lucide:git-compare-arrows" class="size-4 shrink-0 text-amber-600" />
              <div class="min-w-0 flex-1">
                <p class="truncate text-xs font-medium">
                  {{ roomName(row.roomId) || row.providerUnitId }} · {{ row.label }}
                </p>
                <p class="text-[11px] text-muted-foreground">
                  Elev8 <span class="font-medium text-foreground">{{ row.elev8Value }}</span>
                  · provider <span class="font-medium text-amber-700">{{ row.providerValue }}</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        <div v-if="pl.drift.value.length > 0" class="flex flex-wrap gap-2">
          <Button
            v-for="unit in pl.syncingUnits.value.filter(u => driftFor(u).length > 0)"
            :key="unit.providerUnitId"
            size="sm"
            variant="outline"
            class="h-8 gap-1.5 text-xs"
            :disabled="!!busy"
            @click="handleReconcileUnit(unit)"
          >
            <Icon v-if="busy === `unit-${unit.providerUnitId}`" name="lucide:loader-circle" class="size-3.5 animate-spin" />
            <Icon v-else name="lucide:upload" class="size-3.5" />
            Reconcile {{ roomName(unit.roomId) || unit.providerName }}
          </Button>
        </div>
      </div>

      <!-- API activity -->
      <div class="space-y-3">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h4 class="text-sm font-medium">
              API activity
            </h4>
            <p class="text-xs text-muted-foreground leading-relaxed">
              Every call this integration made, newest first. Expand a row for the request and response body.
            </p>
          </div>
          <div class="flex shrink-0 gap-2">
            <Button size="sm" variant="ghost" class="h-8 gap-1.5 text-xs" @click="logOpen = !logOpen">
              <Icon :name="logOpen ? 'lucide:chevron-up' : 'lucide:chevron-down'" class="size-3.5" />
              {{ logOpen ? 'Hide' : 'Show' }}
            </Button>
            <Button v-if="pl.calls.value.length > 0" size="sm" variant="ghost" class="h-8 gap-1.5 text-xs" @click="pl.clearCalls()">
              <Icon name="lucide:eraser" class="size-3.5" />
              Clear
            </Button>
          </div>
        </div>

        <div v-if="logOpen" class="overflow-hidden rounded-lg border bg-card">
          <p v-if="pl.calls.value.length === 0" class="px-3 py-6 text-center text-xs text-muted-foreground">
            No calls yet.
          </p>
          <div v-else class="divide-y">
            <div v-for="call in pl.calls.value" :key="call.id">
              <button
                type="button"
                class="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-muted/40"
                @click="toggleCall(call)"
              >
                <span class="w-10 shrink-0 rounded border px-1 py-px text-center font-mono text-[10px] font-medium" :class="methodClass(call.method)">
                  {{ call.method }}
                </span>
                <span class="w-9 shrink-0 rounded border px-1 py-px text-center font-mono text-[10px] font-medium" :class="statusClass(call.status)">
                  {{ call.status }}
                </span>
                <code class="min-w-0 flex-1 truncate font-mono text-[11px]">{{ call.path }}</code>
                <span class="shrink-0 rounded border bg-muted px-1 py-px font-mono text-[10px] text-muted-foreground">
                  {{ call.client }}
                </span>
                <span class="w-12 shrink-0 text-right text-[10px] text-muted-foreground">{{ call.durationMs }}ms</span>
                <span class="w-16 shrink-0 text-right text-[10px] text-muted-foreground">{{ clockTime(call.at) }}</span>
                <Icon
                  :name="expandedCall === call.id ? 'lucide:chevron-up' : 'lucide:chevron-down'"
                  class="size-3.5 shrink-0 text-muted-foreground"
                />
              </button>
              <div v-if="expandedCall === call.id" class="space-y-2 border-t bg-muted/20 px-3 py-2">
                <div class="text-[10px] text-muted-foreground">
                  <span class="font-medium">{{ call.method }}</span>
                  {{ pl.baseUrlFor(call.client) }}{{ call.path }}
                  <span v-if="call.rateLimitRemaining !== null"> · X-RateLimit-Remaining: {{ call.rateLimitRemaining }}</span>
                </div>
                <div v-if="call.requestBody">
                  <p class="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Request
                  </p>
                  <pre class="max-h-40 overflow-auto rounded border bg-background p-2 font-mono text-[10px] leading-relaxed">{{ pretty(call.requestBody) }}</pre>
                </div>
                <div>
                  <p class="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Response
                  </p>
                  <pre class="max-h-40 overflow-auto rounded border bg-background p-2 font-mono text-[10px] leading-relaxed">{{ pretty(call.responseBody) }}</pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Writable settings -->
      <div class="space-y-3">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h4 class="text-sm font-medium">
              Writable settings
            </h4>
            <p class="text-xs text-muted-foreground leading-relaxed">
              Which settings the Customer API accepts. The four confirmed below were discovered from the listings response. The rest stay unverified until the PriceLabs API reference confirms them, because the answer decides what the provider enforces and what Elev8 has to enforce locally.
            </p>
          </div>
          <Badge v-if="pl.unverifiedCapabilityCount.value > 0" variant="secondary" class="shrink-0">
            {{ pl.unverifiedCapabilityCount.value }} unverified
          </Badge>
        </div>

        <div class="overflow-hidden rounded-lg border bg-card">
          <div class="grid grid-cols-[1fr_150px_130px] gap-2 border-b bg-muted/40 px-3 py-2 text-[11px] font-medium text-muted-foreground">
            <span>Setting</span>
            <span>API access</span>
            <span>Evidence</span>
          </div>
          <div class="divide-y">
            <div
              v-for="cap in pl.capabilities.value"
              :key="cap.key"
              class="grid grid-cols-[1fr_150px_130px] items-center gap-2 px-3 py-2"
            >
              <div class="min-w-0">
                <p class="truncate text-xs">
                  {{ cap.label }}
                </p>
                <p v-if="cap.note" class="truncate font-mono text-[10px] text-muted-foreground">
                  {{ cap.note }}
                </p>
              </div>
              <Select :model-value="cap.access" @update:model-value="(v) => handleAccessChange(cap, v)">
                <SelectTrigger class="h-8 text-xs">
                  <SelectValue placeholder="Unverified" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="opt in accessOptions" :key="opt.value" :value="opt.value" class="text-xs">
                    {{ opt.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
              <span
                class="inline-flex items-center justify-center rounded-md border px-2 py-1 text-[11px] font-medium"
                :class="accessClass[cap.access]"
              >
                {{ cap.source === 'discovered' ? 'From response' : cap.source === 'documented' ? 'Documented' : 'Unverified' }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Webhook -->
      <div class="space-y-3">
        <div>
          <h4 class="text-sm font-medium">
            Webhook endpoint
          </h4>
          <p class="text-xs text-muted-foreground">
            Register this URL in PriceLabs. Inbound payloads are HMAC-verified against the signing secret before anything is applied.
          </p>
        </div>
        <div class="space-y-2">
          <div
            v-for="row in [
              { label: 'Webhook URL', value: connection?.webhookUrl ?? '' },
              { label: 'Signing secret', value: connection?.hmacSecret ?? '' },
            ]"
            :key="row.label"
            class="flex items-center gap-2 rounded-lg border bg-muted/20 p-2"
          >
            <span class="w-[110px] shrink-0 text-[11px] font-medium text-muted-foreground">{{ row.label }}</span>
            <code class="min-w-0 flex-1 truncate font-mono text-[11px]">{{ row.value }}</code>
            <Button size="sm" variant="ghost" class="h-7 shrink-0 gap-1.5 text-xs" @click="copyValue(row.value, row.label)">
              <Icon name="lucide:copy" class="size-3.5" />
              Copy
            </Button>
          </div>
        </div>
      </div>

      <div class="rounded-lg border bg-muted/20 p-3">
        <p class="text-[11px] text-muted-foreground leading-relaxed">
          <Icon name="lucide:info" class="mr-1 inline size-3" />
          Prototype. Requests are simulated in the browser and the API key is never transmitted. Endpoint paths, the auth header name and the rate limit are provisional and live in one map in
          <code class="font-mono">usePriceLabs.ts</code>, to be verified against the PriceLabs API reference before any of it is built for real.
        </p>
      </div>
    </template>

    <!-- Connect -->
    <Dialog v-model:open="connectDialogOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect PriceLabs</DialogTitle>
          <DialogDescription>
            Find the key in PriceLabs under Account, then API. Elev8 validates it by listing your properties.
          </DialogDescription>
        </DialogHeader>
        <div class="space-y-3">
          <div class="space-y-1.5">
            <Label for="pl-account" class="text-xs">Account name</Label>
            <Input id="pl-account" v-model="accountName" placeholder="Elev8 Bali portfolio" class="h-9 text-sm" />
          </div>
          <div class="space-y-1.5">
            <Label for="pl-key" class="text-xs">API key</Label>
            <Input id="pl-key" v-model="apiKey" type="password" placeholder="pl_..." class="h-9 font-mono text-sm" />
          </div>
          <div class="rounded-lg border bg-muted/20 p-3">
            <p class="mb-1.5 text-[11px] font-medium text-foreground">
              On save, Elev8 sends:
            </p>
            <pre class="overflow-x-auto font-mono text-[10px] leading-relaxed text-muted-foreground">GET {{ PROVISIONAL_API.customerBaseUrl }}{{ PROVISIONAL_API.endpoints.listings }}
            {{ PROVISIONAL_API.authHeader }}: ••••••••</pre>
            <p class="mt-1.5 text-[10px] text-muted-foreground">
              A key that cannot list properties is not a connected key, so the response is the validation.
            </p>
          </div>
          <div v-if="connectError" class="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <div class="flex items-start gap-2">
              <Icon name="lucide:alert-circle" class="mt-0.5 size-4 shrink-0" />
              <span>{{ connectError }}</span>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" type="button" :disabled="isConnecting" @click="connectDialogOpen = false">
            Cancel
          </Button>
          <Button class="gap-2" :disabled="isConnecting" @click="handleConnect">
            <Icon v-if="isConnecting" name="lucide:loader-circle" class="size-4 animate-spin" />
            {{ isConnecting ? 'Validating…' : 'Connect' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Disconnect -->
    <Dialog v-model:open="disconnectDialogOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Disconnect PriceLabs?</DialogTitle>
          <DialogDescription>
            Feeds stop, unit mappings are dropped and the call log is cleared. Recorded answers about which settings the API accepts are kept, because they describe the API rather than this connection.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="disconnectDialogOpen = false">
            Cancel
          </Button>
          <Button variant="destructive" @click="handleDisconnect">
            Disconnect
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
