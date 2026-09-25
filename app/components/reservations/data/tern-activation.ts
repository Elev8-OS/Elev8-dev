import type { InvoiceTemplate } from '~/components/settings/data/invoice-templates'
import { compactIban, isValidBic, isValidIban } from '~/components/owners/data/owner-payout-details'

/**
 * Activating the damage waiver service: the tenant accepts the Tern cover
 * terms and gives Tern a bank account for claim payouts, and Elev8 registers
 * the tenant as an organization on Tern.
 *
 * ⚠️ There is no card step. The per-stay fees go on the card the tenant saved
 * at onboarding for its Elev8 subscription (`subscription.stripePaymentMethodId`),
 * so activation reuses that reference rather than asking for a second card.
 *
 * Framework-free; `useTernActivation` owns the state and calls in.
 *
 * ⚠️ Until the status is `active`, nothing that uses the waiver works: a policy
 * offering the waiver is paused, a listing cannot be host-paid, and no claim
 * can be filed with Tern. Deposit-only policies are not Tern's and keep working.
 */

export type TernActivationStatus = 'not_activated' | 'registering' | 'active' | 'registration_failed'

/**
 * Where Tern pays an approved claim: by BANK TRANSFER, straight to the tenant
 * (owner's decision, 2026-09-25, not Wise). One account per tenant for now:
 * whether Tern accepts one per listing is an open question with Tern, and one
 * account works whichever way they answer.
 *
 * Either an IBAN or a local account number, never an IBAN specifically:
 * Indonesian banks issue none. Same rule as the owner payout account.
 */
export interface TernBankAccount {
  accountHolder: string
  bankName: string
  /** ISO 3166 alpha-2, for the transfer's routing. */
  country: string
  iban?: string
  accountNumber?: string
  bicSwift?: string
}

export interface TernActivation {
  status: TernActivationStatus
  /** The terms the tenant accepted, and when. */
  termsVersion?: string
  acceptedAt?: string
  acceptedBy?: string
  /**
   * The subscription card Elev8 charges the Tern per-stay fee to, copied from
   * onboarding at activation. ⚠️ Stripe's reference only, never the number.
   */
  billingPaymentMethodId?: string
  payoutBank?: TernBankAccount
  /** The invoice template the bank details were copied from. Provenance only, never a live join. */
  bankCopiedFromTemplateId?: string
  /** Tern's id for the tenant, returned when the organization is registered. */
  ternOrganizationId?: string
  registeredAt?: string
  lastError?: string
  attempts?: number
}

export const TERN_ACTIVATION_TERMS_VERSION = 'tern-2026-09'

/** What the tenant agrees to, one plain sentence each. The wizard and the record print the same list. */
export const TERN_ACTIVATION_TERMS: string[] = [
  'Tern, through Elev8, covers accidental damage on every covered stay up to the cover of the tier each policy uses.',
  'Elev8 charges the tier\'s fixed fee for every covered stay to the card on your Elev8 subscription, whether the guest or you pay for the waiver.',
  'Tern pays approved claims above the deductible by bank transfer to the bank account you give here.',
  'Guests are offered a damage waiver, never insurance, and never see Tern\'s name.',
]

export type ActivationStepId = 'terms' | 'bank' | 'review'

export const ACTIVATION_STEPS: { id: ActivationStepId, title: string, description: string }[] = [
  { id: 'terms', title: 'Terms', description: 'What activating the damage waiver means' },
  { id: 'bank', title: 'Bank account', description: 'Where Tern pays your claims' },
  { id: 'review', title: 'Review', description: 'Check and activate' },
]

export interface TernBankDraft {
  accountHolder: string
  bankName: string
  country: string
  iban: string
  accountNumber: string
  bicSwift: string
}

export interface ActivationDraft {
  termsAccepted: boolean
  bank: TernBankDraft
  bankCopiedFromTemplateId?: string
}

export function emptyBankDraft(): TernBankDraft {
  return { accountHolder: '', bankName: '', country: '', iban: '', accountNumber: '', bicSwift: '' }
}

export function createActivationDraft(activation?: TernActivation): ActivationDraft {
  const bank = activation?.payoutBank
  return {
    termsAccepted: false,
    bank: bank
      ? {
          accountHolder: bank.accountHolder,
          bankName: bank.bankName,
          country: bank.country,
          iban: bank.iban ?? '',
          accountNumber: bank.accountNumber ?? '',
          bicSwift: bank.bicSwift ?? '',
        }
      : emptyBankDraft(),
    bankCopiedFromTemplateId: activation?.bankCopiedFromTemplateId,
  }
}

/**
 * The bank details an invoice template already prints, as a starting point. A
 * copy, never a link: editing the invoice later must not move where Tern pays.
 * The country is left for the tenant, since a template does not record one.
 */
