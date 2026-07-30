<script setup lang="ts">
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'

const minut = useMinut()

const connectDialogOpen = ref(false)
const disconnectDialogOpen = ref(false)
const apiKeyInput = ref('')
const workspaceInput = ref('')
const isConnecting = ref(false)
const connectError = ref('')
const isSyncing = ref(false)

const connection = computed(() => minut.connection.value)
const isConnected = computed(() => minut.isConnected.value)
const deviceCount = computed(() => minut.devices.value.length)

function resetConnect() {
  apiKeyInput.value = ''
  workspaceInput.value = ''
  connectError.value = ''
  isConnecting.value = false
}

async function handleConnect() {
  if (isConnecting.value) return
  isConnecting.value = true
  connectError.value = ''
  try {
    const result = await minut.validateAndConnect(apiKeyInput.value, workspaceInput.value)
    if (!result.success) {
      connectError.value = result.error ?? 'Failed to connect to Minut.'
      isConnecting.value = false
      return
    }
    toast.success('Connected to Minut.')
    connectDialogOpen.value = false
    resetConnect()
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

function copyWebhookUrl() {
  if (!connection.value) return
  navigator.clipboard.writeText(connection.value.webhookUrl)
  toast.success('Webhook URL copied.')
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
            Paste a Minut API key to start receiving device events. Get one from
            <span class="font-mono text-xs">console.minut.com</span> → Settings → API Keys.
          </p>
        </div>
        <Button class="gap-2" @click="connectDialogOpen = true">
          <Icon name="lucide:plug" class="size-4" />
          Connect to Minut
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
              {{ deviceCount }} device{{ deviceCount !== 1 ? 's' : '' }} in workspace
            </p>
            <p v-if="connection?.lastSyncAt" class="mt-1 text-[11px] text-muted-foreground/60">
              Last synced {{ new Date(connection.lastSyncAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) }}
            </p>
            <div class="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" class="h-8 gap-1.5" @click="copyWebhookUrl">
                <Icon name="lucide:copy" class="size-3.5" />
                Copy webhook URL
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

      <!-- Webhook URL details -->
      <div class="rounded-lg border bg-muted/30 p-3">
        <div class="flex items-center gap-2 text-xs">
          <Icon name="lucide:webhook" class="size-3.5 text-muted-foreground" />
          <span class="text-muted-foreground">Webhook URL</span>
        </div>
        <p class="mt-1 font-mono text-xs break-all">{{ connection?.webhookUrl }}</p>
        <p class="mt-1 text-[10px] text-muted-foreground/60">
          Paste this URL in your Minut dashboard → Webhooks so Elev8 receives device events.
        </p>
      </div>

      <!-- Devices table -->
      <div class="rounded-lg border bg-card overflow-hidden">
        <div class="border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
          Devices ({{ deviceCount }})
        </div>
        <div class="divide-y">
          <div
            v-for="device in minut.devices.value"
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
                {{ device.model }} · {{ device.listingName }} · {{ device.sensors.join(', ') }}
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
          </div>
        </div>
      </div>

      <p class="text-xs text-muted-foreground">
        <Icon name="lucide:info" class="mr-1 inline size-3" />
        Use the trigger picker in any Journey to react to Minut sensor events.
      </p>
    </div>

    <!-- Connect dialog -->
    <Dialog v-model:open="connectDialogOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect Minut</DialogTitle>
          <DialogDescription>
            Enter your Minut API key. Find one at
            <span class="font-mono text-xs">console.minut.com</span> → Settings → API Keys.
          </DialogDescription>
        </DialogHeader>
        <form class="space-y-4" @submit.prevent="handleConnect">
          <div class="space-y-2">
            <Label for="minut-apikey">API Key</Label>
            <Input
              id="minut-apikey"
              v-model="apiKeyInput"
              type="password"
              placeholder="mn_xxx..."
              class="w-full font-mono text-sm"
              :disabled="isConnecting"
            />
            <p class="text-[11px] text-muted-foreground">Stored securely and used only to call the Minut API on your behalf.</p>
          </div>
          <div class="space-y-2">
            <Label for="minut-workspace">Workspace Name (optional)</Label>
            <Input
              id="minut-workspace"
              v-model="workspaceInput"
              placeholder="My Elev8 Workspace"
              class="w-full text-sm"
              :disabled="isConnecting"
            />
          </div>
          <div v-if="connectError" class="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <div class="flex items-start gap-2">
              <Icon name="lucide:alert-circle" class="mt-0.5 size-4 shrink-0" />
              <span>{{ connectError }}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" :disabled="isConnecting" @click="connectDialogOpen = false; resetConnect()">
              Cancel
            </Button>
            <Button type="submit" :disabled="isConnecting" class="gap-2">
              <Icon v-if="isConnecting" name="lucide:loader-circle" class="size-4 animate-spin" />
              {{ isConnecting ? 'Connecting…' : 'Connect' }}
            </Button>
          </DialogFooter>
        </form>
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
