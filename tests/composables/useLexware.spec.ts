import { describe, expect, it } from 'vitest'
import { useLexware } from '~/composables/useLexware'

describe('useLexware — connection lifecycle', () => {
  it('starts disconnected with healthy state', () => {
    const { isConnected, needsAttention, health, step } = useLexware()
    expect(isConnected.value).toBe(false)
    expect(needsAttention.value).toBe(false)
    expect(step.value).toBe('connect')
    expect(health.value.status).toBe('disconnected')
    expect(health.value.webhookSubscriptions).toEqual([])
  })

  it('connect mints a masked API key, seeds company name, and flips health to connected', async () => {
    const { connect, isConnected, apiKey, companyName, lastConnected, health, step } = useLexware()
    await connect('lx-secret-key-1234567890')
    expect(apiKey.value).toMatch(/^•+7890$/u)
    expect(apiKey.value.length).toBe('lx-secret-key-1234567890'.length)
    expect(companyName.value).toBe('Elev8 Suite DACH GmbH')
    expect(lastConnected.value).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(isConnected.value).toBe(true)
    expect(health.value.status).toBe('connected')
    expect(health.value.webhookSubscriptions).toEqual(['contact.changed', 'invoice.changed'])
    expect(step.value).toBe('mapping')
  })

  it('disconnect wipes API key, company, health, and step', async () => {
    const { connect, disconnect, isConnected, apiKey, companyName, health, step } = useLexware()
    await connect('lx-initial')
    expect(isConnected.value).toBe(true)
    disconnect()
    expect(isConnected.value).toBe(false)
    expect(apiKey.value).toBe('')
    expect(companyName.value).toBe('')
    expect(health.value.status).toBe('disconnected')
    expect(health.value.webhookSubscriptions).toEqual([])
    expect(step.value).toBe('connect')
  })

  it('reconnect clears a prior needs-attention flag', async () => {
    const { connect, reconnect, flagNeedsAttention, needsAttention, health } = useLexware()
    await connect('lx-initial-2')
    flagNeedsAttention('API key rejected')
    expect(needsAttention.value).toBe(true)
    expect(health.value.status).toBe('needs_attention')
    await reconnect('lx-rotated-key')
    expect(needsAttention.value).toBe(false)
    expect(health.value.status).toBe('connected')
  })

  it('flagNeedsAttention + clearNeedsAttention flip health status', () => {
    const { flagNeedsAttention, clearNeedsAttention, needsAttention, health, isConnected } = useLexware()
    expect(isConnected.value).toBe(false)
    flagNeedsAttention('Webhook subscription missing')
    expect(needsAttention.value).toBe(true)
    expect(health.value.status).toBe('needs_attention')
    expect(health.value.failedReason).toBe('Webhook subscription missing')
    clearNeedsAttention()
    expect(needsAttention.value).toBe(false)
    expect(health.value.failedReason).toBeNull()
  })

  it('runHealthCheck returns the current health snapshot', async () => {
    const { connect, runHealthCheck, health } = useLexware()
    await connect('lx-test')
    const result = await runHealthCheck()
    expect(result.lastCheckedAt).not.toBeNull()
    expect(health.value.status).toBe('connected')
  })
})

