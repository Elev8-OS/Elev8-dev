// The frame every invoice Elev8 issues to a tenant is drawn in: the
// subscription invoice and the damage waiver invoice. Same document family as
// the guest invoice and the owner statement: issuer top-left, title top-right,
// grey section bars, a line table, the invoice palette.
//
// Rules the frame keeps for every document drawn in it:
//
//   1. ASCII only: jsPDF's built-in Helvetica is WinAnsi (`ascii()` strips
//      the rest, so a guest name with an accent or an emoji never breaks it).
//   2. It never runs off the page: every block asks `ensure()` first, and the
//      line table repeats its header on a new page.
//   3. The payment block always says whether the invoice was paid, so a
//      missing line never implies a paid invoice.

import { jsPDF as JsPdf } from 'jspdf'

const PAGE_WIDTH = 210 // A4 mm
const MARGIN = 16
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2
const FOOTER_Y = 288
const BOTTOM_LIMIT = FOOTER_Y - 8
const LABEL_WIDTH = 34
const ROW_HEIGHT = 5.5

const INK: [number, number, number] = [17, 24, 39]
const MUTED: [number, number, number] = [100, 116, 139]
const TABLE_HEAD: [number, number, number] = [175, 178, 183]
const RULE: [number, number, number] = [226, 232, 240]
const WARN: [number, number, number] = [180, 83, 9]

