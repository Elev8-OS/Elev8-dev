// Staff editing a stay's identity documents from the reservation sheet. Every
// guest holds at most one of each kind, only the main guest signs, and the
// generated house rules agreement is never uploaded or removed.

import type { ReservationEntry } from '~/components/reservations/data/reservations'
import { beforeEach, describe, expect, it } from 'vitest'
import { initialReservations } from '~/components/reservations/data/reservations'
import { useReservationsModule } from '~/composables/useReservationsModule'

const MAIN = 'occ-main'
const COMPANION = 'occ-companion'

function stay(): ReservationEntry {
  return {
    ...initialReservations[0]!,
    id: 'res-docs-1',
    guestName: 'Ana Main',
    guests: [
      { id: MAIN, name: 'Ana Main', category: 'adult', isPrimary: true },
      { id: COMPANION, name: 'Ben Companion', category: 'adult' },
    ],
    identity: {
      status: 'pending',
      documents: [
        { id: 'doc-id-main', kind: 'id', name: 'Passport — Ana Main', url: 'data:image/png;base64,AA', uploadedAt: '2026-10-01T10:00:00Z' },
        { id: 'doc-agree-main', kind: 'agreement', name: 'House Rules Agreement (PDF)', uploadedAt: '2026-10-01T10:00:00Z' },
      ],
    },
    activity: [],
  }
}

function docs() {
  const { reservations } = useReservationsModule()
  return reservations.value.find(r => r.id === 'res-docs-1')!.identity!.documents
}

describe('useReservationsModule identity documents', () => {
  beforeEach(() => {
    const { reservations } = useReservationsModule()
    reservations.value = [stay()]
  })

  it('uploads a companion selfie under that guest', () => {
    const { saveGuestDocument } = useReservationsModule()
    expect(saveGuestDocument('res-docs-1', { guestId: COMPANION, kind: 'selfie', fileName: 'ben.jpg', url: 'data:image/png;base64,BB' })).toEqual({ success: true })
    const selfie = docs().find(d => d.kind === 'selfie')!
    expect(selfie).toMatchObject({ guestId: COMPANION, name: 'Selfie — Ben Companion', fileName: 'ben.jpg' })
  })

  it('replaces the main guest ID in place instead of adding a second one', () => {
    const { saveGuestDocument, reservations } = useReservationsModule()
    saveGuestDocument('res-docs-1', { kind: 'id', fileName: 'new-passport.jpg', url: 'data:image/png;base64,CC' })
    const ids = docs().filter(d => d.kind === 'id')
    expect(ids).toHaveLength(1)
    expect(ids[0]).toMatchObject({ id: 'doc-id-main', fileName: 'new-passport.jpg', url: 'data:image/png;base64,CC' })
    expect(ids[0]!.guestId).toBeUndefined()
    expect(reservations.value[0]!.activity.at(-1)?.title).toBe('Document replaced')
  })

  it('refuses a signature from anyone but the main guest', () => {
    const { saveGuestDocument } = useReservationsModule()
    const result = saveGuestDocument('res-docs-1', { guestId: COMPANION, kind: 'signature', fileName: 's.png', url: 'data:image/png;base64,DD' })
    expect(result.success).toBe(false)
    expect(docs().some(d => d.kind === 'signature')).toBe(false)
  })

  it('removes an uploaded document but never the agreement', () => {
    const { removeGuestDocument, reservations } = useReservationsModule()
    removeGuestDocument('res-docs-1', 'doc-agree-main')
    removeGuestDocument('res-docs-1', 'doc-id-main')
    expect(docs().map(d => d.id)).toEqual(['doc-agree-main'])
    expect(reservations.value[0]!.activity.map(a => a.title)).toEqual(['Document removed'])
  })
})
