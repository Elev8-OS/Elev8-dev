import type { TernApiClient } from './client'
import type { TernBooking, TernBookingNote, TernClaim, TernClaimNote, TernDocument, TernFileType, TernListResponse } from './types'
import { TernApiError } from './client'

/**
 * An in-memory Tern for the demo and the tests. It follows the spec's contract,
 * including what it lacks (no modStamp filter on the claim list): it assigns ids
 * and display ids, stamps `modStamp` on every write (strictly increasing, so a
 * changed record always compares newer), refuses what the real API would refuse
 * (missing required fields, unknown ids), and applies its
 * own deductible. `controls` plays Tern's staff: it is what the demo's
 * "Simulate partner response" drives, and it has no counterpart in production.
 */

export interface TernMockOptions {
  /** Tern's deductible per claim. Placeholder, same as `elev8CoverPartner.deductiblePerClaim`. */
  deductible?: number
}

export interface TernMockControls {
  review: (claimId: number, onHold?: boolean) => TernClaim
  requestFollowUp: (claimId: number, note: string) => TernClaim
  approve: (claimId: number, grossAmount?: number, exGratia?: number) => TernClaim
  deny: (claimId: number, reason: string) => TernClaim
  schedulePayment: (claimId: number, date?: string) => TernClaim
  sendPayment: (claimId: number, reference?: string) => TernClaim
  /** The next `createClaim` is refused with this message, as a 400. */
  failNextCreateClaim: (message: string) => void
  /** Put a claim filed before the client existed into the mock (demo seeds). */
  adoptClaim: (claim: TernClaim) => TernClaim
  claims: () => TernClaim[]
  bookings: () => TernBooking[]
  documents: () => TernDocument[]
  reset: () => void
}

