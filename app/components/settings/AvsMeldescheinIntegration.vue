<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import GuestRegistrationListingPicker from '~/components/guest-registration/GuestRegistrationListingPicker.vue'

const gr = useGuestRegistration()

const connectDialogOpen = ref(false)
const isConnecting = ref(false)
const formError = ref('')

const formFirmName = ref('')
const formUsername = ref('')
const formPropertyNumber = ref('')

const accounts = computed(() => gr.getConnections('avs'))
const isConnected = computed(() => gr.isConnected('avs'))
const registrations = computed(() => gr.registrations.value.filter(r => r.provider === 'avs'))
const submittedCount = computed(() => registrations.value.filter(r => r.status === 'submitted').length)

// --- Account selection (tabs) ---
const activeAccountId = ref<string | null>(null)

const activeAccount = computed(() => {
  return accounts.value.find(a => a.id === activeAccountId.value) ?? accounts.value[0] ?? null
})

watch(accounts, (list) => {
  if (activeAccountId.value && !list.some(a => a.id === activeAccountId.value))
    activeAccountId.value = list[0]?.id ?? null
}, { deep: true })

function accountLabel(account: { id: string }) {
  const acc = accounts.value.find(a => a.id === account.id)
  return acc?.avs?.firmName ?? 'AVS account'
}

function selectAccount(id: string) {
  activeAccountId.value = id
}

// --- Connect ---
function resetForm() {
  formFirmName.value = ''
  formUsername.value = ''
  formPropertyNumber.value = ''
  formError.value = ''
}

async function handleConnect() {
  if (isConnecting.value)
    return
  if (!formFirmName.value.trim() || !formUsername.value.trim() || !formPropertyNumber.value.trim()) {
    formError.value = 'All fields are required.'
    return
  }
  isConnecting.value = true
  formError.value = ''
  const result = await gr.connectProvider('avs', {
    avs: {
      firmName: formFirmName.value.trim(),
      username: formUsername.value.trim(),
      propertyNumber: formPropertyNumber.value.trim(),
    },
  })
  isConnecting.value = false
  if (!result.success) {
    formError.value = result.error ?? 'Failed to connect to AVS Meldeschein.'
    return
  }
  toast.success('Connected to AVS Meldeschein.')
  connectDialogOpen.value = false
  resetForm()
}

// --- Disconnect ---
const disconnectTarget = ref<string | null>(null)
const disconnectDialogOpen = computed({
  get: () => disconnectTarget.value !== null,
  set: (val: boolean) => {
    if (!val)
      disconnectTarget.value = null
  },
})

function handleDisconnect() {
  if (!disconnectTarget.value)
    return
  gr.disconnectProvider('avs', disconnectTarget.value)
  toast.info('AVS account disconnected. Reported registrations are preserved.')
  disconnectDialogOpen.value = false
}

