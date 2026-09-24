// app/components/guest-guides/data/types.ts

export type GuideStatus = 'draft' | 'active' | 'archived'
export type LinkStatus = 'pending' | 'opened' | 'submitted' | 'expired' | 'revoked'
export type LinkChannel = 'whatsapp' | 'email' | 'manual'
export type PreArrivalField =
  | 'arrival_time'
  | 'guests'
  | 'mobile'
  | 'id_type'
  | 'id_number'
  | 'id_photo'
  | 'requests'

export type GuideSectionType =
  | 'hero'
  | 'welcome'
  | 'checkin'
  | 'checkout'
  | 'house_rules'
  | 'amenities'
  | 'wifi'
  | 'local_tips'
  | 'documents'
  | 'upsells'
  | 'smart_lock'
  | 'pre_arrival'
  | 'damage_protection'
  | 'custom_rich'

export interface GuideSection {
  id: string
  type: GuideSectionType
  order: number
  enabled: boolean
  data: Record<string, any>
}

export interface GuestGuide {
  id: string
  title: string
  description?: string
  assignedListingIds: string[]
  templateId?: string
  status: GuideStatus
  sections: GuideSection[]
  defaultLanguage: string
  createdBy: string
  createdAt: string
  updatedAt: string
  smartOrdering?: boolean
}

export interface GuestGuideLink {
  id: string
  token: string
  guideId: string
  reservationId: string
  listingId: string
  guestName: string
  guestEmail?: string
  guestPhone?: string
  guestLanguage?: string
  sentAt: string
  openedAt?: string
  submittedAt?: string
  expiresAt: string
  status: LinkStatus
  channel: LinkChannel
  metadata?: { journeyId?: string; templateId?: string }
}

export interface GuideSubmission {
  id: string
  linkId: string
  submittedAt: string
  arrivalTime?: string
  guests?: number
  mobile?: string
  idType?: 'passport' | 'ktp' | 'driver_license'
  idNumber?: string
  idPhotoUrl?: string
  requests?: string
  upsellsAdded?: { serviceId: string; qty: number }[]
  smartLockViewedAt?: string
  protectionChoice?: {
    option: 'waiver' | 'deposit'
    acceptedAt: string
    termsVersion: string
    /**
     * Deposit: the card the guest saved, as Stripe returns it. A reference and
     * what a receipt may print, never the number (`protection-choice.ts`).
     */
    card?: {
      paymentMethodId: string
      brand: string
      last4: string
      expMonth: number
      expYear: number
    }
    /** Deposit: the guest agreed to a charge after check-out. Always true when `card` is set. */
    chargeConsent?: boolean
  }
}

export interface GuideTemplate {
  id: string
  name: string
  description: string
  category: 'tropical' | 'mountain' | 'urban'
  iconName: string
  sections: Omit<GuideSection, 'id'>[]
}