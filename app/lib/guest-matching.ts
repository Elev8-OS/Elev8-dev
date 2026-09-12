/**
 * Recognising a returning guest.
 *
 * An OTA does not tell you who the guest is. Airbnb issues an alias address per
 * booking, phones arrive masked or not at all, and the confirmation code
 * identifies the booking rather than the person. So matching is tiered: act
 * automatically only on an identifier that is actually stable, and hand
 * everything weaker to a human.
 *
 * Framework-free on purpose: the stores assemble the inputs and call in, the
 * same split as `data/folio.ts` and `promo-code-form.ts`.
 */

export type MatchConfidence = 'certain' | 'strong' | 'weak'

/** What the match was made on. Shown to staff and written into the activity log. */
export type MatchSignal
  = | 'id_document'
    | 'ota_guest_id'
    | 'phone'
    | 'email'
    | 'name_and_country'
    | 'name'

export interface GuestMatchCandidate {
  guestId: string
  confidence: MatchConfidence
  signal: MatchSignal
  /** Plain-language reason, e.g. "same passport as a previous stay". */
  reason: string
}

/**
 * A person as the app knows them: a profile plus whatever their past stays
 * revealed. Identifiers accumulate, because the alias on this booking and the
 * passport from check-in both belong to the same guest.
 */
export interface MatchableGuest {
  guestId: string
  names: string[]
  emails: string[]
  phones: string[]
  /** From `idDocumentKey`, one per ID document seen across their stays. */
  idKeys: string[]
  otaGuestIds: string[]
  countries: string[]
}

/** An incoming booking, before it is linked to anyone. */
export interface MatchableBooking {
  guestName: string
  guestEmail?: string
  guestPhone?: string
  guestCountry?: string
  otaGuestId?: string
  idKeys?: string[]
}

/**
 * Addresses these domains are per-booking aliases, not people. An alias must
 * never count as identity: the same guest returns under a different one.
 *
 * Extend per channel as connections are added. Verify against a real payload
 * rather than assuming, because the shape differs by channel and by what the
 * connection is permitted to pass through.
 */
export const OTA_ALIAS_EMAIL_DOMAINS = [
  'guest.airbnb.com',
  'guest.booking.com',
  'reply.airbnb.com',
  'm.expediapartnercentral.com',
]

export function isOtaAliasEmail(email: string | undefined | null): boolean {
  const at = (email ?? '').trim().toLowerCase()
  if (!at.includes('@'))
    return false
  const domain = at.slice(at.lastIndexOf('@') + 1)
  return OTA_ALIAS_EMAIL_DOMAINS.some(d => domain === d || domain.endsWith(`.${d}`))
}

/** A usable address, or null when it is blank or an OTA alias. */
export function normaliseEmail(email: string | undefined | null): string | null {
  const trimmed = (email ?? '').trim().toLowerCase()
  if (!trimmed.includes('@') || isOtaAliasEmail(trimmed))
    return null
  return trimmed
}

/**
 * A virtual number routed through an extension. It reaches the guest today and
 * nobody tomorrow, so it identifies a booking rather than a person.
 */
export function isMaskedPhone(phone: string | undefined | null): boolean {
  // The extension sits at the end, written `… ext 48213` or `…0142x48213`.
  // No word boundary before the `x`: it usually abuts the last digit.
  return /(?:ext\.?|x)\s*\d{2,}\s*$/i.test((phone ?? '').trim())
}

/**
 * A phone in E.164-ish form, or null when it is unusable.
 *
 * `defaultDialCode` resolves a national leading zero (`0812…` in Indonesia is
 * `+62812…`). Without it a national number cannot be compared across channels,
 * so it is rejected rather than guessed at.
 */
export function normalisePhone(phone: string | undefined | null, defaultDialCode?: string): string | null {
  const raw = (phone ?? '').trim()
  if (!raw || isMaskedPhone(raw))
    return null

  const hasPlus = raw.startsWith('+')
  const digits = raw.replace(/\D/g, '')
  if (!digits)
    return null

  let e164: string
  if (hasPlus) {
    e164 = `+${digits}`
  }
  else if (digits.startsWith('0')) {
    const code = (defaultDialCode ?? '').replace(/\D/g, '')
    if (!code)
      return null
    e164 = `+${code}${digits.slice(1)}`
  }
  else {
    // No plus and no leading zero: too ambiguous to compare safely.
    return null
  }

  // Shorter than this is not a reachable international number.
  return e164.length >= 8 ? e164 : null
}

