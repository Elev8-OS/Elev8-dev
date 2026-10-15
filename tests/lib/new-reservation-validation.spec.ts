import type { NewReservationFormState } from '~/components/reservations/data/new-reservation-validation'
import { describe, expect, it } from 'vitest'
import { firstInvalidField, validateNewReservation } from '~/components/reservations/data/new-reservation-validation'

const valid: NewReservationFormState = {
  checkIn: '2027-01-10',
  checkOut: '2027-01-12',
  listingId: 'lst-1',
  firstName: 'Ana',
  lastName: 'Lee',
  email: 'ana@example.com',
  isBusiness: false,
  companyName: '',
  sendsLinkForInquiry: false,
  expiryHours: 24,
  totalPrice: 1000,
}

const errorsOf = (over: Partial<NewReservationFormState>) => validateNewReservation({ ...valid, ...over })

describe('validateNewReservation', () => {
  it('a complete form has no errors', () => {
    expect(Object.values(errorsOf({})).some(Boolean)).toBe(false)
  })

  it('flags each missing required field', () => {
    expect(errorsOf({ listingId: '' }).listing).toBe(true)
    expect(errorsOf({ checkIn: '' }).checkIn).toBe(true)
    expect(errorsOf({ checkOut: '' }).checkOut).toBe(true)
    expect(errorsOf({ email: '' }).email).toBe(true)
  })

  it('treats whitespace as empty', () => {
    expect(errorsOf({ firstName: '   ' }).firstName).toBe(true)
    expect(errorsOf({ lastName: ' ' }).lastName).toBe(true)
  })

  it('check-out must come after check-in', () => {
    expect(errorsOf({ checkOut: '2027-01-10' }).checkOut).toBe(true)
    expect(errorsOf({ checkOut: '2027-01-09' }).checkOut).toBe(true)
  })

  it('a business booking needs a company name', () => {
    expect(errorsOf({ isBusiness: true, companyName: '' }).companyName).toBe(true)
    expect(errorsOf({ isBusiness: true, companyName: 'PT Test' }).companyName).toBe(false)
    expect(errorsOf({ isBusiness: false, companyName: '' }).companyName).toBe(false)
  })

  it('an inquiry payment link needs an expiry of at least 1 hour', () => {
    for (const expiryHours of [0, -5, '', 0.5]) {
      expect(errorsOf({ sendsLinkForInquiry: true, expiryHours }).expiry).toBe(true)
    }
    expect(errorsOf({ sendsLinkForInquiry: true, expiryHours: 1 }).expiry).toBe(false)
    expect(errorsOf({ sendsLinkForInquiry: true, expiryHours: '48' }).expiry).toBe(false)
  })

  it('an inquiry payment link needs a price above 0', () => {
    expect(errorsOf({ sendsLinkForInquiry: true, totalPrice: 0 }).price).toBe(true)
    expect(errorsOf({ sendsLinkForInquiry: true, totalPrice: -1 }).price).toBe(true)
    expect(errorsOf({ sendsLinkForInquiry: true, totalPrice: 1 }).price).toBe(false)
  })

  it('expiry and price are not checked when no link is sent', () => {
    const e = errorsOf({ sendsLinkForInquiry: false, expiryHours: 0, totalPrice: 0 })
    expect(e.expiry).toBe(false)
    expect(e.price).toBe(false)
  })
})

describe('firstInvalidField', () => {
  it('follows the page order, property first', () => {
    const all = errorsOf({ listingId: '', checkIn: '', firstName: '', email: '' })
    expect(firstInvalidField(all)?.field).toBe('listing')
  })

  it('a check-out error focuses the date field', () => {
    const f = firstInvalidField(errorsOf({ checkOut: '2027-01-09' }))
    expect(f).toMatchObject({ field: 'checkOut', target: 'checkIn', section: 'basic' })
  })

  it('opens the right section for each field', () => {
    expect(firstInvalidField(errorsOf({ sendsLinkForInquiry: true, expiryHours: 0 }))?.section).toBe('status')
    expect(firstInvalidField(errorsOf({ firstName: '' }))?.section).toBe('contact')
    expect(firstInvalidField(errorsOf({ sendsLinkForInquiry: true, totalPrice: 0 }))?.section).toBe('price')
  })

  it('is undefined when the form is valid', () => {
    expect(firstInvalidField(errorsOf({}))).toBeUndefined()
  })
})
