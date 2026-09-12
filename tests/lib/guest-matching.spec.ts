// Matching a booking to a person. The rules that matter are the refusals: an
// alias address is not identity, a masked phone is not identity, and two people
// matching equally well is never auto-linked, because a wrong merge shows one
// guest another guest's stay history and spend.

import type { MatchableGuest } from '~/lib/guest-matching'
import { describe, expect, it } from 'vitest'
import { initialGuests, initialReservations } from '~/components/reservations/data/reservations'
import {
  findGuestMatches,
  idDocumentKey,
  isAutoLinkable,
  isMaskedPhone,
  isOtaAliasEmail,
  nameKey,
  normaliseEmail,
  normaliseName,
  normalisePhone,
  resolveAutoLink,
} from '~/lib/guest-matching'

function guest(over: Partial<MatchableGuest> = {}): MatchableGuest {
  return {
    guestId: 'guest-1',
    names: ['Emily Chen'],
    emails: ['emily.chen@email.com'],
    phones: ['+65 8123 4567'],
    idKeys: [],
    otaGuestIds: [],
    countries: [],
    ...over,
  }
}

describe('oTA alias addresses', () => {
  it('recognises the per-booking aliases the channels issue', () => {
    expect(isOtaAliasEmail('k7m2p9x4qz@guest.airbnb.com')).toBe(true)
    expect(isOtaAliasEmail('4192837465@guest.booking.com')).toBe(true)
    expect(isOtaAliasEmail('K7M2P9X4QZ@Guest.Airbnb.Com')).toBe(true)
  })

  it('leaves a real address alone', () => {
    expect(isOtaAliasEmail('emily.chen@email.com')).toBe(false)
    expect(isOtaAliasEmail('someone@notairbnb.com')).toBe(false)
    expect(isOtaAliasEmail('')).toBe(false)
  })

  it('refuses to treat an alias as identity', () => {
    expect(normaliseEmail('k7m2p9x4qz@guest.airbnb.com')).toBeNull()
    expect(normaliseEmail('  Emily.Chen@Email.com ')).toBe('emily.chen@email.com')
    expect(normaliseEmail('not-an-address')).toBeNull()
  })
})

describe('phone normalisation', () => {
  it('spots a virtual number routed through an extension', () => {
    expect(isMaskedPhone('+1 555-0142 ext 48213')).toBe(true)
    expect(isMaskedPhone('+1 555-0142x48213')).toBe(true)
    expect(isMaskedPhone('+65 8123 4567')).toBe(false)
  })

  it('reduces the same number written four ways to one key', () => {
    const forms = ['+62 812-3456-7890', '+6281234567890', '+62 (812) 3456 7890', '0812 3456 7890']

    const keys = new Set(forms.map(f => normalisePhone(f, '+62')))
    expect(keys.size).toBe(1)
    expect([...keys][0]).toBe('+6281234567890')
  })

  it('will not guess at a national number with no dial code to resolve it', () => {
    expect(normalisePhone('0812 3456 7890')).toBeNull()
    expect(normalisePhone('0812 3456 7890', '+62')).toBe('+6281234567890')
  })

  it('rejects a masked number, a blank and something too short to reach', () => {
    expect(normalisePhone('+1 555-0142 ext 48213')).toBeNull()
    expect(normalisePhone('')).toBeNull()
    expect(normalisePhone('+123')).toBeNull()
    // No plus and no leading zero is too ambiguous to compare.
    expect(normalisePhone('8123 4567')).toBeNull()
  })
})

describe('name keys', () => {
  it('folds case, accents and punctuation', () => {
    expect(normaliseName('  Müller-Schmidt ')).toBe('muller schmidt')
    expect(normaliseName('JOSÉ')).toBe('jose')
  })

  it('treats a reversed name order as the same person', () => {
    expect(nameKey('Emily Chen')).toBe(nameKey('Chen Emily'))
    expect(nameKey('Emily Chen')).not.toBe(nameKey('Emily Cheng'))
  })

  it('returns an empty key for an empty name, so it cannot match everyone', () => {
    expect(nameKey('')).toBe('')
    expect(nameKey('   ')).toBe('')
  })
})

describe('iD document keys', () => {
  it('ignores formatting but not the document type', () => {
    expect(idDocumentKey('passport', 'p45278123')).toBe(idDocumentKey('passport', 'P45-278-123'))
    expect(idDocumentKey('passport', 'P45278123')).not.toBe(idDocumentKey('id_card', 'P45278123'))
  })

  it('is null without a number, so a blank cannot match a blank', () => {
    expect(idDocumentKey('passport', '')).toBeNull()
    expect(idDocumentKey('passport', undefined)).toBeNull()
  })
})

