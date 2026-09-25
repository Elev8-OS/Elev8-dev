// Damage claim evidence PDF: one claim, everything that backs it, in one file.
//
// This is the document staff send when a guest disputes a charge to their
// saved card, or hand to a card network in a chargeback. So it carries the
// claim as recorded, the protection the guest chose and the exact consent
// they gave for a charge after check-out, when they were told, the cleaning
// report the claim came from, and the photos themselves, embedded.
//
// Same document family as the guest invoice and the owner statement: company
// block top-left, title top-right, grey section bars, the invoice palette.
//
// Rules this file keeps:
//
//   1. It prints the FROZEN record. The claim, the cleaning report snapshot,
//      the terms and the charge consent are all copies made when they were
//      agreed or recorded; the file never re-reads a live policy or report.
//   2. A photo that cannot be embedded is LISTED, never silently dropped. A
//      pack that quietly loses its strongest evidence reads as complete.
//   3. It never prints a card number. There is none to print: a SavedCard is
//      a reference and the last four digits.
//   4. It never runs off the page: every block asks `ensure()` first.

import type { DamageProtection, ProtectionClaim, ReservationEntry } from '~/components/reservations/data/reservations'
import type { InvoiceTemplateCompanyDetails } from '~/components/settings/data/invoice-templates'
import { jsPDF as JsPdf } from 'jspdf'
import { PARTNER_STATUS_LABELS } from '~/components/reservations/data/partner-claims'

const PAGE_WIDTH = 210 // A4 mm
const MARGIN = 16
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2
const FOOTER_Y = 288
const BOTTOM_LIMIT = FOOTER_Y - 8
const LABEL_WIDTH = 42

/** The invoice's palette, so every document reads as one family. */
const INK: [number, number, number] = [17, 24, 39]
const MUTED: [number, number, number] = [100, 116, 139]
const TABLE_HEAD: [number, number, number] = [175, 178, 183]
const WARN: [number, number, number] = [180, 83, 9]

/** jsPDF decodes PNG and JPEG only. */
const EMBEDDABLE = /^data:image\/(png|jpe?g);base64,/i

/** Two photos a row, each at most this tall, so a portrait shot cannot swallow a page. */
const PHOTO_WIDTH = (CONTENT_WIDTH - 6) / 2
const PHOTO_MAX_HEIGHT = 70

export interface EvidencePhoto {
  /** Where the photo lives, printed when it cannot be embedded. */
  url: string
  /** What it shows, printed under it. */
  caption: string
  /** A PNG or JPEG data URL when it could be loaded; absent when it could not. */
  dataUrl?: string
}

export interface ClaimEvidencePdfInput {
  reservation: Pick<ReservationEntry, 'id' | 'guestName' | 'guestEmail' | 'listingName' | 'checkIn' | 'checkOut'>
  protection: DamageProtection
  claim: ProtectionClaim
  /** Every photo backing the claim, already loaded (`loadEvidencePhotos`). */
  photos: EvidencePhoto[]
  company?: Partial<InvoiceTemplateCompanyDetails>
  generatedAt?: Date
}

function money(amount: number, currency: string): string {
  // ASCII only: jsPDF's built-in Helvetica is WinAnsi.
  return `${currency} ${amount.toLocaleString('de-CH', {
    minimumFractionDigits: currency === 'IDR' ? 0 : 2,
    maximumFractionDigits: currency === 'IDR' ? 0 : 2,
  }).replace(/’/g, '\'')}`
}

function dateTime(iso?: string): string {
  if (!iso)
    return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime()))
    return iso
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
}

function day(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fileName(url: string): string {
  return url.split('/').pop()?.split('?')[0] || url
}

/** Every photo URL that backs a claim, the cleaning report's first, each once. */
export function claimPhotoSources(claim: ProtectionClaim): { url: string, caption: string }[] {
  const seen = new Set<string>()
  const out: { url: string, caption: string }[] = []
  for (const url of claim.cleaningReport?.photoUrls ?? []) {
    if (!seen.has(url)) {
      seen.add(url)
      out.push({ url, caption: `${claim.cleaningReport!.cleaningLabel}: ${claim.cleaningReport!.finding}` })
    }
  }
  for (const url of claim.evidenceUrls) {
    if (/\.(?:png|jpe?g|webp|gif)(?:\?|$)/i.test(url) && !seen.has(url)) {
      seen.add(url)
      out.push({ url, caption: `Uploaded: ${fileName(url)}` })
    }
  }
  return out
}

/**
 * Load each photo as a data URL the PDF can embed. A photo that fails to load,
 * or is not PNG/JPEG, comes back without `dataUrl` and the PDF lists it
 * instead of pretending it was never there. `fetcher` is injectable for tests.
 */
export async function loadEvidencePhotos(
  sources: { url: string, caption: string }[],
  fetcher: (url: string) => Promise<Response> = url => fetch(url),
): Promise<EvidencePhoto[]> {
  return Promise.all(sources.map(async (source) => {
    try {
      const response = await fetcher(source.url)
      if (!response.ok)
        return { ...source }
      const blob = await response.blob()
      if (!/^image\/(?:png|jpe?g)$/i.test(blob.type))
        return { ...source }
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(blob)
      })
      return { ...source, dataUrl }
    }
    catch {
      return { ...source }
    }
  }))
}

