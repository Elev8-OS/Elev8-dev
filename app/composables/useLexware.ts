import type { LexwareInvoice, LexwareInvoiceLineItem, LexwareInvoiceStatus } from '@/components/finance/data/lexware-invoices'
import type { ReservationEntry } from '@/components/finance/data/revenue'
import { computed, ref } from 'vue'
import { getEurListings, mockLexwareInvoices } from '@/components/finance/data/lexware-invoices'
import { listings } from '@/components/listings/data/listings'
import { useListingMappings } from '@/composables/useListingMappings'
import { useNotifications } from '@/composables/useNotifications'
import { useReservations } from '@/composables/useReservations'

export type LexwareConnectionStatus = 'connected' | 'needs_attention' | 'disconnected'
export type LexwareStep = 'connect' | 'mapping' | 'connected'

export interface LexwareConnectionHealth {
  status: LexwareConnectionStatus
  lastCheckedAt: string | null
  failedReason: string | null
  webhookSubscriptions: string[]
}

// Mirrors the 2 req/sec Lexware rate-limit (token-bucket enforced).
const RATE_LIMIT_PER_SECOND = 2
const RATE_LIMIT_INTERVAL_MS = 1000 / RATE_LIMIT_PER_SECOND

export function useLexware() {
  const isConnected = useState<boolean>('lexware-connected', () => false)
  const needsAttention = useState<boolean>('lexware-needs-attention', () => false)
  const step = useState<LexwareStep>('lexware-step', () => 'connect')
  const apiKey = useState<string>('lexware-api-key', () => '')
  const apiKeyInput = ref('')
  const companyName = useState<string>('lexware-company', () => '')
  const lastConnected = useState<string | null>('lexware-last-connected', () => null)
  const isSaving = ref(false)
  const isTesting = ref(false)
  const isBulkSyncing = ref(false)
  const bulkSyncProgress = ref(0)

  const health = useState<LexwareConnectionHealth>('lexware-health', () => ({
    status: 'disconnected',
    lastCheckedAt: null,
    failedReason: null,
    webhookSubscriptions: [],
  }))

  const invoices = useState<LexwareInvoice[]>('lexware-invoices', () => JSON.parse(JSON.stringify(mockLexwareInvoices)))

  const { setMapping, clearMapping, getMappingFor } = useListingMappings()
  const { createLexwareAlert } = useNotifications()
  const { reservations, markSyncedToLexware } = useReservations()

  // ── EUR-only eligibility gate (Rule 1) ─────────────────────────────────
  // Derived from the real listings store (tags include 'EUR') — lst-20…lst-24.
  const eurListings = getEurListings()

  // Lookup listing by display name — ReservationEntry.listing is a name, not an id.
  const listingByName = new Map(listings.value.map(l => [l.name, l]))

  function isEurListing(listingName: string): boolean {
    return listingByName.get(listingName)?.tags.includes('EUR') ?? false
  }

  function isEligible(res: ReservationEntry): boolean {
    return res.currency === 'EUR' && isEurListing(res.listing)
  }

  // Reservations ready to push (EUR + EUR listing + not yet synced to Lexware).
  const eligibleUnsyncedReservations = computed(() =>
    reservations.value.filter(r => isEligible(r) && !r.syncedToLexware),
  )

  // Non-EUR / non-eligible bookings surfaced as a digest (Rule 1).
  const nonEligibleDigest = computed(() =>
    reservations.value
      .filter(r => !isEligible(r) && r.currency !== 'EUR')
      .map(r => ({
        listingName: r.listing,
        checkIn: r.checkIn,
        currency: r.currency,
        reason: `Listing currency is ${r.currency} — not eligible for Lexware export.`,
      })),
  )

  // ── Locale / currency helpers ──────────────────────────────────────────
  const accountingCurrency = 'EUR'

  function formatAccounting(amount: number): string {
    return `EUR ${amount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  // ── Connection lifecycle ───────────────────────────────────────────────
  async function connect(key: string) {
    isSaving.value = true
    await new Promise(r => setTimeout(r, 1200))
    apiKey.value = key.replace(/.(?=.{4})/g, '•')
    apiKeyInput.value = ''
    companyName.value = 'Elev8 Suite DACH GmbH'
    lastConnected.value = new Date().toISOString().slice(0, 10)
    isConnected.value = true
    needsAttention.value = false
    step.value = 'mapping'
    health.value = {
      status: 'connected',
      lastCheckedAt: new Date().toISOString(),
      failedReason: null,
      webhookSubscriptions: ['contact.changed', 'invoice.changed'],
    }
    isSaving.value = false
  }

  async function testConnection(): Promise<boolean> {
    isTesting.value = true
    await new Promise(r => setTimeout(r, 1000))
    isTesting.value = false
    return isConnected.value
  }

  function disconnect() {
    isConnected.value = false
    needsAttention.value = false
    step.value = 'connect'
    apiKey.value = ''
    companyName.value = ''
    lastConnected.value = null
    health.value = {
      status: 'disconnected',
      lastCheckedAt: null,
      failedReason: null,
      webhookSubscriptions: [],
    }
  }

  // Reconnect after "Needs attention" — same surface as connect().
  async function reconnect(key: string) {
    await connect(key)
    needsAttention.value = false
    health.value = {
      ...health.value,
      status: 'connected',
      failedReason: null,
      lastCheckedAt: new Date().toISOString(),
      webhookSubscriptions: ['contact.changed', 'invoice.changed'],
    }
  }

  // Scheduled health-check (Rule 6 / Flow C). In production this is a server
  // job; in the mock we let the UI trigger it manually.
  async function runHealthCheck(): Promise<LexwareConnectionHealth> {
    if (!isConnected.value) {
      health.value = { ...health.value, status: 'disconnected', lastCheckedAt: new Date().toISOString() }
      return health.value
    }
    await new Promise(r => setTimeout(r, 800))
    // In the mock we flip to "needs_attention" only if the UI explicitly marks it;
    // otherwise we stay connected.
    health.value = { ...health.value, status: isConnected.value && !needsAttention.value ? 'connected' : 'needs_attention', lastCheckedAt: new Date().toISOString() }
    return health.value
  }

  function flagNeedsAttention(reason: string) {
    needsAttention.value = true
    health.value = {
      ...health.value,
      status: 'needs_attention',
      failedReason: reason,
      lastCheckedAt: new Date().toISOString(),
    }
    createLexwareAlert('LEXWARE_CONNECTION_NEEDS_ATTENTION', { failed_reason: reason })
  }

  function clearNeedsAttention() {
    needsAttention.value = false
    health.value = {
      ...health.value,
      status: isConnected.value ? 'connected' : 'disconnected',
      failedReason: null,
      lastCheckedAt: new Date().toISOString(),
    }
  }

  // ── Invoice pipeline (Rule 2: draft-only creation) ─────────────────────
  function findInvoice(id: string) {
    return invoices.value.find(i => i.id === id) ?? null
  }

  function findInvoiceByReservation(reservationId: string) {
    return invoices.value.find(i => i.reservationId === reservationId) ?? null
  }

  async function createDraftInvoice(input: {
    reservationId: string
    listingId: string
    listingName: string
    guestName: string
    guestEmail: string
    lineItems: LexwareInvoiceLineItem[]
  }): Promise<{ success: true, invoice: LexwareInvoice } | { success: false, error: string, status: LexwareInvoiceStatus }> {
    // Rule 3: tax rate must be 0%, 7%, or 19% — otherwise hold in "Needs mapping".
    const unmappable = input.lineItems.find(li => ![0, 7, 19].includes(li.vatRate))
    if (unmappable) {
      const invoice: LexwareInvoice = {
        id: `lex-inv-${Date.now()}`,
        lexwareInvoiceId: null,
        reservationId: input.reservationId,
        listingId: input.listingId,
        listingName: input.listingName,
        guestName: input.guestName,
        guestEmail: input.guestEmail,
        currency: 'EUR',
        totalAmount: input.lineItems.reduce((sum, li) => sum + (li.quantity * li.unitPrice), 0),
        status: 'needs_mapping',
        lineItems: input.lineItems,
        createdAt: new Date().toISOString(),
        finalizedAt: null,
        paidAt: null,
        cancelledAt: null,
        creditNoteId: null,
        needsMappingReason: `Line item tax rate ${unmappable.vatRate}% does not match Lexware-allowed bands (0%, 7%, 19%).`,
      }
      invoices.value = [invoice, ...invoices.value]
      createLexwareAlert('LEXWARE_TAX_MAPPING_HOLD', {
        listing_name: input.listingName,
        guest_name: input.guestName,
        observed_vat: unmappable.vatRate,
      })
      return { success: false, error: invoice.needsMappingReason ?? 'Tax rate not in Lexware bands', status: 'needs_mapping' }
    }

    // Connection guard (Rule 6 / Flow C).
    if (needsAttention.value || !isConnected.value) {
      const invoice: LexwareInvoice = {
        id: `lex-inv-${Date.now()}`,
        lexwareInvoiceId: null,
        reservationId: input.reservationId,
        listingId: input.listingId,
        listingName: input.listingName,
        guestName: input.guestName,
        guestEmail: input.guestEmail,
        currency: 'EUR',
        totalAmount: input.lineItems.reduce((sum, li) => sum + (li.quantity * li.unitPrice), 0),
        status: 'sync_failed',
        lineItems: input.lineItems,
        createdAt: new Date().toISOString(),
        finalizedAt: null,
        paidAt: null,
        cancelledAt: null,
        creditNoteId: null,
        failureReason: 'Connection lost before request reached Lexware. Retry queued.',
      }
      invoices.value = [invoice, ...invoices.value]
      return { success: false, error: invoice.failureReason ?? 'Connection lost', status: 'sync_failed' }
    }

    await new Promise(r => setTimeout(r, 700))
    const invoice: LexwareInvoice = {
      id: `lex-inv-${Date.now()}`,
      lexwareInvoiceId: `LS-2026-${String(Math.floor(Math.random() * 9000) + 1000)}`,
      reservationId: input.reservationId,
      listingId: input.listingId,
      listingName: input.listingName,
      guestName: input.guestName,
      guestEmail: input.guestEmail,
      currency: 'EUR',
      totalAmount: input.lineItems.reduce((sum, li) => sum + (li.quantity * li.unitPrice), 0),
      status: 'draft_created',
      lineItems: input.lineItems,
      createdAt: new Date().toISOString(),
      finalizedAt: null,
      paidAt: null,
      cancelledAt: null,
      creditNoteId: null,
    }
    invoices.value = [invoice, ...invoices.value]
    createLexwareAlert('LEXWARE_DRAFT_INVOICE_READY', {
      listing_name: input.listingName,
      guest_name: input.guestName,
      invoiceId: invoice.lexwareInvoiceId,
    })
    return { success: true, invoice }
  }

  // Simulate the invoice.changed webhook (host finalized inside Lexware).
  function markFinalized(id: string) {
    invoices.value = invoices.value.map(i => i.id === id && i.status === 'draft_created'
      ? { ...i, status: 'open_in_lexware', finalizedAt: new Date().toISOString() }
      : i)
  }

  function markPaid(id: string) {
    invoices.value = invoices.value.map(i => i.id === id && (i.status === 'open_in_lexware' || i.status === 'draft_created')
      ? { ...i, status: 'paid', paidAt: new Date().toISOString() }
      : i)
  }

  // Rule 6: automatic credit note on cancellation.
  async function issueCreditNoteForCancellation(id: string) {
    const target = findInvoice(id)
    if (!target)
      return
    if (target.status === 'credit_note_created')
      return
    await new Promise(r => setTimeout(r, 600))
    const creditNoteId = `LS-2026-${String(Math.floor(Math.random() * 9000) + 1000)}`
    invoices.value = invoices.value.map(i => i.id === id
      ? { ...i, status: 'credit_note_created', cancelledAt: new Date().toISOString(), creditNoteId }
      : i)
    createLexwareAlert('LEXWARE_CREDIT_NOTE_CREATED', {
      guest_name: target.guestName,
      invoiceId: target.lexwareInvoiceId,
      creditNoteId,
    })
  }

  // Retry a sync_failed invoice (used after the Admin reconnects).
  async function retryFailedInvoice(id: string): Promise<{ success: boolean }> {
    const target = findInvoice(id)
    if (!target || target.status !== 'sync_failed')
      return { success: false }
    if (needsAttention.value)
      return { success: false }
    await new Promise(r => setTimeout(r, 700))
    invoices.value = invoices.value.map(i => i.id === id
      ? {
          ...i,
          status: 'draft_created',
          lexwareInvoiceId: `LS-2026-${String(Math.floor(Math.random() * 9000) + 1000)}`,
          failureReason: undefined,
        }
      : i)
    return { success: true }
  }

  // ── Bulk historical sync (Rule 7, throttled to 2 req/sec) ─────────────
  async function startBulkHistoricalSync(payments: Array<{
    reservationId: string
    listingId: string
    listingName: string
    guestName: string
    guestEmail: string
    lineItems: LexwareInvoiceLineItem[]
  }>): Promise<{ pushed: number, throttled: true }> {
    if (isBulkSyncing.value)
      return { pushed: 0, throttled: true }
    if (!isConnected.value || needsAttention.value)
      return { pushed: 0, throttled: true }
    isBulkSyncing.value = true
    bulkSyncProgress.value = 0
    let pushed = 0
    const total = payments.length
    for (const payment of payments) {
      const result = await createDraftInvoice(payment)
      if (result.success)
        pushed += 1
      bulkSyncProgress.value = Math.round(((pushed + (total - pushed - 1)) / total) * 100)
      // Token-bucket throttle: 2 requests/sec.
      await new Promise(r => setTimeout(r, RATE_LIMIT_INTERVAL_MS))
    }
    bulkSyncProgress.value = 100
    isBulkSyncing.value = false
    return { pushed, throttled: true }
  }

  // ── Real-data line items (pricing from listings store) ─────────────────
  function buildLineItems(res: ReservationEntry, listing: { pricing: { nightlyRate: number, cleaningFee: number, serviceFee: number } }): LexwareInvoiceLineItem[] {
    const accommodation = listing.pricing.nightlyRate * res.nights
    const cleaningFee = listing.pricing.cleaningFee
    const platformFee = listing.pricing.serviceFee
    const sum = accommodation + cleaningFee + platformFee
    // If the breakdown doesn't reconcile with the booking total, fall back to a
    // single Accommodation line so the Lexware invoice total always matches.
    if (Math.abs(sum - res.amount) > 0.01) {
      return [{
        category: 'Accommodation',
        description: `${res.nights} nights accommodation`,
        quantity: res.nights,
        unitPrice: res.amount / res.nights,
        vatRate: 7,
        postingAccountId: 'la-8210',
      }]
    }
    const items: LexwareInvoiceLineItem[] = [
      {
        category: 'Accommodation',
        description: `${res.nights} nights accommodation`,
        quantity: res.nights,
        unitPrice: listing.pricing.nightlyRate,
        vatRate: 7,
        postingAccountId: 'la-8210',
      },
      {
        category: 'CleaningFee',
        description: 'Final cleaning',
        quantity: 1,
        unitPrice: listing.pricing.cleaningFee,
        vatRate: 19,
        postingAccountId: 'la-8300',
      },
    ]
    if (listing.pricing.serviceFee > 0) {
      items.push({
        category: 'PlatformFee',
        description: 'OTA platform fee',
        quantity: 1,
        unitPrice: listing.pricing.serviceFee,
        vatRate: 0,
        postingAccountId: 'la-4500',
      })
    }
    return items
  }

  // ── Push eligible EUR reservations to Lexware (real-flow pipeline) ─────
  const isPushingLexware = ref(false)
  async function pushEligibleReservations(): Promise<{ pushed: number, skipped: number }> {
    const eligible = eligibleUnsyncedReservations.value
    if (eligible.length === 0)
      return { pushed: 0, skipped: 0 }
    if (!isConnected.value || needsAttention.value)
      return { pushed: 0, skipped: eligible.length }
    isPushingLexware.value = true
    let pushed = 0
    for (const res of eligible) {
      const listing = listingByName.get(res.listing)
      if (!listing)
        continue
      const result = await createDraftInvoice({
        reservationId: res.id,
        listingId: listing.id,
        listingName: listing.name,
        guestName: res.guest,
        guestEmail: '',
        lineItems: buildLineItems(res, listing),
      })
      if (result.success) {
        pushed += 1
        markSyncedToLexware(res.id, res.checkIn)
      }
      // Token-bucket throttle: 2 requests/sec.
      await new Promise(r => setTimeout(r, RATE_LIMIT_INTERVAL_MS))
    }
    isPushingLexware.value = false
    return { pushed, skipped: eligible.length - pushed }
  }

  // ── Mapping edit (Rule 5: editable, applied prospectively) ─────────────
  function confirmMapping() {
    step.value = 'connected'
  }

  function editMapping() {
    step.value = 'mapping'
  }

  // ── Computed helpers ───────────────────────────────────────────────────
  const eurListingsCount = computed(() => eurListings.length)
  const lexwareDraftReadyCount = computed(() => eligibleUnsyncedReservations.value.length)
  const draftCount = computed(() => invoices.value.filter(i => i.status === 'draft_created').length)
  const openCount = computed(() => invoices.value.filter(i => i.status === 'open_in_lexware').length)
  const paidCount = computed(() => invoices.value.filter(i => i.status === 'paid').length)
  const creditNoteCount = computed(() => invoices.value.filter(i => i.status === 'credit_note_created').length)
  const syncFailedCount = computed(() => invoices.value.filter(i => i.status === 'sync_failed').length)
  const needsMappingCount = computed(() => invoices.value.filter(i => i.status === 'needs_mapping').length)
  const nonEligibleCount = computed(() => nonEligibleDigest.value.length)

  const totalSyncedEur = computed(() =>
    invoices.value
      .filter(i => i.status === 'paid' || i.status === 'open_in_lexware')
      .reduce((sum, i) => sum + i.totalAmount, 0),
  )

  const draftInvoices = computed(() => invoices.value.filter(i => i.status === 'draft_created'))
  const exceptionInvoices = computed(() =>
    invoices.value.filter(i => i.status === 'needs_mapping' || i.status === 'sync_failed'),
  )
  const syncHistory = computed(() => invoices.value.filter(i => i.lexwareInvoiceId !== null))

  function isMapped(listingName: string): boolean {
    return getMappingFor(listingName)?.integration === 'lexware'
  }

  function setLexwareMapping(listingName: string, tag: string) {
    setMapping(listingName, 'lexware', tag)
  }

  function clearLexwareMapping(listingName: string) {
    clearMapping(listingName)
  }

  return {
    // connection
    isConnected,
    needsAttention,
    step,
    apiKey,
    apiKeyInput,
    companyName,
    lastConnected,
    isSaving,
    isTesting,
    isBulkSyncing,
    bulkSyncProgress,
    health,
    connect,
    testConnection,
    disconnect,
    reconnect,
    runHealthCheck,
    flagNeedsAttention,
    clearNeedsAttention,
    // invoices
    invoices,
    draftInvoices,
    exceptionInvoices,
    syncHistory,
    findInvoice,
    findInvoiceByReservation,
    createDraftInvoice,
    markFinalized,
    markPaid,
    issueCreditNoteForCancellation,
    retryFailedInvoice,
    startBulkHistoricalSync,
    // real-data pipeline
    eligibleUnsyncedReservations,
    pushEligibleReservations,
    isPushingLexware,
    buildLineItems,
    isEligible,
    // mapping
    confirmMapping,
    editMapping,
    // stats
    eurListings,
    eurListingsCount,
    lexwareDraftReadyCount,
    draftCount,
    openCount,
    paidCount,
    creditNoteCount,
    syncFailedCount,
    needsMappingCount,
    nonEligibleCount,
    totalSyncedEur,
    nonEligibleDigest,
    // helpers
    isMapped,
    setLexwareMapping,
    clearLexwareMapping,
    accountingCurrency,
    formatAccounting,
  }
}
