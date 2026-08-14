<script setup lang="ts">
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'

const email = useEmailIntegration()

const connectDialogOpen = ref(false)
const disconnectDialogOpen = ref(false)
const dnsWizardOpen = ref(false)
const connectMode = ref<'default' | 'custom'>('default')
const domainInput = ref('')
const prefixInput = ref('')
const isConnecting = ref(false)
const connectError = ref('')
const isVerifying = ref(false)
const verifyError = ref('')

const activeAccount = computed(() => email.activeAccount.value)
const defaultAccount = computed(() => email.defaultAccount.value)
const customAccount = computed(() => email.customAccount.value)
const isConnected = computed(() => email.isConnected.value)
const hasPendingCustom = computed(() => email.hasPendingCustom.value)

const defaultAddress = computed(() => defaultAccount.value.address)

const customAddressPreview = computed(() => {
  const prefix = prefixInput.value.trim().toLowerCase().replace(/^@+/, '')
  const domain = domainInput.value.trim().toLowerCase()
  if (!prefix && !domain)
    return ''
  return `${prefix || 'stay'}@${domain || 'yourdomain.com'}`
})

function resetConnect() {
  connectMode.value = 'default'
  domainInput.value = ''
  prefixInput.value = ''
  connectError.value = ''
  isConnecting.value = false
}

async function handleConnect() {
  if (isConnecting.value)
    return
  isConnecting.value = true
  connectError.value = ''

  const result = connectMode.value === 'default'
    ? email.connectDefault()
    : email.connectCustom(domainInput.value, prefixInput.value)

  if (!result.success) {
    connectError.value = result.error
    isConnecting.value = false
    return
  }

  toast.success(connectMode.value === 'custom'
    ? `Connected ${result.account.address}. Add the DNS records, then verify.`
    : `Connected ${result.account.address}.`)
  connectDialogOpen.value = false
  resetConnect()
  isConnecting.value = false

  // Open the DNS wizard after the connect dialog fully closes — Reka UI
  // Dialog can't transition one dialog open while another is closing.
  if (connectMode.value === 'custom') {
    window.setTimeout(() => {
      dnsWizardOpen.value = true
    }, 300)
  }
}

async function handleVerify() {
  if (isVerifying.value)
    return
  isVerifying.value = true
  verifyError.value = ''
  try {
    const result = await email.verifyDomain()
    if (!result.success) {
      verifyError.value = result.error
      isVerifying.value = false
      return
    }
    toast.success('Domain verified. New guest email now routes to the Unified Inbox.')
    dnsWizardOpen.value = false
    isVerifying.value = false
  }
  catch (e: any) {
    verifyError.value = e?.message ?? 'Verification failed.'
    isVerifying.value = false
  }
}

function handleDisconnect() {
  email.disconnect()
  toast.info('Email disconnected. Existing email threads are preserved.')
  disconnectDialogOpen.value = false
}

function handleSimulateInbound() {
  // Simulate a guest reply arriving at the connected address — lands in the
  // Unified Inbox with a pop-up + Notification Center alert (demo of the
  // inbound pipeline, mirrors the 3CX simulate-inbound-call pattern).
  email.simulateInboundEmail({
    from: 'emily.wilson@gmail.com',
    to: email.activeAccount.value?.address ?? 'acme-inc@mail.elev8-suite.com',
    subject: 'Re: Check-in details',
    content: 'Hi! Thanks for the details — we arrive tomorrow at 2 PM. See you soon!',
  })
  toast.success('Inbound email simulated — check the Unified Inbox.')
}

function copyText(text: string, label: string) {
  navigator.clipboard.writeText(text)
  toast.success(`${label} copied.`)
}

