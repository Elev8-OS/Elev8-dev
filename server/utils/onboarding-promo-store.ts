import type {
  OnboardingPromoCode,
  PmsModel,
  PricingModel,
  PromoValidationResult,
} from '../../app/components/onboarding/data/onboarding'
import {
  normalizePromoCode,
  ONBOARDING_PROMO_CODES,
  PROMO_ATTEMPT_LIMIT,
  PROMO_ATTEMPT_WINDOW_MS,
  validatePromoCode,
} from '../../app/components/onboarding/data/onboarding'

/**
 * Promo codes live on the server because the client must never decide whether a
 * discount is real (PRD 7.6). In app the catalog is an in-process singleton, so
 * a restart resets it, but every rule a real implementation needs is enforced
 * here rather than in the browser.
 */
let catalog: OnboardingPromoCode[] = ONBOARDING_PROMO_CODES.map(p => ({ ...p }))

/** Failed apply attempts, keyed by tenant and by IP, for the hourly limit. */
const failedAttempts = new Map<string, number[]>()

export function getPromoCatalog(): OnboardingPromoCode[] {
  return catalog.map(p => ({ ...p }))
}

export function resetPromoStore(): void {
  catalog = ONBOARDING_PROMO_CODES.map(p => ({ ...p }))
  failedAttempts.clear()
}

function recentFailures(key: string, now: number): number[] {
  const within = (failedAttempts.get(key) ?? []).filter(t => now - t < PROMO_ATTEMPT_WINDOW_MS)
  failedAttempts.set(key, within)
  return within
}

export function isRateLimited(keys: string[], now: number = Date.now()): boolean {
  return keys.some(key => recentFailures(key, now).length >= PROMO_ATTEMPT_LIMIT)
}

function recordFailure(keys: string[], now: number): void {
  for (const key of keys) {
    const within = recentFailures(key, now)
    within.push(now)
    failedAttempts.set(key, within)
  }
}

export interface PromoValidationRequest {
  code: string
  pmsModel: PmsModel
  pricingModel: PricingModel
  /** Rate limit keys. Both the tenant and the caller IP are counted. */
  rateLimitKeys: string[]
}

export function validatePromoOnServer(
  request: PromoValidationRequest,
  now: Date = new Date(),
): PromoValidationResult {
  if (isRateLimited(request.rateLimitKeys, now.getTime())) {
    return {
      valid: false,
      reason: 'rate_limited',
      message: 'Too many code attempts. Try again in an hour, or continue without a code.',
      promo: null,
    }
  }

  const result = validatePromoCode(
    request.code,
    { pmsModel: request.pmsModel, pricingModel: request.pricingModel },
    catalog,
    now,
  )

  if (!result.valid)
    recordFailure(request.rateLimitKeys, now.getTime())

  return result
}

/**
 * Redemption is counted at activation, never at apply. A tenant who applies a
 * code and then abandons checkout leaves the quota untouched (PRD 7.6).
 */
export function redeemPromoOnServer(rawCode: string): OnboardingPromoCode | null {
  const code = normalizePromoCode(rawCode)
  const index = catalog.findIndex(p => p.code === code)
  if (index === -1)
    return null

  const current = catalog[index]!
  if (current.maxRedemptions !== null && current.redemptionCount >= current.maxRedemptions)
    return null

  const updated = { ...current, redemptionCount: current.redemptionCount + 1 }
  catalog = catalog.map((p, i) => (i === index ? updated : p))
  return { ...updated }
}
