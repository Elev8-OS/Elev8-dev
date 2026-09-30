// House Rules Agreement PDF: the copy a guest signs in the guest guide before
// arrival. Rules come from the guide assigned to the listing (its enabled
// house_rules section), then the listing's own house rules, then a default set,
// the same fallback order the public guide uses. Each rule is a title with an
// optional description, as in Property > Guest Guides > House Rules.

import type { GuestGuide } from '~/components/guest-guides/data/types'
import type { Listing } from '~/components/listings/data/listings'
import type { ReservationEntry } from '~/components/reservations/data/reservations'
import { jsPDF as JsPdf } from 'jspdf'

const PAGE_WIDTH = 210 // A4 mm
const PAGE_HEIGHT = 297
const MARGIN = 20
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2
const BOTTOM_LIMIT = PAGE_HEIGHT - 24

export interface HouseRule {
  title: string
  description?: string
}

export const DEFAULT_HOUSE_RULES: HouseRule[] = [
  { title: 'No smoking', description: 'Smoking and vaping are not allowed anywhere inside the property, including with windows or balcony doors open.' },
  { title: 'No parties or events', description: 'Parties, events and gatherings with people who are not registered guests are not allowed.' },
  { title: 'Quiet hours', description: 'Quiet hours are from 22:00 to 08:00. Please keep noise low so neighbours and other guests can rest.' },
  { title: 'Registered guests only', description: 'Only the guests named on the reservation may stay overnight.' },
  { title: 'Report damage', description: 'Please tell the host straight away about anything broken or damaged during your stay.' },
]

export type HouseRulesSource = 'guest_guide' | 'listing' | 'default'

export interface HouseRulesAgreementInput {
  reservationId: string
  guestName: string
  guestEmail?: string
  listingName: string
  checkIn: string
  checkOut: string
  checkInTime?: string
  checkOutTime?: string
  nights: number
  guestCount: number
  channel?: string
  rules: HouseRule[]
  /** When the guest signed. Absent means the agreement is still unsigned. */
  signedAt?: string
  /** PNG or JPEG data URL of the drawn signature; other formats fall back to the typed name. */
  signatureImageUrl?: string
}

/** The rules shown to this guest, with where they came from. */
export function resolveHouseRules(
  reservation: Pick<ReservationEntry, 'listingId'>,
  sources: { listings: Listing[], guides: GuestGuide[] },
): { rules: HouseRule[], source: HouseRulesSource } {
  const guide = sources.guides.find(g => g.status === 'active' && g.assignedListingIds.includes(reservation.listingId))
  const section = guide?.sections.find(s => s.type === 'house_rules' && s.enabled)
  const guideRules = cleanRules(section?.data?.rules)
  if (guideRules.length)
    return { rules: guideRules, source: 'guest_guide' }

  const listing = sources.listings.find(l => l.id === reservation.listingId)
  const listingRules = cleanRules(listing?.resources?.basics?.houseRules?.split('\n'))
  if (listingRules.length)
    return { rules: listingRules, source: 'listing' }

  return { rules: DEFAULT_HOUSE_RULES.map(r => ({ ...r })), source: 'default' }
}

/** Accepts one-line rules (`'No smoking'`) and titled rules (`{ title, description }`). */
function cleanRules(value: unknown): HouseRule[] {
  if (!Array.isArray(value))
    return []
  return value.flatMap((entry): HouseRule[] => {
    if (typeof entry === 'string')
      return entry.trim() ? [{ title: entry.trim() }] : []
    if (entry && typeof entry === 'object') {
      const title = String((entry as HouseRule).title ?? '').trim()
      const description = String((entry as HouseRule).description ?? '').trim()
      return title ? [description ? { title, description } : { title }] : []
    }
    return []
  })
}

