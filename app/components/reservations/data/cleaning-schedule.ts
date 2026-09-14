import type { CleaningJobInput } from '~/components/cleaning/data/cleaning-jobs'

export type ReservationCleaningType = 'daily' | 'checkout' | 'custom'
export type CustomCleaningFrequency = 'day' | 'week'
export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'

export interface CustomCleaningSettings {
  frequency: CustomCleaningFrequency
  /** For frequency === 'day': repeat interval in days (1 = everyday, 2 = every 2 days, 3 = every 3 days...) */
  dayInterval?: number
  /** For frequency === 'week': specific days of week to clean on */
  weekDays?: DayOfWeek[]
}

export interface ReservationCleaningSchedule {
  type: ReservationCleaningType
  /** Date when cleaning begins (ISO date YYYY-MM-DD) */
  startDate: string
  /** Preferred time of day ("HH:MM"), default "11:00" */
  time?: string
  /** Configuration when type === 'custom' */
  custom?: CustomCleaningSettings
  /** Staff cleaner ID or 'unassigned' (single/primary, kept for backward compatibility) */
  assigneeId?: string
  /** Multiple staff cleaner IDs */
  assigneeIds?: string[]
}

export interface ListingCleaningConfig {
  type: ReservationCleaningType
  /** 'check_in' (default) or 'day_after_check_in' */
  startOffset?: 'check_in' | 'day_after_check_in'
  /** Preferred time of day, default "11:00" */
  time?: string
  /** Default cleaner ID from staff, or 'unassigned' */
  assigneeId?: string
  /** Multiple default staff cleaner IDs */
  assigneeIds?: string[]
  /** Configuration when type === 'custom' */
  custom?: CustomCleaningSettings
}

export const DAY_OF_WEEK_OPTIONS: { id: DayOfWeek, label: string, short: string, dayIndex: number }[] = [
  { id: 'monday', label: 'Monday', short: 'Mon', dayIndex: 1 },
  { id: 'tuesday', label: 'Tuesday', short: 'Tue', dayIndex: 2 },
  { id: 'wednesday', label: 'Wednesday', short: 'Wed', dayIndex: 3 },
  { id: 'thursday', label: 'Thursday', short: 'Thu', dayIndex: 4 },
  { id: 'friday', label: 'Friday', short: 'Fri', dayIndex: 5 },
  { id: 'saturday', label: 'Saturday', short: 'Sat', dayIndex: 6 },
  { id: 'sunday', label: 'Sunday', short: 'Sun', dayIndex: 0 },
]

export const DAY_INDEX_TO_ID: Record<number, DayOfWeek> = {
  0: 'sunday',
  1: 'monday',
  2: 'tuesday',
  3: 'wednesday',
  4: 'thursday',
  5: 'friday',
  6: 'saturday',
}

export const CLEANING_TYPE_OPTIONS: {
  type: ReservationCleaningType
  label: string
  icon: string
  description: string
}[] = [
  {
    type: 'daily',
    label: 'Daily cleaning',
    icon: 'lucide:calendar-days',
    description: 'Clean everyday during the stay',
  },
  {
    type: 'checkout',
    label: 'Checkout cleaning',
    icon: 'lucide:log-out',
    description: 'Turnover cleaning on checkout day',
  },
  {
    type: 'custom',
    label: 'Custom cleaning',
    icon: 'lucide:settings-2',
    description: 'Custom interval (days) or specific weekdays',
  },
]

/**
 * Computes ISO date strings (YYYY-MM-DD) for all cleanings scheduled within a stay.
 */
