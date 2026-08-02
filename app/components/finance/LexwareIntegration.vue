<script setup lang="ts">
import type { LexwareInvoice, LexwareInvoiceStatus } from '@/components/finance/data/lexware-invoices'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import { getAccountsByCategory, getRevenueAccounts, lexwareAccounts } from '@/components/finance/data/lexware'
import { mappingTabs, useIntegrationAccounts } from '@/composables/useIntegrationAccounts'
import { useLexware } from '@/composables/useLexware'

const {
  isConnected,
  needsAttention,
  apiKey,
  companyName,
  lastConnected,
  isSaving,
  isBulkSyncing,
  bulkSyncProgress,
  health,
  invoices,
  exceptionInvoices,
  syncHistory,
  eurListings,
  eurListingsCount,
  draftCount,
  openCount,
  paidCount,
  creditNoteCount,
  syncFailedCount,
  needsMappingCount,
  nonEligibleCount,
  totalSyncedEur,
  nonEligibleDigest,
  connect,
  testConnection,
  disconnect,
  reconnect,
  runHealthCheck,
  issueCreditNoteForCancellation,
  retryFailedInvoice,
  startBulkHistoricalSync,
  formatAccounting,
} = useLexware()

const showDisconnectConfirm = ref(false)
const showApiKeyInput = ref(false)
const apiKeyInputValue = ref('')
const showConfigDialog = ref(false)
const showDraftInvoicesDialog = ref(false)
const showExceptionsDialog = ref(false)
const showSyncHistoryDialog = ref(false)
const showBulkSyncDialog = ref(false)
const showHealthDetailsDialog = ref(false)

const activeTab = ref<string>('booking')

// ── Connection handlers ────────────────────────────────────────────────
async function handleConnect() {
  if (!apiKeyInputValue.value.trim()) {
    toast.error('API key cannot be empty.')
    return
  }
  await connect(apiKeyInputValue.value)
  showApiKeyInput.value = false
  toast.success('Connected to Lexware.')
  showConfigDialog.value = true
}

async function handleReconnect() {
  if (!apiKeyInputValue.value.trim()) {
    toast.error('API key cannot be empty.')
    return
  }
  await reconnect(apiKeyInputValue.value)
  showApiKeyInput.value = false
  apiKeyInputValue.value = ''
  toast.success('Reconnected to Lexware. Webhooks re-subscribed.')
  clearNeedsAttention()
}

async function handleTestConnection() {
  const ok = await testConnection()
  if (ok)
    toast.success('Connection successful — Lexware API responded.')
  else toast.error('Connection failed. Check your API key.')
}

function handleDisconnect() {
  disconnect()
  showDisconnectConfirm.value = false
  toast.info('Disconnected from Lexware.')
}

function clearNeedsAttention() {
  // Direct call to lexware composable rather than via a nested wrapper
  const lex = useLexware()
  lex.clearNeedsAttention()
}

// ── Account mapping (Rules 4 & 5) ─────────────────────────────────────
const { getDefaults, setBookingRevenueLine, setUpsellRevenueLine, setCostsLine, setCityTax } = useIntegrationAccounts()
const lexwareDefaults = computed(() => getDefaults('lexware'))

const validationErrors = ref<Record<string, string>>({})

function validateAccount(code: string, requiredPrefix: string, fieldKey: string): boolean {
  if (!code) {
    const { [fieldKey]: _, ...rest } = validationErrors.value
    validationErrors.value = rest
    return true
  }
  if (!code.startsWith(requiredPrefix)) {
    const prefixLabels: Record<string, string> = { 1: 'asset (1xxx)', 2: 'liability (2xxx)', 8: 'revenue (8xxx)', 4: 'expense (4xxx)' }
    validationErrors.value = { ...validationErrors.value, [fieldKey]: `Must be a ${prefixLabels[requiredPrefix]} account` }
    return false
  }
  const { [fieldKey]: _, ...rest } = validationErrors.value
  validationErrors.value = rest
  return true
}

const hasErrors = computed(() => Object.keys(validationErrors.value).length > 0)

const allAccounts = computed(() => lexwareAccounts)
const liabilityAccounts = computed(() => getAccountsByCategory('liability'))
const revenueAccounts = computed(() => getRevenueAccounts())

function handleSave() {
  const getAccountCode = (id: string) => lexwareAccounts.find(a => a.id === id)?.code || ''
  validateAccount(getAccountCode(lexwareDefaults.value.cityTax.taxCollected), '2', 'taxCollected')
  validateAccount(getAccountCode(lexwareDefaults.value.cityTax.taxRemitted), '2', 'taxRemitted')

  if (hasErrors.value) {
    toast.error('Please fix validation errors before saving.')
    return
  }

  showConfigDialog.value = false
  toast.success('Mapping saved. Lexware sync is active.')
}

// ── Draft invoice table ────────────────────────────────────────────────
const draftTableSearch = ref('')
const draftStatusFilter = ref<'all' | LexwareInvoiceStatus>('all')

const filteredDraftInvoices = computed(() => {
  let list = invoices.value
  if (draftStatusFilter.value !== 'all') {
    list = list.filter(i => i.status === draftStatusFilter.value)
  }
  const q = draftTableSearch.value.toLowerCase().trim()
  if (q) {
    list = list.filter(i =>
      i.listingName.toLowerCase().includes(q)
      || i.guestName.toLowerCase().includes(q)
      || i.lexwareInvoiceId?.toLowerCase().includes(q)
      || i.reservationId.toLowerCase().includes(q),
    )
  }
  return list
})

function statusLabel(status: LexwareInvoiceStatus): string {
  switch (status) {
    case 'draft_created': return 'Draft created'
    case 'open_in_lexware': return 'Open in Lexware'
    case 'paid': return 'Paid'
    case 'credit_note_created': return 'Credit note created'
    case 'sync_failed': return 'Sync failed'
    case 'needs_mapping': return 'Needs mapping'
  }
}

