import type { ReservationEntry, StayExtension } from '~/components/reservations/data/reservations'
import { isActiveExtension } from '~/components/reservations/data/reservations'

/** One line of an extension's history, as the inbox thread shows it. */
export interface ExtensionEvent {
  id: string
  timestamp: string
  kind: 'created' | 'paid' | 'cancelled'
  title: string
  detail: string
  /** `pending` is amber (money not in yet), `ok` neutral, `muted` for cancelled. */
  tone: 'pending' | 'ok' | 'muted'
}

function money(amount: number, currency: string): string {
  const digits = currency === 'IDR' ? 0 : 2
  const locale = currency === 'CHF' ? 'de-CH' : 'en-US'
  return `${currency} ${amount.toLocaleString(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`
}

function day(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function nights(n: number): string {
  return `${n} night${n === 1 ? '' : 's'}`
}

function range(e: StayExtension): string {
  return e.direction === 'before'
    ? `${day(e.newCheckIn!)} to ${day(e.previousCheckIn!)}`
    : `${day(e.previousCheckOut!)} to ${day(e.newCheckOut!)}`
}

function label(e: StayExtension): string {
  return e.direction === 'before' ? 'Early arrival' : 'Stay extended'
}

/** What happened to a stay's extensions, oldest first: created, paid, cancelled. Derived, so it never goes stale. */
export function extensionEvents(stay: ReservationEntry | null | undefined): ExtensionEvent[] {
  if (!stay?.extensions?.length)
    return []
  const events: ExtensionEvent[] = []
  for (const e of stay.extensions) {
    const paidAtCreate = e.paymentStatus === 'paid' && (!e.paidAt || e.paidAt <= e.createdAt)
    events.push({
      id: `${e.id}-created`,
      timestamp: e.createdAt,
      kind: 'created',
      title: `${label(e)} by ${nights(e.extraNights)}`,
      detail: `${range(e)} · ${money(e.amount, e.currency)}${paidAtCreate ? ' · paid' : ' · payment pending'}`,
      tone: paidAtCreate ? 'ok' : 'pending',
    })
    if (e.paidAt && !paidAtCreate) {
      events.push({
        id: `${e.id}-paid`,
        timestamp: e.paidAt,
        kind: 'paid',
        title: 'Extension paid',
        detail: `${money(e.amount, e.currency)} for ${nights(e.extraNights)}`,
        tone: 'ok',
      })
    }
    if (e.cancelledAt) {
      events.push({
        id: `${e.id}-cancelled`,
        timestamp: e.cancelledAt,
        kind: 'cancelled',
        title: e.direction === 'before' ? 'Early arrival cancelled' : 'Extension cancelled',
        detail: `${nights(e.extraNights)}, ${range(e)}`,
        tone: 'muted',
      })
    }
  }
  return events.sort((a, b) => a.timestamp.localeCompare(b.timestamp))
}

/** An extension still waiting for its money: shown as a marker in the inbox list. */
export function unpaidExtensions(stay: ReservationEntry | null | undefined): StayExtension[] {
  return (stay?.extensions ?? []).filter(e => isActiveExtension(e) && e.paymentStatus === 'pending')
}
