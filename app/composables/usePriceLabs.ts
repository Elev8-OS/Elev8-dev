import type { SyncState } from '~/components/revenue/data/health'
import { computed } from 'vue'
import { healthRooms } from '~/components/revenue/data/health'

/**
 * PriceLabs integration, prototype against the real API shape.
 *
 * This is a mock, but it is deliberately not a fake: every state change goes
 * through `request()`, which models one HTTP call (latency, status, rate-limit
 * header, request and response body) and records it in `calls`. The UI reads
 * that log, so what a reviewer sees is the sequence of API calls the real
 * adapter will make, in order, with the payloads it will send.
 *
 * Two clients, because PriceLabs is reached two ways (spec §8, §9):
 *   sync:     partner-authenticated. We push listings, availability and
 *              reservations. This is the feed Channex provides today.
 *   customer: tenant API key. We read prices and market data, and write
 *              pricing settings back.
 *
 * Certification is NOT modelled here. It happens once for Elev8 as a partner,
 * not once per tenant, so a tenant-facing certification step would be fiction.
 * It belongs on the Elev8 staff side.
 */

/**
 * PROVISIONAL. Paths, the auth header name and rate limits sit behind the
 * PriceLabs developer portal and are unverified (PP-382, spec §8/§9 and §19).
 * Everything routes through this one map so verifying them later is an edit
 * here, not a search through the codebase. Do not inline a path anywhere else.
 */
export const PROVISIONAL_API = {
  customerBaseUrl: 'https://api.pricelabs.co/v1',
  syncBaseUrl: 'https://api.pricelabs.co/sync/v1',
  authHeader: 'X-API-Key',
  rateLimitPerMinute: 60,
  endpoints: {
    listings: '/listings',
    listingPrices: '/listing_prices',
    neighborhoodData: '/neighborhood_data',
    syncListings: '/listings',
    syncAvailability: '/availability',
    syncReservations: '/reservations',
  },
} as const

/** PriceLabs identifies a unit by (id, pms), never by id alone. */
export const PMS_IDENTIFIER = 'elev8'

export type PlClient = 'sync' | 'customer'
export type HttpMethod = 'GET' | 'POST' | 'PUT'

export interface ApiCall {
  id: string
  client: PlClient
  method: HttpMethod
  path: string
  status: number
  durationMs: number
  requestBody: unknown | null
  responseBody: unknown
  rateLimitRemaining: number | null
  at: string
}

export interface PriceLabsConnection {
  id: string
  accountName: string
  /** Tenant's own key, from PriceLabs → Account → API. Masked in the UI. */
  apiKey: string
  status: 'connected'
  webhookToken: string
  webhookUrl: string
  hmacSecret: string
  connectedAt: string
  lastSyncAt: string | null
  rateLimitRemaining: number
}

/** The four settings this prototype reconciles. Elev8 holds the desired value. */
export interface UnitState {
  base: number
  min: number
  max: number
  minStay: number
}

export interface PriceLabsUnit {
  providerUnitId: string
  providerName: string
  pms: string
  roomId: string | null
  syncEnabled: boolean
  /** What PriceLabs currently holds. Only ever changed by a mocked response. */
  provider: UnitState
  /** What Elev8 says it should be. Elev8 is master. */
  desired: UnitState
  lastPushedAt: string | null
  lastPriceAt: string | null
}

export type FeedState = 'live' | 'partial' | 'paused' | 'degraded' | 'never'

export type PriceLabsFeedId
  = | 'listings' | 'availability' | 'reservations' | 'settings'
    | 'prices' | 'market_data'

export interface PriceLabsFeed {
  id: PriceLabsFeedId
  label: string
  client: PlClient
  direction: 'outbound' | 'inbound'
  endpoint: string
  state: FeedState
  recordCount: number
  lastRunAt: string | null
  detail: string | null
}

/** A field where PriceLabs disagrees with Elev8. Elev8 wins. */
export interface DriftRow {
  providerUnitId: string
  roomId: string | null
  field: keyof UnitState
  label: string
  elev8Value: number
  providerValue: number
}

