export type StepType
  = | 'trigger'
    | 'wait'
    | 'message'
    | 'context_check'
    | 'action'
    | 'if_else'
    | 'hard_requirement'
    | 'create_note'
    | 'toggle_ai'
    | 'integration'
    | 'end_journey'

export type JourneyStatus = 'active' | 'inactive'

export type TriggerCategory = 'conversation' | 'reservation' | 'calendar' | 'integration'

export type MinutTriggerType =
  | 'minut_noise'
  | 'minut_smoke'
  | 'minut_temperature'
  | 'minut_motion'
  | 'minut_battery'
  | 'minut_tamper'
  | 'minut_connectivity'

export type TriggerType
  = // PRD 15 trigger types (excluding integration minut/turno/tidy)
    | 'conversation_content'
    | 'sentiment_change'
    | 'inquiry_received'
    | 'new_message_received'
    | 'new_booking'
    | 'checkin'
    | 'checkout'
    | 'guest_checkout'
    | 'booking_cancelled'
    | 'send_once'
    | 'gap_nights'
    | 'daily'
    | 'weekly'
    | 'monthly'
    | 'yearly'
  // Minut sensor triggers (7)
    | MinutTriggerType

export type ChannelType = 'ota' | 'whatsapp' | 'email'

export type ActionType
  = | 'create_task'
    | 'flag_reservation'
    | 'staff_alert'
    | 'raise_action_item'
    | 'send_guest_guide'

export type FailBehavior = 'skip' | 'stop'

export type ComparisonOperator = 'gt' | 'eq' | 'lt'

export type BookingChannel = 'airbnb' | 'vrbo' | 'booking' | 'expedia' | 'tripadvisor' | 'agoda' | 'tripcom' | 'hometogo' | 'flipkey' | 'hotels' | 'despegar' | 'google' | 'marriott' | 'whimstay' | 'direct' | 'email'

export type ConditionType
  = | 'custom_criteria'
    | 'guest_no_response'
    | 'reservation_status'
    | 'booking_channel'
    | 'weekday'
    | 'time_of_day'
    | 'days_until_checkin'
    | 'reservation_duration'
    | 'guest_count'
    | 'pet_count'
    | 'child_count'
    | 'infant_count'
    | 'sentiment'
    | 'gap_night_exists'
  // Legacy (kept for backward compatibility)
    | 'length_of_stay'
    | 'number_of_guests'
    | 'booking_lead_time'
    | 'reservation_platform'
    | 'guest_language'
    | 'guest_country'
    | 'time_before_checkin'
    | 'time_after_checkin'
    | 'time_before_checkout'
    | 'time_after_checkout'
    | 'guest_sentiment'
    | 'guest_counts'
    | 'stay_details'
    | 'time_day'
    | 'external_state'
    | 'ai_conversation_check'

export interface ConditionRule {
  id: string
  type: ConditionType
  // Number range (min/max)
  minValue?: number
  maxValue?: number
  // Platform/channel selection
  channels?: BookingChannel[]
  // Text / status
  textValue?: string
  // Sentiment
  targetSentiments?: ('positive' | 'neutral' | 'negative')[]
  // Time range
  timeFrom?: string
  timeTo?: string
  // Gap night
  gapLocation?: 'before_checkin' | 'after_checkout'
}

export type ConditionCombinator = 'and' | 'or'

export interface BaseStep {
  id: string
  type: StepType
  name: string
  /**
   * Transient UI marker. Set to `true` by `buildModifiedJourney` on every step
   * it appends. Drives the "✨ New" badge + highlight in the Review preview and
   * the editor. Always stripped before persistence (see JourneyEditor.handleSave).
   */
  isNew?: boolean
}

export interface TriggerSettings {
  offsetAmount?: number
  offsetUnit?: 'minutes' | 'hours' | 'days'
  offsetDirection?: 'before' | 'at' | 'after'
  dayOfStay?: number
  frequency?: 'daily' | 'weekly' | 'monthly' | 'yearly'
  scheduleTime?: string
  scheduleDate?: string
  keywords?: string
  targetSentiments?: ('positive' | 'neutral' | 'negative')[]
  // sentiment_change specific
  triggerImmediately?: boolean
  delayDays?: number
  delayHours?: number
  delayMinutes?: number
  specificTime?: string
  // send_once specific
  sendImmediately?: boolean
  // weekly / monthly / yearly schedule
  weekDay?: number
  monthDay?: number
  month?: number
  // gap nights
  gapMinNights?: number
  gapMaxNights?: number
  gapLocation?: 'before_reservation' | 'after_reservation'
  // integration trigger (minut etc.)
  triggerOnEvent?: boolean
}

export interface TriggerEntry {
  type: TriggerType
  settings: TriggerSettings
}

