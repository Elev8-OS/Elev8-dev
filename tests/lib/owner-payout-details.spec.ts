// The owner's payout details: what counts as complete enough to send money
// to, and the formatting the portal and the statement PDF must agree on.

import { describe, expect, it } from 'vitest'
import {
  compactIban,
  createEmptyPayoutDraft,
  draftToPayoutDetails,
  formatIban,
  hasPayoutAccount,
  isValidBic,
  isValidIban,
  payoutAddressLines,
  payoutBankLines,
  payoutDetailsToDraft,
  validatePayoutDraft,
} from '~/components/owners/data/owner-payout-details'

function filledDraft(overrides: Partial<ReturnType<typeof createEmptyPayoutDraft>> = {}) {
  return {
    ...createEmptyPayoutDraft(),
    line1: 'Jl. Pantai Berawa No. 88',
    city: 'Canggu',
    country: 'Indonesia',
    accountHolder: 'Wayan Sari',
    bankName: 'Bank Central Asia (BCA)',
    accountNumber: '7712345678',
    ...overrides,
  }
}

describe('iban validation', () => {
  it('accepts a real IBAN, spaced or not', () => {
    expect(isValidIban('CH69 0076 1648 8692 1200 2')).toBe(true)
    expect(isValidIban('CH6900761648869212002')).toBe(true)
    expect(isValidIban('de89370400440532013000')).toBe(true)
  })

  it('rejects a transposed pair that every structural rule would pass', () => {
    // Same length, same country, same characters — only the checksum catches
    // it, which is the entire reason the mod-97 step exists.
    expect(isValidIban('CH69 0076 1648 8692 1200 2')).toBe(true)
    expect(isValidIban('CH69 0076 1648 8692 1020 2')).toBe(false)
  })

  it('rejects malformed input', () => {
    expect(isValidIban('')).toBe(false)
    expect(isValidIban('CH69')).toBe(false)
    expect(isValidIban('1234567890123456')).toBe(false)
    expect(isValidIban('CH69-0076-1648-8692-1200-2')).toBe(false)
  })

  it('compacts and regroups for display', () => {
    expect(compactIban(' ch69 0076 1648 ')).toBe('CH6900761648')
    expect(formatIban('CH6900761648869212002')).toBe('CH69 0076 1648 8692 1200 2')
  })
})

describe('bic validation', () => {
  it('accepts 8 and 11 character codes', () => {
    expect(isValidBic('CENAIDJA')).toBe(true)
    expect(isValidBic('kbagch22')).toBe(true)
    expect(isValidBic('DEUTDEFF500')).toBe(true)
  })

  it('rejects the wrong length or shape', () => {
    expect(isValidBic('CENA')).toBe(false)
    expect(isValidBic('CENAIDJA1')).toBe(false)
    expect(isValidBic('1234IDJA')).toBe(false)
  })
})

describe('validatePayoutDraft', () => {
  it('passes a complete draft', () => {
    expect(validatePayoutDraft(filledDraft())).toEqual({})
  })

  it('requires the address fields a statement is addressed with', () => {
    const errors = validatePayoutDraft(createEmptyPayoutDraft())
    expect(errors.line1).toBeTruthy()
    expect(errors.city).toBeTruthy()
    expect(errors.country).toBeTruthy()
    // Address line 2 and the postal code stay optional.
    expect(errors.line2).toBeUndefined()
    expect(errors.postalCode).toBeUndefined()
  })

  it('accepts an account number when the bank has no IBAN', () => {
    // Indonesian banks issue none; requiring an IBAN would lock out the
    // owners this product was built for.
    expect(validatePayoutDraft(filledDraft({ iban: '', accountNumber: '7712345678' }))).toEqual({})
  })

  it('demands one of IBAN or account number', () => {
    const errors = validatePayoutDraft(filledDraft({ iban: '', accountNumber: '' }))
    expect(errors.iban).toMatch(/account number/i)
  })

  it('rejects a bad IBAN even when an account number is also given', () => {
    const errors = validatePayoutDraft(filledDraft({ iban: 'CH69 0076 1648 8692 1020 2' }))
    expect(errors.iban).toMatch(/not valid/i)
  })

  it('checks the BIC only when one is entered', () => {
    expect(validatePayoutDraft(filledDraft({ bicSwift: '' })).bicSwift).toBeUndefined()
    expect(validatePayoutDraft(filledDraft({ bicSwift: 'NOPE' })).bicSwift).toBeTruthy()
  })
})

