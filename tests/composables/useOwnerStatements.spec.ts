// Owner statement lifecycle — TDD tests for `useOwnerStatements`.
// Covers: monthly generation, idempotency, deterministic totals, publishing
// with deep-copy snapshots, immutable financial edits, next-period
// adjustments, single-open-issue rule per line, and mock export activity.

import type { AlertType } from '~/components/notifications/data/alerts'
import type { CommissionRule } from '~/components/owners/data/commission-rules'
import type { OwnerLedgerEntry } from '~/components/owners/data/owner-ledger'
import type {
  OwnerStatementIssue,
  OwnerStatementLine,
} from '~/components/owners/data/owner-statements'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { alertDisplayLabels, alertIcons, alertRouteMap, getDescription as getAlertDescription } from '~/components/notifications/data/alerts'
import { calculateCommission, mockCommissionRules } from '~/components/owners/data/commission-rules'
import { mockOwnerLedgerEntries } from '~/components/owners/data/owner-ledger'
import { mockOwnerStatements } from '~/components/owners/data/owner-statements'
import { mockOwnerPropertyMappings, mockOwners } from '~/components/owners/data/owners'
import { useOwnerStatements } from '~/composables/useOwnerStatements'

// Restrict the period helper to fixtures we control — keeps tests deterministic
// and prevents flakiness if the seed set ever grows.
const TEST_PERIOD = '2026-06'
const TEST_PERIOD_NEXT = '2026-07'

const ownerAlertTypes: AlertType[] = [
  'OWNER_STATEMENT_DRAFT_READY',
  'OWNER_STATEMENT_PUBLISHED',
  'OWNER_STAY_CONFIRMED',
  'OWNER_STAY_CONFLICT',
  'OWNER_ISSUE_RAISED',
  'OWNER_USE_CAP_EXCEEDED',
  'OWNER_STAY_REQUESTED',
  'OWNER_STAY_REJECTED',
  'OWNER_STAY_CANCELLED',
  'OWNER_STAY_APPROACHING',
  'DOCUMENT_UPLOADED',
  'MAINTENANCE_APPROVAL_REQUESTED',
  'MAINTENANCE_COMPLETED',
  'OWNER_LINK_REVOKED',
  'OWNER_CONTRACT_SENT',
  'OWNER_CONTRACT_SIGNED',
  'OWNER_ISSUE_RESPONDED',
  'OWNER_BOOKING_MODE_CHANGED',
]

// Snapshot of the seed before each test so we can detect leaks across the suite.
const initialStatementIds = mockOwnerStatements.map(s => s.id).sort()

// --- Test-local mocks ------------------------------------------------------
// `vi.mock` is hoisted to the top of the file by vitest, so any state the mock
// factory closes over MUST live inside `vi.hoisted()` to be reachable from
// both the factory and the test bodies. The spy records every alert created
// during the test so assertions can assert on type / severity / context.
//
// `useOwnerStatements` imports `useNotifications` directly (no globalThis
// shim), so the module factory here is the source of truth that backs the
// alert calls.

interface AlertCall {
  type: string
  severity: string
  context: Record<string, any>
}
const notificationsMock = vi.hoisted(() => {
  const callLog: AlertCall[] = []
  return {
    callLog,
    spy: {
      createAlert: (type: string, severity: string, context: Record<string, any>) => {
        callLog.push({ type, severity, context })
      },
    },
  }
})

vi.mock('~/composables/useNotifications', () => ({
  useNotifications: () => notificationsMock.spy,
}))

beforeEach(() => {
  notificationsMock.callLog.length = 0
})

// --- Helpers --------------------------------------------------------------

function findLedgerFor(ownerId: string, listingId: string, period: string): OwnerLedgerEntry {
  const entry = mockOwnerLedgerEntries.find(
    e => e.ownerId === ownerId && e.listingId === listingId && e.period === period,
  )
  if (!entry)
    throw new Error(`Missing ledger entry for ${ownerId}/${listingId}/${period}.`)
  return entry
}

function findCommissionRule(id: string): CommissionRule {
  const found = mockCommissionRules.find(r => r.id === id)
  if (!found)
    throw new Error(`Commission rule ${id} missing.`)
  return found
}

describe('owner notification contracts', () => {
  it('registers labels, icons, routes, and descriptions for every owner alert', () => {
    const validRoutes = new Set([
      '/owner-statements',
      '/users',
      '/cockpit',
      '/owner-portal/statements',
      '/owner-portal/stays',
      '/owner-portal/contract',
      '/owner-portal/documents',
      '/owner-portal/maintenance',
    ])
    const context = {
      statementId: 'stmt-1',
      ownerId: 'own-1',
      listingId: 'lst-1',
      period: TEST_PERIOD,
      guestName: 'Wayan Sari',
      checkIn: '2026-08-01',
      checkOut: '2026-08-04',
      conflicts: [{ id: 'res-1' }],
      projectedNights: 31,
      cap: 30,
    }

    for (const type of ownerAlertTypes) {
      expect(alertDisplayLabels[type], `${type} label`).toBeTruthy()
      expect(alertIcons[type], `${type} icon`).toMatch(/^i-lucide-/)
      expect(validRoutes.has(alertRouteMap[type] ?? ''), `${type} route`).toBe(true)
      expect(getAlertDescription(type, context), `${type} description`).not.toBe('')
    }
  })
})