async function handleSync() {
  gr.syncAllRegistrations()
  toast.success('Synced guest registrations from reservations.')
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-end justify-between gap-4">
      <div class="space-y-1">
        <h3 class="text-lg font-medium">
          AVS Meldeschein (Germany)
        </h3>
        <p class="text-sm text-muted-foreground">
          Municipal guest registration for German properties — Meldeschein reports for every guest stay.
        </p>
      </div>
      <Button v-if="isConnected" class="gap-2" @click="handleSync">
        <Icon name="lucide:refresh-cw" class="size-4" />
        Sync with reservations
      </Button>
    </div>

    <!-- Empty / disconnected state -->
    <div v-if="!isConnected" class="border border-dashed bg-card/40 p-10 text-center">
      <div class="mx-auto flex max-w-md flex-col items-center gap-4">
        <div class="flex size-12 items-center justify-center rounded-full border bg-background">
          <Icon name="lucide:file-badge" class="size-5 text-muted-foreground" />
        </div>
        <div class="space-y-2">
          <p class="text-base font-medium">
            No AVS Meldeschein account connected
          </p>
          <p class="text-sm text-muted-foreground">
            Connect your AVS account to automatically prepare Meldeschein guest registrations for every stay.
          </p>
        </div>
        <Button class="gap-2" @click="connectDialogOpen = true">
          <Icon name="lucide:log-in" class="size-4" />
          Connect with AVS Meldeschein
        </Button>
      </div>
    </div>

    <!-- Connected state: account tabs -->
    <div v-else class="space-y-4">
      <div class="flex flex-wrap items-center gap-2">
        <button
          v-for="account in accounts"
          :key="account.id"
          type="button"
          class="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors"
          :class="activeAccount?.id === account.id ? 'border-primary bg-primary/10 text-foreground' : 'border-border bg-card text-muted-foreground hover:bg-muted'"
          @click="selectAccount(account.id)"
        >
          <Icon name="lucide:file-badge" class="size-4" :class="activeAccount?.id === account.id ? 'text-primary' : ''" />
          <span class="font-medium">{{ account.avs?.firmName }}</span>
        </button>
        <Button variant="outline" size="sm" class="h-9 gap-1.5" @click="connectDialogOpen = true">
          <Icon name="lucide:plus" class="size-3.5" />
          Add account
        </Button>
      </div>

      <!-- Active account detail -->
      <div v-if="activeAccount" class="rounded-lg border bg-card p-4">
        <div class="flex items-start gap-3">
          <div class="flex size-10 shrink-0 items-center justify-center rounded-md border bg-card">
            <Icon name="lucide:file-badge" class="size-5 text-indigo-600" />
          </div>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium">
              {{ activeAccount.avs?.firmName }}
            </p>
            <p class="text-xs text-muted-foreground">
              {{ activeAccount.avs?.username }} · Property #{{ activeAccount.avs?.propertyNumber }}
            </p>
            <p class="mt-1 text-[11px] text-muted-foreground/60">
              {{ submittedCount }} report{{ submittedCount !== 1 ? 's' : '' }} submitted
            </p>
            <div class="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" class="h-8 gap-1.5 text-destructive hover:text-destructive" @click="disconnectTarget = activeAccount.id">
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

      <!-- Listing assignment picker for active account -->
      <div class="space-y-3">
        <div class="flex items-center justify-between gap-3">
          <div>
            <h4 class="text-sm font-medium">
              Property Registration
            </h4>
            <p class="text-xs text-muted-foreground">
              Assign each listing to this AVS account. A listing already used by another account can't be reassigned.
            </p>
          </div>
        </div>
        <GuestRegistrationListingPicker
          v-if="activeAccount"
          provider="avs"
          :account-id="activeAccount.id"
          :account-label="accountLabel(activeAccount)"
        />
      </div>

      <p class="text-xs text-muted-foreground">
        <Icon name="lucide:info" class="mr-1 inline size-3" />
        Meldeschein reports are generated for every guest after check-in and become due 24 hours later. Track and submit them from the Guest Registration page.
      </p>
    </div>

    <!-- Connect dialog -->
    <Dialog v-model:open="connectDialogOpen">
      <DialogContent class="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Connect AVS Meldeschein</DialogTitle>
          <DialogDescription>
            Enter your AVS Meldeschein login details as provided by your municipality (meldeschein.avs.de). You can connect multiple accounts.
          </DialogDescription>
        </DialogHeader>
        <form class="space-y-4" @submit.prevent="handleConnect">
          <div class="space-y-2">
            <Label for="avs-firm">Firma / company name</Label>
            <Input id="avs-firm" v-model="formFirmName" placeholder="e.g. Villa Sehnsucht GmbH" class="w-full" />
            <p class="text-[11px] text-muted-foreground">
              The company name registered with the municipality.
            </p>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-2">
              <Label for="avs-username">AVS username</Label>
              <Input id="avs-username" v-model="formUsername" placeholder="e.g. villasehnsucht" class="w-full font-mono text-sm" />
            </div>
            <div class="space-y-2">
              <Label for="avs-prop">Property number</Label>
              <Input id="avs-prop" v-model="formPropertyNumber" placeholder="e.g. 12345" class="w-full font-mono text-sm" />
            </div>
          </div>
          <div v-if="formError" class="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <div class="flex items-start gap-2">
              <Icon name="lucide:alert-circle" class="mt-0.5 size-4 shrink-0" />
              <span>{{ formError }}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" :disabled="isConnecting" @click="connectDialogOpen = false; resetForm()">
              Cancel
            </Button>
            <Button type="submit" :disabled="isConnecting" class="gap-2">
              <Icon v-if="isConnecting" name="lucide:loader-circle" class="size-4 animate-spin" />
              {{ isConnecting ? 'Connecting…' : 'Connect AVS' }}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <!-- Disconnect dialog -->
    <Dialog v-model:open="disconnectDialogOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Disconnect AVS account?</DialogTitle>
          <DialogDescription>
            New reports will stop. Submitted registration records will be preserved for the next time you connect. Listings assigned to this account will be unassigned.
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
