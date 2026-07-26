import { staffMembers } from '~/components/inbox/data/conversations'
import { listings } from '~/components/listings/data/listings'

export type CleaningJobStatus = 'draft' | 'scheduled' | 'confirmed' | 'in_progress' | 'done' | 'cancelled' | 'missed'
export type CleaningJobPriority = 'low' | 'normal' | 'high' | 'urgent'
export type CleaningJobSource = 'manual' | 'checkout'
export type CleaningRecurrenceFrequency = 'weekly' | 'monthly'

export interface CleaningFeedback {
  cleanlinessRating: number // 1-5
  conditionNotes: string
  damages: string[]
  itemsLeft: string[]
  cleaningDurationMinutes: number
  housekeeperNotes: string
}

export interface CleaningJobRecurrence {
  enabled: boolean
  frequency: CleaningRecurrenceFrequency
  interval: number
}

export interface CleaningJob {
  id: string
  listingId: string
  listingName: string
  scheduledAt: string
  cleanerId: string | null
  cleanerName: string | null
  teamName: string | null
  status: CleaningJobStatus
  priority: CleaningJobPriority
  durationMinutes: number
  notes: string
  source: CleaningJobSource
  reservationId?: string | null
  recurrence?: CleaningJobRecurrence | null
  feedback?: CleaningFeedback | null
}

export type CleaningJobInput = Omit<CleaningJob, 'id' | 'feedback'>

export interface CleaningFilters {
  listingIds: string[]
  cleanerIds: string[]
  statuses: CleaningJobStatus[]
  priorities: CleaningJobPriority[]
}

export const cleaningJobStatusLabels: Record<CleaningJobStatus, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  confirmed: 'Confirmed',
  in_progress: 'In progress',
  done: 'Done',
  cancelled: 'Cancelled',
  missed: 'Missed',
}

export const cleaningJobPriorityLabels: Record<CleaningJobPriority, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
  urgent: 'Urgent',
}

export const cleaningJobSourceLabels: Record<CleaningJobSource, string> = {
  manual: 'Manual',
  checkout: 'Checkout',
}

export const cleaningJobStatusVariants: Record<CleaningJobStatus, 'outline' | 'default' | 'secondary' | 'destructive'> = {
  draft: 'outline',
  scheduled: 'secondary',
  confirmed: 'default',
  in_progress: 'default',
  done: 'outline',
  cancelled: 'destructive',
  missed: 'destructive',
}

export const cleaningJobPriorityVariants: Record<CleaningJobPriority, 'outline' | 'secondary' | 'default' | 'destructive'> = {
  low: 'outline',
  normal: 'secondary',
  high: 'default',
  urgent: 'destructive',
}

export const cleanerOptions = staffMembers
  .filter(member => member.id !== 'staff-1')
  .map(member => ({
    id: member.id,
    name: member.name,
    role: member.role,
  }))