export type CapabilityAccess = 'read_write' | 'read_only' | 'unsupported' | 'unverified'

export interface PriceLabsCapability {
  key: string
  label: string
  access: CapabilityAccess
  /** How we know. Discovered from a response beats someone's assumption. */
  source: 'discovered' | 'documented' | 'unverified'
  note: string | null
}

const CONNECTION_KEY = 'elev8-pricelabs-connection'
const UNITS_KEY = 'elev8-pricelabs-units'
const FEEDS_KEY = 'elev8-pricelabs-feeds'
const CAPS_KEY = 'elev8-pricelabs-capabilities'
const CALLS_KEY = 'elev8-pricelabs-calls'

export const feedStateLabels: Record<FeedState, string> = {
  live: 'Live',
  partial: 'Partial',
  paused: 'Paused',
  degraded: 'Degraded',
  never: 'Not run',
}

export const capabilityAccessLabels: Record<CapabilityAccess, string> = {
  read_write: 'Read / write',
  read_only: 'Read only',
  unsupported: 'Unsupported',
  unverified: 'Unverified',
}

export const unitFieldLabels: Record<keyof UnitState, string> = {
  base: 'Base price',
  min: 'Minimum price',
  max: 'Maximum price',
  minStay: 'Minimum stay',
}

/**
 * What `GET /listings` returns. Names are the provider's own, and they do not
 * match Elev8 room names, which is exactly why mapping exists.
 */
const REMOTE_LISTINGS: { id: string, name: string, base: number, min: number, max: number, minStay: number }[] = [
  { id: 'plu-88214', name: 'Villa Suryas Room 2', base: 165, min: 120, max: 340, minStay: 2 },
  { id: 'plu-88215', name: 'Uluwatu Cliff Hse R1', base: 240, min: 180, max: 520, minStay: 3 },
  { id: 'plu-88216', name: 'Villa Padma R3', base: 148, min: 110, max: 300, minStay: 3 },
  { id: 'plu-88217', name: 'Canggu Loft Studio', base: 96, min: 70, max: 210, minStay: 1 },
  { id: 'plu-88218', name: 'Villa Bakti Room 2', base: 132, min: 100, max: 380, minStay: 2 },
  { id: 'plu-88219', name: 'Seminyak Grdn 4', base: 118, min: 90, max: 260, minStay: 2 },
  { id: 'plu-88220', name: 'Legian Beach Suite', base: 205, min: 150, max: 460, minStay: 2 },
]

/**
 * Elev8's desired state, seeded to differ from the provider on three units so
 * the first reconcile has something real to correct rather than a canned row.
 */
const DESIRED_OVERRIDES: Record<string, Partial<UnitState>> = {
  'plu-88214': { base: 182 },
  'plu-88216': { minStay: 2 },
  'plu-88218': { max: 410 },
}

const CAPABILITY_SEED: PriceLabsCapability[] = [
  { key: 'base_price', label: 'Base price', access: 'unverified', source: 'unverified', note: null },
  { key: 'min_price', label: 'Minimum price', access: 'unverified', source: 'unverified', note: null },
  { key: 'max_price', label: 'Maximum price', access: 'unverified', source: 'unverified', note: null },
  { key: 'min_stay', label: 'Minimum stay', access: 'unverified', source: 'unverified', note: null },
  { key: 'seasons', label: 'Seasonal rates', access: 'unverified', source: 'unverified', note: null },
  { key: 'occupancy_rules', label: 'Occupancy-based rules', access: 'unverified', source: 'unverified', note: null },
  { key: 'los_discounts', label: 'Length-of-stay discounts', access: 'unverified', source: 'unverified', note: null },
  { key: 'extra_person_fee', label: 'Extra-person fee', access: 'unverified', source: 'unverified', note: null },
  { key: 'date_overrides', label: 'Date overrides', access: 'unverified', source: 'unverified', note: null },
]

