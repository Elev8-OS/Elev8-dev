import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { describe, expect, it } from 'vitest'

// The detail sheet is too heavy to mount here, so read its source like the
// inbox button spec does. The PDF itself is covered by the folio invoice specs.
describe('reservation detail invoice button', () => {
  const source = readFileSync(join(process.cwd(), 'app/components/reservations/ReservationDetailSheet.vue'), 'utf8')

  it('sits in the Details tab actions, above the guest guide link', () => {
    const actions = source.slice(source.indexOf('<!-- Actions -->'), source.indexOf('View guest guide'))
    expect(actions).toContain('data-testid="reservation-download-invoice"')
    expect(actions).toContain('@click="downloadInvoice"')
  })

  it('builds the invoice PDF with a download', () => {
    expect(source).toContain('buildFolioInvoicePdf(reservation.value, { download: true })')
  })

  it('is hidden for inquiries, blocks and owner requests', () => {
    expect(source).toContain('v-if="canDownloadInvoice"')
    expect(source).toContain('![\'inquiry\', \'blocked\', \'owner_request\'].includes(reservation.value!.status)')
  })
})