export function defaultTriggerSettings(type: TriggerType): TriggerSettings {
  // Conversation-Based
  if (type === 'conversation_content')
    return { keywords: '' }
  if (type === 'sentiment_change')
    return { targetSentiments: ['negative'], triggerImmediately: true, delayDays: 0, delayHours: 0, delayMinutes: 0, specificTime: '' }
  // Conversation-Based & Reservation Events with immediate checkbox + delay
  if (
    [
      'inquiry_received', 'new_message_received', 'new_booking', 'guest_checkout', 'booking_cancelled',
      'minut_noise', 'minut_smoke', 'minut_temperature', 'minut_motion', 'minut_battery', 'minut_tamper', 'minut_connectivity',
    ].includes(type)
  )
    return { triggerImmediately: true, delayDays: 0, delayHours: 0, delayMinutes: 0, specificTime: '' }
  // Check-in / Check-out: before/on/after toggle + delay + optional time
  if (type === 'checkin' || type === 'checkout')
    return { offsetDirection: 'before', offsetAmount: 0, offsetUnit: 'days', specificTime: '' }
  // Calendar-Based
  if (type === 'send_once')
    return { sendImmediately: false, scheduleDate: '', scheduleTime: '09:00' }
  if (type === 'gap_nights')
    return { gapMinNights: 1, gapMaxNights: undefined, gapLocation: 'before_reservation', delayDays: 0, delayHours: 0, delayMinutes: 0, specificTime: '' }
  if (type === 'daily')
    return { scheduleTime: '09:00' }
  if (type === 'weekly')
    return { weekDay: 1, scheduleTime: '09:00' }
  if (type === 'monthly')
    return { monthDay: 1, scheduleTime: '09:00' }
  if (type === 'yearly')
    return { month: 0, monthDay: 1, scheduleTime: '09:00' }
  return {}
}

export interface TriggerStep extends BaseStep {
  type: 'trigger'
  triggers: TriggerEntry[]
  properties: string[]
}

export interface WaitStep extends BaseStep {
  type: 'wait'
  waitMode: 'time_delay' | 'until_condition'
  // Time Delay mode
  durationDays?: number
  durationHours?: number
  durationMinutes?: number
  waitUntilSpecificTime?: boolean
  waitUntilTime?: string
  // Legacy fields (kept for backward compatibility)
  duration?: number
  unit?: 'minutes' | 'hours' | 'days'
  // Until Condition Met mode
  rules?: ConditionRule[]
  combinator?: ConditionCombinator
}

export interface MessageStep extends BaseStep {
  type: 'message'
  messageMode: 'template' | 'directive'
  channel: ChannelType
  templateText: string
  directive: string
  contextCheckEnabled: boolean
  contextCheckInstruction: string
  fallback: 'skip' | 'static'
  fallbackText: string
  // Smart Template extras
  aiPersonalization?: boolean
  discountPercent?: number
  discountAbsolute?: number
  // WhatsApp Template Studio
  whatsappTemplateId?: string
}

export interface ContextCheckStep extends BaseStep {
  type: 'context_check'
  condition: string
  onFail: FailBehavior
}

export interface ActionStep extends BaseStep {
  type: 'action'
  actionType: ActionType
  details: string
}

export interface IfElseStep extends BaseStep {
  type: 'if_else'
  conditionType: ConditionType
  conditionDetails: string
  rules?: ConditionRule[]
  combinator?: ConditionCombinator
  trueBranchLabel: string
  falseBranchLabel: string
  trueBranchStep?: Record<string, any>
  falseBranchStep?: Record<string, any>
}

export interface HardRequirementStep extends BaseStep {
  type: 'hard_requirement'
  conditionType: ConditionType
  conditionDetails: string
  rules?: ConditionRule[]
  combinator?: ConditionCombinator
}

export interface CreateNoteStep extends BaseStep {
  type: 'create_note'
  noteContent: string
  visibleToAI: boolean
}

export interface ToggleAIStep extends BaseStep {
  type: 'toggle_ai'
  enable: boolean
  duration: 'indefinite' | 'specific'
  days?: number
  hours?: number
  minutes?: number
}

export interface IntegrationStep extends BaseStep {
  type: 'integration'
  integrationName: string
  payload: string
}

export interface EndJourneyStep extends BaseStep {
  type: 'end_journey'
}

export type JourneyStep
  = | TriggerStep
    | WaitStep
    | MessageStep
    | ContextCheckStep
    | ActionStep
    | IfElseStep
    | HardRequirementStep
    | CreateNoteStep
    | ToggleAIStep
    | IntegrationStep
    | EndJourneyStep

export interface Journey {
  id: string
  name: string
  status: JourneyStatus
  triggerType: string
  lastModified: string
  properties: string[]
  steps: JourneyStep[]
  requirements?: ConditionRule[]
  requirementCombinator?: ConditionCombinator
}

export type TemplateCategory = 'Upsells' | 'Guided Stays' | 'Objective-Based'
export type TemplateDifficulty = 'Beginner' | 'Intermediate' | 'Advanced'

export interface JourneyTemplateMeta {
  templateName: string
  description: string
  category: TemplateCategory
  difficulty: TemplateDifficulty
  estimatedImpact?: string
  tags: string[]
  makePublic: boolean
}

