// Where an owner's money goes, and the postal address that belongs on their
// statement. Framework-free: the composable owns the reactive state and calls
// in, the same split as `owner-ledger.ts` and `promo-code-form.ts`.
//
// This lives in its own store keyed by ownerId rather than as fields on
// `Owner`, for the same reason permissions and operational fees do: the seed
// owners need no migration, and a record only exists once an owner has
// actually filled one in — which is exactly the state the statement PDF has
// to be able to report ("no payout account on file").

export interface OwnerAddress {
  line1: string
  line2?: string
  postalCode?: string
  city: string
  country: string
}

export interface OwnerBankAccount {
  accountHolder: string
  bankName: string
  /** IBAN countries. Either this or `accountNumber` must be present. */
  iban?: string
  /** Local account number, for countries with no IBAN (Indonesia included). */
  accountNumber?: string
  bicSwift?: string
}

export interface OwnerPayoutDetails {
  ownerId: string
  address?: OwnerAddress
  bankAccount?: OwnerBankAccount
  updatedAt: string
}

/** Flat, every field a concrete string — what a form binds to. */
export interface OwnerPayoutDraft {
  line1: string
  line2: string
  postalCode: string
  city: string
  country: string
  accountHolder: string
  bankName: string
  iban: string
  accountNumber: string
  bicSwift: string
}

export type OwnerPayoutErrors = Partial<Record<keyof OwnerPayoutDraft, string>>

export const OWNER_PAYOUT_STORAGE_KEY = 'elev8-owner-payout-details-v1'

export function createEmptyPayoutDraft(): OwnerPayoutDraft {
  return {
    line1: '',
    line2: '',
    postalCode: '',
    city: '',
    country: '',
    accountHolder: '',
    bankName: '',
    iban: '',
    accountNumber: '',
    bicSwift: '',
  }
}

export function payoutDetailsToDraft(details: OwnerPayoutDetails | undefined): OwnerPayoutDraft {
  const draft = createEmptyPayoutDraft()
  if (!details)
    return draft
  return {
    ...draft,
    line1: details.address?.line1 ?? '',
    line2: details.address?.line2 ?? '',
    postalCode: details.address?.postalCode ?? '',
    city: details.address?.city ?? '',
    country: details.address?.country ?? '',
    accountHolder: details.bankAccount?.accountHolder ?? '',
    bankName: details.bankAccount?.bankName ?? '',
    iban: details.bankAccount?.iban ?? '',
    accountNumber: details.bankAccount?.accountNumber ?? '',
    bicSwift: details.bankAccount?.bicSwift ?? '',
  }
}

/** Strip the spaces banks print IBANs with; storage keeps the compact form. */
export function compactIban(value: string): string {
  return value.replace(/\s+/g, '').toUpperCase()
}

/** Grouped in fours, the way a bank statement prints it. */
export function formatIban(value: string): string {
  return compactIban(value).replace(/(.{4})/g, '$1 ').trim()
}

/**
 * Structure plus the ISO 13616 mod-97 checksum. The checksum is the whole
 * point: a transposed pair of digits passes every length and character rule
 * and still sends the owner's money nowhere.
 */
export function isValidIban(value: string): boolean {
  const compact = compactIban(value)
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(compact))
    return false
  const rearranged = compact.slice(4) + compact.slice(0, 4)
  const expanded = rearranged.replace(/[A-Z]/g, char => String(char.charCodeAt(0) - 55))
  // Chunked mod-97: an IBAN expands past Number.MAX_SAFE_INTEGER.
  let remainder = 0
  for (const digit of expanded)
    remainder = (remainder * 10 + Number(digit)) % 97
  return remainder === 1
}

/** SWIFT/BIC is 8 or 11 characters: bank, country, location, optional branch. */
export function isValidBic(value: string): boolean {
  return /^[A-Z]{6}[A-Z0-9]{2}(?:[A-Z0-9]{3})?$/.test(value.replace(/\s+/g, '').toUpperCase())
}

/**
 * Every field that must be right before we tell an owner their money is going
 * somewhere. The account number rule is deliberately "one of IBAN or account
 * number": Indonesian banks have no IBAN, and requiring one would lock out
 * the owners this product was built for.
 */
