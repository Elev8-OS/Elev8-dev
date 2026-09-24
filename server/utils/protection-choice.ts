import type { GuideSubmission } from '~/components/guest-guides/data/types'

type ProtectionChoice = NonNullable<GuideSubmission['protectionChoice']>

/**
 * Card fields that must never arrive here. The guest's browser hands the card
 * to Stripe, and Stripe hands back a PaymentMethod id; a request carrying any
 * of these means a form is posting raw card data, and it is refused rather
 * than quietly ignored, so the mistake is found instead of logged.
 */
const RAW_CARD_FIELDS = ['number', 'cardNumber', 'pan', 'cvc', 'cvv', 'expiry']

export interface ProtectionChoiceBody {
  option?: unknown
  termsVersion?: unknown
  chargeConsent?: unknown
  card?: Record<string, unknown>
}

/**
 * The public protection-choice endpoint's rules, framework-free so they can be
 * tested without h3. Returns the choice to store, or the reason it is refused.
 * The body never names a reservation: the token does.
 */
export function validateProtectionChoice(
  body: ProtectionChoiceBody | null | undefined,
  now: Date = new Date(),
): { ok: true, choice: ProtectionChoice } | { ok: false, message: string } {
  if (body?.option !== 'waiver' && body?.option !== 'deposit')
    return { ok: false, message: 'Pick a waiver or a deposit' }

  const raw = [body as Record<string, unknown>, body.card ?? {}]
    .some(source => RAW_CARD_FIELDS.some(field => field in source))
  if (raw)
    return { ok: false, message: 'Card details go to the payment provider, never to this server' }

  const termsVersion = typeof body.termsVersion === 'string' ? body.termsVersion : 'v1'
  const acceptedAt = now.toISOString()
  if (body.option === 'waiver')
    return { ok: true, choice: { option: 'waiver', acceptedAt, termsVersion } }

  const card = body.card
  const paymentMethodId = card?.paymentMethodId
  const last4 = card?.last4
  const expMonth = Number(card?.expMonth)
  const expYear = Number(card?.expYear)
  if (typeof paymentMethodId !== 'string' || !paymentMethodId.startsWith('pm_'))
    return { ok: false, message: 'Save a card to choose the deposit' }
  if (typeof last4 !== 'string' || !/^\d{4}$/.test(last4)
    || !Number.isInteger(expMonth) || expMonth < 1 || expMonth > 12 || !Number.isInteger(expYear)) {
    return { ok: false, message: 'The saved card is incomplete' }
  }
  if (body.chargeConsent !== true)
    return { ok: false, message: 'Agree to the card being charged after check-out to choose the deposit' }

  return {
    ok: true,
    choice: {
      option: 'deposit',
      acceptedAt,
      termsVersion,
      card: {
        paymentMethodId,
        brand: typeof card?.brand === 'string' ? card.brand : 'card',
        last4,
        expMonth,
        expYear,
      },
      chargeConsent: true,
    },
  }
}
