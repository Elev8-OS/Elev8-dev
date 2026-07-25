import { describe, expect, it } from 'vitest'
import { calculateCommission } from '@/components/owners/data/commission-rules'
import {
  applyOwnershipShare,
  calculateStatementTotals,
  ledgerEntryToStatementInput,
  mockOwnerLedgerEntries,
  roundCurrency,
} from '@/components/owners/data/owner-ledger'
import { buildStatementLines, mockOwnerStatements } from '@/components/owners/data/owner-statements'

describe('calculateStatementTotals', () => {
  it('derives net payout with the correct calculation order', () => {
    expect(calculateStatementTotals({
      grossRevenue: 10_000,
      operatingExpenses: 1_000,
      commission: 1_500,
      taxesAndFees: 500,
      adjustments: -250,
    })).toEqual({
      grossRevenue: 10_000,
      operatingExpenses: 1_000,
      commission: 1_500,
      taxesAndFees: 500,
      adjustments: -250,
      netPayout: 6_750,
    })
  })

  it('adds positive adjustments back into the net payout', () => {
    const totals = calculateStatementTotals({
      grossRevenue: 10_000,
      operatingExpenses: 1_000,
      commission: 1_500,
      taxesAndFees: 500,
      adjustments: 250,
    })
    expect(totals.netPayout).toBe(7_250)
  })

  it('rounds currency to two decimals at the domain boundary', () => {
    const totals = calculateStatementTotals({
      grossRevenue: 100.005,
      operatingExpenses: 0,
      commission: 0,
      taxesAndFees: 0,
      adjustments: 0,
    })
    expect(totals.netPayout).toBe(100.01)
  })

  it('netPayout equals rounded gross − rounded expenses − rounded commission − rounded taxes/fees + rounded adjustments (no fractional-cent drift)', () => {
    // Inputs chosen so each component carries a fractional part. The invariant
    // is what the UI displays: rounded gross − rounded deductions − rounded
    // additions. If netPayout were derived from the raw inputs and only
    // re-rounded at the end, the displayed sum could drift by a sub-cent
    // from the rounded components.
    const totals = calculateStatementTotals({
      grossRevenue: 100.114,
      operatingExpenses: 33.336,
      commission: 66.668,
      taxesAndFees: 1.001,
      adjustments: 0,
    })

    // Sanity: each component is itself rounded to two decimals.
    expect(totals.grossRevenue).toBe(100.11)
    expect(totals.operatingExpenses).toBe(33.34)
    expect(totals.commission).toBe(66.67)
    expect(totals.taxesAndFees).toBe(1.00)
    expect(totals.adjustments).toBe(0)

    // Core invariant: the displayed total equals the signed sum of the
    // displayed components, with no independent recomputation drift.
    const invariant = roundCurrency(
      totals.grossRevenue
      - totals.operatingExpenses
      - totals.commission
      - totals.taxesAndFees
      + totals.adjustments,
    )
    expect(totals.netPayout).toBe(invariant)
  })

  it('netPayout stays consistent with the rounded components across many magnitudes', () => {
    const totals = calculateStatementTotals({
      grossRevenue: 123_456.789,
      operatingExpenses: 12_345.671,
      commission: 3_456.125,
      taxesAndFees: 0.005,
      adjustments: -123.456,
    })

    const invariant = roundCurrency(
      totals.grossRevenue
      - totals.operatingExpenses
      - totals.commission
      - totals.taxesAndFees
      + totals.adjustments,
    )
    expect(totals.netPayout).toBe(invariant)
  })
})

describe('applyOwnershipShare', () => {
  it('applies a 40% ownership share to all property amounts before owner totals', () => {
    const shared = applyOwnershipShare({
      grossRevenue: 10_000,
      operatingExpenses: 1_000,
      commission: 1_500,
      taxesAndFees: 500,
      adjustments: -250,
    }, 0.4)

    expect(shared).toEqual({
      grossRevenue: 4_000,
      operatingExpenses: 400,
      commission: 600,
      taxesAndFees: 200,
      adjustments: -100,
    })

    // The net payout of the shared amounts equals 40% of the full net payout.
    expect(calculateStatementTotals(shared).netPayout).toBe(2_700)
  })
})

describe('ledgerEntryToStatementInput + calculateStatementTotals (integration)', () => {
  it('reproduces the stmt-1 total from the led-1 ledger entry and cr-1 commission', () => {
    const entry = mockOwnerLedgerEntries.find(e => e.id === 'led-1')!
    const commission = calculateCommission({ type: 'flat', rate: 20 }, entry.grossRevenue)
    const input = ledgerEntryToStatementInput(entry, commission)
    const totals = calculateStatementTotals(input)

    const stmt1 = mockOwnerStatements.find(s => s.id === 'stmt-1')!
    expect(totals.netPayout).toBe(stmt1.totalAmount)
  })
})

describe('buildStatementLines', () => {
  it('builds signed statement lines that sum to the net payout', () => {
    const input = {
      grossRevenue: 10_000,
      operatingExpenses: 1_000,
      commission: 1_500,
      taxesAndFees: 500,
      adjustments: -250,
    }
    const lines = buildStatementLines(input)
    const sum = lines.reduce((acc, line) => acc + line.amount, 0)

    expect(sum).toBe(calculateStatementTotals(input).netPayout)
    expect(lines.find(l => l.category === 'revenue')?.amount).toBe(10_000)
    expect(lines.find(l => l.category === 'commission')?.amount).toBe(-1_500)
    expect(lines.find(l => l.category === 'adjustment')?.amount).toBe(-250)
  })

  it('omits the adjustment line when there is no adjustment', () => {
    const lines = buildStatementLines({
      grossRevenue: 10_000,
      operatingExpenses: 1_000,
      commission: 1_500,
      taxesAndFees: 500,
      adjustments: 0,
    })
    expect(lines.some(l => l.category === 'adjustment')).toBe(false)
  })
})