export interface MarketplaceTemplate {
  id: string
  name: string
  description: string
  category: 'Guided Stays' | 'Revenue' | 'Verification' | 'Community'
  stepCount: number
  steps: JourneyStep[]
}

export const triggerMeta: Record<string, { label: string, category: TriggerCategory }> = {
  conversation_content: { label: 'Conversational Trigger', category: 'conversation' },
  sentiment_change: { label: 'Sentiment Trigger', category: 'conversation' },
  inquiry_received: { label: 'Inquiry Received', category: 'reservation' },
  new_message_received: { label: 'Host Message Received', category: 'reservation' },
  new_booking: { label: 'New Booking', category: 'reservation' },
  checkin: { label: 'Check-in Day', category: 'reservation' },
  checkout: { label: 'Check-out Day', category: 'reservation' },
  guest_checkout: { label: 'Guest Check-out', category: 'reservation' },
  booking_cancelled: { label: 'Cancellation', category: 'reservation' },
  send_once: { label: 'Send Once', category: 'calendar' },
  gap_nights: { label: 'Gap Nights', category: 'calendar' },
  daily: { label: 'Daily', category: 'calendar' },
  weekly: { label: 'Weekly', category: 'calendar' },
  monthly: { label: 'Monthly', category: 'calendar' },
  yearly: { label: 'Yearly', category: 'calendar' },
  minut_noise: { label: 'Minut Noise Event', category: 'integration' },
  minut_smoke: { label: 'Minut Smoke Alarm', category: 'integration' },
  minut_temperature: { label: 'Minut Temperature Event', category: 'integration' },
  minut_motion: { label: 'Minut Motion Event', category: 'integration' },
  minut_battery: { label: 'Minut Battery Low', category: 'integration' },
  minut_tamper: { label: 'Minut Tamper Event', category: 'integration' },
  minut_connectivity: { label: 'Minut Device Offline', category: 'integration' },
}

export const bookingChannelMeta: Record<BookingChannel, string> = {
  airbnb: 'Airbnb',
  vrbo: 'Vrbo',
  booking: 'Booking.com',
  expedia: 'Expedia',
  tripadvisor: 'TripAdvisor',
  agoda: 'Agoda',
  tripcom: 'Trip.com',
  hometogo: 'HomeToGo',
  flipkey: 'FlipKey',
  hotels: 'Hotels.com',
  despegar: 'Despegar',
  google: 'Google',
  marriott: 'Marriott Homes and Villas',
  whimstay: 'Whimstay',
  direct: 'Direct',
  email: 'Email',
}

export const conditionMeta: Record<ConditionType, string> = {
  custom_criteria: 'Custom Criteria',
  guest_no_response: 'Guest has not responded to last message',
  reservation_status: 'Reservation status is...',
  booking_channel: 'Booking channel is...',
  weekday: 'Weekday is...',
  time_of_day: 'Time of day is...',
  days_until_checkin: 'Days until check-in is...',
  reservation_duration: 'Reservation duration is...',
  guest_count: 'Guest count is...',
  pet_count: 'Pet count is...',
  child_count: 'Child count is...',
  infant_count: 'Infant count is...',
  sentiment: 'Sentiment is...',
  gap_night_exists: 'Gap night exists...',
  // legacy
  length_of_stay: 'Length of Stay',
  number_of_guests: 'Number of Guests',
  booking_lead_time: 'Booking Lead Time',
  reservation_platform: 'Reservation Platform',
  guest_language: 'Guest Language',
  guest_country: 'Guest Country',
  time_before_checkin: 'Time Before Check-in',
  time_after_checkin: 'Time After Check-in',
  time_before_checkout: 'Time Before Check-out',
  time_after_checkout: 'Time After Check-out',
  guest_sentiment: 'Guest Sentiment',
  guest_counts: 'Guest Counts',
  stay_details: 'Stay Details',
  time_day: 'Time & Day',
  external_state: 'External State',
  ai_conversation_check: 'AI Conversation Check',
}

export const primaryConditionTypes: ConditionType[] = [
  'custom_criteria',
  'guest_no_response',
  'reservation_status',
  'booking_channel',
  'weekday',
  'time_of_day',
  'days_until_checkin',
  'reservation_duration',
  'guest_count',
  'pet_count',
  'child_count',
  'infant_count',
  'sentiment',
  'gap_night_exists',
]

export const legacyConditionTypes: ConditionType[] = [
  'length_of_stay',
  'number_of_guests',
  'booking_lead_time',
  'reservation_platform',
  'guest_language',
  'guest_country',
  'time_before_checkin',
  'time_after_checkin',
  'time_before_checkout',
  'time_after_checkout',
  'guest_sentiment',
  'guest_counts',
  'stay_details',
  'time_day',
  'external_state',
  'ai_conversation_check',
]

