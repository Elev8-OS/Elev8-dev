<script setup lang="ts">
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import { staffMembers as staffData } from '~/components/inbox/data/conversations'

const threeCX = useThreeCX()

const connectDialogOpen = ref(false)
const disconnectDialogOpen = ref(false)
const fqdnInput = ref('')
const isConnecting = ref(false)
const connectError = ref('')
const mappingSearch = ref('')

const activeAccount = computed(() => threeCX.activeAccount.value)
const isConnected = computed(() => threeCX.isConnected.value)

const extensionByStaffId = computed(() => {
  const map: Record<string, string> = {}
  for (const m of activeAccount.value?.extensionMappings ?? []) {
    map[m.staffId] = m.extensionNumber
  }
  return map
})

const filteredStaff = computed(() => {
  const q = mappingSearch.value.trim().toLowerCase()
  if (!q)
    return staffData
  return staffData.filter(s =>
    s.name.toLowerCase().includes(q)
    || s.role.toLowerCase().includes(q)
    || (extensionByStaffId.value[s.id] ?? '').includes(q),
  )
})

function resetConnect() {
  fqdnInput.value = ''
  connectError.value = ''
  isConnecting.value = false
}

async function handleConnect() {
  if (isConnecting.value)
    return
  const fqdn = fqdnInput.value.trim()
  if (!fqdn) {
    connectError.value = 'PBX FQDN is required.'
    return
  }
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(fqdn)) {
    connectError.value = 'Enter a valid FQDN (e.g. elevate.3cx.asia).'
    return
  }

  isConnecting.value = true
  connectError.value = ''

  try {
    const result = await threeCX.completeOAuthCallback(`mock-code-${Date.now()}`, fqdn)
    if (!result.success) {
      connectError.value = result.error
      isConnecting.value = false
      return
    }
    toast.success(`Connected to ${fqdn}.`)
    connectDialogOpen.value = false
    resetConnect()
    isConnecting.value = false
  }
  catch (e: any) {
    connectError.value = e?.message ?? 'Failed to connect 3CX.'
    isConnecting.value = false
  }
}

function handleDisconnect() {
  threeCX.disconnect()
  toast.info('3CX account disconnected. Existing call history preserved.')
  disconnectDialogOpen.value = false
}

function copyWebhookUrl() {
  if (!activeAccount.value)
    return
  navigator.clipboard.writeText(`https://api.elev8suite.com/webhooks/3cx/${activeAccount.value.id}`)
  toast.success('Webhook URL copied.')
}

