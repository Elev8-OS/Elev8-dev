// Owner statement PDF — the same document design as the guest invoice
// (`folio-invoice-pdf.ts`), so a tenant's paperwork reads as one family:
// clean white page, company block top-left, logo and title top-right, a
// "Statement For" block, grey-header tables, right-aligned subtotals, and a
// two-column closing section with the payout as the hero figure.
//
// Three rules this file exists to keep:
//
//   1. It reads the FROZEN figures. A published statement carries a
//      `publishedSnapshot`, and that is what the owner was told, so that is
//      what the file must say. Live `lines` / `totalAmount` are only the
//      fallback for a statement with no snapshot.
//   2. It prints only what the owner may see. `lines` and the section flags
//      arrive already gated by `ownerStatementFieldForLineCategory`; nothing
//      here re-derives visibility, and nothing is printed "because we have
//      it". A file leaves the building, so a leak here outlives the session.
//   3. It never runs off the page. Every block asks `ensure()` for room
//      first, so a statement with forty bookings paginates instead of writing
//      into the margin.

import type { Listing } from '~/components/listings/data/listings'
import type { OwnerOperationalFee } from '~/components/owners/data/owner-operational-fees'
import type { OwnerReservationForStatement } from '~/components/owners/data/owner-statement-reservations'
import type { OwnerStatement, OwnerStatementLine, OwnerStatementLineCategory } from '~/components/owners/data/owner-statements'
import type { Owner, OwnerPropertyMapping } from '~/components/owners/data/owners'
import type { InvoiceTemplateCompanyDetails } from '~/components/settings/data/invoice-templates'
import { jsPDF as JsPdf } from 'jspdf'
import { useInvoiceTemplates } from '~/composables/useInvoiceTemplates'

const PAGE_WIDTH = 210 // A4 mm
const MARGIN = 16
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2
const FOOTER_Y = 288
const BOTTOM_LIMIT = FOOTER_Y - 8

/** The invoice's palette, so both documents read as one family. */
const INK: [number, number, number] = [17, 24, 39]
const MUTED: [number, number, number] = [100, 116, 139]
const TABLE_HEAD: [number, number, number] = [175, 178, 183]
const RULE: [number, number, number] = [209, 213, 219]

/** Column anchors shared with the invoice. */
const COL_MID = PAGE_WIDTH - MARGIN - 32
const COL_RIGHT = PAGE_WIDTH - MARGIN - 3

/** jsPDF decodes PNG and JPEG. A WebP logo is skipped rather than thrown. */
const EMBEDDABLE_LOGO = /^data:image\/(?:png|jpe?g);base64,/i

const CATEGORY_LABELS: Record<OwnerStatementLineCategory, string> = {
  revenue: 'Revenue',
  expense: 'Expense',
  commission: 'Commission',
  tax: 'Tax',
  fee: 'Fee',
  adjustment: 'Adjustment',
}

export interface StatementPdfAdjustment {
  id: string
  label: string
  amount: number
  reason?: string
  /** Period whose statement carries the money, when that is not this one. */
  appliesInPeriod?: string
  applied?: boolean
}

export interface StatementPdfBranding {
  /** Tenant logo as a data URL. PNG/JPEG only; anything else falls back to the wordmark. */
  logoDataUrl?: string
  /** Fallback wordmark when there is no logo. */
  name?: string
}