export function makeConditionRule(type: ConditionType): ConditionRule {
  const base: ConditionRule = { id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, type }
  // Number range types (7-12)
  if (['days_until_checkin', 'reservation_duration', 'guest_count', 'pet_count', 'child_count', 'infant_count'].includes(type))
    return { ...base, minValue: 0, maxValue: undefined }
  // Booking channel
  if (type === 'booking_channel')
    return { ...base, channels: ['airbnb'] }
  // Sentiment
  if (type === 'sentiment')
    return { ...base, targetSentiments: ['positive'] }
  // Weekday
  if (type === 'weekday')
    return { ...base, textValue: '' }
  // Time of day
  if (type === 'time_of_day')
    return { ...base, timeFrom: '09:00', timeTo: '17:00' }
  // Reservation status
  if (type === 'reservation_status')
    return { ...base, textValue: '' }
  // Gap night
  if (type === 'gap_night_exists')
    return { ...base, gapLocation: 'before_checkin', minValue: 1, maxValue: undefined }
  return { ...base, textValue: '' }
}

export interface JourneyGroup {
  id: string
  name: string
  journeyIds: string[]
  collapsed: boolean
}

export const mockGroups: JourneyGroup[] = [
  { id: 'g-1', name: 'Guest Experience', journeyIds: ['j-1', 'j-2'], collapsed: false },
  { id: 'g-2', name: 'Revenue', journeyIds: ['j-3'], collapsed: false },
]

export const mockJourneys: Journey[] = [
  {
    id: 'j-1',
    name: 'Guest Welcome & Stay Flow',
    status: 'active',
    triggerType: 'new_booking',
    lastModified: '2026-05-10',
    properties: ['All Properties'],
    steps: [
      {
        id: 's-1-1',
        type: 'trigger',
        name: 'New Booking',
        triggers: [{ type: 'new_booking', settings: {} }],
        properties: ['All Properties'],
      },
      {
        id: 's-1-2',
        type: 'message',
        name: 'Send Welcome Message',
        messageMode: 'directive',
        channel: 'ota',
        templateText: '',
        directive: 'Welcome the guest warmly, confirm their booking details, and express excitement about hosting them. Mention the property highlights.',
        contextCheckEnabled: false,
        contextCheckInstruction: '',
        fallback: 'skip',
        fallbackText: '',
      },
      {
        id: 's-1-3',
        type: 'wait',
        name: 'Wait Until 2 Days Before',
        waitMode: 'time_delay',
        durationDays: 2,
        durationHours: 0,
        durationMinutes: 0,
      },
      {
        id: 's-1-4',
        type: 'message',
        name: 'Send Check-in Details',
        messageMode: 'directive',
        channel: 'whatsapp',
        templateText: '',
        directive: 'Share precise check-in instructions: door code, parking info, and a local area guide. Ask if the guest has any questions.',
        contextCheckEnabled: true,
        contextCheckInstruction: 'Do not send if the guest has already received check-in instructions.',
        fallback: 'static',
        fallbackText: 'Hi! Here are your check-in details. Please reach out if you need anything.',
      },
      {
        id: 's-1-5',
        type: 'message',
        name: 'Mid-stay Check-in',
        messageMode: 'directive',
        channel: 'whatsapp',
        templateText: '',
        directive: 'Check in on the guest halfway through their stay. Ask if everything is comfortable and if they need any recommendations.',
        contextCheckEnabled: false,
        contextCheckInstruction: '',
        fallback: 'skip',
        fallbackText: '',
      },
    ],
  },
  {
    id: 'j-2',
    name: 'Pre-Arrival Check-In Guide',
    status: 'active',
    triggerType: 'checkin',
    lastModified: '2026-05-14',
    properties: ['Swiss Properties'],
    steps: [
      {
        id: 's-2-1',
        type: 'trigger',
        name: 'Check-in',
        triggers: [{ type: 'checkin', settings: { offsetDirection: 'before', offsetAmount: 3, offsetUnit: 'days' } }],
        properties: ['Swiss Properties'],
      },
      {
        id: 's-2-2',
        type: 'context_check',
        name: 'Check-in Details Already Sent?',
        condition: 'Has the guest already received check-in instructions in the last 7 days?',
        onFail: 'skip',
      },
      {
        id: 's-2-3',
        type: 'message',
        name: 'Send Arrival Instructions',
        messageMode: 'directive',
        channel: 'email',
        templateText: '',
        directive: 'Send a comprehensive pre-arrival guide: smart lock code, parking coordinates, public transport options from the airport, and local emergency contacts.',
        contextCheckEnabled: false,
        contextCheckInstruction: '',
        fallback: 'skip',
        fallbackText: '',
      },
    ],
  },
  {
    id: 'j-3',
    name: 'Gap Night Opportunity',
    status: 'inactive',
    triggerType: 'gap_nights',
    lastModified: '2026-04-28',
    properties: ['All Properties'],
    steps: [
      {
        id: 's-3-1',
        type: 'trigger',
        name: 'Gap Nights',
        triggers: [{ type: 'gap_nights', settings: {} }],
        properties: ['All Properties'],
      },
      {
        id: 's-3-2',
        type: 'action',
        name: 'Flag for Revenue Review',
        actionType: 'flag_reservation',
        details: 'Flag the gap night on the reservation for the revenue team to review pricing opportunities.',
      },
      {
        id: 's-3-3',
        type: 'message',
        name: 'Offer Gap Night to Current Guest',
        messageMode: 'directive',
        channel: 'whatsapp',
        templateText: '',
        directive: 'Offer the departing guest the opportunity to extend their stay at a special discounted rate for the gap night. Highlight the convenience of not having to pack and move.',
        contextCheckEnabled: true,
        contextCheckInstruction: 'Do not send if the guest has already been offered an extension.',
        fallback: 'skip',
        fallbackText: '',
      },
      {
        id: 's-3-4',
        type: 'message',
        name: 'Offer to Incoming Guest',
        messageMode: 'directive',
        channel: 'ota',
        templateText: '',
        directive: 'Contact the incoming guest and offer them early check-in on the gap night for a small fee. Mention the benefit of settling in early.',
        contextCheckEnabled: false,
        contextCheckInstruction: '',
        fallback: 'skip',
        fallbackText: '',
      },
    ],
  },
  {
    id: 'j-4',
    name: 'Post-Stay Review Request',
    status: 'inactive',
    triggerType: 'checkout',
    lastModified: '2026-05-18',
    properties: ['All Properties'],
    steps: [
      {
        id: 's-4-1',
        type: 'trigger',
        name: 'Check-out',
        triggers: [{ type: 'checkout', settings: {} }],
        properties: ['All Properties'],
      },
      {
        id: 's-4-2',
        type: 'wait',
        name: 'Wait 1 Day',
        waitMode: 'time_delay',
        durationDays: 1,
        durationHours: 0,
        durationMinutes: 0,
      },
      {
        id: 's-4-3',
        type: 'hard_requirement',
        name: 'Positive Sentiment Only',
        conditionType: 'guest_sentiment',
        conditionDetails: 'Only proceed if overall guest sentiment was Positive or Neutral throughout the stay.',
      },
      {
        id: 's-4-4',
        type: 'message',
        name: 'Request Review',
        messageMode: 'directive',
        channel: 'ota',
        templateText: '',
        directive: 'Thank the guest sincerely for their stay and kindly request a review. Personalise with a detail from their trip if context is available.',
        contextCheckEnabled: false,
        contextCheckInstruction: '',
        fallback: 'skip',
        fallbackText: '',
      },
    ],
  },
]