export function validatePayoutDraft(draft: OwnerPayoutDraft): OwnerPayoutErrors {
  const errors: OwnerPayoutErrors = {}

  if (!draft.line1.trim())
    errors.line1 = 'Street address is required.'
  if (!draft.city.trim())
    errors.city = 'City is required.'
  if (!draft.country.trim())
    errors.country = 'Country is required.'

  if (!draft.accountHolder.trim())
    errors.accountHolder = 'Account holder is required.'
  if (!draft.bankName.trim())
    errors.bankName = 'Bank name is required.'

  const iban = draft.iban.trim()
  const accountNumber = draft.accountNumber.trim()
  if (!iban && !accountNumber) {
    errors.iban = 'Enter an IBAN, or an account number if your bank has none.'
  }
  else if (iban && !isValidIban(iban)) {
    errors.iban = 'This IBAN is not valid. Check it against your bank statement.'
  }

  const bic = draft.bicSwift.trim()
  if (bic && !isValidBic(bic))
    errors.bicSwift = 'A BIC / SWIFT code is 8 or 11 letters and digits.'

  return errors
}

export function draftToPayoutDetails(ownerId: string, draft: OwnerPayoutDraft, now: string): OwnerPayoutDetails {
  const trimmed = (value: string) => value.trim()
  const optional = (value: string) => (value.trim() ? value.trim() : undefined)
  return {
    ownerId,
    address: {
      line1: trimmed(draft.line1),
      line2: optional(draft.line2),
      postalCode: optional(draft.postalCode),
      city: trimmed(draft.city),
      country: trimmed(draft.country),
    },
    bankAccount: {
      accountHolder: trimmed(draft.accountHolder),
      bankName: trimmed(draft.bankName),
      iban: draft.iban.trim() ? compactIban(draft.iban) : undefined,
      accountNumber: optional(draft.accountNumber),
      bicSwift: draft.bicSwift.trim() ? draft.bicSwift.trim().toUpperCase() : undefined,
    },
    updatedAt: now,
  }
}

/** The address block, one line each, as the statement prints it. */
export function payoutAddressLines(details: OwnerPayoutDetails | undefined): string[] {
  const address = details?.address
  if (!address)
    return []
  return [
    address.line1,
    address.line2,
    [address.postalCode, address.city].filter(Boolean).join(' '),
    address.country,
  ].filter((line): line is string => Boolean(line && line.trim()))
}

/**
 * The bank block, one line each. Shared by the portal page and the statement
 * PDF so the owner reads the same account in both places.
 */
export function payoutBankLines(details: OwnerPayoutDetails | undefined): string[] {
  const bank = details?.bankAccount
  if (!bank)
    return []
  return [
    bank.bankName ? `Bank: ${bank.bankName}` : '',
    bank.accountHolder ? `Account Holder: ${bank.accountHolder}` : '',
    bank.iban ? `IBAN: ${formatIban(bank.iban)}` : (bank.accountNumber ? `Account No: ${bank.accountNumber}` : ''),
    bank.bicSwift ? `BIC / SWIFT: ${bank.bicSwift}` : '',
  ].filter((line): line is string => Boolean(line))
}

export function hasPayoutAccount(details: OwnerPayoutDetails | undefined): boolean {
  const bank = details?.bankAccount
  return Boolean(bank?.accountHolder && bank.bankName && (bank.iban || bank.accountNumber))
}

// --- Seed fixtures ----------------------------------------------------------
//
// Only Wayan has filled hers in, so the demo shows both halves at once: a
// statement that prints a real payout account, and two owners whose portal
// still asks for one.
export const mockOwnerPayoutDetails: OwnerPayoutDetails[] = [
  {
    ownerId: 'own-1',
    address: {
      line1: 'Jl. Pantai Berawa No. 88',
      line2: 'Banjar Tegal Gundul',
      postalCode: '80361',
      city: 'Canggu, Badung',
      country: 'Indonesia',
    },
    bankAccount: {
      accountHolder: 'Wayan Sari',
      bankName: 'Bank Central Asia (BCA)',
      accountNumber: '7712345678',
      bicSwift: 'CENAIDJA',
    },
    updatedAt: '2026-02-04T09:12:00.000Z',
  },
]
