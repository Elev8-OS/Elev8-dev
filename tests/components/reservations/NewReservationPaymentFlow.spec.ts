import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { describe, expect, it } from 'vitest'

// The dialog and the detail sheet are too heavy to mount, so these read their
// source like the invoice and inbox button specs. The rules themselves live in
// `new-reservation-validation`, `markReservationPaid` and `markRequestPaid`,
// which have their own specs; this checks the components wire them up.
const read = (file: string) => readFileSync(join(process.cwd(), file), 'utf8')
const dialog = read('app/components/reservations/NewReservationDialog.vue')
const edit = read('app/components/reservations/EditReservationDialog.vue')
const sheet = read('app/components/reservations/ReservationDetailSheet.vue')
const timePicker = read('app/components/base/TimePicker.vue')
const requestDialog = read('app/components/payment-request/PaymentRequestDetailDialog.vue')

describe('new reservation dialog', () => {
  it('validates through the shared module and focuses the first error', () => {
    expect(dialog).toContain('validateNewReservation({')
    expect(dialog).toContain('firstInvalidField(errors.value)')
    for (const field of ['listing', 'checkIn', 'expiry', 'companyName', 'firstName', 'lastName', 'email', 'price'])
      expect(dialog).toContain(`data-field="${field}"`)
  })

  it('empties the form whenever it closes, not only after a save', () => {
    const close = dialog.slice(dialog.indexOf('watch(() => props.open'))
    expect(close.slice(0, 300)).toContain('reset()')
  })

  it('always bills the booking, never a guessed city tax link', () => {
    expect(dialog).toContain('purpose: \'booking\'')
  })

  it('a confirmed booking records bank or cash, an inquiry may also pick a link', () => {
    expect(dialog).toContain('manualPaymentMethods')
    expect(dialog).toContain('[\'payment_link\', \'bank_transfer\', \'cash\']')
    expect(dialog).toContain('paidAt: status.value === \'inquiry\' ? undefined : new Date().toISOString()')
    expect(dialog).toContain('paymentMethod.value = \'bank_transfer\'')
  })

  it('a confirmed booking sends a confirmation, with no payment request', () => {
    expect(dialog).toContain('confirmationOnly: isConfirmed.value')
    expect(dialog).toContain('isConfirmed.value ? \'booking confirmation\' : \'payment link\'')
  })

  it('lets the arrival time be cleared', () => {
    expect(dialog).toContain('clearable')
    expect(edit).toContain('clearable')
  })
})

describe('edit reservation dialog', () => {
  it('an inquiry link bills the booking and needs an expiry of an hour', () => {
    expect(edit).toContain('purpose: status.value === \'inquiry\' ? \'booking\' : undefined')
    expect(edit).toContain('inquiryExpiryHours.value) >= 1')
  })
})

describe('mark as paid in the detail sheet', () => {
  it('takes an amount and the day the money arrived, no later than today', () => {
    expect(sheet).toContain('data-testid="mark-paid-amount"')
    expect(sheet).toContain('data-testid="mark-paid-date"')
    expect(sheet).toContain(':max="localToday()"')
    expect(sheet).toContain('markPaidError')
  })

  it('offers only bank transfer and cash, never a payment link', () => {
    expect(sheet).toContain('v-for="value in manualPaymentMethods"')
  })

  it('starts each stay from its own defaults', () => {
    expect(sheet).toContain('watch(() => reservation.value?.id')
    expect(sheet).toContain('markPaidMethod.value = \'bank_transfer\'')
  })

  it('a part payment keeps the link open, a full one cancels it', () => {
    expect(sheet).toContain('const cancelsLink = Boolean(request) && full')
    expect(sheet).toContain('Record part payment')
  })

  it('settles a stay whose link the guest already paid', () => {
    expect(sheet).toContain('markReservationPaid(r.id, \'payment_link\')')
  })
})

describe('time picker', () => {
  it('has an opt-in clear button that empties the value', () => {
    expect(timePicker).toContain('clearable?: boolean')
    expect(timePicker).toContain('data-testid="time-picker-clear"')
    expect(timePicker).toContain('emit(\'update:modelValue\', \'\')')
  })
})

describe('payment request dialog', () => {
  it('can simulate the guest paying a pending request', () => {
    expect(requestDialog).toContain('data-testid="simulate-guest-payment"')
    expect(requestDialog).toContain('emit(\'markPaid\', request.id)')
  })
})