export const marketplaceTemplates: MarketplaceTemplate[] = [
  {
    id: 'mt-1',
    name: 'Complete Guided Stay',
    description: 'Full guest journey from booking to review with mid-stay check-in, upsell opportunities, and a review request.',
    category: 'Guided Stays',
    stepCount: 7,
    steps: [
      {
        id: 'mt1-s1',
        type: 'trigger',
        name: 'New Booking',
        triggers: [{ type: 'new_booking', settings: {} }],
        properties: ['All Properties'],
      },
      {
        id: 'mt1-s2',
        type: 'message',
        name: 'Welcome Message',
        messageMode: 'directive',
        channel: 'ota',
        templateText: '',
        directive: 'Send a warm welcome with booking confirmation and property highlights.',
        contextCheckEnabled: false,
        contextCheckInstruction: '',
        fallback: 'skip',
        fallbackText: '',
      },
      {
        id: 'mt1-s3',
        type: 'wait',
        name: 'Wait Until 3 Days Before',
        waitMode: 'time_delay',
        durationDays: 3,
        durationHours: 0,
        durationMinutes: 0,
      },
      {
        id: 'mt1-s4',
        type: 'message',
        name: 'Pre-Arrival Guide',
        messageMode: 'directive',
        channel: 'whatsapp',
        templateText: '',
        directive: 'Send check-in instructions, door code, parking info, and local recommendations.',
        contextCheckEnabled: true,
        contextCheckInstruction: 'Do not send if check-in details were already shared.',
        fallback: 'static',
        fallbackText: 'Your check-in details are ready. Contact us for the access code.',
      },
      {
        id: 'mt1-s5',
        type: 'message',
        name: 'Mid-Stay Upsell',
        messageMode: 'directive',
        channel: 'whatsapp',
        templateText: '',
        directive: 'Check on the guest and offer optional upsells: late checkout, airport transfer, or local experiences.',
        contextCheckEnabled: true,
        contextCheckInstruction: 'Do not send if the guest has expressed dissatisfaction.',
        fallback: 'skip',
        fallbackText: '',
      },
      {
        id: 'mt1-s6',
        type: 'wait',
        name: 'Wait Until After Checkout',
        waitMode: 'time_delay',
        durationDays: 1,
        durationHours: 0,
        durationMinutes: 0,
      },
      {
        id: 'mt1-s7',
        type: 'message',
        name: 'Review Request',
        messageMode: 'directive',
        channel: 'ota',
        templateText: '',
        directive: 'Thank the guest for their stay and kindly request a review. Mention that their feedback helps improve future experiences.',
        contextCheckEnabled: false,
        contextCheckInstruction: '',
        fallback: 'skip',
        fallbackText: '',
      },
    ],
  },
  {
    id: 'mt-2',
    name: 'Gap Night Revenue Booster',
    description: 'Automatically detect gap nights and offer extensions to existing guests or early check-in to incoming guests.',
    category: 'Revenue',
    stepCount: 4,
    steps: [
      {
        id: 'mt2-s1',
        type: 'trigger',
        name: 'Gap Nights',
        triggers: [{ type: 'gap_nights', settings: {} }],
        properties: ['All Properties'],
      },
      {
        id: 'mt2-s2',
        type: 'action',
        name: 'Alert Revenue Team',
        actionType: 'staff_alert',
        details: 'Send a staff alert to the revenue team with gap night details and suggested pricing.',
      },
      {
        id: 'mt2-s3',
        type: 'message',
        name: 'Offer to Current Guest',
        messageMode: 'directive',
        channel: 'whatsapp',
        templateText: '',
        directive: 'Offer the departing guest a discounted extra night. Emphasize convenience of not moving.',
        contextCheckEnabled: false,
        contextCheckInstruction: '',
        fallback: 'skip',
        fallbackText: '',
      },
      {
        id: 'mt2-s4',
        type: 'message',
        name: 'Early Check-in Offer',
        messageMode: 'directive',
        channel: 'ota',
        templateText: '',
        directive: 'Offer the arriving guest early check-in on the gap night for a discounted fee.',
        contextCheckEnabled: false,
        contextCheckInstruction: '',
        fallback: 'skip',
        fallbackText: '',
      },
    ],
  },
  {
    id: 'mt-3',
    name: 'New Guest Verification Flow',
    description: 'Automatically verify new guests with ID and deposit checks before confirming access details.',
    category: 'Verification',
    stepCount: 6,
    steps: [
      {
        id: 'mt3-s1',
        type: 'trigger',
        name: 'New Booking',
        triggers: [{ type: 'new_booking', settings: {} }],
        properties: ['All Properties'],
      },
      {
        id: 'mt3-s2',
        type: 'hard_requirement',
        name: 'New Guest Only',
        conditionType: 'reservation_status',
        conditionDetails: 'Only proceed if this guest has not stayed before (first-time guest).',
      },
      {
        id: 'mt3-s3',
        type: 'message',
        name: 'Request ID Verification',
        messageMode: 'directive',
        channel: 'email',
        templateText: '',
        directive: 'Politely request the guest to complete ID verification via the provided link. Explain it is required for all new guests.',
        contextCheckEnabled: false,
        contextCheckInstruction: '',
        fallback: 'skip',
        fallbackText: '',
      },
      {
        id: 'mt3-s4',
        type: 'wait',
        name: 'Wait 48h Before Check-in',
        waitMode: 'time_delay',
        durationDays: 0,
        durationHours: 48,
        durationMinutes: 0,
      },
      {
        id: 'mt3-s5',
        type: 'action',
        name: 'Flag if Unverified',
        actionType: 'flag_reservation',
        details: 'Flag the reservation for manual review if the guest has not verified their ID 48 hours before check-in.',
      },
      {
        id: 'mt3-s6',
        type: 'message',
        name: 'Verification Reminder',
        messageMode: 'directive',
        channel: 'whatsapp',
        templateText: '',
        directive: 'Send a friendly reminder that ID verification is still pending and needed to receive check-in details.',
        contextCheckEnabled: false,
        contextCheckInstruction: '',
        fallback: 'skip',
        fallbackText: '',
      },
    ],
  },
  {
    id: 'mt-4',
    name: 'Local Community Welcome',
    description: 'Share local tips, community events, and sustainability guidelines with guests after check-in.',
    category: 'Community',
    stepCount: 4,
    steps: [
      {
        id: 'mt4-s1',
        type: 'trigger',
        name: 'After Check-in',
        triggers: [{ type: 'checkin', settings: { offsetDirection: 'after', offsetAmount: 2, offsetUnit: 'hours' } }],
        properties: ['All Properties'],
      },
      {
        id: 'mt4-s2',
        type: 'wait',
        name: 'Wait 2 Hours',
        waitMode: 'time_delay',
        durationDays: 0,
        durationHours: 2,
        durationMinutes: 0,
      },
      {
        id: 'mt4-s3',
        type: 'message',
        name: 'Community & Local Tips',
        messageMode: 'directive',
        channel: 'whatsapp',
        templateText: '',
        directive: 'Share a curated list of local restaurants, markets, and community events. Include sustainability guidelines for the property and area.',
        contextCheckEnabled: false,
        contextCheckInstruction: '',
        fallback: 'skip',
        fallbackText: '',
      },
      {
        id: 'mt4-s4',
        type: 'create_note',
        name: 'Log Community Guide Sent',
        noteContent: 'Community welcome guide sent to guest after check-in.',
        visibleToAI: true,
      },
    ],
  },
  {
    id: 'mkt-send-guide-on-booking',
    name: 'Booking Confirmed — Send Guide',
    description: 'Auto-send guest guide link immediately after a new booking',
    category: 'Guided Stays',
    stepCount: 5,
    steps: [
      {
        id: 'mkt-gg1-s1',
        type: 'trigger',
        name: 'New Booking',
        triggers: [{ type: 'new_booking', settings: { triggerImmediately: true } }],
        properties: ['All Properties'],
      },
      {
        id: 'mkt-gg1-s2',
        type: 'action',
        name: 'Send Guest Guide',
        actionType: 'send_guest_guide',
        details: '',
      },
      {
        id: 'mkt-gg1-s3',
        type: 'wait',
        name: 'Wait 5 Minutes',
        waitMode: 'time_delay',
        durationDays: 0,
        durationHours: 0,
        durationMinutes: 5,
      },
      {
        id: 'mkt-gg1-s4',
        type: 'message',
        name: 'Send Booking Confirmation',
        messageMode: 'template',
        channel: 'whatsapp',
        templateText: 'Hi {{guest_name}}, your stay at {{property_name}} from {{check_in_date}} to {{check_out_date}} is confirmed! Please complete your pre-arrival info here: {{guide_link}}',
        directive: '',
        contextCheckEnabled: false,
        contextCheckInstruction: '',
        fallback: 'skip',
        fallbackText: '',
      },
      {
        id: 'mkt-gg1-s5',
        type: 'create_note',
        name: 'Log Guide Sent',
        noteContent: 'Guest guide link sent automatically after booking confirmation.',
        visibleToAI: false,
      },
    ],
  },
  {
    id: 'mkt-guide-reminder-7d',
    name: 'Pre-Arrival Reminder — 7 days',
    description: 'Send guest guide reminder 7 days before check-in',
    category: 'Guided Stays',
    stepCount: 2,
    steps: [
      {
        id: 'mkt-gg7d-s1',
        type: 'trigger',
        name: '7 Days Before Check-in',
        triggers: [{ type: 'checkin', settings: { offsetDirection: 'before', offsetAmount: 7, offsetUnit: 'days' } }],
        properties: ['All Properties'],
      },
      {
        id: 'mkt-gg7d-s2',
        type: 'message',
        name: 'Send Guide Reminder',
        messageMode: 'template',
        channel: 'whatsapp',
        templateText: 'Hi {{guest_name}}, your check-in at {{property_name}} is in 7 days. Here\'s your guide: {{guide_link}}',
        directive: '',
        contextCheckEnabled: true,
        contextCheckInstruction: 'Do not send if the guest has already opened the guide link in the past 24 hours.',
        fallback: 'skip',
        fallbackText: '',
      },
    ],
  },
  {
    id: 'mkt-guide-reminder-24h',
    name: 'Pre-Arrival Reminder — 24h',
    description: 'Send guest guide reminder 24 hours before check-in',
    category: 'Guided Stays',
    stepCount: 2,
    steps: [
      {
        id: 'mkt-gg24h-s1',
        type: 'trigger',
        name: '24 Hours Before Check-in',
        triggers: [{ type: 'checkin', settings: { offsetDirection: 'before', offsetAmount: 24, offsetUnit: 'hours' } }],
        properties: ['All Properties'],
      },
      {
        id: 'mkt-gg24h-s2',
        type: 'message',
        name: 'Send Final Guide Reminder',
        messageMode: 'template',
        channel: 'whatsapp',
        templateText: 'Hi {{guest_name}}, your check-in at {{property_name}} is tomorrow! Tap here for full details: {{guide_link}}',
        directive: '',
        contextCheckEnabled: true,
        contextCheckInstruction: 'Do not send if the guest has already opened the guide link in the past 6 hours.',
        fallback: 'skip',
        fallbackText: '',
      },
    ],
  },
]

