import type { ActivationDraft, TernBankDraft } from '~/components/reservations/data/tern-activation'
import { describe, expect, it } from 'vitest'
import {
  ACTIVATION_STEPS,
  bankAccountLabel,
  bankDraftFromInvoiceTemplate,
  bankDraftToAccount,
  createActivationDraft,
  emptyBankDraft,
  firstInvalidActivationStep,
  invoiceTemplateHasBank,
  ternPayoutTarget,
  ternRegistrationPayload,
  validateActivationStep,
  validateBankDraft,
} from '~/components/reservations/data/tern-activation'

function bank(patch: Partial<TernBankDraft> = {}): TernBankDraft {
  return {
    accountHolder: 'Elevate Schweiz GmbH',
    bankName: 'Aargauische Kantonalbank',
    country: 'CH',
    iban: 'CH93 0076 2011 6238 5295 7',
    accountNumber: '',
    bicSwift: '',
    ...patch,
  }
}

function draft(patch: Partial<ActivationDraft> = {}): ActivationDraft {
  return { termsAccepted: true, bank: bank(), ...patch }
}

describe('validateBankDraft', () => {
  it('accepts a valid IBAN, and an account number with a SWIFT code where there is no IBAN', () => {
    expect(validateBankDraft(bank())).toEqual({})
    expect(validateBankDraft(bank({ country: 'ID', iban: '', accountNumber: '7890 1234 56', bicSwift: 'CENAIDJA' }))).toEqual({})
  })

  it('checks the IBAN checksum, not only its shape', () => {
    // One digit changed: every structural rule still passes.
    expect(validateBankDraft(bank({ iban: 'CH93 0076 2011 6238 5295 8' })).iban).toContain('not valid')
  })

  it('needs an IBAN or an account number, and a SWIFT code for an account number', () => {
    expect(validateBankDraft(bank({ iban: '' })).iban).toContain('IBAN, or an account number')
    expect(validateBankDraft(bank({ iban: '', accountNumber: '123456' })).bicSwift).toContain('SWIFT')
  })

  it('needs a holder, a bank and a two-letter country', () => {
    const errors = validateBankDraft(emptyBankDraft())
    expect(Object.keys(errors).sort()).toEqual(['accountHolder', 'bankName', 'bicSwift', 'country', 'iban'])
    expect(validateBankDraft(bank({ country: 'Switzerland' })).country).toBeDefined()
  })
})

describe('the steps', () => {
  it('gates each step on its own fields only', () => {
    expect(validateActivationStep(draft({ termsAccepted: false }), 'terms')).toHaveProperty('termsAccepted')
    expect(validateActivationStep(draft({ termsAccepted: false }), 'bank')).toEqual({})
    expect(validateActivationStep(draft({ bank: emptyBankDraft() }), 'bank')).toHaveProperty('bankName')
  })

  it('finds the first step that still fails, in order', () => {
    expect(firstInvalidActivationStep(draft())).toBeNull()
    expect(firstInvalidActivationStep(draft({ bank: emptyBankDraft() }))).toBe('bank')
    expect(firstInvalidActivationStep(draft({ termsAccepted: false, bank: emptyBankDraft() }))).toBe('terms')
  })

  it('has no card step: the per-stay fees go on the subscription card from onboarding', () => {
    expect(ACTIVATION_STEPS.map(s => s.id)).toEqual(['terms', 'bank', 'review'])
  })

  it('carries the bank over from a record, but asks for the terms again', () => {
    const fromRecord = createActivationDraft({
      status: 'registration_failed',
      payoutBank: bankDraftToAccount(bank()),
    })
    expect(fromRecord.termsAccepted).toBe(false)
    expect(fromRecord.bank.iban).toBe('CH9300762011623852957')
  })
})

describe('bank details from the invoice settings', () => {
  const template = {
    bank: { bankName: 'Bank Central Asia (BCA)', accountHolder: 'PT Elev8 Bali Mandiri', accountNumber: '7890 1234 56', bicSwift: 'CENAIDJA' },
  }

  it('copies what the template prints, leaving the country to the tenant', () => {
    expect(bankDraftFromInvoiceTemplate(template)).toEqual({
      accountHolder: 'PT Elev8 Bali Mandiri',
      bankName: 'Bank Central Asia (BCA)',
      country: '',
      iban: '',
      accountNumber: '7890 1234 56',
      bicSwift: 'CENAIDJA',
    })
  })

  it('offers only templates that carry an account', () => {
    expect(invoiceTemplateHasBank(template)).toBe(true)
    expect(invoiceTemplateHasBank({ bank: { bankName: '', accountHolder: '' } })).toBe(false)
    expect(invoiceTemplateHasBank({ bank: { bankName: 'BCA', accountHolder: 'X' } })).toBe(false)
  })
})

describe('what leaves the app', () => {
  it('names the account by its last four digits only', () => {
    expect(bankAccountLabel({ bankName: 'BCA', accountNumber: '7890 1234 56' })).toBe('BCA •••• 3456')
    expect(bankAccountLabel({ bankName: 'AKB', iban: 'CH9300762011623852957' })).toBe('AKB •••• 2957')
  })

  it('sends Tern the organization and the bank transfer details, and no card', () => {
    const payload = ternRegistrationPayload('Elevate Schweiz GmbH', bankDraftToAccount(bank()), '2026-09-25T00:00:00.000Z')
    expect(payload).toMatchObject({
      organization: { name: 'Elevate Schweiz GmbH', country: 'CH' },
      payout: { method: 'bank_transfer', iban: 'CH9300762011623852957' },
    })
    expect(JSON.stringify(payload)).not.toMatch(/pm_|4242|card/i)
  })

  it('has somewhere for Tern to pay only once the service is active', () => {
    const payoutBank = bankDraftToAccount(bank())
    expect(ternPayoutTarget({ status: 'registration_failed', payoutBank })).toBeNull()
    expect(ternPayoutTarget({ status: 'active', payoutBank, ternOrganizationId: 'tern_org_1' }))
      .toEqual({ id: 'tern_org_1', accountName: 'Aargauische Kantonalbank •••• 2957' })
  })
})
