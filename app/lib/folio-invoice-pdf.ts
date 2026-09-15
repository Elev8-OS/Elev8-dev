// Guest Folio & Invoice PDF generation
// Builds a clean, professional A4 tax invoice & receipt PDF matching the modern receipt layout:
// - Clean white background throughout
// - Top-left company contacts & tax info
// - Top-right logo, Tax Invoice / Receipt title, and Invoice number
// - Full date and "Invoiced To:" guest details
// - Solid gray header items table (Item, GST, Cost)
// - Subtotals, taxes, and bold TOTAL PAID
// - Bank transfer details & Payment method block with PAID IN FULL badge
// - Clean footer with website and terms & conditions

import type { ReservationEntry } from '~/components/reservations/data/reservations'
import { jsPDF as JsPdf } from 'jspdf'
import {
  buildFolioSummary,
  FOLIO_PAYMENT_METHOD_LABELS,
  folioLineService,
  folioLineTax,
  folioLineTotal,
  roundFolioAmount,
} from '~/components/reservations/data/folio'
import { useInvoiceTemplates } from '~/composables/useInvoiceTemplates'

const PAGE_WIDTH = 210 // A4 mm
const MARGIN = 16
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2

export interface FolioInvoicePdfOptions {
  companyName?: string
  taxId?: string
  addressLine?: string
  city?: string
  zipCode?: string
  phone?: string
  website?: string
  email?: string
  commercialRegisterNo?: string
  managingDirector?: string
  registeredCity?: string
  vatNumber?: string
  headerMessage?: string
  footerMessage?: string
  logoDataUrl?: string
  bankNameOrBsb?: string
  bankAccountName?: string
  bankAccountNumber?: string
  iban?: string
  bicSwift?: string
  download?: boolean
}

function fmtCurrency(amount: number, currency: string): string {
  const formatted = Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const sign = amount < 0 ? '−' : ''
  return `${sign}${currency} ${formatted}`
}

function formatFullDate(iso: string | Date): string {
  try {
    const d = typeof iso === 'string' ? new Date(iso) : iso
    if (Number.isNaN(d.getTime()))
      return String(iso)
    return d.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }
  catch {
    return String(iso)
  }
}

function formatShortDate(iso: string | Date): string {
  try {
    const d = typeof iso === 'string' ? new Date(iso) : iso
    if (Number.isNaN(d.getTime()))
      return String(iso)
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }
  catch {
    return String(iso)
  }
}

/**
 * Generate an A4 folio invoice PDF for a reservation matching the modern receipt design.
 * Returns a Blob; triggers browser download when `download` is true.
 */
