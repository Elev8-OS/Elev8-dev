import { beforeEach, describe, expect, it } from 'vitest'
import { useDatev } from '~/composables/useDatev'
import { useReservations } from '~/composables/useReservations'
import { DATEV_FIELD_COUNT } from '~/lib/datev-extf'

/** CSV-aware split — a quoted Buchungstext may legitimately contain `;`. */
function splitRecord(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]!
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"')
        i++
      else
        inQuotes = !inQuotes
      continue
    }
    if (char === ';' && !inQuotes) {
      fields.push(current)
      current = ''
      continue
    }
    current += char
  }
  fields.push(current)
  return fields
}

const AUGUST = { from: '2026-08-01', to: '2026-08-31' }

// August 2026 EUR check-outs in the mock data: 11 completed + 1 cancelled.
const AUGUST_ELIGIBLE = 11
const AUGUST_TOTAL = 19290

function dataLines(content: string): string[] {
  // Line 1 is the EXTF header, line 2 the column captions.
  return content.split('\r\n').filter(Boolean).slice(2)
}

describe('scope', () => {
  beforeEach(() => localStorage.clear())

  it('includes only EUR bookings on EUR-tagged listings, dated by check-out', () => {
    const { setPeriod, eligibleReservations, scopeTotal } = useDatev()
    setPeriod(AUGUST.from, AUGUST.to)

    expect(eligibleReservations.value).toHaveLength(AUGUST_ELIGIBLE)
    expect(scopeTotal.value).toBe(AUGUST_TOTAL)
    for (const reservation of eligibleReservations.value) {
      expect(reservation.currency).toBe('EUR')
      expect(reservation.checkOut >= AUGUST.from && reservation.checkOut <= AUGUST.to).toBe(true)
    }
  })

  it('never leaks a CHF booking into the batch', () => {
    const { setPeriod, eligibleReservations } = useDatev()
    // May 2026 is dense with CHF Swiss bookings in the mock data.
    setPeriod('2026-05-01', '2026-05-31')
    expect(eligibleReservations.value.every(r => r.currency === 'EUR')).toBe(true)
  })

  it('reports what the gate excluded, grouped by reason', () => {
    const { setPeriod, excludedDigest } = useDatev()
    setPeriod('2026-05-01', '2026-05-31')

    const total = excludedDigest.value.reduce((sum, row) => sum + row.count, 0)
    expect(total).toBeGreaterThan(0)
    expect(excludedDigest.value.some(row => row.reason.includes('EUR-tagged'))).toBe(true)
  })

  it('excludes cancelled bookings by default', () => {
    const { settings, setPeriod, eligibleReservations, cancelledInPeriod } = useDatev()
    setPeriod(AUGUST.from, AUGUST.to)

    expect(settings.value.includeCancelled).toBe(false)
    expect(cancelledInPeriod.value).toBe(1)
    expect(eligibleReservations.value.some(r => r.status === 'Cancelled')).toBe(false)
  })

  it('includes cancelled bookings as reversals when the setting is on', () => {
    const { settings, setPeriod, eligibleReservations, postings, scopeTotal } = useDatev()
    setPeriod(AUGUST.from, AUGUST.to)
    settings.value = { ...settings.value, includeCancelled: true }

    expect(eligibleReservations.value).toHaveLength(AUGUST_ELIGIBLE + 1)
    expect(scopeTotal.value).toBe(AUGUST_TOTAL + 1630)
    expect(postings.value.filter(p => p.generalumkehr)).toHaveLength(1)
  })
})

