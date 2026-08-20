export type AlertType
  = | 'SMART_LOCK_DEAD'
    | 'SMART_LOCK_OFFLINE'
    | 'SMART_LOCK_CODE_FAILED'
    | 'CHANNEL_DISCONNECTED'
    | 'DOUBLE_BOOKING'
    | 'CLEANING_NOT_STARTED_IMMINENT'
    | 'CLEANING_NOT_DONE_CHECKIN_PASSED'
    | 'STRIPE_DISCONNECTED'
    | 'DEPOSIT_FAILED_AT_CHECKIN'
    | 'BOOKING_QUOTA_EMPTY'
    | 'BRIDGE_OFFLINE'
    | 'SMART_LOCK_BATTERY_CRITICAL'
    | 'SMART_LOCK_BATTERY_LOW'
    | 'NO_HOUSEKEEPING_ASSIGNED'
    | 'TASK_OVERDUE'
    | 'RATE_PLAN_UNMAPPED'
    | 'BOOKING_QUOTA_LOW'
    | 'DYNAMIC_TEMPLATE_FAILED'
    | 'WARRANTY_EXPIRING_SOON'
    | 'WARRANTY_EXPIRED'
    | 'UPSELL_ORDER_REQUESTED'
    | 'UPSELL_ORDER_APPROVED'
    | 'UPSELL_ORDER_DECLINED'
    | 'UPSELL_PAYMENT_RECEIVED'
    | 'UPSELL_FULFILLMENT_STARTED'
    | 'UPSELL_FULFILLMENT_COMPLETED'
    | 'CALL_INCOMING'
    | 'CALL_MISSED'
    | 'CALL_COMPLETED'
    | 'AIRBNB_REVIEW_GENERATED'
    | 'AIRBNB_REVIEW_POSTED'
    | 'AIRBNB_REVIEW_FAILED'
    | 'REVIEW_GUEST_LEFT'
    | 'REVIEW_HOST_DUE'
    | 'GUEST_GUIDE_NOT_SENT'
    | 'GUEST_GUIDE_OPENED'
    | 'GUEST_GUIDE_SUBMITTED'
    | 'KEY_NOT_RETURNED'
    | 'GUEST_CHECKED_IN'
    | 'GUEST_CHECKED_OUT'
    | 'GUEST_ARRIVAL_SOON'
    | 'OWNER_STATEMENT_DRAFT_READY'
    | 'OWNER_STATEMENT_PUBLISHED'
    | 'OWNER_STAY_CONFIRMED'
    | 'OWNER_STAY_CONFLICT'
    | 'OWNER_ISSUE_RAISED'
    | 'OWNER_USE_CAP_EXCEEDED'
    | 'OWNER_STAY_REQUESTED'
    | 'OWNER_STAY_REJECTED'
    | 'OWNER_STAY_CANCELLED'
    | 'OWNER_STAY_APPROACHING'
    | 'DOCUMENT_UPLOADED'
    | 'MAINTENANCE_APPROVAL_REQUESTED'
    | 'MAINTENANCE_COMPLETED'
    | 'OWNER_LINK_REVOKED'
    | 'OWNER_CONTRACT_SENT'
    | 'OWNER_CONTRACT_SIGNED'
    | 'OWNER_ISSUE_RESPONDED'
    | 'OWNER_BOOKING_MODE_CHANGED'
    | 'LEXWARE_DRAFT_INVOICE_READY'
    | 'LEXWARE_CONNECTION_NEEDS_ATTENTION'
    | 'LEXWARE_TAX_MAPPING_HOLD'
    | 'LEXWARE_CREDIT_NOTE_CREATED'
    | 'LEXWARE_NON_EUR_EXCLUDED'
    | 'EMAIL_DOMAIN_VERIFIED'
    | 'EMAIL_DNS_FAILING'
    | 'EMAIL_REPLY_RECEIVED'
    | 'GUEST_REGISTRATION_DUE'
    | 'GUEST_REGISTRATION_OVERDUE'
    | 'GUEST_REGISTRATION_SUBMITTED'
    | 'GUEST_REGISTRATION_FAILED'

export type AlertSeverity = 'CRITICAL' | 'WARNING' | 'INFO'

export interface Alert {
  alert_id: string
  type: AlertType
  severity: AlertSeverity
  status: 'ACTIVE' | 'RESOLVED'
  listing_id: string | null
  property_id: string | null
  triggered_at: string
  resolved_at: string | null
  auto_resolve: boolean
  resolve_condition: string
  context: Record<string, any>
}

