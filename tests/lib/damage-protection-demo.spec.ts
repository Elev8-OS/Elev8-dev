import { describe, expect, it } from 'vitest'
import { listings } from '~/components/listings/data/listings'
import { damageProtectionDemoCleaningJobs, damageProtectionDemoReservations } from '~/components/reservations/data/damage-protection-demo'
import { seedProtectionAssignments } from '~/components/reservations/data/damage-protection-seed'
import { payoutAccounts } from '~/components/settings/data/payouts'

describe('damage protection demo seeds', () => {
  it('names each stay property the way the listing itself is named', () => {
    for (const stay of damageProtectionDemoReservations) {
      const listing = listings.value.find(l => l.id === stay.listingId)
      expect(stay.listingName, stay.id).toBe(listing?.name)
    }
    for (const job of damageProtectionDemoCleaningJobs)
      expect(job.listingName, job.id).toBe(listings.value.find(l => l.id === job.listingId)?.name)
  })

  it('put the 60-night stay where it overlaps no other demo stay, with a long-stay policy and a USD account behind it', () => {
    const long = damageProtectionDemoReservations.find(r => r.id === 'res-dp-long-stay')!
    expect(long.listingId).toBe('lst-18')
    const others = damageProtectionDemoReservations.filter(r => r.id !== long.id && r.listingId === long.listingId && r.status !== 'cancelled')
    expect(others.filter(r => r.checkIn < long.checkOut && r.checkOut > long.checkIn)).toEqual([])
    expect(seedProtectionAssignments.some(a => a.listingId === 'lst-18' && a.policyId === 'dp-long-stay')).toBe(true)
    expect(payoutAccounts.value.find(p => p.listingIds.includes('lst-18'))?.currency).toBe('USD')
  })

  it('keep a saved card on every deposit stay, and never a card number', () => {
    const deposits = damageProtectionDemoReservations.filter(r => r.damageProtection?.option === 'deposit')
    expect(deposits.length).toBeGreaterThan(0)
    for (const stay of deposits) {
      const card = stay.damageProtection!.card
      expect(card?.paymentMethodId, stay.id).toMatch(/^pm_/)
      expect(card?.last4, stay.id).toMatch(/^\d{4}$/)
      expect(stay.damageProtection!.chargeMandate, stay.id).toContain('only for damage recorded during my stay')
    }
  })

  it('reach every insurance claim queue on load, and one claim below the deductible', () => {
    const claims = damageProtectionDemoReservations.flatMap(r => r.damageProtection?.claims ?? [])
    const statuses = claims.map(c => c.partnerClaim?.status).filter(Boolean)
    for (const status of ['info_requested', 'approved', 'paid', 'received', 'rejected'])
      expect(statuses, status).toContain(status)
    expect(claims.some(c => !c.partnerClaim && c.coveredAmount > 100)).toBe(true)
    expect(claims.some(c => !c.partnerClaim && c.coveredAmount <= 100)).toBe(true)
  })

  it('write cleaning times in Bali time, which is what the calendar chip reads', () => {
    for (const job of damageProtectionDemoCleaningJobs) {
      expect(job.scheduledAt, job.id).toMatch(/T\d{2}:\d{2}:00\+08:00$/)
      expect(job.scheduledAt.slice(11, 16)).toBe('11:00')
    }
  })
})