describe('posting lines', () => {
  beforeEach(() => localStorage.clear())

  it('posts the debtor account against the channel revenue account', () => {
    const { settings, setPeriod, eligibleReservations, postings } = useDatev()
    setPeriod(AUGUST.from, AUGUST.to)

    const airbnbIndex = eligibleReservations.value.findIndex(r => r.channel === 'Airbnb')
    expect(airbnbIndex).toBeGreaterThanOrEqual(0)

    const posting = postings.value[airbnbIndex]!
    expect(posting.sollHaben).toBe('S')
    expect(posting.konto).toBe(settings.value.debitorenkonto)
    expect(posting.gegenkonto).toBe(settings.value.channelAccounts.Airbnb)
  })

  it('falls back to the default revenue account for an unmapped channel', () => {
    const { settings, setPeriod, eligibleReservations, postings } = useDatev()
    setPeriod(AUGUST.from, AUGUST.to)
    settings.value = { ...settings.value, channelAccounts: {} }

    const index = eligibleReservations.value.findIndex(r => r.channel === 'Airbnb')
    expect(postings.value[index]!.gegenkonto).toBe(settings.value.erloeskonto)
  })

  it('uses the invoice number as Belegfeld 1, falling back to the booking id', () => {
    const { setPeriod, eligibleReservations, postings } = useDatev()
    setPeriod(AUGUST.from, AUGUST.to)

    const pendingIndex = eligibleReservations.value.findIndex(r => r.invoice === 'pending')
    expect(pendingIndex).toBeGreaterThanOrEqual(0)
    expect(postings.value[pendingIndex]!.belegfeld1)
      .toBe(eligibleReservations.value[pendingIndex]!.id)
  })

  it('orders postings by check-out date', () => {
    const { setPeriod, postings } = useDatev()
    setPeriod(AUGUST.from, AUGUST.to)

    const dates = postings.value.map(p => p.belegdatum)
    expect(dates).toEqual([...dates].sort())
  })
})

describe('generate', () => {
  beforeEach(() => localStorage.clear())

  it('builds one 125-field record per eligible booking', async () => {
    const { setPeriod, generate } = useDatev()
    setPeriod(AUGUST.from, AUGUST.to)

    const record = await generate()
    expect(record).not.toBeNull()
    expect(record!.recordCount).toBe(AUGUST_ELIGIBLE)
    expect(record!.totalAmount).toBe(AUGUST_TOTAL)
    expect(record!.filename).toBe('EXTF_Buchungsstapel_2026-08.csv')

    const lines = dataLines(record!.content)
    expect(lines).toHaveLength(AUGUST_ELIGIBLE)
    for (const line of lines)
      expect(splitRecord(line)).toHaveLength(DATEV_FIELD_COUNT)
  })

  it('carries the tenant identity from settings into the file header', async () => {
    const { settings, setPeriod, generate } = useDatev()
    setPeriod(AUGUST.from, AUGUST.to)

    const record = await generate()
    const header = splitRecord(record!.content.split('\r\n')[0]!)
    expect(header[10]).toBe(settings.value.beraternummer)
    expect(header[11]).toBe(settings.value.mandantennummer)
    expect(header[26]).toBe('03') // SKR03
    expect(header[14]).toBe('20260801')
    expect(header[15]).toBe('20260831')
  })

  it('refuses to generate until Berater and Mandant are set', async () => {
    const { settings, setPeriod, generate, isConfigured } = useDatev()
    setPeriod(AUGUST.from, AUGUST.to)
    settings.value = { ...settings.value, beraternummer: '', mandantennummer: '' }

    expect(isConfigured.value).toBe(false)
    expect(await generate()).toBeNull()
  })

  it('refuses an inverted period', async () => {
    const { setPeriod, generate, isPeriodValid } = useDatev()
    setPeriod('2026-08-31', '2026-08-01')

    expect(isPeriodValid.value).toBe(false)
    expect(await generate()).toBeNull()
  })

  it('derives the fiscal year from the period, not from today', async () => {
    const { setPeriod, generate } = useDatev()
    setPeriod('2026-08-01', '2026-08-31')

    const record = await generate()
    const header = splitRecord(record!.content.split('\r\n')[0]!)
    expect(header[12]).toBe('20260101')
  })

  it('rolls the fiscal year back when it starts after the period', async () => {
    const { settings, setPeriod, generate } = useDatev()
    setPeriod('2026-08-01', '2026-08-31')
    // Fiscal year starting 01.10. means August 2026 belongs to FY 2025/26.
    settings.value = { ...settings.value, fiscalYearStartMonth: 10, fiscalYearStartDay: 1 }

    const record = await generate()
    const header = splitRecord(record!.content.split('\r\n')[0]!)
    expect(header[12]).toBe('20251001')
  })
})

