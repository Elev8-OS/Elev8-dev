import type { DatevPostingRecord } from '~/lib/datev-extf'
import { describe, expect, it } from 'vitest'
import {
  BOOKING_FIELDS,
  buildColumnHeader,
  buildExtfFile,
  buildExtfHeader,
  buildFilename,
  buildPostingLine,
  DATEV_FIELD_COUNT,
  encodeCp1252,
  formatAmount,
  formatBelegdatum,
  sanitizeBelegfeld,
  truncateBuchungstext,
} from '~/lib/datev-extf'

/** CSV-aware split — a quoted Buchungstext may legitimately contain `;`. */
function splitRecord(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]!
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      }
      else {
        inQuotes = !inQuotes
        current += char
      }
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

const posting: DatevPostingRecord = {
  umsatz: 1420,
  sollHaben: 'S',
  waehrung: 'EUR',
  konto: '10000',
  gegenkonto: '8401',
  belegdatum: '2026-06-06',
  leistungsdatum: '2026-06-06',
  belegfeld1: 'RE-2026-0601',
  buchungstext: 'Hannah Bergmann / Villa Luwa',
}

const headerOptions = {
  beraternummer: '1234567',
  mandantennummer: '10234',
  wirtschaftsjahresbeginn: '2026-01-01',
  datumVon: '2026-06-01',
  datumBis: '2026-06-30',
  sachkontenrahmen: '03',
  bezeichnung: 'Elev8 2026-06-01 - 2026-06-30',
  erzeugtAm: new Date(2026, 6, 3, 9, 12, 0, 0),
}

describe('field table', () => {
  it('defines exactly 125 columns', () => {
    expect(BOOKING_FIELDS).toHaveLength(DATEV_FIELD_COUNT)
  })

  it('emits 125 captions in the column header row', () => {
    expect(splitRecord(buildColumnHeader())).toHaveLength(DATEV_FIELD_COUNT)
  })

  it('anchors the columns the posting builder writes to', () => {
    expect(BOOKING_FIELDS[0]!.name).toBe('Umsatz (ohne Soll/Haben-Kz)')
    expect(BOOKING_FIELDS[1]!.name).toBe('Soll/Haben-Kennzeichen')
    expect(BOOKING_FIELDS[6]!.name).toBe('Konto')
    expect(BOOKING_FIELDS[7]!.name).toBe('Gegenkonto (ohne BU-Schlüssel)')
    expect(BOOKING_FIELDS[8]!.name).toBe('BU-Schlüssel')
    expect(BOOKING_FIELDS[9]!.name).toBe('Belegdatum')
    expect(BOOKING_FIELDS[10]!.name).toBe('Belegfeld 1')
    expect(BOOKING_FIELDS[13]!.name).toBe('Buchungstext')
    expect(BOOKING_FIELDS[113]!.name).toBe('Festschreibung')
    expect(BOOKING_FIELDS[117]!.name).toBe('Generalumkehr (GU)')
  })
})

describe('posting record', () => {
  it('writes exactly 125 fields', () => {
    expect(splitRecord(buildPostingLine(posting))).toHaveLength(DATEV_FIELD_COUNT)
  })

  it('places every populated value in its DATEV field position', () => {
    const f = splitRecord(buildPostingLine(posting))
    expect(f[0]).toBe('1420,00') // 1  Umsatz
    expect(f[1]).toBe('"S"') //     2  Soll/Haben
    expect(f[2]).toBe('"EUR"') //   3  WKZ
    expect(f[6]).toBe('10000') //   7  Konto
    expect(f[7]).toBe('8401') //    8  Gegenkonto
    expect(f[9]).toBe('0606') //   10  Belegdatum TTMM
    expect(f[10]).toBe('"RE-2026-0601"') // 11 Belegfeld 1
    expect(f[13]).toBe('"Hannah Bergmann / Villa Luwa"') // 14 Buchungstext
    expect(f[113]).toBe('0') //   114  Festschreibung
    expect(f[114]).toBe('06062026') // 115 Leistungsdatum DDMMYYYY
  })

  it('leaves the BU-Schlüssel empty — the advisor assigns VAT keys on import', () => {
    expect(splitRecord(buildPostingLine(posting))[8]).toBe('""')
  })

  it('quotes empty text fields but leaves empty numeric/date fields bare', () => {
    const f = splitRecord(buildPostingLine(posting))
    // Field 12 (Belegfeld 2) is text and unpopulated -> "".
    expect(f[11]).toBe('""')
    // Field 13 (Skonto) is numeric and unpopulated -> truly empty.
    expect(f[12]).toBe('')
    // Field 4 (Kurs) and 5 (Basis-Umsatz) are numeric and unpopulated.
    expect(f[3]).toBe('')
    expect(f[4]).toBe('')
    // Field 6 (WKZ Basis-Umsatz) is text and unpopulated.
    expect(f[5]).toBe('""')
  })

  it('never quotes a numeric or date column', () => {
    const f = splitRecord(buildPostingLine(posting))
    BOOKING_FIELDS.forEach((field, index) => {
      if (field.kind !== 'text')
        expect(f[index], `field ${index + 1} (${field.name})`).not.toContain('"')
    })
  })

  it('writes Generalumkehr = 1 for a cancellation and leaves it empty otherwise', () => {
    const cancelled = splitRecord(buildPostingLine({ ...posting, generalumkehr: true }))
    expect(cancelled[117]).toBe('"1"')
    expect(splitRecord(buildPostingLine(posting))[117]).toBe('""')
  })

  it('keeps the amount positive and carries the sign in the Soll/Haben flag', () => {
    const credit = splitRecord(buildPostingLine({ ...posting, umsatz: -1420, sollHaben: 'H' }))
    expect(credit[0]).toBe('1420,00')
    expect(credit[1]).toBe('"H"')
  })

  it('escapes an embedded quote by doubling it', () => {
    // Asserted on the raw line: splitRecord un-doubles quotes while parsing.
    const line = buildPostingLine({ ...posting, buchungstext: 'Guest "Nick" Meier' })
    expect(line).toContain('"Guest ""Nick"" Meier"')
    expect(splitRecord(line)).toHaveLength(DATEV_FIELD_COUNT)
  })

  it('keeps a semicolon inside the quoted Buchungstext from splitting the record', () => {
    const line = buildPostingLine({ ...posting, buchungstext: 'Meier; Villa Luwa' })
    expect(splitRecord(line)).toHaveLength(DATEV_FIELD_COUNT)
  })
})

