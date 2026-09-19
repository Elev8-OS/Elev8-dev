// One formatter for every owner-facing surface.
//
// Before it existed the same figure rendered three ways depending on the page:
// the portal hardcoded `toLocaleString('id-ID')` for every currency (so CHF
// was grouped with Indonesian separators), `StatementTable` used `'en-US'`,
// and `OwnerDetailSheet` used the viewer's own locale.

import { describe, expect, it } from 'vitest'
import {
  currencyDecimals,
  formatOwnerAmount,
  formatOwnerMoney,
  formatOwnerMoneyRounded,
} from '~/components/owners/data/owner-money'

describe('owner money formatting', () => {
  it('leads with the ISO code and never a symbol', () => {
    expect(formatOwnerMoney(1200, 'CHF')).toBe('CHF 1,200.00')
    expect(formatOwnerMoney(150, 'USD')).toBe('USD 150.00')
    expect(formatOwnerMoney(500000, 'IDR')).toBe('IDR 500,000')
  })

  it('writes zero-decimal currencies without a minor unit', () => {
    expect(currencyDecimals('IDR')).toBe(0)
    expect(currencyDecimals('idr')).toBe(0)
    expect(currencyDecimals('CHF')).toBe(2)
    expect(formatOwnerAmount(148_000_000, 'IDR')).toBe('148,000,000')
    expect(formatOwnerAmount(148_000_000, 'USD')).toBe('148,000,000.00')
  })

  it('groups identically whatever the currency', () => {
    // The old code grouped with Indonesian separators for every currency, so
    // the same amount read differently on the portal than in the staff table.
    expect(formatOwnerAmount(1_234_567, 'CHF')).toBe('1,234,567.00')
    expect(formatOwnerAmount(1_234_567, 'EUR')).toBe('1,234,567.00')
  })

  it('keeps negative amounts negative', () => {
    // Every deduction on a statement is negative.
    expect(formatOwnerMoney(-2_900_000, 'IDR')).toBe('IDR -2,900,000')
  })

  it('drops the minor unit on rounded surfaces', () => {
    // Charts and KPI tiles round first, so printing `.00` afterwards would add
    // back precision that was just discarded.
    expect(formatOwnerMoneyRounded(20_900.4, 'USD')).toBe('USD 20,900')
    expect(formatOwnerMoneyRounded(148_000_000, 'IDR')).toBe('IDR 148,000,000')
  })

  it('prints a bare number rather than inventing a currency', () => {
    // A missing currency must read as incomplete, never as a default one.
    expect(formatOwnerMoney(1000, '')).toBe('1,000.00')
    expect(formatOwnerMoneyRounded(1000, '')).toBe('1,000')
  })
})