/**
 * Produces a modified version of an existing journey in response to a free-form
 * prompt. Preserves every metadata field of the original (id, name, status,
 * triggerType, properties, requirements, requirementCombinator) and only
 * appends AI-suggested steps based on simple keyword matching. Existing step
 * ids are kept intact so any in-editor selection stays bound.
 *
 * Returns the same `Journey & { aiReasoning, stats }` shape as
 * `generatedJourneyExample` so `JourneyBuilderReview` can render the AI
 * reasoning and stats panels without mode-specific branching.
 */
export function buildModifiedJourney(
  original: Journey,
  prompt: string,
): Journey & {
  aiReasoning: string
  stats: { messages: number, contextChecks: number, estimatedTime: string }
} {
  const cloned: Journey = JSON.parse(JSON.stringify(original))
  const lc = prompt.toLowerCase()
  const added: JourneyStep[] = []

  const hasStepLike = (substr: string) =>
    cloned.steps.some(s => s.name.toLowerCase().includes(substr))

  if (/(upsell|mid[\s-]?stay|extend)/.test(lc)
    && !hasStepLike('upsell')
    && !hasStepLike('mid-stay')) {
    added.push(
      {
        id: `s-${Date.now()}-a`,
        type: 'wait',
        name: 'Wait',
        waitMode: 'time_delay',
        durationDays: 2,
        durationHours: 0,
        durationMinutes: 0,
        isNew: true,
      },
      {
        id: `s-${Date.now()}-b`,
        type: 'message',
        name: 'Send Message',
        messageMode: 'directive',
        channel: 'whatsapp',
        templateText: '',
        directive: 'Check in on the guest and offer optional upsells: late checkout, airport transfer, or local experiences.',
        contextCheckEnabled: true,
        contextCheckInstruction: 'Do not send if the guest has expressed dissatisfaction.',
        fallback: 'skip',
        fallbackText: '',
        isNew: true,
      },
    )
  }

  if (/(review|feedback)/.test(lc) && !hasStepLike('review')) {
    added.push(
      {
        id: `s-${Date.now()}-c`,
        type: 'wait',
        name: 'Wait',
        waitMode: 'time_delay',
        durationDays: 1,
        durationHours: 0,
        durationMinutes: 0,
        isNew: true,
      },
      {
        id: `s-${Date.now()}-d`,
        type: 'message',
        name: 'Send Message',
        messageMode: 'directive',
        channel: 'ota',
        templateText: '',
        directive: 'Thank the guest sincerely for their stay and kindly request a review.',
        contextCheckEnabled: false,
        contextCheckInstruction: '',
        fallback: 'skip',
        fallbackText: '',
        isNew: true,
      },
    )
  }

  const steps = [...cloned.steps, ...added]

  const messages = steps.filter(s => s.type === 'message').length
  const contextChecks = steps.filter(s => s.type === 'context_check').length
  const totalDays = steps
    .filter(s => s.type === 'wait')
    .reduce((sum, s) => sum + ((s as WaitStep).durationDays ?? 0), 0)

  return {
    ...cloned,
    steps,
    aiReasoning: `I kept ${cloned.steps.length} existing step${cloned.steps.length === 1 ? '' : 's'} and added ${added.length} new step${added.length === 1 ? '' : 's'} based on your prompt: "${prompt}". Existing trigger, properties, and requirements were preserved.`,
    stats: { messages, contextChecks, estimatedTime: `${totalDays} days` },
  }
}

