// Owner statement PDF generation — builds a polished A4 PDF from a published
// owner statement, mirroring the reference layout: branded header, property +
// owner info, owner split / cost share, a large payout figure, a summary of
// revenue and deductions, and a per-booking table.

import { jsPDF as JsPdf } from 'jspdf'
import type { OwnerStatement, OwnerStatementLine } from '~/components/owners/data/owner-statements'
import type { Owner, OwnerPropertyMapping } from '~/components/owners/data/owners'
import type { OwnerReservationForStatement } from '~/components/owners/data/owner-statement-reservations'
import type { OwnerOperationalFee } from '~/components/owners/data/owner-operational-fees'
import type { Listing } from '~/components/listings/data/listings'

const PAGE_WIDTH = 210 // A4 mm
const MARGIN = 16
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2

interface StatementPdfInput {
  statement: OwnerStatement
  owner: Owner | undefined
  listing: Listing | undefined
  mapping?: OwnerPropertyMapping
  operationalFee?: OwnerOperationalFee
  reservations: OwnerReservationForStatement[]
}

function fmtCurrency(amount: number, currency: string): string {
  const grouped = Math.abs(amount).toLocaleString('de-CH').replace(/\./g, "'")
  const sign = amount < 0 ? '−' : ''
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

/**
 * Generate a polished A4 owner statement PDF.
 * Returns a Blob; also triggers a browser download when `download` is true.
 */
export function buildOwnerStatementPdf(input: StatementPdfInput, opts: { download?: boolean } = {}): Blob {
  const { statement, owner, listing, mapping, operationalFee, reservations } = input
  const doc = new JsPdf({ unit: 'mm', format: 'a4' })
  const currency = statement.currency || 'IDR'
  let y = 20

  // --- Brand header ------------------------------------------------------
  doc.setFillColor(17, 24, 39) // slate-900
  doc.rect(0, 0, PAGE_WIDTH, 34, 'F')
  doc.setTextColor(255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('ELEV8 PROPERTY GROUP', MARGIN, 15)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text('OWNER STATEMENT', MARGIN, 22)
  doc.setFontSize(8)
  doc.text(`${periodRange(statement.period)}`, PAGE_WIDTH - MARGIN, 15, { align: 'right' })
  doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')}`, PAGE_WIDTH - MARGIN, 22, { align: 'right' })

  // --- Property + owner info ---------------------------------------------
  y = 44
  doc.setTextColor(30)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.text(listing?.name ?? statement.listingId, MARGIN, y)
  doc.setFontSize(9)
  doc.setTextColor(120)
  doc.text(`${listing?.location ?? ''}${listing?.country ? `, ${listing.country}` : ''}`, MARGIN, y + 5)

  doc.setFontSize(10)
  doc.setTextColor(30)
  doc.text(owner?.name ?? 'Owner', MARGIN, y + 15)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(120)
  doc.text(owner?.email ?? '', MARGIN, y + 20)

  // Owner split + cost share boxes
  const boxY = y + 26
  doc.setFillColor(241, 245, 249)
  doc.roundedRect(MARGIN, boxY, 70, 16, 2, 2, 'F')
  doc.setTextColor(120)
  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.text('OWNER SPLIT', MARGIN + 4, boxY + 5)
  doc.setFontSize(12)
  doc.setTextColor(30)
  doc.text(`${mapping?.ownershipPercentage ?? 100}%`, MARGIN + 4, boxY + 12)

  doc.setFillColor(241, 245, 249)
  doc.roundedRect(MARGIN + 74, boxY, 70, 16, 2, 2, 'F')
  doc.setTextColor(120)
  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.text('COST SHARE', MARGIN + 78, boxY + 5)
  doc.setFontSize(12)
  doc.setTextColor(30)
  doc.text(`${operationalFee?.percentage ?? 100}%`, MARGIN + 78, boxY + 12)

  // --- Owner payout (large figure) ---------------------------------------
  y = boxY + 34
  doc.setTextColor(120)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.text('OWNER PAYOUT', MARGIN, y)
  doc.setFontSize(26)
  doc.setTextColor(22, 163, 74)
  doc.setFont('helvetica', 'bold')
  doc.text(fmtCurrency(statement.totalAmount, currency), MARGIN, y + 12)

  doc.setFontSize(8)
  doc.setTextColor(120)
  doc.setFont('helvetica', 'normal')
  doc.text(
    `${monthLabel(statement.period)} · ${reservations.length} bookings`,
    MARGIN, y + 20,
  )

  // --- Summary (revenue + deductions) ------------------------------------
  y = y + 32
  doc.setDrawColor(226, 232, 240)
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(30)
  doc.text('Summary', MARGIN, y + 8)

  const summaryLines: Array<{ label: string, amount: number }> = []
  for (const line of statement.lines) {
    // Skip the net payout — we render it separately; keep the rest.
    summaryLines.push({ label: line.label, amount: line.amount })
  }

  y += 16
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  for (const line of summaryLines) {
    doc.setTextColor(80)
    doc.text(line.label, MARGIN, y)
    doc.setTextColor(line.amount < 0 ? 220 : 30)
    doc.text(fmtCurrency(line.amount, currency), PAGE_WIDTH - MARGIN, y, { align: 'right' })
    y += 5.5
  }

  // --- Bookings table ----------------------------------------------------
  y += 6
  doc.setDrawColor(226, 232, 240)
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(30)
  doc.text(`Bookings in period (${reservations.length})`, MARGIN, y + 8)
  y += 14

  const cols = [
    { x: MARGIN, w: 40, label: 'Guest' },
    { x: MARGIN + 40, w: 24, label: 'Nights' },
    { x: MARGIN + 64, w: 30, label: 'Gross' },
    { x: MARGIN + 94, w: 28, label: 'Channel fee' },
    { x: MARGIN + 122, w: 30, label: 'Net to owner' },
  ]

  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(120)
  for (const col of cols)
    doc.text(col.label, col.x, y)

  y += 4
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(50)
  doc.setFontSize(8)
  for (const res of reservations) {
    doc.text(res.guestName, cols[0]!.x, y)
    doc.text(String(res.nights), cols[1]!.x, y)
    doc.text(fmtCurrency(res.grossAmount, currency), cols[2]!.x, y)
    doc.text(fmtCurrency(res.channelFee, currency), cols[3]!.x, y)
    doc.text(fmtCurrency(res.netToOwner, currency), cols[4]!.x, y)
    y += 5
  }

  // --- Footer ------------------------------------------------------------
  doc.setFontSize(7)
  doc.setTextColor(150)
  doc.text(
    'Generated by Elev8 Owner Portal · Please contact your property manager with any questions.',
    MARGIN, 292,
  )

  const blob = doc.output('blob')
  if (opts.download && typeof window !== 'undefined') {
    const url = URL.createObjectURL(blob)
    const anchor = window.document.createElement('a')
    anchor.href = url
    anchor.download = `Owner Statement — ${listing?.name ?? statement.listingId} — ${statement.period}.pdf`
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return blob
}
