import type { ChannelSetupState, ListingChoice, ListingMode, SsoState } from '~/components/channels/data/channel-setup'
import type { ConnectResult } from '~/components/channels/data/nextpax'
import { computed } from 'vue'
import {
  accountDone,
  connectPlan,
  defaultChoice,
  emptySetupState,
  emptySso,
  getSetupSpec,
  listingsDone,
  missingSettings,
  ratePlanPairs,
  readinessGates,
  signedIn,
} from '~/components/channels/data/channel-setup'
import { CHANNELS } from '~/components/channels/data/channels'
import { nextPaxCode, propertiesNeedingAttention } from '~/components/channels/data/nextpax'
import { mockConnectResult } from '~/components/channels/data/nextpax-mock'
import { listings } from '~/components/listings/data/listings'
import { mockExternalId, useChannels } from '~/composables/useChannels'

/** Mocked round trip for the Vrbo sign-in link. */
export const CHANNEL_SSO_DELAY_MS = 900

const DAY_MS = 86_400_000

function wait(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

/** Channels the demo already sells on open as fully set up, so their wizard starts at Listings. */
function seedStates(): Record<string, ChannelSetupState> {
  const { isConnected } = useChannels()
  const states: Record<string, ChannelSetupState> = {}
  for (const channel of CHANNELS) {
    if (!isConnected(channel.name))
      continue
    const spec = getSetupSpec(channel.name)
    const settings: Record<string, string> = {}
    for (const def of spec.settings)
      settings[def.settingName] = def.settingOptions?.[0] ?? mockExternalId(def.settingName, channel.name)
    states[channel.name] = {
      ...emptySetupState(),
      settings,
      policy: 'moderate',
      authorisation: spec.signIn === 'link'
        ? { url: `https://example.com/authorise/${channel.name.toLowerCase()}`, setAt: new Date(Date.now() - 3 * DAY_MS).toISOString() }
        : null,
      sso: spec.signIn === 'sso' ? { ...emptySso(), advertiserId: mockExternalId('advertiser', channel.name), signedIn: true } : emptySso(),
    }
  }
  return states
}

/**
 * One channel's connect wizard: account and sign-in, readiness, the choice per
 * listing, and the connect itself. Everything is saved as the host goes, so
 * leaving the wizard keeps it. Mock only, shaped like NextPax
 * (`docs/claude/nextpax-channels.md`). Mappings stay in `useChannels`, the only
 * writer of `otaConnected`. `only` narrows the Listings step and the connect to
 * those listings (adding one listing from its Channels tab), so the choices
 * saved for the others are left alone.
 */
export function useChannelSetup(channelName: string, only?: string[]) {
  const spec = getSetupSpec(channelName)
  const states = useState<Record<string, ChannelSetupState>>('channel-setup', seedStates)
  // Accepted payment methods belong to the account, shared by every channel.
  const paymentMethods = useState<string[]>('channel-payment-methods', () => ['credit-card'])
  const { accountsForChannel, connectAccount, connectListings, disconnectListing, getMapping, mappingsForChannel, markWarning, resync, updateExternalId } = useChannels()

  const state = computed<ChannelSetupState>(() => states.value[channelName] ?? emptySetupState())

  function patch(next: Partial<ChannelSetupState>) {
    states.value = { ...states.value, [channelName]: { ...state.value, ...next } }
  }

  /** Listings not on this channel yet: the ones step 3 asks about. */
  const pendingListings = computed(() => listings.value.filter(l => !getMapping(l.id, channelName) && (!only || only.includes(l.id))))
  const pendingIds = computed(() => pendingListings.value.map(l => l.id))

  const missing = computed(() => missingSettings(spec, state.value.settings))
  const isSignedIn = computed(() => signedIn(spec, state.value))
  const accountComplete = computed(() => accountDone(spec, state.value))
  const gates = computed(() => readinessGates(spec, state.value, paymentMethods.value))
  const readinessComplete = computed(() => gates.value.every(g => g.done))
  const plan = computed(() => connectPlan(pendingIds.value, state.value.choices))
  const listingsComplete = computed(() => listingsDone(spec, pendingIds.value, state.value.choices))

  /** Where the wizard opens: the first step that is not done yet. */
  const firstOpenStep = computed(() => !accountComplete.value ? 'account' : !readinessComplete.value ? 'readiness' : 'listings')

  function setSetting(name: string, value: string) {
    patch({ settings: { ...state.value.settings, [name]: value } })
  }

  function setPolicy(policy: string) {
    patch({ policy })
  }

  function togglePaymentMethod(method: string) {
    paymentMethods.value = paymentMethods.value.includes(method)
      ? paymentMethods.value.filter(m => m !== method)
      : [...paymentMethods.value, method]
  }

  /** Airbnb: saves the sign-in link Elev8 sent. Returns an error message, or null. Only https links count. */
  function saveAuthorisation(rawUrl: string): string | null {
    const url = rawUrl.trim()
    if (!url.startsWith('https://'))
      return 'The link must start with https://'
    patch({ authorisation: { url, setAt: new Date().toISOString() } })
    return null
  }

  function clearAuthorisation() {
    patch({ authorisation: null })
  }

  function setSso(next: Partial<SsoState>) {
    patch({ sso: { ...state.value.sso, ...next } })
  }

  /** Vrbo: asks for the sign-in link for this advertiser. A new link means a new sign-in. */
  async function requestSsoLink() {
    const advertiserId = state.value.sso.advertiserId.trim()
    if (!advertiserId)
      return false
    await wait(CHANNEL_SSO_DELAY_MS)
    setSso({ link: `https://www.vrbo.com/p/sso?advertiser=${encodeURIComponent(advertiserId)}&partner=elev8`, signedIn: false })
    return true
  }

  function choiceFor(listingId: string): ListingChoice {
    return state.value.choices[listingId] ?? defaultChoice()
  }

  function setChoice(listingId: string, next: Partial<ListingChoice>) {
    patch({ choices: { ...state.value.choices, [listingId]: { ...choiceFor(listingId), ...next } } })
  }

  /** Same mode for every listing in `ids`. Link keeps the ids already typed. */
  function setMode(ids: string[], mode: ListingMode) {
    const choices = { ...state.value.choices }
    for (const id of ids)
      choices[id] = { ...choiceFor(id), mode }
    patch({ choices })
  }

  /**
   * Puts the chosen listings on the channel in one go. Linked listings attach to
   * the ids the host typed; the rest are created fresh. Warnings land as
   * "Needs attention". Creates the account on the first connect.
   */
  async function connect(): Promise<ConnectResult | null> {
    if (!accountComplete.value || !readinessComplete.value || !listingsComplete.value)
      return null
    const { create, link } = plan.value
    const ids = [...create, ...link]

    let account = accountsForChannel(channelName)[0]
    if (!account)
      account = (await connectAccount(channelName, { accountName: 'Elev8 Bali Villas', propertyId: state.value.settings.property_id ?? '' })) ?? undefined
    if (!account)
      return null

    const linked = new Set(link)
    await connectListings(account.id, ids.map(listingId => ({
      listingId,
      externalId: linked.has(listingId) ? choiceFor(listingId).propertyId : undefined,
    })))

    const paired = link.filter(id => ratePlanPairs(choiceFor(id)).length > 0)
    const result = mockConnectResult(nextPaxCode(channelName) ?? '', ids, paired)
    for (const property of propertiesNeedingAttention(result)) {
      if (property.warnings?.[0])
        markWarning(property.property_id, channelName, property.warnings[0])
    }
    // What went on the channel no longer needs a choice; skipped listings keep theirs.
    const choices = { ...state.value.choices }
    for (const id of ids)
      delete choices[id]
    patch({ choices })
    return result
  }

  /** Detaches a listing from the one the host ran on the channel; the channel gets a fresh listing instead. */
  function unlink(listingId: string) {
    const mapping = getMapping(listingId, channelName)
    if (mapping)
      updateExternalId(mapping.id, mockExternalId(listingId, channelName))
  }

  async function retry(listingId: string) {
    const mapping = getMapping(listingId, channelName)
    if (mapping)
      await resync(mapping.id)
  }

  function remove(listingId: string) {
    disconnectListing(listingId, channelName)
  }

  /** Takes every listing off the channel. Account details stay for a later connect. */
  function turnOff() {
    const mapped = mappingsForChannel(channelName)
    for (const m of mapped)
      disconnectListing(m.listingId, channelName)
    return mapped.length
  }

  return {
    spec,
    state,
    paymentMethods,
    pendingListings,
    missing,
    isSignedIn,
    accountComplete,
    gates,
    readinessComplete,
    plan,
    listingsComplete,
    firstOpenStep,
    setSetting,
    setPolicy,
    togglePaymentMethod,
    saveAuthorisation,
    clearAuthorisation,
    setSso,
    requestSsoLink,
    choiceFor,
    setChoice,
    setMode,
    connect,
    unlink,
    retry,
    remove,
    turnOff,
  }
}

/**
 * Account-wide NextPax features. `webhook`: bookings and guest messages
 * arrive on their own; it is set up on provisioning, so the host only sees its
 * health and can set it up again. `currencyFx`: NextPax converts the prices it
 * sends into the currency a channel sells in. A deliberate exception to "no
 * currency conversion" (see CLAUDE.md): it changes only what channels receive,
 * never an amount Elev8 stores or shows.
 */
export function useChannelFeatures() {
  const currencyFx = useState<boolean>('channel-currency-fx', () => false)
  // Set up when the account moves to NextPax, so bookings and messages arrive on their own.
  const webhook = useState('channel-webhook', () => ({ bookings: true, messages: true, setUpAt: new Date(Date.now() - 12 * DAY_MS).toISOString() }))

  /** Registers the webhook again (`POST /webhook/subscribe`), e.g. after the channels stopped sending. */
  async function setUpWebhookAgain() {
    await wait(CHANNEL_SSO_DELAY_MS)
    webhook.value = { bookings: true, messages: true, setUpAt: new Date().toISOString() }
  }

  return { currencyFx, webhook, setUpWebhookAgain }
}
