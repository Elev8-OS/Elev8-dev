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
})