/** Lower-cased, de-accented, whitespace-collapsed. */
export function normaliseName(name: string | undefined | null): string {
  return (name ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036F]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Order-insensitive name key, because channels disagree on which part comes
 * first: "Chen Emily" and "Emily Chen" are one person.
 */
export function nameKey(name: string | undefined | null): string {
  const normalised = normaliseName(name)
  if (!normalised)
    return ''
  return normalised.split(' ').sort().join(' ')
}

/**
 * A comparable key for an ID document.
 *
 * ⚠️ Returns the number in the clear, which suits this mock's seeded data. A
 * real implementation must hash it before storing or comparing: these are
 * passport numbers.
 */
export function idDocumentKey(idType: string | undefined | null, idNumber: string | undefined | null): string | null {
  const number = (idNumber ?? '').replace(/[^a-z0-9]/gi, '').toLowerCase()
  if (!number)
    return null
  const type = (idType ?? 'unknown').trim().toLowerCase()
  return `${type}:${number}`
}

function overlap(a: string[], b: string[]): string | null {
  const seen = new Set(a.filter(Boolean))
  return b.find(value => value && seen.has(value)) ?? null
}

/**
 * Every guest this booking could belong to, strongest first.
 *
 * `defaultDialCode` is the property's own country code, used to resolve
 * national numbers on both sides of the comparison.
 */
export function findGuestMatches(
  booking: MatchableBooking,
  guests: MatchableGuest[],
  defaultDialCode?: string,
): GuestMatchCandidate[] {
  const bookingIdKeys = booking.idKeys ?? []
  const bookingOtaIds = booking.otaGuestId ? [booking.otaGuestId] : []
  const bookingEmail = normaliseEmail(booking.guestEmail)
  const bookingPhone = normalisePhone(booking.guestPhone, defaultDialCode)
  const bookingName = nameKey(booking.guestName)
  const bookingCountry = normaliseName(booking.guestCountry)

  const matches: GuestMatchCandidate[] = []

  for (const guest of guests) {
    const idHit = overlap(bookingIdKeys, guest.idKeys)
    if (idHit) {
      matches.push({ guestId: guest.guestId, confidence: 'certain', signal: 'id_document', reason: 'same ID document as a previous stay' })
      continue
    }

    const otaHit = overlap(bookingOtaIds, guest.otaGuestIds)
    if (otaHit) {
      matches.push({ guestId: guest.guestId, confidence: 'certain', signal: 'ota_guest_id', reason: 'same channel guest account' })
      continue
    }

    const phoneHit = bookingPhone
      ? overlap([bookingPhone], guest.phones.map(p => normalisePhone(p, defaultDialCode) ?? ''))
      : null
    if (phoneHit) {
      matches.push({ guestId: guest.guestId, confidence: 'strong', signal: 'phone', reason: `same phone number (${phoneHit})` })
      continue
    }

    const emailHit = bookingEmail
      ? overlap([bookingEmail], guest.emails.map(e => normaliseEmail(e) ?? ''))
      : null
    if (emailHit) {
      matches.push({ guestId: guest.guestId, confidence: 'strong', signal: 'email', reason: `same email address (${emailHit})` })
      continue
    }

    if (!bookingName)
      continue

    const nameHit = guest.names.some(n => nameKey(n) === bookingName)
    if (!nameHit)
      continue

    const countryHit = Boolean(bookingCountry) && guest.countries.some(c => normaliseName(c) === bookingCountry)
    matches.push(countryHit
      ? { guestId: guest.guestId, confidence: 'weak', signal: 'name_and_country', reason: 'same name and country as a previous guest' }
      : { guestId: guest.guestId, confidence: 'weak', signal: 'name', reason: 'same name as a previous guest' })
  }

  const rank: Record<MatchConfidence, number> = { certain: 0, strong: 1, weak: 2 }
  return matches.sort((a, b) => rank[a.confidence] - rank[b.confidence])
}

export function isAutoLinkable(confidence: MatchConfidence): boolean {
  return confidence === 'certain' || confidence === 'strong'
}

/**
 * The one guest a booking may be linked to without asking, or null.
 *
 * Refuses on a tie. Two people matching equally well is exactly the case where
 * guessing leaks one guest's history to the other, and it is also the case a
 * naive "take the first match" would get wrong silently.
 */
export function resolveAutoLink(matches: GuestMatchCandidate[]): GuestMatchCandidate | null {
  const best = matches[0]
  if (!best || !isAutoLinkable(best.confidence))
    return null

  const tied = matches.filter(m => m.confidence === best.confidence && m.guestId !== best.guestId)
  return tied.length ? null : best
}
