import { createError, defineEventHandler, getRequestIP, readBody } from 'h3'
import { validatePromoOnServer } from '../../../utils/onboarding-promo-store'

interface Body {
  code?: unknown
  pmsModel?: unknown
  pricingModel?: unknown
  tenantId?: unknown
}

export default defineEventHandler(async (event) => {
  const body = await readBody<Body>(event)

  if (typeof body?.code !== 'string' || !body.code.trim())
    throw createError({ statusCode: 400, statusMessage: 'A code is required' })
  if (body.pmsModel !== 'PMS_CM' && body.pmsModel !== 'PMS_ONLY' && body.pmsModel !== 'MIGRATION')
    throw createError({ statusCode: 400, statusMessage: 'A valid pmsModel is required' })
  if (body.pricingModel !== 'per_unit' && body.pricingModel !== 'per_booking')
    throw createError({ statusCode: 400, statusMessage: 'A valid pricingModel is required' })

  const tenantId = typeof body.tenantId === 'string' && body.tenantId ? body.tenantId : 'anonymous'
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown-ip'

  const result = validatePromoOnServer({
    code: body.code,
    pmsModel: body.pmsModel,
    pricingModel: body.pricingModel,
    rateLimitKeys: [`tenant:${tenantId}`, `ip:${ip}`],
  })

  // A rejected attempt gets the reason, never the record. Returning the promo
  // would hand a guesser its discount value and remaining redemptions.
  return result.valid ? result : { ...result, promo: null }
})
