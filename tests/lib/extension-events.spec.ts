import type { ReservationEntry, StayExtension } from '~/components/reservations/data/reservations'
import { describe, expect, it } from 'vitest'
import { extensionEvents, unpaidExtensions } from '~/components/reservations/data/extension-events'

function ext(over: Partial<StayExtension> = {}): StayExtension {
  return {
    id: 'ext-1',
    direction: 'after',
    previousCheckOut: '2030-03-04',
    newCheckOut: '2030-03-06',
    extraNights: 2,
    nightlyRate: 100,
    amount: 200,
    currency: 'USD',
    paymentMethod: 'payment_link',
    paymentStatus: 'pending',
    createdAt: '2030-03-01T10:00:00.000Z',
    createdBy: 'Komang',
    ...over,
  }
}

function stay(extensions: StayExtension[]): ReservationEntry {
  return { id: 'res-x', extensions } as ReservationEntry
}

describe('extensionEvents', () => {
  it('is empty for a stay without extensions', () => {
    expect(extensionEvents(stay([]))).toEqual([])
    expect(extensionEvents(null)).toEqual([])
  })

  it('tells a pending extension in amber with the money format', () => {
    const [created] = extensionEvents(stay([ext()]))
    expect(created).toMatchObject({ kind: 'created', tone: 'pending', title: 'Stay extended by 2 nights' })
    expect(created!.detail).toContain('USD 200.00')
    expect(created!.detail).toContain('payment pending')
  })

  it('adds a paid line after the created one, and calls an early arrival by its name', () => {
    const events = extensionEvents(stay([ext({
      direction: 'before',
      previousCheckIn: '2030-03-01',
      newCheckIn: '2030-02-28',
      previousCheckOut: undefined,
      newCheckOut: undefined,
      extraNights: 1,
      paymentStatus: 'paid',
      paidAt: '2030-03-02T09:00:00.000Z',
    })]))
    expect(events.map(e => e.kind)).toEqual(['created', 'paid'])
    expect(events[0]!.title).toBe('Early arrival by 1 night')
    expect(events[1]).toMatchObject({ title: 'Extension paid', tone: 'ok' })
  })

  it('does not repeat a payment made when the extension was created', () => {
    const events = extensionEvents(stay([ext({ paymentStatus: 'paid', paymentMethod: 'already_paid', paidAt: '2030-03-01T10:00:00.000Z' })]))
    expect(events.map(e => e.kind)).toEqual(['created'])
    expect(events[0]!.tone).toBe('ok')
  })

  it('lists a cancellation last and sorts every extension by time', () => {
    const events = extensionEvents(stay([
      ext({ id: 'late', createdAt: '2030-03-03T10:00:00.000Z' }),
      ext({ id: 'early', createdAt: '2030-03-01T10:00:00.000Z', cancelledAt: '2030-03-05T10:00:00.000Z' }),
    ]))
    expect(events.map(e => e.id)).toEqual(['early-created', 'late-created', 'early-cancelled'])
    expect(events.at(-1)).toMatchObject({ tone: 'muted', title: 'Extension cancelled' })
  })
})

describe('unpaidExtensions', () => {
  it('counts only active extensions still waiting for money', () => {
    const list = unpaidExtensions(stay([
      ext({ id: 'a' }),
      ext({ id: 'b', paymentStatus: 'paid' }),
      ext({ id: 'c', cancelledAt: '2030-03-02T00:00:00.000Z' }),
    ]))
    expect(list.map(e => e.id)).toEqual(['a'])
  })
})
