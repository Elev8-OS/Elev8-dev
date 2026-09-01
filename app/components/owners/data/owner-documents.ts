// Owner Document Center — documents shared with owners (Flow 10 sub-flow A).
//
// Visibility is per-document, not just per-property: a document can be shared
// with ALL owners mapped to its listings, or with ONE specific owner. The
// latter is what keeps co-ownership terms isolated — a contract that only
// applies to one co-owner must never be visible to the other.

export type OwnerDocumentCategory = 'contract' | 'tax' | 'insurance' | 'invoice' | 'other'

export type OwnerDocumentVisibility = 'all_owners' | 'specific_owner'

export interface OwnerDocument {
  id: string
  title: string
  category: OwnerDocumentCategory
  fileName: string
  fileSize: number
  mimeType: string
  uploadedBy: string
  uploadedAt: string
  visibility: OwnerDocumentVisibility
  /** When `specific_owner` — exactly the owners who may see this document. */
  ownerIds: string[]
  /** When `all_owners` — the listings whose mapped owners may see it. */
  listingIds?: string[]
  version: number
  /** When > 1, the id of the previous version in the chain (revisions are kept, never deleted). */
  previousVersionId?: string
  /** Mock document body used to synthesize a downloadable file. */
  content: string
}

export interface OwnerDocumentUploadInput {
  title: string
  category: OwnerDocumentCategory
  visibility: OwnerDocumentVisibility
  ownerIds?: string[]
  listingIds?: string[]
  /** Taken from the picked file when one is attached; otherwise synthesized from the title. */
  fileName?: string
  fileSize?: number
  mimeType?: string
  content?: string
}

// --- File rules ------------------------------------------------------------
//
// Applied by the upload FORM. `uploadDocument` itself stays file-optional,
// because contracts create their Document Center entry programmatically with
// a generated body and no file (see `useOwnerContracts.ensureContractDocument`).

/** Largest document a staff member can attach. */
export const OWNER_DOCUMENT_MAX_BYTES = 10 * 1024 * 1024

/** Extensions offered in the picker, in the order shown to the user. */
export const OWNER_DOCUMENT_EXTENSIONS = [
  '.pdf',
  '.doc',
  '.docx',
  '.txt',
  '.csv',
  '.md',
  '.json',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
] as const

/** Human-readable summary for the hint under the picker. */
export const OWNER_DOCUMENT_ACCEPT_LABEL = 'PDF, DOC, DOCX, TXT, CSV, MD, JSON, PNG, JPG, WebP'

/** `accept` attribute for the native file input. */
export const OWNER_DOCUMENT_ACCEPT_ATTR = OWNER_DOCUMENT_EXTENSIONS.join(',')