export const alertDisplayLabels: Record<AlertType, string> = {
  SMART_LOCK_DEAD: 'Smart Lock - Battery Dead',
  SMART_LOCK_OFFLINE: 'Smart Lock - Offline',
  SMART_LOCK_CODE_FAILED: 'Smart Lock - Access Code Not Generated',
  CHANNEL_DISCONNECTED: 'Channel Manager - Disconnected',
  DOUBLE_BOOKING: 'Double Booking Detected',
  CLEANING_NOT_STARTED_IMMINENT: 'Cleaning Not Started - Check-in in 2 Hours',
  CLEANING_NOT_DONE_CHECKIN_PASSED: 'Cleaning Incomplete - Guest Checking In Now',
  STRIPE_DISCONNECTED: 'Stripe - Payment Connection Lost',
  DEPOSIT_FAILED_AT_CHECKIN: 'Security Deposit - Payment Failed',
  BOOKING_QUOTA_EMPTY: 'Booking Quota - 0 Remaining',
  BRIDGE_OFFLINE: 'Elev8 Bridge - Offline',
  SMART_LOCK_BATTERY_CRITICAL: 'Smart Lock - Battery Critical',
  SMART_LOCK_BATTERY_LOW: 'Smart Lock - Battery Low',
  NO_HOUSEKEEPING_ASSIGNED: 'No Housekeeping Assigned - Check-out Today',
  TASK_OVERDUE: 'Task Overdue',
  RATE_PLAN_UNMAPPED: 'Booking.com - Rate Plan Unmapped',
  BOOKING_QUOTA_LOW: 'Booking Quota - Running Low',
  DYNAMIC_TEMPLATE_FAILED: 'Automated Message - Failed to Send',
  WARRANTY_EXPIRING_SOON: 'Inventory - Warranty Expiring Soon',
  WARRANTY_EXPIRED: 'Inventory - Warranty Expired',
  UPSELL_ORDER_REQUESTED: 'Upsell Order Requested',
  UPSELL_ORDER_APPROVED: 'Upsell Order Approved',
  UPSELL_ORDER_DECLINED: 'Upsell Order Declined',
  UPSELL_PAYMENT_RECEIVED: 'Upsell Payment Received',
  UPSELL_FULFILLMENT_STARTED: 'Upsell Fulfillment Started',
  UPSELL_FULFILLMENT_COMPLETED: 'Upsell Fulfillment Completed',
  CALL_INCOMING: 'Incoming Call',
  CALL_MISSED: 'Missed Call',
  CALL_COMPLETED: 'Call Completed',
  AIRBNB_REVIEW_GENERATED: 'Airbnb Review - Generated',
  AIRBNB_REVIEW_POSTED: 'Airbnb Review - Posted',
  AIRBNB_REVIEW_FAILED: 'Airbnb Review - Failed',
  REVIEW_GUEST_LEFT: 'Guest Left a Review',
  REVIEW_HOST_DUE: 'Host Review Due Soon',
  GUEST_GUIDE_NOT_SENT: 'Guest Guide - Not Sent',
  GUEST_GUIDE_OPENED: 'Guest Guide - Opened',
  GUEST_GUIDE_SUBMITTED: 'Guest Guide - Form Submitted',
  KEY_NOT_RETURNED: 'Key - Not Returned',
  GUEST_CHECKED_IN: 'Guest Checked In',
  GUEST_CHECKED_OUT: 'Guest Checked Out',
  GUEST_ARRIVAL_SOON: 'Guest Arrival Soon',
  OWNER_STATEMENT_DRAFT_READY: 'Owner Statement Draft Ready',
  OWNER_STATEMENT_PUBLISHED: 'Owner Statement Published',
  OWNER_STAY_CONFIRMED: 'Owner Stay Confirmed',
  OWNER_STAY_CONFLICT: 'Owner Stay Conflict',
  OWNER_ISSUE_RAISED: 'Owner Statement Issue Raised',
  OWNER_USE_CAP_EXCEEDED: 'Owner Use Cap Exceeded',
  OWNER_STAY_REQUESTED: 'Owner Stay Requested',
  OWNER_STAY_REJECTED: 'Owner Stay Rejected',
  OWNER_STAY_CANCELLED: 'Owner Stay Cancellation Requested',
  OWNER_STAY_APPROACHING: 'Owner Stay Approaching',
  DOCUMENT_UPLOADED: 'New Owner Document',
  MAINTENANCE_APPROVAL_REQUESTED: 'Maintenance Cost Approval',
  MAINTENANCE_COMPLETED: 'Maintenance Completed',
  OWNER_LINK_REVOKED: 'Owner Access Revoked',
  OWNER_CONTRACT_SENT: 'Contract Sent for Signature',
  OWNER_CONTRACT_SIGNED: 'Contract Signed by Owner',
  OWNER_ISSUE_RESPONDED: 'Statement Dispute Response',
  OWNER_BOOKING_MODE_CHANGED: 'Owner Booking Mode Changed',
  LEXWARE_DRAFT_INVOICE_READY: 'Lexware - Draft Invoice Ready',
  LEXWARE_CONNECTION_NEEDS_ATTENTION: 'Lexware - Connection Needs Attention',
  LEXWARE_TAX_MAPPING_HOLD: 'Lexware - Tax Mapping Required',
  LEXWARE_CREDIT_NOTE_CREATED: 'Lexware - Credit Note Created',
  LEXWARE_NON_EUR_EXCLUDED: 'Lexware - Non-EUR Booking Excluded',
  EMAIL_DOMAIN_VERIFIED: 'Email - Domain Verified',
  EMAIL_DNS_FAILING: 'Email - DNS Verification Failing',
  EMAIL_REPLY_RECEIVED: 'Email - Reply Received',
  GUEST_REGISTRATION_DUE: 'Guest Registration - Report Due',
  GUEST_REGISTRATION_OVERDUE: 'Guest Registration - Report Overdue',
  GUEST_REGISTRATION_SUBMITTED: 'Guest Registration - Report Submitted',
  GUEST_REGISTRATION_FAILED: 'Guest Registration - Submission Failed',
}