/** File name the browser offers. Exported so tests can pin it. */
export function claimEvidencePdfFilename(reservation: Pick<ReservationEntry, 'guestName'>, claim: Pick<ProtectionClaim, 'label'>): string {
  const safe = (value: string) => value.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim()
  return `Damage claim evidence - ${safe(reservation.guestName)} - ${safe(claim.label)}.pdf`
}

function cardLine(protection: DamageProtection): string {
  const card = protection.card
  if (!card)
    return ''
  const brand = card.brand === 'card' ? 'Card' : card.brand.charAt(0).toUpperCase() + card.brand.slice(1)
  return `${brand} ending ${card.last4}, expires ${String(card.expMonth).padStart(2, '0')}/${String(card.expYear).slice(-2)}`
}

/**
 * Build the evidence PDF for one claim. Returns a Blob; also triggers a
 * browser download when `download` is true.
 */
export function buildClaimEvidencePdf(input: ClaimEvidencePdfInput, opts: { download?: boolean } = {}): Blob {
  const { reservation, protection, claim, photos } = input
  const currency = protection.currency
  const company = input.company ?? {}
  const doc = new JsPdf({ unit: 'mm', format: 'a4' })
  let y = 15

  function ink() {
    doc.setTextColor(INK[0], INK[1], INK[2])
  }
  function muted() {
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2])
  }
  function ensure(height: number) {
    if (y + height <= BOTTOM_LIMIT)
      return
    doc.addPage()
    y = 20
  }
  /**
   * A grey section bar. `keepWith` is room the first thing under it needs, so
   * a heading never sits alone at the foot of a page with its content overleaf.
   */
  function section(title: string, keepWith = 0) {
    ensure(16 + keepWith)
    y += 3
    doc.setFillColor(TABLE_HEAD[0], TABLE_HEAD[1], TABLE_HEAD[2])
    doc.rect(MARGIN, y, CONTENT_WIDTH, 6.5, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    ink()
    doc.text(title, MARGIN + 3, y + 4.5)
    y += 11
  }
  /** A label and a value that wraps inside the content width. */
  function row(label: string, value: string, tone: 'ink' | 'warn' = 'ink') {
    const lines = doc.splitTextToSize(value || '-', CONTENT_WIDTH - LABEL_WIDTH) as string[]
    ensure(lines.length * 4.5 + 1)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    muted()
    doc.text(label, MARGIN, y)
    if (tone === 'warn')
      doc.setTextColor(WARN[0], WARN[1], WARN[2])
    else
      ink()
    doc.text(lines, MARGIN + LABEL_WIDTH, y)
    y += lines.length * 4.5 + 1
  }

  // --- Company block and title --------------------------------------------
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  ink()
  doc.text((company.companyName || 'ELEV8 PROPERTY GROUP').toUpperCase(), MARGIN, y)
  doc.setFontSize(12)
  doc.text('Damage Claim Evidence', PAGE_WIDTH - MARGIN, y, { align: 'right' })
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  const companyLines = [
    company.address,
    [company.postalCode, company.city].filter(Boolean).join(' '),
    [company.email ? `Email: ${company.email}` : '', company.phone ? `Phone: ${company.phone}` : ''].filter(Boolean).join(' · '),
  ].filter((line): line is string => Boolean(line))
  const headerTop = y
  for (const line of companyLines) {
    doc.text(line, MARGIN, y)
    y += 4.5
  }
  muted()
  doc.text(`Generated ${dateTime((input.generatedAt ?? new Date()).toISOString())}`, PAGE_WIDTH - MARGIN, headerTop, { align: 'right' })
  doc.text(`Reservation ${reservation.id}`, PAGE_WIDTH - MARGIN, headerTop + 4.5, { align: 'right' })
  y = Math.max(y, headerTop + 9) + 2

  /**
   * Where the saved card stands, in every state, so the file never leaves a
   * reader to infer from a missing line that nothing was charged.
   */
  function depositCharge(p: typeof protection): { label: string, text: string, tone: 'ink' | 'warn', open: boolean } {
    switch (p.state) {
      case 'deposit_charged':
        return { label: 'Charged', text: `${money(p.chargedAmount ?? 0, currency)} on ${dateTime(p.chargedAt)}`, tone: 'ink', open: false }
      case 'charge_failed':
        return { label: 'Charge', text: `Not charged. The charge was declined: ${p.chargeFailureReason ?? 'by the issuer'}`, tone: 'warn', open: true }
      case 'deposit_released':
        return { label: 'Charge', text: `Nothing charged. The deposit was closed without a charge on ${dateTime(p.releasedAt)}.`, tone: 'ink', open: false }
      case 'cancelled':
        return { label: 'Charge', text: 'Nothing charged. The card was released when the stay was cancelled.', tone: 'ink', open: false }
      default:
        return { label: 'Charge', text: 'Not charged yet. The card is on file and nothing has been taken from it.', tone: 'warn', open: true }
    }
  }

  // --- Guest and stay ------------------------------------------------------
  section('Guest and stay')
  row('Guest', reservation.guestName)
  if (reservation.guestEmail)
    row('Email', reservation.guestEmail)
  row('Property', reservation.listingName)
  row('Stay', `${day(reservation.checkIn)} to ${day(reservation.checkOut)}`)

  // --- The claim -----------------------------------------------------------
  section('Claim')
  row('Damage', claim.label)
  row('What happened', claim.reason)
  row('Assessed at', money(claim.amount, currency))
  // ⚠️ "Charged to card" only once the card WAS charged. Until then the
  // covered amount is what may be charged, and a dispute reader must not take
  // it for money already taken.
  if (protection.option !== 'deposit')
    row('Paid by the waiver', money(claim.coveredAmount, currency))
  else if (protection.state === 'deposit_charged')
    row('Charged to card', money(claim.coveredAmount, currency))
  else
    row('Covered by the deposit', `${money(claim.coveredAmount, currency)}. ${depositCharge(protection).open ? 'Not charged yet.' : 'Not charged.'}`, 'warn')
  if (claim.excessAmount > 0)
    row('Above the cover', `${money(claim.excessAmount, currency)}, invoiced separately`)
  row('Recorded', `${dateTime(claim.recordedAt)} by ${claim.recordedBy}`)
  // The one fact a dispute turns on: was the guest told before any money moved.
  row(
    'Guest notified',
    claim.guestNotifiedAt ? dateTime(claim.guestNotifiedAt) : 'Not yet. The guest has not been told about this claim.',
    claim.guestNotifiedAt ? 'ink' : 'warn',
  )

  // --- The protection the guest chose -------------------------------------
  const hostPaid = protection.paidBy === 'host'
  section(hostPaid ? 'Protection on the stay' : 'Protection the guest chose')
  if (protection.option === 'waiver') {
    row('Option', hostPaid
      ? 'Damage waiver, paid for by the host. The guest was not asked to pay'
      : `Damage waiver, fee ${money(protection.amount, currency)}`)
    row('Cover', money(protection.coverageCap ?? 0, currency))
  }
  else {
    row('Option', `Security deposit: card kept on file, up to ${money(protection.amount, currency)}`)
    if (protection.card)
      row('Card', cardLine(protection))
    const charge = depositCharge(protection)
    row(charge.label, charge.text, charge.tone)
  }
  const via = protection.acceptedVia === 'guest_guide'
    ? 'in the guest guide'
    : protection.acceptedVia === 'host_cover' ? 'covered automatically by the host' : 'recorded by staff'
  row(hostPaid ? 'Covered' : 'Accepted', `${dateTime(protection.acceptedAt)}, ${via}`)
  row('Terms', `Version ${protection.termsVersion}`)
  row('Terms text', protection.termsText)
  if (protection.chargeMandate)
    row('Charge consent', `"${protection.chargeMandate}"`)

  // --- Insurance claim (waiver, master policy) -----------------------------
  if (claim.partnerClaim) {
    const pcl = claim.partnerClaim
    section('Insurance claim')
    row('Partner', `${pcl.partnerName}, policy ${pcl.policyNumber}`)
    if (pcl.partnerClaimRef)
      row('Partner reference', pcl.partnerClaimRef)
    row('Status', PARTNER_STATUS_LABELS[pcl.status], pcl.status === 'rejected' || pcl.status === 'submission_failed' ? 'warn' : 'ink')
    row('Claimed', `${money(pcl.claimedAmount, pcl.currency)} (after the ${money(pcl.deductible, pcl.currency)} deductible)`)
    if (pcl.approvedAmount !== undefined)
      row('Approved', money(pcl.approvedAmount, pcl.currency))
    if (pcl.rejectionReason)
      row('Rejected', pcl.rejectionReason, 'warn')
    if (pcl.paidAmount !== undefined)
      row('Paid by partner', `${money(pcl.paidAmount, pcl.currency)}${pcl.payoutReference ? `, ref ${pcl.payoutReference}` : ''}`)
    if (pcl.receivedAmount !== undefined)
      row('Received', `${money(pcl.receivedAmount, pcl.currency)} on ${dateTime(pcl.receivedAt)}`)
  }

  // --- Cleaning report -----------------------------------------------------
  if (claim.cleaningReport) {
    const report = claim.cleaningReport
    section('Cleaning report')
    row('Cleaning', report.cleaningLabel)
    row('Reported by', report.reportedBy)
    row('Reported', dateTime(report.reportedAt))
    row('Checklist line', report.checklistItem)
    row('Finding', report.finding)
  }

  // --- Files ---------------------------------------------------------------
  if (claim.evidenceUrls.length) {
    section('Attached files')
    for (const url of claim.evidenceUrls)
      row('File', fileName(url))
  }

  // --- Photos --------------------------------------------------------------
  if (photos.length) {
    const firstEmbeddable = photos.some(photo => photo.dataUrl && EMBEDDABLE.test(photo.dataUrl))
    section(`Photos (${photos.length})`, firstEmbeddable ? PHOTO_MAX_HEIGHT + 12 : 6)
    const missing: EvidencePhoto[] = []
    let column = 0
    let rowHeight = 0
    for (const photo of photos) {
      const match = photo.dataUrl?.match(EMBEDDABLE)
      if (!photo.dataUrl || !match) {
        missing.push(photo)
        continue
      }
      let width = PHOTO_WIDTH
      let height = PHOTO_WIDTH * 0.75
      try {
        const props = doc.getImageProperties(photo.dataUrl)
        if (props.width && props.height) {
          height = PHOTO_WIDTH * (props.height / props.width)
          if (height > PHOTO_MAX_HEIGHT) {
            width = PHOTO_WIDTH * (PHOTO_MAX_HEIGHT / height)
            height = PHOTO_MAX_HEIGHT
          }
        }
      }
      catch { /* keep the default 4:3 box */ }

      if (column === 0)
        ensure(height + 12)
      const x = MARGIN + column * (PHOTO_WIDTH + 6)
      try {
        doc.addImage(photo.dataUrl, match[1]!.toLowerCase() === 'png' ? 'PNG' : 'JPEG', x, y, width, height, undefined, 'FAST')
      }
      catch {
        missing.push(photo)
        continue
      }
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      muted()
      const caption = doc.splitTextToSize(photo.caption, PHOTO_WIDTH) as string[]
      doc.text(caption.slice(0, 2), x, y + height + 4)
      rowHeight = Math.max(rowHeight, height + 4 + Math.min(caption.length, 2) * 3.5)
      column += 1
      if (column === 2) {
        y += rowHeight + 4
        column = 0
        rowHeight = 0
      }
    }
    if (column !== 0)
      y += rowHeight + 4
    for (const photo of missing)
      row('Not embedded', `${photo.caption}. Could not be loaded into this file: ${photo.url}`, 'warn')
  }

  // --- Footer (every page) -------------------------------------------------
  const pageCount = doc.getNumberOfPages()
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    muted()
    doc.text('Generated by Elev8 from the claim as recorded. Figures, terms and consent are as frozen when agreed.', MARGIN, FOOTER_Y)
    if (pageCount > 1)
      doc.text(`Page ${page} of ${pageCount}`, PAGE_WIDTH - MARGIN, FOOTER_Y, { align: 'right' })
  }

  const blob = doc.output('blob')
  if (opts.download && typeof window !== 'undefined') {
    const url = URL.createObjectURL(blob)
    const anchor = window.document.createElement('a')
    anchor.href = url
    anchor.download = claimEvidencePdfFilename(reservation, claim)
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return blob
}