describe('manual selection export', () => {
  beforeEach(() => localStorage.clear())

  function pick(ids: string[]) {
    const { reservations } = useReservations()
    return reservations.value.filter(r => ids.includes(r.id))
  }

  it('exports exactly the picked rows, ignoring the period', async () => {
    const { setPeriod, generateFromSelection } = useDatev()
    // Period is May; the selection is August. The selection must win.
    setPeriod('2026-05-01', '2026-05-31')

    const { record, included } = await generateFromSelection(pick(['de-res-121', 'de-res-124']))

    expect(included).toHaveLength(2)
    expect(record!.recordCount).toBe(2)
    expect(record!.totalAmount).toBe(1680 + 1720)
    expect(dataLines(record!.content)).toHaveLength(2)
  })

  it('derives the period from the selection check-out dates', async () => {
    const { generateFromSelection } = useDatev()
    const { record } = await generateFromSelection(pick(['de-res-121', 'de-res-129']))

    expect(record!.periodFrom).toBe('2026-08-06')
    expect(record!.periodTo).toBe('2026-08-29')

    const header = splitRecord(record!.content.split('\r\n')[0]!)
    expect(header[14]).toBe('20260806')
    expect(header[15]).toBe('20260829')
  })

  it('applies the EUR gate so a manual pick cannot smuggle in CHF', async () => {
    const { generateFromSelection } = useDatev()
    // '86109494' is a CHF Bali booking.
    const { record, included, excluded } = await generateFromSelection(
      pick(['de-res-121', '86109494']),
    )

    expect(included.map(r => r.id)).toEqual(['de-res-121'])
    expect(record!.recordCount).toBe(1)
    expect(excluded).toEqual([{ reason: 'Not a EUR-tagged listing (CHF)', count: 1 }])
  })

  it('excludes a cancelled pick unless the setting allows it', async () => {
    const { settings, generateFromSelection } = useDatev()
    const cancelled = pick(['de-res-126'])

    const off = await generateFromSelection(cancelled)
    expect(off.record).toBeNull()
    expect(off.excluded).toEqual([
      { reason: 'Cancelled booking (excluded by settings)', count: 1 },
    ])

    settings.value = { ...settings.value, includeCancelled: true }
    const on = await generateFromSelection(cancelled)
    expect(on.record!.recordCount).toBe(1)
  })

  it('returns no file when nothing in the selection is eligible', async () => {
    const { generateFromSelection } = useDatev()
    const { record, included } = await generateFromSelection(pick(['86109494']))

    expect(record).toBeNull()
    expect(included).toHaveLength(0)
  })

  it('produces the same bytes as a period export covering the same rows', async () => {
    const { setPeriod, generate, generateFromSelection, eligibleReservations } = useDatev()
    setPeriod('2026-08-01', '2026-08-31')
    const periodRecord = await generate()
    const rows = [...eligibleReservations.value]

    const { record: selectionRecord } = await generateFromSelection(rows)

    // Header differs (period bounds), but every posting line must match.
    expect(dataLines(selectionRecord!.content)).toEqual(dataLines(periodRecord!.content))
  })

  it('orders a shuffled selection by check-out date', async () => {
    const { generateFromSelection } = useDatev()
    const shuffled = pick(['de-res-129', 'de-res-121', 'de-res-124']).reverse()

    const { included } = await generateFromSelection(shuffled)
    const dates = included.map(r => r.checkOut)
    expect(dates).toEqual([...dates].sort())
  })
})

