/**
 * The Tern partner API (the insurer behind Elev8 Cover), as its OpenAPI spec
 * describes it: https://dev-app.terngrp.com/api/swagger-ui/index.html
 * (spec: /api/v3/api-docs, "OpenAPI definition" v0, read 2026-09-29).
 *
 * ⚠️ These types mirror the spec field for field. Do not rename or reshape them
 * to suit Elev8: the mapping to our model lives in `mappers.ts`, so a change on
 * Tern's side is a change here and in the mappers, nowhere else.
 *
 * Every endpoint takes an `X-API-Key` header. There is no webhook in the spec:
 * changes are read by polling a list with `modStampFrom`.
 */

export type TernClaimStatus
  = | 'PendingVerification'
    | 'Submitted'
    | 'InReview'
    | 'Approved'
    | 'Denied'
    | 'NotQualified'
    | 'Incomplete'
    | 'Withdrawn'
    | 'Expired'
    | 'OnHold'
    | 'FollowUpRequested'
    | 'FollowUpReceived'
    | 'FiledExternally'
    | 'Closed'

export type TernPaymentStatus = 'PaymentPending' | 'PaymentSent'

export type TernVisibility = 'Public' | 'Internal' | 'Private'

export type TernDocumentEntityType = 'Claim' | 'Booking' | 'Organization'

export type TernFileType
  = | 'application/pdf'
    | 'image/jpeg'
    | 'image/png'
    | 'image/webp'
    | 'image/gif'
    | 'image/heic'
    | 'image/heif'
    | 'image/tiff'
    | 'text/csv'
    | 'text/plain'
    | 'application/msword'
    | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    | 'application/vnd.ms-excel'
    | 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    | 'video/mp4'
    | 'video/quicktime'
    | 'video/webm'
    | 'audio/mpeg'
    | 'audio/mp4'
    | 'audio/wav'

export type TernSortDirection = 'Asc' | 'Desc'
export type TernBookingSort = 'Id' | 'State' | 'Organization' | 'Client' | 'Location' | 'BookingDate' | 'PostedDate' | 'ModifiedDate' | 'BookingCost' | 'InsuranceCost'
export type TernClaimSort = 'Id' | 'ExternalClaimSystem' | 'ExternalClaimId' | 'State' | 'Status' | 'Organization' | 'Client' | 'ClaimDate' | 'SubmissionDate' | 'ClaimAmount' | 'TernApprovedAmount'
export type TernNoteSort = 'ModStamp'

/** A covered stay. Dates are `YYYY-MM-DD`, stamps ISO date-times. */
export interface TernBooking {
  active: boolean
  bookingCurrency?: string
  bookingDate?: string
  /** readOnly */
  bookingDisplayId?: string
  bookingId?: number
  bookingNumber: string
  bookingTotal?: number
  cancelledDate?: string
  clientCountry?: string
  clientEmail?: string
  clientFirstName: string
  clientLastName?: string
  clientPostal?: string
  clientStateProvince?: string
  endDate: string
  insuranceCost?: number
  insuranceCostCurrency?: string
  locationCity?: string
  locationCountry?: string
  locationName?: string
  locationPostal?: string
  locationStateProvince?: string
  locationStreet?: string
  locationUrl?: string
  managerCity?: string
  managerContact?: string
  managerCountry?: string
  managerId?: string
  managerName?: string
  managerPostal?: string
  managerStateProvince?: string
  managerStreet?: string
  managerUrl?: string
  market?: string
  modStamp?: string
  modUserId?: number
  notes?: string
  organizationId: number
  policyId?: number
  postedDate?: string
  productId?: number
  startDate: string
  /** readOnly */
  startDatePassed?: boolean
}

export interface TernBookingNote {
  bookingId: number
  bookingNoteId?: number
  content: string
  modStamp?: string
  modUserId?: number
  visibility: TernVisibility
}