export const alertIcons: Record<AlertType, string> = {
  SMART_LOCK_DEAD: 'i-lucide-lock',
  SMART_LOCK_OFFLINE: 'i-lucide-lock',
  SMART_LOCK_CODE_FAILED: 'i-lucide-lock',
  CHANNEL_DISCONNECTED: 'i-lucide-unplug',
  DOUBLE_BOOKING: 'i-lucide-calendar-x',
  CLEANING_NOT_STARTED_IMMINENT: 'i-lucide-spray-can',
  CLEANING_NOT_DONE_CHECKIN_PASSED: 'i-lucide-spray-can',
  STRIPE_DISCONNECTED: 'i-lucide-credit-card',
  DEPOSIT_FAILED_AT_CHECKIN: 'i-lucide-credit-card',
  BOOKING_QUOTA_EMPTY: 'i-lucide-ticket',
  BRIDGE_OFFLINE: 'i-lucide-router',
  SMART_LOCK_BATTERY_CRITICAL: 'i-lucide-lock',
  SMART_LOCK_BATTERY_LOW: 'i-lucide-lock',
  NO_HOUSEKEEPING_ASSIGNED: 'i-lucide-spray-can',
  TASK_OVERDUE: 'i-lucide-clipboard-check',
  RATE_PLAN_UNMAPPED: 'i-lucide-ticket',
  BOOKING_QUOTA_LOW: 'i-lucide-ticket',
  DYNAMIC_TEMPLATE_FAILED: 'i-lucide-message-square-warning',
  WARRANTY_EXPIRING_SOON: 'i-lucide-shield-alert',
  WARRANTY_EXPIRED: 'i-lucide-shield-alert',
  UPSELL_ORDER_REQUESTED: 'i-lucide-shopping-bag',
  UPSELL_ORDER_APPROVED: 'i-lucide-shopping-bag',
  UPSELL_ORDER_DECLINED: 'i-lucide-shopping-bag',
  UPSELL_PAYMENT_RECEIVED: 'i-lucide-shopping-bag',
  UPSELL_FULFILLMENT_STARTED: 'i-lucide-shopping-bag',
  UPSELL_FULFILLMENT_COMPLETED: 'i-lucide-shopping-bag',
  CALL_INCOMING: 'i-lucide-phone-incoming',
  CALL_MISSED: 'i-lucide-phone-missed',
  CALL_COMPLETED: 'i-lucide-phone',
  AIRBNB_REVIEW_GENERATED: 'i-lucide-sparkles',
  AIRBNB_REVIEW_POSTED: 'i-lucide-check-circle-2',
  AIRBNB_REVIEW_FAILED: 'i-lucide-alert-circle',
  REVIEW_GUEST_LEFT: 'i-lucide-star',
  REVIEW_HOST_DUE: 'i-lucide-clock',
  GUEST_GUIDE_NOT_SENT: 'i-lucide-book-open',
  GUEST_GUIDE_OPENED: 'i-lucide-book-open-check',
  GUEST_GUIDE_SUBMITTED: 'i-lucide-book-open-check',
  KEY_NOT_RETURNED: 'i-lucide-key-round',
  GUEST_CHECKED_IN: 'i-lucide-log-in',
  GUEST_CHECKED_OUT: 'i-lucide-log-out',
  GUEST_ARRIVAL_SOON: 'i-lucide-clock-3',
  OWNER_STATEMENT_DRAFT_READY: 'i-lucide-file-text',
  OWNER_STATEMENT_PUBLISHED: 'i-lucide-file-check',
  OWNER_STAY_CONFIRMED: 'i-lucide-calendar-check',
  OWNER_STAY_CONFLICT: 'i-lucide-calendar-x',
  OWNER_ISSUE_RAISED: 'i-lucide-message-square-warning',
  OWNER_USE_CAP_EXCEEDED: 'i-lucide-triangle-alert',
  OWNER_STAY_REQUESTED: 'i-lucide-calendar-clock',
  OWNER_STAY_REJECTED: 'i-lucide-calendar-x-2',
  OWNER_STAY_CANCELLED: 'i-lucide-calendar-off',
  OWNER_STAY_APPROACHING: 'i-lucide-bell-ring',
  DOCUMENT_UPLOADED: 'i-lucide-file-up',
  MAINTENANCE_APPROVAL_REQUESTED: 'i-lucide-wrench',
  MAINTENANCE_COMPLETED: 'i-lucide-circle-check',
  OWNER_LINK_REVOKED: 'i-lucide-shield-x',
  OWNER_CONTRACT_SENT: 'i-lucide-file-signature',
  OWNER_CONTRACT_SIGNED: 'i-lucide-file-check',
  OWNER_ISSUE_RESPONDED: 'i-lucide-message-square-text',
  OWNER_BOOKING_MODE_CHANGED: 'i-lucide-toggle-right',
  LEXWARE_DRAFT_INVOICE_READY: 'i-lucide-file-text',
  LEXWARE_CONNECTION_NEEDS_ATTENTION: 'i-lucide-unplug',
  LEXWARE_TAX_MAPPING_HOLD: 'i-lucide-percent',
  LEXWARE_CREDIT_NOTE_CREATED: 'i-lucide-file-minus-2',
  LEXWARE_NON_EUR_EXCLUDED: 'i-lucide-circle-dollar-sign',
  EMAIL_DOMAIN_VERIFIED: 'i-lucide-mail-check',
  EMAIL_DNS_FAILING: 'i-lucide-triangle-alert',
  EMAIL_REPLY_RECEIVED: 'i-lucide-mail-open',
  GUEST_REGISTRATION_DUE: 'i-lucide-file-clock',
  GUEST_REGISTRATION_OVERDUE: 'i-lucide-alert-octagon',
  GUEST_REGISTRATION_SUBMITTED: 'i-lucide-file-check',
  GUEST_REGISTRATION_FAILED: 'i-lucide-file-x',
}