export interface StatementPdfInput {
  statement: OwnerStatement
  owner: Owner | undefined
  listing: Listing | undefined
  mapping?: OwnerPropertyMapping
  operationalFee?: OwnerOperationalFee
  reservations: OwnerReservationForStatement[]
  /**
   * Statement lines to print, already filtered to what this owner may see.
   * Omitted means "everything on the snapshot" — only correct for a caller
   * that has no permission context at all.
   */
  lines?: OwnerStatementLine[]
  /** Corrections whose money is inside this statement's total. */
  adjustments?: StatementPdfAdjustment[]
  /** Corrections filed against this statement but paid out in a later one. */
  relatedAdjustments?: StatementPdfAdjustment[]
  /** The owner's postal address, one line each, for the Statement For block. */
  ownerAddressLines?: string[]
  /**
   * The owner's own payout account, one line each. Empty means no account is
   * on file, which the document says in as many words rather than falling
   * back to the manager's account — that is not where this owner gets paid.
   */
  payoutBankLines?: string[]
  /** False when the owner's permissions hide the net payout figure. */
  showPayout?: boolean
  branding?: StatementPdfBranding
  /** Overrides the company block; defaults to the listing's invoice template. */
  company?: Partial<InvoiceTemplateCompanyDetails>
}

function fmtCurrency(amount: number, currency: string): string {
  const grouped = Math.abs(amount).toLocaleString('de-CH').replace(/\./g, '\'')
  // ASCII hyphen, never U+2212: jsPDF's built-in Helvetica is WinAnsi, and a
  // true minus sign renders there as a stray quote mark. Every deduction on
  // this document is negative, so the wrong glyph would show on every line.
  const sign = amount < 0 ? '-' : ''
  return `${sign}${currency} ${grouped}`
}

function monthLabel(period: string): string {
  const [year, month] = period.split('-').map(Number)
  if (!year || !month)
    return period
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

function periodRange(period: string): string {
  const [year, month] = period.split('-').map(Number)
  if (!year || !month)
    return period
  const start = new Date(Date.UTC(year, month - 1, 1))
  const end = new Date(Date.UTC(year, month, 0))
  const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
  return `${fmt(start)} — ${fmt(end)}`
}

function formatShortDate(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime()))
    return String(value)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/** File name the browser save dialog offers. Exported so tests can pin it. */
export function ownerStatementPdfFilename(statement: OwnerStatement, listing: Listing | undefined): string {
  return `Owner Statement — ${listing?.name ?? statement.listingId} — ${statement.period}.pdf`
}

/**
 * Generate an A4 owner statement PDF in the guest-invoice design.
 * Returns a Blob; also triggers a browser download when `download` is true.
 */