function fileTypeFor(fileName: string): TernFileType | undefined {
  const ext = fileName.split('.').pop()?.toLowerCase()
  return ({ pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic' } as Record<string, TernFileType>)[ext ?? '']
}

function page<T>(items: T[], query: { limit?: number, offset?: number, includeCount?: boolean } = {}): TernListResponse<T> {
  const offset = query.offset ?? 0
  const sliced = items.slice(offset, query.limit !== undefined ? offset + query.limit : undefined)
  return { items: sliced, ...(query.includeCount ? { count: items.length } : {}) }
}

export function createTernMockClient(options: TernMockOptions = {}): { client: TernApiClient, controls: TernMockControls } {
  const deductible = options.deductible ?? 100
  let bookings = new Map<number, TernBooking>()
  let claims = new Map<number, TernClaim>()
  let claimNotes: TernClaimNote[] = []
  let bookingNotes: TernBookingNote[] = []
  let documents: TernDocument[] = []
  let nextId = 1000
  let lastStamp = 0
  let failNext: string | null = null

  const id = () => ++nextId
  // Strictly increasing, even for two writes in the same millisecond.
  function stamp(): string {
    lastStamp = Math.max(Date.now(), lastStamp + 1)
    return new Date(lastStamp).toISOString()
  }
  const today = () => new Date().toISOString().slice(0, 10)
  const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v))

  function need(condition: unknown, field: string) {
    if (!condition)
      throw new TernApiError(400, `${field} is required`)
  }
  function claimOr404(claimId: number): TernClaim {
    const found = claims.get(claimId)
    if (!found)
      throw new TernApiError(404, `Claim ${claimId} not found`)
    return found
  }
  function bookingOr404(bookingId: number): TernBooking {
    const found = bookings.get(bookingId)
    if (!found)
      throw new TernApiError(404, `Booking ${bookingId} not found`)
    return found
  }
  function withDerived(b: TernBooking): TernBooking {
    return { ...clone(b), startDatePassed: b.startDate <= today() }
  }
  function writeClaim(claim: TernClaim): TernClaim {
    const next = { ...claim, modStamp: stamp() }
    claims.set(next.claimId!, next)
    return clone(next)
  }
  function addClaimNote(claimId: number, content: string, visibility: TernClaimNote['visibility']) {
    claimNotes.push({ claimId, claimNoteId: id(), content, visibility, modStamp: stamp() })
  }
  const inRange = (value: string | undefined, from?: string, to?: string) =>
    (!from || (value ?? '') >= from) && (!to || (value ?? '') <= to)

  const client: TernApiClient = {
    async listBooking(query = {}) {
      const items = [...bookings.values()]
        .filter(b => query.organizationId === undefined || b.organizationId === query.organizationId)
        .filter(b => query.active === undefined || b.active === query.active)
        .filter(b => query.bookingNumber === undefined || b.bookingNumber === query.bookingNumber)
        .filter(b => inRange(b.modStamp, query.modStampFrom, query.modStampTo))
        .map(withDerived)
      return page(items, query)
    },
    async createBooking(booking) {
      need(booking.bookingNumber, 'bookingNumber')
      need(booking.clientFirstName, 'clientFirstName')
      need(booking.startDate, 'startDate')
      need(booking.endDate, 'endDate')
      need(typeof booking.organizationId === 'number', 'organizationId')
      const bookingId = id()
      const created: TernBooking = { ...clone(booking), bookingId, bookingDisplayId: `B-${bookingId}`, postedDate: stamp(), modStamp: stamp() }
      bookings.set(bookingId, created)
      return withDerived(created)
    },
    async getBooking(bookingId) {
      return withDerived(bookingOr404(bookingId))
    },
    async updateBooking(bookingId, booking) {
      const existing = bookingOr404(bookingId)
      const next: TernBooking = { ...clone(booking), bookingId, bookingDisplayId: existing.bookingDisplayId, postedDate: existing.postedDate, modStamp: stamp() }
      bookings.set(bookingId, next)
      return withDerived(next)
    },
    async deleteBooking(bookingId) {
      bookingOr404(bookingId)
      bookings.delete(bookingId)
    },

    async listBookingNote(query) {
      const items = bookingNotes.filter(n => n.bookingId === query.parentEntityId && (!query.visibilities || query.visibilities.includes(n.visibility)))
      return page(clone(items), query)
    },
    async createBookingNote(note) {
      bookingOr404(note.bookingId)
      const created = { ...clone(note), bookingNoteId: id(), modStamp: stamp() }
      bookingNotes.push(created)
      return clone(created)
    },

    async listClaim(query = {}) {
      const items = [...claims.values()]
        .filter(c => !query.externalClaimSystemContains || (c.externalClaimSystem ?? '').includes(query.externalClaimSystemContains))
        .filter(c => query.externalClaimId === undefined || c.externalClaimId === query.externalClaimId)
        .filter(c => query.bookingId === undefined || c.bookingId === query.bookingId)
        .filter(c => query.status === undefined || c.status === query.status)
        // ⚠️ No modStamp filter here: Tern's claim list has none (bookings and notes do).
        .sort((a, b) => (a.modStamp ?? '').localeCompare(b.modStamp ?? ''))
      return page(clone(items), query)
    },
    async createClaim(claim) {
      if (failNext) {
        const message = failNext
        failNext = null
        throw new TernApiError(400, message)
      }
      need(claim.claimantName, 'claimantName')
      need(claim.description, 'description')
      need(claim.claimDate, 'claimDate')
      if (claim.bookingId !== undefined)
        bookingOr404(claim.bookingId)
      const claimId = id()
      return writeClaim({
        ...clone(claim),
        claimId,
        claimDisplayId: `C-${String(claimId).padStart(6, '0')}`,
        status: 'Submitted',
        submittedDate: stamp(),
        deductibleApplied: deductible,
      })
    },
    async getClaim(claimId) {
      return clone(claimOr404(claimId))
    },
    async updateClaim(claimId, request) {
      const existing = claimOr404(claimId)
      // Our side may only withdraw or say it answered; everything else is Tern's to set.
      const allowed = request.claim.status === 'Withdrawn' || request.claim.status === 'FollowUpReceived'
      const next = { ...existing, ...(allowed ? { status: request.claim.status } : {}) }
      if (request.publicNote)
        addClaimNote(claimId, request.publicNote, 'Public')
      if (request.internalNote)
        addClaimNote(claimId, request.internalNote, 'Internal')
      return writeClaim(next)
    },
    async deleteClaim(claimId) {
      claimOr404(claimId)
      claims.delete(claimId)
    },
    async exportClaimZip(claimId) {
      claimOr404(claimId)
      return new Blob([`mock export of claim ${claimId}`], { type: 'application/zip' })
    },

    async listClaimNote(query) {
      const items = claimNotes
        .filter(n => n.claimId === query.parentEntityId && (!query.visibilities || query.visibilities.includes(n.visibility)))
        .filter(n => inRange(n.modStamp, query.modStampFrom, query.modStampTo))
        .sort((a, b) => (query.sortDir === 'Desc' ? -1 : 1) * (a.modStamp ?? '').localeCompare(b.modStamp ?? ''))
      return page(clone(items), query)
    },
    async createClaimNote(note) {
      claimOr404(note.claimId)
      const created = { ...clone(note), claimNoteId: id(), modStamp: stamp() }
      claimNotes.push(created)
      return clone(created)
    },

    async listDocument(query = {}) {
      const items = documents
        .filter(d => query.entityType === undefined || d.entityType === query.entityType)
        .filter(d => query.entityId === undefined || d.entityId === query.entityId)
      return page(clone(items), query)
    },
    async uploadDocument(params, file, fileName) {
      if (params.entityType === 'Claim')
        claimOr404(params.entityId)
      if (params.entityType === 'Booking')
        bookingOr404(params.entityId)
      const created: TernDocument = {
        documentId: id(),
        entityId: params.entityId,
        entityType: params.entityType,
        fileName,
        fileSize: file.size,
        fileType: fileTypeFor(fileName),
        uploadedDate: stamp(),
        visibility: params.visibility ?? 'Public',
        ...(params.notes ? { notes: params.notes } : {}),
      }
      documents.push(created)
      return clone(created)
    },
    async getDocument(documentId) {
      const found = documents.find(d => d.documentId === documentId)
      if (!found)
        throw new TernApiError(404, `Document ${documentId} not found`)
      return clone(found)
    },
    async downloadDocument(documentId) {
      await client.getDocument(documentId)
      return new Blob([])
    },
    async getDocumentMetadata(documentId) {
      await client.getDocument(documentId)
      return { supported: true, aiVerdict: 'None', cameraAndGpsPresent: false }
    },
  }

  const controls: TernMockControls = {
    review: (claimId, onHold) => writeClaim({ ...claimOr404(claimId), status: onHold ? 'OnHold' : 'InReview' }),
    requestFollowUp(claimId, note) {
      addClaimNote(claimId, note, 'Public')
      return writeClaim({ ...claimOr404(claimId), status: 'FollowUpRequested', followUpRequestedDate: stamp() })
    },
    approve(claimId, grossAmount, exGratia) {
      const claim = claimOr404(claimId)
      const gross = grossAmount ?? claim.claimAmount ?? 0
      const applied = claim.deductibleApplied ?? deductible
      return writeClaim({
        ...claim,
        status: 'Approved',
        ternApprovedAmount: gross,
        totalApprovedAmount: gross + (exGratia ?? 0),
        totalNetApprovedAmount: Math.max(0, gross + (exGratia ?? 0) - applied),
        approvedCurrency: claim.claimCurrency,
        ...(exGratia ? { exGratiaPayment: exGratia } : {}),
        resolvedDate: stamp(),
      })
    },
    deny(claimId, reason) {
      addClaimNote(claimId, reason, 'Public')
      return writeClaim({ ...claimOr404(claimId), status: 'Denied', resolvedDate: stamp() })
    },
    schedulePayment: (claimId, date) => writeClaim({ ...claimOr404(claimId), paymentStatus: 'PaymentPending', ...(date ? { followUpDate: date } : {}) }),
    sendPayment: (claimId, reference) => writeClaim({
      ...claimOr404(claimId),
      paymentStatus: 'PaymentSent',
      paymentReference: reference ?? `TRF-${String(Date.now()).slice(-8)}`,
      paymentSentDate: today(),
    }),
    failNextCreateClaim(message) {
      failNext = message
    },
    adoptClaim(claim) {
      const claimId = claim.claimId ?? id()
      return writeClaim({ ...clone(claim), claimId, claimDisplayId: claim.claimDisplayId ?? `C-${String(claimId).padStart(6, '0')}`, deductibleApplied: claim.deductibleApplied ?? deductible })
    },
    claims: () => clone([...claims.values()]),
    bookings: () => [...bookings.values()].map(withDerived),
    documents: () => clone(documents),
    reset() {
      bookings = new Map()
      claims = new Map()
      claimNotes = []
      bookingNotes = []
      documents = []
      failNext = null
    },
  }

  return { client, controls }
}
