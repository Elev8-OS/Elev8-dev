// Owner Document Center — shared state + owner-scoped selectors (Flow 10A).
//
// Documents are filtered at the composable level: a document is visible to
// an owner when it is shared with ALL owners mapped to its listings OR
// explicitly assigned to that specific owner. The specific-owner path is
// what keeps co-ownership contract terms isolated.

import type { AlertType } from '~/components/notifications/data/alerts'
import type { OwnerDocument, OwnerDocumentUploadInput } from '~/components/owners/data/owner-documents'
import { mockOwnerDocuments } from '~/components/owners/data/owner-documents'
import { useNotifications } from '~/composables/useNotifications'
import { useOwners } from '~/composables/useOwners'

export type UploadDocumentResult
  = | { ok: true, document: OwnerDocument }
    | { ok: false, error: string }

export type UpdateDocumentVersionResult
  = | { ok: true, document: OwnerDocument }
    | { ok: false, error: string }

export type DownloadDocumentResult
  = | { ok: true, fileName: string }
    | { ok: false, error: string }

function nowIso(): string {
  return new Date().toISOString()
}

function deriveUniqueId(prefix: string, isTaken: (id: string) => boolean): string {
  let id = ''
  do {
    id = `${prefix}-${globalThis.crypto.randomUUID()}`
  } while (isTaken(id))
  return id
}

