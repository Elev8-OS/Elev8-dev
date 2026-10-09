import type { ObjectiveBasis } from '~/components/revenue/data/health'
import type { AutonomyRule, AutonomySettings, Blackout, CalendarEvent, CalendarReview, ChannelMarkup, CurrencyCostDefaults, RevenueSettings } from '~/components/revenue/data/revenue-settings'
import { computed } from 'vue'
import { listings } from '~/components/listings/data/listings'
import { revenueRooms } from '~/components/revenue/data/revenue-policy'
import { channelOptions, seedRevenueSettings, substitutionGroups } from '~/components/revenue/data/revenue-settings'

const STORAGE_KEY = 'elev8-revenue-settings'

/**
 * Tenant-level revenue engine settings, edited at `/revenue/settings`.
 * Every change saves at once. Persisted to localStorage, read back by
 * `hydrate()` from the page's `onMounted` (never during SSR).
 */
export function useRevenueSettings() {
  const settings = useState<RevenueSettings>('revenue-settings', () => seedRevenueSettings())
  const hydrated = useState<boolean>('revenue-settings-hydrated', () => false)

  const rooms = computed(() => revenueRooms(listings.value))
  const channels = computed(() => channelOptions(rooms.value))
  const groups = computed(() => substitutionGroups(rooms.value, settings.value.substitution))

  // Guarded on storage availability rather than `import.meta.client`, which
  // Vitest does not substitute.
  function persist() {
    if (typeof localStorage === 'undefined')
      return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings.value))
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
        settings.value = { ...seedRevenueSettings(), ...JSON.parse(raw) as Partial<RevenueSettings> }
    }
    catch { /* corrupt entry: keep the seed */ }
  }

  function patch(next: Partial<RevenueSettings>) {
    settings.value = { ...settings.value, ...next }
    persist()
  }

  function setDefaultBasis(basis: ObjectiveBasis) {
    patch({ defaultBasis: basis })
  }

  // Autonomy
  function patchAutonomy(next: Partial<AutonomySettings>) {
    patch({ autonomy: { ...settings.value.autonomy, ...next } })
  }

  function saveAutonomyRule(rule: AutonomyRule) {
    const rules = settings.value.autonomy.rules
    patchAutonomy({ rules: rules.some(r => r.id === rule.id) ? rules.map(r => r.id === rule.id ? rule : r) : [...rules, rule] })
  }

  function removeAutonomyRule(id: string) {
    patchAutonomy({ rules: settings.value.autonomy.rules.filter(r => r.id !== id) })
  }

  // Blackouts
  function saveBlackout(blackout: Blackout) {
    const list = settings.value.blackouts
    const next = list.some(b => b.id === blackout.id) ? list.map(b => b.id === blackout.id ? blackout : b) : [...list, blackout]
    patch({ blackouts: [...next].sort((a, b) => a.from.localeCompare(b.from)) })
  }

  function removeBlackout(id: string) {
    patch({ blackouts: settings.value.blackouts.filter(b => b.id !== id) })
  }

  // Channel markups
  function saveMarkup(markup: ChannelMarkup) {
    const list = settings.value.markups
    patch({ markups: list.some(m => m.id === markup.id) ? list.map(m => m.id === markup.id ? markup : m) : [...list, markup] })
  }

  function removeMarkup(id: string) {
    patch({ markups: settings.value.markups.filter(m => m.id !== id) })
  }

  // Substitution groups
  /** `groupKey` null puts the room back where it was derived. */
  function moveRoom(roomKey: string, groupKey: string | null) {
    const { [roomKey]: _drop, ...rest } = settings.value.substitution.moves
    patch({ substitution: { ...settings.value.substitution, moves: groupKey === null ? rest : { ...rest, [roomKey]: groupKey } } })
  }

  function renameGroup(groupKey: string, name: string) {
    patch({ substitution: { ...settings.value.substitution, names: { ...settings.value.substitution.names, [groupKey]: name } } })
  }

  function resetGroups() {
    patch({ substitution: { moves: {}, names: {} } })
  }

  // Cost defaults
  function setCurrencyDefaults(currency: string, next: Partial<CurrencyCostDefaults>) {
    const costs = settings.value.costs
    const current = costs.byCurrency[currency] ?? { housekeepingRatePerHour: 0, consumablesPerStay: 0 }
    patch({ costs: { ...costs, byCurrency: { ...costs.byCurrency, [currency]: { ...current, ...next } } } })
  }

  function patchCosts(next: Partial<RevenueSettings['costs']>) {
    patch({ costs: { ...settings.value.costs, ...next } })
  }

  function setCommission(channel: string, pct: number) {
    patchCosts({ commissionByChannel: { ...settings.value.costs.commissionByChannel, [channel]: pct } })
  }

  // Events calendar
  function saveEvent(event: CalendarEvent) {
    const list = settings.value.events
    const next = list.some(e => e.id === event.id) ? list.map(e => e.id === event.id ? event : e) : [...list, event]
    patch({ events: [...next].sort((a, b) => a.from.localeCompare(b.from)) })
  }

  function removeEvent(id: string) {
    patch({ events: settings.value.events.filter(e => e.id !== id || e.source === 'elev8') })
  }

  function setEventHidden(id: string, hidden: boolean) {
    patch({ events: settings.value.events.map(e => e.id === id ? { ...e, hidden } : e) })
  }

  function patchReview(next: Partial<CalendarReview>) {
    patch({ review: { ...settings.value.review, ...next } })
  }

  function markReviewed() {
    patchReview({ lastReviewedAt: new Date().toISOString() })
  }

  return {
    settings,
    rooms,
    channels,
    groups,
    hydrate,
    setDefaultBasis,
    patchAutonomy,
    saveAutonomyRule,
    removeAutonomyRule,
    saveBlackout,
    removeBlackout,
    saveMarkup,
    removeMarkup,
    moveRoom,
    renameGroup,
    resetGroups,
    setCurrencyDefaults,
    patchCosts,
    setCommission,
    saveEvent,
    removeEvent,
    setEventHidden,
    patchReview,
    markReviewed,
  }
}
