import type { WebsiteRuleSet } from '~/components/channels/data/website-channel'

/** The legal details and per-language Terms & Conditions of a website. */
export interface WebsiteLegal {
  operator?: string
  vatNumber?: string
  street?: string
  postalCode?: string
  city?: string
  country?: string
  /** Custom Impressum rich-text HTML; empty = auto-generated from the company details above. */
  impressum?: string
  /** Custom cookie policy rich-text HTML; empty = auto-generated. */
  cookiePolicy?: string
  /** Cookie consent banner on the live site: pixels only fire after the visitor accepts. */
  cookieBanner?: boolean
  /** Rich-text HTML per language code. */
  terms: Record<string, string>
  updatedAt?: string
}

export const DEFAULT_CANCELLATION_POLICY = 'Free cancellation up to 7 days before check-in.'

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Items are already escaped by the caller; this only wraps them. */
function list(items: string[]): string {
  if (items.length === 0)
    return ''
  return `<ul>${items.map(item => `<li>${item}</li>`).join('')}</ul>`
}

function nights(count: number): string {
  return `${count} night${count === 1 ? '' : 's'}`
}

function weekdayList(days: number[]): string {
  const names = WEEKDAYS.filter((_, index) => days.includes(index))
  if (names.length <= 1)
    return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

export function emptyWebsiteLegal(): WebsiteLegal {
  return { terms: {} }
}

/**
 * The Impressum the site shows when the host wrote no custom one: the company
 * details, one per line. Empty string when there is nothing to show.
 */
export function generateImpressumDraft(legal?: WebsiteLegal): string {
  const address = [
    legal?.street?.trim(),
    [legal?.postalCode?.trim(), legal?.city?.trim()].filter(Boolean).join(' '),
    legal?.country?.trim(),
  ].filter(Boolean).join(', ')
  const vat = legal?.vatNumber?.trim()
  const operator = legal?.operator?.trim()
  const lines: string[] = []
  if (operator)
    lines.push(`<p><strong>${escapeHtml(operator)}</strong></p>`)
  if (address)
    lines.push(`<p>${escapeHtml(address)}</p>`)
  if (vat)
    lines.push(`<p>VAT / registration number: ${escapeHtml(vat)}</p>`)
  return lines.join('')
}

/** The cookie policy the site shows when the host wrote no custom one. */
export const COOKIE_POLICY_DRAFT
  = '<p>This website uses only the cookies it needs to run: language and session cookies. '
    + 'Tracking or marketing cookies are set only after you accept them in the cookie banner.</p>'

/** The language the section opens on: the site default when it is offered. */
export function preferredLanguage(languages?: string[], defaultLanguage?: string): string {
  if (defaultLanguage && languages?.includes(defaultLanguage))
    return defaultLanguage
  return languages?.[0] ?? 'en'
}

/** The legal details the wizard already asked for, carried onto the Website. */
export function legalFromWizard(answers: {
  legalCompany: string
  legalVatNumber: string
  legalStreet: string
  legalPostalCode: string
  legalCity: string
  legalCountry: string
}): WebsiteLegal {
  const pairs: Array<[keyof WebsiteLegal, string]> = [
    ['operator', answers.legalCompany],
    ['vatNumber', answers.legalVatNumber],
    ['street', answers.legalStreet],
    ['postalCode', answers.legalPostalCode],
    ['city', answers.legalCity],
    ['country', answers.legalCountry],
  ]
  return {
    ...Object.fromEntries(pairs
      .map(([key, value]) => [key, value.trim()])
      .filter(([, value]) => value !== '')),
    terms: {},
  } as WebsiteLegal
}

/**
 * A deterministic Terms & Conditions draft from the site's own data. The
 * section generates it once and lets the host edit from there.
 */
export function generateTermsDraft(input: {
  siteName: string
  legal?: WebsiteLegal
  rules?: WebsiteRuleSet | null
}): string {
  const site = escapeHtml(input.siteName.trim() || 'this website')
  const operator = input.legal?.operator?.trim()
  const vatNumber = input.legal?.vatNumber?.trim()
  const street = input.legal?.street?.trim()
  const postalCode = input.legal?.postalCode?.trim()
  const city = input.legal?.city?.trim()
  const country = input.legal?.country?.trim()
  const rules = input.rules
  const address = [street, [postalCode, city].filter(Boolean).join(' '), country]
    .filter(part => part !== '')
    .join(', ')

  const blocks: string[] = [
    `<p>These terms and conditions apply to bookings made through <strong>${site}</strong>.</p>`,
  ]

  if (operator) {
    const withAddress = address ? `, ${escapeHtml(address)}` : ''
    blocks.push(`<p>${site} is operated by ${escapeHtml(operator)}${withAddress}.</p>`)
  }
  if (vatNumber)
    blocks.push(`<p>VAT / registration number: ${escapeHtml(vatNumber)}.</p>`)

  if (rules) {
    const clauses: string[] = []
    if (rules.prepaymentPct > 0)
      clauses.push(`A prepayment of ${rules.prepaymentPct}% is taken at booking.`)
    if (rules.minNights > 0)
      clauses.push(`Stays have a minimum of ${nights(rules.minNights)}.`)
    if (rules.maxNights != null && rules.maxNights > 0)
      clauses.push(`There is a maximum of ${nights(rules.maxNights)}.`)
    if (rules.minDaysBeforeArrival > 0)
      clauses.push(`Bookings close ${rules.minDaysBeforeArrival} days before arrival.`)
    if (rules.arrivalDays.length > 0)
      clauses.push(`Check-in is available on ${weekdayList(rules.arrivalDays)}.`)
    if (rules.departureDays.length > 0)
      clauses.push(`Check-out is available on ${weekdayList(rules.departureDays)}.`)
    if (rules.earlyBird.enabled)
      clauses.push(`Book ${rules.earlyBird.days} or more days ahead for ${rules.earlyBird.pct}% off.`)
    if (rules.lastMinute.enabled)
      clauses.push(`Book within ${rules.lastMinute.days} days of arrival for ${rules.lastMinute.pct}% off.`)
    for (const discount of rules.lengthOfStayDiscounts) {
      if (discount.pct > 0)
        clauses.push(`${discount.minNights}+ nights: ${discount.pct}% off.`)
    }
    if (clauses.length > 0) {
      blocks.push('<p><strong>Booking and payment</strong></p>')
      blocks.push(list(clauses))
    }
  }

  blocks.push('<p><strong>Cancellations</strong></p>')
  blocks.push(`<p>${escapeHtml(DEFAULT_CANCELLATION_POLICY)}</p>`)

  blocks.push('<p><strong>Guest responsibilities</strong></p>')
  blocks.push(list([
    'Guests are responsible for the property during their stay and for any damage beyond normal wear.',
    'The number of guests must not exceed the number stated in the booking.',
    'Quiet hours and house rules set out at the property apply to every guest.',
  ]))

  if (operator) {
    blocks.push('<p><strong>Contact</strong></p>')
    blocks.push(list([`Operator: ${escapeHtml(operator)}`]))
  }

  return blocks.join('')
}