function feedSeed(): PriceLabsFeed[] {
  const e = PROVISIONAL_API.endpoints
  return [
    { id: 'listings', label: 'Listings', client: 'sync', direction: 'outbound', endpoint: e.syncListings, state: 'never', recordCount: 0, lastRunAt: null, detail: null },
    { id: 'availability', label: 'Availability (730 days)', client: 'sync', direction: 'outbound', endpoint: e.syncAvailability, state: 'never', recordCount: 0, lastRunAt: null, detail: null },
    { id: 'reservations', label: 'Reservations', client: 'sync', direction: 'outbound', endpoint: e.syncReservations, state: 'never', recordCount: 0, lastRunAt: null, detail: null },
    { id: 'settings', label: 'Pricing settings', client: 'customer', direction: 'outbound', endpoint: e.listings, state: 'never', recordCount: 0, lastRunAt: null, detail: null },
    { id: 'prices', label: 'Prices', client: 'customer', direction: 'inbound', endpoint: e.listingPrices, state: 'never', recordCount: 0, lastRunAt: null, detail: null },
    { id: 'market_data', label: 'Market data', client: 'customer', direction: 'inbound', endpoint: e.neighborhoodData, state: 'never', recordCount: 0, lastRunAt: null, detail: null },
  ]
}

function loadFromStorage<T>(key: string, fallback: T): T {
  if (import.meta.client) {
    try {
      const raw = localStorage.getItem(key)
      if (raw)
        return JSON.parse(raw) as T
    }
    catch { /* ignore */ }
  }
  return fallback
}

function saveToStorage<T>(key: string, value: T) {
  if (import.meta.client) {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    }
    catch { /* ignore */ }
  }
}

