import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  mockOwnerDocuments,
  OWNER_DOCUMENT_MAX_BYTES,
  validateOwnerDocumentFile,
} from '~/components/owners/data/owner-documents'
import { useOwnerDocuments } from '~/composables/useOwnerDocuments'

interface AlertCall {
  type: string
  severity: string
  context: Record<string, unknown>
}

const notificationsMock = vi.hoisted(() => {
  const callLog: AlertCall[] = []
  return {
    callLog,
    spy: {
      createAlert: (type: string, severity: string, context: Record<string, unknown>) => {
        callLog.push({ type, severity, context })
      },
    },
  }
})

vi.mock('~/composables/useNotifications', () => ({
  useNotifications: () => notificationsMock.spy,
}))

function resetState() {
  const documents = useState('elev8-owner-documents')
  documents.value = structuredClone(mockOwnerDocuments)
  notificationsMock.callLog.length = 0
}

describe('useOwnerDocuments', () => {
  beforeEach(() => {
    resetState()
  })

  it('scopes documents to the owner (specific-owner isolation for co-owners)', () => {
    const { getDocumentsForOwner } = useOwnerDocuments()

    // own-1 (Wayan) owns lst-1 — sees contract + tax + annual report.
    const wayan = getDocumentsForOwner('own-1')
    expect(wayan.map(d => d.id)).toContain('odoc-1') // specific to own-1
    expect(wayan.map(d => d.id)).toContain('odoc-2') // specific to own-1
    expect(wayan.map(d => d.id)).toContain('odoc-5') // all_owners, includes lst-1

    // own-2 (I Putu) owns lst-3 + lst-8 — sees insurance (lst-3), invoice (own-2), annual report.
    const putu = getDocumentsForOwner('own-2')
    expect(putu.map(d => d.id)).toContain('odoc-3') // all_owners lst-3
    expect(putu.map(d => d.id)).toContain('odoc-4') // specific to own-2
    expect(putu.map(d => d.id)).toContain('odoc-5')

    // Co-ownership isolation: own-3 (Ni Kadek) co-owns lst-3 but must NOT see
    // the contract that is specific to own-1, nor the invoice for own-2.
    const kadek = getDocumentsForOwner('own-3')
    expect(kadek.map(d => d.id)).not.toContain('odoc-1')
    expect(kadek.map(d => d.id)).not.toContain('odoc-4')
    // She does see the shared insurance for lst-3 (all_owners).
    expect(kadek.map(d => d.id)).toContain('odoc-3')
  })

  it('uploads a document with version 1 and notifies', () => {
    const { uploadDocument, documents } = useOwnerDocuments()
    const result = uploadDocument({
      title: 'New insurance policy 2027',
      category: 'insurance',
      visibility: 'all_owners',
      listingIds: ['lst-1'],
    }, 'staff-1')

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.document.version).toBe(1)
      expect(result.document.id).toBeTruthy()
    }
    expect(documents.value.length).toBe(mockOwnerDocuments.length + 1)
    expect(notificationsMock.callLog.some(call => call.type === 'DOCUMENT_UPLOADED')).toBe(true)
  })

  it('rejects a specific-owner upload without owners', () => {
    const { uploadDocument } = useOwnerDocuments()
    const result = uploadDocument({
      title: 'Bad upload',
      category: 'contract',
      visibility: 'specific_owner',
    }, 'staff-1')
    expect(result.ok).toBe(false)
    if (!result.ok)
      expect(result.error).toContain('owner')
  })

  it('creates a new version keeping the old one in history', () => {
    const { updateDocumentVersion, getDocumentHistory } = useOwnerDocuments()
    const result = updateDocumentVersion('odoc-1', 'REVISED CONTENT', 'staff-1')

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.document.version).toBe(3) // seed odoc-1 is v2
      expect(result.document.previousVersionId).toBe('odoc-1')
    }
    const history = getDocumentHistory(result.ok ? result.document.id : '')
    expect(history.length).toBeGreaterThanOrEqual(2)
    expect(history[history.length - 1]!.version).toBeGreaterThan(history[0]!.version)
  })

  it('downloads a document via blob and returns the file name', () => {
    const { downloadDocument } = useOwnerDocuments()
    const result = downloadDocument('odoc-2')
    expect(result.ok).toBe(true)
    if (result.ok)
      expect(result.fileName).toContain('pbb-2026')
  })
  it('keeps the real file metadata when a file is attached', () => {
    const { uploadDocument } = useOwnerDocuments()
    const result = uploadDocument({
      title: 'Insurance Policy 2027',
      category: 'insurance',
      visibility: 'all_owners',
      listingIds: ['lst-1'],
      fileName: 'polis-2027.pdf',
      fileSize: 204_800,
      mimeType: 'application/pdf',
      content: 'POLICY BODY',
    }, 'staff-1')

    expect(result.ok).toBe(true)
    if (!result.ok)
      return
    expect(result.document.fileName).toBe('polis-2027.pdf')
    expect(result.document.fileSize).toBe(204_800)
    expect(result.document.mimeType).toBe('application/pdf')
    expect(result.document.content).toBe('POLICY BODY')
  })

  it('still synthesizes filename, size and body when no file is attached', () => {
    const { uploadDocument } = useOwnerDocuments()
    const result = uploadDocument({
      title: 'Board Minutes March',
      category: 'other',
      visibility: 'all_owners',
      listingIds: ['lst-1'],
    }, 'staff-1')

    expect(result.ok).toBe(true)
    if (!result.ok)
      return
    expect(result.document.fileName).toBe('board-minutes-march.pdf')
    expect(result.document.mimeType).toBe('application/pdf')
    expect(result.document.fileSize).toBe(512)
    expect(result.document.content).toContain('Board Minutes March')
  })
  // --- Upload-form file rules ---------------------------------------------

  it('accepts a supported file within the size cap', () => {
    expect(validateOwnerDocumentFile({ name: 'polis-2027.pdf', size: 204_800 })).toBeNull()
    expect(validateOwnerDocumentFile({ name: 'NOTES.TXT', size: 12 })).toBeNull()
    expect(validateOwnerDocumentFile({ name: 'scan.jpeg', size: OWNER_DOCUMENT_MAX_BYTES })).toBeNull()
  })

  it('rejects unsupported extensions, empty files and oversized files', () => {
    expect(validateOwnerDocumentFile({ name: 'archive.zip', size: 100 }))
      .toMatch(/Unsupported file type/)
    expect(validateOwnerDocumentFile({ name: 'noextension', size: 100 }))
      .toMatch(/Unsupported file type/)
    expect(validateOwnerDocumentFile({ name: 'empty.pdf', size: 0 }))
      .toBe('That file is empty.')
    expect(validateOwnerDocumentFile({ name: 'huge.pdf', size: OWNER_DOCUMENT_MAX_BYTES + 1 }))
      .toMatch(/The limit is 10\.0 MB\./)
  })

  // --- Audience resolution (what the upload toast reports) -----------------

  it('resolves the audience of a specific-owner document', () => {
    const { documents, audienceForDocument } = useOwnerDocuments()
    const doc = documents.value.find(d => d.visibility === 'specific_owner')!
    expect(audienceForDocument(doc)).toEqual(doc.ownerIds)
  })

  it('resolves an all-owners document to every owner mapped to its listings', () => {
    const { uploadDocument, audienceForDocument } = useOwnerDocuments()
    // lst-3 is co-owned 50/50 by own-2 and own-3.
    const result = uploadDocument({
      title: 'Shared Villa Notice',
      category: 'other',
      visibility: 'all_owners',
      listingIds: ['lst-3'],
    }, 'staff-1')
    expect(result.ok).toBe(true)
    if (!result.ok)
      return
    expect(audienceForDocument(result.document).sort()).toEqual(['own-2', 'own-3'])
  })

  it('reports an empty audience for a listing nobody owns', () => {
    const { uploadDocument, audienceForDocument } = useOwnerDocuments()
    const result = uploadDocument({
      title: 'Orphan Notice',
      category: 'other',
      visibility: 'all_owners',
      listingIds: ['lst-16'],
    }, 'staff-1')
    expect(result.ok).toBe(true)
    if (!result.ok)
      return
    expect(audienceForDocument(result.document)).toEqual([])
  })
})