export const alertRouteMap: Partial<Record<AlertType, string>> = {
  SMART_LOCK_DEAD: '/',
  SMART_LOCK_OFFLINE: '/',
  SMART_LOCK_CODE_FAILED: '/',
  CHANNEL_DISCONNECTED: '/',
  DOUBLE_BOOKING: '/inbox',
  CLEANING_NOT_STARTED_IMMINENT: '/tasks',
  CLEANING_NOT_DONE_CHECKIN_PASSED: '/tasks',
  STRIPE_DISCONNECTED: '/settings/account',
  DEPOSIT_FAILED_AT_CHECKIN: '/inbox',
  BOOKING_QUOTA_EMPTY: '/',
  BRIDGE_OFFLINE: '/',
  SMART_LOCK_BATTERY_CRITICAL: '/',
  SMART_LOCK_BATTERY_LOW: '/',
  NO_HOUSEKEEPING_ASSIGNED: '/tasks',
  TASK_OVERDUE: '/tasks',
  RATE_PLAN_UNMAPPED: '/',
  BOOKING_QUOTA_LOW: '/',
  DYNAMIC_TEMPLATE_FAILED: '/',
  WARRANTY_EXPIRING_SOON: '/inventory',
  WARRANTY_EXPIRED: '/inventory',
  UPSELL_ORDER_REQUESTED: '/upsells?tab=orders',
  UPSELL_ORDER_APPROVED: '/upsells?tab=orders',
  UPSELL_ORDER_DECLINED: '/upsells?tab=orders',
  UPSELL_PAYMENT_RECEIVED: '/upsells?tab=orders',
  UPSELL_FULFILLMENT_STARTED: '/upsells?tab=orders',
  UPSELL_FULFILLMENT_COMPLETED: '/upsells?tab=orders',
  CALL_INCOMING: '/inbox',
  CALL_MISSED: '/inbox',
  CALL_COMPLETED: '/inbox',
  AIRBNB_REVIEW_GENERATED: '/reviews',
  AIRBNB_REVIEW_POSTED: '/reviews',
  AIRBNB_REVIEW_FAILED: '/reviews',
  REVIEW_GUEST_LEFT: '/reviews',
  REVIEW_HOST_DUE: '/reviews',
  GUEST_GUIDE_NOT_SENT: '/guest-guides',
  GUEST_GUIDE_OPENED: '/guest-guides',
  GUEST_GUIDE_SUBMITTED: '/guest-guides',
  KEY_NOT_RETURNED: '/key-management',
  GUEST_CHECKED_IN: '/inbox',
  GUEST_CHECKED_OUT: '/inbox',
  GUEST_ARRIVAL_SOON: '/inbox',
  OWNER_STATEMENT_DRAFT_READY: '/owner-statements',
  OWNER_STATEMENT_PUBLISHED: '/owner-portal/statements',
  OWNER_STAY_CONFIRMED: '/owner-portal/stays',
  OWNER_STAY_CONFLICT: '/owner-portal/stays',
  OWNER_ISSUE_RAISED: '/owner-statements',
  OWNER_USE_CAP_EXCEEDED: '/users',
  OWNER_STAY_REQUESTED: '/cockpit',
  OWNER_STAY_REJECTED: '/owner-portal/stays',
  OWNER_STAY_CANCELLED: '/cockpit',
  OWNER_STAY_APPROACHING: '/owner-portal/stays',
  DOCUMENT_UPLOADED: '/owner-portal/documents',
  MAINTENANCE_APPROVAL_REQUESTED: '/owner-portal/maintenance',
  MAINTENANCE_COMPLETED: '/owner-portal/maintenance',
  OWNER_LINK_REVOKED: '/users',
  OWNER_CONTRACT_SENT: '/owner-portal/contract',
  OWNER_CONTRACT_SIGNED: '/users',
  OWNER_ISSUE_RESPONDED: '/owner-portal/statements',
  OWNER_BOOKING_MODE_CHANGED: '/users',
  LEXWARE_DRAFT_INVOICE_READY: '/finance?tab=integrations',
  LEXWARE_CONNECTION_NEEDS_ATTENTION: '/finance?tab=integrations',
  LEXWARE_TAX_MAPPING_HOLD: '/finance?tab=integrations',
  LEXWARE_CREDIT_NOTE_CREATED: '/finance?tab=integrations',
  LEXWARE_NON_EUR_EXCLUDED: '/finance?tab=integrations',
  EMAIL_DOMAIN_VERIFIED: '/settings/integrations',
  EMAIL_DNS_FAILING: '/settings/integrations',
  EMAIL_REPLY_RECEIVED: '/inbox',
  GUEST_REGISTRATION_DUE: '/guest-registration',
  GUEST_REGISTRATION_OVERDUE: '/guest-registration',
  GUEST_REGISTRATION_SUBMITTED: '/guest-registration',
  GUEST_REGISTRATION_FAILED: '/guest-registration',
}

