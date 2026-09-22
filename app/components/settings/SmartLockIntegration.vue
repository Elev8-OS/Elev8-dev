<script setup lang="ts">
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'

const smartLock = useSmartLock()

const connectDialogOpen = ref(false)
const disconnectDialogOpen = ref(false)
const apiKeyInput = ref('')
const workspaceInput = ref('')
const isConnecting = ref(false)
const connectError = ref('')
const isSyncing = ref(false)

const connection = computed(() => smartLock.connection.value)
const isConnected = computed(() => smartLock.isConnected.value)
const lockCount = computed(() => smartLock.locks.value.length)
const pairedDeviceCount = computed(() => smartLock.allDevices.value.filter(d => d.paired).length)

function resetConnect() {
  apiKeyInput.value = ''
  workspaceInput.value = ''
  connectError.value = ''
  isConnecting.value = false
}

async function handleConnect() {
  if (isConnecting.value) return
  if (!apiKeyInput.value.trim()) {
    connectError.value = 'API key is required.'
    return
  }
  isConnecting.value = true
  connectError.value = ''
  try {
    const result = await smartLock.validateAndConnect(apiKeyInput.value, workspaceInput.value)
    if (!result.success) {
      connectError.value = result.error ?? 'Failed to connect to Seam.'
      isConnecting.value = false
      return
    }
    toast.success('Connected to Seam.')
    connectDialogOpen.value = false
    resetConnect()
    isConnecting.value = false
  }
  catch (e: any) {
    connectError.value = e?.message ?? 'Failed to connect to Seam.'
    isConnecting.value = false
  }
}

function handleDisconnect() {
  smartLock.disconnect()
  toast.info('Seam disconnected. All paired smart locks and access codes have been removed.')
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
  smartLock.syncDevices()
  smartLock.emitMockAlerts()
  isSyncing.value = false
  toast.success(`Synced ${smartLock.allDevices.value.length} devices from Seam.`)
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-end justify-between gap-4">
      <div class="space-y-1">
        <h3 class="text-lg font-medium">Smart Lock (Seam)</h3>
        <p class="text-sm text-muted-foreground">
          Connect Seam to control smart locks across all your properties — auto-generate guest access codes, monitor battery &amp; connectivity, and share codes via Inbox.
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
          <Icon name="lucide:key-round" class="size-5 text-muted-foreground" />
        </div>
        <div class="space-y-2">
          <p class="text-base font-medium">No Seam account connected</p>
          <p class="text-sm text-muted-foreground">
            Paste a Seam API key to start pairing smart locks. Get one from
            <span class="font-mono text-xs">console.seam.co</span> → Settings → API Keys.
          </p>
        </div>
        <Button class="gap-2" @click="connectDialogOpen = true">
          <Icon name="lucide:plug" class="size-4" />
          Connect to Seam
        </Button>
      </div>
    </div>

    <!-- Connected state -->
    <div v-else class="space-y-4">
      <div class="rounded-lg border bg-card p-4">
        <div class="flex items-start gap-3">
          <div class="flex size-10 shrink-0 items-center justify-center rounded-md border bg-card">
            <Icon name="lucide:key-round" class="size-5 text-green-600" />
          </div>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium">{{ connection?.workspaceName }}</p>
            <p class="text-xs text-muted-foreground">
              {{ pairedDeviceCount }} of {{ connection?.deviceCount }} devices paired
              · {{ lockCount }} lock{{ lockCount !== 1 ? 's' : '' }} assigned
            </p>
            <p v-if="connection?.lastSyncAt" class="mt-1 text-[11px] text-muted-foreground/60">
              Last synced {{ new Date(connection.lastSyncAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', hour12: false }) }}
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
          Paste this URL in your Seam dashboard → Webhooks so Elev8 receives device events.
        </p>
      </div>

      <!-- Available devices preview -->
      <div class="rounded-lg border bg-card overflow-hidden">
        <div class="border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
          Devices from Seam ({{ pairedDeviceCount }} paired, {{ smartLock.availableDevices.value.length }} available)
        </div>
        <div class="divide-y">
          <div
            v-for="device in smartLock.allDevices.value"
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
                {{ device.model }} · {{ device.provider }}
              </p>
            </div>
            <span
              class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
              :class="device.paired ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'"
            >
              {{ device.paired ? 'Paired' : 'Available' }}
            </span>
          </div>
        </div>
      </div>

      <p class="text-xs text-muted-foreground">
        <Icon name="lucide:info" class="mr-1 inline size-3" />
        Pair locks to specific properties or rooms from the listing details page (Settings tab).
      </p>
    </div>

    <!-- Connect dialog -->
    <Dialog v-model:open="connectDialogOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect Seam</DialogTitle>
          <DialogDescription>
            Enter your Seam API key. Find one at
            <span class="font-mono text-xs">console.seam.co</span> → Settings → API Keys.
          </DialogDescription>
        </DialogHeader>
        <form class="space-y-4" @submit.prevent="handleConnect">
          <div class="space-y-2">
            <Label for="seam-apikey">API Key</Label>
            <Input
              id="seam-apikey"
              v-model="apiKeyInput"
              type="password"
              placeholder="seam_xxx..."
              class="w-full font-mono text-sm"
              :disabled="isConnecting"
            />
            <p class="text-[11px] text-muted-foreground">Stored securely and used only to call the Seam API on your behalf.</p>
          </div>
          <div class="space-y-2">
            <Label for="seam-workspace">Workspace Name (optional)</Label>
            <Input
              id="seam-workspace"
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
          <DialogTitle>Disconnect Seam?</DialogTitle>
          <DialogDescription>
            New webhook events will stop. All paired smart locks and active access codes will be removed. Existing reservations are unaffected.
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
