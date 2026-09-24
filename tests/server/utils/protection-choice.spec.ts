import { describe, expect, it } from 'vitest'
import { validateProtectionChoice } from '../../../server/utils/protection-choice'

const CARD = { paymentMethodId: 'pm_mock_4242', brand: 'visa', last4: '4242', expMonth: 12, expYear: 2028 }
const NOW = new Date('2026-09-24T08:00:00.000Z')

describe('validateProtectionChoice', () => {
  it('accepts a waiver with nothing else', () => {
    expect(validateProtectionChoice({ option: 'waiver' }, NOW)).toEqual({
      ok: true,
      choice: { option: 'waiver', acceptedAt: NOW.toISOString(), termsVersion: 'v1' },
    })
  })

  it('accepts a deposit carrying a saved card and consent, and stores only the card reference', () => {
    const verdict = validateProtectionChoice({ option: 'deposit', card: CARD, chargeConsent: true, termsVersion: 'v2' }, NOW)
    expect(verdict).toEqual({
      ok: true,
      choice: { option: 'deposit', acceptedAt: NOW.toISOString(), termsVersion: 'v2', card: CARD, chargeConsent: true },
    })
  })

  it('refuses a deposit with no saved card, or a card that is not a gateway reference', () => {
    expect(validateProtectionChoice({ option: 'deposit', chargeConsent: true })).toMatchObject({ ok: false })
    expect(validateProtectionChoice({ option: 'deposit', card: { ...CARD, paymentMethodId: 'tok_1' }, chargeConsent: true }))
      .toEqual({ ok: false, message: 'Save a card to choose the deposit' })
  })

  it('refuses a deposit without consent to a charge after check-out', () => {
    expect(validateProtectionChoice({ option: 'deposit', card: CARD }))
      .toEqual({ ok: false, message: 'Agree to the card being charged after check-out to choose the deposit' })
  })

  it('refuses raw card data outright, anywhere in the body', () => {
    const message = 'Card details go to the payment provider, never to this server'
    expect(validateProtectionChoice({ option: 'deposit', card: { ...CARD, number: '4242424242424242' }, chargeConsent: true }))
      .toEqual({ ok: false, message })
    expect(validateProtectionChoice({ option: 'deposit', card: CARD, chargeConsent: true, cvc: '123' } as never))
      .toEqual({ ok: false, message })
    // Even alongside a waiver, which needs no card at all.
    expect(validateProtectionChoice({ option: 'waiver', cardNumber: '4242' } as never)).toEqual({ ok: false, message })
  })

  it('refuses an incomplete card and a missing option', () => {
    expect(validateProtectionChoice({ option: 'deposit', card: { ...CARD, last4: '42' }, chargeConsent: true }))
      .toEqual({ ok: false, message: 'The saved card is incomplete' })
    expect(validateProtectionChoice({})).toEqual({ ok: false, message: 'Pick a waiver or a deposit' })
    expect(validateProtectionChoice(null)).toEqual({ ok: false, message: 'Pick a waiver or a deposit' })
  })
})
