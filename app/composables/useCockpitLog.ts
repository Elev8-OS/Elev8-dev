import { useCurrentDashboardUser } from '~/composables/useCurrentDashboardUser'

/**
 * What users changed from the Cockpit, newest first, for the History sheet
 * (`CockpitHistorySheet.vue`). Each change records who made it (the signed-in
 * dashboard user) and when. Mock, in memory per session.
 */
export type CockpitLogKind = 'reservation' | 'block' | 'room' | 'override'

export interface CockpitLogEntry {
  id: string
  /** ISO time of the change. */
  at: string
  actor: string
  kind: CockpitLogKind
  /** "Override saved", "Stay moved to a room". */
  title: string
  /** The sentence: what, where, when. */
  detail: string
  listingName?: string
  /** Opens the reservation from the sheet, when there is one. */
  reservationId?: string
}

export const COCKPIT_LOG_KINDS: Array<{ key: CockpitLogKind, label: string, icon: string }> = [
  { key: 'reservation', label: 'Reservations', icon: 'lucide:calendar-plus' },
  { key: 'block', label: 'Blocks', icon: 'lucide:ban' },
  { key: 'room', label: 'Rooms', icon: 'lucide:door-open' },
  { key: 'override', label: 'Overrides', icon: 'lucide:sliders-horizontal' },
]

export function useCockpitLog() {
  const entries = useState<CockpitLogEntry[]>('cockpit-log', () => [])
  const { currentUser } = useCurrentDashboardUser()

  function logChange(input: Omit<CockpitLogEntry, 'id' | 'at' | 'actor'>) {
    const entry: CockpitLogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      at: new Date().toISOString(),
      actor: currentUser.value?.name ?? 'Someone',
      ...input,
    }
    entries.value = [entry, ...entries.value]
    return entry
  }

  return { entries, logChange }
}
