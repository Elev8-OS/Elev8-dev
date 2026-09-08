import { beforeEach, describe, expect, it } from 'vitest'
import { PROMO_ATTEMPT_LIMIT, PROMO_ATTEMPT_WINDOW_MS } from '~/components/onboarding/data/onboarding'
import {
  getPromoCatalog,
  isRateLimited,
  redeemPromoOnServer,
  resetPromoStore,
  validatePromoOnServer,
} from '~/server/utils/onboarding-promo-store'

const NOW = new Date('2026-09-07T00:00:00.000Z')

function request(code: string, overrides: Partial<Parameters<typeof validatePromoOnServer>[0]> = {}) {
  return {
    code,
    pmsModel: 'PMS_CM' as const,
    pricingModel: 'per_unit' as const,
    rateLimitKeys: ['tenant:a@example.com', 'ip:127.0.0.1'],
    ...overrides,
  }
}

beforeEach(resetPromoStore)

describe('promo validation on the server', () => {
  it('accepts a live code', () => {
    expect(validatePromoOnServer(request('LAUNCH50'), NOW).valid).toBe(true)
  })

  it('rejects a code scoped to a different model', () => {
    const result = validatePromoOnServer(request('MIGRATE250'), NOW)
    expect(result.valid).toBe(false)
    expect(result.reason).toBe('wrong_pms_model')
  })
})

describe('promo rate limiting', () => {
  it('blocks after ten failed attempts in an hour', () => {
    for (let i = 0; i < PROMO_ATTEMPT_LIMIT; i++)
      expect(validatePromoOnServer(request('NOPE'), NOW).reason).toBe('not_found')

    const blocked = validatePromoOnServer(request('LAUNCH50'), NOW)
    expect(blocked.valid).toBe(false)
    expect(blocked.reason).toBe('rate_limited')
  })

  it('counts only failures, so a tenant applying valid codes is never blocked', () => {
    for (let i = 0; i < PROMO_ATTEMPT_LIMIT * 2; i++)
      expect(validatePromoOnServer(request('LAUNCH50'), NOW).valid).toBe(true)
    expect(isRateLimited(['tenant:a@example.com'], NOW.getTime())).toBe(false)
  })

  it('counts a tenant and an IP separately', () => {
    for (let i = 0; i < PROMO_ATTEMPT_LIMIT; i++)
      validatePromoOnServer(request('NOPE', { rateLimitKeys: ['tenant:a@example.com', 'ip:1.1.1.1'] }), NOW)

    // Same IP, different tenant: still blocked, because the IP hit the ceiling.
    const sameIp = validatePromoOnServer(request('LAUNCH50', { rateLimitKeys: ['tenant:b@example.com', 'ip:1.1.1.1'] }), NOW)
    expect(sameIp.reason).toBe('rate_limited')

    // Different IP and tenant: unaffected.
    const other = validatePromoOnServer(request('LAUNCH50', { rateLimitKeys: ['tenant:c@example.com', 'ip:2.2.2.2'] }), NOW)
    expect(other.valid).toBe(true)
  })

  it('lets the window expire', () => {
    for (let i = 0; i < PROMO_ATTEMPT_LIMIT; i++)
      validatePromoOnServer(request('NOPE'), NOW)
    expect(validatePromoOnServer(request('LAUNCH50'), NOW).reason).toBe('rate_limited')

    const later = new Date(NOW.getTime() + PROMO_ATTEMPT_WINDOW_MS + 1000)
    expect(validatePromoOnServer(request('LAUNCH50'), later).valid).toBe(true)
  })
})

describe('promo redemption', () => {
  it('increments the counter only when called', () => {
    const before = getPromoCatalog().find(p => p.code === 'LAUNCH50')!.redemptionCount
    validatePromoOnServer(request('LAUNCH50'), NOW)
    expect(getPromoCatalog().find(p => p.code === 'LAUNCH50')!.redemptionCount).toBe(before)

    redeemPromoOnServer('LAUNCH50')
    expect(getPromoCatalog().find(p => p.code === 'LAUNCH50')!.redemptionCount).toBe(before + 1)
  })

  it('is case insensitive', () => {
    const before = getPromoCatalog().find(p => p.code === 'LAUNCH50')!.redemptionCount
    expect(redeemPromoOnServer('launch50')).not.toBeNull()
    expect(getPromoCatalog().find(p => p.code === 'LAUNCH50')!.redemptionCount).toBe(before + 1)
  })

  it('refuses to redeem past the maximum', () => {
    // PARTNER100 allows 25 and starts at 3.
    for (let i = 0; i < 22; i++)
      expect(redeemPromoOnServer('PARTNER100')).not.toBeNull()
    expect(getPromoCatalog().find(p => p.code === 'PARTNER100')!.redemptionCount).toBe(25)
    expect(redeemPromoOnServer('PARTNER100')).toBeNull()
  })

  it('marks a code exhausted for the next tenant once the cap is reached', () => {
    for (let i = 0; i < 22; i++)
      redeemPromoOnServer('PARTNER100')
    expect(validatePromoOnServer(request('PARTNER100'), NOW).reason).toBe('exhausted')
  })

  it('returns null for a code that does not exist', () => {
    expect(redeemPromoOnServer('NOPE')).toBeNull()
  })
})