describe('useLexware — draft invoice pipeline (Rule 2 / Rule 3)', () => {
  const sampleInput = {
    reservationId: 'res-test-1',
    listingId: 'lst-villa-luwa',
    listingName: 'Villa Luwa – Hügellage Brandenburg',
    guestName: 'Erik Hoffmann',
    guestEmail: 'erik@example.de',
    lineItems: [
      { category: 'Accommodation' as const, description: '3 nights', quantity: 3, unitPrice: 220, vatRate: 7 as const, postingAccountId: 'la-8210' },
      { category: 'CleaningFee' as const, description: 'Cleaning', quantity: 1, unitPrice: 90, vatRate: 19 as const, postingAccountId: 'la-8300' },
    ],
  }

  it('createDraftInvoice returns a draft invoice with a Lexware ID when connected', async () => {
    const { connect, createDraftInvoice, invoices, draftCount } = useLexware()
    await connect('lx-conn')
    const before = invoices.value.length
    const result = await createDraftInvoice(sampleInput)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.invoice.status).toBe('draft_created')
      expect(result.invoice.lexwareInvoiceId).toMatch(/^LS-2026-/)
      expect(result.invoice.totalAmount).toBe(3 * 220 + 1 * 90)
    }
    expect(invoices.value.length).toBe(before + 1)
    expect(draftCount.value).toBeGreaterThanOrEqual(1)
  })

  it('createDraftInvoice holds an invoice in needs_mapping when VAT rate is not 0/7/19', async () => {
    const { connect, createDraftInvoice, needsMappingCount } = useLexware()
    await connect('lx-conn-2')
    const result = await createDraftInvoice({
      ...sampleInput,
      lineItems: [
        { category: 'Accommodation' as const, description: '3 nights', quantity: 3, unitPrice: 220, vatRate: 16, postingAccountId: 'la-8210' },
      ],
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.status).toBe('needs_mapping')
      expect(result.error).toMatch(/16%/)
    }
    expect(needsMappingCount.value).toBeGreaterThanOrEqual(1)
  })

  it('createDraftInvoice returns sync_failed when connection needs attention', async () => {
    const { connect, flagNeedsAttention, createDraftInvoice, syncFailedCount } = useLexware()
    await connect('lx-conn-3')
    flagNeedsAttention('API key revoked')
    const result = await createDraftInvoice(sampleInput)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.status).toBe('sync_failed')
    }
    expect(syncFailedCount.value).toBeGreaterThanOrEqual(1)
  })

  it('markFinalized transitions draft to open_in_lexware', async () => {
    const { connect, createDraftInvoice, markFinalized } = useLexware()
    await connect('lx-conn-4')
    const result = await createDraftInvoice(sampleInput)
    if (!result.success)
      throw new Error('expected success')
    markFinalized(result.invoice.id)
    const updated = useLexware().findInvoice(result.invoice.id)
    expect(updated?.status).toBe('open_in_lexware')
    expect(updated?.finalizedAt).not.toBeNull()
  })

  it('markPaid transitions to paid', async () => {
    const { connect, createDraftInvoice, markPaid } = useLexware()
    await connect('lx-conn-5')
    const result = await createDraftInvoice(sampleInput)
    if (!result.success)
      throw new Error('expected success')
    markPaid(result.invoice.id)
    const updated = useLexware().findInvoice(result.invoice.id)
    expect(updated?.status).toBe('paid')
    expect(updated?.paidAt).not.toBeNull()
  })

  it('createDraftInvoice without an active connection is rejected', async () => {
    const { createDraftInvoice } = useLexware()
    const result = await createDraftInvoice(sampleInput)
    expect(result.success).toBe(false)
  })
})

describe('useLexware — credit notes on cancellation (Rule 6)', () => {
  it('issueCreditNoteForCancellation flips status to credit_note_created and stores creditNoteId', async () => {
    const { connect, createDraftInvoice, issueCreditNoteForCancellation, creditNoteCount } = useLexware()
    await connect('lx-conn-6')
    const result = await createDraftInvoice({
      reservationId: 'res-credit-test',
      listingId: 'lst-villa-sehnsucht',
      listingName: 'Villa Sehnsucht',
      guestName: 'Anna Brunner',
      guestEmail: 'anna@example.de',
      lineItems: [
        { category: 'Accommodation' as const, description: '2 nights', quantity: 2, unitPrice: 280, vatRate: 7, postingAccountId: 'la-8210' },
      ],
    })
    if (!result.success)
      throw new Error('expected success')
    await issueCreditNoteForCancellation(result.invoice.id)
    const updated = useLexware().findInvoice(result.invoice.id)
    expect(updated?.status).toBe('credit_note_created')
    expect(updated?.creditNoteId).toMatch(/^LS-2026-/)
    expect(updated?.cancelledAt).not.toBeNull()
    expect(creditNoteCount.value).toBeGreaterThanOrEqual(1)
  })

  it('issueCreditNoteForCancellation is idempotent', async () => {
    const { connect, createDraftInvoice, issueCreditNoteForCancellation } = useLexware()
    await connect('lx-conn-7')
    const result = await createDraftInvoice({
      reservationId: 'res-credit-2',
      listingId: 'lst-villa-bergfried',
      listingName: 'Villa Bergfried',
      guestName: 'Lukas Vogel',
      guestEmail: 'lukas@example.de',
      lineItems: [
        { category: 'Accommodation' as const, description: '1 night', quantity: 1, unitPrice: 260, vatRate: 7, postingAccountId: 'la-8210' },
      ],
    })
    if (!result.success)
      throw new Error('expected success')
    await issueCreditNoteForCancellation(result.invoice.id)
    const firstId = useLexware().findInvoice(result.invoice.id)?.creditNoteId
    await issueCreditNoteForCancellation(result.invoice.id)
    const secondId = useLexware().findInvoice(result.invoice.id)?.creditNoteId
    expect(secondId).toBe(firstId)
  })
})

