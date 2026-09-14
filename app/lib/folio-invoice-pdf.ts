// Guest Folio & Invoice PDF generation
// Builds a clean, professional A4 invoice PDF for a reservation stay and its folio charges.

import type { ReservationEntry } from '~/components/reservations/data/reservations'
import { jsPDF as JsPdf } from 'jspdf'
import {
  buildFolioSummary,
  FOLIO_PAYMENT_METHOD_LABELS,
  folioLineTotal,
} from '~/components/reservations/data/folio'

const PAGE_WIDTH = 210 // A4 mm
const MARGIN = 16
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2

function fmtCurrency(amount: number, currency: string): string {
  const formatted = Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const sign = amount < 0 ? '−' : ''
  return `${sign}${currency} ${formatted}`
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime()))
      return iso
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  }
  catch {
    return iso
  }
}

/**
 * Generate an A4 folio invoice PDF for a reservation.
 * Returns a Blob; triggers browser download when `download` is true.
 */
export function buildFolioInvoicePdf(
  reservation: ReservationEntry,
  opts: { download?: boolean } = {},
): Blob {
  const doc = new JsPdf({ unit: 'mm', format: 'a4' })
  const currency = reservation.currency || 'USD'
  const summary = buildFolioSummary(reservation)
  let y = 15

  // --- Top dark banner ----------------------------------------------------
  doc.setFillColor(15, 23, 42) // slate-900
  doc.rect(0, 0, PAGE_WIDTH, 32, 'F')

  doc.setTextColor(255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.text('ELEV8 PROPERTY GROUP', MARGIN, 13)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(203, 213, 225) // slate-300
  doc.text('GUEST FOLIO & INVOICE', MARGIN, 20)

  // Invoice Number and Date on the right
  const invoiceNum = `INV-${reservation.id.replace(/^res-/, '').toUpperCase()}`
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(255)
  doc.text(invoiceNum, PAGE_WIDTH - MARGIN, 13, { align: 'right' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(203, 213, 225)
  doc.text(`Issue Date: ${new Date().toLocaleDateString('en-GB')}`, PAGE_WIDTH - MARGIN, 20, { align: 'right' })
  doc.text(`Booking Ref: #${reservation.id}`, PAGE_WIDTH - MARGIN, 25, { align: 'right' })

  // --- Stay & Guest Details Box --------------------------------------------
  y = 40

  // Payment status badge banner
  const isPaidInFull = summary.unpaidTotal === 0 && (summary.itemsPaid > 0 || summary.itemsTotal === 0)
  const isPartial = summary.itemsPaid > 0 && summary.unpaidTotal > 0

  if (isPaidInFull) {
    doc.setFillColor(240, 253, 244) // emerald-50
    doc.setDrawColor(187, 247, 208) // emerald-200
    doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 8, 1.5, 1.5, 'FD')
    doc.setTextColor(22, 101, 52) // emerald-800
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text('PAYMENT STATUS: PAID IN FULL', MARGIN + 4, y + 5.5)
  }
  else if (isPartial) {
    doc.setFillColor(254, 252, 232) // yellow-50
    doc.setDrawColor(254, 240, 138) // yellow-200
    doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 8, 1.5, 1.5, 'FD')
    doc.setTextColor(133, 77, 14) // yellow-800
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text(`PAYMENT STATUS: PARTIALLY PAID (DP) · DUE: ${fmtCurrency(summary.unpaidTotal, currency)}`, MARGIN + 4, y + 5.5)
  }
  else {
    doc.setFillColor(248, 250, 252) // slate-50
    doc.setDrawColor(226, 232, 240) // slate-200
    doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 8, 1.5, 1.5, 'FD')
    doc.setTextColor(71, 85, 105) // slate-600
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text(`PAYMENT STATUS: PAYMENT PENDING · BALANCE DUE: ${fmtCurrency(summary.unpaidTotal, currency)}`, MARGIN + 4, y + 5.5)
  }

  y += 14

  // Guest Details (Left column)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(30, 41, 59) // slate-800
  doc.text('BILLED TO', MARGIN, y)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(15, 23, 42)
  doc.text(reservation.guestName, MARGIN, y + 6)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(100, 116, 139)
  if (reservation.guestEmail)
    doc.text(reservation.guestEmail, MARGIN, y + 11)
  if (reservation.guestPhone)
    doc.text(reservation.guestPhone, MARGIN, y + 16)
  if (reservation.guestCountry)
    doc.text(reservation.guestCountry, MARGIN, y + 21)

  // Property & Reservation Details (Right column)
  const rightColX = MARGIN + CONTENT_WIDTH / 2
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(30, 41, 59)
  doc.text('RESERVATION DETAILS', rightColX, y)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(15, 23, 42)
  doc.text(reservation.listingName, rightColX, y + 6)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(100, 116, 139)
  doc.text(`Stay: ${formatDate(reservation.checkIn)} – ${formatDate(reservation.checkOut)} (${reservation.nights} nights)`, rightColX, y + 11)
  doc.text(`Guests: ${reservation.guestCount} (${reservation.guestAdults ?? reservation.guestCount} adults${reservation.guestChildren ? `, ${reservation.guestChildren} children` : ''})`, rightColX, y + 16)
  doc.text(`Channel: ${reservation.channel} · Status: ${reservation.status.toUpperCase()}`, rightColX, y + 21)

  y += 30

  // --- Line Items Table ----------------------------------------------------
  doc.setDrawColor(226, 232, 240)
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y)
  y += 5

  const tableCols = {
    desc: MARGIN,
    qty: MARGIN + 85,
    unitPrice: MARGIN + 105,
    taxSvc: MARGIN + 130,
    status: MARGIN + 150,
    total: PAGE_WIDTH - MARGIN,
  }

  // Table header
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(100, 116, 139)
  doc.text('DESCRIPTION', tableCols.desc, y)
  doc.text('QTY', tableCols.qty, y)
  doc.text('UNIT PRICE', tableCols.unitPrice, y)
  doc.text('TAX / SVC', tableCols.taxSvc, y)
  doc.text('STATUS', tableCols.status, y)
  doc.text('AMOUNT', tableCols.total, y, { align: 'right' })

  y += 3
  doc.setDrawColor(226, 232, 240)
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y)
  y += 5

  // Row 1: Accommodation
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(15, 23, 42)
  doc.text(`Accommodation (${reservation.nights} nights)`, tableCols.desc, y)

  doc.setFont('helvetica', 'normal')
  doc.text('1', tableCols.qty, y)
  doc.text(fmtCurrency(summary.bookingTotal, currency), tableCols.unitPrice, y)
  doc.text('Included', tableCols.taxSvc, y)
  doc.text('Confirmed', tableCols.status, y)
  doc.setFont('helvetica', 'bold')
  doc.text(fmtCurrency(summary.bookingTotal, currency), tableCols.total, y, { align: 'right' })

  y += 6

  // Folio items
  const items = reservation.folioItems ?? []
  for (const item of items) {
    if (y > 250) {
      doc.addPage()
      y = 20
    }

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)

    if (item.status === 'voided') {
      doc.setTextColor(148, 163, 184) // line-through / gray
      doc.text(`[VOIDED] ${item.label}`, tableCols.desc, y)
    }
    else {
      doc.setTextColor(15, 23, 42)
      doc.text(item.label, tableCols.desc, y)
    }

    doc.text(String(item.quantity), tableCols.qty, y)
    doc.text(fmtCurrency(item.unitPrice, currency), tableCols.unitPrice, y)

    const taxSvc = [
      item.taxPercent ? `${item.taxPercent}%` : '',
      item.servicePercent ? `${item.servicePercent}%` : '',
    ].filter(Boolean).join(' + ') || '0%'
    doc.text(taxSvc, tableCols.taxSvc, y)

    let statusText = item.status === 'paid' ? 'Paid' : item.status === 'voided' ? 'Voided' : 'Unpaid'
    if (item.status === 'partially_paid') {
      statusText = `Partial (${fmtCurrency(item.paidAmount ?? 0, currency)})`
    }
    else if (item.status === 'paid' && item.paymentMethod) {
      statusText = `Paid · ${FOLIO_PAYMENT_METHOD_LABELS[item.paymentMethod]}`
    }
    doc.text(statusText, tableCols.status, y)

    doc.setFont('helvetica', item.status === 'voided' ? 'normal' : 'bold')
    doc.text(fmtCurrency(folioLineTotal(item), currency), tableCols.total, y, { align: 'right' })

    y += 5.5
  }

  y += 4
  doc.setDrawColor(226, 232, 240)
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y)
  y += 6

  // --- Summary Box (Totals) ------------------------------------------------
  const totalsX = PAGE_WIDTH - MARGIN - 75

  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139)

  doc.text('Booking total:', totalsX, y)
  doc.setTextColor(15, 23, 42)
  doc.text(fmtCurrency(summary.bookingTotal, currency), PAGE_WIDTH - MARGIN, y, { align: 'right' })
  y += 5

  doc.setTextColor(100, 116, 139)
  doc.text('Extras / Folio items:', totalsX, y)
  doc.setTextColor(15, 23, 42)
  doc.text(fmtCurrency(summary.itemsTotal, currency), PAGE_WIDTH - MARGIN, y, { align: 'right' })
  y += 5

  doc.setDrawColor(226, 232, 240)
  doc.line(totalsX, y, PAGE_WIDTH - MARGIN, y)
  y += 5

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(15, 23, 42)
  doc.text('Grand Total:', totalsX, y)
  doc.text(fmtCurrency(summary.grandTotal, currency), PAGE_WIDTH - MARGIN, y, { align: 'right' })
  y += 6

  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(22, 101, 52) // emerald
  doc.text('Total Paid / Collected:', totalsX, y)
  doc.setFont('helvetica', 'bold')
  doc.text(fmtCurrency(summary.itemsPaid, currency), PAGE_WIDTH - MARGIN, y, { align: 'right' })
  y += 5.5

  if (summary.unpaidTotal > 0) {
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(180, 83, 9) // amber-700
    doc.text('Balance Due (Outstanding):', totalsX, y)
    doc.text(fmtCurrency(summary.unpaidTotal, currency), PAGE_WIDTH - MARGIN, y, { align: 'right' })
    y += 5.5
  }
  else {
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(22, 101, 52)
    doc.text('Balance Due:', totalsX, y)
    doc.text(fmtCurrency(0, currency), PAGE_WIDTH - MARGIN, y, { align: 'right' })
    y += 5.5
  }

  if (summary.refundDue > 0) {
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(220, 38, 38) // red-600
    doc.text('Refund Due to Guest:', totalsX, y)
    doc.text(fmtCurrency(summary.refundDue, currency), PAGE_WIDTH - MARGIN, y, { align: 'right' })
    y += 5.5
  }

  // --- Payment Notes / Footer ----------------------------------------------
  doc.setFontSize(7.5)
  doc.setTextColor(148, 163, 184)
  doc.setFont('helvetica', 'normal')
  doc.text(
    'Thank you for staying with Elev8! For inquiries or settlement questions, please contact your villa host.',
    MARGIN,
    285,
  )

  const blob = doc.output('blob')
  if (opts.download && typeof window !== 'undefined') {
    const url = URL.createObjectURL(blob)
    const anchor = window.document.createElement('a')
    anchor.href = url
    anchor.download = `Invoice-${reservation.id}.pdf`
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return blob
}