export function getDescription(type: AlertType, context: Record<string, any>): string {
  switch (type) {
    case 'SMART_LOCK_DEAD':
    case 'SMART_LOCK_OFFLINE':
    case 'SMART_LOCK_BATTERY_CRITICAL':
    case 'SMART_LOCK_BATTERY_LOW':
      return `Lock${context.lock_names?.length ? `s: ${context.lock_names.join(', ')}` : ''}${context.next_checkin_at ? ', next check-in soon' : ''}`
    case 'SMART_LOCK_CODE_FAILED':
      return `${context.guest_name || 'Guest'}, code not generated`
    case 'CHANNEL_DISCONNECTED':
      return `${context.channel_name || 'Channel'}, ${context.affected_listing_names?.length || 0} listing(s) affected`
    case 'DOUBLE_BOOKING':
      return `${context.listing_name || 'Property'}, ${context.reservation_a_guest || 'Guest A'} / ${context.reservation_b_guest || 'Guest B'}`
    case 'CLEANING_NOT_STARTED_IMMINENT':
    case 'CLEANING_NOT_DONE_CHECKIN_PASSED':
      return `${context.listing_name || 'Property'}${context.assigned_to ? `, assigned to ${context.assigned_to}` : ', unassigned'}`
    case 'STRIPE_DISCONNECTED':
      return `${context.pending_payments_count || 0} pending payment(s)`
    case 'DEPOSIT_FAILED_AT_CHECKIN':
      return `${context.guest_name || 'Guest'}, ${context.currency || 'USD'} ${context.deposit_amount || 0}`
    case 'BOOKING_QUOTA_EMPTY':
      return `Auto-refill ${context.auto_refill_failed ? 'failed' : 'attempted'}`
    case 'BRIDGE_OFFLINE':
      return `${context.affected_automations_count || 0} automation(s) affected`
    case 'NO_HOUSEKEEPING_ASSIGNED':
      return `${context.listing_name || 'Property'}, check-out today`
    case 'TASK_OVERDUE':
      return context.task_title || 'Overdue task'
    case 'RATE_PLAN_UNMAPPED':
      return `${context.listing_name || 'Property'}, ${context.unmapped_plans?.length || 0} unmapped plan(s)`
    case 'BOOKING_QUOTA_LOW':
      return `${context.percentage_remaining || 0}% remaining`
    case 'DYNAMIC_TEMPLATE_FAILED':
      return `${context.template_name || 'Template'}, ${context.guest_name || 'Guest'}`
    case 'WARRANTY_EXPIRING_SOON':
      return `${context.itemName} warranty expires on ${context.expiryDate}.`
    case 'WARRANTY_EXPIRED':
      return `${context.itemName} warranty expired on ${context.expiryDate}.`
    case 'UPSELL_ORDER_REQUESTED':
      return `${context.guestName || 'Guest'} requested ${context.serviceName || 'an upsell'}.`
    case 'UPSELL_ORDER_APPROVED':
      return `${context.serviceName || 'Upsell'} approved and payment link sent.`
    case 'UPSELL_ORDER_DECLINED':
      return `${context.serviceName || 'Upsell'} declined.`
    case 'UPSELL_PAYMENT_RECEIVED':
      return `${context.serviceName || 'Upsell'} payment received.`
    case 'UPSELL_FULFILLMENT_STARTED':
      return `${context.serviceName || 'Upsell'} moved to fulfillment.`
    case 'UPSELL_FULFILLMENT_COMPLETED':
      return `${context.serviceName || 'Upsell'} completed.`
    case 'CALL_INCOMING':
      return `${context.guestName || context.callerNumber || 'Unknown'}, ${context.listingName || context.listingId || 'Unknown listing'}${context.duration ? `, ${context.duration}` : ''}`
    case 'CALL_MISSED':
      return `${context.guestName || context.callerNumber || 'Unknown'}, ${context.listingName || context.listingId || 'Unknown listing'}`
    case 'CALL_COMPLETED':
      return `${context.guestName || context.callerNumber || 'Unknown'}, ${context.listingName || context.listingId || 'Unknown listing'}${context.duration ? `, ${context.duration}` : ''}${context.aiSummary ? ` - ${context.aiSummary}` : ''}`
    case 'AIRBNB_REVIEW_GENERATED':
      return `Review for ${context.guestName || 'guest'} at ${context.listingName || 'property'} is ready for approval.`
    case 'AIRBNB_REVIEW_POSTED':
      return `Review for ${context.guestName || 'guest'} at ${context.listingName || 'property'} posted to Airbnb.`
    case 'AIRBNB_REVIEW_FAILED':
      return `Failed to generate review for ${context.guestName || 'guest'} at ${context.listingName || 'property'}.`
    case 'REVIEW_GUEST_LEFT':
      return `${context.guestName || 'Guest'} left a ${context.rating ? `${context.rating}-star ` : ''}review for ${context.listingName || 'property'}.`
    case 'REVIEW_HOST_DUE':
      return `Host review for ${context.guestName || 'guest'} at ${context.listingName || 'property'} is due in ${context.daysRemaining || '?'} days.`
    case 'GUEST_CHECKED_IN':
      return `${context.guest_name || 'Guest'} checked in at ${context.listing_name || 'property'}.`
    case 'GUEST_CHECKED_OUT':
      return `${context.guest_name || 'Guest'} checked out of ${context.listing_name || 'property'}. Housekeeping has been notified.`
    case 'GUEST_ARRIVAL_SOON':
      return `${context.guest_name || 'Guest'} arrives soon at ${context.listing_name || 'property'}.`
    case 'OWNER_STATEMENT_DRAFT_READY':
      return `Owner statement for ${context.period || 'the selected period'} is ready for review.`
    case 'OWNER_STATEMENT_PUBLISHED':
      return `Owner statement for ${context.period || 'the selected period'} is now available.`
    case 'OWNER_STAY_CONFIRMED':
      return `Owner stay${context.modified ? ' updated' : ' confirmed'}${context.checkIn && context.checkOut ? ` for ${context.checkIn} to ${context.checkOut}` : ''}.`
    case 'OWNER_STAY_CONFLICT':
      return `Owner stay request conflicts with ${context.conflicts?.length || 0} existing calendar item(s).`
    case 'OWNER_ISSUE_RAISED':
      return `An issue was raised on owner statement ${context.statementId || 'statement'}.`
    case 'OWNER_USE_CAP_EXCEEDED':
      return `Owner use is projected at ${context.projectedNights ?? 0} nights, above the ${context.cap ?? 0}-night annual cap.`
    case 'OWNER_STAY_REQUESTED':
      return `Owner requested a stay${context.checkIn && context.checkOut ? ` from ${context.checkIn} to ${context.checkOut}` : ''}${context.guestCount ? ` for ${context.guestCount} guests` : ''} — pending your review.`
    case 'OWNER_STAY_REJECTED':
      return `Owner stay${context.checkIn && context.checkOut ? ` for ${context.checkIn} to ${context.checkOut}` : ''} was rejected${context.reason ? `: ${context.reason}` : ''}.`
    case 'OWNER_STAY_CANCELLED':
      return context.requiresApproval
        ? `Owner requested cancellation of a stay — management approval needed.`
        : `Owner stay was cancelled${context.checkIn ? ` (check-in ${context.checkIn})` : ''}.`
    case 'OWNER_STAY_APPROACHING':
      return `Owner stay for ${context.guestName || 'owner'} starts ${context.checkIn || ''} — pre-arrival ops are ready.`
    case 'DOCUMENT_UPLOADED':
      return `A new ${context.category || 'document'} was uploaded${context.documentTitle ? `: ${context.documentTitle}` : ''}${context.version ? ` (v${context.version})` : ''}.`
    case 'MAINTENANCE_APPROVAL_REQUESTED':
      return `${context.title || 'Maintenance'} needs owner approval — estimated cost ${context.currency ?? 'IDR'} ${(context.estimatedCost ?? 0).toLocaleString()}.`
    case 'MAINTENANCE_COMPLETED':
      return `${context.title || 'Maintenance'} completed${context.actualCost !== undefined ? ` — final cost ${(context.actualCost ?? 0).toLocaleString()}` : ''}.`
    case 'OWNER_LINK_REVOKED':
      return `Owner access was revoked for ${context.ownerName || context.ownerId || 'an owner'}.`
    case 'OWNER_CONTRACT_SENT':
      return `Contract sent to the owner for e-signature — portal access unlocks once signed.`
    case 'OWNER_CONTRACT_SIGNED':
      return `${context.signedBy || 'The owner'} signed the management agreement — portal access is now enabled.`
    case 'OWNER_ISSUE_RESPONDED':
      return `${context.author === 'owner' ? 'The owner' : 'Staff'} replied on a statement dispute${context.message ? `: "${context.message}"` : ''}.`
    case 'OWNER_BOOKING_MODE_CHANGED':
      return `Owner self-booking mode was updated.`
    case 'KEY_NOT_RETURNED':
      return `${context.key_label || 'Key'} at ${context.listing_name || 'property'} held by ${context.staff_name || 'staff'} is ${context.overdue_hours ?? '?'}h overdue.`
    case 'LEXWARE_DRAFT_INVOICE_READY':
      return `1 new draft invoice ready for review in Lexware (${context.listing_name || 'property'}, ${context.guest_name || 'guest'}).`
    case 'LEXWARE_CONNECTION_NEEDS_ATTENTION':
      return `${context.failed_reason || 'API key rejected or webhook subscription missing.'} Sync paused.`
    case 'LEXWARE_TAX_MAPPING_HOLD':
      return `1 invoice is waiting on a tax rate mapping decision (${context.listing_name || 'property'}, ${context.guest_name || 'guest'}).`
    case 'LEXWARE_CREDIT_NOTE_CREATED':
      return `A credit note was automatically created in Lexware for a cancelled booking (${context.guest_name || 'guest'}).`
    case 'LEXWARE_NON_EUR_EXCLUDED':
      return `${context.excluded_count || 1} non-EUR booking(s) this week weren't eligible for Lexware export.`
    case 'EMAIL_DOMAIN_VERIFIED':
      return `${context.address || 'Sending address'} verified. New guest email now routes to the Unified Inbox.`
    case 'EMAIL_DNS_FAILING':
      return `${context.address || 'Sending address'} DNS re-check failed — records may have drifted or expired.`
    case 'EMAIL_REPLY_RECEIVED':
      return `${context.guestName || 'Guest'} replied via email${context.subject ? `: “${context.subject}”` : ''}.`
    case 'GUEST_REGISTRATION_DUE':
      return `${context.guest_name || 'Guest'} at ${context.listing_name || 'property'} — ${context.provider === 'apoa' ? 'APOA' : 'AVS Meldeschein'} report due.`
    case 'GUEST_REGISTRATION_OVERDUE':
      return `${context.guest_name || 'Guest'} at ${context.listing_name || 'property'} — ${context.provider === 'apoa' ? 'APOA' : 'AVS Meldeschein'} report overdue (check-in ${context.check_in || '?'}).`
    case 'GUEST_REGISTRATION_SUBMITTED':
      return `${context.guest_name || 'Guest'} at ${context.listing_name || 'property'} — ${context.provider === 'apoa' ? 'APOA' : 'AVS Meldeschein'} report submitted${context.submission_id ? ` (${context.submission_id})` : ''}.`
    case 'GUEST_REGISTRATION_FAILED':
      return `${context.guest_name || 'Guest'} at ${context.listing_name || 'property'} — ${context.provider === 'apoa' ? 'APOA' : 'AVS Meldeschein'} submission failed. ${context.error || ''}`
    default:
      return ''
  }
}

