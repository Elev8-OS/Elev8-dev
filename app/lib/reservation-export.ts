import type { SheetData } from 'write-excel-file/browser'
import type { ReservationEntry } from '~/components/reservations/data/reservations'
import type { ReservationPeriod } from '~/lib/reservation-period'
import { reservationStatusLabels } from '~/components/reservations/data/reservations'
import { cleaningFeeInPeriod, currencyDecimals, hasPeriod, nightsInPeriod, roomRevenueInPeriod } from '~/lib/reservation-period'

/**
 * Excel (.xlsx) export of the Reservations list. Amounts stay numbers beside
 * their own Currency column: never converted, never summed across currencies.
 */

type ColumnKind = 'text' | 'number' | 'date' | 'money'

interface ExportColumn {
  header: string
  width: number
  kind: ColumnKind
  value: (r: ReservationEntry) => string | number | undefined
}

const isBusiness = (r: ReservationEntry) => r.contactType === 'business'

export const RESERVATION_EXPORT_COLUMNS: ExportColumn[] = [
  { header: 'Booking ID', width: 14, kind: 'text', value: r => r.id },
  { header: 'Status', width: 14, kind: 'text', value: r => reservationStatusLabels[r.status] ?? r.status },
  { header: 'Channel', width: 12, kind: 'text', value: r => r.channel },
  { header: 'Listing', width: 28, kind: 'text', value: r => r.listingName },
  { header: 'Guest', width: 24, kind: 'text', value: r => r.guestName },
  { header: 'Email', width: 28, kind: 'text', value: r => r.guestEmail },
  { header: 'Phone', width: 18, kind: 'text', value: r => r.guestPhone },
  { header: 'Country', width: 12, kind: 'text', value: r => r.guestCountry },
  { header: 'Company', width: 22, kind: 'text', value: r => isBusiness(r) ? r.companyName : undefined },
  { header: 'VAT ID', width: 16, kind: 'text', value: r => isBusiness(r) ? r.companyVatId : undefined },
  { header: 'Check-in', width: 12, kind: 'date', value: r => r.checkIn },
  { header: 'Check-out', width: 12, kind: 'date', value: r => r.checkOut },
  { header: 'Nights', width: 8, kind: 'number', value: r => r.nights },
  { header: 'Guests', width: 8, kind: 'number', value: r => r.guestCount },
  { header: 'Adults', width: 8, kind: 'number', value: r => r.guestAdults },
  { header: 'Children', width: 8, kind: 'number', value: r => r.guestChildren },
  { header: 'Infants', width: 8, kind: 'number', value: r => r.guestInfants },
  { header: 'Currency', width: 9, kind: 'text', value: r => r.currency },
  { header: 'Total', width: 14, kind: 'money', value: r => r.totalPrice },
  { header: 'Subtotal', width: 14, kind: 'money', value: r => r.priceDetails?.subtotal },
  { header: 'Cleaning Fee', width: 13, kind: 'money', value: r => r.priceDetails?.cleaningFee },
  { header: 'Service Fee', width: 13, kind: 'money', value: r => r.priceDetails?.serviceFee },
  { header: 'Tax', width: 12, kind: 'money', value: r => r.priceDetails?.tax },
  { header: 'Extras', width: 12, kind: 'money', value: r => r.priceDetails?.extras },
  { header: 'Guest Paid', width: 14, kind: 'money', value: r => r.priceDetails?.guestPaid },
  { header: 'Commission', width: 13, kind: 'money', value: r => r.priceDetails?.commission },
  { header: 'Payout', width: 14, kind: 'money', value: r => r.priceDetails?.payout },
  { header: 'Booking Note', width: 40, kind: 'text', value: r => r.bookingNote },
]

/**
 * Added after Total when the export has a date range. A stay crossing the
 * range edge only counts its nights inside it, the same rule as Analytics,
 * so consecutive monthly exports add up to each stay exactly once.
 */
export function periodColumns(period: ReservationPeriod): ExportColumn[] {
  return [
    { header: 'Nights in Period', width: 10, kind: 'number', value: r => nightsInPeriod(r, period) },
    { header: 'Room Revenue in Period', width: 16, kind: 'money', value: r => roomRevenueInPeriod(r, period) },
    { header: 'Cleaning Fee in Period', width: 16, kind: 'money', value: r => cleaningFeeInPeriod(r, period) },
  ]
}

export function exportColumns(period?: ReservationPeriod): ExportColumn[] {
  if (!period || !hasPeriod(period))
    return RESERVATION_EXPORT_COLUMNS
  const at = RESERVATION_EXPORT_COLUMNS.findIndex(c => c.header === 'Total') + 1
  return [...RESERVATION_EXPORT_COLUMNS.slice(0, at), ...periodColumns(period), ...RESERVATION_EXPORT_COLUMNS.slice(at)]
}

/** IDR 500,000 without decimals, CHF / USD with two. */
export function moneyFormat(currency: string): string {
  return currencyDecimals(currency) === 0 ? '#,##0' : '#,##0.00'
}

/**
 * A `YYYY-MM-DD` stay date as a UTC midnight `Date`: the writer converts with
 * `getTime()`, so a local midnight would land on the previous day in UTC+8.
 */
export function stayDateToCell(iso: string): Date | undefined {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d)
    return undefined
  return new Date(Date.UTC(y, m - 1, d))
}

function cell(column: ExportColumn, r: ReservationEntry) {
  const raw = column.value(r)
  if (raw === undefined || raw === null || raw === '')
    return null
  switch (column.kind) {
    case 'date': {
      const date = stayDateToCell(String(raw))
      return date ? { type: Date, value: date, format: 'yyyy-mm-dd' } : { type: String, value: String(raw) }
    }
    case 'money':
      return { type: Number, value: Number(raw), format: moneyFormat(r.currency) }
    case 'number':
      return { type: Number, value: Number(raw) }
    default:
      return { type: String, value: String(raw) }
  }
}

export function buildReservationsSheet(reservations: ReservationEntry[], period?: ReservationPeriod): SheetData {
  const columns = exportColumns(period)
  const header = columns.map(c => ({ value: c.header, fontWeight: 'bold' as const }))
  const rows = reservations.map(r => columns.map(c => cell(c, r)))
  return [header, ...rows] as SheetData
}

/** Local `YYYY-MM-DD` (not `toISOString`, which shifts a UTC+8 date). */
function localDateStamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** `reservations-2026-09-01_2026-09-30.xlsx` for a range, else today's date. */
export function reservationsExportFileName(period?: ReservationPeriod, date = new Date()): string {
  if (period && hasPeriod(period))
    return `reservations-${period.from || 'start'}_${period.to || 'end'}.xlsx`
  return `reservations-${localDateStamp(date)}.xlsx`
}

/** Writes and downloads the workbook. The writer is loaded only on demand. */
export async function downloadReservationsXlsx(reservations: ReservationEntry[], period?: ReservationPeriod) {
  const { default: writeXlsxFile } = await import('write-excel-file/browser')
  await writeXlsxFile(buildReservationsSheet(reservations, period), {
    sheet: 'Reservations',
    columns: exportColumns(period).map(c => ({ width: c.width })),
    stickyRowsCount: 1,
  }).toFile(reservationsExportFileName(period))
}