export const generatedJourneyExample: Journey & {
  aiReasoning: string
  stats: { messages: number, contextChecks: number, estimatedTime: string }
} = {
  id: 'ai-generated-1',
  name: 'AI Generated Journey',
  status: 'draft',
  triggerType: 'new_booking',
  lastModified: new Date().toISOString().split('T')[0],
  properties: ['All Properties'],
  aiReasoning:
    'I structured this journey with three key communication moments: an immediate welcome at booking to set the tone, a pre-arrival message timed 2 days before check-in for maximum relevance, and a post-checkout review request after the guest has settled. I added a context check before the check-in details step to avoid re-sending information if it was already shared through another channel, keeping the experience clean and non-repetitive.',
  stats: {
    messages: 3,
    contextChecks: 1,
    estimatedTime: '14 days',
  },
  steps: [
    {
      id: 'ai-s1',
      type: 'trigger',
      name: 'New Booking',
      triggers: [{ type: 'new_booking', settings: {} }],
      properties: ['All Properties'],
    },
    {
      id: 'ai-s2',
      type: 'message',
      name: 'Welcome Message',
      messageMode: 'directive',
      channel: 'ota',
      templateText: '',
      directive: 'Send a warm, personalized welcome message confirming the booking. Express excitement about hosting them and highlight the best features of the property.',
      contextCheckEnabled: false,
      contextCheckInstruction: '',
      fallback: 'skip',
      fallbackText: '',
    },
    {
      id: 'ai-s3',
      type: 'wait',
      name: 'Wait Until 2 Days Before Check-in',
      waitMode: 'time_delay',
      durationDays: 2,
      durationHours: 0,
      durationMinutes: 0,
    },
    {
      id: 'ai-s4',
      type: 'context_check',
      name: 'Check-in Info Already Sent?',
      condition: 'Has the guest already received check-in instructions or access details in the past 5 days?',
      onFail: 'skip',
    },
    {
      id: 'ai-s5',
      type: 'message',
      name: 'Check-in Details',
      messageMode: 'directive',
      channel: 'whatsapp',
      templateText: '',
      directive: 'Share complete check-in details: exact address, access code or key location, parking instructions, WiFi credentials, and a welcome guide with house rules and local tips.',
      contextCheckEnabled: false,
      contextCheckInstruction: '',
      fallback: 'static',
      fallbackText: 'Here are your check-in details! Please contact us directly if you have any questions.',
    },
    {
      id: 'ai-s6',
      type: 'message',
      name: 'Post-Stay Review Request',
      messageMode: 'directive',
      channel: 'ota',
      templateText: '',
      directive: 'Thank the guest sincerely for their stay. Mention a specific detail about their trip if available. Kindly request a review and let them know you look forward to hosting them again.',
      contextCheckEnabled: false,
      contextCheckInstruction: '',
      fallback: 'skip',
      fallbackText: '',
    },
  ],
}