/** Bytes → "8 KB" / "1.4 MB", matching the branding asset formatter. */
export function formatDocumentFileSize(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Validate a picked file against the extension allowlist and the size cap.
 * Returns the inline error message, or `null` when the file is acceptable.
 * Extension-based rather than MIME-based: browsers report inconsistent MIME
 * types for .docx, .csv and .md, so the extension is the reliable signal.
 */
export function validateOwnerDocumentFile(file: { name: string, size: number }): string | null {
  const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
  if (!ext || !(OWNER_DOCUMENT_EXTENSIONS as readonly string[]).includes(ext))
    return `Unsupported file type. Use ${OWNER_DOCUMENT_ACCEPT_LABEL}.`
  if (file.size === 0)
    return 'That file is empty.'
  if (file.size > OWNER_DOCUMENT_MAX_BYTES)
    return `That file is ${formatDocumentFileSize(file.size)}. The limit is ${formatDocumentFileSize(OWNER_DOCUMENT_MAX_BYTES)}.`
  return null
}

export const documentCategoryLabels: Record<OwnerDocumentCategory, string> = {
  contract: 'Contract',
  tax: 'Tax',
  insurance: 'Insurance',
  invoice: 'Invoice',
  other: 'Other',
}

export const documentCategoryIcons: Record<OwnerDocumentCategory, string> = {
  contract: 'lucide:file-signature',
  tax: 'lucide:file-bar-chart',
  insurance: 'lucide:shield-check',
  invoice: 'lucide:receipt',
  other: 'lucide:file-text',
}

// --- Seed fixtures ----------------------------------------------------------

export const mockOwnerDocuments: OwnerDocument[] = [
  {
    id: 'odoc-1',
    title: 'Management Agreement — Villa Luwa (lst-1)',
    category: 'contract',
    fileName: 'management-agreement-villa-luwa.pdf',
    fileSize: 248_320,
    mimeType: 'application/pdf',
    uploadedBy: 'staff-1',
    uploadedAt: '2026-01-16T09:00:00.000Z',
    visibility: 'specific_owner',
    ownerIds: ['own-1'],
    version: 2,
    previousVersionId: 'odoc-1-v1',
    content: `MANAGEMENT AGREEMENT\n\nProperty: 5BR Pool the R Villa Luwa – Serene near Canggu (lst-1)\nOwner: Wayan Sari\n\nThis agreement is a mock document rendered by the Elev8 Document Center.\n\nSection 1 — Management services\nElev8 manages distribution, operations, housekeeping, and maintenance of the property.\n\nSection 2 — Fees\nThe management commission rate is defined by the effective commission rule on file.\n\nSection 3 — Term\nThis agreement is effective from the signed date and continues until terminated by either party.\n\n---\nRevision 2: updated commission clause (see version history).`,
  },
  {
    id: 'odoc-2',
    title: 'Pajak Bumi & Bangunan (PBB) 2026 — lst-1',
    category: 'tax',
    fileName: 'pbb-2026-lst-1.pdf',
    fileSize: 84_210,
    mimeType: 'application/pdf',
    uploadedBy: 'staff-1',
    uploadedAt: '2026-02-01T10:00:00.000Z',
    visibility: 'specific_owner',
    ownerIds: ['own-1'],
    version: 1,
    content: 'TAX DOCUMENT (MOCK)\n\nPBB 2026\nProperty: lst-1\nTaxpayer: Wayan Sari\nAmount due: IDR 4,850,000\n\nThis is a simulated tax document for demo purposes.',
  },
  {
    id: 'odoc-3',
    title: 'Property Insurance Policy 2026 — Pererenan Beach House',
    category: 'insurance',
    fileName: 'insurance-pererenan-2026.pdf',
    fileSize: 512_040,
    mimeType: 'application/pdf',
    uploadedBy: 'staff-2',
    uploadedAt: '2026-03-05T11:30:00.000Z',
    visibility: 'all_owners',
    ownerIds: [],
    listingIds: ['lst-3'],
    version: 1,
    content: 'INSURANCE POLICY (MOCK)\n\nCoverage period: 2026\nProperty: Pererenan Beach House (lst-3)\nCo-owners: I Putu Antara (50%), Ni Kadek Deviani (50%)\n\nBoth co-owners can view this document.',
  },
  {
    id: 'odoc-4',
    title: 'Vendor Invoice — AC Repair Ubud Jungle Villa',
    category: 'invoice',
    fileName: 'invoice-ac-ubud.pdf',
    fileSize: 122_880,
    mimeType: 'application/pdf',
    uploadedBy: 'staff-1',
    uploadedAt: '2026-04-20T08:00:00.000Z',
    visibility: 'specific_owner',
    ownerIds: ['own-2'],
    version: 1,
    content: 'INVOICE (MOCK)\n\nVendor: Bali Cool Air\nService: AC repair — Ubud Jungle Villa (lst-8)\nAmount: IDR 1,200,000\n\nAttached to maintenance record mnt-2.',
  },
  {
    id: 'odoc-5',
    title: 'Annual Tax Report 2025 — Portfolio Summary',
    category: 'tax',
    fileName: 'tax-report-2025.pdf',
    fileSize: 310_500,
    mimeType: 'application/pdf',
    uploadedBy: 'staff-2',
    uploadedAt: '2026-05-01T09:00:00.000Z',
    visibility: 'all_owners',
    ownerIds: [],
    listingIds: ['lst-1', 'lst-3', 'lst-8'],
    version: 1,
    content: 'ANNUAL TAX REPORT 2025 (MOCK)\n\nSummary of withholding/PPh documentation for all managed properties.\n\nThis report is shared with all owners mapped to managed listings.',
  },
]
