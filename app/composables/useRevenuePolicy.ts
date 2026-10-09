import type { CostFieldKey, PolicyVersion, PricingPolicy, RevenueRoom, RoomCostModel } from '~/components/revenue/data/revenue-policy'
import type { RevenueSettings } from '~/components/revenue/data/revenue-settings'
import { cleaningJobs } from '~/components/cleaning/data/cleaning-jobs'
import { managedRoomPolicies } from '~/components/revenue/data/managed-rooms'
import { clonePolicy, defaultPolicy, emptyCostModel } from '~/components/revenue/data/revenue-policy'

const STORAGE_KEY = 'elev8-revenue-policies'

/** The logged-in user, who signs every saved version. */
const CURRENT_USER = 'Komang Juliantara'

interface RoomRecord {
  versions: PolicyVersion[]
  cost: RoomCostModel
}

/**
 * The rooms already under revenue management start with the policy they were
 * set up with, so Listing Health, the pricing engine and the Revenue tab all
 * read the same numbers from the first load.
 */
function seedRecords(): Record<string, RoomRecord> {
  const savedAt = new Date(Date.now() - 30 * 86_400_000).toISOString()
  return Object.fromEntries(Object.entries(managedRoomPolicies()).map(([key, policy]) => [key, {
    versions: [{ version: 1, savedAt, savedBy: 'Elev8 onboarding', note: 'Imported at onboarding', policy }],
    cost: emptyCostModel(),
  }]))
}

/**
 * Per-room revenue settings: the versioned pricing policy and the cost model.
 * Edited in the listing's Revenue tab. A room nobody has saved yet reads a
 * default policy seeded from its base rate plan, and has no versions.
 */
export function useRevenuePolicy() {
  const records = useState<Record<string, RoomRecord>>('revenue-policies', seedRecords)
  const hydrated = useState<boolean>('revenue-policies-hydrated', () => false)

  function persist() {
    if (typeof localStorage === 'undefined')
      return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records.value))
    }
    catch { /* quota or private mode */ }
  }

  function hydrate() {
    if (hydrated.value || typeof localStorage === 'undefined')
      return
    hydrated.value = true
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw)
        records.value = { ...seedRecords(), ...JSON.parse(raw) as Record<string, RoomRecord> }
    }
    catch { /* corrupt entry: start empty */ }
  }

  function record(key: string): RoomRecord {
    return records.value[key] ?? { versions: [], cost: emptyCostModel() }
  }

  function writeRecord(key: string, next: RoomRecord) {
    records.value = { ...records.value, [key]: next }
    persist()
  }

  function versionsFor(key: string): PolicyVersion[] {
    return record(key).versions
  }

  function currentVersion(key: string): PolicyVersion | null {
    return record(key).versions.at(-1) ?? null
  }

  /** The policy in force: the last saved version, or the seeded default. */
  function policyFor(room: RevenueRoom): PricingPolicy {
    return clonePolicy(currentVersion(room.key)?.policy ?? defaultPolicy(room))
  }

  /** Appends a version. Versions are never edited, so a restore is a save too. */
  function savePolicy(key: string, policy: PricingPolicy, note = 'Saved'): PolicyVersion {
    const current = record(key)
    const version: PolicyVersion = {
      version: (current.versions.at(-1)?.version ?? 0) + 1,
      savedAt: new Date().toISOString(),
      savedBy: CURRENT_USER,
      note,
      policy: clonePolicy(policy),
    }
    writeRecord(key, { ...current, versions: [...current.versions, version] })
    return version
  }

  function restoreVersion(key: string, version: number, note = `Restored version ${version}`): PolicyVersion | null {
    const target = record(key).versions.find(v => v.version === version)
    return target ? savePolicy(key, target.policy, note) : null
  }

  /** Replaces the seasons of other rooms with these, as a new version each. */
  function copySeasons(from: RevenueRoom, policy: PricingPolicy, targets: RevenueRoom[]) {
    for (const room of targets) {
      const next = policyFor(room)
      next.seasons = clonePolicy(policy).seasons
      savePolicy(room.key, next, `Seasons copied from ${from.name}`)
    }
  }

  // ── Cost model ──────────────────────────────────────────────────────

  function costFor(key: string): RoomCostModel {
    return record(key).cost
  }

  function writeCost(key: string, cost: RoomCostModel) {
    writeRecord(key, { ...record(key), cost })
  }

  /** A value typed in for this room is a confirmed one: the person checked it. */
  function setCostOverride(key: string, field: CostFieldKey, value: number | null) {
    const cost = costFor(key)
    writeCost(key, { ...cost, fields: { ...cost.fields, [field]: { override: value, confirmed: value !== null } } })
  }

  function confirmCost(key: string, field: CostFieldKey) {
    const cost = costFor(key)
    writeCost(key, { ...cost, fields: { ...cost.fields, [field]: { ...cost.fields[field], confirmed: true } } })
  }

  function setCommissionOverride(key: string, channel: string, value: number | null) {
    const cost = costFor(key)
    writeCost(key, { ...cost, commission: { ...cost.commission, [channel]: { override: value, confirmed: value !== null } } })
  }

  function confirmCommission(key: string, channel: string) {
    const cost = costFor(key)
    const field = cost.commission[channel] ?? { override: null, confirmed: false }
    writeCost(key, { ...cost, commission: { ...cost.commission, [channel]: { ...field, confirmed: true } } })
  }

  return {
    records,
    hydrate,
    versionsFor,
    currentVersion,
    policyFor,
    savePolicy,
    restoreVersion,
    copySeasons,
    costFor,
    setCostOverride,
    confirmCost,
    setCommissionOverride,
    confirmCommission,
  }
}

/** Measured average cleaning time for a room, from finished cleans. Null with none. */
export function measuredCleaningMinutes(room: Pick<RevenueRoom, 'listingId' | 'unitId'>): number | null {
  const durations = cleaningJobs.value
    .filter(j => j.listingId === room.listingId && (!room.unitId || !j.unitId || j.unitId === room.unitId))
    .map(j => j.feedback?.cleaningDurationMinutes)
    .filter((m): m is number => typeof m === 'number' && m > 0)
  if (durations.length === 0)
    return null
  return Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
}

/** The derived starting value of each cost field, with where it came from (§22.1). */
export function derivedCosts(room: RevenueRoom, policyCurrency: string, costs: RevenueSettings['costs']) {
  const money = costs.byCurrency[policyCurrency]
  const measured = measuredCleaningMinutes(room)
  const minutes = measured ?? costs.defaultCleaningMinutes
  const hours = Math.round((minutes / 60) * 100) / 100
  const noDefaults = `No ${policyCurrency} cost defaults yet. Add them in Revenue settings > Costs.`
  return {
    cleaningPerTurnover: money
      ? {
          value: Math.round(money.housekeepingRatePerHour * (minutes / 60) * 100) / 100,
          source: `${hours}h ${measured ? 'measured' : 'default'} cleaning × housekeeping rate`,
        }
      : { value: null, source: noDefaults },
    consumablesPerStay: money
      ? { value: money.consumablesPerStay, source: 'Tenant default per stay' }
      : { value: null, source: noDefaults },
    paymentPct: { value: costs.paymentPct, source: 'Tenant default' },
    fixedPerNight: { value: null, source: 'Optional, for owner reporting' },
  } satisfies Record<CostFieldKey, { value: number | null, source: string }>
}
