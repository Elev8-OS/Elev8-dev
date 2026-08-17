<script setup lang="ts">
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import type { MinutDevice } from '~/composables/useMinut'

const minut = useMinut()

const connectDialogOpen = ref(false)
const disconnectDialogOpen = ref(false)
const isConnecting = ref(false)
const connectError = ref('')
const isSyncing = ref(false)

const mappingSearch = ref('')
const mappingListingFilter = ref('all')
const mappedOnly = ref(false)

const connection = computed(() => minut.connection.value)
const isConnected = computed(() => minut.isConnected.value)
const deviceCount = computed(() => minut.devices.value.length)

const userListings = computed(() => minut.userListings.value)

const filteredDevices = computed<MinutDevice[]>(() => {
  let list = minut.devices.value
  if (mappingListingFilter.value !== 'all') {
    list = list.filter(d => d.listingId === mappingListingFilter.value)
  }
  if (mappedOnly.value) {
    list = list.filter(d => !!d.listingId)
  }
  const q = mappingSearch.value.trim().toLowerCase()
  if (q) {
    list = list.filter(d => {
      const listing = userListings.value.find(l => l.id === d.listingId)
      return `${d.name} ${d.model} ${d.deviceId} ${listing?.name ?? ''}`.toLowerCase().includes(q)
    })
  }
  return list
})

const unassignedCount = computed(() => minut.unassignedDevices.value.length)

function listingNameFor(device: MinutDevice): string {
  return userListings.value.find(l => l.id === device.listingId)?.name ?? ''
}

async function handleConnect() {
  if (isConnecting.value) return
  isConnecting.value = true
  connectError.value = ''
  try {
    const result = await minut.completeOAuth()
    if (!result.success) {
      connectError.value = result.error ?? 'Failed to connect to Minut.'
      isConnecting.value = false
      return
    }
    toast.success('Connected to Minut.')
    connectDialogOpen.value = false
    isConnecting.value = false
  }
  catch (e: unknown) {
    connectError.value = e instanceof Error ? e.message : 'Failed to connect to Minut.'
    isConnecting.value = false
  }
}

function handleDisconnect() {
  minut.disconnect()
  toast.info('Minut disconnected. Paired devices and event history have been preserved.')
  disconnectDialogOpen.value = false
}

const isPinging = ref(false)

async function handlePing() {
  if (isPinging.value) return
  isPinging.value = true
  const event = await minut.testWebhook()
  isPinging.value = false
  if (event) {
    toast.success(`Webhook delivered test event: ${event.type}`)
  }
  else {
    toast.info('No devices available to send a test event.')
  }
}

async function handleSync() {
  if (isSyncing.value) return
  isSyncing.value = true
  await new Promise(r => setTimeout(r, 800))
  minut.syncDevices()
  const events = minut.emitMockEvents()
  isSyncing.value = false
  toast.success(`Synced ${deviceCount.value} Minut devices. ${events.length} event${events.length !== 1 ? 's' : ''} generated.`)
}

function assignDevice(deviceId: string, listingId: string) {
  minut.assignDeviceToListing(deviceId, listingId === 'unassigned' ? null : listingId)
  toast.success('Device mapping saved.')
}

function clearDeviceMapping(deviceId: string) {
  minut.assignDeviceToListing(deviceId, null)
  toast.info('Device unmapped from listing.')
}