/** Builds the agreement input from a reservation, its listing and the guest's signed documents. */
export function houseRulesAgreementInput(
  reservation: ReservationEntry,
  sources: { listings: Listing[], guides: GuestGuide[] },
): HouseRulesAgreementInput {
  const listing = sources.listings.find(l => l.id === reservation.listingId)
  const docs = reservation.identity?.documents ?? []
  const agreement = docs.find(d => d.kind === 'agreement')
  const signature = docs.find(d => d.kind === 'signature')

  return {
    reservationId: reservation.id,
    guestName: reservation.guestName,
    guestEmail: reservation.guestEmail || undefined,
    listingName: reservation.listingName,
    checkIn: reservation.checkIn,
    checkOut: reservation.checkOut,
    checkInTime: reservation.checkInTime ?? listing?.resources?.basics?.checkInTime,
    checkOutTime: reservation.checkOutTime ?? listing?.resources?.basics?.checkOutTime,
    nights: reservation.nights,
    guestCount: reservation.guestCount,
    channel: reservation.channel,
    rules: resolveHouseRules(reservation, sources).rules,
    signedAt: agreement ? (agreement.uploadedAt || reservation.identity?.submittedAt) : undefined,
    signatureImageUrl: signature?.url,
  }
}

/** Local calendar date, so a `YYYY-MM-DD` string never shifts across UTC. */
function formatStayDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  const date = match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : new Date(value)
  if (Number.isNaN(date.getTime()))
    return value
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime()))
    return iso
  return date.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
}

function embeddableImageFormat(url: string | undefined): 'PNG' | 'JPEG' | null {
  if (!url)
    return null
  if (url.startsWith('data:image/png'))
    return 'PNG'
  if (url.startsWith('data:image/jpeg') || url.startsWith('data:image/jpg'))
    return 'JPEG'
  return null
}

export function houseRulesAgreementFileName(input: Pick<HouseRulesAgreementInput, 'guestName' | 'reservationId'>): string {
  const slug = input.guestName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `house-rules-agreement-${slug || input.reservationId}.pdf`
}

/**
 * Generate the A4 House Rules Agreement.
 *
 * Includes:
 *   - header with listing and reservation reference
 *   - stay details (guest, dates with check-in/out times, party size)
 *   - numbered house rules, wrapping onto new pages when long
 *   - guest declaration and signature block (drawn signature or typed name)
 *
 * Returns a Blob; also triggers a browser download when `download` is true.
 */
