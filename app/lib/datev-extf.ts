/**
 * DATEV EXTF "Buchungsstapel" writer — format 700, record version 13.
 *
 * Reference: https://developer.datev.de/en/file-format/details/datev-format/getting-started
 *
 * Format rules that the official DATEV validation tool enforces (do not regress):
 *  - `;` separator, CRLF line endings, CP1252 encoding
 *  - exactly 125 fields per posting record
 *  - text fields are ALWAYS quoted — an empty text field must be `""`
 *  - numeric/date fields are NEVER quoted — an empty one is written as nothing.
 *    Quoting an empty numeric field raises one checker message per field.
 *  - amounts use a decimal comma and are always positive; the sign lives in the
 *    separate Soll/Haben flag
 *  - Belegdatum is TTMM (day+month, no year — the year comes from the header)
 *  - BU-Schlüssel is left empty and Festschreibung is 0 on purpose: the tax
 *    advisor assigns VAT keys on import.
 */

export const DATEV_FIELD_COUNT = 125

/** Whether a column is quoted (`text`) or bare (`number` / `date`). */
type FieldKind = 'text' | 'number' | 'date'

interface FieldDef {
  name: string
  kind: FieldKind
}

function t(name: string): FieldDef {
  return { name, kind: 'text' }
}
function n(name: string): FieldDef {
  return { name, kind: 'number' }
}
function d(name: string): FieldDef {
  return { name, kind: 'date' }
}

/** Repeating blocks: Beleginfo 1-8, Zusatzinformation 1-20. */
function repeated(prefix: string, count: number): FieldDef[] {
  const out: FieldDef[] = []
  for (let i = 1; i <= count; i++) {
    out.push(t(`${prefix} - Art ${i}`))
    out.push(t(`${prefix} - Inhalt ${i}`))
  }
  return out
}

/**
 * The 125 columns of a version-13 Buchungsstapel, in order.
 * Index 0 here === DATEV field 1.
 */
export const BOOKING_FIELDS: FieldDef[] = [
  n('Umsatz (ohne Soll/Haben-Kz)'), //   1
  t('Soll/Haben-Kennzeichen'), //        2
  t('WKZ Umsatz'), //                    3
  n('Kurs'), //                          4
  n('Basis-Umsatz'), //                  5
  t('WKZ Basis-Umsatz'), //              6
  n('Konto'), //                         7
  n('Gegenkonto (ohne BU-Schlüssel)'), // 8
  t('BU-Schlüssel'), //                  9
  d('Belegdatum'), //                   10
  t('Belegfeld 1'), //                  11
  t('Belegfeld 2'), //                  12
  n('Skonto'), //                       13
  t('Buchungstext'), //                 14
  n('Postensperre'), //                 15
  t('Diverse Adressnummer'), //         16
  t('Geschäftspartnerbank'), //         17
  t('Sachverhalt'), //                  18
  n('Zinssperre'), //                   19
  t('Beleglink'), //                    20
  ...repeated('Beleginfo', 8), //       21-36
  t('KOST1 - Kostenstelle'), //         37
  t('KOST2 - Kostenstelle'), //         38
  n('KOST-Menge'), //                   39
  t('EU-Land u. UStID (Bestimmung)'), // 40
  n('EU-Steuersatz (Bestimmung)'), //   41
  t('Abw. Versteuerungsart'), //        42
  n('Sachverhalt L+L'), //              43
  n('Funktionsergänzung L+L'), //       44
  n('BU 49 Hauptfunktionstyp'), //      45
  n('BU 49 Hauptfunktionsnummer'), //   46
  n('BU 49 Funktionsergänzung'), //     47
  ...repeated('Zusatzinformation', 20), // 48-87
  n('Stück'), //                        88
  n('Gewicht'), //                      89
  t('Zahlweise'), //                    90
  t('Forderungsart'), //                91
  n('Veranlagungsjahr'), //             92
  d('Zugeordnete Fälligkeit'), //       93
  t('Skontotyp'), //                    94
  t('Auftragsnummer'), //               95
  t('Buchungstyp'), //                  96
  t('USt-Schlüssel (Anzahlungen)'), //  97
  t('EU-Land (Anzahlungen)'), //        98
  t('Sachverhalt L+L (Anzahlungen)'), // 99
  n('EU-Steuersatz (Anzahlungen)'), // 100
  n('Erlöskonto (Anzahlungen)'), //    101
  t('Herkunft-Kz'), //                 102
  t('Buchungs GUID'), //               103
  t('KOST-Datum'), //                  104
  t('SEPA-Mandatsreferenz'), //        105
  n('Skontosperre'), //                106
  t('Gesellschaftername'), //          107
  n('Beteiligtennummer'), //           108
  t('Identifikationsnummer'), //       109
  t('Zeichnernummer'), //              110
  d('Postensperre bis'), //            111
  t('Bezeichnung SoBil-Sachverhalt'), // 112
  n('Kennzeichen SoBil-Buchung'), //   113
  n('Festschreibung'), //              114
  d('Leistungsdatum'), //              115
  d('Datum Zuord. Steuerperiode'), //  116
  d('Fälligkeit'), //                  117
  t('Generalumkehr (GU)'), //          118
  n('Steuersatz'), //                  119
  t('Land'), //                        120
  t('Abrechnungsreferenz'), //         121
  n('BVV-Position'), //                122
  t('EU-Land u. UStID (Ursprung)'), // 123
  n('EU-Steuersatz (Ursprung)'), //    124
  n('Abw. Skontokonto'), //            125
]