function setListingFilter(value: unknown) {
  mappingListingFilter.value = value ? String(value) : 'all'
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-end justify-between gap-4">
      <div class="space-y-1">
        <h3 class="text-lg font-medium">Minut (Noise & Sensor Monitoring)</h3>
        <p class="text-sm text-muted-foreground">
          Connect Minut to receive noise, smoke, motion, and sensor events from your workspace devices — and trigger Journeys on them.
        </p>
      </div>
      <Button v-if="isConnected" class="gap-2" :disabled="isSyncing" @click="handleSync">
        <Icon name="lucide:refresh-cw" class="size-4" :class="isSyncing ? 'animate-spin' : ''" />
        {{ isSyncing ? 'Syncing…' : 'Sync Devices' }}
      </Button>
    </div>

    <!-- Empty / disconnected state -->
    <div v-if="!isConnected" class="border border-dashed bg-card/40 p-10 text-center">
      <div class="mx-auto flex max-w-md flex-col items-center gap-4">
        <div class="flex size-12 items-center justify-center rounded-full border bg-background">
          <Icon name="lucide:audio-waveform" class="size-5 text-muted-foreground" />
        </div>
        <div class="space-y-2">
          <p class="text-base font-medium">No Minut workspace connected</p>
          <p class="text-sm text-muted-foreground">
            Sign in with your Minut account to automatically pull your devices and pair them to your listings.
          </p>
        </div>
        <Button class="gap-2" @click="connectDialogOpen = true">
          <Icon name="lucide:log-in" class="size-4" />
          Connect with Minut
        </Button>
      </div>
    </div>

    <!-- Connected state -->
    <div v-else class="space-y-4">
      <div class="rounded-lg border bg-card p-4">
        <div class="flex items-start gap-3">
          <div class="flex size-10 shrink-0 items-center justify-center rounded-md border bg-card">
            <Icon name="lucide:audio-waveform" class="size-5 text-sky-600" />
          </div>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium">{{ connection?.workspaceName }}</p>
            <p class="text-xs text-muted-foreground">
              {{ deviceCount }} device{{ deviceCount !== 1 ? 's' : '' }} in workspace · {{ minut.assignedDeviceCount.value }} mapped
            </p>
            <p v-if="connection?.lastSyncAt" class="mt-1 text-[11px] text-muted-foreground/60">
              Last synced {{ new Date(connection.lastSyncAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) }}
            </p>
            <div class="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" class="h-8 gap-1.5" :disabled="isPinging" @click="handlePing">
                <Icon v-if="isPinging" name="lucide:loader-circle" class="size-3.5 animate-spin" />
                <Icon v-else name="lucide:radio-tower" class="size-3.5" />
                {{ isPinging ? 'Pinging…' : 'Test ping' }}
              </Button>
              <Button size="sm" variant="outline" class="h-8 gap-1.5 text-destructive hover:text-destructive" @click="disconnectDialogOpen = true">
                <Icon name="lucide:unplug" class="size-3.5" />
                Disconnect
              </Button>
            </div>
          </div>
          <span class="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium bg-green-50 text-green-700">
            <span class="h-1.5 w-1.5 rounded-full bg-green-500" />
            Connected
          </span>
        </div>
      </div>

      <!-- Device mapping -->
      <div class="space-y-3">
        <div class="flex items-center justify-between gap-3">
          <div>
            <h4 class="text-sm font-medium">Device Mapping</h4>
            <p class="text-xs text-muted-foreground">
              Map each device to one of your listings so events and Journey triggers are scoped to the right property.
            </p>
          </div>
          <Badge v-if="unassignedCount > 0" variant="secondary" class="shrink-0">
            {{ unassignedCount }} unassigned
          </Badge>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <div class="relative min-w-[220px] flex-1">
            <Icon name="lucide:search" class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input v-model="mappingSearch" placeholder="Search device or listing..." class="h-9 pl-9 text-xs" />
          </div>
          <Select :model-value="mappingListingFilter" @update:model-value="(v) => setListingFilter(v)">
            <SelectTrigger class="h-9 w-[200px]">
              <SelectValue placeholder="All listings" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All listings</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              <SelectItem v-for="listing in userListings" :key="listing.id" :value="listing.id">
                {{ listing.name }}
              </SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            class="h-9 gap-1.5"
            :class="mappedOnly ? 'border-primary text-primary' : ''"
            @click="mappedOnly = !mappedOnly"
          >
            <Icon name="lucide:check-check" class="size-3.5" />
            Mapped only
          </Button>
        </div>

        <div class="rounded-lg border bg-card overflow-hidden">
          <div class="border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
            Devices ({{ filteredDevices.length }})
          </div>
          <div class="divide-y">
            <div
              v-for="device in filteredDevices"
              :key="device.deviceId"
              class="flex items-center gap-3 px-3 py-2 text-sm"
            >
              <Icon
                :name="device.online ? 'lucide:wifi' : 'lucide:wifi-off'"
                class="size-4 shrink-0"
                :class="device.online ? 'text-green-600' : 'text-muted-foreground'"
              />
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium">{{ device.name }}</p>
                <p class="text-[11px] text-muted-foreground">
                  {{ device.model }} · {{ device.sensors.join(', ') }}
                </p>
              </div>
              <div class="text-right text-[11px] text-muted-foreground">
                <p :class="device.batteryLevel <= 20 ? 'text-amber-600' : ''">
                  🔋 {{ device.batteryLevel }}%
                </p>
                <p v-if="device.lastEventAt" class="text-[10px] text-muted-foreground/60">
                  {{ new Date(device.lastEventAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) }}
                </p>
              </div>
              <div class="flex w-[240px] shrink-0 items-center gap-1.5">
                <div class="min-w-0 flex-1">
                  <Select :model-value="device.listingId ?? 'unassigned'" @update:model-value="(v) => assignDevice(device.deviceId, String(v))">
                    <SelectTrigger class="h-8 w-full text-xs">
                      <SelectValue :placeholder="listingNameFor(device) || 'Unassigned'" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      <SelectItem v-for="listing in userListings" :key="listing.id" :value="listing.id">
                        {{ listing.name }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  v-if="device.listingId"
                  variant="ghost"
                  size="sm"
                  class="h-8 size-8 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                  title="Unmap device"
                  @click="clearDeviceMapping(device.deviceId)"
                >
                  <Icon name="lucide:x" class="size-3.5" />
                </Button>
              </div>
            </div>
            <p v-if="filteredDevices.length === 0" class="px-3 py-6 text-center text-xs text-muted-foreground">
              No devices match the current filters.
            </p>
          </div>
        </div>
      </div>

      <p class="text-xs text-muted-foreground">
        <Icon name="lucide:info" class="mr-1 inline size-3" />
        Use the trigger picker in any Journey to react to Minut sensor events.
      </p>
    </div>

    <!-- Connect dialog (OAuth) -->
    <Dialog v-model:open="connectDialogOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect Minut</DialogTitle>
          <DialogDescription>
            Sign in with Minut to authorize Elev8 to read your workspace devices and receive sensor events.
          </DialogDescription>
        </DialogHeader>
        <div class="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground">
          <p class="mb-1 font-medium text-foreground">What happens next:</p>
          <ol class="list-inside list-decimal space-y-1">
            <li>You authorize Elev8 to access your Minut workspace</li>
            <li>We import your devices and show them here</li>
            <li>You map each device to a listing to start receiving events</li>
          </ol>
        </div>
        <div v-if="connectError" class="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <div class="flex items-start gap-2">
            <Icon name="lucide:alert-circle" class="mt-0.5 size-4 shrink-0" />
            <span>{{ connectError }}</span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" type="button" :disabled="isConnecting" @click="connectDialogOpen = false">
            Cancel
          </Button>
          <Button :disabled="isConnecting" class="gap-2" @click="handleConnect">
            <Icon v-if="isConnecting" name="lucide:loader-circle" class="size-4 animate-spin" />
            {{ isConnecting ? 'Connecting…' : 'Authorize with Minut' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Disconnect dialog -->
    <Dialog v-model:open="disconnectDialogOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Disconnect Minut?</DialogTitle>
          <DialogDescription>
            New webhook events will stop. Paired devices and event history will be preserved for the next time you connect, but won't sync until Minut is reconnected.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="disconnectDialogOpen = false">Cancel</Button>
          <Button variant="destructive" @click="handleDisconnect">Disconnect</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
