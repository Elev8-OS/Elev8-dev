// Status is about whether a guest can use the code today. The booking window decides
// that; the stay window only limits which check-in dates qualify.

import type { PromoCode } from '~/components/promo-code/data/promo-codes'
import { describe, expect, it } from 'vitest'
import { getPromoCodeStatus } from '~/components/promo-code/data/promo-codes'

const now = new Date(2026, 8, 27)

function code(overrides: Partial<PromoCode> = {}): PromoCode {
  return {
    id: 'promo-x',
    code: 'X',
    discountType: '%',
    value: 10,
    currency: null,
    active: true,
    bookingWindows: [],
    stayWindows: [],
    redemptionCount: 0,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('getPromoCodeStatus', () => {
  it('is active while bookable today for stays that are still ahead', () => {
    const xmas = code({
      bookingWindows: [{ from: '2026-09-01T00:00:00Z', until: '2026-12-24T00:00:00Z' }],
      stayWindows: [{ from: '2026-12-20T00:00:00Z', until: '2027-01-05T00:00:00Z' }],
    })
    expect(getPromoCodeStatus(xmas, now)).toBe('active')
  })

  it('is active with only a future stay window', () => {
    expect(getPromoCodeStatus(code({ stayWindows: [{ from: '2026-12-20T00:00:00Z', until: '2027-01-05T00:00:00Z' }] }), now)).toBe('active')
  })

  it('is inactive before its booking window opens', () => {
    expect(getPromoCodeStatus(code({ bookingWindows: [{ from: '2026-11-01T00:00:00Z', until: '2026-12-01T00:00:00Z' }] }), now)).toBe('inactive')
  })

  it('is inactive when switched off', () => {
    expect(getPromoCodeStatus(code({ active: false }), now)).toBe('inactive')
  })

  it('is expired once every booking window has ended', () => {
    expect(getPromoCodeStatus(code({ bookingWindows: [{ from: '2026-01-01T00:00:00Z', until: '2026-06-01T00:00:00Z' }] }), now)).toBe('expired')
  })

  it('is expired once every stay window has ended, even if booking is still open', () => {
    const stale = code({
      bookingWindows: [{ from: '2026-01-01T00:00:00Z', until: '2026-12-31T00:00:00Z' }],
      stayWindows: [{ from: '2026-06-01T00:00:00Z', until: '2026-08-31T00:00:00Z' }],
    })
    expect(getPromoCodeStatus(stale, now)).toBe('expired')
  })

  it('is active with no windows at all', () => {
    expect(getPromoCodeStatus(code(), now)).toBe('active')
  })
})
