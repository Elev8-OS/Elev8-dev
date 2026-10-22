import { describe, expect, it } from 'vitest'
import {
  accountDone,
  choiceIssues,
  connectPlan,
  defaultChoice,
  emptySetupState,
  getSetupSpec,
  listingLevelSettings,
  listingsDone,
  missingSettings,
  ratePlanPairs,
  readinessGates,
} from '~/components/channels/data/channel-setup'
import { channelSlug, getChannelBySlug } from '~/components/channels/data/channels'

describe('getSetupSpec', () => {
  it('gives each channel its own sign-in', () => {
    expect(getSetupSpec('Airbnb').signIn).toBe('link')
    expect(getSetupSpec('Vrbo').signIn).toBe('sso')
    expect(getSetupSpec('Booking.com').signIn).toBe('settings')
    expect(getSetupSpec('Google Vacation Rentals').signIn).toBe('settings')
  })

  it('asks Vrbo for its advertiser id in the sign-in, not twice in the form', () => {
    expect(getSetupSpec('Vrbo').settings.map(s => s.settingName)).not.toContain('advertiser_id')
  })

  it('asks a channel without a NextPax code for its property id', () => {
    expect(getSetupSpec('Agoda').settings.map(s => s.settingName)).toEqual(['property_id'])
    expect(getSetupSpec('Agoda').linkIds).toBeNull()
  })

  it('needs payment methods on Booking.com only', () => {
    expect(getSetupSpec('Booking.com').needsPaymentMethods).toBe(true)
    expect(getSetupSpec('Expedia').needsPaymentMethods).toBe(false)
  })

  it('lists the settings a listing can override', () => {
    expect(listingLevelSettings(getSetupSpec('Booking.com')).map(s => s.settingName)).toEqual(['legal_entity_id'])
  })
})

describe('step rules', () => {
  it('is done with the account when required settings are filled and the host signed in', () => {
    const booking = getSetupSpec('Booking.com')
    const state = emptySetupState()
    expect(missingSettings(booking, state.settings)).toEqual(['Legal entity ID', 'Pricing model'])
    expect(accountDone(booking, { ...state, settings: { legal_entity_id: '12', pricing_model: 'Per night' } })).toBe(true)

    const airbnb = getSetupSpec('Airbnb')
    expect(accountDone(airbnb, state)).toBe(false)
    expect(accountDone(airbnb, { ...state, authorisation: { url: 'https://x', setAt: '2026-10-01' } })).toBe(true)

    const vrbo = getSetupSpec('Vrbo')
    expect(accountDone(vrbo, { ...state, sso: { ...state.sso, signedIn: true, confirmMapping: false } })).toBe(true)
  })

  it('blocks readiness without a policy, and without payments on Booking.com', () => {
    const state = emptySetupState()
    const booking = readinessGates(getSetupSpec('Booking.com'), { ...state, policy: 'strict' }, [])
    expect(booking.map(g => [g.key, g.done])).toEqual([['policy', true], ['payments', false]])
    expect(readinessGates(getSetupSpec('Airbnb'), state, []).map(g => g.key)).toEqual(['policy'])
  })

  it('creates every listing without a choice new, and needs the ids of a linked one', () => {
    const spec = getSetupSpec('Booking.com')
    const linked = { ...defaultChoice(), mode: 'link' as const, propertyId: '9' }
    expect(choiceIssues(spec, linked)).toEqual(['Room ID'])
    expect(choiceIssues(spec, { ...linked, roomId: '1' })).toEqual([])

    const choices = { b: linked, c: { ...defaultChoice(), mode: 'skip' as const } }
    expect(connectPlan(['a', 'b', 'c'], choices)).toEqual({ create: ['a'], link: ['b'], skip: ['c'] })
    expect(listingsDone(spec, ['a', 'b', 'c'], choices)).toBe(false)
    expect(listingsDone(spec, ['a', 'b', 'c'], { ...choices, b: { ...linked, roomId: '1' } })).toBe(true)
  })

  it('is not done with listings when every one is skipped', () => {
    const spec = getSetupSpec('Airbnb')
    expect(listingsDone(spec, ['a'], { a: { ...defaultChoice(), mode: 'skip' } })).toBe(false)
  })
})

describe('ratePlanPairs', () => {
  it('sends only filled pairs, and only for a linked listing', () => {
    const choice = { ...defaultChoice(), mode: 'link' as const, ratePlans: { RP0001: ' 52011 ', RP0002: '' } }
    expect(ratePlanPairs(choice)).toEqual([{ supplier_rateplan_code: 'RP0001', channel_rateplan_code: '52011' }])
    expect(ratePlanPairs({ ...choice, mode: 'new' })).toEqual([])
    expect(getSetupSpec('Booking.com').ratePlanPairs).toBe(true)
    expect(getSetupSpec('Expedia').ratePlanPairs).toBe(false)
  })
})

describe('channel slugs', () => {
  it('round-trips every channel name', () => {
    expect(channelSlug('Booking.com')).toBe('booking-com')
    expect(getChannelBySlug('google-vacation-rentals')?.name).toBe('Google Vacation Rentals')
    expect(getChannelBySlug('nope')).toBeUndefined()
  })
})