/** A single posting line, keyed by the DATEV field names we actually populate. */
export interface DatevPostingRecord {
  /** Gross amount, always positive. The sign lives in `sollHaben`. */
  umsatz: number
  /** 'S' = debit on `konto`, 'H' = credit on `konto`. */
  sollHaben: 'S' | 'H'
  /** ISO 4217 code, e.g. 'EUR'. */
  waehrung: string
  /** Debtor / receivable account. */
  konto: string
  /** Contra account — the revenue account for this channel. */
  gegenkonto: string
  /** ISO date (YYYY-MM-DD). Written to the file as TTMM. */
  belegdatum: string
  /** Document number (invoice no. / reservation id). Max 36 chars. */
  belegfeld1: string
  /** Posting text. Max 60 chars. */
  buchungstext: string
  /** ISO date — service completion, written as TTMM. */
  leistungsdatum?: string
  /** Cost centre (e.g. per listing). Optional in V1. */
  kost1?: string
  /** `true` writes Generalumkehr = 1 (reversal, used for cancellations). */
  generalumkehr?: boolean
}

export interface ExtfHeaderOptions {
  beraternummer: string
  mandantennummer: string
  /** ISO date of the first day of the fiscal year. */
  wirtschaftsjahresbeginn: string
  /** ISO date, inclusive. */
  datumVon: string
  /** ISO date, inclusive. */
  datumBis: string
  /** '03' | '04' — the chart of accounts digits. */
  sachkontenrahmen: string
  /** G/L account length. DATEV allows 4-8; Elev8 assumes 4. */
  sachkontenlaenge?: number
  bezeichnung: string
  waehrung?: string
  /** Free-text shown in DATEV's import dialog. */
  herkunft?: string
  exportiertVon?: string
  /** Injectable for deterministic tests. */
  erzeugtAm?: Date
}

// ── primitives ────────────────────────────────────────────────────────────

/**
 * Escapes and quotes a text value. DATEV escapes an embedded quote by doubling
 * it; newlines would break the record so they collapse to a space.
 */
function quoteText(value: string): string {
  return `"${value.replace(/"/g, '""').replace(/[\r\n]+/g, ' ')}"`
}

/** Amount with a decimal comma, always positive, always two decimals. */
export function formatAmount(value: number): string {
  return Math.abs(value).toFixed(2).replace('.', ',')
}

/** ISO date -> TTMM (Belegdatum has no year; the header carries it). */
export function formatBelegdatum(isoDate: string): string {
  const [, month, day] = isoDate.split('-')
  return `${day}${month}`
}

/** ISO date -> DDMMYYYY (Leistungsdatum and friends carry the full year). */
export function formatFullDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-')
  return `${day}${month}${year}`
}