describe('value formatting', () => {
  it('formats amounts with a decimal comma and two decimals', () => {
    expect(formatAmount(1420)).toBe('1420,00')
    expect(formatAmount(1234.5)).toBe('1234,50')
    expect(formatAmount(-99.999)).toBe('100,00')
  })

  it('formats Belegdatum as TTMM with leading zeros', () => {
    expect(formatBelegdatum('2026-06-06')).toBe('0606')
    expect(formatBelegdatum('2026-12-31')).toBe('3112')
    expect(formatBelegdatum('2026-01-01')).toBe('0101')
  })

  it('strips punctuation DATEV rejects in Belegfeld 1 and caps it at 36 chars', () => {
    expect(sanitizeBelegfeld('RE-2026/0601 *')).toBe('RE-20260601')
    expect(sanitizeBelegfeld('A'.repeat(50))).toHaveLength(36)
  })

  it('caps Buchungstext at the 60-character format limit', () => {
    expect(truncateBuchungstext('x'.repeat(80))).toHaveLength(60)
    expect(truncateBuchungstext('Guest\nName')).toBe('Guest Name')
  })
})

describe('extf header', () => {
  it('writes 31 fields identifying format 700 / record version 13', () => {
    const f = splitRecord(buildExtfHeader(headerOptions))
    expect(f).toHaveLength(31)
    expect(f[0]).toBe('"EXTF"')
    expect(f[1]).toBe('700') //  Versionsnummer
    expect(f[2]).toBe('21') //   Datenkategorie: Buchungsstapel
    expect(f[3]).toBe('"Buchungsstapel"')
    expect(f[4]).toBe('13') //   Formatversion
  })

  it('carries the per-tenant identity and period into the header', () => {
    const f = splitRecord(buildExtfHeader(headerOptions))
    expect(f[10]).toBe('1234567') // Beraternummer
    expect(f[11]).toBe('10234') //   Mandantennummer
    expect(f[12]).toBe('20260101') // WJ-Beginn
    expect(f[13]).toBe('4') //       Sachkontenlänge
    expect(f[14]).toBe('20260601') // Datum von
    expect(f[15]).toBe('20260630') // Datum bis
    expect(f[20]).toBe('0') //       Festschreibung: nein
    expect(f[21]).toBe('"EUR"')
    expect(f[26]).toBe('"03"') //    SKR
  })

  it('leaves reserved header fields completely empty', () => {
    const f = splitRecord(buildExtfHeader(headerOptions))
    for (const index of [6, 22, 24, 25, 28, 29])
      expect(f[index], `header field ${index + 1}`).toBe('')
  })
})

describe('assembled file', () => {
  const file = buildExtfFile([posting, { ...posting, belegfeld1: 'RE-2026-0602' }], headerOptions)

  it('uses CRLF line endings and terminates with one', () => {
    expect(file.content.endsWith('\r\n')).toBe(true)
    expect(file.content.split('\r\n').filter(Boolean)).toHaveLength(4) // header + captions + 2
    expect(file.content).not.toMatch(/[^\r]\n/)
  })

  it('reports the record count excluding the two header rows', () => {
    expect(file.recordCount).toBe(2)
  })

  it('gives every row 125 fields', () => {
    const rows = file.content.split('\r\n').filter(Boolean).slice(1)
    for (const row of rows)
      expect(splitRecord(row)).toHaveLength(DATEV_FIELD_COUNT)
  })

  it('names single-month and multi-month files differently', () => {
    expect(buildFilename('2026-06-01', '2026-06-30')).toBe('EXTF_Buchungsstapel_2026-06.csv')
    expect(buildFilename('2026-06-01', '2026-08-31')).toBe('EXTF_Buchungsstapel_2026-06_2026-08.csv')
  })
})

describe('cp1252 encoding', () => {
  it('encodes ASCII one byte per character', () => {
    expect([...encodeCp1252('EXTF')]).toEqual([0x45, 0x58, 0x54, 0x46])
  })

  it('encodes German umlauts as single Latin-1 bytes', () => {
    expect([...encodeCp1252('äöüÄÖÜß')]).toEqual([0xE4, 0xF6, 0xFC, 0xC4, 0xD6, 0xDC, 0xDF])
  })

  it('encodes the Windows-1252 specials that UTF-8 listing names carry', () => {
    // En dash and euro sign appear in the DACH villa names and amounts.
    expect([...encodeCp1252('–')]).toEqual([0x96])
    expect([...encodeCp1252('€')]).toEqual([0x80])
    expect([...encodeCp1252('’')]).toEqual([0x92])
  })

  it('encodes a real listing name without dropping to a multi-byte sequence', () => {
    const bytes = encodeCp1252('Villa Luwa – Hügellage Brandenburg')
    expect(bytes).toHaveLength('Villa Luwa – Hügellage Brandenburg'.length)
  })

  it('falls back to "?" for characters outside CP1252 instead of throwing', () => {
    expect([...encodeCp1252('日')]).toEqual([0x3F])
  })
})
