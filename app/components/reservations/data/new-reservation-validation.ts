export type NewReservationField = 'listing' | 'checkIn' | 'checkOut' | 'expiry' | 'companyName' | 'firstName' | 'lastName' | 'email' | 'price'

export interface NewReservationFormState {
  checkIn: string
  checkOut: string
  listingId: string
  firstName: string
  lastName: string
  email: string
  isBusiness: boolean
  companyName: string
  /** Inquiry that sends a payment link: it needs an expiry and a price. */
  sendsLinkForInquiry: boolean
  expiryHours: number | string
  totalPrice: number
}

/** Which fields are invalid, true meaning an error. */
export function validateNewReservation(f: NewReservationFormState): Record<NewReservationField, boolean> {
  return {
    listing: !f.listingId,
    checkIn: !f.checkIn,
    checkOut: !f.checkOut || (f.checkIn !== '' && f.checkOut <= f.checkIn),
    firstName: !f.firstName.trim(),
    lastName: !f.lastName.trim(),
    email: !f.email.trim(),
    companyName: f.isBusiness && !f.companyName.trim(),
    // A link with no expiry, or one for nothing, is dead on arrival.
    expiry: f.sendsLinkForInquiry && !(Number(f.expiryHours) >= 1),
    price: f.sendsLinkForInquiry && !(f.totalPrice > 0),
  }
}

/**
 * Page order, with the accordion section each field lives in and the
 * `data-field` wrapper to focus (a check-out error focuses the date field).
 */
export const NEW_RESERVATION_FIELD_ORDER: { field: NewReservationField, section: string, target: NewReservationField }[] = [
  { field: 'listing', section: 'basic', target: 'listing' },
  { field: 'checkIn', section: 'basic', target: 'checkIn' },
  { field: 'checkOut', section: 'basic', target: 'checkIn' },
  { field: 'expiry', section: 'status', target: 'expiry' },
  { field: 'companyName', section: 'contact', target: 'companyName' },
  { field: 'firstName', section: 'contact', target: 'firstName' },
  { field: 'lastName', section: 'contact', target: 'lastName' },
  { field: 'email', section: 'contact', target: 'email' },
  { field: 'price', section: 'price', target: 'price' },
]

export function firstInvalidField(errors: Record<NewReservationField, boolean>) {
  return NEW_RESERVATION_FIELD_ORDER.find(f => errors[f.field])
}