export const mockAlerts: Alert[] = [
  {
    alert_id: 'alert-1',
    type: 'SMART_LOCK_DEAD',
    severity: 'CRITICAL',
    status: 'ACTIVE',
    listing_id: 'listing-villa-1',
    property_id: null,
    triggered_at: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    resolved_at: null,
    auto_resolve: true,
    resolve_condition: 'Battery level returns above 20%',
    context: { lock_ids: ['lock-1', 'lock-2'], lock_names: ['Main Gate', 'Pool Gate'], battery_levels: [0, 2], next_checkin_at: new Date(Date.now() + 1000 * 60 * 60 * 3).toISOString() },
  },
  {
    alert_id: 'alert-2',
    type: 'CLEANING_NOT_STARTED_IMMINENT',
    severity: 'CRITICAL',
    status: 'ACTIVE',
    listing_id: 'listing-villa-2',
    property_id: null,
    triggered_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    resolved_at: null,
    auto_resolve: true,
    resolve_condition: 'Cleaning status changes to In Progress or Completed',
    context: { listing_id: 'listing-villa-2', listing_name: 'Villa Cendana', reservation_id: 'res-2', checkin_at: new Date(Date.now() + 1000 * 60 * 60 * 2).toISOString(), assigned_to: null },
  },
  {
    alert_id: 'alert-3',
    type: 'STRIPE_DISCONNECTED',
    severity: 'CRITICAL',
    status: 'ACTIVE',
    listing_id: null,
    property_id: null,
    triggered_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    resolved_at: null,
    auto_resolve: true,
    resolve_condition: 'Stripe reconnected successfully',
    context: { disconnected_since: new Date(Date.now() - 1000 * 60 * 120).toISOString(), pending_payments_count: 12 },
  },
  {
    alert_id: 'alert-4',
    type: 'TASK_OVERDUE',
    severity: 'WARNING',
    status: 'ACTIVE',
    listing_id: 'listing-villa-1',
    property_id: null,
    triggered_at: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
    resolved_at: null,
    auto_resolve: true,
    resolve_condition: 'Task status changes to Done',
    context: { task_id: 'task-1', task_title: 'Fix pool pump', assigned_to: 'Wayan', due_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), listing_id: 'listing-villa-1', listing_name: 'Villa Kayu' },
  },
  {
    alert_id: 'alert-5',
    type: 'NO_HOUSEKEEPING_ASSIGNED',
    severity: 'WARNING',
    status: 'ACTIVE',
    listing_id: 'listing-villa-3',
    property_id: null,
    triggered_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    resolved_at: null,
    auto_resolve: true,
    resolve_condition: 'A staff member is assigned to the cleaning',
    context: { listing_id: 'listing-villa-3', listing_name: 'Villa Sari', checkout_at: new Date(Date.now() + 1000 * 60 * 60 * 2).toISOString(), next_checkin_at: new Date(Date.now() + 1000 * 60 * 60 * 6).toISOString() },
  },
  {
    alert_id: 'alert-6',
    type: 'SMART_LOCK_BATTERY_LOW',
    severity: 'WARNING',
    status: 'ACTIVE',
    listing_id: 'listing-villa-2',
    property_id: null,
    triggered_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    resolved_at: null,
    auto_resolve: true,
    resolve_condition: 'Battery returns above 20%, or escalates',
    context: { lock_ids: ['lock-3'], lock_names: ['Front Door'], battery_levels: [15], next_checkin_at: new Date(Date.now() + 1000 * 60 * 60 * 48).toISOString() },
  },
  {
    alert_id: 'alert-7',
    type: 'DOUBLE_BOOKING',
    severity: 'CRITICAL',
    status: 'ACTIVE',
    listing_id: 'listing-villa-1',
    property_id: null,
    triggered_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    resolved_at: null,
    auto_resolve: false,
    resolve_condition: 'Host manually resolves',
    context: { listing_id: 'listing-villa-1', listing_name: 'Villa Kayu', reservation_a_id: 'res-a', reservation_a_guest: 'John Doe', reservation_b_id: 'res-b', reservation_b_guest: 'Jane Smith', overlap_start: '2026-05-10T14:00:00Z', overlap_end: '2026-05-12T11:00:00Z' },
  },
  {
    alert_id: 'alert-warranty-001',
    type: 'WARRANTY_EXPIRING_SOON',
    severity: 'WARNING',
    status: 'ACTIVE',
    listing_id: null,
    property_id: null,
    triggered_at: '2026-05-28T08:00:00.000Z',
    resolved_at: null,
    auto_resolve: false,
    resolve_condition: 'Warranty renewed or item replaced',
    context: { itemName: 'Smart TV 55"', expiryDate: 'Jun 10, 2026' },
  },
  {
    alert_id: 'alert-warranty-002',
    type: 'WARRANTY_EXPIRED',
    severity: 'WARNING',
    status: 'ACTIVE',
    listing_id: null,
    property_id: null,
    triggered_at: '2025-11-02T08:00:00.000Z',
    resolved_at: null,
    auto_resolve: false,
    resolve_condition: 'Warranty renewed or item replaced',
    context: { itemName: 'AC Split 1 PK', expiryDate: 'Nov 1, 2025' },
  },
  {
    alert_id: 'alert-call-001',
    type: 'CALL_INCOMING',
    severity: 'INFO',
    status: 'ACTIVE',
    listing_id: 'listing-villa-1',
    property_id: null,
    triggered_at: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
    resolved_at: null,
    auto_resolve: true,
    resolve_condition: 'Call ends',
    context: { guestName: 'John Smith', callerNumber: '+62 812-3456-7890', listingName: 'Villa Kayu', listingId: 'listing-villa-1' },
  },
  {
    alert_id: 'alert-call-002',
    type: 'CALL_MISSED',
    severity: 'WARNING',
    status: 'ACTIVE',
    listing_id: 'listing-villa-2',
    property_id: null,
    triggered_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    resolved_at: null,
    auto_resolve: true,
    resolve_condition: 'Call returned',
    context: { guestName: 'Sarah Johnson', callerNumber: '+61 412-345-678', listingName: 'Villa Cendana', listingId: 'listing-villa-2' },
  },
  {
    alert_id: 'alert-call-003',
    type: 'CALL_COMPLETED',
    severity: 'INFO',
    status: 'ACTIVE',
    listing_id: 'listing-villa-3',
    property_id: null,
    triggered_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    resolved_at: null,
    auto_resolve: true,
    resolve_condition: 'Call ends',
    context: { guestName: 'Michael Tan', callerNumber: '+65 9123-4567', listingName: 'Villa Sari', listingId: 'listing-villa-3', duration: '4m 32s', aiSummary: 'Guest asked about late checkout options and pool heating availability. Confirmed late checkout until 2pm and pool heating is available on request.' },
  },
  {
    alert_id: 'alert-call-004',
    type: 'CALL_MISSED',
    severity: 'WARNING',
    status: 'ACTIVE',
    listing_id: null,
    property_id: null,
    triggered_at: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    resolved_at: null,
    auto_resolve: true,
    resolve_condition: 'Call returned',
    context: { callerNumber: '+81 90-1234-5678' },
  },
  {
    alert_id: 'alert-lexware-001',
    type: 'LEXWARE_DRAFT_INVOICE_READY',
    severity: 'INFO',
    status: 'ACTIVE',
    listing_id: null,
    property_id: null,
    triggered_at: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    resolved_at: null,
    auto_resolve: true,
    resolve_condition: 'Finalized in Lexware',
    context: { listing_name: 'Villa Sehnsucht – Seegrundstück Mecklenburg', guest_name: 'Anna Brunner', invoiceId: 'LS-2026-0043' },
  },
  {
    alert_id: 'alert-lexware-002',
    type: 'LEXWARE_TAX_MAPPING_HOLD',
    severity: 'WARNING',
    status: 'ACTIVE',
    listing_id: null,
    property_id: null,
    triggered_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    resolved_at: null,
    auto_resolve: false,
    resolve_condition: 'Finance remaps the tax rate to 0/7/19',
    context: { listing_name: 'Villa Kunstpause – Kulturhaupstadt Weimar', guest_name: 'Sophia Maier', observed_vat: 16 },
  },
  {
    alert_id: 'alert-lexware-003',
    type: 'LEXWARE_CREDIT_NOTE_CREATED',
    severity: 'INFO',
    status: 'ACTIVE',
    listing_id: null,
    property_id: null,
    triggered_at: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
    resolved_at: null,
    auto_resolve: true,
    resolve_condition: 'Credit note created and acknowledged',
    context: { guest_name: 'Markus Steiner', invoiceId: 'LS-2026-0038', creditNoteId: 'LS-2026-0044' },
  },
  {
    alert_id: 'alert-lexware-004',
    type: 'LEXWARE_NON_EUR_EXCLUDED',
    severity: 'INFO',
    status: 'ACTIVE',
    listing_id: null,
    property_id: null,
    triggered_at: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
    resolved_at: null,
    auto_resolve: true,
    resolve_condition: 'Daily digest is rotated',
    context: { excluded_count: 5, currencies: ['IDR', 'USD'] },
  },
]
