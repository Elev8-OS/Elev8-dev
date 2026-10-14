import type { ListingCleaningConfig } from '~/components/reservations/data/cleaning-schedule'
import { DEFAULT_VACANT_CLEANING } from '~/components/reservations/data/cleaning-schedule'

export const CLEANING_SCHEDULE_DEFAULT_STORAGE_KEY = 'elev8-cleaning-schedule-default-v1'

/**
 * What a new tenant starts with, active at once: one check-out cleaning per
 * booking at 11:00. Empty-day upkeep (Monday and Thursday,
 * `DEFAULT_VACANT_CLEANING`) is kept ready for a switch to the daily routine;
 * it does nothing while the schedule is check-out.
 */
export const SEED_CLEANING_SCHEDULE_DEFAULT: ListingCleaningConfig = { type: 'checkout', startOffset: 'check_in', time: '11:00', vacant: { ...DEFAULT_VACANT_CLEANING, weekDays: [...DEFAULT_VACANT_CLEANING.weekDays!] } }

function loadInitial(): ListingCleaningConfig {
  if (typeof localStorage !== 'undefined') {
    try {
      const parsed = JSON.parse(localStorage.getItem(CLEANING_SCHEDULE_DEFAULT_STORAGE_KEY) ?? 'null')
      if (parsed && typeof parsed === 'object' && parsed.type)
        return parsed as ListingCleaningConfig
    }
    catch {
      // Unreadable storage: fall back to the seed.
    }
  }
  return { ...SEED_CLEANING_SCHEDULE_DEFAULT }
}

/**
 * The company default for "cleaning for new bookings". A listing's own
 * `maintenance.defaultCleaningSchedule` overrides it; `scheduleFor` is the one
 * place that picks between them (new bookings in `useReservationsModule`, the
 * reservation's schedule dialog, the listing's Maintenance tab).
 */
export function useCleaningScheduleDefault() {
  const companyDefault = useState<ListingCleaningConfig>('cleaning-schedule-default', () => loadInitial())

  function setCompanyDefault(config: ListingCleaningConfig) {
    companyDefault.value = JSON.parse(JSON.stringify(config))
    if (typeof localStorage === 'undefined')
      return
    try {
      localStorage.setItem(CLEANING_SCHEDULE_DEFAULT_STORAGE_KEY, JSON.stringify(companyDefault.value))
    }
    catch {
      // Quota or unavailable storage: the in-memory default still works.
    }
  }

  /** The listing's own schedule, else the company default. */
  function scheduleFor(listing: { maintenance?: { defaultCleaningSchedule?: ListingCleaningConfig } } | null | undefined): ListingCleaningConfig {
    return listing?.maintenance?.defaultCleaningSchedule ?? companyDefault.value
  }

  return { companyDefault, setCompanyDefault, scheduleFor }
}