function statusToneClass(status: LexwareInvoiceStatus): string {
  switch (status) {
    case 'draft_created': return 'text-amber-700 bg-amber-50'
    case 'open_in_lexware': return 'text-blue-700 bg-blue-50'
    case 'paid': return 'text-green-700 bg-green-50'
    case 'credit_note_created': return 'text-slate-700 bg-slate-100'
    case 'sync_failed': return 'text-red-700 bg-red-50'
    case 'needs_mapping': return 'text-orange-700 bg-orange-50'
  }
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const m = Math.floor(ms / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (d > 0)
    return `${d}d ago`
  if (h > 0)
    return `${h}h ago`
  if (m > 0)
    return `${m}m ago`
  return 'just now'
}

// ── Credit note actions ────────────────────────────────────────────────
async function handleCancelAndIssueCreditNote(invoice: LexwareInvoice) {
  await issueCreditNoteForCancellation(invoice.id)
  toast.success(`Credit note auto-issued in Lexware for ${invoice.guestName}.`)
}

async function handleRetry(invoice: LexwareInvoice) {
  const result = await retryFailedInvoice(invoice.id)
  if (result.success)
    toast.success('Invoice re-pushed to Lexware.')
  else toast.error('Retry failed — connection still needs attention.')
}

// ── Bulk historical sync ───────────────────────────────────────────────
async function handleStartBulkSync() {
  showBulkSyncDialog.value = false
  // Mock 50 historical bookings to push, throttled to 2 req/sec per Rule 7.
  const payments = Array.from({ length: 50 }).map((_, i) => ({
    reservationId: `res-historical-${i + 1}`,
    listingId: eurListings[i % eurListings.length]!.id,
    listingName: eurListings[i % eurListings.length]!.name,
    guestName: `Historical Guest ${i + 1}`,
    guestEmail: `guest${i + 1}@historical.example.de`,
    lineItems: [
      { category: 'Accommodation' as const, description: 'Historical stay', quantity: 3, unitPrice: 220, vatRate: 7 as const, postingAccountId: 'la-8210' },
    ],
  }))
  const result = await startBulkHistoricalSync(payments)
  toast.success(`Bulk sync complete: ${result.pushed} drafts created (throttled at 2 req/sec).`)
}

async function handleRunHealthCheck() {
  await runHealthCheck()
  toast.info('Health check completed.')
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- "Needs attention" banner (Flow C) -->
    <div
      v-if="needsAttention"
      class="flex items-start gap-3 rounded-lg border border-red-300 bg-red-50 p-4"
    >
      <Icon name="i-lucide-alert-triangle" class="mt-0.5 h-5 w-5 text-red-600" />
      <div class="flex-1">
        <p class="text-sm font-medium text-red-900">
          Lexware connection needs attention
        </p>
        <p class="mt-0.5 text-xs text-red-800">
          {{ health.failedReason || 'API key rejected or webhook subscription missing. Reconnect to resume draft invoice sync.' }}
        </p>
      </div>
      <Button size="sm" variant="outline" class="border-red-300 text-red-700 hover:bg-red-100" @click="showApiKeyInput = true">
        Reconnect
      </Button>
    </div>

    <!-- Connection card -->
    <div class="rounded-lg border bg-card">
      <div class="flex items-center justify-between border-b px-5 py-3.5">
        <div class="flex items-center gap-3">
          <div class="flex h-9 w-9 items-center justify-center rounded-md bg-[#F6BB12]/15">
            <FinanceLexwareLogo class="h-5 w-auto" />
          </div>
          <div>
            <p class="text-sm font-medium">
              Lexware
            </p>
            <p class="text-xs text-muted-foreground">
              German accounting & GoBD-ready invoicing
            </p>
          </div>
        </div>
        <span
          class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
          :class="needsAttention ? 'text-red-700 bg-red-50' : isConnected ? 'text-green-700 bg-green-50' : 'text-slate-600 bg-slate-100'"
        >
          <span
            class="h-1.5 w-1.5 rounded-full"
            :class="needsAttention ? 'bg-red-500' : isConnected ? 'bg-green-500' : 'bg-slate-400'"
          />
          {{ needsAttention ? 'Needs attention' : isConnected ? 'Connected' : 'Not connected' }}
        </span>
      </div>

      <div class="p-5">
        <!-- Connected state -->
        <template v-if="isConnected && !needsAttention">
          <dl class="grid grid-cols-1 gap-3 text-sm sm:grid-cols-4">
            <div>
              <dt class="text-xs text-muted-foreground">
                Company
              </dt>
              <dd class="mt-0.5 font-medium">
                {{ companyName }}
              </dd>
            </div>
            <div>
              <dt class="text-xs text-muted-foreground">
                API Key
              </dt>
              <dd class="mt-0.5 font-mono text-sm">
                {{ apiKey }}
              </dd>
            </div>
            <div>
              <dt class="text-xs text-muted-foreground">
                Connected since
              </dt>
              <dd class="mt-0.5 font-medium">
                {{ lastConnected }}
              </dd>
            </div>
            <div>
              <dt class="text-xs text-muted-foreground">
                Last health check
              </dt>
              <dd class="mt-0.5 font-medium">
                {{ health.lastCheckedAt ? new Date(health.lastCheckedAt).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }) : '—' }}
              </dd>
            </div>
          </dl>

          <!-- Mini stats row -->
          <div class="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
            <button
              class="rounded-md border bg-muted/30 px-3 py-2 text-left transition-colors hover:bg-muted/60"
              @click="showDraftInvoicesDialog = true"
            >
              <p class="text-[11px] text-muted-foreground uppercase tracking-wider">
                Drafts
              </p>
              <p class="mt-0.5 text-lg font-semibold tabular-nums">
                {{ draftCount }}
              </p>
            </button>
            <button
              class="rounded-md border bg-muted/30 px-3 py-2 text-left transition-colors hover:bg-muted/60"
              @click="showSyncHistoryDialog = true"
            >
              <p class="text-[11px] text-muted-foreground uppercase tracking-wider">
                Open in Lexware
              </p>
              <p class="mt-0.5 text-lg font-semibold tabular-nums">
                {{ openCount }}
              </p>
            </button>
            <div class="rounded-md border bg-muted/30 px-3 py-2 text-left">
              <p class="text-[11px] text-muted-foreground uppercase tracking-wider">
                Paid
              </p>
              <p class="mt-0.5 text-lg font-semibold tabular-nums">
                {{ paidCount }}
              </p>
            </div>
            <div class="rounded-md border bg-muted/30 px-3 py-2 text-left">
              <p class="text-[11px] text-muted-foreground uppercase tracking-wider">
                Credit notes
              </p>
              <p class="mt-0.5 text-lg font-semibold tabular-nums">
                {{ creditNoteCount }}
              </p>
            </div>
            <button
              class="rounded-md border px-3 py-2 text-left transition-colors"
              :class="(needsMappingCount + syncFailedCount) > 0 ? 'bg-red-50 hover:bg-red-100 border-red-200' : 'bg-muted/30 hover:bg-muted/60'"
              @click="showExceptionsDialog = true"
            >
              <p class="text-[11px] text-muted-foreground uppercase tracking-wider">
                Exceptions
              </p>
              <p class="mt-0.5 text-lg font-semibold tabular-nums" :class="(needsMappingCount + syncFailedCount) > 0 ? 'text-red-700' : ''">
                {{ needsMappingCount + syncFailedCount }}
              </p>
            </button>
          </div>

          <div class="mt-2 text-xs text-muted-foreground">
            Total synced to Lexware: <span class="font-medium text-foreground">{{ formatAccounting(totalSyncedEur) }}</span>
          </div>

          <div class="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" @click="showConfigDialog = true">
              <Icon name="i-lucide-settings-2" class="mr-2 h-3.5 w-3.5" />
              Account & Tag Mapping
            </Button>
            <Button variant="outline" size="sm" @click="showDraftInvoicesDialog = true">
              <Icon name="i-lucide-file-text" class="mr-2 h-3.5 w-3.5" />
              Draft invoices
            </Button>
            <Button variant="outline" size="sm" @click="showSyncHistoryDialog = true">
              <Icon name="i-lucide-history" class="mr-2 h-3.5 w-3.5" />
              Sync history
            </Button>
            <Button variant="outline" size="sm" @click="showBulkSyncDialog = true">
              <Icon name="i-lucide-refresh-cw" class="mr-2 h-3.5 w-3.5" />
              Bulk historical sync
            </Button>
            <Button variant="outline" size="sm" @click="handleRunHealthCheck">
              <Icon name="i-lucide-activity" class="mr-2 h-3.5 w-3.5" />
              Run health check
            </Button>
            <Button variant="ghost" size="sm" class="text-destructive hover:text-destructive" @click="showDisconnectConfirm = true">
              <Icon name="i-lucide-unlink" class="mr-2 h-3.5 w-3.5" />
              Disconnect
            </Button>
          </div>
        </template>

        <!-- Not connected state -->
        <template v-else-if="!needsAttention">
          <p class="mb-4 text-sm text-muted-foreground">
            Connect your Lexware account to push finalized revenue records straight into your German bookkeeping. EUR-denominated listings only.
          </p>
          <div class="flex flex-wrap gap-2">
            <Button size="sm" data-testid="lexware-connect-button" @click="showApiKeyInput = true">
              <Icon name="i-lucide-plug" class="mr-2 h-3.5 w-3.5" />
              Connect Lexware
            </Button>
            <Button variant="ghost" size="sm" @click="showHealthDetailsDialog = true">
              <Icon name="i-lucide-info" class="mr-2 h-3.5 w-3.5" />
              How sync works
            </Button>
          </div>
        </template>

        <!-- API key input -->
        <div v-if="showApiKeyInput" class="mt-4 flex flex-col gap-3 rounded-lg border bg-muted/40 p-4">
          <div>
            <label class="mb-1.5 block text-sm font-medium">
              {{ needsAttention ? 'New API Key' : 'API Key' }}
            </label>
            <p class="mb-2 text-xs text-muted-foreground">
              Generate a private API key at <span class="font-mono">app.lexware.de/addons/public-api</span> and paste it here.
            </p>
            <Input
              v-model="apiKeyInputValue"
              type="password"
              placeholder="lx-..."
              class="font-mono"
              @keydown.enter="needsAttention ? handleReconnect() : handleConnect()"
            />
          </div>
          <div class="flex gap-2">
            <Button
              size="sm"
              :disabled="isSaving"
              @click="needsAttention ? handleReconnect() : handleConnect()"
            >
              <Icon v-if="isSaving" name="i-lucide-loader-2" class="mr-2 h-3.5 w-3.5 animate-spin" />
              {{ needsAttention ? 'Reconnect & resume' : 'Save & Connect' }}
            </Button>
            <Button variant="ghost" size="sm" @click="showApiKeyInput = false; apiKeyInputValue = ''">
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>

    <!-- EU-eligibility callout (Rule 1) -->
    <div class="rounded-lg border bg-muted/30 p-4">
      <div class="flex items-start gap-3">
        <Icon name="i-lucide-info" class="mt-0.5 h-4 w-4 text-muted-foreground" />
        <div class="flex-1">
          <p class="text-sm font-medium">
            EUR-only sync
          </p>
          <p class="mt-0.5 text-xs text-muted-foreground">
            Lexware is EUR-only. {{ eurListingsCount }} EUR-denominated listings are eligible. Non-EUR bookings are flagged as
            <button class="underline-offset-2 hover:underline" @click="showExceptionsDialog = true">
              "Not eligible for Lexware export"
            </button> ({{ nonEligibleCount }} this week).
          </p>
        </div>
      </div>
    </div>

    <!-- Disconnect dialog -->
    <AlertDialog :open="showDisconnectConfirm" @update:open="showDisconnectConfirm = $event">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Disconnect Lexware?</AlertDialogTitle>
          <AlertDialogDescription as="div" class="flex flex-col gap-3">
            <p>Your API key will be removed and future draft invoices will no longer be pushed to Lexware.</p>
            <p class="text-xs text-muted-foreground">
              Invoices already created in Lexware will remain there and are not affected. Webhook subscriptions will be deactivated.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction class="bg-destructive text-destructive-foreground hover:bg-destructive/90" @click="handleDisconnect">
            Disconnect
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <!-- Config dialog (Posting Category mapping) -->
    <Dialog :open="showConfigDialog" @update:open="showConfigDialog = $event">
      <DialogContent class="!max-w-4xl">
        <DialogHeader>
          <DialogTitle>Lexware Account & Tag Mapping</DialogTitle>
          <DialogDescription>
            Map Elev8 transaction types to your Lexware (DATEV/SKR03) chart of accounts. Mapping changes apply prospectively — existing Lexware invoices are never re-categorized.
          </DialogDescription>
        </DialogHeader>

        <Tabs v-model="activeTab" class="w-full">
          <TabsList class="w-full justify-start">
            <TabsTrigger v-for="tab in mappingTabs" :key="tab.key" :value="tab.key" class="gap-1.5">
              <Icon :name="tab.icon" class="h-3.5 w-3.5" />
              {{ tab.label }}
            </TabsTrigger>
          </TabsList>

          <!-- Booking Revenue -->
          <TabsContent value="booking" class="mt-4">
            <div class="flex flex-col gap-4">
              <p class="text-sm text-muted-foreground">
                Double-entry mapping for booking invoices. Each line item has a debit and credit account. Lexware only accepts VAT rates of 0%, 7%, or 19%.
              </p>

              <div class="rounded-md border overflow-visible">
                <table class="w-full text-sm">
                  <thead>
                    <tr class="border-b bg-muted/40">
                      <th class="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground w-[25%]">
                        Line Item
                      </th>
                      <th class="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground w-[37.5%]">
                        Debit Account
                      </th>
                      <th class="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground w-[37.5%]">
                        Credit Account
                      </th>
                    </tr>
                  </thead>
                  <tbody class="divide-y">
                    <tr>
                      <td class="px-4 py-3">
                        <p class="font-medium">
                          Accommodation
                        </p>
                        <p class="text-xs text-muted-foreground">
                          default 7% VAT
                        </p>
                      </td>
                      <td class="px-4 py-3">
                        <Select :model-value="lexwareDefaults.bookingRevenue.accommodation.debit" @update:model-value="val => setBookingRevenueLine('lexware', 'accommodation', 'debit', val as string)">
                          <SelectTrigger class="h-8 w-full text-xs">
                            <SelectValue placeholder="Select…" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem v-for="acc in allAccounts" :key="acc.id" :value="acc.id">
                              {{ acc.code }} · {{ acc.name }}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td class="px-4 py-3">
                        <Select :model-value="lexwareDefaults.bookingRevenue.accommodation.credit" @update:model-value="val => setBookingRevenueLine('lexware', 'accommodation', 'credit', val as string)">
                          <SelectTrigger class="h-8 w-full text-xs">
                            <SelectValue placeholder="Select…" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem v-for="acc in revenueAccounts" :key="acc.id" :value="acc.id">
                              {{ acc.code }} · {{ acc.name }}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                    <tr>
                      <td class="px-4 py-3">
                        <p class="font-medium">
                          Cleaning Fee
                        </p>
                        <p class="text-xs text-muted-foreground">
                          19% VAT
                        </p>
                      </td>
                      <td class="px-4 py-3">
                        <Select :model-value="lexwareDefaults.bookingRevenue.platformFee.debit" @update:model-value="val => setBookingRevenueLine('lexware', 'platformFee', 'debit', val as string)">
                          <SelectTrigger class="h-8 w-full text-xs">
                            <SelectValue placeholder="Select…" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem v-for="acc in allAccounts" :key="acc.id" :value="acc.id">
                              {{ acc.code }} · {{ acc.name }}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td class="px-4 py-3">
                        <Select :model-value="lexwareDefaults.bookingRevenue.platformFee.credit" @update:model-value="val => setBookingRevenueLine('lexware', 'platformFee', 'credit', val as string)">
                          <SelectTrigger class="h-8 w-full text-xs">
                            <SelectValue placeholder="Select…" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem v-for="acc in allAccounts" :key="acc.id" :value="acc.id">
                              {{ acc.code }} · {{ acc.name }}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                    <tr>
                      <td class="px-4 py-3">
                        <p class="font-medium">
                          Upsell
                        </p>
                        <p class="text-xs text-muted-foreground">
                          19% VAT
                        </p>
                      </td>
                      <td class="px-4 py-3">
                        <Select :model-value="lexwareDefaults.bookingRevenue.fee.debit" @update:model-value="val => setBookingRevenueLine('lexware', 'fee', 'debit', val as string)">
                          <SelectTrigger class="h-8 w-full text-xs">
                            <SelectValue placeholder="Select…" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem v-for="acc in allAccounts" :key="acc.id" :value="acc.id">
                              {{ acc.code }} · {{ acc.name }}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td class="px-4 py-3">
                        <Select :model-value="lexwareDefaults.bookingRevenue.fee.credit" @update:model-value="val => setBookingRevenueLine('lexware', 'fee', 'credit', val as string)">
                          <SelectTrigger class="h-8 w-full text-xs">
                            <SelectValue placeholder="Select…" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem v-for="acc in revenueAccounts" :key="acc.id" :value="acc.id">
                              {{ acc.code }} · {{ acc.name }}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                    <tr>
                      <td class="px-4 py-3">
                        <p class="font-medium">
                          VAT Output
                        </p>
                        <p class="text-xs text-muted-foreground">
                          pinned to 7%, 19% liability accounts
                        </p>
                      </td>
                      <td class="px-4 py-3">
                        <Select :model-value="lexwareDefaults.bookingRevenue.tax.debit" @update:model-value="val => setBookingRevenueLine('lexware', 'tax', 'debit', val as string)">
                          <SelectTrigger class="h-8 w-full text-xs">
                            <SelectValue placeholder="Select…" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem v-for="acc in allAccounts" :key="acc.id" :value="acc.id">
                              {{ acc.code }} · {{ acc.name }}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td class="px-4 py-3">
                        <Select :model-value="lexwareDefaults.bookingRevenue.tax.credit" @update:model-value="val => setBookingRevenueLine('lexware', 'tax', 'credit', val as string)">
                          <SelectTrigger class="h-8 w-full text-xs">
                            <SelectValue placeholder="Select…" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem v-for="acc in liabilityAccounts" :key="acc.id" :value="acc.id">
                              {{ acc.code }} · {{ acc.name }}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div class="rounded-md border border-amber-200 bg-amber-50/50 p-3 text-xs">
                <p class="font-medium text-amber-900">
                  Lexware VAT constraint
                </p>
                <p class="mt-0.5 text-amber-800">
                  Only VAT rates of 0%, 7%, or 19% are accepted. If a line item has a different rate, the invoice is held in "Needs mapping" and Finance is notified.
                </p>
              </div>
            </div>
          </TabsContent>

          <!-- Upsell -->
          <TabsContent value="upsell" class="mt-4">
            <p class="text-sm text-muted-foreground">
              Upsell orders are pushed as separate Lexware invoices (never appended to booking invoices).
            </p>
            <div class="mt-4 rounded-md border overflow-visible">
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b bg-muted/40">
                    <th class="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground w-[25%]">
                      Line Item
                    </th>
                    <th class="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground w-[37.5%]">
                      Debit Account
                    </th>
                    <th class="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground w-[37.5%]">
                      Credit Account
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td class="px-4 py-3">
                      <p class="font-medium">
                        Upsell Revenue
                      </p>
                      <p class="text-xs text-muted-foreground">
                        per upsell order
                      </p>
                    </td>
                    <td class="px-4 py-3">
                      <Select :model-value="lexwareDefaults.upsellRevenue.default.debit" @update:model-value="val => setUpsellRevenueLine('lexware', 'debit', val as string)">
                        <SelectTrigger class="h-8 w-full text-xs">
                          <SelectValue placeholder="Select…" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem v-for="acc in allAccounts" :key="acc.id" :value="acc.id">
                            {{ acc.code }} · {{ acc.name }}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td class="px-4 py-3">
                      <Select :model-value="lexwareDefaults.upsellRevenue.default.credit" @update:model-value="val => setUpsellRevenueLine('lexware', 'credit', val as string)">
                        <SelectTrigger class="h-8 w-full text-xs">
                          <SelectValue placeholder="Select…" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem v-for="acc in revenueAccounts" :key="acc.id" :value="acc.id">
                            {{ acc.code }} · {{ acc.name }}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </TabsContent>

          <!-- Costs -->
          <TabsContent value="costs" class="mt-4">
            <p class="text-sm text-muted-foreground">
              Default account for operational costs. Cost types are bundled into a single line item.
            </p>
            <div class="mt-4 rounded-md border overflow-visible">
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b bg-muted/40">
                    <th class="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground w-[25%]">
                      Line Item
                    </th>
                    <th class="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground w-[37.5%]">
                      Debit Account
                    </th>
                    <th class="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground w-[37.5%]">
                      Credit Account
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td class="px-4 py-3">
                      <p class="font-medium">
                        Operational Costs
                      </p>
                    </td>
                    <td class="px-4 py-3">
                      <Select :model-value="lexwareDefaults.costs.default.debit" @update:model-value="val => setCostsLine('lexware', 'debit', val as string)">
                        <SelectTrigger class="h-8 w-full text-xs">
                          <SelectValue placeholder="Select…" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem v-for="acc in allAccounts" :key="acc.id" :value="acc.id">
                            {{ acc.code }} · {{ acc.name }}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td class="px-4 py-3">
                      <Select :model-value="lexwareDefaults.costs.default.credit" @update:model-value="val => setCostsLine('lexware', 'credit', val as string)">
                        <SelectTrigger class="h-8 w-full text-xs">
                          <SelectValue placeholder="Select…" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem v-for="acc in allAccounts" :key="acc.id" :value="acc.id">
                            {{ acc.code }} · {{ acc.name }}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </TabsContent>

          <!-- City Tax -->
          <TabsContent value="tax" class="mt-4">
            <div class="flex flex-col gap-4">
              <div class="flex flex-col gap-1.5 max-w-md">
                <label class="text-sm font-medium">Collection Mode</label>
                <p class="text-xs text-muted-foreground">
                  Who collects city tax from guests?
                </p>
                <Select :model-value="lexwareDefaults.cityTax.collectionMode" @update:model-value="val => setCityTax('lexware', 'collectionMode', val as string)">
                  <SelectTrigger class="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="elev8">
                      Collected by Elev8
                    </SelectItem>
                    <SelectItem value="ota">
                      Collected by OTA (e.g. Airbnb)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <template v-if="lexwareDefaults.cityTax.collectionMode === 'elev8'">
                <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div class="flex flex-col gap-1.5">
                    <label class="text-sm font-medium">Tax Collected</label>
                    <p class="text-xs text-muted-foreground">
                      Liability account (2xxx)
                    </p>
                    <Select :model-value="lexwareDefaults.cityTax.taxCollected" @update:model-value="val => { setCityTax('lexware', 'taxCollected', val as string); validateAccount(lexwareAccounts.find(a => a.id === val)?.code || '', '2', 'taxCollected') }">
                      <SelectTrigger class="w-full" :class="validationErrors.taxCollected && 'border-destructive'">
                        <SelectValue placeholder="Select account…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem v-for="acc in liabilityAccounts" :key="acc.id" :value="acc.id">
                          {{ acc.code }} – {{ acc.name }}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p v-if="validationErrors.taxCollected" class="text-xs text-destructive">
                      {{ validationErrors.taxCollected }}
                    </p>
                  </div>
                  <div class="flex flex-col gap-1.5">
                    <label class="text-sm font-medium">Tax Remitted</label>
                    <p class="text-xs text-muted-foreground">
                      Liability account (2xxx) — cleared when remitted
                    </p>
                    <Select :model-value="lexwareDefaults.cityTax.taxRemitted" @update:model-value="val => { setCityTax('lexware', 'taxRemitted', val as string); validateAccount(lexwareAccounts.find(a => a.id === val)?.code || '', '2', 'taxRemitted') }">
                      <SelectTrigger class="w-full" :class="validationErrors.taxRemitted && 'border-destructive'">
                        <SelectValue placeholder="Select account…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem v-for="acc in liabilityAccounts" :key="acc.id" :value="acc.id">
                          {{ acc.code }} – {{ acc.name }}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p v-if="validationErrors.taxRemitted" class="text-xs text-destructive">
                      {{ validationErrors.taxRemitted }}
                    </p>
                  </div>
                </div>
              </template>

              <div v-else class="rounded-md border border-blue-200 bg-blue-50/50 p-3">
                <p class="text-xs text-blue-800">
                  <Icon name="i-lucide-info" class="mr-1 inline h-3.5 w-3.5" />
                  OTA handles collection and remittance. No Lexware entry will be created for city tax on OTA bookings.
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter class="mt-4">
          <Button variant="ghost" @click="showConfigDialog = false">
            Cancel
          </Button>
          <Button :disabled="hasErrors" @click="handleSave">
            <Icon v-if="hasErrors" name="i-lucide-alert-circle" class="mr-2 h-3.5 w-3.5" />
            Save mapping
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Draft invoices dialog -->
    <Dialog :open="showDraftInvoicesDialog" @update:open="showDraftInvoicesDialog = $event">
      <DialogContent class="!max-w-5xl">
        <DialogHeader>
          <DialogTitle>Draft Invoices</DialogTitle>
          <DialogDescription>
            Elev8 creates drafts in Lexware — finalize inside Lexware to mark them as Open. EUR-only.
          </DialogDescription>
        </DialogHeader>

        <div class="mb-3 flex items-center gap-2">
          <div class="relative flex-1">
            <Icon name="i-lucide-search" class="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input v-model="draftTableSearch" class="h-8 pl-8 text-xs" placeholder="Search by listing, guest, or Lexware ID…" />
          </div>
          <Select :model-value="draftStatusFilter" @update:model-value="val => draftStatusFilter = val as LexwareInvoiceStatus | 'all'">
            <SelectTrigger class="h-8 w-[180px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                All statuses
              </SelectItem>
              <SelectItem value="draft_created">
                Draft created
              </SelectItem>
              <SelectItem value="open_in_lexware">
                Open in Lexware
              </SelectItem>
              <SelectItem value="paid">
                Paid
              </SelectItem>
              <SelectItem value="credit_note_created">
                Credit note created
              </SelectItem>
              <SelectItem value="needs_mapping">
                Needs mapping
              </SelectItem>
              <SelectItem value="sync_failed">
                Sync failed
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div class="max-h-[420px] overflow-y-auto rounded-md border">
          <table class="w-full text-sm">
            <thead class="sticky top-0 z-10 bg-popover">
              <tr class="border-b">
                <th class="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                  Listing
                </th>
                <th class="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                  Guest
                </th>
                <th class="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                  Lexware ID
                </th>
                <th class="px-3 py-2 text-right text-xs font-medium text-muted-foreground">
                  Total
                </th>
                <th class="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                  Status
                </th>
                <th class="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                  Synced
                </th>
                <th class="px-3 py-2 text-right text-xs font-medium text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody class="divide-y">
              <tr v-for="invoice in filteredDraftInvoices" :key="invoice.id">
                <td class="px-3 py-2 text-xs">
                  <div class="font-medium">
                    {{ invoice.listingName }}
                  </div>
                  <div class="text-[10px] text-muted-foreground font-mono">
                    {{ invoice.reservationId }}
                  </div>
                </td>
                <td class="px-3 py-2 text-xs">
                  <div>
                    {{ invoice.guestName }}
                  </div>
                  <div class="text-[10px] text-muted-foreground">
                    {{ invoice.guestEmail }}
                  </div>
                </td>
                <td class="px-3 py-2 text-xs font-mono">
                  <span v-if="invoice.lexwareInvoiceId">{{ invoice.lexwareInvoiceId }}</span>
                  <span v-else class="text-muted-foreground">—</span>
                </td>
                <td class="px-3 py-2 text-xs text-right tabular-nums font-medium">
                  {{ formatAccounting(invoice.totalAmount) }}
                </td>
                <td class="px-3 py-2 text-xs">
                  <span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium" :class="statusToneClass(invoice.status)">
                    {{ statusLabel(invoice.status) }}
                  </span>
                  <div v-if="invoice.needsMappingReason" class="mt-1 text-[10px] text-orange-700 max-w-[200px]">
                    {{ invoice.needsMappingReason }}
                  </div>
                  <div v-else-if="invoice.failureReason" class="mt-1 text-[10px] text-red-700 max-w-[200px]">
                    {{ invoice.failureReason }}
                  </div>
                </td>
                <td class="px-3 py-2 text-xs text-muted-foreground">
                  {{ timeAgo(invoice.createdAt) }}
                </td>
                <td class="px-3 py-2 text-xs text-right">
                  <div class="flex justify-end gap-1">
                    <Button v-if="invoice.status === 'draft_created'" variant="ghost" size="sm" class="h-6 text-[11px]" @click="handleTestConnection">
                      Simulate finalize
                    </Button>
                    <Button v-if="invoice.status === 'sync_failed'" variant="ghost" size="sm" class="h-6 text-[11px]" @click="handleRetry(invoice)">
                      <Icon name="i-lucide-rotate-cw" class="mr-1 h-3 w-3" />Retry
                    </Button>
                    <Button v-if="invoice.status === 'open_in_lexware' || invoice.status === 'draft_created' || invoice.status === 'paid'" variant="ghost" size="sm" class="h-6 text-[11px] text-red-700 hover:text-red-700" @click="handleCancelAndIssueCreditNote(invoice)">
                      <Icon name="i-lucide-file-minus-2" class="mr-1 h-3 w-3" />Cancel
                    </Button>
                  </div>
                </td>
              </tr>
              <tr v-if="filteredDraftInvoices.length === 0">
                <td colspan="7" class="px-3 py-12 text-center text-sm text-muted-foreground">
                  No invoices yet — checkout on an EUR-denominated listing will create a draft automatically.
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <DialogFooter class="mt-3">
          <Button variant="ghost" @click="showDraftInvoicesDialog = false">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Exceptions dialog (needs_mapping + sync_failed + non-eligible digest) -->
    <Dialog :open="showExceptionsDialog" @update:open="showExceptionsDialog = $event">
      <DialogContent class="!max-w-4xl">
        <DialogHeader>
          <DialogTitle>Exceptions &amp; Non-Eligible Digest</DialogTitle>
          <DialogDescription>
            Bookings that need attention: tax rate mismatches, sync failures, and non-EUR listings.
          </DialogDescription>
        </DialogHeader>

        <div class="flex flex-col gap-5">
          <div>
            <div class="mb-2 flex items-center justify-between">
              <p class="text-sm font-medium">
                Held in "Needs mapping" or "Sync failed"
              </p>
              <Badge variant="secondary" class="tabular-nums">
                {{ exceptionInvoices.length }}
              </Badge>
            </div>
            <div class="rounded-md border">
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b bg-muted/40">
                    <th class="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                      Listing
                    </th>
                    <th class="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                      Guest
                    </th>
                    <th class="px-3 py-2 text-right text-xs font-medium text-muted-foreground">
                      Total
                    </th>
                    <th class="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                      Reason
                    </th>
                    <th class="px-3 py-2 text-right text-xs font-medium text-muted-foreground">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y">
                  <tr v-for="invoice in exceptionInvoices" :key="invoice.id">
                    <td class="px-3 py-2 text-xs">
                      {{ invoice.listingName }}
                    </td>
                    <td class="px-3 py-2 text-xs">
                      {{ invoice.guestName }}
                    </td>
                    <td class="px-3 py-2 text-xs text-right tabular-nums">
                      {{ formatAccounting(invoice.totalAmount) }}
                    </td>
                    <td class="px-3 py-2 text-xs">
                      <span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium" :class="statusToneClass(invoice.status)">
                        {{ statusLabel(invoice.status) }}
                      </span>
                      <div class="mt-1 text-[10px] text-muted-foreground max-w-[280px]">
                        {{ invoice.needsMappingReason || invoice.failureReason }}
                      </div>
                    </td>
                    <td class="px-3 py-2 text-xs text-right">
                      <Button v-if="invoice.status === 'sync_failed'" variant="ghost" size="sm" class="h-6 text-[11px]" @click="handleRetry(invoice)">
                        Retry
                      </Button>
                      <span v-else class="text-[10px] text-muted-foreground">Finance to remap</span>
                    </td>
                  </tr>
                  <tr v-if="exceptionInvoices.length === 0">
                    <td colspan="5" class="px-3 py-6 text-center text-xs text-muted-foreground">
                      No exceptions — every active invoice is eligible and synced.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <div class="mb-2 flex items-center justify-between">
              <p class="text-sm font-medium">
                Non-eligible this week (currency filter)
              </p>
              <Badge variant="secondary" class="tabular-nums">
                {{ nonEligibleCount }}
              </Badge>
            </div>
            <div class="rounded-md border">
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b bg-muted/40">
                    <th class="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                      Listing
                    </th>
                    <th class="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                      Check-in
                    </th>
                    <th class="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                      Currency
                    </th>
                    <th class="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                      Reason
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y">
                  <tr v-for="(item, i) in nonEligibleDigest" :key="i">
                    <td class="px-3 py-2 text-xs">
                      {{ item.listingName }}
                    </td>
                    <td class="px-3 py-2 text-xs font-mono">
                      {{ item.checkIn }}
                    </td>
                    <td class="px-3 py-2 text-xs">
                      <Badge variant="outline" class="font-mono">
                        {{ item.currency }}
                      </Badge>
                    </td>
                    <td class="px-3 py-2 text-xs text-muted-foreground">
                      {{ item.reason }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <DialogFooter class="mt-4">
          <Button variant="ghost" @click="showExceptionsDialog = false">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Sync history dialog -->
    <Dialog :open="showSyncHistoryDialog" @update:open="showSyncHistoryDialog = $event">
      <DialogContent class="!max-w-4xl">
        <DialogHeader>
          <DialogTitle>Sync History</DialogTitle>
          <DialogDescription>
            All invoices created in Lexware, in reverse chronological order. Read-only mirror.
          </DialogDescription>
        </DialogHeader>
        <div class="max-h-[440px] overflow-y-auto rounded-md border">
          <table class="w-full text-sm">
            <thead class="sticky top-0 z-10 bg-popover">
              <tr class="border-b">
                <th class="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                  Lexware ID
                </th>
                <th class="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                  Listing
                </th>
                <th class="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                  Guest
                </th>
                <th class="px-3 py-2 text-right text-xs font-medium text-muted-foreground">
                  Total
                </th>
                <th class="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                  Status
                </th>
                <th class="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                  Created
                </th>
              </tr>
            </thead>
            <tbody class="divide-y">
              <tr v-for="invoice in syncHistory" :key="invoice.id">
                <td class="px-3 py-2 text-xs font-mono">
                  {{ invoice.lexwareInvoiceId }}
                </td>
                <td class="px-3 py-2 text-xs">
                  {{ invoice.listingName }}
                </td>
                <td class="px-3 py-2 text-xs">
                  {{ invoice.guestName }}
                </td>
                <td class="px-3 py-2 text-xs text-right tabular-nums font-medium">
                  {{ formatAccounting(invoice.totalAmount) }}
                </td>
                <td class="px-3 py-2 text-xs">
                  <span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium" :class="statusToneClass(invoice.status)">
                    {{ statusLabel(invoice.status) }}
                  </span>
                </td>
                <td class="px-3 py-2 text-xs text-muted-foreground">
                  {{ new Date(invoice.createdAt).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }) }}
                </td>
              </tr>
              <tr v-if="syncHistory.length === 0">
                <td colspan="6" class="px-3 py-12 text-center text-sm text-muted-foreground">
                  No invoices created yet.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <DialogFooter class="mt-3">
          <Button variant="ghost" @click="showSyncHistoryDialog = false">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Bulk historical sync confirm -->
    <AlertDialog :open="showBulkSyncDialog" @update:open="showBulkSyncDialog = $event">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Bulk historical sync</AlertDialogTitle>
          <AlertDialogDescription as="div" class="flex flex-col gap-3">
            <p>This will push 50 historical EUR-denominated bookings to Lexware as drafts. Requests are throttled to 2/sec (Lexware rate limit) — expect ~25 seconds total.</p>
            <p class="text-xs text-muted-foreground">
              This is a one-time backfill. Drafts will land in Lexware's <span class="font-mono">voucherStatus: draft</span> state — finalize inside Lexware as usual.
            </p>
            <div v-if="isBulkSyncing" class="flex flex-col gap-1">
              <div class="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div class="h-full bg-primary transition-all" :style="{ width: `${bulkSyncProgress}%` }" />
              </div>
              <p class="text-xs text-muted-foreground">
                Syncing… {{ bulkSyncProgress }}%
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel :disabled="isBulkSyncing">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction :disabled="isBulkSyncing" @click="handleStartBulkSync">
            <Icon v-if="isBulkSyncing" name="i-lucide-loader-2" class="mr-2 h-3.5 w-3.5 animate-spin" />
            {{ isBulkSyncing ? 'Syncing…' : 'Start sync' }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <!-- How sync works info -->
    <Dialog :open="showHealthDetailsDialog" @update:open="showHealthDetailsDialog = $event">
      <DialogContent class="!max-w-2xl">
        <DialogHeader>
          <DialogTitle>How Lexware sync works</DialogTitle>
          <DialogDescription>
            Flow summary for the integration.
          </DialogDescription>
        </DialogHeader>
        <div class="space-y-3 text-sm">
          <div class="rounded-md border bg-muted/30 p-3">
            <p class="font-medium">
              1. Checkout → Draft invoice
            </p>
            <p class="mt-0.5 text-xs text-muted-foreground">
              When a booking on a EUR-denominated listing is finalized, Elev8 creates a draft invoice in Lexware (always <span class="font-mono">voucherStatus: draft</span>). Hosts finalize inside Lexware.
            </p>
          </div>
          <div class="rounded-md border bg-muted/30 p-3">
            <p class="font-medium">
              2. Webhook → Open / Paid
            </p>
            <p class="mt-0.5 text-xs text-muted-foreground">
              Elev8 subscribes to <span class="font-mono">invoice.changed</span> and <span class="font-mono">contact.changed</span> to track each invoice's status. Payments are read-only.
            </p>
          </div>
          <div class="rounded-md border bg-muted/30 p-3">
            <p class="font-medium">
              3. Cancellation → Auto credit note
            </p>
            <p class="mt-0.5 text-xs text-muted-foreground">
              Cancelled bookings automatically generate a credit note in Lexware referencing the original invoice. Finance is notified when the credit note is created.
            </p>
          </div>
          <div class="rounded-md border bg-muted/30 p-3">
            <p class="font-medium">
              4. Health checks
            </p>
            <p class="mt-0.5 text-xs text-muted-foreground">
              Scheduled health checks ping Lexware. A 401/403 or missing webhook subscription flips the connection to "Needs attention" and notifies the Admin.
            </p>
          </div>
        </div>
        <DialogFooter class="mt-4">
          <Button variant="ghost" @click="showHealthDetailsDialog = false">
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
