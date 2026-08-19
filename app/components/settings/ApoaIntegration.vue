<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import GuestRegistrationListingPicker from '~/components/guest-registration/GuestRegistrationListingPicker.vue'

const gr = useGuestRegistration()

const connectDialogOpen = ref(false)
const isConnecting = ref(false)
const formError = ref('')

const formAccommodationName = ref('')
const formAddress = ref('')
const formPhone = ref('')
const formPicName = ref('')

const accounts = computed(() => gr.getConnections('apoa'))
const isConnected = computed(() => gr.isConnected('apoa'))
const registrations = computed(() => gr.registrations.value.filter(r => r.provider === 'apoa'))
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
  return acc?.apoa?.accommodationName ?? 'APOA account'
}

function selectAccount(id: string) {
  activeAccountId.value = id
}

// --- Connect ---
function resetForm() {
  formAccommodationName.value = ''
  formAddress.value = ''
  formPhone.value = ''
  formPicName.value = ''
  formError.value = ''
}

async function handleConnect() {
  if (isConnecting.value)
    return
  if (!formAccommodationName.value.trim() || !formAddress.value.trim() || !formPhone.value.trim() || !formPicName.value.trim()) {
    formError.value = 'All fields are required.'
    return
  }
  isConnecting.value = true
  formError.value = ''
  const result = await gr.connectProvider('apoa', {
    apoa: {
      accommodationName: formAccommodationName.value.trim(),
      address: formAddress.value.trim(),
      phone: formPhone.value.trim(),
      picName: formPicName.value.trim(),
    },
  })
  isConnecting.value = false
  if (!result.success) {
    formError.value = result.error ?? 'Failed to connect to APOA.'
    return
  }
  toast.success('Connected to APOA (Indonesian Immigration).')
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
  gr.disconnectProvider('apoa', disconnectTarget.value)
  toast.info('APOA account disconnected. Reported registrations are preserved.')
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
          APOA (Indonesian Immigration)
        </h3>
        <p class="text-sm text-muted-foreground">
          Aplikasi Pelaporan Orang Asing — report foreign-national guests to Ditjen Imigrasi after check-in.
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
          <Icon name="lucide:stamp" class="size-5 text-muted-foreground" />
        </div>
        <div class="space-y-2">
          <p class="text-base font-medium">
            No APOA accommodation registered
          </p>
          <p class="text-sm text-muted-foreground">
            Connect your accommodation to automatically prepare foreign-guest reports after every check-in.
          </p>
        </div>
        <Button class="gap-2" @click="connectDialogOpen = true">
          <Icon name="lucide:log-in" class="size-4" />
          Connect with APOA
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
          <Icon name="lucide:stamp" class="size-4" :class="activeAccount?.id === account.id ? 'text-primary' : ''" />
          <span class="font-medium">{{ account.apoa?.accommodationName }}</span>
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
            <Icon name="lucide:stamp" class="size-5 text-emerald-600" />
          </div>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium">
              {{ activeAccount.apoa?.accommodationName }}
            </p>
            <p class="text-xs text-muted-foreground">
              {{ activeAccount.apoa?.address }} · PIC: {{ activeAccount.apoa?.picName }}
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
              Accommodation Registration
            </h4>
            <p class="text-xs text-muted-foreground">
              Assign each listing to this APOA account. A listing already used by another account can't be reassigned.
            </p>
          </div>
        </div>
        <GuestRegistrationListingPicker
          v-if="activeAccount"
          provider="apoa"
          :account-id="activeAccount.id"
          :account-label="accountLabel(activeAccount)"
        />
      </div>

      <p class="text-xs text-muted-foreground">
        <Icon name="lucide:info" class="mr-1 inline size-3" />
        Reports are generated for foreign guests after check-in and become due 24 hours later. Track and submit them from the Guest Registration page.
      </p>
    </div>

    <!-- Connect dialog -->
    <Dialog v-model:open="connectDialogOpen">
      <DialogContent class="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Connect APOA</DialogTitle>
          <DialogDescription>
            Enter your accommodation details as registered with the Indonesian Directorate General of Immigration (apoa.imigrasi.go.id). You can connect multiple accounts.
          </DialogDescription>
        </DialogHeader>
        <form class="space-y-4" @submit.prevent="handleConnect">
          <div class="space-y-2">
            <Label for="apoa-name">Accommodation name</Label>
            <Input id="apoa-name" v-model="formAccommodationName" placeholder="e.g. Villa Luwa Management" class="w-full" />
            <p class="text-[11px] text-muted-foreground">
              The name registered with the immigration office.
            </p>
          </div>
          <div class="space-y-2">
            <Label for="apoa-address">Accommodation address</Label>
            <Input id="apoa-address" v-model="formAddress" placeholder="Jl. Raya Canggu No. 88, Bali" class="w-full" />
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-2">
              <Label for="apoa-phone">Phone number</Label>
              <Input id="apoa-phone" v-model="formPhone" placeholder="+62 361 123 4567" class="w-full" />
            </div>
            <div class="space-y-2">
              <Label for="apoa-pic">Person in charge (PIC)</Label>
              <Input id="apoa-pic" v-model="formPicName" placeholder="e.g. Komang Juliantara" class="w-full" />
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
              {{ isConnecting ? 'Connecting…' : 'Connect APOA' }}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <!-- Disconnect dialog -->
    <Dialog v-model:open="disconnectDialogOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Disconnect APOA account?</DialogTitle>
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
