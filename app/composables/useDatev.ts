import type { DatevExportRecord, DatevSettings, SkrChart } from '@/components/finance/data/datev'
import type { ReservationEntry } from '@/components/finance/data/revenue'
import type { DatevPostingRecord } from '@/lib/datev-extf'
import { computed, ref } from 'vue'
import {
  applySkrDefaults,
  createDefaultDatevSettings,
  DATEV_HISTORY_STORAGE_KEY,
  DATEV_STORAGE_KEY,
  isDatevConfigured,
  mockDatevExports,
  mockDatevSettings,
  validateDatevSettings,
} from '@/components/finance/data/datev'
import { getEurListings } from '@/components/finance/data/lexware-invoices'
import { useReservations } from '@/composables/useReservations'
import { buildExtfFile, encodeCp1252 } from '@/lib/datev-extf'

export interface DatevExclusion {
  reason: string
  count: number
}

export interface SelectionExport {
  record: DatevExportRecord | null
  included: ReservationEntry[]
  excluded: DatevExclusion[]
}

/**
 * DATEV Buchungsstapel export.
 *
 * Unlike Jurnal/Bexio/Lexware this is not a live API connection — there is no
 * auth and no per-row sync state. It is a file handoff: configure once, then
 * generate one immutable file per period and give it to the tax advisor.
 *
 * Scope follows the same EUR gate as Lexware (`getEurListings()` — listings
 * tagged 'EUR'), so both German-market surfaces agree on which properties count.
 */