export function bankDraftFromInvoiceTemplate(template: Pick<InvoiceTemplate, 'bank'>, country = ''): TernBankDraft {
  return {
    accountHolder: template.bank.accountHolder ?? '',
    bankName: template.bank.bankName ?? '',
    country,
    iban: template.bank.iban ? compactIban(template.bank.iban) : '',
    accountNumber: template.bank.accountNumber ?? '',
    bicSwift: template.bank.bicSwift ?? '',
  }
}

/** Whether a template has enough bank details to be worth copying. */
export function invoiceTemplateHasBank(template: Pick<InvoiceTemplate, 'bank'>): boolean {
  return Boolean(template.bank.bankName.trim() && (template.bank.iban?.trim() || template.bank.accountNumber?.trim()))
}

export type BankErrors = Partial<Record<keyof TernBankDraft, string>>

export function validateBankDraft(bank: TernBankDraft): BankErrors {
  const errors: BankErrors = {}
  if (!bank.accountHolder.trim())
    errors.accountHolder = 'Enter the name on the account.'
  if (!bank.bankName.trim())
    errors.bankName = 'Enter the bank\'s name.'
  if (!/^[A-Z]{2}$/i.test(bank.country.trim()))
    errors.country = 'Enter the country as a two-letter code, for example ID or CH.'
  const iban = bank.iban.trim()
  if (!iban && !bank.accountNumber.trim())
    errors.iban = 'Enter an IBAN, or an account number if your bank has none.'
  else if (iban && !isValidIban(iban))
    errors.iban = 'This IBAN is not valid. Check it against a bank statement.'
  // A transfer from Tern crosses borders: without an IBAN, the bank needs a SWIFT code to route it.
  const bic = bank.bicSwift.trim()
  if (bic && !isValidBic(bic))
    errors.bicSwift = 'A BIC / SWIFT code is 8 or 11 letters and digits.'
  else if (!bic && !iban)
    errors.bicSwift = 'Enter the SWIFT code: an international transfer to an account number needs one.'
  return errors
}

/**
 * Why a step cannot be left as it stands, keyed by field. Empty means it can.
 * The subscription card is not a step: `useTernActivation.activate` checks it.
 */
export function validateActivationStep(draft: ActivationDraft, step: ActivationStepId): Record<string, string> {
  if (step === 'terms')
    return draft.termsAccepted ? {} : { termsAccepted: 'Accept the terms to activate the damage waiver.' }
  if (step === 'bank')
    return validateBankDraft(draft.bank)
  return {}
}

/** The first step that still fails, or null. The final Activate re-checks every step. */
export function firstInvalidActivationStep(draft: ActivationDraft): ActivationStepId | null {
  for (const step of ACTIVATION_STEPS) {
    if (Object.keys(validateActivationStep(draft, step.id)).length)
      return step.id
  }
  return null
}

export function bankDraftToAccount(bank: TernBankDraft): TernBankAccount {
  const optional = (value: string) => (value.trim() ? value.trim() : undefined)
  return {
    accountHolder: bank.accountHolder.trim(),
    bankName: bank.bankName.trim(),
    country: bank.country.trim().toUpperCase(),
    iban: bank.iban.trim() ? compactIban(bank.iban) : undefined,
    accountNumber: optional(bank.accountNumber),
    bicSwift: bank.bicSwift.trim() ? bank.bicSwift.replace(/\s+/g, '').toUpperCase() : undefined,
  }
}

/** "BCA •••• 3456": enough to recognise the account, never the whole number. */
export function bankAccountLabel(bank: Pick<TernBankAccount, 'bankName' | 'iban' | 'accountNumber'>): string {
  const digits = (bank.iban ?? bank.accountNumber ?? '').replace(/\s+/g, '')
  return `${bank.bankName} •••• ${digits.slice(-4)}`
}

/**
 * What the registration call sends to Tern. ⚠️ No card at all: Elev8 bills the
 * tenant and pays Tern, so the billing card stays with Elev8's gateway and
 * Tern only needs to know who the organization is and where to pay it.
 */
export function ternRegistrationPayload(
  organizationName: string,
  bank: TernBankAccount,
  acceptedAt: string,
): Record<string, unknown> {
  return {
    organization: { name: organizationName, country: bank.country },
    termsVersion: TERN_ACTIVATION_TERMS_VERSION,
    termsAcceptedAt: acceptedAt,
    payout: { method: 'bank_transfer', ...bank },
  }
}

/** Where Tern pays a claim, frozen onto the claim at filing. Null until the service is active. */
export function ternPayoutTarget(activation: TernActivation): { id: string, accountName: string } | null {
  if (activation.status !== 'active' || !activation.payoutBank)
    return null
  return {
    id: activation.ternOrganizationId ?? 'tern-bank',
    accountName: bankAccountLabel(activation.payoutBank),
  }
}