function copyRecord(record: { host: string, value: string }) {
  navigator.clipboard.writeText(`${record.host} ${record.value}`)
  toast.success('DNS record copied.')
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-end justify-between gap-4">
      <div class="space-y-1">
        <h3 class="text-lg font-medium">
          Email (Sending Domain)
        </h3>
        <p class="text-sm text-muted-foreground">
          Send and receive guest email as your own domain. Connect a branded address, or use the free default — no DNS setup required.
        </p>
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
          <Icon name="lucide:mail" class="size-5 text-muted-foreground" />
        </div>
        <div class="space-y-2">
          <p class="text-base font-medium">
            No email address connected
          </p>
          <p class="text-sm text-muted-foreground">
            Connect a sending domain so guest email lands and gets replied to inside Elev8 — instead of scattered across a personal inbox nobody else on the team can see.
          </p>
        </div>
        <Button class="gap-2" @click="connectDialogOpen = true">
          <Icon name="lucide:mail-plus" class="size-4" />
          Connect Email
        </Button>
      </div>
    </div>

    <!-- Connected state -->
    <div v-else class="space-y-6">
      <div class="rounded-lg border bg-card p-4">
        <div class="flex items-start gap-3">
          <div class="flex size-10 shrink-0 items-center justify-center rounded-md border bg-card">
            <Icon name="lucide:mail" class="size-5 text-sky-600" />
          </div>
          <div class="min-w-0 flex-1">
            <p class="truncate font-mono text-sm font-medium">
              {{ activeAccount?.address }}
            </p>
            <p class="text-xs text-muted-foreground">
              {{ activeAccount?.mode === 'default' ? 'Default Elev8 address' : `Custom domain · ${activeAccount?.domain}` }}
            </p>
            <p class="mt-1 text-[11px] text-muted-foreground/60">
              Connected {{ new Date(activeAccount?.connectedAt ?? '').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) }}
            </p>
            <div class="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" class="h-8 gap-1.5" @click="copyText(activeAccount?.address ?? '', 'Address')">
                <Icon name="lucide:copy" class="size-3.5" />
                Copy address
              </Button>
              <Button size="sm" variant="outline" class="h-8 gap-1.5" @click="handleSimulateInbound">
                <Icon name="lucide:mail-down" class="size-3.5" />
                Simulate inbound
              </Button>
              <Button
                v-if="hasPendingCustom"
                size="sm"
                variant="outline"
                class="h-8 gap-1.5"
                :disabled="isVerifying"
                @click="handleVerify"
              >
                <Icon v-if="isVerifying" name="lucide:loader-circle" class="size-3.5 animate-spin" />
                Re-check verification
              </Button>
              <Button size="sm" variant="outline" class="h-8 gap-1.5 text-destructive hover:text-destructive" @click="disconnectDialogOpen = true">
                <Icon name="lucide:unplug" class="size-3.5" />
                Disconnect
              </Button>
            </div>
          </div>
          <span
            class="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
            :class="hasPendingCustom ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'"
          >
            <span class="h-1.5 w-1.5 rounded-full" :class="hasPendingCustom ? 'bg-amber-500' : 'bg-green-500'" />
            {{ hasPendingCustom ? 'Verifying…' : 'Verified' }}
          </span>
        </div>
      </div>

      <!-- Pending custom domain banner: default address stays active -->
      <div v-if="hasPendingCustom" class="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-[11px] text-amber-700">
        <Icon name="lucide:clock-3" class="mt-0.5 size-3.5 shrink-0" />
        <div class="min-w-0 flex-1">
          <p>
            <span class="font-medium">{{ customAccount?.address }}</span> is verifying — this can take up to 48 hours for DNS propagation.
            Your default address <span class="font-mono">{{ defaultAccount.address }}</span> stays active in the meantime, so there's no downtime.
          </p>
          <Button size="sm" variant="outline" class="mt-2 h-7 gap-1.5" @click="dnsWizardOpen = true">
            <Icon name="lucide:file-text" class="size-3.5" />
            View DNS records
          </Button>
        </div>
      </div>

      <!-- Fan-out: one config point, every surface follows -->
      <div class="rounded-lg border bg-card p-4">
        <p class="mb-2 text-xs font-medium text-muted-foreground">
          Sends from
        </p>
        <p class="font-mono text-sm">
          {{ activeAccount?.address }}
        </p>
        <p class="mt-2 text-[11px] text-muted-foreground/70">
          Used across Unified Inbox replies, Hostbuddy, Guest Guide, Dynamic Templates, and receipt emails — one config point, every surface follows.
        </p>
      </div>
    </div>

    <!-- Connect dialog -->
    <Dialog v-model:open="connectDialogOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect Email</DialogTitle>
          <DialogDescription>
            Choose how guests see your email address.
          </DialogDescription>
        </DialogHeader>
        <form class="space-y-4" @submit.prevent="handleConnect">
          <div class="grid grid-cols-1 gap-2">
            <button
              type="button"
              class="flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors"
              :class="connectMode === 'default' ? 'border-primary bg-primary/5' : 'hover:border-border/80'"
              @click="connectMode = 'default'"
            >
              <span class="text-sm font-medium">Use default address</span>
              <span class="font-mono text-xs text-muted-foreground">{{ defaultAddress }}</span>
              <span class="text-[11px] text-muted-foreground">Free, works immediately — no DNS setup required.</span>
            </button>
            <button
              type="button"
              class="flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors"
              :class="connectMode === 'custom' ? 'border-primary bg-primary/5' : 'hover:border-border/80'"
              @click="connectMode = 'custom'"
            >
              <span class="text-sm font-medium">Connect my own domain</span>
              <span class="text-[11px] text-muted-foreground">Send from your own address (e.g. stay@villacanggu.com). Requires DNS records.</span>
            </button>
          </div>

          <div v-if="connectMode === 'custom'" class="space-y-3">
            <div class="space-y-2">
              <Label for="email-domain">Domain</Label>
              <Input
                id="email-domain"
                v-model="domainInput"
                placeholder="villacanggu.com"
                class="w-full font-mono text-sm"
                :disabled="isConnecting"
              />
              <p class="text-[11px] text-muted-foreground">
                The domain you own, e.g. <code>villacanggu.com</code>.
              </p>
            </div>
            <div class="space-y-2">
              <Label for="email-prefix">Prefix</Label>
              <Input
                id="email-prefix"
                v-model="prefixInput"
                placeholder="stay@"
                class="w-full font-mono text-sm"
                :disabled="isConnecting"
              />
              <p class="text-[11px] text-muted-foreground">
                The local part of your sending address, e.g. <code>stay</code>.
              </p>
            </div>
            <div v-if="customAddressPreview" class="rounded-lg bg-muted/40 p-3 text-sm">
              <span class="text-xs text-muted-foreground">Generated address: </span>
              <span class="font-mono text-sm">{{ customAddressPreview }}</span>
            </div>
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

    <!-- DNS verification wizard (custom mode only) -->
    <Dialog v-model:open="dnsWizardOpen">
      <DialogContent class="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Verify your domain</DialogTitle>
          <DialogDescription>
            Add these records at your registrar (Cloudflare, Namecheap, Google Domains, etc.), then click Verify.
          </DialogDescription>
        </DialogHeader>
        <div class="space-y-4">
          <div class="space-y-2">
            <div class="flex items-center gap-2">
              <span class="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-medium text-primary">1</span>
              <span class="text-sm font-medium">Add DNS records</span>
            </div>
            <div class="space-y-2">
              <div
                v-for="record in customAccount?.dnsRecords ?? []"
                :key="`${record.type}-${record.host}`"
                class="rounded-lg border bg-card p-3"
              >
                <div class="mb-1.5 flex items-center justify-between gap-2">
                  <p class="text-[11px] font-medium text-muted-foreground">
                    {{ record.purpose }}
                  </p>
                  <span v-if="record.optional" class="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    Optional
                  </span>
                </div>
                <div class="flex items-center gap-2">
                  <span class="w-12 shrink-0 rounded bg-muted px-1.5 py-0.5 text-center font-mono text-[11px]">{{ record.type }}</span>
                  <Input :model-value="record.host" readonly class="h-8 flex-1 font-mono text-xs" />
                </div>
                <div class="mt-1.5 flex items-center gap-2">
                  <Input :model-value="record.value" readonly class="h-8 flex-1 font-mono text-xs" />
                  <Button variant="outline" size="sm" class="h-8 shrink-0" @click="copyRecord(record)">
                    <Icon name="lucide:copy" class="size-3.5" />
                  </Button>
                </div>
              </div>
            </div>
            <p class="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 text-[11px] text-amber-700">
              SPF only allows one record per domain. If you already have an SPF record (e.g. for Google Workspace), append <code>include:send.elev8suite.com</code> to it instead of replacing it. The MX record is only needed if you want to receive guest replies by email.
            </p>
          </div>

          <div class="space-y-2">
            <div class="flex items-center gap-2">
              <span class="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-medium text-primary">2</span>
              <span class="text-sm font-medium">Verify</span>
            </div>
            <p class="text-[11px] text-muted-foreground">
              This can take up to 48 hours for DNS propagation. Your default address stays active while it verifies — no downtime.
            </p>
            <div v-if="verifyError" class="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              <div class="flex items-start gap-2">
                <Icon name="lucide:alert-circle" class="mt-0.5 size-4 shrink-0" />
                <span>{{ verifyError }}</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" :disabled="isVerifying" @click="dnsWizardOpen = false">
              Close
            </Button>
            <Button :disabled="isVerifying" class="gap-2" @click="handleVerify">
              <Icon v-if="isVerifying" name="lucide:loader-circle" class="size-4 animate-spin" />
              {{ isVerifying ? 'Verifying…' : 'Verify' }}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>

    <!-- Disconnect dialog -->
    <Dialog v-model:open="disconnectDialogOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Disconnect email?</DialogTitle>
          <DialogDescription>
            New guest email will stop routing to the Inbox. Existing email threads are preserved.
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