/** ISO date -> YYYYMMDD (header date fields). */
export function formatHeaderDate(isoDate: string): string {
  return isoDate.replace(/-/g, '')
}

/**
 * Belegfeld 1 is the document number the advisor matches against. DATEV rejects
 * most punctuation here, so keep it to alphanumerics, dash and underscore.
 */
export function sanitizeBelegfeld(value: string): string {
  return value.replace(/[^\w\-]/g, '').slice(0, 36)
}

/** Buchungstext is capped at 60 characters by the format. */
export function truncateBuchungstext(value: string): string {
  return value.replace(/[\r\n;]+/g, ' ').trim().slice(0, 60)
}

// ── header (line 1) ───────────────────────────────────────────────────────

function formatTimestamp(date: Date): string {
  const pad = (v: number, len = 2) => String(v).padStart(len, '0')
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
    + `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
    + `${pad(date.getMilliseconds(), 3)}`
  )
}

export function buildExtfHeader(options: ExtfHeaderOptions): string {
  const {
    beraternummer,
    mandantennummer,
    wirtschaftsjahresbeginn,
    datumVon,
    datumBis,
    sachkontenrahmen,
    sachkontenlaenge = 4,
    bezeichnung,
    waehrung = 'EUR',
    herkunft = 'RE',
    exportiertVon = 'Elev8',
    erzeugtAm = new Date(),
  } = options

  // 31 header fields. Reserved fields stay completely empty (not `""`).
  return [
    quoteText('EXTF'), //                             1  Kennzeichen
    '700', //                                         2  Versionsnummer
    '21', //                                          3  Datenkategorie: Buchungsstapel
    quoteText('Buchungsstapel'), //                   4  Formatname
    '13', //                                          5  Formatversion
    formatTimestamp(erzeugtAm), //                    6  Erzeugt am
    '', //                                            7  reserviert (importiert)
    quoteText(herkunft), //                           8  Herkunft
    quoteText(exportiertVon), //                      9  Exportiert von
    quoteText(''), //                                10  Importiert von
    beraternummer, //                                11  Beraternummer
    mandantennummer, //                              12  Mandantennummer
    formatHeaderDate(wirtschaftsjahresbeginn), //    13  WJ-Beginn
    String(sachkontenlaenge), //                     14  Sachkontenlänge
    formatHeaderDate(datumVon), //                   15  Datum von
    formatHeaderDate(datumBis), //                   16  Datum bis
    quoteText(bezeichnung), //                       17  Bezeichnung
    quoteText(''), //                                18  Diktatkürzel
    '1', //                                          19  Buchungstyp: Finanzbuchführung
    '', //                                           20  Rechnungslegungszweck
    '0', //                                          21  Festschreibung: nein
    quoteText(waehrung), //                          22  WKZ
    '', //                                           23  reserviert
    '', //                                           24  Derivatskennzeichen
    '', //                                           25  reserviert
    '', //                                           26  reserviert
    quoteText(sachkontenrahmen), //                  27  SKR
    '', //                                           28  Branchenlösung-Id
    '', //                                           29  reserviert
    '', //                                           30  reserviert
    quoteText(''), //                                31  Anwendungsinformation
  ].join(';')
}

/** Line 2 — the 125 German column captions, all quoted. */
export function buildColumnHeader(): string {
  return BOOKING_FIELDS.map(f => quoteText(f.name)).join(';')
}

// ── posting records (line 3+) ─────────────────────────────────────────────

/**
 * Builds one 125-field record. Every field starts empty and is written
 * according to its kind, so unpopulated text columns come out as `""` and
 * unpopulated numeric/date columns come out bare.
 */
export function buildPostingLine(posting: DatevPostingRecord): string {
  const values: string[] = Array.from({ length: DATEV_FIELD_COUNT }, () => '')

  // 1-indexed for readability against the DATEV field table.
  const set = (field: number, value: string) => {
    values[field - 1] = value
  }

  set(1, formatAmount(posting.umsatz))
  set(2, posting.sollHaben)
  set(3, posting.waehrung)
  set(7, posting.konto)
  set(8, posting.gegenkonto)
  // Field 9 (BU-Schlüssel) intentionally left empty — the advisor assigns it.
  set(10, formatBelegdatum(posting.belegdatum))
  set(11, sanitizeBelegfeld(posting.belegfeld1))
  set(14, truncateBuchungstext(posting.buchungstext))
  if (posting.kost1)
    set(37, posting.kost1)
  set(114, '0') // Festschreibung: nein — advisor finalizes on import.
  if (posting.leistungsdatum)
    set(115, formatFullDate(posting.leistungsdatum))
  if (posting.generalumkehr)
    set(118, '1')

  return values
    .map((value, index) => {
      const kind = BOOKING_FIELDS[index]!.kind
      if (kind === 'text')
        return quoteText(value)
      // Numeric and date columns are never quoted; empty means truly empty.
      return value
    })
    .join(';')
}

export interface ExtfFile {
  content: string
  filename: string
  recordCount: number
}

/**
 * Assembles the complete file: header line, column captions, one line per
 * posting, joined with CRLF and terminated with a trailing CRLF.
 */
export function buildExtfFile(
  postings: DatevPostingRecord[],
  options: ExtfHeaderOptions,
): ExtfFile {
  const lines = [
    buildExtfHeader(options),
    buildColumnHeader(),
    ...postings.map(buildPostingLine),
  ]

  return {
    content: `${lines.join('\r\n')}\r\n`,
    filename: buildFilename(options.datumVon, options.datumBis),
    recordCount: postings.length,
  }
}

export function buildFilename(datumVon: string, datumBis: string): string {
  const from = datumVon.slice(0, 7)
  const to = datumBis.slice(0, 7)
  const period = from === to ? from : `${from}_${to}`
  return `EXTF_Buchungsstapel_${period}.csv`
}

// ── CP1252 encoding ───────────────────────────────────────────────────────

/**
 * The 27 characters Windows-1252 places in 0x80-0x9F, where Latin-1 has
 * control codes. Everything else below U+0100 maps to its own code point.
 */
const CP1252_HIGH: Record<string, number> = {
  '€': 0x80,
  '‚': 0x82,
  'ƒ': 0x83,
  '„': 0x84,
  '…': 0x85,
  '†': 0x86,
  '‡': 0x87,
  'ˆ': 0x88,
  '‰': 0x89,
  'Š': 0x8A,
  '‹': 0x8B,
  'Œ': 0x8C,
  'Ž': 0x8E,
  '‘': 0x91,
  '’': 0x92,
  '“': 0x93,
  '”': 0x94,
  '•': 0x95,
  '–': 0x96,
  '—': 0x97,
  '˜': 0x98,
  '™': 0x99,
  'š': 0x9A,
  '›': 0x9B,
  'œ': 0x9C,
  'ž': 0x9E,
  'Ÿ': 0x9F,
}

/**
 * Characters outside CP1252 that appear in real listing/guest names often
 * enough to be worth transliterating rather than dropping to '?'.
 */
const TRANSLITERATE: Record<string, string> = {
  '‑': '-', //  non-breaking hyphen
  '‒': '-', //  figure dash
  '−': '-', //  minus sign
  ' ': ' ', //  non-breaking space
  ' ': ' ', //  narrow no-break space
  ' ': ' ', //  thin space
  'А': 'A', //  stray Cyrillic look-alikes from OTA feeds
  'е': 'e',
}

/**
 * Encodes a string to CP1252 bytes. Unmappable characters become '?' so the
 * file stays byte-valid rather than throwing mid-export.
 */
export function encodeCp1252(input: string): Uint8Array {
  const bytes: number[] = []
  for (const char of input) {
    const replaced = TRANSLITERATE[char] ?? char
    for (const c of replaced) {
      const code = c.codePointAt(0)!
      if (code <= 0xFF && !(code >= 0x80 && code <= 0x9F)) {
        bytes.push(code)
        continue
      }
      const high = CP1252_HIGH[c]
      bytes.push(high ?? 0x3F) // '?'
    }
  }
  return new Uint8Array(bytes)
}