function assignExtensionLocal(staffId: string, value: string) {
  if (!value.trim()) {
    threeCX.unassignExtension(staffId)
    return
  }
  threeCX.assignExtension(staffId, value.trim())
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-end justify-between gap-4">
      <div class="space-y-1">
        <h3 class="text-lg font-medium">3CX Telephony</h3>
        <p class="text-sm text-muted-foreground">Connect a self-managed 3CX PBX to log calls, screen-pop matched guests, and enable click-to-call from the Inbox.</p>
      </div>
      <Button v-if="isConnected" class="gap-2" @click="connectDialogOpen = true">
        <Icon name="lucide:refresh-cw" class="size-4" />
        Reconnect
      </Button>
    </div>

    <!-- Empty / disconnected state -->
    <div v-if="!isConnected" class="border border-dashed bg-card/40 p-10 text-center">
      <div class="mx-auto flex max-w-md flex-col items-center gap-4">
        <div class="flex size-12 items-center justify-center rounded-full border bg-background">
          <Icon name="lucide:phone" class="size-5 text-muted-foreground" />
        </div>
        <div class="space-y-2">
          <p class="text-base font-medium">No 3CX account connected</p>
          <p class="text-sm text-muted-foreground">Sign in with your 3CX admin to start ingesting call events. Webhook events for ringing, answered, ended, missed, and voicemail will be pushed to Elev8.</p>
        </div>
        <Button class="gap-2" @click="connectDialogOpen = true">
          <Icon name="lucide:log-in" class="size-4" />
          Connect with 3CX
        </Button>
      </div>
    </div>

    <!-- Connected state -->
    <div v-else class="space-y-6">
      <div class="rounded-lg border bg-card p-4">
        <div class="flex items-start gap-3">
          <div class="flex size-10 shrink-0 items-center justify-center rounded-md border bg-card">
            <Icon name="lucide:phone" class="size-5 text-green-600" />
          </div>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium">{{ activeAccount?.displayName }}</p>
            <p class="text-xs text-muted-foreground">FQDN: {{ activeAccount?.fqdn }} · PBX {{ activeAccount?.pbxVersion }}</p>
            <p class="mt-1 text-[11px] text-muted-foreground/60">
              Connected {{ new Date(activeAccount?.connectedAt ?? '').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) }}
              · {{ activeAccount?.extensionMappings.length }} extension{{ activeAccount?.extensionMappings.length !== 1 ? 's' : 's' }} mapped
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

      <!-- Extension mapping -->
      <div class="space-y-3">
        <div class="flex items-center justify-between gap-3">
          <div>
            <h4 class="text-sm font-medium">Extension Mapping</h4>
            <p class="text-xs text-muted-foreground">Map each staff member to their 3CX extension. Screen-pops route to the assigned staff.</p>
          </div>
          <Input v-model="mappingSearch" placeholder="Search staff..." class="h-8 w-56 text-xs" />
        </div>

        <div class="rounded-lg border bg-card overflow-hidden">
          <table class="w-full text-sm">
            <thead class="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th class="text-left font-medium px-3 py-2">Staff member</th>
                <th class="text-left font-medium px-3 py-2">Role</th>
                <th class="text-left font-medium px-3 py-2">3CX Extension</th>
                <th class="text-right font-medium px-3 py-2 w-24" />
              </tr>
            </thead>
            <tbody>
              <tr v-for="staff in filteredStaff" :key="staff.id" class="border-t">
                <td class="px-3 py-2">
                  <div class="flex items-center gap-2">
                    <div class="flex size-7 items-center justify-center rounded-full bg-primary/10 text-[10px] font-medium text-primary">{{ staff.initials }}</div>
                    <span class="font-medium">{{ staff.name }}</span>
                  </div>
                </td>
                <td class="px-3 py-2 text-xs text-muted-foreground">{{ staff.role }}</td>
                <td class="px-3 py-2">
                  <Input
                    :model-value="extensionByStaffId[staff.id] ?? ''"
                    placeholder="e.g. 1102"
                    class="h-8 w-32 font-mono text-xs"
                    @update:model-value="(v: string | number) => assignExtensionLocal(staff.id, String(v))"
                  />
                </td>
                <td class="px-3 py-2 text-right">
                  <Button v-if="extensionByStaffId[staff.id]" variant="ghost" size="sm" class="h-7 text-xs text-muted-foreground" @click="threeCX.unassignExtension(staff.id)">
                    Clear
                  </Button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Connect dialog (OAuth) -->
    <Dialog v-model:open="connectDialogOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect 3CX</DialogTitle>
          <DialogDescription>
            Enter your 3CX PBX FQDN to connect.
          </DialogDescription>
        </DialogHeader>
        <form class="space-y-4" @submit.prevent="handleConnect">
          <div class="space-y-2">
            <Label for="threecx-fqdn">PBX FQDN</Label>
            <Input
              id="threecx-fqdn"
              v-model="fqdnInput"
              placeholder="elevate.3cx.asia"
              class="w-full font-mono text-sm"
              :disabled="isConnecting"
            />
            <p class="text-[11px] text-muted-foreground">The full hostname of your 3CX PBX, e.g. <code>elevate.3cx.asia</code>.</p>
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
          <DialogTitle>Disconnect 3CX?</DialogTitle>
          <DialogDescription>
            New call ingestion will stop. Existing call history is preserved.
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
