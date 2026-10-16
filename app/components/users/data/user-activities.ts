// app/components/users/data/user-activities.ts

export type UserActivityType
  = | 'cleaning'
    | 'maintenance'
    | 'guest_message'
    | 'task'
    | 'tracker'
    | 'login'
    | 'check_in'

export interface UserActivity {
  id: string
  userId: string
  type: UserActivityType
  title: string
  description?: string
  listingName?: string
  timestamp: string // ISO
  /** The source only knows the day (time-tracked work), so the feed shows no time of day. */
  dateOnly?: boolean
  /** Where it comes from, so the profile can link back: time-tracked work lives in the Activities report. */
  source?: 'activities'
  durationMinutes?: number
}

export const activityTypeMeta: Record<UserActivityType, { label: string, icon: string, tone: string }> = {
  cleaning: { label: 'Cleaning', icon: 'lucide:brush-cleaning', tone: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-400' },
  maintenance: { label: 'Maintenance', icon: 'lucide:wrench', tone: 'bg-orange-500/10 text-orange-700 dark:text-orange-400' },
  guest_message: { label: 'Guest message', icon: 'lucide:message-circle', tone: 'bg-blue-500/10 text-blue-700 dark:text-blue-400' },
  task: { label: 'Task', icon: 'lucide:list-checks', tone: 'bg-violet-500/10 text-violet-700 dark:text-violet-400' },
  tracker: { label: 'Activity tracker', icon: 'lucide:timer', tone: 'bg-amber-500/10 text-amber-700 dark:text-amber-400' },
  login: { label: 'Signed in', icon: 'lucide:log-in', tone: 'bg-muted text-muted-foreground' },
  check_in: { label: 'Guest check-in', icon: 'lucide:door-open', tone: 'bg-green-500/10 text-green-700 dark:text-green-400' },
}

// Anchored to today, like the Activities report, so both show the same days. Time-tracked work (cleaning,
// tasks, activity tracker) is not seeded here: it comes from the Activities module (`useActivityReport`).
const TODAY = new Date()
TODAY.setUTCHours(0, 0, 0, 0)

function iso(daysAgo: number, hour: number, minute = 0): string {
  const d = new Date(TODAY)
  d.setUTCDate(d.getUTCDate() - daysAgo)
  d.setUTCHours(hour, minute, 0, 0)
  return d.toISOString()
}

let idCounter = 0
function aid(): string {
  idCounter += 1
  return `act-${idCounter.toString(36)}`
}

export const seedActivities: UserActivity[] = [
  // user-1 Komang Juliantara (Guest Experience)
  { id: aid(), userId: 'user-1', type: 'guest_message', title: 'Replied to Anna Schmidt', listingName: 'Villa Bidadari', timestamp: iso(0, 8, 32), description: 'Sent check-in instructions and Wi-Fi details.' },
  { id: aid(), userId: 'user-1', type: 'guest_message', title: 'Replied to Max Müller', listingName: 'Villa Bidadari', timestamp: iso(0, 10, 14), description: 'Confirmed early check-in request.' },
  { id: aid(), userId: 'user-1', type: 'guest_message', title: 'Replied to Yuki Tanaka', listingName: 'Casa Lomas', timestamp: iso(2, 9, 48) },
  { id: aid(), userId: 'user-1', type: 'login', title: 'Signed in', timestamp: iso(3, 8, 2) },
  { id: aid(), userId: 'user-1', type: 'guest_message', title: 'Replied to Sophie Laurent', listingName: 'Ubud Jungle Loft', timestamp: iso(4, 11, 20), durationMinutes: 8 },
  { id: aid(), userId: 'user-1', type: 'check_in', title: 'Coordinated check-in', listingName: 'Villa Bidadari', timestamp: iso(5, 14, 0) },
  { id: aid(), userId: 'user-1', type: 'guest_message', title: 'Replied to Marcel Weber', listingName: 'Casa Lomas', timestamp: iso(7, 16, 33) },
  { id: aid(), userId: 'user-1', type: 'guest_message', title: 'Replied to Lisa Park', listingName: 'Villa Bidadari', timestamp: iso(11, 9, 12) },
  { id: aid(), userId: 'user-1', type: 'login', title: 'Signed in', timestamp: iso(12, 8, 0) },

  // user-2 Made Surya (Listing Manager)
  { id: aid(), userId: 'user-2', type: 'maintenance', title: 'Inspected pool pump', listingName: 'Casa Lomas', timestamp: iso(0, 7, 45), durationMinutes: 40 },
  { id: aid(), userId: 'user-2', type: 'guest_message', title: 'Coordinated maintenance window', listingName: 'Seminyak Sky', timestamp: iso(2, 10, 5) },
  { id: aid(), userId: 'user-2', type: 'login', title: 'Signed in', timestamp: iso(3, 7, 55) },
  { id: aid(), userId: 'user-2', type: 'maintenance', title: 'Scheduled AC servicing', listingName: 'Ubud Jungle Loft', timestamp: iso(4, 9, 30) },
  { id: aid(), userId: 'user-2', type: 'check_in', title: 'Oversaw guest arrival', listingName: 'Villa Bidadari', timestamp: iso(5, 15, 0) },
  { id: aid(), userId: 'user-2', type: 'login', title: 'Signed in', timestamp: iso(10, 8, 0) },
  { id: aid(), userId: 'user-2', type: 'maintenance', title: 'Repaired bedroom door', listingName: 'Canggu Cove', timestamp: iso(13, 14, 20), durationMinutes: 50 },

  // user-3 Wayan Adi (Listing Manager)
  { id: aid(), userId: 'user-3', type: 'maintenance', title: 'Replaced garden lighting', listingName: 'Ubud Jungle Loft', timestamp: iso(1, 9, 0), durationMinutes: 75 },
  { id: aid(), userId: 'user-3', type: 'guest_message', title: 'Replied to booking inquiry', listingName: 'Canggu Cove', timestamp: iso(4, 16, 15) },
  { id: aid(), userId: 'user-3', type: 'login', title: 'Signed in', timestamp: iso(5, 8, 0) },
  { id: aid(), userId: 'user-3', type: 'check_in', title: 'Met arriving guests', listingName: 'Canggu Cove', timestamp: iso(6, 14, 0) },
  { id: aid(), userId: 'user-3', type: 'maintenance', title: 'Inspected roof after storm', listingName: 'Ubud Jungle Loft', timestamp: iso(9, 10, 0), durationMinutes: 30 },

  // user-5 Made Wirawan (General Manager)
  { id: aid(), userId: 'user-5', type: 'guest_message', title: 'Escalated guest complaint', listingName: 'Villa Bidadari', timestamp: iso(5, 11, 0) },
  { id: aid(), userId: 'user-5', type: 'login', title: 'Signed in', timestamp: iso(6, 7, 45) },
  { id: aid(), userId: 'user-5', type: 'login', title: 'Signed in', timestamp: iso(13, 8, 0) },

  // user-6 Ni Putu Sari (Housekeeping Manager)
  { id: aid(), userId: 'user-6', type: 'login', title: 'Signed in', timestamp: iso(3, 7, 0) },
  { id: aid(), userId: 'user-6', type: 'login', title: 'Signed in', timestamp: iso(12, 7, 15) },

  // user-7 Ketut Antara (Housekeeping)
  { id: aid(), userId: 'user-7', type: 'login', title: 'Signed in', timestamp: iso(3, 7, 30) },
  { id: aid(), userId: 'user-7', type: 'login', title: 'Signed in', timestamp: iso(7, 7, 30) },
  { id: aid(), userId: 'user-7', type: 'login', title: 'Signed in', timestamp: iso(11, 7, 30) },

  // user-8 Gede Pratama (Pool — INACTIVE: minimal recent activity)
  { id: aid(), userId: 'user-8', type: 'login', title: 'Signed in (last activity)', timestamp: iso(28, 8, 0) },
]