describe('export history', () => {
  beforeEach(() => localStorage.clear())

  it('warns when the period was already exported', async () => {
    const { setPeriod, generate, commitExport, existingExportForPeriod } = useDatev()
    setPeriod(AUGUST.from, AUGUST.to)
    expect(existingExportForPeriod.value).toBeNull()

    const record = await generate()
    commitExport(record!)

    expect(existingExportForPeriod.value?.id).toBe(record!.id)
  })

  it('does not duplicate an entry when the same file is committed twice', async () => {
    const { setPeriod, generate, commitExport, exports } = useDatev()
    setPeriod(AUGUST.from, AUGUST.to)

    const before = exports.value.length
    const record = await generate()
    commitExport(record!)
    commitExport(record!)

    expect(exports.value).toHaveLength(before + 1)
  })

  it('keeps the generated file so the period can be re-downloaded', async () => {
    const { setPeriod, generate, commitExport, exports } = useDatev()
    setPeriod(AUGUST.from, AUGUST.to)

    const record = await generate()
    commitExport(record!)

    const stored = exports.value.find(e => e.id === record!.id)!
    expect(dataLines(stored.content)).toHaveLength(AUGUST_ELIGIBLE)
  })

  it('drops an entry on delete', async () => {
    const { setPeriod, generate, commitExport, deleteExport, exports } = useDatev()
    setPeriod(AUGUST.from, AUGUST.to)

    const record = await generate()
    commitExport(record!)
    deleteExport(record!.id)

    expect(exports.value.some(e => e.id === record!.id)).toBe(false)
  })
})

describe('settings', () => {
  beforeEach(() => localStorage.clear())

  it('rejects a malformed Beraternummer', () => {
    const { settings, saveSettings } = useDatev()
    const result = saveSettings({ ...settings.value, beraternummer: '12345678' })

    expect(result.saved).toBe(false)
    expect(result.errors.beraternummer).toBeDefined()
  })

  it('re-seeds every account when the chart of accounts changes', () => {
    const { settings, switchChart } = useDatev()
    const skr04 = switchChart(settings.value, 'SKR04')

    expect(skr04.skr).toBe('SKR04')
    expect(skr04.erloeskonto).toBe('4400')
    expect(skr04.channelAccounts.Airbnb).toBe('4401')
    // Identity fields survive the switch.
    expect(skr04.beraternummer).toBe(settings.value.beraternummer)
  })

  it('persists saved settings to localStorage', () => {
    const { settings, saveSettings } = useDatev()
    saveSettings({ ...settings.value, advisorEmail: 'neu@kanzlei.de' })

    const stored = JSON.parse(localStorage.getItem('elev8-datev-settings-v1')!)
    expect(stored.advisorEmail).toBe('neu@kanzlei.de')
  })

  it('restores settings and history from localStorage on hydrate', () => {
    const first = useDatev()
    first.saveSettings({ ...first.settings.value, advisorEmail: 'neu@kanzlei.de' })

    // Simulate a fresh page load: reset in-memory state, then hydrate.
    first.settings.value = { ...first.settings.value, advisorEmail: 'wiped@example.de' }
    first.hydrate()

    expect(first.settings.value.advisorEmail).toBe('neu@kanzlei.de')
  })

  it('drafts an e-mail carrying the period, counts and format note', async () => {
    const { setPeriod, generate, buildMailto } = useDatev()
    setPeriod(AUGUST.from, AUGUST.to)

    const record = await generate()
    const mailto = decodeURIComponent(buildMailto(record!))

    expect(mailto).toContain('kanzlei@steuerberater-mueller.de')
    expect(mailto).toContain('01.08.2026 – 31.08.2026')
    expect(mailto).toContain('EXTF_Buchungsstapel_2026-08.csv')
    expect(mailto).toContain(String(AUGUST_ELIGIBLE))
  })
})