describe('draft conversion', () => {
  it('trims, uppercases the IBAN and BIC, and drops blank optionals', () => {
    const details = draftToPayoutDetails('own-1', filledDraft({
      line2: '  ',
      iban: ' ch69 0076 1648 8692 1200 2 ',
      bicSwift: ' cenaidja ',
      accountHolder: '  Wayan Sari  ',
    }), '2026-09-17T00:00:00.000Z')

    expect(details.ownerId).toBe('own-1')
    expect(details.address?.line2).toBeUndefined()
    expect(details.bankAccount?.iban).toBe('CH6900761648869212002')
    expect(details.bankAccount?.bicSwift).toBe('CENAIDJA')
    expect(details.bankAccount?.accountHolder).toBe('Wayan Sari')
    expect(details.updatedAt).toBe('2026-09-17T00:00:00.000Z')
  })

  it('round-trips back into a form draft', () => {
    const draft = filledDraft({ postalCode: '80361' })
    const details = draftToPayoutDetails('own-1', draft, '2026-09-17T00:00:00.000Z')
    const back = payoutDetailsToDraft(details)
    expect(back.line1).toBe(draft.line1)
    expect(back.city).toBe(draft.city)
    expect(back.postalCode).toBe('80361')
    expect(back.accountNumber).toBe(draft.accountNumber)
  })

  it('gives an empty draft for an owner with nothing on file', () => {
    expect(payoutDetailsToDraft(undefined)).toEqual(createEmptyPayoutDraft())
  })
})

describe('printed lines', () => {
  const details = draftToPayoutDetails('own-1', filledDraft({
    line2: 'Banjar Tegal Gundul',
    postalCode: '80361',
    bicSwift: 'CENAIDJA',
  }), '2026-09-17T00:00:00.000Z')

  it('formats the address one line at a time', () => {
    expect(payoutAddressLines(details)).toEqual([
      'Jl. Pantai Berawa No. 88',
      'Banjar Tegal Gundul',
      '80361 Canggu',
      'Indonesia',
    ])
  })

  it('prints the account number when there is no IBAN, and the IBAN when there is', () => {
    expect(payoutBankLines(details)).toContain('Account No: 7712345678')
    const iban = draftToPayoutDetails('own-1', filledDraft({
      iban: 'CH6900761648869212002',
      accountNumber: '7712345678',
    }), '2026-09-17T00:00:00.000Z')
    // The IBAN wins, grouped the way a bank prints it.
    expect(payoutBankLines(iban)).toContain('IBAN: CH69 0076 1648 8692 1200 2')
    expect(payoutBankLines(iban).some(l => l.startsWith('Account No'))).toBe(false)
  })

  it('returns nothing at all when the owner has filled nothing in', () => {
    expect(payoutAddressLines(undefined)).toEqual([])
    expect(payoutBankLines(undefined)).toEqual([])
  })
})

describe('hasPayoutAccount', () => {
  it('is false until there is somewhere to actually send money', () => {
    expect(hasPayoutAccount(undefined)).toBe(false)
    expect(hasPayoutAccount({
      ownerId: 'own-2',
      address: { line1: 'a', city: 'b', country: 'c' },
      updatedAt: '2026-09-17T00:00:00.000Z',
    })).toBe(false)
    expect(hasPayoutAccount({
      ownerId: 'own-2',
      bankAccount: { accountHolder: 'X', bankName: 'Y' },
      updatedAt: '2026-09-17T00:00:00.000Z',
    })).toBe(false)
  })

  it('is true once holder, bank and a number are all present', () => {
    expect(hasPayoutAccount(draftToPayoutDetails('own-1', filledDraft(), '2026-09-17T00:00:00.000Z'))).toBe(true)
  })
})