export interface TernClaim {
  active: boolean
  approvedCurrency?: string
  bookingId?: number
  claimAmount?: number
  claimCurrency?: string
  claimDate: string
  /** readOnly */
  claimDisplayId?: string
  claimId?: number
  claimantEmail?: string
  claimantName: string
  claimantPhone?: string
  deductibleApplied?: number
  description: string
  exGratiaPayment?: number
  externalClaimDescription?: string
  externalClaimId?: string
  externalClaimSystem?: string
  followUpDate?: string
  followUpReminderLastSuccessStamp?: string
  followUpRequestedDate?: string
  modStamp?: string
  modUserId?: number
  paymentReference?: string
  paymentSentDate?: string
  paymentStatus?: TernPaymentStatus
  policyId?: number
  resolvedDate?: string
  serviceProviderClaimId?: string
  status: TernClaimStatus
  submittedDate?: string
  ternApprovedAmount?: number
  totalApprovedAmount?: number
  totalNetApprovedAmount?: number
  tpaClaimId?: string
}

export interface TernClaimNote {
  claimId: number
  claimNoteId?: number
  content: string
  modStamp?: string
  modUserId?: number
  visibility: TernVisibility
}

/** `PUT /v1/claim/{id}` takes the whole claim plus optional notes. */
export interface TernClaimUpdateRequest {
  claim: TernClaim
  internalNote?: string
  privateNote?: string
  publicNote?: string
}

export interface TernDocument {
  binaryHash?: string
  documentId?: number
  entityId: number
  entityType: TernDocumentEntityType
  fileName: string
  fileSize: number
  fileType?: TernFileType
  modStamp?: string
  modUserId?: number
  notes?: string
  uploadedDate: string
  visibility: TernVisibility
}

export interface TernMetaDate {
  raw?: string
  timestamp?: string
}

/** What Tern reads off an uploaded file: EXIF, GPS, and whether it looks edited or generated. */
export interface TernDocumentMetadata {
  aiMatches?: { key?: string, value?: string }[]
  aiVerdict?: 'None' | 'Possible' | 'Likely'
  cameraAndGpsPresent?: boolean
  dateCreated?: TernMetaDate
  dateModified?: TernMetaDate
  deviceMake?: string
  deviceModel?: string
  dimensions?: string
  editingSoftware?: string
  latitude?: number
  longitude?: number
  rawMetadata?: Record<string, unknown>
  software?: string
  supported?: boolean
}

export interface TernListResponse<T> {
  count?: number
  items: T[]
}

interface TernPaging {
  includeCount?: boolean
  limit?: number
  offset?: number
}

export interface TernBookingQuery extends TernPaging {
  organizationId?: number
  active?: boolean
  clientFirstNameContains?: string
  clientLastNameContains?: string
  startDateFrom?: string
  startDateTo?: string
  bookingDateFrom?: string
  bookingDateTo?: string
  postedDateFrom?: string
  postedDateTo?: string
  modStampFrom?: string
  modStampTo?: string
  bookingNumber?: string
  bookingNumberContains?: string
  clientEmail?: string
  policyId?: number
  productId?: number
  marketContains?: string
  programContains?: string
  sort?: TernBookingSort
  sortDir?: TernSortDirection
}

export interface TernClaimQuery extends TernPaging {
  organizationId?: number
  externalClaimSystemContains?: string
  externalClaimId?: string
  externalClaimDescriptionContains?: string
  tpaClaimId?: string
  serviceProviderClaimId?: string
  anyReference?: string
  active?: boolean
  bookingId?: number
  policyId?: number
  status?: TernClaimStatus
  claimDateFrom?: string
  claimDateTo?: string
  submittedDateFrom?: string
  submittedDateTo?: string
  resolvedDateFrom?: string
  resolvedDateTo?: string
  claimantNameContains?: string
  bookingNumberContains?: string
  sort?: TernClaimSort
  sortDir?: TernSortDirection
}

export interface TernNoteQuery extends TernPaging {
  parentEntityId: number
  visibilities?: TernVisibility[]
  modStampFrom?: string
  modStampTo?: string
  sort?: TernNoteSort
  sortDir?: TernSortDirection
}

export interface TernDocumentQuery extends TernPaging {
  organizationId?: number
  entityType?: TernDocumentEntityType
  entityId?: number
  fileNameContains?: string
  binaryHashes?: string[]
}

export interface TernUploadParams {
  entityType: TernDocumentEntityType
  entityId: number
  notes?: string
  visibility?: TernVisibility
}