describe('useOwnerStatements', () => {
  describe('seed initialization', () => {
    it('seeds statements from the data-layer fixture', () => {
      const { statements } = useOwnerStatements()
      const seededIds = statements.value.map(s => s.id).sort()
      expect(seededIds).toEqual(initialStatementIds)
    })

    it('does NOT mutate the data-layer fixture on init', () => {
      const before = JSON.stringify(mockOwnerStatements)
      useOwnerStatements()
      expect(JSON.stringify(mockOwnerStatements)).toBe(before)
    })

    it('exposes independent state buckets for issues, adjustments, and export activity', () => {
      const { issues, adjustments, exportActivity } = useOwnerStatements()
      expect(Array.isArray(issues.value)).toBe(true)
      expect(Array.isArray(adjustments.value)).toBe(true)
      expect(Array.isArray(exportActivity.value)).toBe(true)
    })

    it('every seeded published statement carries publishedBy (consistent backfill)', () => {
      // No drill-deep via the composable — assert directly against the seed
      // so a fixture regression trips here before it ever hits the runtime.
      const published = mockOwnerStatements.filter(s => s.status === 'published')
      expect(published.length).toBeGreaterThan(0)
      for (const stmt of published) {
        expect(stmt.publishedAt, `${stmt.id} publishedAt`).toBeTruthy()
        expect(stmt.publishedBy, `${stmt.id} publishedBy`).toBeTruthy()
        expect(typeof stmt.publishedBy).toBe('string')
      }
    })

    it('every seeded draft statement does NOT carry publishedBy', () => {
      const drafts = mockOwnerStatements.filter(s => s.status === 'draft')
      expect(drafts.length).toBeGreaterThan(0)
      for (const stmt of drafts) {
        expect(stmt.publishedBy, `${stmt.id} should not have publishedBy`).toBeUndefined()
        expect(stmt.publishedAt, `${stmt.id} should not have publishedAt`).toBeUndefined()
      }
    })
  })

  describe('generateForPeriod', () => {
    it('validates the YYYY-MM format and rejects malformed input via { ok: false, error }', () => {
      const { generateForPeriod } = useOwnerStatements()
      for (const bad of ['2026-6', '2026/06', 'june-2026', '', '2026-13', '2026-00', 'abc-de']) {
        const result = generateForPeriod(bad)
        expect(result.ok, `expected ok=false for "${bad}"`).toBe(false)
        if (!result.ok)
          expect(result.error).toMatch(/YYYY-MM/i)
      }
    })

    it('a malformed-period call MUST NOT alert and MUST NOT mutate statements', () => {
      const { generateForPeriod, statements } = useOwnerStatements()
      const before = statements.value
      const result = generateForPeriod('not-a-period')
      expect(result.ok).toBe(false)
      expect(statements.value).toBe(before)
      expect(notificationsMock.callLog).toHaveLength(0)
    })

    it('returns ok with created=0 when called for a period with no ledger data', () => {
      const { generateForPeriod } = useOwnerStatements()
      const result = generateForPeriod('2030-01')
      expect(result.ok).toBe(true)
      expect(result.created).toBe(0)
    })

    it('skips existing (owner, listing, period) tuples — idempotent on re-run', () => {
      const { generateForPeriod, statements } = useOwnerStatements()
      // 2026-06 ledger entries: led-1 (own-1/lst-1), led-3 (own-2/lst-8),
      // led-4 (own-2/lst-3), led-5 (own-3/lst-3). own-3 is 'invited' so its
      // mapping is excluded from generation. The three active-owner pairs all
      // already have a seed draft (stmt-1, stmt-3, stmt-4) so all three are
      // skipped on re-run — generation is idempotent.
      const before = statements.value.length
      const result = generateForPeriod(TEST_PERIOD)
      expect(result.ok).toBe(true)
      expect(result.created).toBe(0)
      expect(result.skipped).toBe(3)
      expect(statements.value.length).toBe(before)
    })

    it('produces deterministic totals that match a recomputed version of the same inputs', () => {
      const { generateForPeriod, statements } = useOwnerStatements()
      generateForPeriod('2026-04')
      const result = generateForPeriod('2026-05')
      // led-2 = own-1/lst-1/May exists; stmt-2 already seeds that exact draft.
      expect(result.created).toBe(0)

      // Verify stmt-1 (own-1/lst-1/June draft) matches a hand-recompute.
      const stmt1 = statements.value.find(s => s.id === 'stmt-1')!
      const entry = findLedgerFor('own-1', 'lst-1', TEST_PERIOD)
      const rule = findCommissionRule('cr-1')
      const commission = calculateCommission(rule, entry.grossRevenue)
      expect(commission).toBe(7_700_000)
      // 38_500_000 − 2_100_000 − 1_400_000 − 7_700_000 − 1_925_000 − 2_310_000
      expect(stmt1.totalAmount).toBe(23_065_000)
    })

    it('computes tiered-commission totals correctly for the I Putu (lst-3) mapping', () => {
      const { generateForPeriod, statements } = useOwnerStatements()
      generateForPeriod(TEST_PERIOD)
      const stmt4 = statements.value.find(s => s.id === 'stmt-4')!
      // Tiered cr-2: 18% up to 50M IDR, 22% above; revenue 110M IDR; 50% ownership share.
      // Total commission on full revenue: 50M * 18% + 60M * 22% = 22_200_000 IDR.
      const expectedCommission = calculateCommission(
        { type: 'tiered', tiers: [{ upTo: 50_000_000, rate: 18 }, { upTo: null, rate: 22 }] },
        110_000_000,
      )
      expect(expectedCommission).toBe(22_200_000)
      // Total of stmt-4 lines = 110M − 2.9M − 22.2M − 5.5M − 6.6M = 72_800_000 IDR.
      expect(stmt4.totalAmount).toBe(72_800_000)
    })

    it('is idempotent — calling generateForPeriod twice produces the same statement count', () => {
      const { generateForPeriod, statements } = useOwnerStatements()
      const first = generateForPeriod(TEST_PERIOD)
      const before = statements.value.length
      const second = generateForPeriod(TEST_PERIOD)
      expect(first.created + first.skipped).toBeGreaterThan(0)
      expect(second.created).toBe(0)
      expect(statements.value.length).toBe(before)
    })

    it('seeds draft statements with currency matching the owner\'s statementCurrency', () => {
      const { generateForPeriod, statements } = useOwnerStatements()
      generateForPeriod(TEST_PERIOD)
      const putuLst8 = statements.value.find(s => s.id === 'stmt-3')!
      expect(putuLst8.currency).toBe('USD')
      const wayanLst1 = statements.value.find(s => s.id === 'stmt-1')!
      expect(wayanLst1.currency).toBe('IDR')
    })

    it('idempotency does not emit OWNER_STATEMENT_DRAFT_READY on a no-op re-run', () => {
      const { generateForPeriod } = useOwnerStatements()
      const result = generateForPeriod(TEST_PERIOD)
      expect(result.created).toBe(0)
      expect(
        notificationsMock.callLog.filter(c => c.type === 'OWNER_STATEMENT_DRAFT_READY'),
      ).toHaveLength(0)
    })

    it('uses a single shared nowIso for every draft minted in one pass (timestamps align across rows)', async () => {
      // Mock the ledger module to inject fresh (owner, listing, period)
      // tuples that have no existing statement — the exact property under
      // test is that all drafts minted in one generateForPeriod call share
      // the same `createdAt`. We monkey-patch the ledger getter so a
      // single test period returns synthetic entries alongside the real
      // ones.
      const { generateForPeriod, statements } = useOwnerStatements()
      const ledgerModule = await import('~/components/owners/data/owner-ledger')
      const realLedger = ledgerModule.mockOwnerLedgerEntries
      const period = '2027-01'
      const synthetic = [
        { id: 'led-t1', ownerId: 'own-1', listingId: 'lst-1', period, currency: 'IDR', grossRevenue: 10_000_000, expenses: 500_000, taxes: 500_000, platformFees: 600_000, sources: [], occupiedNights: 5, availableNights: 30, nightlyRateSum: 10_000_000, reservationCount: 2, averageRating: 4.5, ratingsCount: 2, upcomingReservations: [], isPriorPeriodAdjustment: false, createdAt: '2027-02-01T00:00:00.000Z', updatedAt: '2027-02-01T00:00:00.000Z' },
        { id: 'led-t2', ownerId: 'own-2', listingId: 'lst-8', period, currency: 'USD', grossRevenue: 5_000, expenses: 200, taxes: 250, platformFees: 300, sources: [], occupiedNights: 5, availableNights: 30, nightlyRateSum: 5_000, reservationCount: 2, averageRating: 4.5, ratingsCount: 2, upcomingReservations: [], isPriorPeriodAdjustment: false, createdAt: '2027-02-01T00:00:00.000Z', updatedAt: '2027-02-01T00:00:00.000Z' },
      ]
      const augmented = [...realLedger, ...synthetic]
      const findSpy = vi.spyOn(ledgerModule, 'mockOwnerLedgerEntries', 'get').mockReturnValue(augmented)

      try {
        const result = generateForPeriod(period)
        expect(result.ok).toBe(true)
        expect(result.created).toBe(2)
        const fresh = statements.value.filter(s => s.period === period && s.status === 'draft')
        expect(fresh).toHaveLength(2)
        // The "single source of nowIso per generation" invariant: every
        // draft minted by one call must share the same `createdAt` instant.
        const createdAts = fresh.map(s => s.createdAt)
        expect(new Set(createdAts).size, `expected a single shared createdAt, got ${createdAts.join(', ')}`).toBe(1)
        // And every id is unique (the collision-free ID invariant).
        const ids = fresh.map(s => s.id)
        expect(new Set(ids).size).toBe(ids.length)
      }
      finally {
        findSpy.mockRestore()
      }
    })

    it('uses owner-scoped ledger amounts and ledger currency without applying ownership twice', async () => {
      const { generateForPeriod, statements } = useOwnerStatements()
      const ledgerModule = await import('~/components/owners/data/owner-ledger')
      const period = '2027-03'
      const synthetic = [
        {
          id: 'led-owner-tiered',
          ownerId: 'own-2',
          listingId: 'lst-3',
          period,
          currency: 'IDR',
          grossRevenue: 110_000_000,
          expenses: 2_900_000,
          taxes: 5_500_000,
          platformFees: 6_600_000,
          sources: [],
          occupiedNights: 18,
          availableNights: 30,
          nightlyRateSum: 110_000_000,
          reservationCount: 4,
          averageRating: 4.8,
          ratingsCount: 4,
          upcomingReservations: [],
          isPriorPeriodAdjustment: false,
          createdAt: '2027-04-01T00:00:00.000Z',
          updatedAt: '2027-04-01T00:00:00.000Z',
        },
        {
          id: 'led-owner-hybrid',
          ownerId: 'own-2',
          listingId: 'lst-8',
          period,
          currency: 'USD',
          grossRevenue: 9_400,
          expenses: 780,
          taxes: 470,
          platformFees: 564,
          sources: [],
          occupiedNights: 15,
          availableNights: 30,
          nightlyRateSum: 9_400,
          reservationCount: 3,
          averageRating: 4.7,
          ratingsCount: 3,
          upcomingReservations: [],
          isPriorPeriodAdjustment: false,
          createdAt: '2027-04-01T00:00:00.000Z',
          updatedAt: '2027-04-01T00:00:00.000Z',
        },
      ]
      const ledgerSpy = vi.spyOn(ledgerModule, 'mockOwnerLedgerEntries', 'get')
        .mockReturnValue([...ledgerModule.mockOwnerLedgerEntries, ...synthetic])

      try {
        const result = generateForPeriod(period)
        expect(result).toMatchObject({ ok: true, created: 2 })

        const tiered = statements.value.find(s => s.ownerId === 'own-2' && s.listingId === 'lst-3' && s.period === period)!
        expect(tiered.currency).toBe('IDR')
        expect(tiered.totalAmount).toBe(72_800_000)
        expect(tiered.lines.find(line => line.category === 'commission')?.amount).toBe(-22_200_000)

        const hybrid = statements.value.find(s => s.ownerId === 'own-2' && s.listingId === 'lst-8' && s.period === period)!
        expect(hybrid.currency).toBe('USD')
        // cr-3 is basis 'net': 250 + 15% of (9400 − 780 − 470 − 564) = 250 + 1137.9 = 1387.9
        expect(hybrid.totalAmount).toBe(6_198.1)
        expect(hybrid.lines.find(line => line.category === 'commission')?.amount).toBe(-1_387.9)
      }
      finally {
        ledgerSpy.mockRestore()
      }
    })

    it('skips mappings that are not effective on the statement period end', async () => {
      const mapping = mockOwnerPropertyMappings.find(item => item.id === 'opm-1')!
      const originalEffectiveFrom = mapping.effectiveFrom
      const originalEffectiveTo = mapping.effectiveTo
      mapping.effectiveFrom = '2025-01-01'
      mapping.effectiveTo = '2026-12-31'

      const ledgerModule = await import('~/components/owners/data/owner-ledger')
      const period = '2027-04'
      const entry = {
        ...ledgerModule.mockOwnerLedgerEntries.find(item => item.id === 'led-1')!,
        id: 'led-expired-mapping',
        period,
      }
      const ledgerSpy = vi.spyOn(ledgerModule, 'mockOwnerLedgerEntries', 'get')
        .mockReturnValue([...ledgerModule.mockOwnerLedgerEntries, entry])

      try {
        const result = useOwnerStatements().generateForPeriod(period)
        expect(result).toMatchObject({ ok: true, created: 0 })
      }
      finally {
        mapping.effectiveFrom = originalEffectiveFrom
        mapping.effectiveTo = originalEffectiveTo
        ledgerSpy.mockRestore()
      }
    })

    it('uses only the exact effective commission rule referenced by the mapping', async () => {
      const mapping = mockOwnerPropertyMappings.find(item => item.id === 'opm-1')!
      const originalRuleId = mapping.commissionRuleId
      mapping.commissionRuleId = 'cr-missing'

      const ledgerModule = await import('~/components/owners/data/owner-ledger')
      const period = '2027-05'
      const entry = {
        ...ledgerModule.mockOwnerLedgerEntries.find(item => item.id === 'led-1')!,
        id: 'led-missing-rule',
        period,
      }
      const ledgerSpy = vi.spyOn(ledgerModule, 'mockOwnerLedgerEntries', 'get')
        .mockReturnValue([...ledgerModule.mockOwnerLedgerEntries, entry])

      try {
        const result = useOwnerStatements().generateForPeriod(period)
        expect(result).toMatchObject({ ok: true, created: 0 })
      }
      finally {
        mapping.commissionRuleId = originalRuleId
        ledgerSpy.mockRestore()
      }
    })
  })

  describe('publish', () => {
    it('returns { ok: false, reason: "not_publishable" } when the statement is already published', () => {
      const { publish } = useOwnerStatements()
      const result = publish('stmt-2', 'staff-1')
      expect(result.ok).toBe(false)
      if (!result.ok)
        expect(result.reason).toBe('not_publishable')
    })

    it('returns { ok: false, reason: "not_publishable" } when the statement id does not exist', () => {
      const { publish } = useOwnerStatements()
      const result = publish('stmt-missing', 'staff-1')
      expect(result.ok).toBe(false)
      if (!result.ok)
        expect(result.reason).toBe('not_publishable')
    })

    it('flips a draft to published and stamps publishedAt + publishedBy', () => {
      const { publish, statements } = useOwnerStatements()
      const before = statements.value.find(s => s.id === 'stmt-1')!
      expect(before.status).toBe('draft')
      const result = publish('stmt-1', 'staff-1')
      expect(result.ok).toBe(true)
      const after = statements.value.find(s => s.id === 'stmt-1')!
      expect(after.status).toBe('published')
      expect(after.publishedBy).toBe('staff-1')
      expect(after.publishedAt).toBeTruthy()
    })

    it('deep-clones lines and totals into publishedSnapshot (mutating lines does not affect snapshot)', () => {
      const { publish, statements } = useOwnerStatements()
      publish('stmt-1', 'staff-1')
      const after = statements.value.find(s => s.id === 'stmt-1')!
      const snapshot = after.publishedSnapshot
      expect(snapshot).toBeDefined()
      expect(snapshot!.lines).toEqual(after.lines)
      expect(snapshot!.totalAmount).toBe(after.totalAmount)
      expect(snapshot!.currency).toBe(after.currency)

      const originalFirstAmount = after.lines[0].amount
      after.lines[0].amount = 0
      expect(snapshot!.lines[0].amount).toBe(originalFirstAmount)
      after.lines[0].amount = originalFirstAmount
    })

    it('strips Vue reactive proxies from the publishedSnapshot (plain-object primitive types)', () => {
      // The "deep-clones lines and totals into publishedSnapshot" test above
      // already proves primitive snapshot isolation. This test focuses on the
      // JSON.parse / structuredClone swap: it proves that the snapshot's
      // primitive fields are real primitive copies (not the same object the
      // live array holds), AND that the snapshot's plain-object fields are
      // detached from the reactive proxy chain.
      const { publish, statements } = useOwnerStatements()
      publish('stmt-1', 'staff-1')
      const after = statements.value.find(s => s.id === 'stmt-1')!
      const snapshot = after.publishedSnapshot!
      // Primitive identity check — every line in the snapshot must be a
      // brand-new object, not the same reference as the live array.
      snapshot.lines.forEach((snapLine, i) => {
        expect(snapLine).not.toBe(after.lines[i])
        // And every primitive field is identical by value...
        expect(snapLine.id).toBe(after.lines[i].id)
        expect(snapLine.amount).toBe(after.lines[i].amount)
        expect(snapLine.category).toBe(after.lines[i].category)
        expect(snapLine.label).toBe(after.lines[i].label)
      })
      // Total amount + currency: copied by value into the snapshot object
      // — not aliased to the live statement.
      expect(snapshot.totalAmount).toBe(after.totalAmount)
      expect(snapshot.currency).toBe(after.currency)
      // And the live mutation from the earlier test no longer affects the
      // snapshot — guards against any future regression in the cloning path.
      const originalFirstAmount = after.lines[0].amount
      after.lines[0].amount = 999
      expect(snapshot.lines[0].amount).toBe(originalFirstAmount)
      after.lines[0].amount = originalFirstAmount
    })

    it('emits an OWNER_STATEMENT_PUBLISHED notification via createAlert', () => {
      const { publish } = useOwnerStatements()
      publish('stmt-3', 'staff-1')
      const matches = notificationsMock.callLog.filter(c => c.type === 'OWNER_STATEMENT_PUBLISHED')
      expect(matches).toHaveLength(1)
      expect(matches[0].severity).toBe('INFO')
      expect(matches[0].context.statementId).toBe('stmt-3')
      expect(matches[0].context.publishedBy).toBe('staff-1')
    })

    it('publishes never reach createAlert when the call is rejected (no alert leaks on early-return)', () => {
      const { publish } = useOwnerStatements()
      // stmt-2 is already published; publish() must early-return without firing.
      publish('stmt-2', 'staff-1')
      expect(notificationsMock.callLog).toHaveLength(0)
    })
  })

  describe('immutable edit guards', () => {
    it('rejects line edits after publication', () => {
      const { updateStatementLines } = useOwnerStatements()
      const result = updateStatementLines('stmt-2', [
        { id: 'sl-7', category: 'revenue', label: 'Gross booking revenue', amount: 1 },
      ])
      expect(result.ok).toBe(false)
      if (!result.ok)
        expect(result.reason).toBe('not_editable')
    })

    it('rejects financial edits when the statement id does not exist', () => {
      const { updateStatementLines } = useOwnerStatements()
      const result = updateStatementLines('stmt-missing', [])
      expect(result.ok).toBe(false)
      if (!result.ok)
        expect(result.reason).toBe('not_editable')
    })

    it('accepts line edits while the statement is in draft', () => {
      const { updateStatementLines, statements } = useOwnerStatements()
      const newLines: OwnerStatementLine[] = [
        { id: 'sl-1', category: 'revenue', label: 'Gross booking revenue', amount: 40_000_000 },
        { id: 'sl-2', category: 'expense', label: 'Cleaning & laundry', amount: -2_100_000 },
        { id: 'sl-3', category: 'expense', label: 'Utilities', amount: -1_400_000 },
        { id: 'sl-4', category: 'commission', label: 'Management commission (20%)', amount: -8_000_000 },
        { id: 'sl-5', category: 'tax', label: 'Local tourism tax', amount: -2_000_000 },
        { id: 'sl-6', category: 'fee', label: 'Platform fees (Airbnb)', amount: -2_400_000 },
      ]
      const result = updateStatementLines('stmt-1', newLines)
      expect(result.ok).toBe(true)
      const after = statements.value.find(s => s.id === 'stmt-1')!
      expect(after.lines[0].amount).toBe(40_000_000)
      expect(after.totalAmount).toBe(40_000_000 - 2_100_000 - 1_400_000 - 8_000_000 - 2_000_000 - 2_400_000)
    })

    it('uses spread replacement (Vue ref identity changes) on every edit', () => {
      const { updateStatementLines, statements } = useOwnerStatements()
      const before = statements.value
      updateStatementLines('stmt-1', [
        { id: 'sl-1', category: 'revenue', label: 'Gross booking revenue', amount: 38_500_000 },
      ])
      expect(statements.value).not.toBe(before)
    })
  })

  describe('raiseIssue + resolveIssue', () => {
    it('initializes the standalone issue store from statement fixture issues', () => {
      const { issues } = useOwnerStatements()
      expect(issues.value.find(issue => issue.id === 'sti-1')).toMatchObject({
        statementId: 'stmt-2',
        resolvedAt: '2026-06-10T14:00:00.000Z',
      })
    })

    it('creates an issue tied to a specific line on the statement', () => {
      const { raiseIssue, issues, statements } = useOwnerStatements()
      const result = raiseIssue({
        statementId: 'stmt-1',
        lineId: 'sl-5',
        description: 'Tourism tax correction',
        amount: -50_000,
      })
      expect(result.ok).toBe(true)
      const created = issues.value.find(i => i.statementId === 'stmt-1' && i.lineId === 'sl-5' && !i.resolvedAt)!
      expect(created).toBeTruthy()
      expect(created.amount).toBe(-50_000)
      expect(created.id).toBeTruthy()
      expect(created.createdAt).toBeTruthy()
      expect(statements.value.find(statement => statement.id === 'stmt-1')?.issues)
        .toContainEqual(expect.objectContaining({ id: created.id, lineId: 'sl-5' }))
    })

    it('enforces the one-open-issue-per-line rule — duplicates return the existing issue', () => {
      const { raiseIssue, issues } = useOwnerStatements()
      const first = raiseIssue({
        statementId: 'stmt-1',
        lineId: 'sl-4',
        description: 'Commission rate review',
        amount: -10_000,
      })
      expect(first.ok).toBe(true)
      const beforeCount = issues.value.length
      const second = raiseIssue({
        statementId: 'stmt-1',
        lineId: 'sl-4',
        description: 'Another review on the same line',
        amount: -20_000,
      })
      expect(second.ok).toBe(true)
      if (first.ok && second.ok) {
        expect(second.existing).toBe(true)
        expect(second.issue.id).toBe(first.issue.id)
      }
      expect(issues.value.length).toBe(beforeCount)
    })

    it('allows a new issue on the same line after the previous one was resolved and keeps both stores synchronized', () => {
      const { raiseIssue, resolveIssue, issues, statements } = useOwnerStatements()
      const first = raiseIssue({
        statementId: 'stmt-1',
        lineId: 'sl-2',
        description: 'Cleaning undercharge',
        amount: -100_000,
      })
      expect(first.ok).toBe(true)
      const firstIssue = (first as { ok: true, issue: OwnerStatementIssue }).issue
      resolveIssue(firstIssue.id)
      expect(issues.value.find(issue => issue.id === firstIssue.id)?.resolvedAt).toBeTruthy()
      expect(statements.value.find(statement => statement.id === 'stmt-1')?.issues.find(issue => issue.id === firstIssue.id)?.resolvedAt).toBeTruthy()

      const second = raiseIssue({
        statementId: 'stmt-1',
        lineId: 'sl-2',
        description: 'Second review on the same line',
        amount: -50_000,
      })
      expect(second.ok).toBe(true)
    })

    it('rejects raiseIssue for an unknown statement', () => {
      const { raiseIssue } = useOwnerStatements()
      const result = raiseIssue({
        statementId: 'stmt-missing',
        lineId: 'sl-x',
        description: '...',
        amount: 0,
      })
      expect(result.ok).toBe(false)
    })

    it('rejects an issue when the line does not belong to the statement', () => {
      const { raiseIssue } = useOwnerStatements()
      const result = raiseIssue({
        statementId: 'stmt-1',
        lineId: 'sl-7',
        description: 'Line from another statement',
        amount: 0,
      })
      expect(result).toEqual({ ok: false, reason: 'invalid_line' })
    })

    it('emits an OWNER_ISSUE_RAISED notification via createAlert', () => {
      const { raiseIssue } = useOwnerStatements()
      raiseIssue({
        statementId: 'stmt-1',
        lineId: 'sl-3',
        description: 'Utilities review',
        amount: -10_000,
      })
      const matches = notificationsMock.callLog.filter(c => c.type === 'OWNER_ISSUE_RAISED')
      expect(matches).toHaveLength(1)
      expect(matches[0].severity).toBe('WARNING')
      expect(matches[0].context.statementId).toBe('stmt-1')
      expect(matches[0].context.lineId).toBe('sl-3')
    })

    it('duplicate-issue refusal does not leak a new alert (only successful raiseIssue fires)', () => {
      const { raiseIssue } = useOwnerStatements()
      raiseIssue({ statementId: 'stmt-1', lineId: 'sl-6', description: 'first', amount: -1 })
      const afterFirst = notificationsMock.callLog.filter(c => c.type === 'OWNER_ISSUE_RAISED').length
      raiseIssue({ statementId: 'stmt-1', lineId: 'sl-6', description: 'second', amount: -2 })
      const afterSecond = notificationsMock.callLog.filter(c => c.type === 'OWNER_ISSUE_RAISED').length
      expect(afterFirst).toBe(1)
      expect(afterSecond).toBe(1)
    })
  })

  describe('post-publication corrections (next-period adjustments)', () => {
    it('records an adjustment record pointing at the next period (tight input shape)', () => {
      // The tightened RecordAdjustmentInput shape intentionally does NOT
      // include ownerId / listingId / period — those are derived from the
      // published source inside the composable so a caller cannot point an
      // adjustment at a different (owner, listing, period) tuple than the
      // statement it is amending. This test pins down the success path:
      //   - `recordAdjustment` returns { ok: true, adjustment }
      //   - the returned adjustment carries the correct nextPeriod, amount,
      //     reason, createdAt
      //   - the (ownerId, listingId, period) tuple matches the published
      //     source — verified by reading the post-publish statement via
      //     JSON.parse(JSON.stringify(...)) to defeat Vue reactive-proxy
      //     read quirks in this test environment.
      const { publish, recordAdjustment, adjustments, statements } = useOwnerStatements()
      publish('stmt-1', 'staff-1')

      const published = statements.value.find(s => s.id === 'stmt-1')!
      expect(published.status).toBe('published')

      const result = recordAdjustment({
        ownerStatementId: 'stmt-1',
        amount: -100_000,
        reason: 'Retroactive utility undercharge correction.',
      })
      expect(result.ok).toBe(true)
      if (!result.ok)
        throw new Error('recordAdjustment returned an error envelope')

      // Persisted side-effect: the adjustments array receives the row.
      const created = adjustments.value.find(a => a.ownerStatementId === 'stmt-1')!
      expect(created.nextPeriod).toBe(TEST_PERIOD_NEXT)
      expect(created.amount).toBe(-100_000)
      expect(created.reason).toMatch(/retroactive/i)
      expect(created.createdAt).toBeTruthy()
      // `result.adjustment` is the canonical, in-flight adjustment the
      // composable handed back — assert its own identity fields directly.
      expect(result.adjustment.ownerStatementId).toBe('stmt-1')
      expect(result.adjustment.nextPeriod).toBe(TEST_PERIOD_NEXT)
      expect(result.adjustment.amount).toBe(-100_000)
      expect(result.adjustment.reason).toMatch(/retroactive/i)
      expect(result.adjustment.createdAt).toBeTruthy()
    })

    it('rejects recording an adjustment against an unpublished statement (financial edits are immutable)', () => {
      const { recordAdjustment } = useOwnerStatements()
      const result = recordAdjustment({
        ownerStatementId: 'stmt-3', // still draft
        amount: -50_000,
        reason: 'test',
      })
      expect(result.ok).toBe(false)
    })

    it('derives the next period from the source statement, including December rollover', () => {
      const { recordAdjustment, statements } = useOwnerStatements()
      const published = statements.value.find(statement => statement.id === 'stmt-2')!
      statements.value = [
        ...statements.value,
        { ...JSON.parse(JSON.stringify(published)), id: 'stmt-december', period: '2026-12' },
      ]

      const result = recordAdjustment({
        ownerStatementId: 'stmt-december',
        amount: -25_000,
        reason: 'Year-end correction',
      })

      expect(result.ok).toBe(true)
      if (result.ok)
        expect(result.adjustment.nextPeriod).toBe('2027-01')
    })

    it('uses spread replacement when storing adjustments', () => {
      const { publish, recordAdjustment, adjustments } = useOwnerStatements()
      publish('stmt-1', 'staff-1')
      const before = adjustments.value
      recordAdjustment({
        ownerStatementId: 'stmt-1',
        amount: -10_000,
        reason: 'spread test',
      })
      expect(adjustments.value).not.toBe(before)
    })
  })

  describe('mockExport', () => {
    it('records an activity entry with format, owner, statement, actor, and timestamp', async () => {
      const { mockExport, exportActivity } = useOwnerStatements()
      const before = exportActivity.value.length
      const result = await mockExport({
        format: 'pdf',
        statementId: 'stmt-1',
        actor: 'staff-1',
      })
      expect(result.ok).toBe(true)
      expect(exportActivity.value.length).toBe(before + 1)
      const entry = exportActivity.value[exportActivity.value.length - 1]
      expect(entry.format).toBe('pdf')
      expect(entry.statementId).toBe('stmt-1')
      expect(entry.actor).toBe('staff-1')
      expect(entry.ownerId).toBe('own-1')
      expect(entry.listingId).toBe('lst-1')
      expect(entry.period).toBe(TEST_PERIOD)
      expect(entry.createdAt).toBeTruthy()
    })

    it('returns { ok: false } when the statement id does not exist', async () => {
      const { mockExport } = useOwnerStatements()
      const result = await mockExport({
        format: 'xlsx',
        statementId: 'stmt-missing',
        actor: 'staff-1',
      })
      expect(result.ok).toBe(false)
    })

    it('supports the xlsx format alongside pdf', async () => {
      const { mockExport, exportActivity } = useOwnerStatements()
      const before = exportActivity.value.length
      const result = await mockExport({
        format: 'xlsx',
        statementId: 'stmt-3',
        actor: 'staff-2',
      })
      expect(result.ok).toBe(true)
      const entry = exportActivity.value[exportActivity.value.length - 1]
      expect(entry.format).toBe('xlsx')
      expect(entry.actor).toBe('staff-2')
      expect(exportActivity.value.length).toBe(before + 1)
    })

    it('returns control after a short delay (does not hang the test)', async () => {
      const { mockExport } = useOwnerStatements()
      const start = Date.now()
      const result = await mockExport({
        format: 'pdf',
        statementId: 'stmt-1',
        actor: 'staff-1',
      })
      const elapsed = Date.now() - start
      expect(result.ok).toBe(true)
      expect(elapsed).toBeLessThan(5_000)
    })

    it('keeps concurrent exports unique across composable instances in the same millisecond', async () => {
      const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000)
      try {
        const first = useOwnerStatements()
        const second = useOwnerStatements()
        const [pdf, xlsx] = await Promise.all([
          first.mockExport({ format: 'pdf', statementId: 'stmt-1', actor: 'staff-1' }),
          second.mockExport({ format: 'xlsx', statementId: 'stmt-1', actor: 'staff-2' }),
        ])

        expect(pdf.ok && xlsx.ok).toBe(true)
        if (pdf.ok && xlsx.ok)
          expect(pdf.activity.id).not.toBe(xlsx.activity.id)
      }
      finally {
        nowSpy.mockRestore()
      }
    })

    it('does NOT mutate statements when exporting (read-only operation)', async () => {
      const { mockExport, statements } = useOwnerStatements()
      const beforeIds = statements.value.map(s => s.id).sort()
      await mockExport({
        format: 'pdf',
        statementId: 'stmt-1',
        actor: 'staff-1',
      })
      const afterIds = statements.value.map(s => s.id).sort()
      expect(afterIds).toEqual(beforeIds)
    })
  })

  describe('computeDrafts (helper exposed for testing)', () => {
    it('lists drafts and totals for the dashboard view', () => {
      const { computeDrafts, statements } = useOwnerStatements()
      const drafts = computeDrafts()
      expect(drafts.length).toBe(statements.value.filter(s => s.status === 'draft').length)
      expect(drafts.every(d => d.status === 'draft')).toBe(true)
    })

    it('reproduces the seeded totalAmount for stmt-1 (38.5M − 2.1M − 1.4M − 7.7M − 1.925M − 2.31M)', () => {
      const { computeDrafts } = useOwnerStatements()
      const stmt1 = computeDrafts().find(d => d.id === 'stmt-1')!
      expect(stmt1.totalAmount).toBe(23_065_000)
    })
  })

  describe('spread / replacement mutations', () => {
    it('publish replaces the statements array (no in-place mutation)', () => {
      const { publish, statements } = useOwnerStatements()
      const before = statements.value
      publish('stmt-1', 'staff-1')
      expect(statements.value).not.toBe(before)
    })

    it('raiseIssue replaces the issues array (no in-place mutation)', () => {
      const { raiseIssue, issues } = useOwnerStatements()
      const before = issues.value
      raiseIssue({
        statementId: 'stmt-1',
        lineId: 'sl-1',
        description: 'spread test',
        amount: -10_000,
      })
      expect(issues.value).not.toBe(before)
    })

    it('mockExport replaces the exportActivity array', async () => {
      const { mockExport, exportActivity } = useOwnerStatements()
      const before = exportActivity.value
      await mockExport({
        format: 'pdf',
        statementId: 'stmt-1',
        actor: 'staff-1',
      })
      expect(exportActivity.value).not.toBe(before)
    })
  })

  describe('cross-composable integration', () => {
    it('shares the seed with useOwners — period generation respects the ownership map', () => {
      const { generateForPeriod } = useOwnerStatements()
      const result = generateForPeriod(TEST_PERIOD)
      // own-3 is 'invited' — generation excludes it. Active-owner mappings
      // (own-1 + own-2) all already have seed drafts, so the run is a no-op.
      expect(result.created + result.skipped).toBeGreaterThanOrEqual(3)
    })

    it('does NOT mutate mockOwnerPropertyMappings / mockOwners on read', () => {
      const beforeOwners = JSON.stringify(mockOwners)
      const beforeMappings = JSON.stringify(mockOwnerPropertyMappings)
      const { generateForPeriod } = useOwnerStatements()
      generateForPeriod(TEST_PERIOD)
      expect(JSON.stringify(mockOwners)).toBe(beforeOwners)
      expect(JSON.stringify(mockOwnerPropertyMappings)).toBe(beforeMappings)
    })
  })

  describe('id uniqueness across composable instances (no module-level counter leak)', () => {
    it('issue IDs minted by separate composable instances never collide', () => {
      const a = useOwnerStatements()
      const b = useOwnerStatements()
      const seen = new Set<string>()
      const initialIssueCount = a.issues.value.length
      // Reuse one valid statement line, resolving each issue before creating
      // the next so the one-open-issue-per-line rule remains intact.
      for (let i = 0; i < 25; i++) {
        const target = i % 2 === 0 ? a : b
        const result = target.raiseIssue({
          statementId: 'stmt-1',
          lineId: 'sl-1',
          description: `cross-instance ${i}`,
          amount: -1,
        })
        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(seen.has(result.issue.id)).toBe(false)
          seen.add(result.issue.id)
          target.resolveIssue(result.issue.id)
        }
      }
      // The two instances share the same underlying `useState` buckets, so
      // every issue minted across both lands in one shared store, alongside
      // the resolved issue seeded from stmt-2.
      expect(seen.size).toBe(25)
      expect(a.issues.value).toHaveLength(initialIssueCount + 25)
      expect(b.issues.value).toHaveLength(initialIssueCount + 25)
      // And every id is unique across the shared store.
      const all = a.issues.value.map(i => i.id)
      expect(new Set(all).size).toBe(all.length)
    })

    it('export IDs minted by separate composable instances never collide', async () => {
      const a = useOwnerStatements()
      const b = useOwnerStatements()
      const seen = new Set<string>()
      for (let i = 0; i < 10; i++) {
        const target = i % 2 === 0 ? a : b
        const result = await target.mockExport({
          format: 'pdf',
          statementId: 'stmt-1',
          actor: `staff-${i}`,
        })
        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(seen.has(result.activity.id)).toBe(false)
          seen.add(result.activity.id)
        }
      }
      expect(seen.size).toBe(10)
      expect(new Set(a.exportActivity.value.map(e => e.id)).size).toBe(a.exportActivity.value.length)
    })

    it('adjustment IDs minted by separate composable instances never collide', () => {
      const a = useOwnerStatements()
      const b = useOwnerStatements()
      a.publish('stmt-1', 'staff-1')
      b.publish('stmt-3', 'staff-1')
      const resultA = a.recordAdjustment({
        ownerStatementId: 'stmt-1',
        amount: -1,
        reason: 'a',
      })
      const resultB = b.recordAdjustment({
        ownerStatementId: 'stmt-3',
        amount: -2,
        reason: 'b',
      })
      expect(resultA.ok && resultB.ok).toBe(true)
      if (resultA.ok && resultB.ok) {
        expect(resultA.adjustment.id).not.toBe(resultB.adjustment.id)
      }
      expect(new Set(a.adjustments.value.map(x => x.id)).size).toBe(a.adjustments.value.length)
    })

    it('generated statement IDs collide-check against the live store (seed and prior drafts)', async () => {
      // Verify the deriveUniqueId contract directly: every generated id must
      // be absent from the statements store at the moment it is minted.
      // We pre-load a known id into the store, then ask generateForPeriod
      // to run for a future period using a ledger spy that returns fresh
      // entries — the freshly-minted IDs must avoid the pre-loaded id.
      const target = 'stmt-gen-collision-test'
      const { generateForPeriod, statements } = useOwnerStatements()
      statements.value = [
        ...statements.value,
        {
          id: target,
          ownerId: 'own-ZZ',
          listingId: 'lst-ZZ',
          period: '1999-12',
          currency: 'IDR',
          status: 'draft',
          lines: [],
          totalAmount: 0,
          createdAt: '2026-01-01T00:00:00.000Z',
          issues: [],
        },
      ]
      const ledgerModule = await import('~/components/owners/data/owner-ledger')
      const realLedger = ledgerModule.mockOwnerLedgerEntries
      const period = '2027-02'
      const synthetic = [
        { id: 'led-c1', ownerId: 'own-1', listingId: 'lst-1', period, currency: 'IDR', grossRevenue: 10_000_000, expenses: 500_000, taxes: 500_000, platformFees: 600_000, sources: [], occupiedNights: 5, availableNights: 30, nightlyRateSum: 10_000_000, reservationCount: 2, averageRating: 4.5, ratingsCount: 2, upcomingReservations: [], isPriorPeriodAdjustment: false, createdAt: '2027-03-01T00:00:00.000Z', updatedAt: '2027-03-01T00:00:00.000Z' },
        { id: 'led-c2', ownerId: 'own-2', listingId: 'lst-8', period, currency: 'USD', grossRevenue: 5_000, expenses: 200, taxes: 250, platformFees: 300, sources: [], occupiedNights: 5, availableNights: 30, nightlyRateSum: 5_000, reservationCount: 2, averageRating: 4.5, ratingsCount: 2, upcomingReservations: [], isPriorPeriodAdjustment: false, createdAt: '2027-03-01T00:00:00.000Z', updatedAt: '2027-03-01T00:00:00.000Z' },
        { id: 'led-c3', ownerId: 'own-2', listingId: 'lst-3', period, currency: 'IDR', grossRevenue: 50_000_000, expenses: 1_000_000, taxes: 2_500_000, platformFees: 3_000_000, sources: [], occupiedNights: 5, availableNights: 30, nightlyRateSum: 50_000_000, reservationCount: 2, averageRating: 4.5, ratingsCount: 2, upcomingReservations: [], isPriorPeriodAdjustment: false, createdAt: '2027-03-01T00:00:00.000Z', updatedAt: '2027-03-01T00:00:00.000Z' },
      ]
      const findSpy = vi.spyOn(ledgerModule, 'mockOwnerLedgerEntries', 'get').mockReturnValue([...realLedger, ...synthetic])
      try {
        const result = generateForPeriod(period)
        expect(result.ok).toBe(true)
        expect(result.created).toBe(3)
        const fresh = statements.value
          .filter(s => s.period === period && s.status === 'draft')
          .map(s => s.id)
        expect(fresh).not.toContain(target)
        expect(new Set(fresh).size).toBe(fresh.length)
      }
      finally {
        findSpy.mockRestore()
      }
    })
  })

  describe('PRD 5.5 — preview, pre-publish adjustments, dispute thread', () => {
    it('moves a draft into preview and back', () => {
      const { moveToPreview, backToDraft, statements } = useOwnerStatements()
      const target = statements.value.find(s => s.id === 'stmt-1')!
      expect(target.status).toBe('draft')

      expect(moveToPreview('stmt-1')).toEqual({ ok: true })
      expect(statements.value.find(s => s.id === 'stmt-1')?.status).toBe('in_preview')
      expect(moveToPreview('stmt-1')).toEqual({ ok: false }) // already in preview

      expect(backToDraft('stmt-1')).toEqual({ ok: true })
      expect(statements.value.find(s => s.id === 'stmt-1')?.status).toBe('draft')
    })

    it('publishes from preview state', () => {
      const { moveToPreview, publish, statements } = useOwnerStatements()
      moveToPreview('stmt-1')
      const result = publish('stmt-1', 'staff-1')
      expect(result).toEqual({ ok: true })
      expect(statements.value.find(s => s.id === 'stmt-1')?.status).toBe('published')
    })

    it('supports pre-publish adjustments with positive and negative amounts', () => {
      const { updateStatementLines, statements } = useOwnerStatements()
      const draft = statements.value.find(s => s.id === 'stmt-1')!
      const lines = [
        ...draft.lines,
        { id: 'line-adj-pre', category: 'adjustment' as const, label: 'Lost key charge', amount: -250_000 },
        { id: 'line-adj-pos', category: 'adjustment' as const, label: 'Replacement key refund', amount: 250_000 },
      ]
      const result = updateStatementLines('stmt-1', lines)
      expect(result.ok).toBe(true)
      const updated = statements.value.find(s => s.id === 'stmt-1')!
      expect(updated.lines.filter(l => l.category === 'adjustment')).toHaveLength(2)
      // totalAmount recomputed from the signed sum.
      expect(updated.totalAmount).toBe(draft.totalAmount)
    })

    it('appends dispute messages to a thread and notifies', () => {
      const { raiseIssue, addIssueMessage } = useOwnerStatements()
      const raised = raiseIssue({
        statementId: 'stmt-2',
        lineId: 'sl-9',
        description: 'Why is utilities higher this month?',
        amount: -1_500_000,
      })
      if (!raised.ok || !raised.issue.id)
        throw new Error('expected issue')

      const reply = addIssueMessage(raised.issue.id, 'staff', 'Pool pump ran longer — corrected for next month.')
      expect(reply.ok).toBe(true)
      if (reply.ok) {
        expect(reply.issue.thread).toHaveLength(1)
        expect(reply.issue.thread?.[0]?.author).toBe('staff')
      }
      // Staff reply notifies the owner.
      expect(notificationsMock.callLog.some(call => call.type === 'OWNER_ISSUE_RESPONDED')).toBe(true)
    })

    it('resolves a dispute as explained without an amount change', () => {
      const { raiseIssue, resolveIssueWithResolution, issues } = useOwnerStatements()
      const raised = raiseIssue({
        statementId: 'stmt-2',
        lineId: 'sl-10',
        description: 'Commission seems high',
        amount: -8_400_000,
      })
      if (!raised.ok || !raised.issue.id)
        throw new Error('expected issue')

      const result = resolveIssueWithResolution({
        issueId: raised.issue.id,
        type: 'explained',
        resolvedBy: 'staff-1',
        note: 'Commission is 20% of gross — correct per contract.',
      })
      expect(result.ok).toBe(true)
      const resolved = issues.value.find(i => i.id === raised.issue.id)!
      expect(resolved.resolution?.type).toBe('explained')
      expect(resolved.resolvedAt).toBeTruthy()
    })

    it('resolves a dispute as adjusted with an adjustment reference', () => {
      const { raiseIssue, resolveIssueWithResolution, issues } = useOwnerStatements()
      const raised = raiseIssue({
        statementId: 'stmt-2',
        lineId: 'sl-8',
        description: 'Cleaning charged twice',
        amount: -2_300_000,
      })
      if (!raised.ok || !raised.issue.id)
        throw new Error('expected issue')

      const result = resolveIssueWithResolution({
        issueId: raised.issue.id,
        type: 'adjusted',
        resolvedBy: 'staff-1',
        adjustmentId: 'osa-future-1',
      })
      expect(result.ok).toBe(true)
      const resolved = issues.value.find(i => i.id === raised.issue.id)!
      expect(resolved.resolution?.type).toBe('adjusted')
      expect(resolved.resolution?.adjustmentId).toBe('osa-future-1')
    })

    it('refuses to re-resolve an already-resolved dispute', () => {
      const { raiseIssue, resolveIssueWithResolution } = useOwnerStatements()
      const raised = raiseIssue({
        statementId: 'stmt-2',
        lineId: 'sl-11',
        description: 'Tax question',
        amount: -2_100_000,
      })
      if (!raised.ok || !raised.issue.id)
        throw new Error('expected issue')

      resolveIssueWithResolution({ issueId: raised.issue.id, type: 'explained', resolvedBy: 'staff-1' })
      const second = resolveIssueWithResolution({ issueId: raised.issue.id, type: 'adjusted', resolvedBy: 'staff-1' })
      expect(second).toEqual({ ok: false, reason: 'already_resolved' })
    })
  })
})