export function computeCleaningDates(options: {
  type: ReservationCleaningType
  startDate: string
  checkIn: string
  checkOut: string
  custom?: CustomCleaningSettings
}): string[] {
  const { type, startDate, checkOut, custom } = options

  if (!startDate || !checkOut)
    return []

  const parseDate = (d: string) => {
    const [y, m, day] = d.slice(0, 10).split('-').map(Number)
    return new Date(y, m - 1, day)
  }

  const start = parseDate(startDate)
  const end = parseDate(checkOut)

  if (start > end)
    return []

  const formatDate = (d: Date) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  const addDaysToDate = (d: Date, n: number) => {
    const next = new Date(d.getTime())
    next.setDate(next.getDate() + n)
    return next
  }

  const dates: string[] = []

  if (type === 'checkout') {
    dates.push(formatDate(end))
    return dates
  }

  if (type === 'daily') {
    for (let cur = new Date(start.getTime()); cur <= end; cur = addDaysToDate(cur, 1)) {
      dates.push(formatDate(cur))
    }
    return dates
  }

  if (type === 'custom') {
    const frequency = custom?.frequency || 'day'

    if (frequency === 'day') {
      const interval = Math.max(1, custom?.dayInterval || 1)
      for (let cur = new Date(start.getTime()); cur <= end; cur = addDaysToDate(cur, interval)) {
        dates.push(formatDate(cur))
      }
      return dates
    }

    if (frequency === 'week') {
      const selectedDays = custom?.weekDays || []
      if (!selectedDays.length)
        return []

      const targetDayIndices = new Set(
        selectedDays
          .map(id => DAY_OF_WEEK_OPTIONS.find(o => o.id === id)?.dayIndex)
          .filter((i): i is number => i !== undefined),
      )

      for (let cur = new Date(start.getTime()); cur <= end; cur = addDaysToDate(cur, 1)) {
        if (targetDayIndices.has(cur.getDay())) {
          dates.push(formatDate(cur))
        }
      }
      return dates
    }
  }

  return dates
}

/**
 * Returns a human-friendly one-line summary of the cleaning schedule.
 */
export function formatCleaningScheduleSummary(
  schedule: ReservationCleaningSchedule,
  checkOut?: string,
): string {
  const fmtDate = (iso?: string) => {
    if (!iso)
      return ''
    const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
    const date = new Date(y, m - 1, d)
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  }

  const timeStr = schedule.time ? ` at ${schedule.time}` : ''

  if (schedule.type === 'checkout') {
    const targetDate = schedule.startDate || checkOut
    return `Check-out cleaning • ${fmtDate(targetDate)}${timeStr}`
  }

  if (schedule.type === 'daily') {
    return `Daily cleaning • Starts ${fmtDate(schedule.startDate)}${timeStr}`
  }

  if (schedule.type === 'custom') {
    const freq = schedule.custom?.frequency || 'day'
    if (freq === 'day') {
      const interval = schedule.custom?.dayInterval || 1
      if (interval === 1)
        return `Every day • Starts ${fmtDate(schedule.startDate)}${timeStr}`
      return `Every ${interval} days • Starts ${fmtDate(schedule.startDate)}${timeStr}`
    }
    if (freq === 'week') {
      const days = schedule.custom?.weekDays || []
      const dayNames = days.map((d) => {
        const opt = DAY_OF_WEEK_OPTIONS.find(o => o.id === d)
        return opt ? opt.short : d
      })
      const daysLabel = dayNames.length ? dayNames.join(', ') : 'No days'
      return `Weekly (${daysLabel}) • Starts ${fmtDate(schedule.startDate)}${timeStr}`
    }
  }

  return 'Custom cleaning schedule'
}

export function resolveDefaultCleaningSchedule(
  config?: ListingCleaningConfig | null,
  checkIn?: string,
): ReservationCleaningSchedule {
  const type = config?.type ?? 'daily'
  const time = config?.time || '11:00'
  const assigneeIds = config?.assigneeIds && config.assigneeIds.length
    ? config.assigneeIds.filter(id => id && id !== 'unassigned')
    : (config?.assigneeId && config.assigneeId !== 'unassigned' ? [config.assigneeId] : [])
  const assigneeId = assigneeIds[0] || 'unassigned'

  let startDate = checkIn ? checkIn.slice(0, 10) : ''
  if (config?.startOffset === 'day_after_check_in' && startDate) {
    const [y, m, d] = startDate.split('-').map(Number)
    const dt = new Date(y, m - 1, d)
    dt.setDate(dt.getDate() + 1)
    const yyyy = dt.getFullYear()
    const mm = String(dt.getMonth() + 1).padStart(2, '0')
    const dd = String(dt.getDate()).padStart(2, '0')
    startDate = `${yyyy}-${mm}-${dd}`
  }

  const custom: CustomCleaningSettings = config?.custom
    ? {
        frequency: config.custom.frequency ?? 'day',
        dayInterval: config.custom.dayInterval ?? 2,
        weekDays: config.custom.weekDays ? [...config.custom.weekDays] : ['monday', 'thursday', 'friday'],
      }
    : {
        frequency: 'day',
        dayInterval: 2,
        weekDays: ['monday', 'thursday', 'friday'],
      }

  return {
    type,
    startDate,
    time,
    assigneeId,
    assigneeIds,
    custom: type === 'custom' ? custom : undefined,
  }
}