export function buildFolioInvoicePdf(
  reservation: ReservationEntry,
  opts: FolioInvoicePdfOptions = {},
): Blob {
  const doc = new JsPdf({ unit: 'mm', format: 'a4' })
  const currency = reservation.currency || 'USD'
  const summary = buildFolioSummary(reservation)

  // Resolve template for this reservation's listing
  const { getTemplateForListing } = useInvoiceTemplates()
  const template = getTemplateForListing(reservation.listingId)

  // Resolve branding / company defaults
  let logoDataUrl = opts.logoDataUrl || template.company.logoDataUrl
  if (!logoDataUrl && typeof window !== 'undefined') {
    try {
      const raw = window.localStorage?.getItem('elev8-tenant-branding-v1')
      if (raw) {
        const parsed = JSON.parse(raw)
        logoDataUrl = parsed.invoiceLogo?.dataUrl || parsed.primaryLogo?.dataUrl
      }
    }
    catch {
      // Ignore storage errors
    }
  }

  const companyName = (opts.companyName || template.company.companyName || 'ELEV8 PROPERTY GROUP').toUpperCase()
  const addressLine = opts.addressLine || template.company.address || '22a Pantai Berawa'
  const cityLine = opts.city
    ? `${opts.city} ${opts.zipCode || ''}`.trim()
    : [template.company.postalCode, template.company.city].filter(Boolean).join(' ') || 'Canggu, Bali 80361'
  const commercialRegisterNo = opts.commercialRegisterNo || template.company.commercialRegisterNo
  const managingDirector = opts.managingDirector || template.company.managingDirector
  const registeredCity = opts.registeredCity || template.company.registeredCity
  const email = opts.email || template.company.email
  const phone = opts.phone || template.company.phone
  const website = opts.website || template.company.website
  const taxId = opts.vatNumber || opts.taxId || template.company.vatNumber

  const headerMessage = opts.headerMessage !== undefined ? opts.headerMessage : template.headerMessage
  const footerMessage = opts.footerMessage !== undefined ? opts.footerMessage : template.footerMessage

  // Invoice number (e.g. 3189 or INV-102)
  const invoiceNum = reservation.id.replace(/^res-/, '').toUpperCase()

  // --- Top Left: Company Information --------------------------------------
  let compY = 15
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  doc.setTextColor(17, 24, 39)
  doc.text(companyName, MARGIN, compY)
  compY += 5

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(17, 24, 39)
  if (addressLine) {
    doc.text(addressLine, MARGIN, compY)
    compY += 4.5
  }
  if (cityLine) {
    doc.text(cityLine, MARGIN, compY)
    compY += 4.5
  }
  if (commercialRegisterNo || registeredCity) {
    const regLine = [
      commercialRegisterNo ? `Reg: ${commercialRegisterNo}` : '',
      registeredCity ? `Registered: ${registeredCity}` : '',
    ].filter(Boolean).join(' · ')
    doc.text(regLine, MARGIN, compY)
    compY += 4.5
  }
  if (managingDirector) {
    doc.text(`Managing Director: ${managingDirector}`, MARGIN, compY)
    compY += 4.5
  }
  const contactLine = [
    email ? `Email: ${email}` : '',
    phone ? (phone.startsWith('Phone:') ? phone : `Phone: ${phone}`) : '',
  ].filter(Boolean).join(' · ')
  if (contactLine) {
    doc.text(contactLine, MARGIN, compY)
    compY += 4.5
  }
  if (website) {
    doc.text(website, MARGIN, compY)
    compY += 4.5
  }
  if (taxId) {
    const vatLabel = taxId.toLowerCase().startsWith('vat') || taxId.toLowerCase().startsWith('npwp') ? taxId : `VAT / Tax ID: ${taxId}`
    doc.text(vatLabel, MARGIN, compY)
    compY += 4.5
  }

  // --- Top Right: Logo + Tax Invoice / Receipt + Invoice # -----------------
  let logoRendered = false
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'PNG', PAGE_WIDTH - MARGIN - 48, 12, 48, 14, undefined, 'FAST')
      logoRendered = true
    }
    catch {
      // Fallback to text brand below
    }
  }

  if (!logoRendered) {
    const logoW = 30
    const logoX = PAGE_WIDTH - MARGIN - logoW
    const logoY = 13

    doc.setFillColor(15, 23, 42) // slate-900
    doc.roundedRect(logoX, logoY, 8.5, 8.5, 1.5, 1.5, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.text('E8', logoX + 4.25, logoY + 6, { align: 'center' })

    doc.setTextColor(17, 24, 39)
    doc.setFontSize(13)
    doc.text('Elev8', logoX + 11, logoY + 6.5)
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(17, 24, 39)
  doc.text('Tax Invoice / Receipt', PAGE_WIDTH - MARGIN, 36, { align: 'right' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(17, 24, 39)
  doc.text(`Invoice # ${invoiceNum}`, PAGE_WIDTH - MARGIN, 42, { align: 'right' })

  // --- Date on Left -------------------------------------------------------
  const issueDateStr = formatFullDate(new Date())
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(17, 24, 39)
  const dateY = Math.max(compY + 3, 52)
  doc.text(issueDateStr, MARGIN, dateY)

  // --- Invoiced To Section -------------------------------------------------
  const invoicedToY = dateY + 10
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.setTextColor(17, 24, 39)
  doc.text('Invoiced To:', MARGIN, invoicedToY)

  const guestColX = MARGIN + 28
  doc.text((reservation.guestName || 'GUEST').toUpperCase(), guestColX, invoicedToY)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  let guestDetailY = invoicedToY + 4.5

  if (reservation.companyName) {
    doc.text(reservation.companyName, guestColX, guestDetailY)
    guestDetailY += 4.5
  }

  // Address or Property details
  const propLine = reservation.listingName || 'Villa Serenity'
  doc.text(propLine, guestColX, guestDetailY)
  guestDetailY += 4.5

  const locationLine = [reservation.guestCity, reservation.guestCountry].filter(Boolean).join(', ')
    || 'Canggu, Bali'
  doc.text(locationLine, guestColX, guestDetailY)

  // --- Header Message (Above Items Table) ---------------------------------
  let beforeTableY = Math.max(guestDetailY + 6, 80)
  if (headerMessage) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(100, 116, 139)
    const headerLines = doc.splitTextToSize(headerMessage, CONTENT_WIDTH)
    doc.text(headerLines, MARGIN, beforeTableY)
    beforeTableY += headerLines.length * 3.5 + 4
  }

  // --- Items Table ---------------------------------------------------------
  const tableY = beforeTableY

  // Solid gray table header bar
  doc.setFillColor(175, 178, 183)
  doc.rect(MARGIN, tableY, CONTENT_WIDTH, 6.5, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(17, 24, 39)
  doc.text('Item', MARGIN + 3, tableY + 4.5)
  doc.text('Tax / Svc', PAGE_WIDTH - MARGIN - 32, tableY + 4.5, { align: 'right' })
  doc.text('Cost', PAGE_WIDTH - MARGIN - 3, tableY + 4.5, { align: 'right' })

  let rowY = tableY + 11

  // Row 1: Accommodation
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(17, 24, 39)

  const accomTitle = `Accommodation - ${reservation.nights} night${reservation.nights > 1 ? 's' : ''} on ${formatShortDate(reservation.checkIn)} to ${formatShortDate(reservation.checkOut)}`
  const accomTax = reservation.priceDetails?.tax || 0
  const accomSvc = reservation.priceDetails?.serviceFee || 0
  const accomTaxSvc = roundFolioAmount(accomTax + accomSvc)
  const taxSvcText = accomTaxSvc > 0 ? fmtCurrency(accomTaxSvc, currency) : 'Included'

  const isOtaChannel = Boolean(reservation.channel && reservation.channel.toLowerCase() !== 'direct')
  const channelNote = isOtaChannel ? ` · Paid via ${reservation.channel}` : ''

  const accomFeeBadges: string[] = []
  if (accomTax > 0)
    accomFeeBadges.push(`Tax: ${fmtCurrency(accomTax, currency)}`)
  if (accomSvc > 0)
    accomFeeBadges.push(`Service: ${fmtCurrency(accomSvc, currency)}`)
  const accomFeeNote = accomFeeBadges.length > 0 ? ` · ${accomFeeBadges.join(' · ')}` : ''
  const accomSub = `${reservation.listingName} (${reservation.guestCount} guest${reservation.guestCount > 1 ? 's' : ''})${channelNote}${accomFeeNote}`

  doc.text(accomTitle, MARGIN + 3, rowY)
  doc.setFontSize(7.5)
  doc.setTextColor(100, 116, 139)
  doc.text(accomSub, MARGIN + 3, rowY + 4)

  doc.setFontSize(8.5)
  doc.setTextColor(17, 24, 39)

  doc.text(taxSvcText, PAGE_WIDTH - MARGIN - 32, rowY, { align: 'right' })
  doc.text(fmtCurrency(summary.bookingTotal, currency), PAGE_WIDTH - MARGIN - 3, rowY, { align: 'right' })

  rowY += 11

  // Folio Items / Extras
  const items = reservation.folioItems ?? []
  for (const item of items) {
    if (rowY > 230) {
      doc.addPage()
      rowY = 20
    }

    doc.setFontSize(8.5)
    if (item.status === 'voided') {
      doc.setTextColor(156, 163, 175)
      doc.text(`[VOIDED] ${item.quantity > 1 ? `${item.quantity} x ` : ''}${item.label}`, MARGIN + 3, rowY)
      doc.text('—', PAGE_WIDTH - MARGIN - 32, rowY, { align: 'right' })
      doc.text(fmtCurrency(0, currency), PAGE_WIDTH - MARGIN - 3, rowY, { align: 'right' })
      rowY += 7
    }
    else {
      doc.setTextColor(17, 24, 39)
      const label = `${item.quantity > 1 ? `${item.quantity} x ` : ''}${item.label}${item.note ? ` (${item.note})` : ''}`
      doc.text(label, MARGIN + 3, rowY)

      const lineTax = folioLineTax(item)
      const lineSvc = folioLineService(item)
      const lineTaxSvc = roundFolioAmount(lineTax + lineSvc)

      // Sub-line with tax & service rate info if applicable
      const rateBadges: string[] = []
      if (item.taxPercent)
        rateBadges.push(`Tax ${item.taxPercent}%`)
      if (item.servicePercent)
        rateBadges.push(`Service ${item.servicePercent}%`)

      if (rateBadges.length > 0) {
        doc.setFontSize(7.5)
        doc.setTextColor(100, 116, 139)
        doc.text(`${item.quantity} × ${fmtCurrency(item.unitPrice, currency)} (${rateBadges.join(' · ')})`, MARGIN + 3, rowY + 4)
        doc.setFontSize(8.5)
        doc.setTextColor(17, 24, 39)
      }

      const taxSvcStr = lineTaxSvc > 0 ? fmtCurrency(lineTaxSvc, currency) : (rateBadges.join(' + ') || '—')
      doc.text(taxSvcStr, PAGE_WIDTH - MARGIN - 32, rowY, { align: 'right' })
      doc.text(fmtCurrency(folioLineTotal(item), currency), PAGE_WIDTH - MARGIN - 3, rowY, { align: 'right' })

      rowY += rateBadges.length > 0 ? 9.5 : 7
    }
  }

  // Divider line under table items
  doc.setDrawColor(209, 213, 219)
  doc.line(MARGIN, rowY, PAGE_WIDTH - MARGIN, rowY)
  rowY += 7

  // --- Totals Section (Right-aligned under table) --------------------------
  const labelColX = PAGE_WIDTH - MARGIN - 32

  const totalTax = roundFolioAmount(
    (reservation.priceDetails?.tax || 0)
    + (reservation.cityTax?.totalAmount || 0)
    + items.filter(i => i.status !== 'voided').reduce((s, i) => s + folioLineTax(i), 0),
  )

  const totalService = roundFolioAmount(
    (reservation.priceDetails?.serviceFee || 0)
    + items.filter(i => i.status !== 'voided').reduce((s, i) => s + folioLineService(i), 0),
  )

  if (totalTax > 0) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(17, 24, 39)
    doc.text('Includes Tax', labelColX, rowY, { align: 'right' })
    doc.text(fmtCurrency(totalTax, currency), PAGE_WIDTH - MARGIN - 3, rowY, { align: 'right' })
    rowY += 5
  }

  if (totalService > 0) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(17, 24, 39)
    doc.text('Includes Service Charge', labelColX, rowY, { align: 'right' })
    doc.text(fmtCurrency(totalService, currency), PAGE_WIDTH - MARGIN - 3, rowY, { align: 'right' })
    rowY += 5.5
  }

  // --- Payment & Channel Resolution --------------------------------------
  // OTA bookings (Airbnb, Booking.com, Agoda, Expedia) are pre-paid through the channel.
  // Direct bookings check priceDetails.guestPaid.
  const isOta = Boolean(reservation.channel && reservation.channel.toLowerCase() !== 'direct')
  const isAccomPaid = isOta || Boolean(reservation.priceDetails?.guestPaid && reservation.priceDetails.guestPaid >= summary.bookingTotal)
  const accomPaidAmount = isAccomPaid
    ? summary.bookingTotal
    : Math.min(summary.bookingTotal, reservation.priceDetails?.guestPaid ?? 0)

  // Build itemized payment records
  const paymentRows: { method: string, amount: number }[] = []

  if (accomPaidAmount > 0) {
    const channelLabel = isOta ? `${reservation.channel} (Prepaid)` : 'Accommodation Payment'
    paymentRows.push({
      method: channelLabel,
      amount: accomPaidAmount,
    })
  }

  // Folio items payments grouped by method
  const folioPaymentsByMethod: Record<string, number> = {}
  for (const item of items) {
    if (item.status === 'paid' && item.paymentMethod) {
      const label = FOLIO_PAYMENT_METHOD_LABELS[item.paymentMethod] || item.paymentMethod
      const amt = item.paidAmount !== undefined ? item.paidAmount : (item.quantity * item.unitPrice * (1 + (item.taxPercent + item.servicePercent) / 100))
      folioPaymentsByMethod[label] = (folioPaymentsByMethod[label] || 0) + Math.round(amt * 100) / 100
    }
  }

  for (const [method, amount] of Object.entries(folioPaymentsByMethod)) {
    paymentRows.push({ method, amount })
  }

  if (paymentRows.length === 0 && summary.itemsPaid > 0) {
    paymentRows.push({ method: 'Cash', amount: summary.itemsPaid })
  }

  // Total collected = accommodation payment + extras collected
  const totalPaid = roundFolioAmount(accomPaidAmount + summary.itemsPaid)
  const balanceDue = roundFolioAmount(Math.max(0, summary.grandTotal - totalPaid))
  const isPaidInFull = balanceDue === 0

  // TOTAL PAID / BALANCE DUE
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  doc.setTextColor(17, 24, 39)

  if (isPaidInFull) {
    doc.text('TOTAL PAID', labelColX, rowY, { align: 'right' })
    doc.text(fmtCurrency(totalPaid, currency), PAGE_WIDTH - MARGIN - 3, rowY, { align: 'right' })
  }
  else if (totalPaid > 0) {
    doc.text('TOTAL PAID', labelColX, rowY, { align: 'right' })
    doc.text(fmtCurrency(totalPaid, currency), PAGE_WIDTH - MARGIN - 3, rowY, { align: 'right' })
    rowY += 5.5
    doc.text('BALANCE DUE', labelColX, rowY, { align: 'right' })
    doc.text(fmtCurrency(balanceDue, currency), PAGE_WIDTH - MARGIN - 3, rowY, { align: 'right' })
  }
  else {
    doc.text('TOTAL DUE', labelColX, rowY, { align: 'right' })
    doc.text(fmtCurrency(summary.grandTotal, currency), PAGE_WIDTH - MARGIN - 3, rowY, { align: 'right' })
  }

  // --- Two-Column Lower Section: Bank Transfer & Payment Method ------------
  const lowerY = Math.max(rowY + 14, 168)

  // Left Column: Bank Transfer Details
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(17, 24, 39)
  doc.text('Bank Transfer Details', MARGIN, lowerY)

  const bankAccountName = opts.bankAccountName || template.bank.accountHolder || opts.companyName || template.company.companyName || 'Elev8 Property Group'
  const bankName = opts.bankNameOrBsb || template.bank.bankName || 'Bank Central Asia (BCA)'
  const bankAccountNumber = opts.bankAccountNumber || template.bank.accountNumber
  const iban = opts.iban || template.bank.iban
  const bicSwift = opts.bicSwift || template.bank.bicSwift

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(17, 24, 39)
  let bankY = lowerY + 5
  doc.text(`Bank: ${bankName}`, MARGIN, bankY)
  bankY += 4.5
  doc.text(`Account Holder: ${bankAccountName}`, MARGIN, bankY)
  bankY += 4.5
  if (iban) {
    doc.text(`IBAN: ${iban}`, MARGIN, bankY)
    bankY += 4.5
  }
  else if (bankAccountNumber) {
    doc.text(`Account No: ${bankAccountNumber}`, MARGIN, bankY)
    bankY += 4.5
  }
  if (bicSwift) {
    doc.text(`BIC / SWIFT: ${bicSwift}`, MARGIN, bankY)
    bankY += 4.5
  }
  doc.text(`Reference: ${invoiceNum}`, MARGIN, bankY)

  // Right Column: Payment Method Gray Bar & Status Stamp
  const rightSectionX = MARGIN + 85
  const rightSectionWidth = PAGE_WIDTH - MARGIN - rightSectionX

  doc.setFillColor(175, 178, 183)
  doc.rect(rightSectionX, lowerY - 4.5, rightSectionWidth, 6.5, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(17, 24, 39)
  doc.text('Payment Method', rightSectionX + rightSectionWidth - 3, lowerY - 0.2, { align: 'right' })

  // Render all payment method rows
  let payRowY = lowerY + 5.5
  for (const pay of paymentRows) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(17, 24, 39)
    doc.text(pay.method, rightSectionX + 4, payRowY)
    doc.text(fmtCurrency(pay.amount, currency), PAGE_WIDTH - MARGIN - 3, payRowY, { align: 'right' })
    payRowY += 4.5
  }

  // Large Status Text
  const statusY = Math.max(payRowY + 5, lowerY + 22)
  const paidItem = items.find(i => i.status === 'paid')
  const paidDateStr = formatShortDate(paidItem?.paidAt || reservation.checkIn || new Date())

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(17, 24, 39)

  if (isPaidInFull) {
    doc.text('PAID IN FULL', PAGE_WIDTH - MARGIN - 3, statusY, { align: 'right' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.text(`on ${paidDateStr}`, PAGE_WIDTH - MARGIN - 3, statusY + 5, { align: 'right' })
  }
  else if (totalPaid > 0) {
    doc.text('PARTIALLY PAID', PAGE_WIDTH - MARGIN - 3, statusY, { align: 'right' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.text(`Balance Due: ${fmtCurrency(balanceDue, currency)}`, PAGE_WIDTH - MARGIN - 3, statusY + 5, { align: 'right' })
  }
  else {
    doc.text('PAYMENT PENDING', PAGE_WIDTH - MARGIN - 3, statusY, { align: 'right' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.text(`Due by ${formatShortDate(reservation.checkIn)}`, PAGE_WIDTH - MARGIN - 3, statusY + 5, { align: 'right' })
  }

  // --- Footer Message (Bottom) --------------------------------------------
  if (footerMessage) {
    const footerY = Math.max(statusY + 14, bankY + 8, 260)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(100, 116, 139)
    const footerLines = doc.splitTextToSize(footerMessage, CONTENT_WIDTH)
    doc.text(footerLines, MARGIN, footerY)
  }

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
