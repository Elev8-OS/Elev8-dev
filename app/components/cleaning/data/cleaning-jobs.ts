import { staffMembers } from '~/components/inbox/data/conversations'
import { listings } from '~/components/listings/data/listings'

export type CleaningJobStatus = 'draft' | 'scheduled' | 'confirmed' | 'in_progress' | 'done' | 'cancelled' | 'missed'
export type CleaningJobPriority = 'low' | 'normal' | 'high' | 'urgent'
export type CleaningJobSource
  = | 'manual' // legacy alias for ad-hoc / custom cleanings
    | 'checkout' // legacy alias for check-out cleanings
    | 'daily' // recurring daily housekeeping
    | 'check_out' // turn-over cleaning after a guest checks out
    | 'mid_stay' // mid-stay housekeeping (e.g. 5+ night stays)
    | 'custom' // one-off / ad-hoc cleaning

export const CLEANING_SOURCE_LABELS: Record<CleaningJobSource, string> = {
  daily: 'Daily cleaning',
  check_out: 'Check-out cleaning',
  mid_stay: 'Mid-stay cleaning',
  custom: 'Custom cleaning',
  manual: 'Custom cleaning', // legacy alias
  checkout: 'Check-out cleaning', // legacy alias
}

export const CLEANING_SOURCE_ICONS: Record<CleaningJobSource, string> = {
  daily: 'lucide:calendar-days',
  check_out: 'lucide:log-out',
  mid_stay: 'lucide:clock-4',
  custom: 'lucide:settings-2',
  manual: 'lucide:settings-2',
  checkout: 'lucide:log-out',
}

export const CLEANING_SOURCE_VARIANTS: Record<CleaningJobSource, 'default' | 'secondary' | 'outline'> = {
  daily: 'secondary',
  check_out: 'default',
  mid_stay: 'secondary',
  custom: 'outline',
  manual: 'outline',
  checkout: 'default',
}
export type CleaningRecurrenceFrequency = 'weekly' | 'monthly'

export type CleaningChecklistItemStatus = 'ok' | 'issue' | 'na'

export interface CleaningChecklistItem {
  id: string
  label: string
  status: CleaningChecklistItemStatus
  notes?: string
  completedBy?: string
  completedAt?: string
}

export interface CleaningChecklistGroup {
  id: string
  title: string
  items: CleaningChecklistItem[]
}