export function useDatev() {
  const settings = useState<DatevSettings>('datev-settings', () => ({ ...mockDatevSettings }))
  const exports = useState<DatevExportRecord[]>('datev-exports', () =>
    mockDatevExports.map(e => ({ ...e })))
  const isHydrated = useState<boolean>('datev-hydrated', () => false)

  const isGenerating = ref(false)
  /** The file currently under review, before it is downloaded or e-mailed. */
  const preview = useState<DatevExportRecord | null>('datev-preview', () => null)
  /** The exact rows the previewed file was built from. */
  const previewSource = useState<ReservationEntry[]>('datev-preview-source', () => [])

  const { reservations } = useReservations()

  // ── period ──────────────────────────────────────────────────────────────
  const periodFrom = useState<string>('datev-period-from', () => defaultPeriod().from)
  const periodTo = useState<string>('datev-period-to', () => defaultPeriod().to)

  function monthBounds(year: number, monthIndex: number) {
    const pad = (v: number) => String(v).padStart(2, '0')
    const lastDay = new Date(year, monthIndex + 1, 0).getDate()
    return {
      from: `${year}-${pad(monthIndex + 1)}-01`,
      to: `${year}-${pad(monthIndex + 1)}-${pad(lastDay)}`,
    }
  }

  /**
   * Previous calendar month, falling back to the most recent month that
   * actually has eligible bookings so the picker never opens on an empty period.
   */
  function defaultPeriod() {
    const now = new Date()
    const previous = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const bounds = monthBounds(previous.getFullYear(), previous.getMonth())

    const eurNames = new Set(getEurListings().map(l => l.name))
    const eligible = recentReservationsSnapshot().filter(
      r => r.currency === 'EUR' && eurNames.has(r.listing),
    )
    if (eligible.some(r => r.checkOut >= bounds.from && r.checkOut <= bounds.to))
      return bounds

    const latest = eligible.map(r => r.checkOut).sort().at(-1)
    if (!latest)
      return bounds
    const [year, month] = latest.split('-').map(Number)
    return monthBounds(year!, month! - 1)
  }

  /** Reads the seed data directly — `defaultPeriod` runs before state exists. */
  function recentReservationsSnapshot(): ReservationEntry[] {
    return reservations.value
  }

  /** The last six months, newest first, for the shortcut buttons. */
  const monthShortcuts = computed(() => {
    const now = new Date()
    return Array.from({ length: 6 }, (_, i) => {
      const date = new Date(now.getFullYear(), now.getMonth() - 1 - i, 1)
      const bounds = monthBounds(date.getFullYear(), date.getMonth())
      return {
        label: date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }),
        ...bounds,
      }
    })
  })

  function setPeriod(from: string, to: string) {
    periodFrom.value = from
    periodTo.value = to
  }

  const isPeriodValid = computed(() =>
    Boolean(periodFrom.value) && Boolean(periodTo.value) && periodFrom.value <= periodTo.value,
  )

  // ── scope (EUR gate, shared with Lexware) ───────────────────────────────
  const eurListingNames = computed(() => new Set(getEurListings().map(l => l.name)))

  function isInPeriod(reservation: ReservationEntry): boolean {
    // DATEV posts on service completion, so the period filters on check-out.
    return reservation.checkOut >= periodFrom.value && reservation.checkOut <= periodTo.value
  }

  const reservationsInPeriod = computed(() => reservations.value.filter(isInPeriod))

  /** Bookings that will become posting lines. */
  const eligibleReservations = computed(() => sortForExport(reservationsInPeriod.value.filter(isEligible)))

  /** Postings are written in check-out order so the advisor reads a timeline. */
  function sortForExport(list: ReservationEntry[]): ReservationEntry[] {
    return list.slice().sort((a, b) => a.checkOut.localeCompare(b.checkOut) || a.id.localeCompare(b.id))
  }

  /** Everything in the period that the EUR gate or the cancelled rule dropped. */
  /**
   * Collapses excluded rows to one entry per reason with a count — the tenant
   * needs the shape of what was dropped, not 80 individual Bali bookings.
   */
  function digestExclusions(list: ReservationEntry[]) {
    const grouped = new Map<string, number>()
    for (const r of list.filter(row => !isEligible(row)))
      grouped.set(exclusionReason(r), (grouped.get(exclusionReason(r)) ?? 0) + 1)
    return [...grouped.entries()].map(([reason, count]) => ({ reason, count }))
  }

  const excludedDigest = computed(() => digestExclusions(reservationsInPeriod.value))

  const scopeTotal = computed(() =>
    eligibleReservations.value.reduce((sum, r) => sum + r.amount, 0),
  )

  const cancelledInPeriod = computed(() =>
    reservationsInPeriod.value.filter(
      r => r.status === 'Cancelled' && r.currency === 'EUR' && eurListingNames.value.has(r.listing),
    ).length,
  )

  // ── posting lines ───────────────────────────────────────────────────────
  function accountForChannel(channel: string): string {
    return settings.value.channelAccounts[channel] || settings.value.erloeskonto
  }

  function toPosting(r: ReservationEntry): DatevPostingRecord {
    return {
      umsatz: r.amount,
      // Receivable is debited, revenue credited on the contra account.
      sollHaben: 'S',
      waehrung: 'EUR',
      konto: settings.value.debitorenkonto,
      gegenkonto: accountForChannel(r.channel),
      belegdatum: r.checkOut,
      leistungsdatum: r.checkOut,
      belegfeld1: r.invoice && r.invoice !== 'pending' ? r.invoice : r.id,
      buchungstext: `${r.guest} / ${r.listing}`,
      // Cancellations post as a Generalumkehr so the advisor sees a reversal
      // rather than a second revenue line.
      generalumkehr: r.status === 'Cancelled',
    }
  }

  const postings = computed<DatevPostingRecord[]>(() =>
    eligibleReservations.value.map(toPosting),
  )

  /**
   * Rows for the reviewable booking table. Derived from the list the previewed
   * file was actually built from — NOT from the live period — so changing the
   * period after generating cannot desync the table from the file bytes.
   */
  const previewRows = computed(() =>
    previewSource.value.map(r => ({ reservation: r, posting: toPosting(r) })),
  )

  /** The EUR gate, reusable for an arbitrary selection of rows. */
  function isEligible(r: ReservationEntry): boolean {
    if (r.currency !== 'EUR' || !eurListingNames.value.has(r.listing))
      return false
    return settings.value.includeCancelled || r.status !== 'Cancelled'
  }

  function exclusionReason(r: ReservationEntry): string {
    if (r.currency !== 'EUR' || !eurListingNames.value.has(r.listing))
      return `Not a EUR-tagged listing (${r.currency})`
    return 'Cancelled booking (excluded by settings)'
  }

  // ── configuration ───────────────────────────────────────────────────────
  const isConfigured = computed(() => isDatevConfigured(settings.value))
  const settingsErrors = computed(() => validateDatevSettings(settings.value))

  function saveSettings(draft: DatevSettings): { saved: boolean, errors: Record<string, string> } {
    const errors = validateDatevSettings(draft)
    if (Object.keys(errors).length > 0)
      return { saved: false, errors }
    settings.value = { ...draft, channelAccounts: { ...draft.channelAccounts } }
    persist()
    return { saved: true, errors: {} }
  }

  function switchChart(draft: DatevSettings, skr: SkrChart): DatevSettings {
    return applySkrDefaults(draft, skr)
  }

  function resetSettings() {
    settings.value = createDefaultDatevSettings()
    persist()
  }

  // ── generate ────────────────────────────────────────────────────────────
  /** A prior export covering exactly this period — the double-posting guard. */
  const existingExportForPeriod = computed(() =>
    exports.value.find(
      e => e.periodFrom === periodFrom.value && e.periodTo === periodTo.value,
    ) ?? null,
  )

  function fiscalYearStart(periodStart: string): string {
    const pad = (v: number) => String(v).padStart(2, '0')
    const year = Number(periodStart.slice(0, 4))
    const { fiscalYearStartDay: day, fiscalYearStartMonth: month } = settings.value
    const start = `${year}-${pad(month)}-${pad(day)}`
    // A fiscal year starting after the period start belongs to the prior year.
    return start <= periodStart ? start : `${year - 1}-${pad(month)}-${pad(day)}`
  }

  /**
   * Builds the file for an explicit, already-filtered list of bookings.
   * Both entry points (period scope and manual selection) funnel through here
   * so a hand-picked export is byte-identical to a period one.
   */
  function buildRecord(rows: ReservationEntry[], from: string, to: string): DatevExportRecord {
    const file = buildExtfFile(rows.map(toPosting), {
      beraternummer: settings.value.beraternummer,
      mandantennummer: settings.value.mandantennummer,
      wirtschaftsjahresbeginn: fiscalYearStart(from),
      datumVon: from,
      datumBis: to,
      sachkontenrahmen: settings.value.skr === 'SKR03' ? '03' : '04',
      bezeichnung: `Elev8 ${from} - ${to}`,
      waehrung: 'EUR',
    })

    return {
      id: `datev-exp-${Date.now()}`,
      periodFrom: from,
      periodTo: to,
      generatedAt: new Date().toISOString(),
      generatedBy: 'Komang Juliantara',
      recordCount: file.recordCount,
      totalAmount: rows.reduce((sum, r) => sum + r.amount, 0),
      currency: 'EUR',
      filename: file.filename,
      content: file.content,
      beraternummer: settings.value.beraternummer,
      mandantennummer: settings.value.mandantennummer,
      skr: settings.value.skr,
      emailed: false,
    }
  }

  async function generate(): Promise<DatevExportRecord | null> {
    if (!isConfigured.value || !isPeriodValid.value)
      return null

    isGenerating.value = true
    // Mock latency so the loading state is visible; the build itself is sync.
    await new Promise(resolve => setTimeout(resolve, 900))

    const rows = eligibleReservations.value
    const record = buildRecord(rows, periodFrom.value, periodTo.value)

    previewSource.value = rows
    preview.value = record
    isGenerating.value = false
    return record
  }

  /**
   * Exports a hand-picked set of reservations (Revenue -> Reservations row
   * selection). The period is derived from the selection's own check-out dates,
   * and the same EUR gate applies — a manual pick cannot smuggle a CHF booking
   * into a German posting batch.
   */
  async function generateFromSelection(selection: ReservationEntry[]): Promise<SelectionExport> {
    const included = sortForExport(selection.filter(isEligible))
    const excluded = digestExclusions(selection)

    if (!isConfigured.value || included.length === 0)
      return { record: null, included, excluded }

    isGenerating.value = true
    await new Promise(resolve => setTimeout(resolve, 900))

    const dates = included.map(r => r.checkOut).sort()
    const record = buildRecord(included, dates[0]!, dates.at(-1)!)

    previewSource.value = included
    preview.value = record
    isGenerating.value = false
    return { record, included, excluded }
  }

  /**
   * Moves the reviewed file into history on first download/e-mail.
   * Re-downloading an entry already in history is a no-op, so its position and
   * original timestamp are preserved.
   */
  function commitExport(record: DatevExportRecord) {
    if (exports.value.some(e => e.id === record.id))
      return
    exports.value = [record, ...exports.value]
    persist()
  }

  function discardPreview() {
    preview.value = null
  }

  // ── delivery ────────────────────────────────────────────────────────────
  /** Writes the file as CP1252 bytes — never as a UTF-8 string. */
  function downloadExport(record: DatevExportRecord) {
    if (typeof document === 'undefined')
      return
    const blob = new Blob([encodeCp1252(record.content) as BlobPart], {
      type: 'text/csv;charset=windows-1252',
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = record.filename
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
    commitExport(record)
  }

  function buildMailto(record: DatevExportRecord): string {
    const period = `${formatDate(record.periodFrom)} – ${formatDate(record.periodTo)}`
    const subject = `DATEV Buchungsstapel ${period} – Mandant ${record.mandantennummer}`
    const body = [
      'Guten Tag,',
      '',
      `anbei der Buchungsstapel für den Zeitraum ${period}.`,
      '',
      `Berater: ${record.beraternummer}`,
      `Mandant: ${record.mandantennummer}`,
      `Kontenrahmen: ${record.skr}`,
      `Buchungssätze: ${record.recordCount}`,
      `Summe: ${record.totalAmount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR`,
      '',
      `Datei: ${record.filename} (EXTF 700, Satzversion 13, CP1252)`,
      'Die USt-Schlüssel sind bewusst nicht gesetzt (Festschreibung 0).',
      '',
      'Bitte die Datei aus dem Anhang importieren.',
      '',
      'Freundliche Grüsse',
    ].join('\n')

    return `mailto:${encodeURIComponent(settings.value.advisorEmail)}`
      + `?subject=${encodeURIComponent(subject)}`
      + `&body=${encodeURIComponent(body)}`
  }

  /**
   * `mailto:` cannot carry an attachment, so the honest flow is: save the file,
   * then open a draft that tells the advisor what to expect in the attachment.
   */
  function emailExport(record: DatevExportRecord) {
    if (typeof window === 'undefined')
      return
    downloadExport(record)
    exports.value = exports.value.map(e => (e.id === record.id ? { ...e, emailed: true } : e))
    persist()
    window.location.href = buildMailto(record)
  }

  function deleteExport(id: string) {
    exports.value = exports.value.filter(e => e.id !== id)
    persist()
  }

  // ── persistence ─────────────────────────────────────────────────────────
  /**
   * Resolved per call rather than via `import.meta.client`: on the server
   * `localStorage` is undefined, and in private-browsing modes merely touching
   * it can throw. Guarding on availability covers both.
   */
  function storage(): Storage | null {
    try {
      return typeof localStorage === 'undefined' ? null : localStorage
    }
    catch {
      return null
    }
  }

  function persist() {
    const store = storage()
    if (!store)
      return
    try {
      store.setItem(DATEV_STORAGE_KEY, JSON.stringify(settings.value))
      store.setItem(DATEV_HISTORY_STORAGE_KEY, JSON.stringify(exports.value))
    }
    catch {
      // Quota or private-mode failures must not break the export flow.
    }
  }

  function hydrate() {
    const store = storage()
    if (!store || isHydrated.value)
      return
    isHydrated.value = true
    try {
      const storedSettings = store.getItem(DATEV_STORAGE_KEY)
      if (storedSettings) {
        const parsed = JSON.parse(storedSettings) as DatevSettings
        settings.value = { ...createDefaultDatevSettings(parsed.skr), ...parsed }
      }
      const storedHistory = store.getItem(DATEV_HISTORY_STORAGE_KEY)
      if (storedHistory)
        exports.value = JSON.parse(storedHistory) as DatevExportRecord[]
    }
    catch {
      // Corrupted storage falls back to the seeded mock values.
    }
  }

  function formatDate(iso: string): string {
    const [year, month, day] = iso.split('-')
    return `${day}.${month}.${year}`
  }

  return {
    // settings
    settings,
    isConfigured,
    settingsErrors,
    saveSettings,
    switchChart,
    resetSettings,
    hydrate,
    // period
    periodFrom,
    periodTo,
    monthShortcuts,
    setPeriod,
    isPeriodValid,
    // scope
    eligibleReservations,
    excludedDigest,
    scopeTotal,
    cancelledInPeriod,
    postings,
    previewRows,
    // generate
    isGenerating,
    preview,
    generate,
    generateFromSelection,
    isEligible,
    discardPreview,
    commitExport,
    existingExportForPeriod,
    // delivery
    downloadExport,
    emailExport,
    buildMailto,
    deleteExport,
    exports,
    // helpers
    formatDate,
  }
}