describe('findGuestMatches', () => {
  it('matches an ID document as certain, outranking everything else', () => {
    const key = idDocumentKey('passport', 'P45278123')!
    const matches = findGuestMatches(
      { guestName: 'Totally Different Name', idKeys: [key] },
      [guest({ idKeys: [key] })],
    )

    expect(matches[0]!.confidence).toBe('certain')
    expect(matches[0]!.signal).toBe('id_document')
  })

  it('matches a real phone as strong, across formatting', () => {
    const matches = findGuestMatches(
      { guestName: 'E. Chen', guestPhone: '+65 81234567' },
      [guest({ phones: ['+65 8123 4567'] })],
    )

    expect(matches[0]!.confidence).toBe('strong')
    expect(matches[0]!.signal).toBe('phone')
  })

  it('does not match on an alias address, which is the OTA case', () => {
    const matches = findGuestMatches(
      { guestName: 'Someone Else', guestEmail: 'h3n8r5t1vw@guest.airbnb.com' },
      [guest({ emails: ['h3n8r5t1vw@guest.airbnb.com'] })],
    )

    expect(matches).toHaveLength(0)
  })

  it('does not match on a masked phone, even when both sides carry it', () => {
    const matches = findGuestMatches(
      { guestName: 'Someone Else', guestPhone: '+1 555-0142 ext 48213' },
      [guest({ phones: ['+1 555-0142 ext 48213'] })],
    )

    expect(matches).toHaveLength(0)
  })

  it('rates a bare name match as weak, and name plus country higher', () => {
    const [nameOnly] = findGuestMatches(
      { guestName: 'Emily Chen' },
      [guest({ phones: [], emails: [] })],
    )
    const [withCountry] = findGuestMatches(
      { guestName: 'Emily Chen', guestCountry: 'Singapore' },
      [guest({ phones: [], emails: [], countries: ['Singapore'] })],
    )

    expect(nameOnly!.signal).toBe('name')
    expect(withCountry!.signal).toBe('name_and_country')
    expect(nameOnly!.confidence).toBe('weak')
    expect(withCountry!.confidence).toBe('weak')
  })

  it('returns the strongest candidate first when several guests match', () => {
    const key = idDocumentKey('passport', 'P45278123')!
    const matches = findGuestMatches(
      { guestName: 'Emily Chen', idKeys: [key] },
      [
        guest({ guestId: 'guest-weak', names: ['Emily Chen'], phones: [], emails: [] }),
        guest({ guestId: 'guest-certain', names: ['Someone Else'], idKeys: [key] }),
      ],
    )

    expect(matches[0]!.guestId).toBe('guest-certain')
    expect(matches[0]!.confidence).toBe('certain')
  })

  it('finds nobody when there is nothing to go on', () => {
    expect(findGuestMatches({ guestName: '' }, [guest()])).toHaveLength(0)
  })
})

describe('resolveAutoLink', () => {
  it('links on a certain match', () => {
    const matches = findGuestMatches(
      { guestName: 'Emily Chen', idKeys: ['passport:p45278123'] },
      [guest({ idKeys: ['passport:p45278123'] })],
    )

    expect(resolveAutoLink(matches)!.guestId).toBe('guest-1')
  })

  it('refuses a weak match, leaving it for a human', () => {
    const matches = findGuestMatches({ guestName: 'Emily Chen' }, [guest({ phones: [], emails: [] })])

    expect(matches[0]!.confidence).toBe('weak')
    expect(resolveAutoLink(matches)).toBeNull()
  })

  it('refuses when two different guests match equally well', () => {
    // Two people sharing a phone, a family booking with one number on file.
    // Guessing here is exactly what leaks one guest's history to the other.
    const matches = findGuestMatches(
      { guestName: 'Emily Chen', guestPhone: '+65 8123 4567' },
      [
        guest({ guestId: 'guest-a', names: ['Emily Chen'] }),
        guest({ guestId: 'guest-b', names: ['Daniel Chen'] }),
      ],
    )

    expect(matches).toHaveLength(2)
    expect(matches.every(m => m.confidence === 'strong')).toBe(true)
    expect(resolveAutoLink(matches)).toBeNull()
  })

  it('refuses an empty list rather than throwing', () => {
    expect(resolveAutoLink([])).toBeNull()
  })

  it('agrees with isAutoLinkable about which tiers may act alone', () => {
    expect(isAutoLinkable('certain')).toBe(true)
    expect(isAutoLinkable('strong')).toBe(true)
    expect(isAutoLinkable('weak')).toBe(false)
  })
})

describe('against the seeded data', () => {
  it('cannot identify an OTA guest from what the channel sent', () => {
    // res-3 is Emily's Airbnb stay. Her profile holds her real address and
    // phone; the reservation holds the alias Airbnb issued. Booking-time
    // matching on channel-supplied contact details finds nothing, which is the
    // whole reason check-in carries the load.
    const res = initialReservations.find(r => r.id === 'res-3')!
    const emily = initialGuests.find(g => g.name === 'Emily Chen')!

    expect(normaliseEmail(res.guestEmail)).toBeNull()
    const matches = findGuestMatches(
      { guestName: res.guestName, guestEmail: res.guestEmail },
      [guest({ guestId: emily.id, names: [], emails: [emily.email], phones: [] })],
    )

    expect(matches).toHaveLength(0)
  })

  it('identifies the same guest once check-in has taken their passport', () => {
    const res = initialReservations.find(r => r.id === 'res-1')!
    const occupant = res.guests?.find(g => g.idNumber)
    expect(occupant).toBeTruthy()

    const key = idDocumentKey(occupant!.idType, occupant!.idNumber)!
    const matches = findGuestMatches(
      { guestName: res.guestName, guestEmail: res.guestEmail, idKeys: [key] },
      [guest({ guestId: 'guest-1', idKeys: [key] })],
    )

    expect(resolveAutoLink(matches)!.signal).toBe('id_document')
  })

  it('treats the seeded Airbnb phone as masked, so it cannot be matched on', () => {
    const res = initialReservations.find(r => r.id === 'res-1')!

    expect(isMaskedPhone(res.guestPhone)).toBe(true)
    expect(normalisePhone(res.guestPhone)).toBeNull()
  })
})