export function buildHouseRulesAgreementPdf(
  input: HouseRulesAgreementInput,
  opts: { download?: boolean } = {},
): Blob {
  const doc = new JsPdf({ unit: 'mm', format: 'a4' })
  let y = 0

  function ensureSpace(height: number) {
    if (y + height > BOTTOM_LIMIT) {
      doc.addPage()
      y = MARGIN
    }
  }

  function sectionHeading(label: string) {
    ensureSpace(14)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(30)
    doc.text(label, MARGIN, y)
    y += 2.5
    doc.setDrawColor(225)
    doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y)
    y += 6
  }

  // --- Header ------------------------------------------------------------
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.setTextColor(30)
  doc.text('House Rules Agreement', MARGIN, 26)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(110)
  doc.text(input.listingName, MARGIN, 33)
  doc.text(`Reservation ${input.reservationId}`, PAGE_WIDTH - MARGIN, 26, { align: 'right' })

  const signed = !!input.signedAt
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  if (signed)
    doc.setTextColor(22, 128, 61)
  else
    doc.setTextColor(180, 83, 9)
  doc.text(signed ? 'SIGNED' : 'AWAITING SIGNATURE', PAGE_WIDTH - MARGIN, 33, { align: 'right' })

  y = 46

  // --- Stay details ------------------------------------------------------
  sectionHeading('Stay details')
  const withTime = (date: string, time?: string) => time ? `${formatStayDate(date)}, from ${time}` : formatStayDate(date)
  const details: [string, string][] = [
    ['Guest', input.guestName],
    ...(input.guestEmail ? [['Email', input.guestEmail] as [string, string]] : []),
    ['Property', input.listingName],
    ['Check-in', withTime(input.checkIn, input.checkInTime)],
    ['Check-out', input.checkOutTime ? `${formatStayDate(input.checkOut)}, by ${input.checkOutTime}` : formatStayDate(input.checkOut)],
    ['Length of stay', `${input.nights} ${input.nights === 1 ? 'night' : 'nights'}`],
    ['Guests', String(input.guestCount)],
    ...(input.channel ? [['Booked via', input.channel] as [string, string]] : []),
  ]
  doc.setFontSize(10)
  for (const [label, value] of details) {
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(120)
    doc.text(label, MARGIN, y)
    doc.setTextColor(30)
    doc.text(value, MARGIN + 38, y)
    y += 6
  }
  y += 4

  // --- House rules -------------------------------------------------------
  // Title in bold, description underneath. A long description continues on
  // the next page line by line, but a title never sits alone at a page end.
  sectionHeading('House rules')
  const RULE_INDENT = MARGIN + 8
  const TITLE_LINE = 5
  const DESCRIPTION_LINE = 4.5
  input.rules.forEach((rule, i) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    const titleLines = doc.splitTextToSize(rule.title, CONTENT_WIDTH - 8) as string[]
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)
    const descriptionLines = rule.description
      ? doc.splitTextToSize(rule.description, CONTENT_WIDTH - 8) as string[]
      : []

    ensureSpace(titleLines.length * TITLE_LINE + Math.min(descriptionLines.length, 2) * DESCRIPTION_LINE)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(120)
    doc.text(`${i + 1}.`, MARGIN, y)
    doc.setTextColor(30)
    doc.text(titleLines, RULE_INDENT, y)
    y += titleLines.length * TITLE_LINE

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)
    doc.setTextColor(70)
    for (const line of descriptionLines) {
      ensureSpace(DESCRIPTION_LINE)
      doc.text(line, RULE_INDENT, y)
      y += DESCRIPTION_LINE
    }
    y += descriptionLines.length ? 4 : 2
  })
  y += 4

  // --- Declaration -------------------------------------------------------
  // The declaration and the signature under it always share a page, so the
  // signature never lands alone on a page away from what it signs.
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  const declaration = [
    `I, ${input.guestName}, confirm that I have read the house rules above and agree to follow them for the full length of my stay at ${input.listingName}.`,
    'I accept responsibility for every guest and visitor in my party. A breach of these rules may lead to additional charges for cleaning or repairs, or to the end of the stay without refund.',
  ].join('\n\n')
  const declarationLines = doc.splitTextToSize(declaration, CONTENT_WIDTH) as string[]
  const declarationHeight = declarationLines.length * 4.5
  const SIGNATURE_HEIGHT = 32
  ensureSpace(14 + declarationHeight + 8 + SIGNATURE_HEIGHT)
  sectionHeading('Declaration')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(60)
  doc.text(declarationLines, MARGIN, y)
  y += declarationHeight + 8

  // --- Signature block ---------------------------------------------------
  const lineY = y + 22
  const imageFormat = signed ? embeddableImageFormat(input.signatureImageUrl) : null
  let drewImage = false
  if (imageFormat && input.signatureImageUrl) {
    try {
      doc.addImage(input.signatureImageUrl, imageFormat, MARGIN + 4, y, 60, 20)
      drewImage = true
    }
    catch {
      // Signature image failed to embed; the typed name below stands in.
    }
  }
  if (signed && !drewImage) {
    doc.setFont('times', 'italic')
    doc.setFontSize(20)
    doc.setTextColor(30, 58, 138)
    doc.text(input.guestName, MARGIN + 4, lineY - 4)
  }

  doc.setDrawColor(170)
  doc.line(MARGIN, lineY, MARGIN + 80, lineY)
  doc.line(MARGIN + 100, lineY, PAGE_WIDTH - MARGIN, lineY)

  if (signed) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(30)
    doc.text(formatTimestamp(input.signedAt!), MARGIN + 100, lineY - 4)
  }

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(120)
  doc.text(`Guest signature · ${input.guestName}`, MARGIN, lineY + 5)
  doc.text(signed ? 'Signed electronically in the guest guide' : 'Not yet signed', MARGIN + 100, lineY + 5)

  // --- Footer on every page ----------------------------------------------
  const pages = doc.getNumberOfPages()
  const generated = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(150)
    doc.text(`Generated ${generated} · Elev8`, MARGIN, PAGE_HEIGHT - 10)
    doc.text(`Page ${page} of ${pages}`, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 10, { align: 'right' })
  }

  const blob = doc.output('blob')

  if (opts.download) {
    const url = URL.createObjectURL(blob)
    const anchor = window.document.createElement('a')
    anchor.href = url
    anchor.download = houseRulesAgreementFileName(input)
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return blob
}