export function useOwnerDocuments() {
  const documents = useState<OwnerDocument[]>(
    'elev8-owner-documents',
    () => structuredClone(mockOwnerDocuments),
  )

  function documentIdTaken(id: string): boolean {
    return documents.value.some(d => d.id === id)
  }

  /**
   * Owner-scoped visibility (isolation invariant — the owner filter is outer).
   *
   * A document is visible when:
   *   - `visibility === 'all_owners'` and the owner is mapped to one of the
   *     document's listings, or
   *   - `visibility === 'specific_owner'` and the owner id is in `ownerIds`.
   *
   * Co-owners of the same property never see documents assigned only to the
   * other co-owner.
   */
  /** Listings an owner is mapped to, read from live state (not the seed array). */
  function listingIdsForOwner(ownerId: string): Set<string> {
    const { mappings } = useOwners()
    return new Set(
      mappings.value
        .filter(m => m.ownerId === ownerId)
        .map(m => m.listingId),
    )
  }

  /**
   * The owners who can see a document — the inverse of `getDocumentsForOwner`.
   * `specific_owner` names them directly; `all_owners` resolves the listings
   * to every owner mapped to them. Returns an empty array when a document has
   * no audience at all (e.g. a listing with no owners yet).
   */
  function audienceForDocument(doc: OwnerDocument): string[] {
    if (doc.visibility === 'specific_owner')
      return [...new Set(doc.ownerIds)]
    const { mappings } = useOwners()
    const listingIds = new Set(doc.listingIds ?? [])
    return [...new Set(
      mappings.value
        .filter(m => listingIds.has(m.listingId))
        .map(m => m.ownerId),
    )]
  }

  function getDocumentsForOwner(ownerId: string): OwnerDocument[] {
    const ownerListingIds = listingIdsForOwner(ownerId)
    return documents.value
      .filter((doc) => {
        if (doc.visibility === 'specific_owner')
          return doc.ownerIds.includes(ownerId)
        return (doc.listingIds ?? []).some(listingId => ownerListingIds.has(listingId))
      })
      .slice()
      .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
  }

  /**
   * Staff uploads a new document (version 1).
   *
   * The `DOCUMENT_UPLOADED` alert this fires is a STAFF-side alert — it lands
   * in the staff bell, not with the owner. The owner portal has no
   * notification surface, so an owner discovers a new document by opening
   * their Documents page. Do not describe this as notifying the owner.
   */
  function uploadDocument(input: OwnerDocumentUploadInput, uploadedBy: string): UploadDocumentResult {
    const title = input.title.trim()
    if (!title)
      return { ok: false, error: 'Title is required.' }
    if (input.visibility === 'specific_owner' && (!input.ownerIds || input.ownerIds.length === 0))
      return { ok: false, error: 'Pick at least one owner for a specific-owner document.' }
    if (input.visibility === 'all_owners' && (!input.listingIds || input.listingIds.length === 0))
      return { ok: false, error: 'Pick at least one listing for an all-owners document.' }

    const timestamp = nowIso()
    const document: OwnerDocument = {
      id: deriveUniqueId('odoc', documentIdTaken),
      title,
      category: input.category,
      fileName: input.fileName ?? `${title.replace(/\s+/g, '-').toLowerCase()}.pdf`,
      fileSize: input.fileSize ?? input.content?.length ?? 512,
      mimeType: input.mimeType ?? 'application/pdf',
      uploadedBy,
      uploadedAt: timestamp,
      visibility: input.visibility,
      ownerIds: input.visibility === 'specific_owner' ? (input.ownerIds ?? []) : [],
      listingIds: input.visibility === 'all_owners' ? (input.listingIds ?? []) : undefined,
      version: 1,
      content: input.content ?? `MOCK DOCUMENT\n\n${title}\n\nUploaded by ${uploadedBy} on ${timestamp}.`,
    }
    documents.value = [...documents.value, document]

    useNotifications().createAlert('DOCUMENT_UPLOADED' as AlertType, 'INFO', {
      documentId: document.id,
      documentTitle: document.title,
      category: document.category,
      ownerIds: document.ownerIds,
      listingIds: document.listingIds,
    })

    return { ok: true, document }
  }

  /**
   * Upload a revised version of an existing document. The previous version is
   * kept in the chain via `previousVersionId` — history is never deleted.
   */
  function updateDocumentVersion(documentId: string, content: string, uploadedBy: string): UpdateDocumentVersionResult {
    const current = documents.value.find(d => d.id === documentId)
    if (!current)
      return { ok: false, error: 'Document not found.' }

    const version = current.version + 1
    const updated: OwnerDocument = {
      ...current,
      version,
      previousVersionId: current.id,
      fileName: current.fileName.replace(/(\.\w+)$/, `-v${version}$1`),
      uploadedBy,
      uploadedAt: nowIso(),
      content,
      id: deriveUniqueId('odoc', documentIdTaken),
    }
    documents.value = [...documents.value, updated]

    useNotifications().createAlert('DOCUMENT_UPLOADED' as AlertType, 'INFO', {
      documentId: updated.id,
      documentTitle: updated.title,
      category: updated.category,
      ownerIds: updated.ownerIds,
      listingIds: updated.listingIds,
      version: updated.version,
    })

    return { ok: true, document: updated }
  }

  /** Full version chain for a document, oldest first. */
  function getDocumentHistory(documentId: string): OwnerDocument[] {
    const chain: OwnerDocument[] = []
    let cursor: OwnerDocument | undefined = documents.value.find(d => d.id === documentId)
    while (cursor) {
      chain.unshift(cursor)
      cursor = documents.value.find(d => d.id === cursor!.previousVersionId)
    }
    return chain
  }

  /**
   * Synthesize a downloadable file from the document's mock content using a
   * Blob URL (same pattern as the existing export utilities).
   */
  function downloadDocument(documentId: string): DownloadDocumentResult {
    const document = documents.value.find(d => d.id === documentId)
    if (!document)
      return { ok: false, error: 'Document not found.' }

    if (typeof window === 'undefined')
      return { ok: true, fileName: document.fileName }

    const blob = new Blob([document.content], { type: document.mimeType })
    const url = URL.createObjectURL(blob)
    const anchor = window.document.createElement('a')
    anchor.href = url
    anchor.download = document.fileName
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    return { ok: true, fileName: document.fileName }
  }

  return {
    documents,
    getDocumentsForOwner,
    audienceForDocument,
    uploadDocument,
    updateDocumentVersion,
    getDocumentHistory,
    downloadDocument,
  }
}
