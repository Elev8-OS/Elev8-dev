import type { ReservationEntry } from '~/components/reservations/data/reservations'
import { describe, expect, it } from 'vitest'
import {
  buildReservationsSheet,
  moneyFormat,
  RESERVATION_EXPORT_COLUMNS,
  reservationsExportFileName,
  stayDateToCell,
} from '~/lib/reservation-export'

function reservation(overrides: Partial<ReservationEntry> = {}): ReservationEntry {
  return {
    id: 'RES-1',
    guestId: 'g-1',
    guestName: 'Ana Putri',
    guestEmail: 'ana@example.com',
    guestPhone: '+62 811',
    guestLanguage: 'en',
    guestNotes: '',
    listingId: 'lst-1',
    listingName: 'Villa Luwa, Canggu',
    channel: 'Airbnb',
    checkIn: '2026-10-10',
    checkOut: '2026-10-13',
    nights: 3,
    guestCount: 2,
    totalPrice: 450,
    currency: 'USD',
    status: 'verified',
    activity: [],
    ...overrides,
  }
}

const col = (header: string) => RESERVATION_EXPORT_COLUMNS.findIndex(c => c.header === header)

describe('buildReservationsSheet', () => {
  it('writes a bold header row and one row per reservation', () => {
    const sheet = buildReservationsSheet([reservation(), reservation({ id: 'RES-2' })])
    expect(sheet).toHaveLength(3)
    expect(sheet[0]).toEqual(RESERVATION_EXPORT_COLUMNS.map(c => ({ value: c.header, fontWeight: 'bold' })))
  })

  it('uses status labels', () => {
    const row = buildReservationsSheet([reservation({ status: 'checked_in' })])[1] as any[]
    expect(row[col('Status')]).toEqual({ type: String, value: 'Checked in' })
  })

  it('keeps amounts numeric beside their currency, formatted per currency', () => {
    const row = buildReservationsSheet([reservation({ currency: 'IDR', totalPrice: 500000 })])[1] as any[]
    expect(row[col('Currency')]).toEqual({ type: String, value: 'IDR' })
    expect(row[col('Total')]).toEqual({ type: Number, value: 500000, format: '#,##0' })
    expect(moneyFormat('CHF')).toBe('#,##0.00')
  })

  it('writes stay dates as real dates at UTC midnight', () => {
    const row = buildReservationsSheet([reservation()])[1] as any[]
    expect(row[col('Check-in')].type).toBe(Date)
    expect(row[col('Check-in')].value.toISOString()).toBe('2026-10-10T00:00:00.000Z')
    expect(stayDateToCell('not-a-date')).toBeUndefined()
  })

  it('leaves missing values and personal-contact company fields empty', () => {
    const personal = buildReservationsSheet([reservation({ companyName: 'Acme' })])[1] as any[]
    const business = buildReservationsSheet([reservation({ contactType: 'business', companyName: 'Acme' })])[1] as any[]
    expect(personal[col('Company')]).toBeNull()
    expect(personal[col('Subtotal')]).toBeNull()
    expect(business[col('Company')]).toEqual({ type: String, value: 'Acme' })
  })
})

describe('xlsx output', () => {
  it('produces a valid workbook the writer accepts', async () => {
    const { default: writeXlsxFile } = await import('write-excel-file/universal')
    const blob = await writeXlsxFile(buildReservationsSheet([reservation()]), {
      sheet: 'Reservations',
      columns: RESERVATION_EXPORT_COLUMNS.map(c => ({ width: c.width })),
      stickyRowsCount: 1,
    }).toBlob()
    const bytes = new Uint8Array(await blob.arrayBuffer())
    // xlsx is a zip: starts with "PK".
    expect(bytes[0]).toBe(0x50)
    expect(bytes[1]).toBe(0x4B)
  })
})

describe('reservationsExportFileName', () => {
  it('stamps the local date with an .xlsx extension', () => {
    expect(reservationsExportFileName(new Date(2026, 9, 8, 0, 30))).toBe('reservations-2026-10-08.xlsx')
  })
})
