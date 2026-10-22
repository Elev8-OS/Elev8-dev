/**
 * What the connect wizard asks for, per channel, and the pure rules that decide
 * when each step is done. Mock only, shaped like NextPax
 * (`docs/claude/nextpax-channels.md`): the real setting definitions, photo
 * minimums and payment codes arrive from the backend at runtime.
 * Imports only from sibling data files, so anything can import it without a cycle.
 */
import type { NextPaxSettingDefinition } from './nextpax-mock'
import { nextPaxCode } from './nextpax'
import { NEXTPAX_SETTING_DEFINITIONS, prettySettingName } from './nextpax-mock'

/**
 * How the host proves the channel account is theirs.
 * - `settings`: the account form is enough (Booking.com, Expedia, Agoda, ...).
 * - `link`: Elev8 prepares a sign-in link and the host opens it (Airbnb).
 * - `sso`: advertiser id, then the channel's own sign-in, then confirm mapping (Vrbo).
 */
export type SignInMethod = 'settings' | 'link' | 'sso'

/** The ids a channel asks for when a listing already runs there. */
export interface LinkIdLabels {
  property: string
  room?: string
  host?: string
}

export interface ChannelSetupSpec {
  channel: string
  signIn: SignInMethod
  /** Account form. Settings with `availableOnPropertyLevel` can also differ per listing in step 3. */
  settings: NextPaxSettingDefinition[]
  /** Null: the channel cannot attach to an existing listing, every listing is created new. */
  linkIds: LinkIdLabels | null
  /** Booking.com will not switch on without at least one accepted payment method. */
  needsPaymentMethods: boolean
  /** Booking.com: a linked listing can pair our rate plans with the ones it already has, so none are duplicated. */
  ratePlanPairs: boolean
  /** Photos a listing needs before the channel publishes it. A warning, never a gate. */
  minPhotos: number
}

const LINK_IDS: Record<string, LinkIdLabels> = {
  'Booking.com': { property: 'Hotel ID', room: 'Room ID' },
  'Expedia': { property: 'Property ID', room: 'Room ID' },
  'Airbnb': { property: 'Listing ID', host: 'Host ID' },
  'Vrbo': { property: 'Property ID' },
}

// Placeholder minimums; the real ones come from `constants/channel-content-definitions`.
const MIN_PHOTOS: Record<string, number> = {
  'Airbnb': 5,
  'Booking.com': 3,
  'Vrbo': 6,
  'Expedia': 3,
}

const SIGN_IN: Record<string, SignInMethod> = {
  Airbnb: 'link',
  Vrbo: 'sso',
}

/** Channels without a known NextPax code still need their property id, the one thing every hotel channel asks for. */
const PROPERTY_ID_SETTING: Record<string, NextPaxSettingDefinition> = {
  'Agoda': { settingName: 'property_id', settingDescription: 'Your property id from the Agoda YCS extranet.', settingType: 'text', settingRequired: true, availableOnPropertyLevel: false },
  'Trip.com': { settingName: 'property_id', settingDescription: 'Your hotel id from the Trip.com eBooking extranet.', settingType: 'text', settingRequired: true, availableOnPropertyLevel: false },
}

const SETTING_LABELS: Record<string, string> = {
  legal_entity_id: 'Legal entity ID',
  pricing_model: 'Pricing model',
  advertiser_id: 'Advertiser ID',
  property_id: 'Property ID',
}

/** A label written for hosts, falling back to the setting name made readable. */
export function settingLabel(name: string): string {
  return SETTING_LABELS[name] ?? prettySettingName(name)
}

export function getSetupSpec(channel: string): ChannelSetupSpec {
  const code = nextPaxCode(channel)
  const settings = code
    ? NEXTPAX_SETTING_DEFINITIONS[code] ?? []
    : PROPERTY_ID_SETTING[channel] ? [PROPERTY_ID_SETTING[channel]] : []
  return {
    channel,
    signIn: SIGN_IN[channel] ?? 'settings',
    // Vrbo's advertiser id is asked in its sign-in step, so it is not a second time in the form.
    settings: SIGN_IN[channel] === 'sso' ? settings.filter(s => s.settingName !== 'advertiser_id') : settings,
    linkIds: LINK_IDS[channel] ?? null,
    needsPaymentMethods: channel === 'Booking.com',
    ratePlanPairs: channel === 'Booking.com',
    minPhotos: MIN_PHOTOS[channel] ?? 1,
  }
}

/** Account settings that can be set differently on one listing, e.g. a villa contracted by another owner. */
export const listingLevelSettings = (spec: ChannelSetupSpec) => spec.settings.filter(s => s.availableOnPropertyLevel)

export interface SsoState {
  advertiserId: string
  companyName: string
  email: string
  /** The sign-in link Elev8 got back; the host opens it. */
  link: string | null
  signedIn: boolean
  /** Sent as `confirmMappingOfPropertyIds`: keep the host's Vrbo listings instead of creating new ones. */
  confirmMapping: boolean
}

export const emptySso = (): SsoState => ({ advertiserId: '', companyName: '', email: '', link: null, signedIn: false, confirmMapping: true })

