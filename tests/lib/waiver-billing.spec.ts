import type { BillableStay } from '~/components/damage-protection/data/waiver-billing'
import type { DamageProtection } from '~/components/reservations/data/reservations'
import { describe, expect, it } from 'vitest'
import {
  billableLines,
  billingDateFor,
  buildPeriodInvoices,
  dayKey,
  periodKey,
  periodLabel,
  periodsDue,
  totalsByCurrency,
  waiverInvoiceNumber,
} from '~/components/damage-protection/data/waiver-billing'

function waiver(patch: Partial<DamageProtection> = {}): DamageProtection {
  return {
    policyId: 'dp-standard',
    option: 'waiver',
    state: 'waiver_active',
    amount: 39,
    currency: 'USD',
    paidBy: 'guest',
    tier: 'bronze',
    elev8Fee: 9,
    termsVersion: 'v1',
    termsText: 'Terms',
    acceptedAt: '2026-08-20T10:00:00.000Z',
    acceptedVia: 'guest_guide',
    ...patch,
  }
}

function stay(id: string, checkOut: string, patch: Partial<BillableStay['reservation']> = {}, protection: Partial<DamageProtection> = {}): BillableStay {
  return {
    reservation: {
      id,
      guestName: `Guest ${id}`,
      listingId: 'lst-1',
      listingName: 'Villa Luwa',
      checkIn: '2026-09-01',
      checkOut,
      status: 'checked_out',
      damageProtection: waiver(protection),
      ...patch,
    },
  }
}

describe('periods', () => {
  it('reads the month and day in local time', () => {
    expect(periodKey(new Date(2026, 8, 30, 23, 30))).toBe('2026-09')
    expect(dayKey(new Date(2026, 9, 1))).toBe('2026-10-01')
    expect(periodLabel('2026-09')).toBe('September 2026')
  })

  it('bills a month on the 1st of the next one, across a year end', () => {
    expect(dayKey(billingDateFor('2026-09'))).toBe('2026-10-01')
    expect(dayKey(billingDateFor('2026-12'))).toBe('2027-01-01')
  })

  it('catches up every 1st that has passed, oldest first, skipping months already billed', () => {
    const now = new Date(2026, 11, 3)
    expect(periodsDue('2026-09', now, new Set())).toEqual(['2026-09', '2026-10', '2026-11'])
    expect(periodsDue('2026-09', now, new Set(['2026-10']))).toEqual(['2026-09', '2026-11'])
  })

  it('bills nothing before the 1st has come', () => {
    expect(periodsDue('2026-09', new Date(2026, 8, 28), new Set())).toEqual([])
    expect(periodsDue('2026-09', new Date(2026, 9, 1), new Set())).toEqual(['2026-09'])
  })
})

describe('billableLines', () => {
  it('bills a covered stay in the month its guest checked out, whoever paid for the waiver', () => {
    const lines = billableLines([
      stay('a', '2026-09-12'),
      stay('b', '2026-09-03', {}, { paidBy: 'host', amount: 0, elev8Fee: 25, tier: 'gold' }),
      stay('c', '2026-10-02'),
    ], '2026-09', new Set())
    expect(lines.map(l => [l.reservationId, l.paidBy, l.fee])).toEqual([['b', 'host', 25], ['a', 'guest', 9]])
  })

  it('never bills a cancelled stay, a deposit, an owner stay or a stay without a frozen fee', () => {
    expect(billableLines([
      stay('cancelled-cover', '2026-09-12', {}, { state: 'cancelled' }),
      stay('cancelled-stay', '2026-09-12', { status: 'cancelled' }),
      stay('deposit', '2026-09-12', {}, { option: 'deposit', state: 'card_on_file' }),
      stay('owner', '2026-09-12', { status: 'owner_request' }),
      stay('no-fee', '2026-09-12', {}, { elev8Fee: undefined }),
      stay('none', '2026-09-12', { damageProtection: undefined }),
    ], '2026-09', new Set())).toEqual([])
  })

  it('never bills a stay twice', () => {
    expect(billableLines([stay('a', '2026-09-12')], '2026-09', new Set(['a']))).toEqual([])
  })

  it('reads the month so far up to a day', () => {
    const lines = billableLines([stay('a', '2026-09-12'), stay('b', '2026-09-29')], '2026-09', new Set(), '2026-09-28')
    expect(lines.map(l => l.reservationId)).toEqual(['a'])
  })
})

describe('invoices', () => {
  const ctx = {
    billTo: { companyName: 'Bali Villas Co.', addressLines: ['Jl. Pantai 1'] },
    paymentMethodId: 'pm_demo',
    cardLabel: 'Visa ending 4242',
    existingInPeriod: 0,
    now: new Date(2026, 9, 1),
  }

  it('keeps each currency on its own invoice, never blended', () => {
    const lines = billableLines([
      stay('a', '2026-09-12'),
      stay('b', '2026-09-13', {}, { currency: 'EUR', elev8Fee: 8 }),
      stay('c', '2026-09-14'),
    ], '2026-09', new Set())
    expect(totalsByCurrency(lines)).toEqual([{ currency: 'EUR', total: 8, count: 1 }, { currency: 'USD', total: 18, count: 2 }])
    const invoices = buildPeriodInvoices(lines, '2026-09', ctx)
    expect(invoices.map(i => [i.number, i.currency, i.total, i.lines.length])).toEqual([
      ['E8-DW-202609-001', 'EUR', 8, 1],
      ['E8-DW-202609-002', 'USD', 18, 2],
    ])
    expect(invoices[1]).toMatchObject({ issuedOn: '2026-10-01', status: 'charging', cardLabel: 'Visa ending 4242' })
    expect(invoices[1]!.lines[0]).not.toHaveProperty('currency')
  })

  it('continues the number within a month', () => {
    expect(waiverInvoiceNumber('2026-09', 3)).toBe('E8-DW-202609-003')
    const lines = billableLines([stay('a', '2026-09-12')], '2026-09', new Set())
    expect(buildPeriodInvoices(lines, '2026-09', { ...ctx, existingInPeriod: 2 })[0]!.number).toBe('E8-DW-202609-003')
  })
})