export const cleaningJobs = ref<CleaningJob[]>([
  // --- June 22 (past) ---
  {
    id: 'cln-1',
    listingId: 'lst-1',
    listingName: '5BR Pool the R Villa Luwa – Serene near Canggu',
    scheduledAt: '2026-06-22T09:00:00+08:00',
    cleanerId: 'staff-3',
    cleanerName: 'Made Surya, Wayan Adi',
    teamName: 'Housekeeping',
    status: 'done',
    priority: 'high',
    durationMinutes: 120,
    notes: 'Completed on time',
    source: 'manual',
    reservationId: null,
    recurrence: null,
    feedback: {
      cleanlinessRating: 5,
      conditionNotes: 'Property left very clean. Kitchen spotless, beds made, towels folded. Minor sand on the floor near the entrance.',
      damages: [],
      itemsLeft: ['Sunglasses on nightstand - placed in lost & found'],
      cleaningDurationMinutes: 120,
      housekeeperNotes: 'Guests were very tidy. Easy clean.',
    },
  },
  {
    id: 'cln-5',
    listingId: 'lst-5',
    listingName: 'Nomad Mansion Garden',
    scheduledAt: '2026-06-22T13:52:00+08:00',
    cleanerId: 'staff-3',
    cleanerName: 'Made Surya',
    teamName: 'Housekeeping',
    status: 'done',
    priority: 'normal',
    durationMinutes: 90,
    notes: 'Completed',
    source: 'manual',
    reservationId: null,
    recurrence: null,
    feedback: {
      cleanlinessRating: 4,
      conditionNotes: 'Overall clean. Kitchen had some unwashed dishes in the sink. Towels left on the bathroom floor.',
      damages: [],
      itemsLeft: [],
      cleaningDurationMinutes: 90,
      housekeeperNotes: 'Slightly messier than usual but nothing concerning.',
    },
  },
  {
    id: 'cln-12',
    listingId: 'lst-12',
    listingName: 'Surf Shack Canggu',
    scheduledAt: '2026-06-22T14:23:00+08:00',
    cleanerId: 'staff-4',
    cleanerName: 'Wayan Adi',
    teamName: 'Housekeeping',
    status: 'done',
    priority: 'normal',
    durationMinutes: 150,
    notes: 'Completed',
    source: 'manual',
    reservationId: null,
    recurrence: null,
    feedback: {
      cleanlinessRating: 3,
      conditionNotes: 'Sand throughout the living room. Dishes piled in the sink. Bathroom had water on the floor. Pool towels left outside overnight.',
      damages: ['Small scratch on the glass coffee table'],
      itemsLeft: ['Phone charger (USB-C) - returned to guest via Airbnb message'],
      cleaningDurationMinutes: 150,
      housekeeperNotes: 'Guests used the property heavily. Extra effort needed for kitchen and bathroom.',
    },
  },
  {
    id: 'cln-24',
    listingId: 'lst-15',
    listingName: 'Luxury Penthouse Seminyak',
    scheduledAt: '2026-06-22T11:02:00+08:00',
    cleanerId: null,
    cleanerName: null,
    teamName: 'Housekeeping',
    status: 'missed',
    priority: 'normal',
    durationMinutes: 90,
    notes: 'No cleaner assigned, missed deadline',
    source: 'manual',
    reservationId: null,
    recurrence: null,
  },
  // --- June 23 (today) ---
  {
    id: 'cln-13',
    listingId: 'lst-13',
    listingName: 'Volcano View Villa Kintamani',
    scheduledAt: '2026-06-23T09:36:00+08:00',
    cleanerId: 'staff-3',
    cleanerName: 'Made Surya, Komang Juliantara',
    teamName: 'Housekeeping',
    status: 'in_progress',
    priority: 'high',
    durationMinutes: 180,
    notes: 'In progress',
    source: 'manual',
    reservationId: null,
    recurrence: null,
  },
  {
    id: 'cln-25',
    listingId: 'lst-16',
    listingName: 'Eco Bamboo House Ubud',
    scheduledAt: '2026-06-23T10:15:00+08:00',
    cleanerId: 'staff-4',
    cleanerName: 'Wayan Adi',
    teamName: 'Housekeeping',
    status: 'in_progress',
    priority: 'normal',
    durationMinutes: 120,
    notes: 'In progress',
    source: 'manual',
    reservationId: null,
    recurrence: null,
  },
  {
    id: 'cln-2',
    listingId: 'lst-2',
    listingName: 'Apartments Pool',
    scheduledAt: '2026-06-23T10:13:00+08:00',
    cleanerId: null,
    cleanerName: null,
    teamName: 'Housekeeping',
    status: 'scheduled',
    priority: 'normal',
    durationMinutes: 150,
    notes: 'Needs cleaner assignment',
    source: 'manual',
    reservationId: null,
    recurrence: null,
  },
  {
    id: 'cln-6',
    listingId: 'lst-6',
    listingName: 'Nomad Mansion Pool',
    scheduledAt: '2026-06-23T14:05:00+08:00',
    cleanerId: null,
    cleanerName: null,
    teamName: 'Housekeeping',
    status: 'scheduled',
    priority: 'normal',
    durationMinutes: 120,
    notes: 'Needs cleaner assignment',
    source: 'manual',
    reservationId: null,
    recurrence: null,
  },
  // --- June 24 (future) ---
  {
    id: 'cln-3',
    listingId: 'lst-3',
    listingName: 'The R Pererenan Mezzanine Studio + Plunge Pool',
    scheduledAt: '2026-06-24T11:26:00+08:00',
    cleanerId: 'staff-3',
    cleanerName: 'Made Surya',
    teamName: 'Housekeeping',
    status: 'scheduled',
    priority: 'normal',
    durationMinutes: 180,
    notes: 'Scheduled cleaning',
    source: 'manual',
    reservationId: null,
    recurrence: null,
  },
  {
    id: 'cln-7',
    listingId: 'lst-7',
    listingName: 'Apartments Main',
    scheduledAt: '2026-06-24T09:18:00+08:00',
    cleanerId: 'staff-3',
    cleanerName: 'Made Surya',
    teamName: 'Housekeeping',
    status: 'scheduled',
    priority: 'high',
    durationMinutes: 150,
    notes: 'Scheduled cleaning',
    source: 'manual',
    reservationId: null,
    recurrence: null,
  },
  {
    id: 'cln-14',
    listingId: 'lst-14',
    listingName: 'The R Canggu Riverside',
    scheduledAt: '2026-06-24T10:49:00+08:00',
    cleanerId: 'staff-4',
    cleanerName: 'Wayan Adi',
    teamName: 'Housekeeping',
    status: 'scheduled',
    priority: 'normal',
    durationMinutes: 120,
    notes: 'Scheduled cleaning',
    source: 'manual',
    reservationId: null,
    recurrence: null,
  },
  // --- June 25 (future) ---
  {
    id: 'cln-4',
    listingId: 'lst-4',
    listingName: 'The R Villa Merapi',
    scheduledAt: '2026-06-25T12:39:00+08:00',
    cleanerId: 'staff-4',
    cleanerName: 'Wayan Adi',
    teamName: 'Housekeeping',
    status: 'scheduled',
    priority: 'high',
    durationMinutes: 120,
    notes: 'Scheduled cleaning',
    source: 'manual',
    reservationId: null,
    recurrence: null,
  },
  {
    id: 'cln-8',
    listingId: 'lst-8',
    listingName: 'Villa Sunset Cliff',
    scheduledAt: '2026-06-25T10:31:00+08:00',
    cleanerId: 'staff-4',
    cleanerName: 'Wayan Adi',
    teamName: 'Housekeeping',
    status: 'scheduled',
    priority: 'normal',
    durationMinutes: 180,
    notes: 'Scheduled cleaning',
    source: 'manual',
    reservationId: null,
    recurrence: null,
  },
  // --- June 26 (future) ---
  {
    id: 'cln-9',
    listingId: 'lst-9',
    listingName: 'Jungle Treehouse Retreat',
    scheduledAt: '2026-06-26T11:44:00+08:00',
    cleanerId: 'staff-3',
    cleanerName: 'Made Surya',
    teamName: 'Housekeeping',
    status: 'scheduled',
    priority: 'normal',
    durationMinutes: 120,
    notes: 'Scheduled cleaning',
    source: 'manual',
    reservationId: null,
    recurrence: null,
  },
  {
    id: 'cln-15',
    listingId: 'lst-15',
    listingName: 'Luxury Penthouse Seminyak',
    scheduledAt: '2026-06-26T11:02:00+08:00',
    cleanerId: 'staff-3',
    cleanerName: 'Made Surya',
    teamName: 'Housekeeping',
    status: 'scheduled',
    priority: 'normal',
    durationMinutes: 90,
    notes: 'Scheduled cleaning',
    source: 'manual',
    reservationId: null,
    recurrence: null,
  },
  // --- June 27 (future) ---
  {
    id: 'cln-10',
    listingId: 'lst-10',
    listingName: 'Beachfront Bungalow Seminyak',
    scheduledAt: '2026-06-27T12:57:00+08:00',
    cleanerId: null,
    cleanerName: null,
    teamName: 'Housekeeping',
    status: 'scheduled',
    priority: 'high',
    durationMinutes: 90,
    notes: 'Needs cleaner assignment',
    source: 'manual',
    reservationId: null,
    recurrence: null,
  },
  {
    id: 'cln-17',
    listingId: 'lst-17',
    listingName: 'Apartments Pool - Room 2',
    scheduledAt: '2026-06-27T10:00:00+08:00',
    cleanerId: 'staff-3',
    cleanerName: 'Made Surya',
    teamName: 'Housekeeping',
    status: 'scheduled',
    priority: 'normal',
    durationMinutes: 120,
    notes: 'Scheduled cleaning',
    source: 'manual',
    reservationId: null,
    recurrence: null,
  },
  // --- June 28 (future) ---
  {
    id: 'cln-11',
    listingId: 'lst-11',
    listingName: 'Villa Rice Terrace Jimbaran',
    scheduledAt: '2026-06-28T13:10:00+08:00',
    cleanerId: 'staff-3',
    cleanerName: 'Made Surya',
    teamName: 'Housekeeping',
    status: 'scheduled',
    priority: 'normal',
    durationMinutes: 120,
    notes: 'Scheduled cleaning',
    source: 'manual',
    reservationId: null,
    recurrence: null,
  },
  {
    id: 'cln-18',
    listingId: 'lst-18',
    listingName: 'Apartments Pool - Room 3',
    scheduledAt: '2026-06-28T11:00:00+08:00',
    cleanerId: 'staff-4',
    cleanerName: 'Wayan Adi',
    teamName: 'Housekeeping',
    status: 'scheduled',
    priority: 'normal',
    durationMinutes: 120,
    notes: 'Scheduled cleaning',
    source: 'manual',
    reservationId: null,
    recurrence: null,
  },
  {
    id: 'cln-19',
    listingId: 'lst-19',
    listingName: 'Surf Shack Canggu - Unit 2',
    scheduledAt: '2026-06-28T15:00:00+08:00',
    cleanerId: 'staff-3',
    cleanerName: 'Made Surya',
    teamName: 'Housekeeping',
    status: 'scheduled',
    priority: 'normal',
    durationMinutes: 90,
    notes: 'Scheduled cleaning',
    source: 'manual',
    reservationId: null,
    recurrence: null,
  },
])

export const cleaningJobStatuses: CleaningJobStatus[] = ['draft', 'scheduled', 'confirmed', 'in_progress', 'done', 'cancelled']

export function getListingName(listingId: string) {
  return listings.value.find(listing => listing.id === listingId)?.name ?? listingId
}

export function getWeekDays(anchorDate = new Date()) {
  const start = new Date(anchorDate)
  const day = start.getDay()
  const diff = start.getDate() - day + (day === 0 ? -6 : 1)
  start.setDate(diff)
  start.setHours(0, 0, 0, 0)

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return {
      key: date.toISOString().slice(0, 10),
      label: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
      date,
    }
  })
}

export function formatTime(value: string) {
  return new Date(value).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export function formatDateKey(value: string) {
  return value.slice(0, 10)
}

export function formatWeekRange(days: Array<{ date: Date }>) {
  if (!days.length)
    return ''
  const startDay = days[0]
  const endDay = days[days.length - 1]
  if (!startDay || !endDay)
    return ''
  const start = startDay.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const end = endDay.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${start} - ${end}`
}

export function getListingColorIndex(listingId: string) {
  const sum = listingId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return sum % 5
}

export function getStatusTone(status: CleaningJobStatus) {
  return cleaningJobStatusVariants[status]
}
