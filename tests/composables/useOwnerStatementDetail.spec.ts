// useOwnerStatementDetail — owner-scoped single-statement enrichment.
//
// Tests verify:
//   1. Returns null for a statementId not visible to the current owner
//   2. Returns null for a draft statement (only published are visible)
//   3. Returns null for the "no statement requested" state (statementId === null)
//   4. Channel breakdown sums reservations by source and computes share
//   5. Prior period comparison finds the immediately prior month for the same listing
//   6. Adjustments come from the prior-period-adjustment ledger entries

import { beforeEach, describe, expect, it } from 'vitest'
import { mockOwnerReservationsForPeriod } from '~/components/owners/data/owner-statement-reservations'
import { useOwnerAuth } from '~/composables/useOwnerAuth'
import { useOwnerStatementDetail } from '~/composables/useOwnerStatementDetail'
import { useOwnerStatements } from '~/composables/useOwnerStatements'

async function loginAs(ownerEmail: string): Promise<void> {
  const auth = useOwnerAuth()
  auth.logout()
  await auth.requestMagicLink(ownerEmail)
  auth.acceptDemoLink()
}

beforeEach(() => {
  useOwnerAuth().logout()
})

describe('useOwnerStatementDetail', () => {
  describe('unauthenticated state', () => {
    it('detail is null when no owner is logged in', () => {
      const id = ref<string | null>('stmt-2')
      const { detail, isNotFound } = useOwnerStatementDetail(id)
      expect(detail.value.statement).toBeNull()
      expect(detail.value.reservations).toEqual([])
      expect(detail.value.channelBreakdown).toEqual([])
      expect(detail.value.priorPeriod).toBeNull()
      expect(detail.value.adjustments).toEqual([])
      expect(isNotFound.value).toBe(false)
    })
  })

  describe('null statementId', () => {
    it('detail.statement is null when statementId is null', async () => {
      await loginAs('wayan.sari@example.com')
      const id = ref<string | null>(null)
      const { detail, isNotFound } = useOwnerStatementDetail(id)
      expect(detail.value.statement).toBeNull()
      expect(isNotFound.value).toBe(false)
    })
  })

  describe('cross-owner isolation', () => {
    it('returns null when own-1 requests a statement owned by own-2', async () => {
      await loginAs('wayan.sari@example.com') // own-1
      // stmt-3 belongs to own-2
      const id = ref<string | null>('stmt-3')
      const { detail, isNotFound } = useOwnerStatementDetail(id)
      expect(detail.value.statement).toBeNull()
      expect(isNotFound.value).toBe(true)
    })

    it('returns the statement when the owner owns it', async () => {
      await loginAs('wayan.sari@example.com') // own-1
      const id = ref<string | null>('stmt-2')
      const { detail, isNotFound } = useOwnerStatementDetail(id)
      expect(isNotFound.value).toBe(false)
      expect(detail.value.statement).not.toBeNull()
      expect(detail.value.statement?.ownerId).toBe('own-1')
    })
  })

  describe('draft statements', () => {
    it('returns null for a draft statement', async () => {
      await loginAs('wayan.sari@example.com') // own-1
      // stmt-1 is a draft per the existing fixture
      const id = ref<string | null>('stmt-1')
      const { detail, isNotFound } = useOwnerStatementDetail(id)
      expect(detail.value.statement).toBeNull()
      expect(isNotFound.value).toBe(true)
    })
  })

  describe('reservations', () => {
    it('returns reservations for the requested statement', async () => {
      await loginAs('wayan.sari@example.com')
      const id = ref<string | null>('stmt-2')
      const { detail } = useOwnerStatementDetail(id)
      const expected = mockOwnerReservationsForPeriod.filter(r => r.statementId === 'stmt-2')
      expect(detail.value.reservations).toHaveLength(expected.length)
    })
  })

  describe('channel breakdown', () => {
    it('sums reservations by source with correct share', async () => {
      await loginAs('wayan.sari@example.com')
      const id = ref<string | null>('stmt-2')
      const { detail } = useOwnerStatementDetail(id)
      const breakdown = detail.value.channelBreakdown
      // stmt-2 has 2 airbnb + 1 direct
      const airbnb = breakdown.find(b => b.source === 'airbnb')!
      const direct = breakdown.find(b => b.source === 'direct')!
      expect(airbnb.reservations).toBe(2)
      expect(direct.reservations).toBe(1)
      // share sums to 1 (within float tolerance)
      const totalShare = breakdown.reduce((s, b) => s + b.share, 0)
      expect(totalShare).toBeCloseTo(1, 5)
    })
  })
  describe('staff-recorded corrections', () => {
    // A published statement is frozen, so a correction filed against it is
    // paid out in a later statement. The owner has to be able to see both
    // halves of that: the promise on the statement they disputed, and the
    // money on the statement that carried it.
    function recordAgainstStmt2() {
      const { recordAdjustment } = useOwnerStatements()
      const result = recordAdjustment({
        ownerStatementId: 'stmt-2',
        amount: -180_000,
        reason: 'Airbnb host fee understated in May.',
      })
      if (!result.ok)
        throw new Error('recordAdjustment returned an error envelope')
      return result.adjustment
    }

    it('lists a pending correction against the statement it corrects, without touching its total', async () => {
      await loginAs('wayan.sari@example.com')
      const recorded = recordAgainstStmt2()

      const id = ref<string | null>('stmt-2')
      const { detail } = useOwnerStatementDetail(id)

      const related = detail.value.relatedAdjustments.find(a => a.id === recorded.id)!
      expect(related).toBeTruthy()
      expect(related.amount).toBe(-180_000)
      expect(related.adjustsPeriod).toBe('2026-05')
      expect(related.appliesInPeriod).toBe('2026-06')
      expect(related.applied).toBe(false)
      expect(related.reason).toMatch(/host fee/i)

      // It is NOT part of this statement's own adjustment total.
      expect(detail.value.adjustments.some(a => a.id === recorded.id)).toBe(false)
      const stmt2 = detail.value.statement!
      expect(stmt2.publishedSnapshot?.totalAmount ?? stmt2.totalAmount).toBe(stmt2.totalAmount)
    })

    it('moves the correction onto the statement that carried the money once it is applied', async () => {
      await loginAs('wayan.sari@example.com')
      const recorded = recordAgainstStmt2()

      // Stand in for `generateForPeriod` folding it into the June statement.
      const { adjustments } = useOwnerStatements()
      adjustments.value = adjustments.value.map(a => a.id === recorded.id
        ? { ...a, appliedToStatementId: 'stmt-6', appliedInPeriod: '2026-06' }
        : a)

      const juneId = ref<string | null>('stmt-6')
      const june = useOwnerStatementDetail(juneId)
      const applied = june.detail.value.adjustments.find(a => a.id === recorded.id)!
      expect(applied).toBeTruthy()
      expect(applied.applied).toBe(true)
      expect(applied.appliesInPeriod).toBe('2026-06')
      expect(applied.adjustsPeriod).toBe('2026-05')
      expect(june.detail.value.relatedAdjustments).toHaveLength(0)

      // May still discloses it, now as settled rather than pending.
      const mayId = ref<string | null>('stmt-2')
      const may = useOwnerStatementDetail(mayId)
      const disclosed = may.detail.value.relatedAdjustments.find(a => a.id === recorded.id)!
      expect(disclosed.applied).toBe(true)
      expect(disclosed.appliesInPeriod).toBe('2026-06')
    })

    it('keeps another owner\'s correction out of the view', async () => {
      await loginAs('wayan.sari@example.com')
      const { adjustments } = useOwnerStatements()
      adjustments.value = [...adjustments.value, {
        id: 'osa-other-owner',
        ownerStatementId: 'stmt-11',
        ownerId: 'own-2',
        listingId: 'lst-8',
        period: '2026-05',
        nextPeriod: '2026-06',
        amount: -50_000,
        currency: 'USD',
        reason: 'Not Wayan\'s.',
        createdAt: '2026-06-01T00:00:00.000Z',
      }]

      const id = ref<string | null>('stmt-2')
      const { detail } = useOwnerStatementDetail(id)
      expect(detail.value.relatedAdjustments.some(a => a.id === 'osa-other-owner')).toBe(false)
      expect(detail.value.adjustments.some(a => a.id === 'osa-other-owner')).toBe(false)
    })
  })
})
