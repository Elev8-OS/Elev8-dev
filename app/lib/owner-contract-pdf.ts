// Owner contract PDF generation — builds a real PDF document from a signed
// (or pending) owner contract using jsPDF. The PDF includes the contract
// terms and, when available, the drawn signature image.

import type { OwnerContract } from '~/components/owners/data/owner-contracts'
import type { Owner } from '~/components/owners/data/owners'
import { jsPDF as JsPdf } from 'jspdf'

const PAGE_WIDTH = 210 // A4 mm
const MARGIN = 20
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2

/**
 * Generate a polished A4 PDF for an owner contract.
 *
 * Includes:
 *   - header (owner + covered listings)
 *   - commission terms (basis-labelled, PRD 5.1.4)
 *   - included services + operational fee
 *   - signature block with the drawn signature image (PNG data URL) when signed
 *
 * Returns a Blob ready for download; also triggers a browser download when
 * `download` is true.
 */
export function buildOwnerContractPdf(
  contract: OwnerContract,
  owner: Owner | undefined,
  opts: { download?: boolean } = {},
): Blob {
  const doc = new JsPdf({ unit: 'mm', format: 'a4' })

  // --- Header ------------------------------------------------------------
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.text('Management Agreement', MARGIN, 24)

  doc.setFontSize(10)
  doc.setTextColor(120)
  doc.text('Elev8 Owner Portal — e-signed contract', MARGIN, 30)

  // --- Parties -----------------------------------------------------------
  doc.setTextColor(30)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('Parties', MARGIN, 42)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`Owner: ${owner?.name ?? contract.ownerId}`, MARGIN, 48)
  doc.text(`Email: ${owner?.email ?? '—'}`, MARGIN, 53)
  doc.text(`Covered listings: ${contract.listingIds.join(', ')}`, MARGIN, 58)

  // --- Commission terms --------------------------------------------------
  const terms = contract.terms
  const basisLabel = terms.basis === 'net'
    ? `Fixed ${terms.fixedAmount ?? 0} + ${terms.rate}% of Net revenue`
    : `${terms.rate}% of Gross revenue`

  doc.setFont('helvetica', 'bold')
  doc.text('Commission & services', MARGIN, 72)
  doc.setFont('helvetica', 'normal')
  doc.text(`Commission model: ${basisLabel}`, MARGIN, 78)
  doc.text(`Included services: ${terms.includedServices.join(', ') || 'None'}`, MARGIN, 83)
  doc.text(
    `Operational costs covered by owner: ${terms.operationalFee}%`,
    MARGIN,
    88,
  )

  // --- Body copy ---------------------------------------------------------
  doc.setFont('helvetica', 'bold')
  doc.text('Agreement', MARGIN, 102)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  const body = [
    'This Management Agreement is entered into between the property owner and Elev8 for the',
    'management of the properties listed above.',
    '',
    'Operational costs (cleaning, utilities, maintenance) are billed separately and are never',
    'percentage-based. The commission basis is stated above so the owner always knows the',
    'base the rate is calculated against.',
    '',
    'A signed copy of this contract is stored in the owner\'s Document Center and remains',
    'available for download at any time.',
  ]
  const bodyText = body.join('\n')
  const bodyLines = doc.splitTextToSize(bodyText, CONTENT_WIDTH)
  doc.text(bodyLines, MARGIN, 108)

  // --- Signature block ---------------------------------------------------
  const signatureY = 150
  doc.setDrawColor(180)
  doc.line(MARGIN, signatureY, MARGIN + 80, signatureY)

  if (contract.signature?.imageDataUrl) {
    try {
      doc.addImage(contract.signature.imageDataUrl, 'PNG', MARGIN + 10, signatureY - 22, 60, 20)
    }
    catch {
      // Signature image failed to embed — keep the text-only block.
    }
  }

  doc.setFontSize(9)
  doc.setTextColor(120)
  doc.text('Signature', MARGIN, signatureY + 4)
  doc.text(
    contract.signature
      ? `${contract.signature.name} — ${new Date(contract.signature.signedAt).toLocaleString('en-GB')}`
      : 'Not yet signed',
    MARGIN + 90,
    signatureY + 4,
  )

  // --- Footer ------------------------------------------------------------
  doc.setFontSize(8)
  doc.setTextColor(150)
  doc.text(
    `Generated ${new Date().toLocaleDateString()} · Elev8 Owner Portal`,
    MARGIN,
    290,
  )

  const blob = doc.output('blob')

  if (opts.download) {
    const url = URL.createObjectURL(blob)
    const anchor = window.document.createElement('a')
    anchor.href = url
    anchor.download = `management-agreement-${owner?.name ?? contract.ownerId}.pdf`
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return blob
}
