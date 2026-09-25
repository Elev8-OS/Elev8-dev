import type { DamageProtectionAssignment } from '~/components/reservations/data/damage-protection'
import { describe, expect, it } from 'vitest'
import { bumpTermsVersion, listingSlots, newPolicyDraft, policyErrors } from '~/components/reservations/data/damage-protection'

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
  const valid = () => ({
    ...newPolicyDraft('USD'),
    name: 'Standard',
    waiver: { pricing: 'flat' as const, rate: 39, coverageCap: 2000, exclusions: [] },
    termsText: 'Terms',
  })

  it('accepts a complete waiver policy', () => {
    expect(policyErrors(valid(), false)).toEqual([])
  })

  it('starts a new policy waiver only and Direct only, and says what is missing', () => {
    const errors = policyErrors(newPolicyDraft('USD'), false)
    expect(errors).toContain('Set the waiver fee.')
    expect(errors).toContain('Set how much the waiver covers.')
    expect(errors).toContain('Write the terms the guest accepts.')
    expect(errors).not.toContain('Turn on at least one booking channel, or no guest is ever asked.')
  })

  it('needs at least one option and at least one channel', () => {
    expect(policyErrors({ ...valid(), offers: [] }, false)).toContain('Offer at least one option: the waiver, the deposit, or both.')
    expect(policyErrors({ ...valid(), channelPolicy: { Direct: 'skip' } }, false))
      .toContain('Turn on at least one booking channel, or no guest is ever asked.')
  })

  it('needs a deposit limit and decision window when the deposit is offered', () => {
    const errors = policyErrors({ ...valid(), offers: ['waiver', 'deposit'], deposit: { pricing: 'flat', rate: 0, settleWithinDays: 0 } }, false)
    expect(errors).toContain('Set the most the guest\'s card may be charged.')
    expect(errors).toContain('Set how many days after check-out you decide on the deposit.')
  })

  it('asks more of a policy used for long stays: a ceiling and wear and tear named', () => {
    const perNight = { ...valid(), waiver: { pricing: 'per_night' as const, rate: 5, coverageCap: 2000, exclusions: [] } }
    expect(policyErrors(perNight, false)).toEqual([])
    const errors = policyErrors(perNight, true)
    expect(errors).toContain('Set a maximum waiver fee: without one, a long stay computes an unbounded fee.')
    expect(errors.some(e => e.includes('wear and tear'))).toBe(true)
  })
})