export function buildOwnerStatementPdf(input: StatementPdfInput, opts: { download?: boolean } = {}): Blob {
  const { statement, owner, listing, mapping, operationalFee, reservations } = input
  const doc = new JsPdf({ unit: 'mm', format: 'a4' })

  // The frozen snapshot is what the owner was shown. Never re-derive these
  // from the live statement when a snapshot exists.
  const source = statement.publishedSnapshot ?? statement
  const currency = source.currency || statement.currency || 'IDR'
  const totalAmount = source.totalAmount
  const lines = input.lines ?? source.lines
  const adjustments = input.adjustments ?? []
  const relatedAdjustments = input.relatedAdjustments ?? []
  const showPayout = input.showPayout !== false

  // Same company block as the guest invoice, resolved from the same template,
  // so a tenant configures its letterhead once.
  const { getTemplateForListing } = useInvoiceTemplates()
  const template = getTemplateForListing(statement.listingId)
  const company: Partial<InvoiceTemplateCompanyDetails> = { ...template.company, ...input.company }
  const logo = input.branding?.logoDataUrl ?? company.logoDataUrl

  let y = 15

  function ink() {
    doc.setTextColor(INK[0], INK[1], INK[2])
  }
  function muted() {
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2])
  }
  /** Break to a new page when `height` more millimetres would overrun. */
  function ensure(height: number) {
    if (y + height <= BOTTOM_LIMIT)
      return
    doc.addPage()
    y = 20
  }
  /** The grey bar every table and the payout block share with the invoice. */
  function headerBar(x: number, width: number, title: string, rightTitle?: string) {
    doc.setFillColor(TABLE_HEAD[0], TABLE_HEAD[1], TABLE_HEAD[2])
    doc.rect(x, y, width, 6.5, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    ink()
    doc.text(title, x + 3, y + 4.5)
    if (rightTitle)
      doc.text(rightTitle, x + width - 3, y + 4.5, { align: 'right' })
    y += 6.5
  }

  // --- Top left: company block -------------------------------------------
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  ink()
  doc.text((company.companyName || 'ELEV8 PROPERTY GROUP').toUpperCase(), MARGIN, y)
  y += 5

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  const companyLines = [
    company.address,
    [company.postalCode, company.city].filter(Boolean).join(' '),
    [
      company.commercialRegisterNo ? `Reg: ${company.commercialRegisterNo}` : '',
      company.registeredCity ? `Registered: ${company.registeredCity}` : '',
    ].filter(Boolean).join(' · '),
    company.managingDirector ? `Managing Director: ${company.managingDirector}` : '',
    [
      company.email ? `Email: ${company.email}` : '',
      company.phone ? `Phone: ${company.phone}` : '',
    ].filter(Boolean).join(' · '),
    company.website,
    company.vatNumber ? `VAT / Tax ID: ${company.vatNumber}` : '',
  ].filter((line): line is string => Boolean(line))

  for (const line of companyLines) {
    doc.text(line, MARGIN, y)
    y += 4.5
  }

  // --- Top right: logo, title, statement number --------------------------
  let logoRendered = false
  if (logo && EMBEDDABLE_LOGO.test(logo)) {
    try {
      doc.addImage(logo, 'PNG', PAGE_WIDTH - MARGIN - 48, 12, 48, 14, undefined, 'FAST')
      logoRendered = true
    }
    catch {
      // A corrupt or unsupported asset must never cost the owner their
      // statement — fall through to the wordmark.
      logoRendered = false
    }
  }
  if (!logoRendered) {
    const markX = PAGE_WIDTH - MARGIN - 30
    doc.setFillColor(15, 23, 42)
    doc.roundedRect(markX, 13, 8.5, 8.5, 1.5, 1.5, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.text('E8', markX + 4.25, 19, { align: 'center' })
    ink()
    doc.setFontSize(13)
    doc.text(input.branding?.name ?? 'Elev8', markX + 11, 19.5)
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  ink()
  doc.text('Owner Statement', PAGE_WIDTH - MARGIN, 36, { align: 'right' })
  // --- "Statement For" + "Statement Details", side by side ----------------
  //
  // There is no statement document number in this system, so the header
  // carries none: a printed "Statement # stmt-2" would be an internal id
  // dressed up as a reference an owner could quote back.
  y = Math.max(y + 6, 58)
  const bandTop = y

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  ink()
  doc.text('Statement For:', MARGIN, y)
  const detailX = MARGIN + 30
  doc.text((owner?.name ?? 'OWNER').toUpperCase(), detailX, y)

  doc.setFontSize(8.5)
  y += 4.5
  const forLines = [
    owner?.email,
    ...(input.ownerAddressLines ?? []),
    listing?.name ?? statement.listingId,
    listing?.location,
  ].filter((line): line is string => Boolean(line))
  for (const line of forLines) {
    doc.text(line, detailX, y)
    y += 4.5
  }
  const forBottom = y

  // Right column of the same band, flush to the right margin — the same edge
  // the title, the Amount column and the payout figure all align to.
  const detailsRight = PAGE_WIDTH - MARGIN
  let detailsY = bandTop
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  ink()
  doc.text('Statement Details', detailsRight, detailsY, { align: 'right' })
  detailsY += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  const statementDetails = [
    `Period: ${periodRange(statement.period)}`,
    `Owner split: ${mapping?.ownershipPercentage ?? 100}%`,
    `Cost share: ${operationalFee?.percentage ?? 100}%`,
    statement.publishedAt ? `Published: ${formatShortDate(statement.publishedAt)}` : '',
  ].filter((line): line is string => Boolean(line))
  for (const line of statementDetails) {
    doc.text(line, detailsRight, detailsY, { align: 'right' })
    detailsY += 4.5
  }

  y = Math.max(forBottom, detailsY) + 4

  // --- Statement lines table ---------------------------------------------
  if (lines.length > 0) {
    ensure(24)
    const tableTop = y
    headerBar(MARGIN, CONTENT_WIDTH, 'Item', 'Amount')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    ink()
    doc.text('Type', COL_MID, tableTop + 4.5, { align: 'right' })
    y += 5

    for (const line of lines) {
      ensure(7)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8.5)
      ink()
      doc.text(line.label, MARGIN + 3, y)
      doc.setFontSize(7.5)
      muted()
      doc.text(CATEGORY_LABELS[line.category], COL_MID, y, { align: 'right' })
      doc.setFontSize(8.5)
      ink()
      doc.text(fmtCurrency(line.amount, currency), COL_RIGHT, y, { align: 'right' })
      y += 6
    }

    doc.setDrawColor(RULE[0], RULE[1], RULE[2])
    doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y)
    y += 6
  }

  // --- Adjustment details -------------------------------------------------
  //
  // An applied correction is ALREADY one of the items above; this block adds
  // the reason it was filed, never a second amount. Each row says which
  // statement carries the money so the two cannot read as a double count.
  if (adjustments.length > 0 || relatedAdjustments.length > 0) {
    ensure(20)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    ink()
    doc.text('Adjustment details', MARGIN, y)
    y += 6

    const rows = [
      ...adjustments.map(a => ({ ...a, note: 'Included in the items above.' })),
      ...relatedAdjustments.map(a => ({
        ...a,
        note: a.applied
          ? `Paid out in the ${a.appliesInPeriod ?? 'next'} statement.`
          : `Will appear in the ${a.appliesInPeriod ?? 'next'} statement.`,
      })),
    ]

    for (const row of rows) {
      const reasonLines = row.reason
        ? doc.splitTextToSize(row.reason, CONTENT_WIDTH - 40) as string[]
        : []
      ensure(9 + reasonLines.length * 3.8)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8.5)
      ink()
      doc.text(row.label, MARGIN + 3, y)
      doc.text(fmtCurrency(row.amount, currency), COL_RIGHT, y, { align: 'right' })
      y += 4
      doc.setFontSize(7.5)
      muted()
      doc.text(row.note, MARGIN + 3, y)
      y += 3.8
      for (const reasonLine of reasonLines) {
        doc.text(reasonLine, MARGIN + 3, y)
        y += 3.8
      }
      y += 2
    }
    y += 2
  }

  // --- Bookings table -----------------------------------------------------
  if (reservations.length > 0) {
    const guestX = MARGIN + 3
    const nightsX = MARGIN + 78
    const grossX = MARGIN + 112
    const feeX = MARGIN + 146

    function bookingHead() {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7)
      muted()
      doc.text('Guest', guestX, y)
      doc.text('Nights', nightsX, y, { align: 'right' })
      doc.text('Gross', grossX, y, { align: 'right' })
      doc.text('Channel fee', feeX, y, { align: 'right' })
      doc.text('Net to owner', COL_RIGHT, y, { align: 'right' })
      y += 5
    }

    ensure(26)
    headerBar(MARGIN, CONTENT_WIDTH, `Bookings in period (${reservations.length})`)
    y += 5
    bookingHead()

    for (const res of reservations) {
      if (y + 5.5 > BOTTOM_LIMIT) {
        doc.addPage()
        y = 20
        bookingHead()
      }
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8.5)
      ink()
      doc.text(res.guestName, guestX, y)
      doc.text(String(res.nights), nightsX, y, { align: 'right' })
      doc.text(fmtCurrency(res.grossAmount, currency), grossX, y, { align: 'right' })
      doc.text(fmtCurrency(res.channelFee, currency), feeX, y, { align: 'right' })
      doc.text(fmtCurrency(res.netToOwner, currency), COL_RIGHT, y, { align: 'right' })
      y += 5.5
    }
    y += 2
  }

  // --- Two-column closing section ----------------------------------------
  //
  // Measured before it is drawn: the payout box grows a row per category and
  // ends in a 16pt figure, so a fixed guess pushed the hero number through
  // the footer on a statement with five categories.
  const payoutRows = new Map<OwnerStatementLineCategory, number>()
  for (const line of lines)
    payoutRows.set(line.category, (payoutRows.get(line.category) ?? 0) + line.amount)
  // The owner's own account, never the manager's: this block answers "where
  // does my money land", so printing the company's remittance account here
  // would read as an instruction to pay us.
  const bankLines = input.payoutBankLines ?? []
  const missingAccountLines = [
    'No payout account on file.',
    'Add one under Bank Details in your owner portal',
    'so your next payout can be transferred.',
  ]

  const closingHeight = 2 + Math.max(
    // Bank details: heading at lowerY (y + 6), then one 4.5mm line each.
    6 + 5 + Math.max(bankLines.length, missingAccountLines.length) * 4.5,
    // Payout: bar at lowerY - 4.5, its rows, then the 16pt hero and its caption.
    1.5 + 6.5 + 5.5 + payoutRows.size * 4.5 + (showPayout ? 6 + 8 + 5 : 0),
  )
  ensure(closingHeight)

  const lowerY = y + 6
  const rightX = MARGIN + 85
  const rightWidth = PAGE_WIDTH - MARGIN - rightX

  // Left: where the money goes, the invoice's own lower-left block.
  let leftY = lowerY
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  ink()
  doc.text('Payout Account', MARGIN, leftY)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  leftY += 5
  if (bankLines.length > 0) {
    for (const line of bankLines) {
      doc.text(line, MARGIN, leftY)
      leftY += 4.5
    }
  }
  else {
    muted()
    for (const line of missingAccountLines) {
      doc.text(line, MARGIN, leftY)
      leftY += 4.5
    }
    ink()
  }

  // Right: the grey bar and the hero figure, where the invoice puts its
  // payment-method block and its PAID IN FULL stamp.
  y = lowerY - 4.5
  headerBar(rightX, rightWidth, 'Payout', monthLabel(statement.period))

  let payY = y + 5.5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  ink()
  for (const [category, amount] of payoutRows) {
    doc.text(CATEGORY_LABELS[category], rightX + 4, payY)
    doc.text(fmtCurrency(amount, currency), COL_RIGHT, payY, { align: 'right' })
    payY += 4.5
  }

  if (showPayout) {
    const heroY = payY + 6
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    ink()
    doc.text('NET PAYOUT', COL_RIGHT, heroY, { align: 'right' })
    doc.setFontSize(16)
    doc.text(fmtCurrency(totalAmount, currency), COL_RIGHT, heroY + 8, { align: 'right' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    muted()
    doc.text(
      `${reservations.length} booking${reservations.length === 1 ? '' : 's'} in period`,
      COL_RIGHT,
      heroY + 13,
      { align: 'right' },
    )
    y = Math.max(leftY, heroY + 13)
  }
  else {
    y = Math.max(leftY, payY)
  }

  // --- Footer (every page) -----------------------------------------------
  const pageCount = doc.getNumberOfPages()
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    muted()
    doc.text(
      'Generated by Elev8 Owner Portal · Published figures are final. Please contact your property manager with any questions.',
      MARGIN,
      FOOTER_Y,
    )
    if (pageCount > 1)
      doc.text(`Page ${page} of ${pageCount}`, COL_RIGHT, FOOTER_Y, { align: 'right' })
  }

  const blob = doc.output('blob')
  if (opts.download && typeof window !== 'undefined') {
    const url = URL.createObjectURL(blob)
    const anchor = window.document.createElement('a')
    anchor.href = url
    anchor.download = ownerStatementPdfFilename(statement, listing)
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return blob
}