function randomToken(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`
}

function nowIso() {
  return new Date().toISOString()
}

export function usePriceLabs() {
  const connection = useState<PriceLabsConnection | null>('pricelabs-connection', () => loadFromStorage<PriceLabsConnection | null>(CONNECTION_KEY, null))
  const units = useState<PriceLabsUnit[]>('pricelabs-units', () => loadFromStorage<PriceLabsUnit[]>(UNITS_KEY, []))
  const feeds = useState<PriceLabsFeed[]>('pricelabs-feeds', () => loadFromStorage<PriceLabsFeed[]>(FEEDS_KEY, []))
  const capabilities = useState<PriceLabsCapability[]>('pricelabs-capabilities', () => loadFromStorage<PriceLabsCapability[]>(CAPS_KEY, CAPABILITY_SEED))
  const calls = useState<ApiCall[]>('pricelabs-calls', () => loadFromStorage<ApiCall[]>(CALLS_KEY, []))

  watch(connection, (val) => {
    if (val)
      saveToStorage(CONNECTION_KEY, val)
    else if (import.meta.client)
      localStorage.removeItem(CONNECTION_KEY)
  }, { deep: true })

  watch(units, val => saveToStorage(UNITS_KEY, val), { deep: true })
  watch(feeds, val => saveToStorage(FEEDS_KEY, val), { deep: true })
  watch(capabilities, val => saveToStorage(CAPS_KEY, val), { deep: true })
  watch(calls, val => saveToStorage(CALLS_KEY, val.slice(0, 60)), { deep: true })

  const isConnected = computed(() => connection.value?.status === 'connected')

  const rooms = computed(() => healthRooms.map(r => ({ id: r.id, name: r.name })))

  /**
   * One mocked HTTP round trip. Everything that changes state goes through
   * here, so the call log is a complete record rather than a decoration.
   */
  async function request<T>(
    client: PlClient,
    method: HttpMethod,
    path: string,
    opts: { body?: unknown, respond: () => { status: number, body: T } },
  ): Promise<{ status: number, body: T }> {
    const started = Date.now()
    await new Promise(r => setTimeout(r, 120 + Math.floor(Math.random() * 280)))
    const { status, body } = opts.respond()
    const durationMs = Date.now() - started

    let remaining: number | null = null
    if (connection.value) {
      remaining = Math.max(0, connection.value.rateLimitRemaining - 1)
      connection.value = { ...connection.value, rateLimitRemaining: remaining }
    }

    const entry: ApiCall = {
      id: `call-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      client,
      method,
      path,
      status,
      durationMs,
      requestBody: opts.body ?? null,
      responseBody: body,
      rateLimitRemaining: remaining,
      at: nowIso(),
    }
    calls.value = [entry, ...calls.value].slice(0, 60)
    return { status, body }
  }

  function baseUrlFor(client: PlClient) {
    return client === 'sync' ? PROVISIONAL_API.syncBaseUrl : PROVISIONAL_API.customerBaseUrl
  }

  function patchFeed(id: PriceLabsFeedId, patch: Partial<PriceLabsFeed>) {
    feeds.value = feeds.value.map(f => (f.id === id ? { ...f, ...patch } : f))
  }

  /**
   * Connect by using the key, not by trusting its shape: we call
   * `GET /listings` and the listings in the response become the mapping pool.
   * A key that cannot list is not a connected key.
   */
  async function connect(accountName: string, apiKey: string): Promise<{ success: true, listingCount: number } | { success: false, status: number, error: string }> {
    const key = apiKey.trim()
    const name = accountName.trim()

    if (!name)
      return { success: false, status: 0, error: 'Account name is required.' }
    if (!key)
      return { success: false, status: 0, error: 'API key is required.' }

    const valid = key.startsWith('pl_') || key.startsWith('plabs_')

    const res = await request<Record<string, unknown>>('customer', 'GET', PROVISIONAL_API.endpoints.listings, {
      respond: () => valid
        ? {
            status: 200,
            body: {
              listings: REMOTE_LISTINGS.map(l => ({
                id: l.id,
                pms: PMS_IDENTIFIER,
                name: l.name,
                base: l.base,
                min: l.min,
                max: l.max,
                min_stay: l.minStay,
                isEnabled: true,
                push_enabled: false,
              })),
            },
          }
        : {
            status: 401,
            body: { error: 'invalid_api_key', message: 'The API key was rejected by PriceLabs.' },
          },
    })

    if (res.status !== 200) {
      return { success: false, status: res.status, error: 'PriceLabs rejected the API key (401). Check it under Account → API in PriceLabs.' }
    }

    const webhookToken = randomToken('whsec')
    connection.value = {
      id: `pricelabs-${Date.now()}`,
      accountName: name,
      apiKey: key,
      status: 'connected',
      webhookToken,
      webhookUrl: `https://api.elev8.app/webhooks/pricelabs/${webhookToken.slice(6)}`,
      hmacSecret: randomToken('hmac'),
      connectedAt: nowIso(),
      lastSyncAt: null,
      rateLimitRemaining: PROVISIONAL_API.rateLimitPerMinute - 1,
    }

    units.value = REMOTE_LISTINGS.map((l) => {
      const provider: UnitState = { base: l.base, min: l.min, max: l.max, minStay: l.minStay }
      return {
        providerUnitId: l.id,
        providerName: l.name,
        pms: PMS_IDENTIFIER,
        roomId: null,
        syncEnabled: false,
        provider,
        desired: { ...provider, ...DESIRED_OVERRIDES[l.id] },
        lastPushedAt: null,
        lastPriceAt: null,
      }
    })

    feeds.value = feedSeed()

    // The response told us these four fields exist and are writable. That is
    // a discovered answer to §19 Q2 for those fields, and only for those.
    capabilities.value = capabilities.value.map(c =>
      ['base_price', 'min_price', 'max_price', 'min_stay'].includes(c.key)
        ? { ...c, access: 'read_write' as CapabilityAccess, source: 'discovered' as const, note: `Present in ${PROVISIONAL_API.endpoints.listings} response.` }
        : c,
    )

    return { success: true, listingCount: REMOTE_LISTINGS.length }
  }

  function mapUnit(providerUnitId: string, roomId: string | null) {
    units.value = units.value.map(u =>
      u.providerUnitId === providerUnitId ? { ...u, roomId, syncEnabled: roomId ? u.syncEnabled : false } : u,
    )
  }

  function setSyncEnabled(providerUnitId: string, enabled: boolean) {
    units.value = units.value.map(u =>
      u.providerUnitId === providerUnitId ? { ...u, syncEnabled: u.roomId ? enabled : false } : u,
    )
  }

  const mappedUnits = computed(() => units.value.filter(u => u.roomId))
  const syncingUnits = computed(() => units.value.filter(u => u.roomId && u.syncEnabled))
  const unmappedUnits = computed(() => units.value.filter(u => !u.roomId))

  /** Rooms with no provider unit. These can never receive a computed price. */
  const unmappedRooms = computed(() => {
    const taken = new Set(units.value.map(u => u.roomId).filter(Boolean))
    return rooms.value.filter(r => !taken.has(r.id))
  })

  /** Diff, not a fixture: whatever provider state disagrees with desired state. */
  const drift = computed<DriftRow[]>(() => {
    const rows: DriftRow[] = []
    for (const u of syncingUnits.value) {
      for (const field of Object.keys(unitFieldLabels) as (keyof UnitState)[]) {
        if (u.provider[field] !== u.desired[field]) {
          rows.push({
            providerUnitId: u.providerUnitId,
            roomId: u.roomId,
            field,
            label: unitFieldLabels[field],
            elev8Value: u.desired[field],
            providerValue: u.provider[field],
          })
        }
      }
    }
    return rows
  })

  async function pushListings() {
    const body = { listings: syncingUnits.value.map(u => ({ id: u.providerUnitId, pms: u.pms, name: u.providerName })) }
    const res = await request('sync', 'POST', PROVISIONAL_API.endpoints.syncListings, {
      body,
      respond: () => ({ status: 200, body: { synced: body.listings.length } }),
    })
    patchFeed('listings', {
      state: body.listings.length > 0 ? 'live' : 'paused',
      recordCount: body.listings.length,
      lastRunAt: nowIso(),
      detail: body.listings.length === 0 ? 'No unit has sync enabled yet.' : null,
    })
    return res
  }

  async function pushAvailability() {
    const windowDays = 730
    const list = syncingUnits.value
    const body = {
      listings: list.map(u => ({ id: u.providerUnitId, pms: u.pms, window_days: windowDays })),
    }
    const res = await request('sync', 'POST', PROVISIONAL_API.endpoints.syncAvailability, {
      body,
      respond: () => ({ status: 200, body: { accepted: list.length * windowDays } }),
    })
    patchFeed('availability', {
      state: list.length > 0 ? 'live' : 'paused',
      recordCount: list.length * windowDays,
      lastRunAt: nowIso(),
      detail: list.length === 0 ? 'No unit has sync enabled yet.' : null,
    })
    return res
  }

  async function pushReservations() {
    const list = syncingUnits.value
    const perUnit = 31
    const body = { listings: list.map(u => ({ id: u.providerUnitId, pms: u.pms })) }
    const res = await request('sync', 'POST', PROVISIONAL_API.endpoints.syncReservations, {
      body,
      respond: () => ({ status: 200, body: { accepted: list.length * perUnit } }),
    })
    patchFeed('reservations', {
      state: list.length > 0 ? 'live' : 'paused',
      recordCount: list.length * perUnit,
      lastRunAt: nowIso(),
      detail: list.length === 0 ? 'No unit has sync enabled yet.' : null,
    })
    return res
  }

  async function pullPrices() {
    const list = syncingUnits.value
    const body = { listings: list.map(u => ({ id: u.providerUnitId, pms: u.pms })) }
    const days = 365
    const res = await request('customer', 'GET', PROVISIONAL_API.endpoints.listingPrices, {
      body,
      respond: () => ({
        status: 200,
        body: {
          data: list.map(u => ({
            id: u.providerUnitId,
            pms: u.pms,
            currency: 'USD',
            data: [
              { date: new Date().toISOString().slice(0, 10), price: u.provider.base, min_stay: u.provider.minStay },
            ],
          })),
        },
      }),
    })
    const at = nowIso()
    units.value = units.value.map(u => (u.roomId && u.syncEnabled ? { ...u, lastPriceAt: at } : u))
    patchFeed('prices', {
      state: list.length > 0 ? 'live' : 'paused',
      recordCount: list.length * days,
      lastRunAt: at,
      detail: list.length === 0 ? 'No unit has sync enabled yet.' : null,
    })
    return res
  }

  async function pullMarketData() {
    const list = syncingUnits.value
    const res = await request('customer', 'GET', PROVISIONAL_API.endpoints.neighborhoodData, {
      body: { listings: list.map(u => ({ id: u.providerUnitId, pms: u.pms })) },
      respond: () => ({
        status: 200,
        body: {
          data: list.map(u => ({
            id: u.providerUnitId,
            pms: u.pms,
            occupancy_next_30: 0.62,
            adr_next_30: u.provider.base * 1.08,
            comp_set_size: 34,
          })),
        },
      }),
    })
    patchFeed('market_data', {
      state: list.length > 0 ? 'live' : 'paused',
      recordCount: list.length,
      lastRunAt: nowIso(),
      detail: list.length === 0 ? 'No unit has sync enabled yet.' : null,
    })
    return res
  }

  /**
   * Write, then read back and compare. The read-back is the point: a 200 on the
   * write is not evidence the value took, and the spec makes verification part
   * of the reconcile rather than an optional extra.
   */
  async function reconcileUnit(providerUnitId: string): Promise<{ written: number, verified: boolean }> {
    const unit = units.value.find(u => u.providerUnitId === providerUnitId)
    if (!unit || !unit.syncEnabled)
      return { written: 0, verified: false }

    const changed = (Object.keys(unitFieldLabels) as (keyof UnitState)[])
      .filter(f => unit.provider[f] !== unit.desired[f])

    if (changed.length === 0)
      return { written: 0, verified: true }

    const payload = {
      listings: [{
        id: unit.providerUnitId,
        pms: unit.pms,
        ...(changed.includes('base') ? { base: unit.desired.base } : {}),
        ...(changed.includes('min') ? { min: unit.desired.min } : {}),
        ...(changed.includes('max') ? { max: unit.desired.max } : {}),
        ...(changed.includes('minStay') ? { min_stay: unit.desired.minStay } : {}),
      }],
    }

    await request('customer', 'POST', PROVISIONAL_API.endpoints.listings, {
      body: payload,
      respond: () => ({ status: 200, body: { updated: [{ id: unit.providerUnitId, pms: unit.pms }] } }),
    })

    // The write landed on the provider side.
    units.value = units.value.map(u =>
      u.providerUnitId === providerUnitId
        ? { ...u, provider: { ...u.desired }, lastPushedAt: nowIso() }
        : u,
    )

    const after = units.value.find(u => u.providerUnitId === providerUnitId)!
    const verify = await request<Record<string, unknown>>('customer', 'GET', PROVISIONAL_API.endpoints.listings, {
      respond: () => ({
        status: 200,
        body: {
          listings: [{
            id: after.providerUnitId,
            pms: after.pms,
            base: after.provider.base,
            min: after.provider.min,
            max: after.provider.max,
            min_stay: after.provider.minStay,
          }],
        },
      }),
    })

    const readBack = (verify.body.listings as { base: number, min: number, max: number, min_stay: number }[])[0]
    const verified = !!readBack
      && readBack.base === after.desired.base
      && readBack.min === after.desired.min
      && readBack.max === after.desired.max
      && readBack.min_stay === after.desired.minStay

    patchFeed('settings', {
      state: verified ? 'live' : 'degraded',
      recordCount: changed.length,
      lastRunAt: nowIso(),
      detail: verified ? null : 'Read-back did not match the written value.',
    })

    return { written: changed.length, verified }
  }

  async function reconcileAll(): Promise<{ units: number, fields: number }> {
    let fields = 0
    let touched = 0
    for (const u of syncingUnits.value.filter(u => drift.value.some(d => d.providerUnitId === u.providerUnitId))) {
      const res = await reconcileUnit(u.providerUnitId)
      if (res.written > 0) {
        fields += res.written
        touched += 1
      }
    }
    return { units: touched, fields }
  }

  /** The sequence the real adapter runs on a schedule, in order. */
  async function runFullSync() {
    if (!connection.value)
      return
    await pushListings()
    await pushAvailability()
    await pushReservations()
    await pullPrices()
    await pullMarketData()
    connection.value = { ...connection.value, lastSyncAt: nowIso() }
  }

  /**
   * A provider-side edit, which is what drift actually is. Nudging the provider
   * value is the honest way to create one: nothing writes a drift record.
   */
  function simulateProviderEdit(): DriftRow[] {
    const target = syncingUnits.value[0]
    if (!target)
      return []
    units.value = units.value.map(u =>
      u.providerUnitId === target.providerUnitId
        ? { ...u, provider: { ...u.provider, base: Math.round(u.provider.base * 0.9) } }
        : u,
    )
    return drift.value
  }

  /** Inbound webhook, HMAC-signed. Logged like any other call so it is reviewable. */
  async function simulateInboundWebhook() {
    if (!connection.value)
      return
    const payload = {
      event: 'prices.updated',
      listings: syncingUnits.value.slice(0, 3).map(u => ({ id: u.providerUnitId, pms: u.pms })),
      sent_at: nowIso(),
    }
    await request('customer', 'POST', `/webhooks/pricelabs/${connection.value.webhookToken.slice(6)}`, {
      body: { ...payload, signature: `sha256=${randomToken('sig').slice(4, 28)}` },
      respond: () => ({ status: 200, body: { received: true, verified: true } }),
    })
    await pullPrices()
  }

  function setCapability(key: string, access: CapabilityAccess, note?: string) {
    capabilities.value = capabilities.value.map(c =>
      c.key === key
        ? { ...c, access, source: access === 'unverified' ? 'unverified' : 'documented', note: note ?? c.note }
        : c,
    )
  }

  const unverifiedCapabilityCount = computed(() => capabilities.value.filter(c => c.access === 'unverified').length)

  /**
   * Derived, never stored. A room's sync state is a consequence of the mapping,
   * the toggle, the drift and the last price we received, so storing it would
   * only let it go stale.
   */
  function syncStateForRoom(roomId: string): SyncState {
    if (!isConnected.value)
      return 'paused'
    const unit = units.value.find(u => u.roomId === roomId)
    if (!unit || !unit.syncEnabled)
      return 'paused'
    if (drift.value.some(d => d.providerUnitId === unit.providerUnitId))
      return 'degraded'
    if (!unit.lastPriceAt)
      return 'partial'
    return 'live'
  }

  const feedsNeedingAttention = computed(() =>
    feeds.value.filter(f => f.state === 'degraded' || f.state === 'paused').length,
  )

  function clearCalls() {
    calls.value = []
  }

  function disconnect() {
    connection.value = null
    units.value = []
    feeds.value = []
    calls.value = []
    if (import.meta.client) {
      localStorage.removeItem(CONNECTION_KEY)
      localStorage.removeItem(UNITS_KEY)
      localStorage.removeItem(FEEDS_KEY)
      localStorage.removeItem(CALLS_KEY)
    }
  }

  return {
    connection,
    units,
    feeds,
    capabilities,
    calls,
    isConnected,
    rooms,
    mappedUnits,
    syncingUnits,
    unmappedUnits,
    unmappedRooms,
    drift,
    unverifiedCapabilityCount,
    feedsNeedingAttention,
    baseUrlFor,
    connect,
    mapUnit,
    setSyncEnabled,
    pushListings,
    pushAvailability,
    pushReservations,
    pullPrices,
    pullMarketData,
    reconcileUnit,
    reconcileAll,
    runFullSync,
    simulateProviderEdit,
    simulateInboundWebhook,
    setCapability,
    syncStateForRoom,
    clearCalls,
    disconnect,
  }
}