/** Everything the wizard collects for one channel. Saved as the host types, so leaving keeps it. */
export interface ChannelSetupState {
  settings: Record<string, string>
  /** Cancellation policy picked for this channel (a `CancellationPolicy` value), null until picked. */
  policy: string | null
  /** Airbnb: the sign-in link Elev8 prepared. */
  authorisation: { url: string, setAt: string } | null
  sso: SsoState
  /** Per listing: how it goes on the channel. Listings already on the channel have no entry. */
  choices: Record<string, ListingChoice>
}

export const emptySetupState = (): ChannelSetupState => ({ settings: {}, policy: null, authorisation: null, sso: emptySso(), choices: {} })

export type ListingMode = 'new' | 'link' | 'skip'

export interface ListingChoice {
  mode: ListingMode
  propertyId: string
  roomId: string
  hostId: string
  /** Link only: copy photos, descriptions and fees from the channel instead of pushing ours. */
  importContent: boolean
  /**
   * Link only, Booking.com: our rate plan code to the channel's rate plan id
   * (`channel_rate_plans`). A plan left empty is created new on the channel.
   */
  ratePlans: Record<string, string>
  /** Listing-level values of account settings, by setting name. Empty means the account value. */
  overrides: Record<string, string>
}

export const defaultChoice = (): ListingChoice => ({ mode: 'new', propertyId: '', roomId: '', hostId: '', importContent: false, ratePlans: {}, overrides: {} })

/** The rate plan pairs a linked listing sends, as `channel_rate_plans`. Empty ids are left out. */
export function ratePlanPairs(choice: ListingChoice): { supplier_rateplan_code: string, channel_rateplan_code: string }[] {
  if (choice.mode !== 'link')
    return []
  return Object.entries(choice.ratePlans)
    .filter(([, id]) => id.trim())
    .map(([code, id]) => ({ supplier_rateplan_code: code, channel_rateplan_code: id.trim() }))
}

export function missingSettings(spec: ChannelSetupSpec, values: Record<string, string>): string[] {
  return spec.settings
    .filter(s => s.settingRequired && !(values[s.settingName] ?? '').trim())
    .map(s => settingLabel(s.settingName))
}

/** Step 1 is done when the form is complete and the host signed in the channel's way. */
export function signedIn(spec: ChannelSetupSpec, state: ChannelSetupState): boolean {
  switch (spec.signIn) {
    case 'link': return !!state.authorisation
    case 'sso': return state.sso.signedIn
    default: return true
  }
}

export const accountDone = (spec: ChannelSetupSpec, state: ChannelSetupState) => missingSettings(spec, state.settings).length === 0 && signedIn(spec, state)

export interface ReadinessGate {
  key: 'policy' | 'payments'
  done: boolean
  label: string
  hint: string
}

/** What the channel refuses to switch on without. Each is fixed inside step 2. */
export function readinessGates(spec: ChannelSetupSpec, state: ChannelSetupState, paymentMethods: string[]): ReadinessGate[] {
  const gates: ReadinessGate[] = [{
    key: 'policy',
    done: !!state.policy,
    label: 'Cancellation policy',
    hint: `${spec.channel} will not switch on with your account-wide policy alone.`,
  }]
  if (spec.needsPaymentMethods) {
    gates.push({
      key: 'payments',
      done: paymentMethods.length > 0,
      label: 'Payment methods',
      hint: 'Pick every method you accept. Booking.com shows them to guests.',
    })
  }
  return gates
}

/** What a listing row still needs before it can be linked. Empty for new and skipped rows. */
export function choiceIssues(spec: ChannelSetupSpec, choice: ListingChoice): string[] {
  if (choice.mode !== 'link' || !spec.linkIds)
    return []
  const issues: string[] = []
  if (!choice.propertyId.trim())
    issues.push(spec.linkIds.property)
  if (spec.linkIds.room && !choice.roomId.trim())
    issues.push(spec.linkIds.room)
  if (spec.linkIds.host && !choice.hostId.trim())
    issues.push(spec.linkIds.host)
  return issues
}

export interface ConnectPlan {
  create: string[]
  link: string[]
  skip: string[]
}

/** Splits the listings not yet on the channel by what the host chose. A listing with no choice is created new. */
export function connectPlan(listingIds: string[], choices: Record<string, ListingChoice>): ConnectPlan {
  const plan: ConnectPlan = { create: [], link: [], skip: [] }
  for (const id of listingIds) {
    const mode = choices[id]?.mode ?? 'new'
    plan[mode === 'new' ? 'create' : mode].push(id)
  }
  return plan
}

/** Step 3 is done when something goes on the channel and every linked row has its ids. */
export function listingsDone(spec: ChannelSetupSpec, listingIds: string[], choices: Record<string, ListingChoice>): boolean {
  const plan = connectPlan(listingIds, choices)
  if (plan.create.length + plan.link.length === 0)
    return false
  return plan.link.every(id => choiceIssues(spec, choices[id]!).length === 0)
}

export type WizardStep = 'account' | 'readiness' | 'listings' | 'connect'

export const WIZARD_STEPS: { key: WizardStep, title: string, description: string }[] = [
  { key: 'account', title: 'Account', description: 'Details and sign-in' },
  { key: 'readiness', title: 'Readiness', description: 'What the channel requires' },
  { key: 'listings', title: 'Listings', description: 'New, link or skip' },
  { key: 'connect', title: 'Connect', description: 'Review and go live' },
]

export const isWizardStep = (value: unknown): value is WizardStep => WIZARD_STEPS.some(s => s.key === value)