export function money(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString('de-CH', {
    minimumFractionDigits: currency === 'IDR' ? 0 : 2,
    maximumFractionDigits: currency === 'IDR' ? 0 : 2,
  }).replace(/’/g, '\'')}`
}

export function day(iso: string): string {
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function ascii(value: string): string {
  return value.normalize('NFKD').replace(/\p{M}/gu, '').replace(/[–—]/g, '-').replace(/[^\x20-\x7E]/g, '')
}

/** Ends a fragment with a full stop, so two sentences never run together. */
export function sentence(value: string): string {
  const text = value.trim()
  return /[.!?]$/.test(text) ? text : `${text}.`
}

export interface InvoiceHeader {
  issuer: string
  /** One line under the issuer: what the invoice is for. */
  subtitle: string
  number: string
  issuedOn: string
}

export interface InvoiceColumn {
  label: string
  /** Left edge in mm from the margin. The last column is right-aligned to the content edge. */
  x: number
  /** Width a value may take before it is cut with "...". */
  width?: number
  align?: 'right'
}

/** An invoice under construction. Draw top to bottom, then `finish()`. */
export class InvoiceDoc {
  readonly doc = new JsPdf({ unit: 'mm', format: 'a4' })
  y = 15

  private readonly header: InvoiceHeader

  constructor(header: InvoiceHeader) {
    this.header = header
    this.drawHeader()
  }

  private ink() {
    this.doc.setTextColor(INK[0], INK[1], INK[2])
  }

  private muted() {
    this.doc.setTextColor(MUTED[0], MUTED[1], MUTED[2])
  }

  /** Starts a new page when `height` would not fit. Answers whether it did. */
  ensure(height: number): boolean {
    if (this.y + height <= BOTTOM_LIMIT)
      return false
    this.doc.addPage()
    this.y = 20
    return true
  }

  private drawHeader() {
    const { doc, header } = this
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10.5)
    this.ink()
    doc.text(ascii(header.issuer).toUpperCase(), MARGIN, this.y)
    doc.setFontSize(12)
    doc.text('Invoice', PAGE_WIDTH - MARGIN, this.y, { align: 'right' })
    this.y += 5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    this.muted()
    doc.text(ascii(header.subtitle), MARGIN, this.y)
    doc.text(header.number, PAGE_WIDTH - MARGIN, this.y, { align: 'right' })
    doc.text(`Issued ${day(header.issuedOn)}`, PAGE_WIDTH - MARGIN, this.y + 4.5, { align: 'right' })
    this.y += 12
  }

  /** A grey section bar. `keepWith` is room the first thing under it needs. */
  section(title: string, keepWith = 0) {
    const { doc } = this
    this.ensure(16 + keepWith)
    this.y += 3
    doc.setFillColor(TABLE_HEAD[0], TABLE_HEAD[1], TABLE_HEAD[2])
    doc.rect(MARGIN, this.y, CONTENT_WIDTH, 6.5, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    this.ink()
    doc.text(ascii(title), MARGIN + 3, this.y + 4.5)
    this.y += 11
  }

  /** A label and a value that wraps inside the content width. */
  row(label: string, value: string, warn = false) {
    const { doc } = this
    const lines = doc.splitTextToSize(ascii(value) || '-', CONTENT_WIDTH - LABEL_WIDTH) as string[]
    this.ensure(lines.length * 4.5 + 1)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    this.muted()
    doc.text(label, MARGIN, this.y)
    if (warn)
      doc.setTextColor(WARN[0], WARN[1], WARN[2])
    else
      this.ink()
    doc.text(lines, MARGIN + LABEL_WIDTH, this.y)
    this.y += lines.length * 4.5 + 1
  }

  /** Cut to fit a column, with a trailing "..." when it had to be. */
  private fit(value: string, width?: number): string {
    const text = ascii(value)
    if (!width || this.doc.getTextWidth(text) <= width)
      return text
    let cut = text
    while (cut.length > 1 && this.doc.getTextWidth(`${cut}...`) > width)
      cut = cut.slice(0, -1)
    return `${cut.trimEnd()}...`
  }

  private tableHeader(columns: InvoiceColumn[]) {
    const { doc } = this
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    this.muted()
    for (const column of columns) {
      if (column.align === 'right')
        doc.text(column.label, PAGE_WIDTH - MARGIN, this.y, { align: 'right' })
      else
        doc.text(column.label, MARGIN + column.x, this.y)
    }
    this.y += 2
    doc.setDrawColor(RULE[0], RULE[1], RULE[2])
    doc.line(MARGIN, this.y, PAGE_WIDTH - MARGIN, this.y)
    this.y += 4
  }

  /** The line table, then its total under the rule. Rows are one value per column. */
  table(columns: InvoiceColumn[], rows: string[][], total: { label: string, amount: string, x: number }) {
    const { doc } = this
    this.tableHeader(columns)
    for (const values of rows) {
      if (this.ensure(ROW_HEIGHT))
        this.tableHeader(columns)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      this.ink()
      columns.forEach((column, index) => {
        const value = values[index] ?? ''
        if (column.align === 'right')
          doc.text(ascii(value), PAGE_WIDTH - MARGIN, this.y, { align: 'right' })
        else
          doc.text(this.fit(value, column.width), MARGIN + column.x, this.y)
      })
      this.y += ROW_HEIGHT
    }
    this.ensure(14)
    doc.setDrawColor(INK[0], INK[1], INK[2])
    doc.line(MARGIN + total.x, this.y - 2, PAGE_WIDTH - MARGIN, this.y - 2)
    this.y += 3
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.5)
    this.ink()
    doc.text(ascii(total.label), MARGIN + total.x, this.y)
    doc.text(ascii(total.amount), PAGE_WIDTH - MARGIN, this.y, { align: 'right' })
    this.y += 8
  }

  /** Small grey paragraph: how the invoice was worked out. */
  note(text: string) {
    const { doc } = this
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    this.muted()
    const lines = doc.splitTextToSize(ascii(text), CONTENT_WIDTH) as string[]
    this.ensure(lines.length * 4)
    doc.text(lines, MARGIN, this.y)
    this.y += lines.length * 4
  }

  /** Footer on every page, then the file. */
  finish(opts: { download?: boolean, filename: string }): Blob {
    const { doc, header } = this
    const pages = doc.getNumberOfPages()
    for (let page = 1; page <= pages; page++) {
      doc.setPage(page)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      this.muted()
      doc.text(`${ascii(header.issuer)}  |  ${header.number}`, MARGIN, FOOTER_Y)
      doc.text(`Page ${page} of ${pages}`, PAGE_WIDTH - MARGIN, FOOTER_Y, { align: 'right' })
    }
    const blob = doc.output('blob')
    if (opts.download)
      doc.save(opts.filename)
    return blob
  }
}