export function formatListingCleaningSummary(config?: ListingCleaningConfig | null): string {
  if (!config)
    return 'Not configured'

  const timeStr = config.time ? ` at ${config.time}` : ''
  const startStr = config.startOffset === 'day_after_check_in' ? 'Starts day after check-in' : 'Starts on check-in'

  if (config.type === 'daily')
    return `Daily cleaning • ${startStr}${timeStr}`

  if (config.type === 'checkout')
    return `Checkout cleaning • On departure${timeStr}`

  if (config.type === 'custom') {
    if (config.custom?.frequency === 'week' && config.custom.weekDays?.length) {
      const days = config.custom.weekDays
        .map(d => DAY_OF_WEEK_OPTIONS.find(o => o.id === d)?.short ?? d)
        .join(', ')
      return `Weekly (${days}) • ${startStr}${timeStr}`
    }
    const interval = config.custom?.dayInterval ?? 2
    const intervalLabel = interval === 1 ? 'Every day' : `Every ${interval} days`
    return `${intervalLabel} • ${startStr}${timeStr}`
  }

  return 'Custom cleaning schedule'
}

export interface CleaningScheduleReservationTarget {
  id: string
  listingId: string
  listingName: string
  guestName?: string
  checkIn: string
  checkOut: string
}

/**
 * Generates array of CleaningJobInput records matching the schedule.
 */
export function generateCleaningJobsForReservation(params: {
  reservation: CleaningScheduleReservationTarget
  schedule: ReservationCleaningSchedule
  cleaners: { id: string, name: string }[]
}): CleaningJobInput[] {
  const { reservation, schedule, cleaners } = params
  const dates = computeCleaningDates({
    type: schedule.type,
    startDate: schedule.startDate,
    checkIn: reservation.checkIn,
    checkOut: reservation.checkOut,
    custom: schedule.custom,
  })

  const time = schedule.time || '11:00'
  const resolvedIds = schedule.assigneeIds && schedule.assigneeIds.length
    ? schedule.assigneeIds.filter(id => id && id !== 'unassigned')
    : (schedule.assigneeId && schedule.assigneeId !== 'unassigned' ? [schedule.assigneeId] : [])

  const assignees = resolvedIds
    .map(id => cleaners.find(c => c.id === id))
    .filter((c): c is { id: string, name: string } => Boolean(c))

  const cleanerIds = assignees.map(c => c.id)
  const cleanerNames = assignees.map(c => c.name)

  const source = schedule.type === 'daily'
    ? 'daily'
    : schedule.type === 'checkout'
      ? 'checkout'
      : 'custom'

  const label = schedule.type === 'daily'
    ? 'Daily cleaning'
    : schedule.type === 'checkout'
      ? 'Check-out cleaning'
      : 'Custom cleaning'

  const priority = schedule.type === 'checkout' ? 'high' : 'normal'

  return dates.map((date) => {
    return {
      listingId: reservation.listingId,
      listingName: reservation.listingName,
      scheduledAt: `${date}T${time}:00+08:00`,
      cleanerIds,
      cleanerNames,
      teamName: 'Housekeeping',
      status: 'scheduled',
      priority,
      durationMinutes: 180,
      notes: `${label} for reservation ${reservation.id} (${reservation.guestName})`,
      source,
      reservationId: reservation.id,
      recurrence: null,
      releaseAt: null,
    }
  })
}