export interface CleaningFeedback {
  cleaningCode?: string // e.g. "CH - Vogelberg"
  supervisorName?: string
  supervisorRole?: string
  startedAt?: string
  confirmedAt?: string
  checklist?: CleaningChecklistGroup[]
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
  /** For multi-unit listings, the specific room this job is for. */
  unitId?: string | null
  unitName?: string | null
  scheduledAt: string
  cleanerIds: string[]
  cleanerNames: string[]
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

export const cleaningJobSourceLabels: Record<CleaningJobSource, string> = CLEANING_SOURCE_LABELS

/** Canonical 4-option list used in the Source dropdown — excludes legacy aliases. */
export const CLEANING_SOURCE_OPTIONS: Array<{ value: CleaningJobSource, label: string }> = [
  { value: 'daily', label: 'Daily cleaning' },
  { value: 'check_out', label: 'Check-out cleaning' },
  { value: 'mid_stay', label: 'Mid-stay cleaning' },
  { value: 'custom', label: 'Custom cleaning' },
]

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
    cleanerIds: ['staff-3', 'staff-4'],
    cleanerNames: ['Made Surya', 'Wayan Adi'],
    teamName: 'Housekeeping',
    status: 'done',
    priority: 'high',
    durationMinutes: 120,
    notes: 'Completed on time',
    source: 'mid_stay',
    reservationId: null,
    recurrence: null,
    feedback: {
      cleaningCode: 'CH - Canggu01',
      supervisorName: 'Made Surya',
      supervisorRole: 'Supervisor',
      startedAt: '2026-06-22T09:00:00+08:00',
      confirmedAt: '2026-06-22T10:54:00+08:00',
      checklist: [
        {
          id: 'start',
          title: 'Start Reinigung',
          items: [
            { id: 'start-1', label: 'Alle Fenster öffnen - Alle Betten abziehen (Bettwäsche nicht auf linke Seite drehen) - Schmutzwäsche sammeln und in Wäschewagen bringen', status: 'ok', completedBy: 'Made Surya', completedAt: '2026-06-22T10:00:00+08:00' },
          ],
        },
        {
          id: 'kitchen',
          title: 'Küche',
          items: [
            { id: 'kit-1', label: 'Kontrolle Kühlschrank (Lebensmittel entsorgen und reinigen)', status: 'ok', completedBy: 'Made Surya', completedAt: '2026-06-22T10:20:00+08:00' },
            { id: 'kit-2', label: 'Kontrolle Eisfach (Lebensmittel entsorgen und reinigen)', status: 'ok', completedBy: 'Made Surya', completedAt: '2026-06-22T10:25:00+08:00' },
            { id: 'kit-3', label: 'Abflusssieb reinigen, kontrollieren ob das Wasser abläuft', status: 'ok', completedBy: 'Wayan Adi', completedAt: '2026-06-22T10:30:00+08:00' },
            { id: 'kit-4', label: 'Wasserhahnsieb kontrollieren ob es regelmässig fliesst, ab und zu entkalken', status: 'ok', completedBy: 'Wayan Adi', completedAt: '2026-06-22T10:35:00+08:00' },
            { id: 'kit-5', label: 'Alle Schubladen kontrollieren, Ordnung schaffen, schmutzige Schubladen reinigen, Töpfe kontrollieren, Besteck kontrollieren', status: 'ok', completedBy: 'Made Surya', completedAt: '2026-06-22T10:45:00+08:00' },
          ],
        },
        {
          id: 'bath',
          title: 'Badezimmer',
          items: [
            { id: 'bath-1', label: 'Dusche, Badewanne, Waschbecken reinigen und entkalken', status: 'ok', completedBy: 'Wayan Adi', completedAt: '2026-06-22T10:50:00+08:00' },
            { id: 'bath-2', label: 'Toilette reinigen und desinfizieren', status: 'ok', completedBy: 'Wayan Adi', completedAt: '2026-06-22T10:52:00+08:00' },
            { id: 'bath-3', label: 'Handtücher und Badmatte austauschen', status: 'ok', completedBy: 'Made Surya', completedAt: '2026-06-22T10:53:00+08:00' },
          ],
        },
        {
          id: 'living',
          title: 'Wohnzimmer',
          items: [
            { id: 'liv-1', label: 'Möbel abstauben, Polster aufschütteln', status: 'ok', completedBy: 'Made Surya', completedAt: '2026-06-22T10:40:00+08:00' },
            { id: 'liv-2', label: 'Boden wischen, Staubsaugen', status: 'ok', completedBy: 'Wayan Adi', completedAt: '2026-06-22T10:48:00+08:00' },
          ],
        },
        {
          id: 'outdoor',
          title: 'Aussenbereich',
          items: [
            { id: 'out-1', label: 'Pool auf Sauberkeit prüfen', status: 'ok', completedBy: 'Wayan Adi', completedAt: '2026-06-22T10:42:00+08:00' },
            { id: 'out-2', label: 'Terrasse fegen', status: 'ok', completedBy: 'Made Surya', completedAt: '2026-06-22T10:44:00+08:00' },
          ],
        },
      ],
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
    cleanerIds: ['staff-3'],
    cleanerNames: ['Made Surya'],
    teamName: 'Housekeeping',
    status: 'done',
    priority: 'normal',
    durationMinutes: 90,
    notes: 'Completed',
    source: 'custom',
    reservationId: null,
    recurrence: null,
    feedback: {
      cleaningCode: 'CH - NomadGarden',
      supervisorName: 'Made Surya',
      supervisorRole: 'Housekeeping',
      startedAt: '2026-06-22T13:52:00+08:00',
      confirmedAt: '2026-06-22T15:22:00+08:00',
      checklist: [
        {
          id: 'start',
          title: 'Start Reinigung',
          items: [
            { id: 'start-1', label: 'Alle Fenster öffnen - Alle Betten abziehen (Bettwäsche nicht auf linke Seite drehen) - Schmutzwäsche sammeln und in Wäschewagen bringen', status: 'ok', completedBy: 'Made Surya', completedAt: '2026-06-22T14:00:00+08:00' },
          ],
        },
        {
          id: 'kitchen',
          title: 'Küche',
          items: [
            { id: 'kit-1', label: 'Kontrolle Kühlschrank (Lebensmittel entsorgen und reinigen)', status: 'ok', completedBy: 'Made Surya', completedAt: '2026-06-22T14:15:00+08:00' },
            { id: 'kit-2', label: 'Geschirr in der Spüle spülen', status: 'ok', completedBy: 'Made Surya', completedAt: '2026-06-22T14:25:00+08:00' },
            { id: 'kit-3', label: 'Abflusssieb reinigen, kontrollieren ob das Wasser abläuft', status: 'ok', completedBy: 'Made Surya', completedAt: '2026-06-22T14:30:00+08:00' },
            { id: 'kit-4', label: 'Wasserhahnsieb kontrollieren ob es regelmässig fliesst, ab und zu entkalken', status: 'ok', completedBy: 'Made Surya', completedAt: '2026-06-22T14:32:00+08:00' },
            { id: 'kit-5', label: 'Alle Schubladen kontrollieren, Ordnung schaffen, schmutzige Schubladen reinigen, Töpfe kontrollieren, Besteck kontrollieren', status: 'ok', completedBy: 'Made Surya', completedAt: '2026-06-22T14:45:00+08:00' },
          ],
        },
        {
          id: 'bath',
          title: 'Badezimmer',
          items: [
            { id: 'bath-1', label: 'Dusche, Badewanne, Waschbecken reinigen und entkalken', status: 'ok', completedBy: 'Made Surya', completedAt: '2026-06-22T14:55:00+08:00' },
            { id: 'bath-2', label: 'Toilette reinigen und desinfizieren', status: 'ok', completedBy: 'Made Surya', completedAt: '2026-06-22T15:00:00+08:00' },
            { id: 'bath-3', label: 'Handtücher und Badmatte austauschen', status: 'issue', notes: 'Towels left on bathroom floor — picked up and replaced', completedBy: 'Made Surya', completedAt: '2026-06-22T15:05:00+08:00' },
          ],
        },
        {
          id: 'living',
          title: 'Wohnzimmer',
          items: [
            { id: 'liv-1', label: 'Möbel abstauben, Polster aufschütteln', status: 'ok', completedBy: 'Made Surya', completedAt: '2026-06-22T15:10:00+08:00' },
            { id: 'liv-2', label: 'Boden wischen, Staubsaugen', status: 'ok', completedBy: 'Made Surya', completedAt: '2026-06-22T15:18:00+08:00' },
          ],
        },
      ],
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
    cleanerIds: ['staff-4'],
    cleanerNames: ['Wayan Adi'],
    teamName: 'Housekeeping',
    status: 'done',
    priority: 'normal',
    durationMinutes: 150,
    notes: 'Completed',
    source: 'manual',
    reservationId: null,
    recurrence: null,
    feedback: {
      cleaningCode: 'CH - Surf01',
      supervisorName: 'Wayan Adi',
      supervisorRole: 'Housekeeping',
      startedAt: '2026-06-22T14:23:00+08:00',
      confirmedAt: '2026-06-22T16:48:00+08:00',
      checklist: [
        {
          id: 'start',
          title: 'Start Reinigung',
          items: [
            { id: 'start-1', label: 'Alle Fenster öffnen - Alle Betten abziehen (Bettwäsche nicht auf linke Seite drehen) - Schmutzwäsche sammeln und in Wäschewagen bringen', status: 'ok', completedBy: 'Wayan Adi', completedAt: '2026-06-22T14:45:00+08:00' },
          ],
        },
        {
          id: 'kitchen',
          title: 'Küche',
          items: [
            { id: 'kit-1', label: 'Kontrolle Kühlschrank (Lebensmittel entsorgen und reinigen)', status: 'issue', notes: 'Dishes piled in the sink — extra effort needed', completedBy: 'Wayan Adi', completedAt: '2026-06-22T15:30:00+08:00' },
            { id: 'kit-2', label: 'Kontrolle Eisfach (Lebensmittel entsorgen und reinigen)', status: 'ok', completedBy: 'Wayan Adi', completedAt: '2026-06-22T15:35:00+08:00' },
            { id: 'kit-3', label: 'Abflusssieb reinigen, kontrollieren ob das Wasser abläuft', status: 'ok', completedBy: 'Wayan Adi', completedAt: '2026-06-22T15:45:00+08:00' },
            { id: 'kit-4', label: 'Wasserhahnsieb kontrollieren ob es regelmässig fliesst, ab und zu entkalken', status: 'ok', completedBy: 'Wayan Adi', completedAt: '2026-06-22T15:50:00+08:00' },
            { id: 'kit-5', label: 'Alle Schubladen kontrollieren, Ordnung schaffen, schmutzige Schubladen reinigen, Töpfe kontrollieren, Besteck kontrollieren', status: 'ok', completedBy: 'Wayan Adi', completedAt: '2026-06-22T16:10:00+08:00' },
          ],
        },
        {
          id: 'bath',
          title: 'Badezimmer',
          items: [
            { id: 'bath-1', label: 'Dusche, Badewanne,Waschbecken reinigen und entkalken', status: 'issue', notes: 'Water on the floor — extra drying required', completedBy: 'Wayan Adi', completedAt: '2026-06-22T16:20:00+08:00' },
            { id: 'bath-2', label: 'Toilette reinigen und desinfizieren', status: 'ok', completedBy: 'Wayan Adi', completedAt: '2026-06-22T16:25:00+08:00' },
            { id: 'bath-3', label: 'Handtücher und Badmatte austauschen', status: 'ok', completedBy: 'Wayan Adi', completedAt: '2026-06-22T16:30:00+08:00' },
          ],
        },
        {
          id: 'outdoor',
          title: 'Aussenbereich',
          items: [
            { id: 'out-1', label: 'Sand im Wohnzimmer aufkehren', status: 'issue', notes: 'Heavy sand throughout living room', completedBy: 'Wayan Adi', completedAt: '2026-06-22T16:35:00+08:00' },
            { id: 'out-2', label: 'Pooltücher einsammeln', status: 'ok', completedBy: 'Wayan Adi', completedAt: '2026-06-22T16:40:00+08:00' },
          ],
        },
      ],
      cleanlinessRating: 3,
      conditionNotes: 'Sand throughout the living room. Dishes piled in the sink. Bathroom had water on the floor. Pool towels left outside overnight.',
      damages: ['Small scratch on the glass coffee table'],
      itemsLeft: ['Phone charger (USB-C) - returned to guest via Airbnb message'],
      cleaningDurationMinutes: 150,
      housekeeperNotes: 'Guests used the property heavily. Extra effort needed for kitchen and bathroom.',
    },
  },
  {
    id: 'cln-12',
    listingId: 'lst-12',
    listingName: 'Surf Shack Canggu',
    scheduledAt: '2026-06-22T14:23:00+08:00',
    cleanerIds: ['staff-4'],
    cleanerNames: ['Wayan Adi'],
    teamName: 'Housekeeping',
    status: 'done',
    priority: 'normal',
    durationMinutes: 150,
    notes: 'Completed',
    source: 'manual',
    reservationId: null,
    recurrence: null,
  },
  {
    id: 'cln-24',
    listingId: 'lst-15',
    listingName: 'Luxury Penthouse Seminyak',
    scheduledAt: '2026-06-22T11:02:00+08:00',
    cleanerIds: [],
    cleanerNames: [],
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
    cleanerIds: ['staff-3', 'staff-2'],
    cleanerNames: ['Made Surya', 'Komang Juliantara'],
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
    cleanerIds: ['staff-4'],
    cleanerNames: ['Wayan Adi'],
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
    cleanerIds: [],
    cleanerNames: [],
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
    cleanerIds: [],
    cleanerNames: [],
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
    cleanerIds: ['staff-3'],
    cleanerNames: ['Made Surya'],
    teamName: 'Housekeeping',
    status: 'scheduled',
    priority: 'normal',
    durationMinutes: 180,
    notes: 'Scheduled cleaning',
    source: 'daily',
    reservationId: null,
    recurrence: null,
  },
  {
    id: 'cln-7',
    listingId: 'lst-7',
    listingName: 'Apartments Main',
    scheduledAt: '2026-06-24T09:18:00+08:00',
    cleanerIds: ['staff-3'],
    cleanerNames: ['Made Surya'],
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
    cleanerIds: ['staff-4'],
    cleanerNames: ['Wayan Adi'],
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
    cleanerIds: ['staff-4'],
    cleanerNames: ['Wayan Adi'],
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
    cleanerIds: ['staff-4'],
    cleanerNames: ['Wayan Adi'],
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
    cleanerIds: ['staff-3'],
    cleanerNames: ['Made Surya'],
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
    cleanerIds: ['staff-3'],
    cleanerNames: ['Made Surya'],
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
    cleanerIds: [],
    cleanerNames: [],
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
    cleanerIds: ['staff-3'],
    cleanerNames: ['Made Surya'],
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
    cleanerIds: ['staff-3'],
    cleanerNames: ['Made Surya'],
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
    cleanerIds: ['staff-4'],
    cleanerNames: ['Wayan Adi'],
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
    cleanerIds: ['staff-3'],
    cleanerNames: ['Made Surya'],
    teamName: 'Housekeeping',
    status: 'scheduled',
    priority: 'normal',
    durationMinutes: 90,
    notes: 'Scheduled cleaning',
    source: 'manual',
    reservationId: null,
    recurrence: null,
  },

  // --- August 2026 (today onwards — editable cleanings) ---
  // Yesterday (2026-08-01) — Sat — past scheduled (locked: date is in the past)
  {
    id: 'cln-28y',
    listingId: 'lst-4',
    listingName: 'The R Villa Merapi',
    scheduledAt: '2026-08-01T10:00:00+08:00',
    cleanerIds: ['staff-3'],
    cleanerNames: ['Made Surya'],
    teamName: 'Housekeeping',
    status: 'scheduled',
    priority: 'normal',
    durationMinutes: 120,
    notes: 'Yesterday — was not done, still scheduled (locked)',
    source: 'daily',
    reservationId: null,
    recurrence: null,
  },
  // Today (2026-08-02) — Sun — in progress (locked: not scheduled)
  {
    id: 'cln-29ip',
    listingId: 'lst-5',
    listingName: 'Nomad Mansion Garden',
    scheduledAt: '2026-08-02T08:00:00+08:00',
    cleanerIds: ['staff-4'],
    cleanerNames: ['Wayan Adi'],
    teamName: 'Housekeeping',
    status: 'in_progress',
    priority: 'normal',
    durationMinutes: 120,
    notes: 'Currently being cleaned (locked)',
    source: 'custom',
    reservationId: null,
    recurrence: null,
  },
  // Today (2026-08-02) — Sun
  {
    id: 'cln-20',
    listingId: 'lst-1',
    listingName: '5BR Pool the R Villa Luwa – Serene near Canggu',
    scheduledAt: '2026-08-02T09:00:00+08:00',
    cleanerIds: [],
    cleanerNames: [],
    teamName: 'Housekeeping',
    status: 'scheduled',
    priority: 'high',
    durationMinutes: 150,
    notes: 'Mid-stay refresh — pet in property',
    source: 'mid_stay',
    reservationId: 'res-today-1',
    recurrence: null,
  },
  {
    id: 'cln-21',
    listingId: 'lst-3',
    listingName: 'The R Pererenan Mezzanine Studio + Plunge Pool',
    scheduledAt: '2026-08-02T11:00:00+08:00',
    cleanerIds: ['staff-3'],
    cleanerNames: ['Made Surya'],
    teamName: 'Housekeeping',
    status: 'scheduled',
    priority: 'normal',
    durationMinutes: 120,
    notes: 'Daily refresh',
    source: 'daily',
    reservationId: null,
    recurrence: null,
  },
  {
    id: 'cln-22',
    listingId: 'lst-7',
    listingName: 'Apartments Main',
    scheduledAt: '2026-08-02T14:00:00+08:00',
    cleanerIds: [],
    cleanerNames: [],
    teamName: 'Housekeeping',
    status: 'scheduled',
    priority: 'normal',
    durationMinutes: 120,
    notes: 'Pet-friendly stay — needs assignment',
    source: 'mid_stay',
    reservationId: 'res-today-2',
    recurrence: null,
  },
  // Aug 3 (tomorrow)
  {
    id: 'cln-23',
    listingId: 'lst-2',
    listingName: 'Apartments Pool',
    scheduledAt: '2026-08-03T10:00:00+08:00',
    cleanerIds: ['staff-4'],
    cleanerNames: ['Wayan Adi'],
    teamName: 'Housekeeping',
    status: 'scheduled',
    priority: 'normal',
    durationMinutes: 90,
    notes: 'Check-out cleaning — pet in stay',
    source: 'check_out',
    reservationId: 'res-future-1',
    recurrence: null,
  },
  {
    id: 'cln-26',
    listingId: 'lst-5',
    listingName: 'Nomad Mansion Garden',
    scheduledAt: '2026-08-03T13:30:00+08:00',
    cleanerIds: [],
    cleanerNames: [],
    teamName: 'Housekeeping',
    status: 'scheduled',
    priority: 'low',
    durationMinutes: 90,
    notes: 'Light refresh',
    source: 'custom',
    reservationId: null,
    recurrence: null,
  },
  // Aug 4
  {
    id: 'cln-27',
    listingId: 'lst-6',
    listingName: 'Nomad Mansion Pool',
    scheduledAt: '2026-08-04T09:30:00+08:00',
    cleanerIds: ['staff-3', 'staff-4'],
    cleanerNames: ['Made Surya', 'Wayan Adi'],
    teamName: 'Housekeeping',
    status: 'scheduled',
    priority: 'normal',
    durationMinutes: 120,
    notes: 'Mid-stay cleaning — pet in property',
    source: 'mid_stay',
    reservationId: 'res-future-2',
    recurrence: null,
  },
  {
    id: 'cln-28',
    listingId: 'lst-11',
    listingName: 'Villa Rice Terrace Jimbaran',
    scheduledAt: '2026-08-04T15:00:00+08:00',
    cleanerIds: [],
    cleanerNames: [],
    teamName: 'Housekeeping',
    status: 'scheduled',
    priority: 'high',
    durationMinutes: 150,
    notes: 'Pre-arrival prep',
    source: 'custom',
    reservationId: null,
    recurrence: null,
  },
  // Aug 5
  {
    id: 'cln-29',
    listingId: 'lst-4',
    listingName: 'The R Villa Merapi',
    scheduledAt: '2026-08-05T11:00:00+08:00',
    cleanerIds: ['staff-3'],
    cleanerNames: ['Made Surya'],
    teamName: 'Housekeeping',
    status: 'scheduled',
    priority: 'normal',
    durationMinutes: 120,
    notes: 'Daily housekeeping',
    source: 'daily',
    reservationId: null,
    recurrence: null,
  },
  {
    id: 'cln-30',
    listingId: 'lst-15',
    listingName: 'Luxury Penthouse Seminyak',
    scheduledAt: '2026-08-05T14:00:00+08:00',
    cleanerIds: [],
    cleanerNames: [],
    teamName: 'Housekeeping',
    status: 'scheduled',
    priority: 'normal',
    durationMinutes: 90,
    notes: 'Mid-stay cleaning — pet in stay',
    source: 'mid_stay',
    reservationId: 'res-future-3',
    recurrence: null,
  },
  // Aug 6
  {
    id: 'cln-31',
    listingId: 'lst-8',
    listingName: 'Villa Sunset Cliff',
    scheduledAt: '2026-08-06T10:00:00+08:00',
    cleanerIds: ['staff-4'],
    cleanerNames: ['Wayan Adi'],
    teamName: 'Housekeeping',
    status: 'scheduled',
    priority: 'high',
    durationMinutes: 180,
    notes: 'Full turn-over clean',
    source: 'check_out',
    reservationId: 'res-future-4',
    recurrence: null,
  },
  {
    id: 'cln-32',
    listingId: 'lst-9',
    listingName: 'Jungle Treehouse Retreat',
    scheduledAt: '2026-08-06T13:00:00+08:00',
    cleanerIds: [],
    cleanerNames: [],
    teamName: 'Housekeeping',
    status: 'scheduled',
    priority: 'normal',
    durationMinutes: 120,
    notes: 'Standard clean',
    source: 'custom',
    reservationId: null,
    recurrence: null,
  },
  // Aug 7
  {
    id: 'cln-33',
    listingId: 'lst-12',
    listingName: 'Surf Shack Canggu',
    scheduledAt: '2026-08-07T09:00:00+08:00',
    cleanerIds: ['staff-3'],
    cleanerNames: ['Made Surya'],
    teamName: 'Housekeeping',
    status: 'scheduled',
    priority: 'normal',
    durationMinutes: 120,
    notes: 'Daily cleaning',
    source: 'daily',
    reservationId: null,
    recurrence: null,
  },
  {
    id: 'cln-34',
    listingId: 'lst-13',
    listingName: 'Volcano View Villa Kintamani',
    scheduledAt: '2026-08-07T14:00:00+08:00',
    cleanerIds: [],
    cleanerNames: [],
    teamName: 'Housekeeping',
    status: 'scheduled',
    priority: 'high',
    durationMinutes: 180,
    notes: 'Mid-stay cleaning — pet in stay',
    source: 'mid_stay',
    reservationId: 'res-future-5',
    recurrence: null,
  },
  // Aug 8
  {
    id: 'cln-35',
    listingId: 'lst-16',
    listingName: 'Eco Bamboo House Ubud',
    scheduledAt: '2026-08-08T10:00:00+08:00',
    cleanerIds: ['staff-4'],
    cleanerNames: ['Wayan Adi'],
    teamName: 'Housekeeping',
    status: 'scheduled',
    priority: 'normal',
    durationMinutes: 120,
    notes: 'Refresh between stays',
    source: 'custom',
    reservationId: null,
    recurrence: null,
  },
  // Aug 9
  {
    id: 'cln-36',
    listingId: 'lst-17',
    listingName: 'Apartments Pool - Room 2',
    scheduledAt: '2026-08-09T11:00:00+08:00',
    cleanerIds: [],
    cleanerNames: [],
    teamName: 'Housekeeping',
    status: 'scheduled',
    priority: 'normal',
    durationMinutes: 120,
    notes: 'Daily housekeeping',
    source: 'daily',
    reservationId: null,
    recurrence: null,
  },
  // Aug 10
  {
    id: 'cln-37',
    listingId: 'lst-18',
    listingName: 'Apartments Pool - Room 3',
    scheduledAt: '2026-08-10T13:00:00+08:00',
    cleanerIds: ['staff-3'],
    cleanerNames: ['Made Surya'],
    teamName: 'Housekeeping',
    status: 'scheduled',
    priority: 'normal',
    durationMinutes: 90,
    notes: 'Pre-arrival prep',
    source: 'custom',
    reservationId: null,
    recurrence: null,
  },
  // Aug 12
  {
    id: 'cln-38',
    listingId: 'lst-19',
    listingName: 'Surf Shack Canggu - Unit 2',
    scheduledAt: '2026-08-12T10:00:00+08:00',
    cleanerIds: [],
    cleanerNames: [],
    teamName: 'Housekeeping',
    status: 'scheduled',
    priority: 'high',
    durationMinutes: 90,
    notes: 'Mid-stay cleaning — pet in stay',
    source: 'mid_stay',
    reservationId: 'res-future-6',
    recurrence: null,
  },
  // Aug 14
  {
    id: 'cln-39',
    listingId: 'lst-14',
    listingName: 'The R Canggu Riverside',
    scheduledAt: '2026-08-14T09:30:00+08:00',
    cleanerIds: ['staff-4'],
    cleanerNames: ['Wayan Adi'],
    teamName: 'Housekeeping',
    status: 'scheduled',
    priority: 'normal',
    durationMinutes: 120,
    notes: 'Daily housekeeping',
    source: 'daily',
    reservationId: null,
    recurrence: null,
  },
  // Aug 15
  {
    id: 'cln-40',
    listingId: 'lst-10',
    listingName: 'Beachfront Bungalow Seminyak',
    scheduledAt: '2026-08-15T11:00:00+08:00',
    cleanerIds: [],
    cleanerNames: [],
    teamName: 'Housekeeping',
    status: 'scheduled',
    priority: 'normal',
    durationMinutes: 90,
    notes: 'Mid-stay cleaning — pet in stay',
    source: 'mid_stay',
    reservationId: 'res-future-7',
    recurrence: null,
  },

  // --- Auto-generated check-out cleanings (so the calendar can edit them) ---
  // Each one matches `${listingId}:${checkoutDate}` so buildCheckoutCleanings
  // skips the synthetic event and the real job is used (with matching id).
  // bk-2e — Pierre Dubois (Apartments Pool, 2026-08-05)
  {
    id: 'cln-co-2e',
    listingId: 'lst-2',
    listingName: 'Apartments Pool',
    scheduledAt: '2026-08-05T11:00:00+08:00',
    cleanerIds: [],
    cleanerNames: [],
    teamName: 'Housekeeping',
    status: 'scheduled',
    priority: 'high',
    durationMinutes: 120,
    notes: 'Check-out cleaning — Pierre Dubois (pet in stay)',
    source: 'check_out',
    reservationId: 'bk-2e',
    recurrence: null,
  },
  // bk-7d — Aria Patel (Apartments Main, 2026-08-05)
  {
    id: 'cln-co-7d',
    listingId: 'lst-7',
    listingName: 'Apartments Main',
    scheduledAt: '2026-08-05T11:00:00+08:00',
    cleanerIds: [],
    cleanerNames: [],
    teamName: 'Housekeeping',
    status: 'scheduled',
    priority: 'high',
    durationMinutes: 120,
    notes: 'Check-out cleaning — Aria Patel (pet in stay)',
    source: 'check_out',
    reservationId: 'bk-7d',
    recurrence: null,
  },
  // bk-14b — Ravi Sharma (The R Canggu Riverside, 2026-08-06)
  {
    id: 'cln-co-14b',
    listingId: 'lst-14',
    listingName: 'The R Canggu Riverside',
    scheduledAt: '2026-08-06T11:00:00+08:00',
    cleanerIds: [],
    cleanerNames: [],
    teamName: 'Housekeeping',
    status: 'scheduled',
    priority: 'high',
    durationMinutes: 120,
    notes: 'Check-out cleaning — Ravi Sharma',
    source: 'check_out',
    reservationId: 'bk-14b',
    recurrence: null,
  },
  // bk-6a — Lucas Oliveira (Nomad Mansion Pool, 2026-08-07)
  {
    id: 'cln-co-6a',
    listingId: 'lst-6',
    listingName: 'Nomad Mansion Pool',
    scheduledAt: '2026-08-07T11:00:00+08:00',
    cleanerIds: [],
    cleanerNames: [],
    teamName: 'Housekeeping',
    status: 'scheduled',
    priority: 'high',
    durationMinutes: 120,
    notes: 'Check-out cleaning — Lucas Oliveira (pet in stay)',
    source: 'check_out',
    reservationId: 'bk-6a',
    recurrence: null,
  },
  // bk-15a — Charlotte Moore (Luxury Penthouse Seminyak, 2026-08-08)
  {
    id: 'cln-co-15a',
    listingId: 'lst-15',
    listingName: 'Luxury Penthouse Seminyak',
    scheduledAt: '2026-08-08T11:00:00+08:00',
    cleanerIds: [],
    cleanerNames: [],
    teamName: 'Housekeeping',
    status: 'scheduled',
    priority: 'high',
    durationMinutes: 90,
    notes: 'Check-out cleaning — Charlotte Moore (pet in stay)',
    source: 'check_out',
    reservationId: 'bk-15a',
    recurrence: null,
  },
  // bk-13a — Frederik Madsen (Volcano View Villa Kintamani, 2026-08-10)
  {
    id: 'cln-co-13a',
    listingId: 'lst-13',
    listingName: 'Volcano View Villa Kintamani',
    scheduledAt: '2026-08-10T11:00:00+08:00',
    cleanerIds: [],
    cleanerNames: [],
    teamName: 'Housekeeping',
    status: 'scheduled',
    priority: 'high',
    durationMinutes: 180,
    notes: 'Check-out cleaning — Frederik Madsen (pet in stay)',
    source: 'check_out',
    reservationId: 'bk-13a',
    recurrence: null,
  },
  // bk-19e — Connor Walsh (Surf Shack Canggu - Unit 2, 2026-08-15)
  {
    id: 'cln-co-19e',
    listingId: 'lst-19',
    listingName: 'Surf Shack Canggu - Unit 2',
    scheduledAt: '2026-08-15T11:00:00+08:00',
    cleanerIds: [],
    cleanerNames: [],
    teamName: 'Housekeeping',
    status: 'scheduled',
    priority: 'high',
    durationMinutes: 90,
    notes: 'Check-out cleaning — Connor Walsh (pet in stay)',
    source: 'check_out',
    reservationId: 'bk-19e',
    recurrence: null,
  },
  // bk-10a — Min-jae Kim (Beachfront Bungalow Seminyak, 2026-08-18)
  {
    id: 'cln-co-10a',
    listingId: 'lst-10',
    listingName: 'Beachfront Bungalow Seminyak',
    scheduledAt: '2026-08-18T11:00:00+08:00',
    cleanerIds: [],
    cleanerNames: [],
    teamName: 'Housekeeping',
    status: 'scheduled',
    priority: 'high',
    durationMinutes: 90,
    notes: 'Check-out cleaning — Min-jae Kim (pet in stay)',
    source: 'check_out',
    reservationId: 'bk-10a',
    recurrence: null,
  },

  // --- All remaining August checkouts (today or future) — added to make them editable ---
  // bk-1c — Isabella Romano (lst-1, 2026-08-04) — pet in stay
  {
    id: 'cln-co-1c',
    listingId: 'lst-1',
    listingName: '5BR Pool the R Villa Luwa – Serene near Canggu',
    scheduledAt: '2026-08-04T11:00:00+08:00',
    cleanerIds: [],
    cleanerNames: [],
    teamName: 'Housekeeping',
    status: 'scheduled',
    priority: 'high',
    durationMinutes: 180,
    notes: 'Check-out cleaning — Isabella Romano (pet in stay)',
    source: 'check_out',
    reservationId: 'bk-1c',
    recurrence: null,
  },
  // bk-2c — Hannah Lee (lst-2, 2026-08-13)
  {
    id: 'cln-co-2c',
    listingId: 'lst-2',
    listingName: 'Apartments Pool',
    scheduledAt: '2026-08-13T11:00:00+08:00',
    cleanerIds: [],
    cleanerNames: [],
    teamName: 'Housekeeping',
    status: 'scheduled',
    priority: 'high',
    durationMinutes: 120,
    notes: 'Check-out cleaning — Hannah Lee',
    source: 'check_out',
    reservationId: 'bk-2c',
    recurrence: null,
  },
  // bk-2d — Diana Park (lst-2, 2026-08-25)
  {
    id: 'cln-co-2d',
    listingId: 'lst-2',
    listingName: 'Apartments Pool',
    scheduledAt: '2026-08-25T11:00:00+08:00',
    cleanerIds: [],
    cleanerNames: [],
    teamName: 'Housekeeping',
    status: 'scheduled',
    priority: 'high',
    durationMinutes: 120,
    notes: 'Check-out cleaning — Diana Park',
    source: 'check_out',
    reservationId: 'bk-2d',
    recurrence: null,
  },
  // bk-7c — Yuki Sato (lst-7, 2026-08-09)
  {
    id: 'cln-co-7c',
    listingId: 'lst-7',
    listingName: 'Apartments Main',
    scheduledAt: '2026-08-09T11:00:00+08:00',
    cleanerIds: [],
    cleanerNames: [],
    teamName: 'Housekeeping',
    status: 'scheduled',
    priority: 'high',
    durationMinutes: 120,
    notes: 'Check-out cleaning — Yuki Sato',
    source: 'check_out',
    reservationId: 'bk-7c',
    recurrence: null,
  },
  // bk-9c — Felix Schmidt (lst-9, 2026-08-15)
  {
    id: 'cln-co-9c',
    listingId: 'lst-9',
    listingName: 'Jungle Treehouse Retreat',
    scheduledAt: '2026-08-15T11:00:00+08:00',
    cleanerIds: [],
    cleanerNames: [],
    teamName: 'Housekeeping',
    status: 'scheduled',
    priority: 'high',
    durationMinutes: 120,
    notes: 'Check-out cleaning — Felix Schmidt',
    source: 'check_out',
    reservationId: 'bk-9c',
    recurrence: null,
  },
  // bk-9d — Anika Patel (lst-9, 2026-08-28)
  {
    id: 'cln-co-9d',
    listingId: 'lst-9',
    listingName: 'Jungle Treehouse Retreat',
    scheduledAt: '2026-08-28T11:00:00+08:00',
    cleanerIds: [],
    cleanerNames: [],
    teamName: 'Housekeeping',
    status: 'scheduled',
    priority: 'high',
    durationMinutes: 120,
    notes: 'Check-out cleaning — Anika Patel',
    source: 'check_out',
    reservationId: 'bk-9d',
    recurrence: null,
  },
  // bk-11c — Beatriz Costa (lst-11, 2026-08-10) — pet in stay
  {
    id: 'cln-co-11c',
    listingId: 'lst-11',
    listingName: 'Villa Rice Terrace Jimbaran',
    scheduledAt: '2026-08-10T11:00:00+08:00',
    cleanerIds: [],
    cleanerNames: [],
    teamName: 'Housekeeping',
    status: 'scheduled',
    priority: 'high',
    durationMinutes: 150,
    notes: 'Check-out cleaning — Beatriz Costa (pet in stay)',
    source: 'check_out',
    reservationId: 'bk-11c',
    recurrence: null,
  },
  // bk-11d — Theo Andersen (lst-11, 2026-08-24)
  {
    id: 'cln-co-11d',
    listingId: 'lst-11',
    listingName: 'Villa Rice Terrace Jimbaran',
    scheduledAt: '2026-08-24T11:00:00+08:00',
    cleanerIds: [],
    cleanerNames: [],
    teamName: 'Housekeeping',
    status: 'scheduled',
    priority: 'high',
    durationMinutes: 150,
    notes: 'Check-out cleaning — Theo Andersen',
    source: 'check_out',
    reservationId: 'bk-11d',
    recurrence: null,
  },
  // bk-14c — Elise Laurent (lst-14, 2026-08-25)
  {
    id: 'cln-co-14c',
    listingId: 'lst-14',
    listingName: 'The R Canggu Riverside',
    scheduledAt: '2026-08-25T11:00:00+08:00',
    cleanerIds: [],
    cleanerNames: [],
    teamName: 'Housekeeping',
    status: 'scheduled',
    priority: 'high',
    durationMinutes: 120,
    notes: 'Check-out cleaning — Elise Laurent',
    source: 'check_out',
    reservationId: 'bk-14c',
    recurrence: null,
  },
  // bk-16c — Henrik Olsen (lst-16, 2026-08-17)
  {
    id: 'cln-co-16c',
    listingId: 'lst-16',
    listingName: 'Eco Bamboo House Ubud',
    scheduledAt: '2026-08-17T11:00:00+08:00',
    cleanerIds: [],
    cleanerNames: [],
    teamName: 'Housekeeping',
    status: 'scheduled',
    priority: 'high',
    durationMinutes: 120,
    notes: 'Check-out cleaning — Henrik Olsen',
    source: 'check_out',
    reservationId: 'bk-16c',
    recurrence: null,
  },
  // bk-16d — Sienna Cooper (lst-16, 2026-08-31)
  {
    id: 'cln-co-16d',
    listingId: 'lst-16',
    listingName: 'Eco Bamboo House Ubud',
    scheduledAt: '2026-08-31T11:00:00+08:00',
    cleanerIds: [],
    cleanerNames: [],
    teamName: 'Housekeeping',
    status: 'scheduled',
    priority: 'high',
    durationMinutes: 120,
    notes: 'Check-out cleaning — Sienna Cooper',
    source: 'check_out',
    reservationId: 'bk-16d',
    recurrence: null,
  },
  // bk-17c — Carmen Diaz (lst-17, 2026-08-09)
  {
    id: 'cln-co-17c',
    listingId: 'lst-17',
    listingName: 'Apartments Pool - Room 2',
    scheduledAt: '2026-08-09T11:00:00+08:00',
    cleanerIds: [],
    cleanerNames: [],
    teamName: 'Housekeeping',
    status: 'scheduled',
    priority: 'high',
    durationMinutes: 120,
    notes: 'Check-out cleaning — Carmen Diaz',
    source: 'check_out',
    reservationId: 'bk-17c',
    recurrence: null,
  },
  // bk-17d — Henrik Berg (lst-17, 2026-08-27)
  {
    id: 'cln-co-17d',
    listingId: 'lst-17',
    listingName: 'Apartments Pool - Room 2',
    scheduledAt: '2026-08-27T11:00:00+08:00',
    cleanerIds: [],
    cleanerNames: [],
    teamName: 'Housekeeping',
    status: 'scheduled',
    priority: 'high',
    durationMinutes: 120,
    notes: 'Check-out cleaning — Henrik Berg',
    source: 'check_out',
    reservationId: 'bk-17d',
    recurrence: null,
  },
  // bk-18c — Daniel Park (lst-18, 2026-08-11)
  {
    id: 'cln-co-18c',
    listingId: 'lst-18',
    listingName: 'Apartments Pool - Room 3',
    scheduledAt: '2026-08-11T11:00:00+08:00',
    cleanerIds: [],
    cleanerNames: [],
    teamName: 'Housekeeping',
    status: 'scheduled',
    priority: 'high',
    durationMinutes: 120,
    notes: 'Check-out cleaning — Daniel Park',
    source: 'check_out',
    reservationId: 'bk-18c',
    recurrence: null,
  },
  // bk-18d — Layla Saeed (lst-18, 2026-08-29)
  {
    id: 'cln-co-18d',
    listingId: 'lst-18',
    listingName: 'Apartments Pool - Room 3',
    scheduledAt: '2026-08-29T11:00:00+08:00',
    cleanerIds: [],
    cleanerNames: [],
    teamName: 'Housekeeping',
    status: 'scheduled',
    priority: 'high',
    durationMinutes: 120,
    notes: 'Check-out cleaning — Layla Saeed',
    source: 'check_out',
    reservationId: 'bk-18d',
    recurrence: null,
  },
  // bk-19c — Joao Mendes (lst-19, 2026-08-19)
  {
    id: 'cln-co-19c',
    listingId: 'lst-19',
    listingName: 'Surf Shack Canggu - Unit 2',
    scheduledAt: '2026-08-19T11:00:00+08:00',
    cleanerIds: [],
    cleanerNames: [],
    teamName: 'Housekeeping',
    status: 'scheduled',
    priority: 'high',
    durationMinutes: 90,
    notes: 'Check-out cleaning — Joao Mendes',
    source: 'check_out',
    reservationId: 'bk-19c',
    recurrence: null,
  },
  // bk-19d — Priya Iyer (lst-19, 2026-08-26)
  {
    id: 'cln-co-19d',
    listingId: 'lst-19',
    listingName: 'Surf Shack Canggu - Unit 2',
    scheduledAt: '2026-08-26T11:00:00+08:00',
    cleanerIds: [],
    cleanerNames: [],
    teamName: 'Housekeeping',
    status: 'scheduled',
    priority: 'high',
    durationMinutes: 90,
    notes: 'Check-out cleaning — Priya Iyer',
    source: 'check_out',
    reservationId: 'bk-19d',
    recurrence: null,
  },
  // bk-20c — Marta Kowalski (lst-20, 2026-08-13)
  {
    id: 'cln-co-20c',
    listingId: 'lst-20',
    listingName: 'Villa Luwa – Hügellage Brandenburg',
    scheduledAt: '2026-08-13T11:00:00+08:00',
    cleanerIds: [],
    cleanerNames: [],
    teamName: 'Housekeeping',
    status: 'scheduled',
    priority: 'high',
    durationMinutes: 150,
    notes: 'Check-out cleaning — Marta Kowalski',
    source: 'check_out',
    reservationId: 'bk-20c',
    recurrence: null,
  },
  // bk-20d — Felix Brenner (lst-20, 2026-08-25)
  {
    id: 'cln-co-20d',
    listingId: 'lst-20',
    listingName: 'Villa Luwa – Hügellage Brandenburg',
    scheduledAt: '2026-08-25T11:00:00+08:00',
    cleanerIds: [],
    cleanerNames: [],
    teamName: 'Housekeeping',
    status: 'scheduled',
    priority: 'high',
    durationMinutes: 150,
    notes: 'Check-out cleaning — Felix Brenner',
    source: 'check_out',
    reservationId: 'bk-20d',
    recurrence: null,
  },
  // bk-21b — Lukas Maier (lst-21, 2026-08-09)
  {
    id: 'cln-co-21b',
    listingId: 'lst-21',
    listingName: 'Villa Sehnsucht – Seegrundstück Mecklenburg',
    scheduledAt: '2026-08-09T11:00:00+08:00',
    cleanerIds: [],
    cleanerNames: [],
    teamName: 'Housekeeping',
    status: 'scheduled',
    priority: 'high',
    durationMinutes: 180,
    notes: 'Check-out cleaning — Lukas Maier',
    source: 'check_out',
    reservationId: 'bk-21b',
    recurrence: null,
  },
  // bk-21c — Sandra Berger (lst-21, 2026-08-23)
  {
    id: 'cln-co-21c',
    listingId: 'lst-21',
    listingName: 'Villa Sehnsucht – Seegrundstück Mecklenburg',
    scheduledAt: '2026-08-23T11:00:00+08:00',
    cleanerIds: [],
    cleanerNames: [],
    teamName: 'Housekeeping',
    status: 'scheduled',
    priority: 'high',
    durationMinutes: 180,
    notes: 'Check-out cleaning — Sandra Berger',
    source: 'check_out',
    reservationId: 'bk-21c',
    recurrence: null,
  },
  // bk-22b — Petra Schulz (lst-22, 2026-08-06)
  {
    id: 'cln-co-22b',
    listingId: 'lst-22',
    listingName: 'Villa Bergfried – Schwarzwald',
    scheduledAt: '2026-08-06T11:00:00+08:00',
    cleanerIds: [],
    cleanerNames: [],
    teamName: 'Housekeeping',
    status: 'scheduled',
    priority: 'high',
    durationMinutes: 150,
    notes: 'Check-out cleaning — Petra Schulz',
    source: 'check_out',
    reservationId: 'bk-22b',
    recurrence: null,
  },
  // bk-22c — Andreas Hoffmann (lst-22, 2026-08-19)
  {
    id: 'cln-co-22c',
    listingId: 'lst-22',
    listingName: 'Villa Bergfried – Schwarzwald',
    scheduledAt: '2026-08-19T11:00:00+08:00',
    cleanerIds: [],
    cleanerNames: [],
    teamName: 'Housekeeping',
    status: 'scheduled',
    priority: 'high',
    durationMinutes: 150,
    notes: 'Check-out cleaning — Andreas Hoffmann',
    source: 'check_out',
    reservationId: 'bk-22c',
    recurrence: null,
  },
  // bk-23c — Thomas Richter (lst-23, 2026-08-15)
  {
    id: 'cln-co-23c',
    listingId: 'lst-23',
    listingName: 'Villa Zeitreise – Weinregion Pfalz',
    scheduledAt: '2026-08-15T11:00:00+08:00',
    cleanerIds: [],
    cleanerNames: [],
    teamName: 'Housekeeping',
    status: 'scheduled',
    priority: 'high',
    durationMinutes: 180,
    notes: 'Check-out cleaning — Thomas Richter',
    source: 'check_out',
    reservationId: 'bk-23c',
    recurrence: null,
  },
  // bk-24b — Heinrich Müller (lst-24, 2026-08-10)
  {
    id: 'cln-co-24b',
    listingId: 'lst-24',
    listingName: 'Villa Kunstpause – Kulturhaupstadt Weimar',
    scheduledAt: '2026-08-10T11:00:00+08:00',
    cleanerIds: [],
    cleanerNames: [],
    teamName: 'Housekeeping',
    status: 'scheduled',
    priority: 'high',
    durationMinutes: 150,
    notes: 'Check-out cleaning — Heinrich Müller',
    source: 'check_out',
    reservationId: 'bk-24b',
    recurrence: null,
  },
  // bk-24c — Eva Krause (lst-24, 2026-08-22)
  {
    id: 'cln-co-24c',
    listingId: 'lst-24',
    listingName: 'Villa Kunstpause – Kulturhaupstadt Weimar',
    scheduledAt: '2026-08-22T11:00:00+08:00',
    cleanerIds: [],
    cleanerNames: [],
    teamName: 'Housekeeping',
    status: 'scheduled',
    priority: 'high',
    durationMinutes: 150,
    notes: 'Check-out cleaning — Eva Krause',
    source: 'check_out',
    reservationId: 'bk-24c',
    recurrence: null,
  },

  // --- Done cleanings (with full checklist for the report panel) ---
  // Aug 1 (yesterday) — check-out cleaning for Lucas Oliveira (lst-6)
  {
    id: 'cln-done-1',
    listingId: 'lst-6',
    listingName: 'Nomad Mansion Pool',
    scheduledAt: '2026-08-01T11:00:00+08:00',
    cleanerIds: ['staff-4'],
    cleanerNames: ['Wayan Adi'],
    teamName: 'Housekeeping',
    status: 'done',
    priority: 'high',
    durationMinutes: 150,
    notes: 'Check-out cleaning — Lucas Oliveira (pet in stay)',
    source: 'check_out',
    reservationId: 'bk-6a',
    recurrence: null,
    feedback: {
      cleaningCode: 'CH - NomadPool',
      supervisorName: 'Wayan Adi',
      supervisorRole: 'Housekeeping',
      startedAt: '2026-08-01T11:00:00+08:00',
      confirmedAt: '2026-08-01T13:15:00+08:00',
      checklist: [
        {
          id: 'start',
          title: 'Start Reinigung',
          items: [
            { id: 's-1', label: 'Alle Fenster öffnen - Alle Betten abziehen (Bettwäsche nicht auf linke Seite drehen) - Schmutzwäsche sammeln und in Wäschewagen bringen', status: 'ok', completedBy: 'Wayan Adi', completedAt: '2026-08-01T11:30:00+08:00' },
          ],
        },
        {
          id: 'kitchen',
          title: 'Küche',
          items: [
            { id: 'k-1', label: 'Kontrolle Kühlschrank (Lebensmittel entsorgen und reinigen)', status: 'ok', completedBy: 'Wayan Adi', completedAt: '2026-08-01T11:45:00+08:00' },
            { id: 'k-2', label: 'Kontrolle Eisfach (Lebensmittel entsorgen und reinigen)', status: 'ok', completedBy: 'Wayan Adi', completedAt: '2026-08-01T11:50:00+08:00' },
            { id: 'k-3', label: 'Abflusssieb reinigen, kontrollieren ob das Wasser abläuft', status: 'ok', completedBy: 'Wayan Adi', completedAt: '2026-08-01T12:00:00+08:00' },
            { id: 'k-4', label: 'Wasserhahnsieb kontrollieren ob es regelmässig fliesst, ab und zu entkalken', status: 'ok', completedBy: 'Wayan Adi', completedAt: '2026-08-01T12:05:00+08:00' },
            { id: 'k-5', label: 'Alle Schubladen kontrollieren, Ordnung schaffen, schmutzige Schubladen reinigen, Töpfe kontrollieren, Besteck kontrollieren', status: 'issue', notes: 'Pet hair found in lower drawers — extra cleaning required', completedBy: 'Wayan Adi', completedAt: '2026-08-01T12:30:00+08:00' },
          ],
        },
        {
          id: 'bath',
          title: 'Badezimmer',
          items: [
            { id: 'b-1', label: 'Dusche, Badewanne, Waschbecken reinigen und entkalken', status: 'ok', completedBy: 'Wayan Adi', completedAt: '2026-08-01T12:40:00+08:00' },
            { id: 'b-2', label: 'Toilette reinigen und desinfizieren', status: 'ok', completedBy: 'Wayan Adi', completedAt: '2026-08-01T12:45:00+08:00' },
            { id: 'b-3', label: 'Handtücher und Badmatte austauschen', status: 'ok', completedBy: 'Wayan Adi', completedAt: '2026-08-01T12:50:00+08:00' },
          ],
        },
        {
          id: 'outdoor',
          title: 'Aussenbereich',
          items: [
            { id: 'o-1', label: 'Pool auf Sauberkeit prüfen', status: 'ok', completedBy: 'Wayan Adi', completedAt: '2026-08-01T13:00:00+08:00' },
            { id: 'o-2', label: 'Terrasse fegen + Pet hair entfernen', status: 'ok', completedBy: 'Wayan Adi', completedAt: '2026-08-01T13:10:00+08:00' },
          ],
        },
      ],
      cleanlinessRating: 4,
      conditionNotes: 'Overall good. Pet hair found in kitchen drawers — extra effort needed. Bathroom and outdoor areas clean.',
      damages: [],
      itemsLeft: ['Pet toy (ball) under the bed'],
      cleaningDurationMinutes: 135,
      housekeeperNotes: 'Pet-friendly stay. Extra vacuuming required in kitchen and living areas.',
    },
  },
  // Jul 30 — daily cleaning for Yuki Sato (lst-7)
  {
    id: 'cln-done-2',
    listingId: 'lst-7',
    listingName: 'Apartments Main',
    scheduledAt: '2026-07-30T11:00:00+08:00',
    cleanerIds: ['staff-3'],
    cleanerNames: ['Made Surya'],
    teamName: 'Housekeeping',
    status: 'done',
    priority: 'normal',
    durationMinutes: 110,
    notes: 'Daily cleaning — Yuki Sato',
    source: 'daily',
    reservationId: 'bk-7c',
    recurrence: null,
    feedback: {
      cleaningCode: 'CH - AptsMain',
      supervisorName: 'Made Surya',
      supervisorRole: 'Housekeeping',
      startedAt: '2026-07-30T11:00:00+08:00',
      confirmedAt: '2026-07-30T12:50:00+08:00',
      checklist: [
        {
          id: 'start',
          title: 'Start Reinigung',
          items: [
            { id: 's-1', label: 'Alle Fenster öffnen - Alle Betten abziehen (Bettwäsche nicht auf linke Seite drehen) - Schmutzwäsche sammeln und in Wäschewagen bringen', status: 'ok', completedBy: 'Made Surya', completedAt: '2026-07-30T11:20:00+08:00' },
          ],
        },
        {
          id: 'kitchen',
          title: 'Küche',
          items: [
            { id: 'k-1', label: 'Kontrolle Kühlschrank (Lebensmittel entsorgen und reinigen)', status: 'ok', completedBy: 'Made Surya', completedAt: '2026-07-30T11:30:00+08:00' },
            { id: 'k-2', label: 'Abflusssieb reinigen, kontrollieren ob das Wasser abläuft', status: 'ok', completedBy: 'Made Surya', completedAt: '2026-07-30T11:40:00+08:00' },
            { id: 'k-3', label: 'Wasserhahnsieb kontrollieren ob es regelmässig fliesst, ab und zu entkalken', status: 'ok', completedBy: 'Made Surya', completedAt: '2026-07-30T11:45:00+08:00' },
          ],
        },
        {
          id: 'bath',
          title: 'Badezimmer',
          items: [
            { id: 'b-1', label: 'Dusche, Badewanne, Waschbecken reinigen und entkalken', status: 'ok', completedBy: 'Made Surya', completedAt: '2026-07-30T12:10:00+08:00' },
            { id: 'b-2', label: 'Toilette reinigen und desinfizieren', status: 'ok', completedBy: 'Made Surya', completedAt: '2026-07-30T12:15:00+08:00' },
            { id: 'b-3', label: 'Handtücher und Badmatte austauschen', status: 'ok', completedBy: 'Made Surya', completedAt: '2026-07-30T12:20:00+08:00' },
          ],
        },
        {
          id: 'living',
          title: 'Wohnzimmer',
          items: [
            { id: 'l-1', label: 'Möbel abstauben, Polster aufschütteln', status: 'ok', completedBy: 'Made Surya', completedAt: '2026-07-30T12:30:00+08:00' },
            { id: 'l-2', label: 'Boden wischen, Staubsaugen', status: 'ok', completedBy: 'Made Surya', completedAt: '2026-07-30T12:40:00+08:00' },
          ],
        },
      ],
      cleanlinessRating: 5,
      conditionNotes: 'Property in excellent condition. No issues found.',
      damages: [],
      itemsLeft: [],
      cleaningDurationMinutes: 110,
      housekeeperNotes: 'Standard daily clean. Quick and easy.',
    },
  },
  // Jul 27 — check-out cleaning for Frederik Madsen (lst-13)
  {
    id: 'cln-done-3',
    listingId: 'lst-13',
    listingName: 'Volcano View Villa Kintamani',
    scheduledAt: '2026-07-27T11:00:00+08:00',
    cleanerIds: ['staff-3'],
    cleanerNames: ['Made Surya'],
    teamName: 'Housekeeping',
    status: 'done',
    priority: 'high',
    durationMinutes: 165,
    notes: 'Check-out cleaning — Frederik Madsen (pet in stay)',
    source: 'check_out',
    reservationId: 'bk-13a',
    recurrence: null,
    feedback: {
      cleaningCode: 'CH - Volcano',
      supervisorName: 'Made Surya',
      supervisorRole: 'Housekeeping',
      startedAt: '2026-07-27T11:00:00+08:00',
      confirmedAt: '2026-07-27T13:45:00+08:00',
      checklist: [
        {
          id: 'start',
          title: 'Start Reinigung',
          items: [
            { id: 's-1', label: 'Alle Fenster öffnen - Alle Betten abziehen (Bettwäsche nicht auf linke Seite drehen) - Schmutzwäsche sammeln und in Wäschewagen bringen', status: 'ok', completedBy: 'Made Surya', completedAt: '2026-07-27T11:30:00+08:00' },
          ],
        },
        {
          id: 'kitchen',
          title: 'Küche',
          items: [
            { id: 'k-1', label: 'Kontrolle Kühlschrank (Lebensmittel entsorgen und reinigen)', status: 'issue', notes: 'Strong pet smell in fridge area — deep cleaned', completedBy: 'Made Surya', completedAt: '2026-07-27T12:00:00+08:00' },
            { id: 'k-2', label: 'Kontrolle Eisfach (Lebensmittel entsorgen und reinigen)', status: 'ok', completedBy: 'Made Surya', completedAt: '2026-07-27T12:05:00+08:00' },
            { id: 'k-3', label: 'Abflusssieb reinigen, kontrollieren ob das Wasser abläuft', status: 'ok', completedBy: 'Made Surya', completedAt: '2026-07-27T12:15:00+08:00' },
            { id: 'k-4', label: 'Wasserhahnsieb kontrollieren ob es regelmässig fliesst, ab und zu entkalken', status: 'ok', completedBy: 'Made Surya', completedAt: '2026-07-27T12:20:00+08:00' },
            { id: 'k-5', label: 'Alle Schubladen kontrollieren, Ordnung schaffen, schmutzige Schubladen reinigen, Töpfe kontrollieren, Besteck kontrollieren', status: 'issue', notes: 'Pet chew toy in drawer — removed and placed in lost & found', completedBy: 'Made Surya', completedAt: '2026-07-27T12:40:00+08:00' },
          ],
        },
        {
          id: 'bath',
          title: 'Badezimmer',
          items: [
            { id: 'b-1', label: 'Dusche, Badewanne, Waschbecken reinigen und entkalken', status: 'ok', completedBy: 'Made Surya', completedAt: '2026-07-27T12:50:00+08:00' },
            { id: 'b-2', label: 'Toilette reinigen und desinfizieren', status: 'ok', completedBy: 'Made Surya', completedAt: '2026-07-27T12:55:00+08:00' },
            { id: 'b-3', label: 'Handtücher und Badmatte austauschen', status: 'ok', completedBy: 'Made Surya', completedAt: '2026-07-27T13:00:00+08:00' },
          ],
        },
        {
          id: 'outdoor',
          title: 'Aussenbereich',
          items: [
            { id: 'o-1', label: 'Pool auf Sauberkeit prüfen', status: 'ok', completedBy: 'Made Surya', completedAt: '2026-07-27T13:20:00+08:00' },
            { id: 'o-2', label: 'Garten + Terrasse fegen, Pet Hair entfernen', status: 'issue', notes: 'Heavy pet hair on outdoor furniture', completedBy: 'Made Surya', completedAt: '2026-07-27T13:40:00+08:00' },
          ],
        },
      ],
      cleanlinessRating: 3,
      conditionNotes: 'Property in poor condition after pet stay. Strong pet smell in kitchen, pet hair throughout, chew toy found in drawer. Required extra deep cleaning.',
      damages: ['Minor scratch on wooden dining table (likely from pet)'],
      itemsLeft: ['Pet chew toy (in drawer)', 'Pet bed (in living room)'],
      cleaningDurationMinutes: 165,
      housekeeperNotes: 'Pet-heavy stay. Required 2x normal cleaning time. Recommend adding pet fee or requiring professional cleaning for pet stays.',
    },
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
