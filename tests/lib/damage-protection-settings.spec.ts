import type { DamageProtectionAssignment } from '~/components/reservations/data/damage-protection'
import { describe, expect, it } from 'vitest'
import { bumpTermsVersion, listingSlots, newPolicyDraft, POLICY_TEMPLATES, policyErrors, policyFromTemplate } from '~/components/reservations/data/damage-protection'

function band(listingId: string, policyId: string, minNights: number, maxNights: number | null): DamageProtectionAssignment {
  return { listingId, policyId, minNights, maxNights }
}

describe('listingSlots', () => {
  it('reads the short and long stay policies off the two standard ranges', () => {
    const assignments = [band('lst-1', 'dp-a', 1, 27), band('lst-1', 'dp-b', 28, null), band('lst-2', 'dp-a', 1, 27)]
    expect(listingSlots(assignments, 'lst-1')).toEqual({ short: 'dp-a', long: 'dp-b', custom: false })
    expect(listingSlots(assignments, 'lst-2')).toEqual({ short: 'dp-a', long: null, custom: false })
    expect(listingSlots(assignments, 'lst-9')).toEqual({ short: null, long: null, custom: false })
  })

  it('marks a listing with any other night range as custom', () => {
    expect(listingSlots([band('lst-1', 'dp-a', 1, 7), band('lst-1', 'dp-b', 8, 27)], 'lst-1').custom).toBe(true)
  })
})

describe('bumpTermsVersion', () => {
  it('increments the trailing number, and appends one when there is none', () => {
    expect(bumpTermsVersion('v1')).toBe('v2')
    expect(bumpTermsVersion('v9')).toBe('v10')
    expect(bumpTermsVersion('2026-3')).toBe('2026-4')
    expect(bumpTermsVersion('v1-long')).toBe('v1-long-2')
  })
})

describe('policyErrors', () => {
  const valid = () => ({ ...newPolicyDraft('USD'), name: 'Standard' })

  it('accepts a policy started from the standard template as it stands', () => {
    expect(policyErrors(valid())).toEqual([])
  })

  it('never asks for a cover amount, only for what the guest is charged', () => {
    const errors = policyErrors({ ...valid(), waiver: { tier: 'bronze', guestPrice: 0 } })
    expect(errors).toEqual(['Set what you charge the guest for the waiver.'])
  })

  it('needs no guest price where only host-paid listings use the policy', () => {
    expect(policyErrors({ ...valid(), waiver: { tier: 'bronze', guestPrice: 0 } }, { guestPaid: false })).toEqual([])
  })

  it('refuses a waiver in a currency Tern does not price, rather than converting', () => {
    expect(policyErrors({ ...valid(), currency: 'IDR' })).toContain('The Bronze cover is not available in IDR yet.')
  })

  it('needs at least one option', () => {
    expect(policyErrors({ ...valid(), offers: [] })).toContain('Offer at least one option: the waiver, the deposit, or both.')
  })

  it('ignores the channel switches while the waiver is on: it covers every channel', () => {
    expect(policyErrors({ ...valid(), channelPolicy: { Direct: 'skip' } })).toEqual([])
  })

  it('needs a channel on a deposit-only policy', () => {
    const depositOnly = policyFromTemplate('deposit_only', 'USD')
    expect(policyErrors(depositOnly)).toEqual([])
    expect(policyErrors({ ...depositOnly, channelPolicy: { Direct: 'skip' } }))
      .toContain('Turn on at least one booking channel, or no guest is ever asked.')
  })

  it('needs a deposit limit and decision window when the deposit is offered', () => {
    const errors = policyErrors({ ...valid(), offers: ['waiver', 'deposit'], deposit: { pricing: 'flat', rate: 0, settleWithinDays: 0 } })
    expect(errors).toContain('Set the most the guest\'s card may be charged.')
    expect(errors).toContain('Set how many days after check-out you decide on the deposit.')
  })

  it('asks a percent deposit used for long stays for a ceiling', () => {
    const percent = { ...valid(), deposit: { pricing: 'percent_of_subtotal' as const, rate: 20, settleWithinDays: 7 } }
    expect(policyErrors(percent)).toEqual([])
    expect(policyErrors(percent, { longStay: true }))
      .toContain('Set a maximum deposit: without one, a long stay computes an unbounded amount.')
  })
})

describe('policy templates', () => {
  it('gives every template a complete policy a tenant can assign without editing', () => {
    for (const template of POLICY_TEMPLATES)
      expect(policyErrors(policyFromTemplate(template.id, 'USD')), template.id).toEqual([])
  })

  it('keeps the long-term template waiver only', () => {
    expect(policyFromTemplate('standard_long', 'USD').offers).toEqual(['waiver'])
  })

  it('records which template a policy came from', () => {
    expect(policyFromTemplate('standard_short', 'USD').templateId).toBe('standard_short')
  })
})