describe('useLexware — retry / bulk sync / helpers', () => {
  it('retryFailedInvoice re-pushes a sync_failed invoice once connection is healthy', async () => {
    const { connect, flagNeedsAttention, createDraftInvoice, clearNeedsAttention, retryFailedInvoice } = useLexware()
    await connect('lx-conn-8')
    flagNeedsAttention('Issue')
    const result = await createDraftInvoice({
      reservationId: 'res-retry',
      listingId: 'lst-villa-luwa',
      listingName: 'Villa Luwa',
      guestName: 'Christina Wolf',
      guestEmail: 'c@example.de',
      lineItems: [
        { category: 'Accommodation' as const, description: '1 night', quantity: 1, unitPrice: 220, vatRate: 7, postingAccountId: 'la-8210' },
      ],
    })
    expect(result.success).toBe(false)
    if (result.success)
      throw new Error('expected failure')
    const targetId = useLexware().invoices.value.find(i => i.status === 'sync_failed')?.id
    expect(targetId).toBeDefined()
    clearNeedsAttention()
    const retry = await retryFailedInvoice(targetId!)
    expect(retry.success).toBe(true)
    const updated = useLexware().findInvoice(targetId!)
    expect(updated?.status).toBe('draft_created')
    expect(updated?.lexwareInvoiceId).toMatch(/^LS-2026-/)
    expect(updated?.failureReason).toBeUndefined()
  })

  it('startBulkHistoricalSync throttles a batch of payments at 2 req/sec and counts pushes', async () => {
    const { connect, startBulkHistoricalSync, invoices, isBulkSyncing } = useLexware()
    await connect('lx-conn-9')
    const before = invoices.value.length
    // 10 payments — each goes through the 700ms mock network call + 500ms throttle.
    // Verifies the throttle pipeline without blowing the test timeout.
    const payments = Array.from({ length: 10 }).map((_, i) => ({
      reservationId: `res-hist-${i}`,
      listingId: 'lst-villa-luwa',
      listingName: 'Villa Luwa',
      guestName: `Guest ${i}`,
      guestEmail: `g${i}@example.de`,
      lineItems: [
        { category: 'Accommodation' as const, description: '1 night', quantity: 1, unitPrice: 220, vatRate: 7 as const, postingAccountId: 'la-8210' },
      ],
    }))
    const result = await startBulkHistoricalSync(payments)
    expect(result.throttled).toBe(true)
    expect(result.pushed).toBe(10)
    expect(invoices.value.length).toBe(before + 10)
    expect(isBulkSyncing.value).toBe(false)
  }, 30_000)

  it('startBulkHistoricalSync is a no-op when disconnected', async () => {
    const { startBulkHistoricalSync } = useLexware()
    const result = await startBulkHistoricalSync([])
    expect(result.pushed).toBe(0)
  })

  it('formatAccounting renders EUR with de-DE locale', () => {
    const { formatAccounting } = useLexware()
    expect(formatAccounting(1234.5)).toBe('EUR 1.234,50')
    expect(formatAccounting(0)).toBe('EUR 0,00')
  })

  it('findInvoiceByReservation matches by reservationId', async () => {
    const { connect, createDraftInvoice, findInvoiceByReservation } = useLexware()
    await connect('lx-conn-10')
    const result = await createDraftInvoice({
      reservationId: 'res-find-1',
      listingId: 'lst-villa-luwa',
      listingName: 'Villa Luwa',
      guestName: 'Erik Hoffmann',
      guestEmail: 'e@example.de',
      lineItems: [
        { category: 'Accommodation' as const, description: '1 night', quantity: 1, unitPrice: 220, vatRate: 7, postingAccountId: 'la-8210' },
      ],
    })
    if (!result.success)
      throw new Error('expected success')
    const found = findInvoiceByReservation('res-find-1')
    expect(found?.id).toBe(result.invoice.id)
  })

  it('nonEligibleDigest exposes the daily digest of non-EUR bookings', () => {
    const { nonEligibleDigest, nonEligibleCount } = useLexware()
    expect(nonEligibleCount.value).toBe(nonEligibleDigest.value.length)
    expect(nonEligibleDigest.value.length).toBeGreaterThan(0)
  })
})

describe('useLexware — computed stats', () => {
  it('totalSyncedEur sums paid + open_in_lexware invoices', async () => {
    const { connect, createDraftInvoice, markFinalized, markPaid, totalSyncedEur } = useLexware()
    await connect('lx-conn-11')
    const a = await createDraftInvoice({
      reservationId: 'res-stat-1',
      listingId: 'lst-villa-luwa',
      listingName: 'Villa Luwa',
      guestName: 'Open',
      guestEmail: 'a@example.de',
      lineItems: [
        { category: 'Accommodation' as const, description: '1 night', quantity: 1, unitPrice: 500, vatRate: 7, postingAccountId: 'la-8210' },
      ],
    })
    const b = await createDraftInvoice({
      reservationId: 'res-stat-2',
      listingId: 'lst-villa-luwa',
      listingName: 'Villa Luwa',
      guestName: 'Paid',
      guestEmail: 'b@example.de',
      lineItems: [
        { category: 'Accommodation' as const, description: '1 night', quantity: 1, unitPrice: 800, vatRate: 7, postingAccountId: 'la-8210' },
      ],
    })
    if (!a.success || !b.success)
      throw new Error('expected success')
    markFinalized(a.invoice.id)
    markPaid(b.invoice.id)
    expect(totalSyncedEur.value).toBeGreaterThanOrEqual(1300)
  })
})
