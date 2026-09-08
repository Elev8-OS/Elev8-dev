import { createError, defineEventHandler, readBody } from 'h3'
import { redeemPromoOnServer } from '../../../utils/onboarding-promo-store'

interface Body {
  code?: unknown
}

/**
 * Called once a subscription actually becomes active. Applying a code never
 * touches the counter.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<Body>(event)
  if (typeof body?.code !== 'string' || !body.code.trim())
    throw createError({ statusCode: 400, statusMessage: 'A code is required' })

  const promo = redeemPromoOnServer(body.code)
  return { redeemed: promo !== null, promo }
})
