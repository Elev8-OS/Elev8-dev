# Reservations & Guest Profiles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Reservations module — a filterable reservations table at `/reservations` and a guest profile page at `/reservations/guests/[id]` — built on a new standalone dataset following existing app patterns.

**Architecture:** New `app/components/reservations/` module + `app/composables/useReservationsModule.ts` composable holding `useState` reservations/guests, filters, and derived per-guest data (named `useReservationsModule` because `useReservations` is an existing finance composable). Pages mirror existing conventions: list page like `payment-requests/index.vue`, guest detail like `users/[id].vue`. Data is blended mock data (6 rich inbox reservations + finance rows); no API.

**Tech Stack:** Nuxt 3, Vue 3, shadcn-vue (Button, Card, Badge, Avatar, Input, Select, Popover, Command, Checkbox, RangeCalendar, Separator, ScrollArea, Sheet, DropdownMenu, Table, Skeleton), TanStack? (no — plain shadcn table like PaymentRequestTable), reka-ui DateRange, vue-sonner toasts, date-fns formatting, vitest.

---

## File Structure

**Create:**
- `app/components/reservations/data/reservations.ts` — types + mock data
- `app/composables/useReservationsModule.ts` — state, filters, derived data (NOTE: named `useReservationsModule`, NOT `useReservations` — the latter is an existing finance composable; the new one must not collide)
- `app/components/reservations/ReservationStatusBadge.vue` — status badge
- `app/components/reservations/ReservationGuestCell.vue` — guest avatar/name/email cell
- `app/components/reservations/ReservationTable.vue` — the list table
- `app/components/reservations/ReservationDetailSheet.vue` — row-click detail sheet
- `app/components/reservations/NewReservationDialog.vue` — create dialog
- `app/components/reservations/GuestProfileHeader.vue` — profile hero card
- `app/components/reservations/GuestStatsStrip.vue` — KPI cards
- `app/components/reservations/GuestReservationsTable.vue` — guest's stays
- `app/components/reservations/GuestBookingHistory.vue` — booking history section
- `app/components/reservations/GuestActivityTimeline.vue` — activity section
- `app/components/reservations/GuestPaymentRequests.vue` — payment requests section
- `app/components/reservations/GuestUpsells.vue` — upsells section
- `app/components/reservations/GuestNotes.vue` — editable notes
- `app/pages/reservations/index.vue` — list page
- `app/pages/reservations/guests/[id].vue` — guest profile page
- `tests/composables/useReservations.spec.ts` — unit tests

**Modify:**
- `app/constants/menus.ts` — add "Reservations" nav item
- `app/components/listings/data/listings.ts` — nothing (data read-only)

---

## Task 1: Data model + mock data

**Files:**
- Create: `app/components/reservations/data/reservations.ts`
- Test: `tests/composables/useReservations.spec.ts` (created in Task 2)

- [ ] **Step 1: Create the data file**

```ts
import { ref } from 'vue'
import type { ActivityEvent } from '~/components/inbox/data/conversations'

export type ReservationStatus = 'inquiry' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled'

export interface ReservationEntry {
  id: string
  guestId: string
  guestName: string
  guestEmail: string
  guestPhone: string
  guestLanguage: string
  guestNotes: string
  listingId: string
  listingName: string
  channel: 'Airbnb' | 'Booking.com' | 'Direct'
  checkIn: string // ISO date YYYY-MM-DD
  checkOut: string // ISO date YYYY-MM-DD
  nights: number
  guestCount: number
  totalPrice: number
  currency: string
  status: ReservationStatus
  conversationId?: string
  paymentRequestId?: string
  guestGuideId?: string
  upsellIds?: string[]
  activity: ActivityEvent[]
}

export interface GuestProfile {
  id: string
  name: string
  email: string
  phone: string
  language: string
  notes: string
  previousStays: number
  tags: string[]
  createdAt: string
}

export interface GuestBookingHistoryItem {
  id: string
  checkIn: string
  nights: number
  listingName: string
  totalPrice: number
  currency: string
  hostReviewOfGuest?: { rating: number, text: string }
  guestReviewOfProperty?: { rating: number, text: string }
}

export interface ReservationDraft {
  guestName: string
  guestEmail: string
  guestPhone: string
  guestLanguage: string
  guestNotes: string
  listingId: string
  listingName: string
  channel: 'Airbnb' | 'Booking.com' | 'Direct'
  checkIn: string
  checkOut: string
  nights: number
  guestCount: number
  totalPrice: number
  currency: string
}

export function generateReservationId(): string {
  return `res-${Date.now()}`
}

export const reservationStatusLabels: Record<ReservationStatus, string> = {
  inquiry: 'Inquiry',
  confirmed: 'Confirmed',
  checked_in: 'Checked in',
  checked_out: 'Checked out',
  cancelled: 'Cancelled',
}

export const initialReservations: ReservationEntry[] = [
  // Rich records (from inbox, enriched)
  {
    id: 'res-1',
    guestId: 'guest-1',
    guestName: 'Sarah Mitchell',
    guestEmail: 'sarah.mitchell@email.com',
    guestPhone: '+1 555-0142',
    guestLanguage: 'English',
    guestNotes: 'Returning guest. Prefers early check-in. Allergic to feather pillows.',
    listingId: 'lst-1',
    listingName: '5BR Pool the R Villa Luwa – Serene near Canggu',
    channel: 'Airbnb',
    checkIn: '2026-07-10',
    checkOut: '2026-07-15',
    nights: 5,
    guestCount: 2,
    totalPrice: 750,
    currency: 'USD',
    status: 'checked_out',
    conversationId: 'conv-1',
    activity: [],
  },
  {
    id: 'res-2',
    guestId: 'guest-2',
    guestName: 'James Carter',
    guestEmail: 'james.carter@email.com',
    guestPhone: '+44 20 7946 0958',
    guestLanguage: 'English',
    guestNotes: 'Anniversary trip. Wants a welcome bottle on arrival.',
    listingId: 'lst-2',
    listingName: 'Villa Sehnsucht – Seegrundstück Mecklenburg',
    channel: 'Booking.com',
    checkIn: '2026-07-20',
    checkOut: '2026-07-27',
    nights: 7,
    guestCount: 2,
    totalPrice: 2460,
    currency: 'EUR',
    status: 'checked_out',
    conversationId: 'conv-2',
    activity: [],
  },
  // Finance-derived records (blended)
  {
    id: 'lex-res-001',
    guestId: 'guest-3',
    guestName: 'Erik Hoffmann',
    guestEmail: 'erik.hoffmann@email.com',
    guestPhone: '+49 151 23456789',
    guestLanguage: 'German',
    guestNotes: '',
    listingId: 'lst-3',
    listingName: 'Villa Luwa – Hügellage Brandenburg',
    channel: 'Airbnb',
    checkIn: '2026-07-21',
    checkOut: '2026-07-26',
    nights: 5,
    guestCount: 2,
    totalPrice: 1280,
    currency: 'EUR',
    status: 'checked_out',
    activity: [],
  },
  {
    id: 'lex-res-008',
    guestId: 'guest-4',
    guestName: 'Marta Kowalski',
    guestEmail: 'marta.kowalski@email.com',
    guestPhone: '+48 600 123456',
    guestLanguage: 'Polish',
    guestNotes: '',
    listingId: 'lst-4',
    listingName: 'Villa Zeitreise – Weinregion Pfalz',
    channel: 'Direct',
    checkIn: '2026-08-08',
    checkOut: '2026-08-13',
    nights: 5,
    guestCount: 3,
    totalPrice: 1200,
    currency: 'EUR',
    status: 'confirmed',
    activity: [],
  },
  {
    id: 'lex-res-002',
    guestId: 'guest-5',
    guestName: 'Anna Brunner',
    guestEmail: 'anna.brunner@email.com',
    guestPhone: '+43 660 1234567',
    guestLanguage: 'German',
    guestNotes: '',
    listingId: 'lst-5',
    listingName: 'Villa Bergfried – Schwarzwald',
    channel: 'Airbnb',
    checkIn: '2026-07-22',
    checkOut: '2026-07-29',
    nights: 7,
    guestCount: 2,
    totalPrice: 2460,
    currency: 'EUR',
    status: 'checked_out',
    activity: [],
  },
]

export const initialGuests: GuestProfile[] = [
  {
    id: 'guest-1',
    name: 'Sarah Mitchell',
    email: 'sarah.mitchell@email.com',
    phone: '+1 555-0142',
    language: 'English',
    notes: 'Returning guest. Prefers early check-in. Allergic to feather pillows.',
    previousStays: 2,
    tags: ['Returning', 'Early check-in'],
    createdAt: '2025-11-02',
  },
  {
    id: 'guest-2',
    name: 'James Carter',
    email: 'james.carter@email.com',
    phone: '+44 20 7946 0958',
    language: 'English',
    notes: 'Anniversary trip. Wants a welcome bottle on arrival.',
    previousStays: 1,
    tags: ['Anniversary'],
    createdAt: '2026-01-14',
  },
  {
    id: 'guest-3',
    name: 'Erik Hoffmann',
    email: 'erik.hoffmann@email.com',
    phone: '+49 151 23456789',
    language: 'German',
    notes: '',
    previousStays: 1,
    tags: [],
    createdAt: '2026-02-10',
  },
  {
    id: 'guest-4',
    name: 'Marta Kowalski',
    email: 'marta.kowalski@email.com',
    phone: '+48 600 123456',
    language: 'Polish',
    notes: '',
    previousStays: 0,
    tags: [],
    createdAt: '2026-07-28',
  },
  {
    id: 'guest-5',
    name: 'Anna Brunner',
    email: 'anna.brunner@email.com',
    phone: '+43 660 1234567',
    language: 'German',
    notes: '',
    previousStays: 1,
    tags: [],
    createdAt: '2026-01-20',
  },
]

// Convenience: helper to compute nights between two ISO dates
export function nightsBetween(checkIn: string, checkOut: string): number {
  const start = new Date(`${checkIn}T00:00:00Z`)
  const end = new Date(`${checkOut}T00:00:00Z`)
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
}
```

- [ ] **Step 2: Verify it parses**

Run: `pnpm exec vue-tsc --noEmit -p tsconfig.json`
Expected: no errors related to `reservations/data/reservations.ts`. (Known pre-existing type errors elsewhere are acceptable — filter output for this file.)

- [ ] **Step 3: Commit**

```bash
git add app/components/reservations/data/reservations.ts
git commit -m "feat(reservations): add reservation and guest data model with mock data"
```

---

## Task 2: Composable + unit tests

**Files:**
- Create: `app/composables/useReservationsModule.ts` (NOTE: NOT `useReservations.ts` — that name is taken by an existing finance composable; the new one must be `useReservationsModule`)
- Create: `tests/composables/useReservations.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, beforeEach } from 'vitest'
import { useReservationsModule } from '~/composables/useReservationsModule'

describe('useReservationsModule', () => {
  beforeEach(() => {
    // Reset module state between tests (useState persists across calls)
    const { reset } = useReservationsModule()
    reset()
  })

  it('initializes with mock data', () => {
    const { reservations, guests } = useReservationsModule()
    expect(reservations.value.length).toBeGreaterThanOrEqual(5)
    expect(guests.value.length).toBeGreaterThanOrEqual(5)
  })

  it('getGuestById returns a guest and null for missing id', () => {
    const { getGuestById } = useReservationsModule()
    expect(getGuestById('guest-1')?.name).toBe('Sarah Mitchell')
    expect(getGuestById('missing')).toBeNull()
  })

  it('getReservationsForGuest returns all stays sorted by check-in desc', () => {
    const { getReservationsForGuest } = useReservationsModule()
    const stays = getReservationsForGuest('guest-1')
    expect(stays.length).toBeGreaterThanOrEqual(1)
    const dates = stays.map(s => s.checkIn)
    expect([...dates].sort().reverse()).toEqual(dates)
  })

  it('filteredReservations applies search, status, listing, and date range filters', () => {
    const { filteredReservations, filters } = useReservationsModule()
    filters.value.search = 'sarah'
    expect(filteredReservations.value.every(r => r.guestName.toLowerCase().includes('sarah'))).toBe(true)
    filters.value.search = ''
    filters.value.status = 'confirmed'
    expect(filteredReservations.value.every(r => r.status === 'confirmed')).toBe(true)
    filters.value.status = 'all'
    filters.value.listings = ['lst-1']
    expect(filteredReservations.value.every(r => r.listingId === 'lst-1')).toBe(true)
    filters.value.listings = []
    filters.value.dateFrom = '2026-07-20'
    filters.value.dateTo = '2026-07-25'
    expect(filteredReservations.value.every(r => r.checkIn >= '2026-07-20' && r.checkIn <= '2026-07-25')).toBe(true)
  })

  it('stats counts upcoming, current, past, and cancelled reservations', () => {
    const { stats } = useReservationsModule()
    expect(stats.value.upcoming + stats.value.current + stats.value.past + stats.value.cancelled)
      .toBeGreaterThanOrEqual(5)
  })

  it('createReservation validates required fields and adds to list', () => {
    const { createReservation, reservations } = useReservationsModule()
    const before = reservations.value.length
    const result = createReservation({
      guestName: '',
      guestEmail: '',
      guestPhone: '',
      guestLanguage: '',
      guestNotes: '',
      listingId: '',
      listingName: '',
      channel: 'Direct',
      checkIn: '',
      checkOut: '',
      nights: 1,
      guestCount: 1,
      totalPrice: 100,
      currency: 'USD',
    })
    expect(result.success).toBe(false)
    const ok = createReservation({
      guestName: 'Test Guest',
      guestEmail: 'test@email.com',
      guestPhone: '+1 555-0000',
      guestLanguage: 'English',
      guestNotes: '',
      listingId: 'lst-1',
      listingName: 'Test Villa',
      channel: 'Direct',
      checkIn: '2026-09-01',
      checkOut: '2026-09-03',
      nights: 2,
      guestCount: 2,
      totalPrice: 300,
      currency: 'USD',
    })
    expect(ok.success).toBe(true)
    expect(reservations.value.length).toBe(before + 1)
    expect(reservations.value[0].guestName).toBe('Test Guest')
    expect(reservations.value[0].status).toBe('confirmed')
  })

  it('updateGuestNotes updates a guest profile', () => {
    const { updateGuestNotes, getGuestById } = useReservationsModule()
    updateGuestNotes('guest-1', 'New note')
    expect(getGuestById('guest-1')?.notes).toBe('New note')
    updateGuestNotes('missing', 'x')
    expect(getGuestById('missing')).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run tests/composables/useReservations.spec.ts`
Expected: FAIL — module `useReservations` not found / import error.

- [ ] **Step 3: Write the composable**

```ts
import type { GuestProfile, ReservationDraft, ReservationEntry, ReservationStatus } from '~/components/reservations/data/reservations'
import { generateReservationId, initialGuests, initialReservations } from '~/components/reservations/data/reservations'

export interface ReservationFilters {
  search: string
  status: ReservationStatus | 'all'
  listings: string[]
  dateFrom: string
  dateTo: string
}

export function useReservationsModule() {
  const reservations = useState<ReservationEntry[]>('reservations-entries', () =>
    initialReservations.map(r => ({ ...r })))
  const guests = useState<GuestProfile[]>('reservations-guests', () =>
    initialGuests.map(g => ({ ...g })))

  const filters = ref<ReservationFilters>({
    search: '',
    status: 'all',
    listings: [],
    dateFrom: '',
    dateTo: '',
  })

  const filteredReservations = computed(() => {
    return reservations.value.filter((r) => {
      if (filters.value.status !== 'all' && r.status !== filters.value.status)
        return false
      if (filters.value.listings.length > 0 && !filters.value.listings.includes(r.listingId))
        return false
      if (filters.value.dateFrom && r.checkIn < filters.value.dateFrom)
        return false
      if (filters.value.dateTo && r.checkIn > filters.value.dateTo)
        return false
      if (filters.value.search) {
        const q = filters.value.search.toLowerCase()
        const haystack = `${r.guestName} ${r.guestEmail} ${r.listingName} ${r.id}`.toLowerCase()
        if (!haystack.includes(q))
          return false
      }
      return true
    })
  })

  const today = new Date().toISOString().split('T')[0]

  const stats = computed(() => {
    let upcoming = 0
    let current = 0
    let past = 0
    let cancelled = 0
    for (const r of reservations.value) {
      if (r.status === 'cancelled') {
        cancelled++
        continue
      }
      if (r.checkIn > today)
        upcoming++
      else if (r.checkOut >= today)
        current++
      else
        past++
    }
    return { upcoming, current, past, cancelled }
  })

  function getGuestById(id: string): GuestProfile | null {
    return guests.value.find(g => g.id === id) ?? null
  }

  function getReservationsForGuest(guestId: string): ReservationEntry[] {
    return reservations.value
      .filter(r => r.guestId === guestId)
      .sort((a, b) => (a.checkIn < b.checkIn ? 1 : -1))
  }

  function createReservation(draft: ReservationDraft): { success: boolean, id?: string } {
    if (!draft.guestName.trim() || !draft.listingId.trim() || !draft.checkIn.trim() || !draft.checkOut.trim())
      return { success: false }

    const id = generateReservationId()
    const entry: ReservationEntry = {
      id,
      ...draft,
      status: 'confirmed',
      activity: [],
    }
    reservations.value = [entry, ...reservations.value]
    return { success: true, id }
  }

  function updateGuestNotes(id: string, notes: string) {
    guests.value = guests.value.map(g =>
      g.id === id ? { ...g, notes } : g,
    )
  }

  function reset() {
    reservations.value = initialReservations.map(r => ({ ...r }))
    guests.value = initialGuests.map(g => ({ ...g }))
    filters.value = { search: '', status: 'all', listings: [], dateFrom: '', dateTo: '' }
  }

  return {
    reservations,
    guests,
    filters,
    filteredReservations,
    stats,
    getGuestById,
    getReservationsForGuest,
    createReservation,
    updateGuestNotes,
    reset,
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run tests/composables/useReservations.spec.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add app/composables/useReservationsModule.ts tests/composables/useReservations.spec.ts
git commit -m "feat(reservations): add useReservationsModule composable with filters and tests"
```

---

## Task 3: Status badge + guest cell components

**Files:**
- Create: `app/components/reservations/ReservationStatusBadge.vue`
- Create: `app/components/reservations/ReservationGuestCell.vue`

- [ ] **Step 1: Create ReservationStatusBadge.vue**

```vue
<script setup lang="ts">
import type { ReservationStatus } from '~/components/reservations/data/reservations'
import { reservationStatusLabels } from '~/components/reservations/data/reservations'

const props = defineProps<{ status: ReservationStatus }>()

const classes: Record<ReservationStatus, string> = {
  inquiry: 'bg-amber-500/10 text-amber-700 border-amber-500/30',
  confirmed: 'bg-primary/10 text-primary border-primary/30',
  checked_in: 'bg-blue-500/10 text-blue-700 border-blue-500/30',
  checked_out: 'bg-muted text-muted-foreground border-border',
  cancelled: 'bg-red-500/10 text-red-700 border-red-500/30',
}
</script>

<template>
  <Badge variant="outline" :class="classes[props.status]">
    {{ reservationStatusLabels[props.status] }}
  </Badge>
</template>
```

- [ ] **Step 2: Create ReservationGuestCell.vue**

```vue
<script setup lang="ts">
interface Props {
  name: string
  email: string
}

defineProps<Props>()

function initials(name: string): string {
  return name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()
}
</script>

<template>
  <div class="flex items-center gap-3">
    <Avatar class="size-9">
      <AvatarFallback class="bg-primary/10 text-primary text-xs">
        {{ initials(name) }}
      </AvatarFallback>
    </Avatar>
    <div class="min-w-0">
      <p class="text-sm font-medium truncate">
        {{ name }}
      </p>
      <p class="text-xs text-muted-foreground truncate">
        {{ email }}
      </p>
    </div>
  </div>
</template>
```

- [ ] **Step 3: Verify components parse**

Run: `pnpm exec vue-tsc --noEmit -p tsconfig.json`
Expected: no new errors for these files.

- [ ] **Step 4: Commit**

```bash
git add app/components/reservations/ReservationStatusBadge.vue app/components/reservations/ReservationGuestCell.vue
git commit -m "feat(reservations): add status badge and guest cell components"
```

---

## Task 4: Reservation table

**Files:**
- Create: `app/components/reservations/ReservationTable.vue`

- [ ] **Step 1: Create ReservationTable.vue**

```vue
<script setup lang="ts">
import type { ReservationEntry } from '~/components/reservations/data/reservations'

defineProps<{ reservations: ReservationEntry[] }>()

const emit = defineEmits<{
  openGuest: [id: string]
  openDetail: [reservation: ReservationEntry]
  copyId: [id: string]
}>()

const df = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

function fmtDate(iso: string): string {
  return df.format(new Date(`${iso}T00:00:00Z`))
}

function fmtCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
}
</script>

<template>
  <div class="rounded-md border">
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="bg-muted/50 text-xs uppercase text-muted-foreground">
          <tr>
            <th class="text-left font-medium px-4 py-3">Guest</th>
            <th class="text-left font-medium px-4 py-3">Listing</th>
            <th class="text-left font-medium px-4 py-3">Check-in</th>
            <th class="text-left font-medium px-4 py-3">Check-out</th>
            <th class="text-left font-medium px-4 py-3">Nights</th>
            <th class="text-left font-medium px-4 py-3">Guests</th>
            <th class="text-left font-medium px-4 py-3">Channel</th>
            <th class="text-right font-medium px-4 py-3">Total</th>
            <th class="text-left font-medium px-4 py-3">Status</th>
            <th class="text-left font-medium px-4 py-3"><span class="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="r in reservations"
            :key="r.id"
            class="border-t hover:bg-muted/30 transition-colors cursor-pointer"
            @click="emit('openDetail', r)"
          >
            <td class="px-4 py-3" @click.stop>
              <button
                type="button"
                class="text-left hover:underline"
                @click="emit('openGuest', r.guestId)"
              >
                <ReservationGuestCell :name="r.guestName" :email="r.guestEmail" />
              </button>
            </td>
            <td class="px-4 py-3">
              <NuxtLink :to="`/listings/${r.listingId}`" class="text-primary hover:underline">
                {{ r.listingName }}
              </NuxtLink>
            </td>
            <td class="px-4 py-3">
              {{ fmtDate(r.checkIn) }}
            </td>
            <td class="px-4 py-3">
              {{ fmtDate(r.checkOut) }}
            </td>
            <td class="px-4 py-3">
              {{ r.nights }}
            </td>
            <td class="px-4 py-3">
              {{ r.guestCount }}
            </td>
            <td class="px-4 py-3">
              {{ r.channel }}
            </td>
            <td class="px-4 py-3 text-right tabular-nums">
              {{ fmtCurrency(r.totalPrice, r.currency) }}
            </td>
            <td class="px-4 py-3">
              <ReservationStatusBadge :status="r.status" />
            </td>
            <td class="px-4 py-3">
              <DropdownMenu>
                <DropdownMenuTrigger as-child>
                  <Button variant="ghost" size="sm" class="h-8 w-8 p-0" @click.stop>
                    <Icon name="lucide:more-horizontal" class="size-4" />
                    <span class="sr-only">Actions</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem @select="emit('openDetail', r)">
                    <Icon name="lucide:eye" class="mr-2 size-4" />
                    View Reservation
                  </DropdownMenuItem>
                  <DropdownMenuItem @select="emit('openGuest', r.guestId)">
                    <Icon name="lucide:user" class="mr-2 size-4" />
                    Open Guest
                  </DropdownMenuItem>
                  <DropdownMenuItem @select="emit('copyId', r.id)">
                    <Icon name="lucide:copy" class="mr-2 size-4" />
                    Copy booking ID
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </td>
          </tr>
          <tr v-if="reservations.length === 0">
            <td colspan="10" class="px-4 py-12 text-center text-sm text-muted-foreground">
              <div class="flex flex-col items-center gap-2">
                <Icon name="lucide:calendar-x" class="size-8 opacity-50" />
                No reservations match your filters.
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Verify it parses**

Run: `pnpm exec vue-tsc --noEmit -p tsconfig.json`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add app/components/reservations/ReservationTable.vue
git commit -m "feat(reservations): add reservations table component"
```

---

## Task 5: Reservation detail sheet

**Files:**
- Create: `app/components/reservations/ReservationDetailSheet.vue`

- [ ] **Step 1: Create ReservationDetailSheet.vue**

```vue
<script setup lang="ts">
import type { ReservationEntry } from '~/components/reservations/data/reservations'
import { reservationStatusLabels } from '~/components/reservations/data/reservations'

const props = defineProps<{
  reservation: ReservationEntry | null
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  openGuest: [id: string]
}>()

const df = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

function fmtDate(iso: string): string {
  return df.format(new Date(`${iso}T00:00:00Z`))
}

function fmtCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
}
</script>

<template>
  <Sheet :open="open" @update:open="emit('update:open', $event)">
    <SheetContent class="w-full sm:max-w-md">
      <SheetHeader>
        <SheetTitle>Reservation</SheetTitle>
        <SheetDescription v-if="reservation">
          {{ reservation.id }} · {{ reservationStatusLabels[reservation.status] }}
        </SheetDescription>
      </SheetHeader>

      <template v-if="reservation">
        <ScrollArea class="flex-1 pr-4">
          <div class="space-y-6 py-4">
            <!-- Guest -->
            <div>
              <div class="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                Guest
              </div>
              <div class="flex items-center justify-between gap-2">
                <button
                  type="button"
                  class="text-left hover:underline"
                  @click="emit('openGuest', reservation.guestId)"
                >
                  <ReservationGuestCell :name="reservation.guestName" :email="reservation.guestEmail" />
                </button>
              </div>
              <p class="mt-1 text-xs text-muted-foreground">
                {{ reservation.guestPhone }}
              </p>
            </div>

            <Separator />

            <!-- Listing -->
            <div>
              <div class="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                Listing
              </div>
              <NuxtLink :to="`/listings/${reservation.listingId}`" class="text-primary hover:underline text-sm font-medium">
                {{ reservation.listingName }}
              </NuxtLink>
            </div>

            <Separator />

            <!-- Dates -->
            <div class="grid grid-cols-2 gap-4">
              <div>
                <div class="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Check-in
                </div>
                <div class="text-sm font-medium">
                  {{ fmtDate(reservation.checkIn) }}
                </div>
              </div>
              <div>
                <div class="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Check-out
                </div>
                <div class="text-sm font-medium">
                  {{ fmtDate(reservation.checkOut) }}
                </div>
              </div>
            </div>

            <Separator />

            <!-- Details -->
            <div class="grid grid-cols-2 gap-4">
              <div>
                <div class="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Nights
                </div>
                <div class="text-sm font-medium">
                  {{ reservation.nights }}
                </div>
              </div>
              <div>
                <div class="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Guests
                </div>
                <div class="text-sm font-medium">
                  {{ reservation.guestCount }}
                </div>
              </div>
              <div>
                <div class="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Channel
                </div>
                <div class="text-sm font-medium">
                  {{ reservation.channel }}
                </div>
              </div>
              <div>
                <div class="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Total
                </div>
                <div class="text-sm font-semibold">
                  {{ fmtCurrency(reservation.totalPrice, reservation.currency) }}
                </div>
              </div>
            </div>

            <Separator />

            <!-- Notes -->
            <div>
              <div class="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                Guest notes
              </div>
              <p class="text-sm" :class="reservation.guestNotes ? '' : 'text-muted-foreground italic'">
                {{ reservation.guestNotes || 'No notes' }}
              </p>
            </div>
          </div>
        </ScrollArea>
      </template>
    </SheetContent>
  </Sheet>
</template>
```

- [ ] **Step 2: Verify it parses**

Run: `pnpm exec vue-tsc --noEmit -p tsconfig.json`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add app/components/reservations/ReservationDetailSheet.vue
git commit -m "feat(reservations): add reservation detail sheet"
```

---

## Task 6: New reservation dialog

**Files:**
- Create: `app/components/reservations/NewReservationDialog.vue`

- [ ] **Step 1: Create NewReservationDialog.vue**

```vue
<script setup lang="ts">
import type { ReservationEntry } from '~/components/reservations/data/reservations'
import { nightsBetween } from '~/components/reservations/data/reservations'
import { listings } from '~/components/listings/data/listings'
import { useReservationsModule } from '~/composables/useReservationsModule'
import { toast } from 'vue-sonner'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{
  'update:open': [value: boolean]
  created: [reservation: ReservationEntry]
}>()

const { createReservation } = useReservationsModule()

const guestName = ref('')
const guestEmail = ref('')
const guestPhone = ref('')
const listingId = ref('')
const checkIn = ref('')
const checkOut = ref('')
const guestCount = ref(2)
const totalPrice = ref(0)
const currency = ref('USD')

const listingOptions = computed(() => listings.value.map(l => ({ id: l.id, name: l.name })))

const computedNights = computed(() => {
  if (!checkIn.value || !checkOut.value)
    return 0
  return nightsBetween(checkIn.value, checkOut.value)
})

const channel = computed(() => 'Direct' as const)

function reset() {
  guestName.value = ''
  guestEmail.value = ''
  guestPhone.value = ''
  listingId.value = ''
  checkIn.value = ''
  checkOut.value = ''
  guestCount.value = 2
  totalPrice.value = 0
  currency.value = 'USD'
}

function handleSubmit() {
  const listing = listingOptions.value.find(l => l.id === listingId.value)
  const result = createReservation({
    guestName: guestName.value.trim(),
    guestEmail: guestEmail.value.trim(),
    guestPhone: guestPhone.value.trim(),
    guestLanguage: 'English',
    guestNotes: '',
    listingId: listingId.value,
    listingName: listing?.name ?? listingId.value,
    channel: channel.value,
    checkIn: checkIn.value,
    checkOut: checkOut.value,
    nights: computedNights.value,
    guestCount: guestCount.value,
    totalPrice: totalPrice.value,
    currency: currency.value,
  })
  if (!result.success) {
    toast.error('Please fill in guest name, listing, and check-in/check-out dates.')
    return
  }
  toast.success('Reservation created')
  reset()
  emit('update:open', false)
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>New Reservation</DialogTitle>
        <DialogDescription>
          Create a direct reservation for a guest.
        </DialogDescription>
      </DialogHeader>

      <div class="grid gap-4 py-2">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div class="space-y-2">
            <Label>Guest name</Label>
            <Input v-model="guestName" placeholder="Guest name" />
          </div>
          <div class="space-y-2">
            <Label>Email</Label>
            <Input v-model="guestEmail" type="email" placeholder="guest@email.com" />
          </div>
          <div class="space-y-2">
            <Label>Phone</Label>
            <Input v-model="guestPhone" placeholder="+62 812..." />
          </div>
          <div class="space-y-2">
            <Label>Listing</Label>
            <Select v-model="listingId">
              <SelectTrigger>
                <SelectValue placeholder="Select a listing" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="l in listingOptions" :key="l.id" :value="l.id">
                  {{ l.name }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="space-y-2">
            <Label>Check-in</Label>
            <Input v-model="checkIn" type="date" />
          </div>
          <div class="space-y-2">
            <Label>Check-out</Label>
            <Input v-model="checkOut" type="date" />
          </div>
          <div class="space-y-2">
            <Label>Guests</Label>
            <Input v-model.number="guestCount" type="number" min="1" />
          </div>
          <div class="space-y-2">
            <Label>Total price</Label>
            <Input v-model.number="totalPrice" type="number" min="0" />
          </div>
        </div>

        <div class="rounded-md border bg-muted/40 p-3 text-sm">
          <div class="flex items-center justify-between">
            <span class="text-muted-foreground">Nights</span>
            <span class="font-medium">{{ computedNights }}</span>
          </div>
          <div class="flex items-center justify-between mt-1">
            <span class="text-muted-foreground">Channel</span>
            <span class="font-medium">Direct</span>
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="emit('update:open', false)">
          Cancel
        </Button>
        <Button @click="handleSubmit">
          Create Reservation
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
```

- [ ] **Step 2: Verify it parses**

Run: `pnpm exec vue-tsc --noEmit -p tsconfig.json`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add app/components/reservations/NewReservationDialog.vue
git commit -m "feat(reservations): add new reservation dialog"
```

---

## Task 7: Reservations list page

**Files:**
- Create: `app/pages/reservations/index.vue`
- Modify: `app/constants/menus.ts`

- [ ] **Step 1: Add sidebar menu item**

In `app/constants/menus.ts`, in the `General` group's `items` array (after "Cleaning Calendar", before "Operations Calendar"), add:

```ts
{
  title: 'Reservations',
  icon: 'i-lucide-calendar-check',
  link: '/reservations',
  new: true,
},
```

- [ ] **Step 2: Create the page**

```vue
<script setup lang="ts">
import type { DateRange } from 'reka-ui'
import type { ReservationEntry } from '~/components/reservations/data/reservations'
import { CalendarDate, DateFormatter, getLocalTimeZone } from '@internationalized/date'
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { useReservationsModule } from '~/composables/useReservationsModule'
import { reservationStatusLabels } from '~/components/reservations/data/reservations'
import { listings } from '~/components/listings/data/listings'
import ReservationTable from '~/components/reservations/ReservationTable.vue'
import ReservationDetailSheet from '~/components/reservations/ReservationDetailSheet.vue'
import NewReservationDialog from '~/components/reservations/NewReservationDialog.vue'

const router = useRouter()

const {
  filteredReservations,
  stats,
  filters,
} = useReservationsModule()

const df = new DateFormatter('en-US', { dateStyle: 'medium' })

const createOpen = ref(false)
const detailReservation = ref<ReservationEntry | null>(null)
const detailOpen = ref(false)

function openDetail(r: ReservationEntry) {
  detailReservation.value = r
  detailOpen.value = true
}

function openGuest(id: string) {
  router.push(`/reservations/guests/${id}`)
}

function copyId(id: string) {
  navigator.clipboard.writeText(id)
  toast.success('Booking ID copied')
}

const statusOptions = [
  { label: 'All', value: 'all' },
  ...Object.entries(reservationStatusLabels).map(([value, label]) => ({ label, value })),
]

// Listing filter (same pattern as Payment Requests)
const listingPopoverOpen = ref(false)
const listingSearch = ref('')
const selectedListingTags = ref<string[]>([])

const allListingTags = computed(() => {
  const tags = new Set<string>()
  for (const l of listings.value)
    l.tags.forEach(t => tags.add(t))
  return Array.from(tags).sort()
})

function toggleListingTag(tag: string) {
  if (selectedListingTags.value.includes(tag))
    selectedListingTags.value = selectedListingTags.value.filter(t => t !== tag)
  else
    selectedListingTags.value = [...selectedListingTags.value, tag]
}

function toggleListing(listingId: string) {
  if (filters.value.listings.includes(listingId))
    filters.value.listings = filters.value.listings.filter(id => id !== listingId)
  else
    filters.value.listings = [...filters.value.listings, listingId]
}

const filteredListingsForFilter = computed(() => {
  const query = listingSearch.value.trim().toLowerCase()
  return listings.value.filter((l) => {
    const haystack = `${l.name} ${l.location} ${l.tags.join(' ')}`.toLowerCase()
    if (query && !haystack.includes(query))
      return false
    if (selectedListingTags.value.length > 0 && !selectedListingTags.value.every(tag => l.tags.includes(tag)))
      return false
    return true
  })
})

const selectedListingNames = computed(() => {
  return filters.value.listings
    .map(id => listings.value.find(l => l.id === id)?.name)
    .filter(Boolean) as string[]
})

// Date range filter
const datePopoverOpen = ref(false)

function parseDateToCalendarDate(dateStr: string): CalendarDate | undefined {
  if (!dateStr)
    return undefined
  const [year, month, day] = dateStr.split('-').map(Number)
  return new CalendarDate(year, month, day)
}

function calendarDateToString(date: CalendarDate | undefined): string {
  if (!date)
    return ''
  const d = date.toDate(getLocalTimeZone())
  return d.toISOString().split('T')[0]
}

const dateRange = ref<DateRange>({
  start: parseDateToCalendarDate(filters.value.dateFrom),
  end: parseDateToCalendarDate(filters.value.dateTo),
})

watch(() => dateRange.value, (val) => {
  filters.value.dateFrom = calendarDateToString(val.start)
  filters.value.dateTo = calendarDateToString(val.end)
}, { deep: true })

watch(datePopoverOpen, (open) => {
  if (open) {
    dateRange.value = {
      start: parseDateToCalendarDate(filters.value.dateFrom),
      end: parseDateToCalendarDate(filters.value.dateTo),
    }
  }
})

function clearDateFilter() {
  filters.value.dateFrom = ''
  filters.value.dateTo = ''
  dateRange.value = { start: undefined, end: undefined }
}

function clearAllFilters() {
  filters.value.search = ''
  filters.value.status = 'all'
  filters.value.listings = []
  filters.value.dateFrom = ''
  filters.value.dateTo = ''
  selectedListingTags.value = []
  listingSearch.value = ''
}

const hasActiveFilters = computed(() =>
  filters.value.search
  || filters.value.status !== 'all'
  || filters.value.listings.length > 0
  || filters.value.dateFrom
  || filters.value.dateTo,
)

const dateFilterLabel = computed(() => {
  if (!filters.value.dateFrom && !filters.value.dateTo)
    return 'Date range'
  if (filters.value.dateFrom === filters.value.dateTo)
    return filters.value.dateFrom
  return `${filters.value.dateFrom} – ${filters.value.dateTo}`
})

// Stats cards (clickable to filter)
const statCards = computed(() => [
  { label: 'Upcoming', value: stats.value.upcoming, status: 'confirmed' as const, icon: 'lucide:calendar-clock' },
  { label: 'Current', value: stats.value.current, status: 'checked_in' as const, icon: 'lucide:calendar-check' },
  { label: 'Past', value: stats.value.past, status: 'checked_out' as const, icon: 'lucide:calendar-x' },
  { label: 'Cancelled', value: stats.value.cancelled, status: 'cancelled' as const, icon: 'lucide:calendar-off' },
])

function applyStatFilter(status: string) {
  filters.value.status = filters.value.status === status ? 'all' : status as any
}
</script>

<template>
  <div class="space-y-6 p-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">
          Reservations
        </h1>
        <p class="text-sm text-muted-foreground">
          {{ filteredReservations.length }} reservations
        </p>
      </div>
      <Button class="gap-2" @click="createOpen = true">
        <Icon name="lucide:plus" class="size-4" />
        New Reservation
      </Button>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <button
        v-for="card in statCards"
        :key="card.label"
        type="button"
        class="rounded-lg border bg-card text-left p-4 transition-colors hover:bg-muted/40"
        :class="filters.status === card.status ? 'border-primary' : ''"
        @click="applyStatFilter(card.status)"
      >
        <div class="flex items-center justify-between">
          <span class="text-xs text-muted-foreground uppercase tracking-wide">{{ card.label }}</span>
          <Icon :name="card.icon" class="size-4 text-muted-foreground" />
        </div>
        <div class="text-2xl font-bold mt-1">
          {{ card.value }}
        </div>
      </button>
    </div>

    <!-- Filter bar -->
    <div class="flex flex-wrap items-center gap-3">
      <div class="relative min-w-[200px] flex-1 max-w-xs">
        <Icon name="lucide:search" class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input v-model="filters.search" placeholder="Search guest, listing, or ID..." class="pl-9" />
      </div>

      <Select v-model="filters.status">
        <SelectTrigger class="w-[140px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="opt in statusOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </SelectItem>
        </SelectContent>
      </Select>

      <Popover v-model:open="listingPopoverOpen">
        <PopoverTrigger as-child>
          <Button
            variant="outline"
            class="h-9 gap-1.5 px-3"
            :class="filters.listings.length ? 'border-primary text-primary hover:bg-primary/10' : ''"
          >
            <Icon name="lucide:building-2" class="size-4" />
            Listings
            <Badge v-if="filters.listings.length" variant="default" class="ml-0.5 h-4 px-1 text-[10px]">
              {{ filters.listings.length }}
            </Badge>
          </Button>
        </PopoverTrigger>
        <PopoverContent class="w-[380px] p-0" align="start">
          <Command>
            <div class="flex w-full items-center">
              <div class="flex-1 min-w-0">
                <CommandInput v-model="listingSearch" placeholder="Search listing or location..." class="border-0 focus:ring-0" />
              </div>
              <div class="pr-2">
                <Popover>
                  <PopoverTrigger as-child>
                    <Button
                      variant="ghost"
                      size="sm"
                      class="h-7 gap-1 px-2 text-xs"
                      :class="selectedListingTags.length ? 'bg-primary/10 text-primary hover:bg-primary/20' : 'text-muted-foreground'"
                    >
                      <Icon name="lucide:tags" class="size-3.5" />
                      Tags
                      <Badge v-if="selectedListingTags.length" variant="default" class="ml-0.5 h-4 px-1 text-[10px]">
                        {{ selectedListingTags.length }}
                      </Badge>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent class="w-56 p-0" align="end">
                    <div class="space-y-2 p-2">
                      <Input v-model="listingSearch" placeholder="Search tags..." class="h-8 text-xs" />
                      <div class="max-h-40 space-y-1 overflow-auto">
                        <button
                          v-for="tag in allListingTags.filter(t => t.toLowerCase().includes(listingSearch.trim().toLowerCase()))"
                          :key="tag"
                          type="button"
                          class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                          @click="toggleListingTag(tag)"
                        >
                          <Checkbox :model-value="selectedListingTags.includes(tag)" class="size-3.5" />
                          <span>{{ tag }}</span>
                        </button>
                        <p v-if="!allListingTags.filter(t => t.toLowerCase().includes(listingSearch.trim().toLowerCase())).length" class="px-2 py-3 text-sm text-muted-foreground">
                          No tags found.
                        </p>
                      </div>
                      <Button v-if="selectedListingTags.length" variant="ghost" size="sm" class="h-7 w-full text-xs text-muted-foreground" @click="selectedListingTags = []">
                        Clear all
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <CommandList>
              <CommandEmpty>
                <div v-if="listingSearch.trim() || selectedListingTags.length" class="py-3 text-center">
                  <p class="text-sm text-muted-foreground">No listing found.</p>
                </div>
                <div v-else class="py-3 text-center text-sm text-muted-foreground">
                  Type to search...
                </div>
              </CommandEmpty>
              <CommandGroup>
                <CommandItem
                  v-for="listing in filteredListingsForFilter"
                  :key="listing.id"
                  :value="listing.name"
                  class="cursor-pointer"
                  @select.prevent="toggleListing(listing.id)"
                >
                  <div class="flex items-start gap-2 w-full">
                    <Checkbox :model-value="filters.listings.includes(listing.id)" class="mt-0.5 size-4" />
                    <div class="min-w-0 flex-1">
                      <p class="text-sm font-medium">{{ listing.name }}</p>
                      <p class="text-xs text-muted-foreground">{{ listing.location }}</p>
                      <div class="mt-1 flex flex-wrap gap-1">
                        <Badge v-for="tag in listing.tags" :key="tag" variant="outline" class="text-[10px]">
                          {{ tag }}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
          <div v-if="filters.listings.length" class="border-t p-2">
            <div class="flex items-center justify-between">
              <span class="text-xs text-muted-foreground">{{ filters.listings.length }} selected</span>
              <Button variant="ghost" size="sm" class="h-6 text-xs text-muted-foreground" @click="filters.listings = []">
                Clear all
              </Button>
            </div>
            <div class="mt-1.5 flex flex-wrap gap-1">
              <Badge v-for="name in selectedListingNames" :key="name" variant="secondary" class="text-[10px]">
                {{ name }}
              </Badge>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <Popover v-model:open="datePopoverOpen">
        <PopoverTrigger as-child>
          <Button
            variant="outline"
            class="h-9 gap-1.5 px-3"
            :class="filters.dateFrom ? 'border-primary text-primary hover:bg-primary/10' : ''"
          >
            <Icon name="lucide:calendar" class="size-4" />
            <span class="max-w-[160px] truncate">{{ dateFilterLabel }}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent class="w-auto p-0" align="start">
          <div class="p-3">
            <RangeCalendar
              v-model="dateRange"
              weekday-format="short"
              :number-of-months="2"
              initial-focus
              :placeholder="dateRange.start"
              @update:start-value="(startDate: any) => dateRange.start = startDate"
            />
            <div class="mt-3 flex items-center justify-between border-t pt-3">
              <p class="text-xs text-muted-foreground">
                <template v-if="dateRange.start && dateRange.end">
                  {{ df.format(dateRange.start.toDate(getLocalTimeZone())) }} – {{ df.format(dateRange.end.toDate(getLocalTimeZone())) }}
                </template>
                <template v-else>
                  Select a date range
                </template>
              </p>
              <Button v-if="filters.dateFrom || filters.dateTo" variant="ghost" size="sm" class="h-7 text-xs text-muted-foreground" @click="clearDateFilter">
                Clear
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <Button v-if="hasActiveFilters" variant="ghost" class="h-9 text-xs" @click="clearAllFilters">
        Clear all
      </Button>
    </div>

    <ReservationTable
      :reservations="filteredReservations"
      @open-guest="openGuest"
      @open-detail="openDetail"
      @copy-id="copyId"
    />

    <ReservationDetailSheet
      :reservation="detailReservation"
      :open="detailOpen"
      @update:open="detailOpen = $event"
      @open-guest="openGuest"
    />

    <NewReservationDialog
      v-model:open="createOpen"
    />
  </div>
</template>
```

- [ ] **Step 3: Verify it parses**

Run: `pnpm exec vue-tsc --noEmit -p tsconfig.json`
Expected: no new errors. (Known pre-existing type errors elsewhere are fine.)

- [ ] **Step 4: Commit**

```bash
git add app/pages/reservations/index.vue app/constants/menus.ts
git commit -m "feat(reservations): add reservations list page with filters and sidebar entry"
```

---

## Task 8: Guest profile components (part 1 — header, stats, reservations)

**Files:**
- Create: `app/components/reservations/GuestProfileHeader.vue`
- Create: `app/components/reservations/GuestStatsStrip.vue`
- Create: `app/components/reservations/GuestReservationsTable.vue`

- [ ] **Step 1: Create GuestProfileHeader.vue**

```vue
<script setup lang="ts">
import type { GuestProfile } from '~/components/reservations/data/reservations'

const props = defineProps<{ guest: GuestProfile }>()

const emit = defineEmits<{
  newReservation: []
}>()

function initials(name: string): string {
  return name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()
}

function fmtDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function callPhone(phone: string) {
  window.location.href = `tel:${phone.replace(/[^\d+]/g, '')}`
}
</script>

<template>
  <div class="flex items-start gap-4">
    <Avatar class="size-16">
      <AvatarFallback class="bg-primary/10 text-primary text-xl">
        {{ initials(guest.name) }}
      </AvatarFallback>
    </Avatar>
    <div class="flex-1 min-w-0 space-y-1.5">
      <h1 class="text-2xl font-bold tracking-tight truncate">
        {{ guest.name }}
      </h1>
      <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <a :href="`mailto:${guest.email}`" class="hover:underline truncate">
          {{ guest.email }}
        </a>
        <button type="button" class="hover:underline" @click="callPhone(guest.phone)">
          {{ guest.phone }}
        </button>
        <span>{{ guest.language }}</span>
        <span>Joined {{ fmtDate(guest.createdAt) }}</span>
      </div>
      <div class="flex flex-wrap items-center gap-2 pt-1">
        <Badge v-for="tag in guest.tags" :key="tag" variant="secondary">
          {{ tag }}
        </Badge>
        <Badge variant="outline">
          {{ guest.previousStays }} previous {{ guest.previousStays === 1 ? 'stay' : 'stays' }}
        </Badge>
      </div>
    </div>
    <div class="flex shrink-0 items-center gap-2">
      <Button variant="outline" size="sm" class="gap-1.5">
        <Icon name="lucide:message-circle" class="size-3.5" />
        Send WhatsApp
      </Button>
      <Button size="sm" class="gap-1.5" @click="emit('newReservation')">
        <Icon name="lucide:plus" class="size-3.5" />
        New Reservation
      </Button>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Create GuestStatsStrip.vue**

```vue
<script setup lang="ts">
interface Props {
  totalStays: number
  upcoming: number
  current: number
  totalSpent: number
  currency: string
}

const props = defineProps<Props>()

function fmtCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: props.currency, maximumFractionDigits: 0 }).format(amount)
}
</script>

<template>
  <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
    <Card>
      <CardContent class="p-4">
        <div class="text-xs text-muted-foreground uppercase tracking-wide">
          Total stays
        </div>
        <div class="text-2xl font-bold mt-1">
          {{ totalStays }}
        </div>
      </CardContent>
    </Card>
    <Card>
      <CardContent class="p-4">
        <div class="text-xs text-muted-foreground uppercase tracking-wide">
          Upcoming
        </div>
        <div class="text-2xl font-bold mt-1">
          {{ upcoming }}
        </div>
      </CardContent>
    </Card>
    <Card>
      <CardContent class="p-4">
        <div class="text-xs text-muted-foreground uppercase tracking-wide">
          Current
        </div>
        <div class="text-2xl font-bold mt-1">
          {{ current }}
        </div>
      </CardContent>
    </Card>
    <Card>
      <CardContent class="p-4">
        <div class="text-xs text-muted-foreground uppercase tracking-wide">
          Total spent
        </div>
        <div class="text-2xl font-bold mt-1">
          {{ fmtCurrency(totalSpent) }}
        </div>
      </CardContent>
    </Card>
  </div>
</template>
```

- [ ] **Step 3: Create GuestReservationsTable.vue**

```vue
<script setup lang="ts">
import type { ReservationEntry } from '~/components/reservations/data/reservations'

defineProps<{ reservations: ReservationEntry[] }>()

const df = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

function fmtDate(iso: string): string {
  return df.format(new Date(`${iso}T00:00:00Z`))
}

function fmtCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
}
</script>

<template>
  <Card>
    <CardContent class="p-0">
      <div class="rounded-md border overflow-hidden">
        <table class="w-full text-sm">
          <thead class="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th class="text-left font-medium px-4 py-3">Listing</th>
              <th class="text-left font-medium px-4 py-3">Check-in</th>
              <th class="text-left font-medium px-4 py-3">Check-out</th>
              <th class="text-left font-medium px-4 py-3">Nights</th>
              <th class="text-left font-medium px-4 py-3">Channel</th>
              <th class="text-right font-medium px-4 py-3">Total</th>
              <th class="text-left font-medium px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="r in reservations"
              :key="r.id"
              class="border-t hover:bg-muted/30 transition-colors"
            >
              <td class="px-4 py-3">
                <NuxtLink :to="`/listings/${r.listingId}`" class="text-primary hover:underline">
                  {{ r.listingName }}
                </NuxtLink>
              </td>
              <td class="px-4 py-3">
                {{ fmtDate(r.checkIn) }}
              </td>
              <td class="px-4 py-3">
                {{ fmtDate(r.checkOut) }}
              </td>
              <td class="px-4 py-3">
                {{ r.nights }}
              </td>
              <td class="px-4 py-3">
                {{ r.channel }}
              </td>
              <td class="px-4 py-3 text-right tabular-nums">
                {{ fmtCurrency(r.totalPrice, r.currency) }}
              </td>
              <td class="px-4 py-3">
                <ReservationStatusBadge :status="r.status" />
              </td>
            </tr>
            <tr v-if="reservations.length === 0">
              <td colspan="7" class="px-4 py-12 text-center text-sm text-muted-foreground">
                <div class="flex flex-col items-center gap-2">
                  <Icon name="lucide:calendar-x" class="size-8 opacity-50" />
                  No reservations yet.
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </CardContent>
  </Card>
</template>
```

- [ ] **Step 4: Verify components parse**

Run: `pnpm exec vue-tsc --noEmit -p tsconfig.json`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add app/components/reservations/GuestProfileHeader.vue app/components/reservations/GuestStatsStrip.vue app/components/reservations/GuestReservationsTable.vue
git commit -m "feat(reservations): add guest header, stats, and reservations table components"
```

---

## Task 9: Guest profile components (part 2 — history, activity, payments, upsells, notes)

**Files:**
- Create: `app/components/reservations/GuestBookingHistory.vue`
- Create: `app/components/reservations/GuestActivityTimeline.vue`
- Create: `app/components/reservations/GuestPaymentRequests.vue`
- Create: `app/components/reservations/GuestUpsells.vue`
- Create: `app/components/reservations/GuestNotes.vue`

- [ ] **Step 1: Create GuestBookingHistory.vue**

```vue
<script setup lang="ts">
import type { GuestBookingHistoryItem } from '~/components/reservations/data/reservations'

defineProps<{ bookings: GuestBookingHistoryItem[] }>()

const df = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

function fmtDate(iso: string): string {
  return df.format(new Date(`${iso}T00:00:00Z`))
}

function fmtCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="text-base">
        Booking history
      </CardTitle>
    </CardHeader>
    <CardContent class="p-0">
      <div class="rounded-md border overflow-hidden">
        <table class="w-full text-sm">
          <thead class="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th class="text-left font-medium px-4 py-3">Stay</th>
              <th class="text-left font-medium px-4 py-3">Listing</th>
              <th class="text-right font-medium px-4 py-3">Total</th>
              <th class="text-left font-medium px-4 py-3">Ratings</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="b in bookings"
              :key="b.id"
              class="border-t hover:bg-muted/30 transition-colors"
            >
              <td class="px-4 py-3">
                <span class="font-medium">{{ fmtDate(b.checkIn) }}</span>
                <span class="text-muted-foreground"> · {{ b.nights }} nights</span>
              </td>
              <td class="px-4 py-3">
                {{ b.listingName }}
              </td>
              <td class="px-4 py-3 text-right tabular-nums">
                {{ fmtCurrency(b.totalPrice, b.currency) }}
              </td>
              <td class="px-4 py-3">
                <div v-if="b.hostReviewOfGuest || b.guestReviewOfProperty" class="flex items-center gap-3 text-xs text-muted-foreground">
                  <span v-if="b.hostReviewOfGuest" title="Host review of guest">
                    <Icon name="lucide:star" class="mr-1 inline size-3 text-amber-500" />
                    {{ b.hostReviewOfGuest.rating }}
                  </span>
                  <span v-if="b.guestReviewOfProperty" title="Guest review of property">
                    <Icon name="lucide:star" class="mr-1 inline size-3 text-amber-500" />
                    {{ b.guestReviewOfProperty.rating }}
                  </span>
                </div>
                <span v-else class="text-xs text-muted-foreground">—</span>
              </td>
            </tr>
            <tr v-if="bookings.length === 0">
              <td colspan="4" class="px-4 py-12 text-center text-sm text-muted-foreground">
                <div class="flex flex-col items-center gap-2">
                  <Icon name="lucide:history" class="size-8 opacity-50" />
                  No previous stays recorded.
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </CardContent>
  </Card>
</template>
```

- [ ] **Step 2: Create GuestActivityTimeline.vue**

```vue
<script setup lang="ts">
import type { ActivityEvent } from '~/components/inbox/data/conversations'

defineProps<{ events: ActivityEvent[] }>()

const df = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

function fmtTimestamp(iso: string): string {
  return df.format(new Date(iso))
}

const typeMeta: Record<ActivityEvent['type'], { icon: string, tone: string }> = {
  message: { icon: 'lucide:message-square', tone: 'bg-blue-500/10 text-blue-700' },
  reply: { icon: 'lucide:reply', tone: 'bg-green-500/10 text-green-700' },
  reservation: { icon: 'lucide:calendar-check', tone: 'bg-primary/10 text-primary' },
  guide_sent: { icon: 'lucide:book-open', tone: 'bg-amber-500/10 text-amber-700' },
  cleaning: { icon: 'lucide:sparkles', tone: 'bg-purple-500/10 text-purple-700' },
  task: { icon: 'lucide:check-square', tone: 'bg-slate-500/10 text-slate-700' },
  system: { icon: 'lucide:cpu', tone: 'bg-muted text-muted-foreground' },
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="text-base">
        Activity
      </CardTitle>
    </CardHeader>
    <CardContent class="p-0">
      <div v-if="events.length === 0" class="flex flex-col items-center gap-2 py-12 text-sm text-muted-foreground">
        <Icon name="lucide:activity" class="size-8 opacity-50" />
        No activity recorded yet.
      </div>
      <ol v-else class="divide-y">
        <li
          v-for="e in events"
          :key="e.id"
          class="flex items-start gap-3 px-4 py-3"
        >
          <div :class="['flex size-9 items-center justify-center rounded-full shrink-0', typeMeta[e.type].tone]">
            <Icon :name="typeMeta[e.type].icon" class="size-4" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-baseline justify-between gap-2">
              <div class="text-sm font-medium truncate">
                {{ e.title }}
              </div>
              <div class="text-xs text-muted-foreground whitespace-nowrap">
                {{ fmtTimestamp(e.timestamp) }}
              </div>
            </div>
            <div v-if="e.description" class="text-xs text-muted-foreground mt-0.5">
              {{ e.description }}
            </div>
            <div class="text-xs text-muted-foreground mt-0.5">
              {{ e.actor }}
            </div>
          </div>
        </li>
      </ol>
    </CardContent>
  </Card>
</template>
```

- [ ] **Step 3: Create GuestPaymentRequests.vue**

```vue
<script setup lang="ts">
import type { PaymentRequest } from '~/components/payment-request/data/payment-requests'

defineProps<{ requests: PaymentRequest[] }>()

const df = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

function fmtDate(iso: string): string {
  return df.format(new Date(iso))
}

function fmtCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="text-base">
        Payment requests
      </CardTitle>
    </CardHeader>
    <CardContent class="p-0">
      <div v-if="requests.length === 0" class="flex flex-col items-center gap-2 py-12 text-sm text-muted-foreground">
        <Icon name="lucide:link" class="size-8 opacity-50" />
        No payment requests.
      </div>
      <div v-else class="divide-y">
        <div
          v-for="r in requests"
          :key="r.id"
          class="flex items-center justify-between gap-3 px-4 py-3"
        >
          <div class="min-w-0">
            <p class="text-sm font-medium truncate">
              {{ r.title }}
            </p>
            <p class="text-xs text-muted-foreground">
              {{ fmtDate(r.createdAt) }} · {{ r.status }}
            </p>
          </div>
          <div class="text-sm font-semibold tabular-nums">
            {{ fmtCurrency(r.totalAmount, r.currency) }}
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
```

- [ ] **Step 4: Create GuestUpsells.vue**

```vue
<script setup lang="ts">
import type { UpsellItem } from '~/components/inbox/data/conversations'

defineProps<{ items: UpsellItem[] }>()

function fmtCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
}

const statusMeta: Record<UpsellItem['status'], { label: string, tone: string }> = {
  confirmed: { label: 'Confirmed', tone: 'bg-green-500/10 text-green-700 border-green-500/30' },
  pending: { label: 'Pending', tone: 'bg-amber-500/10 text-amber-700 border-amber-500/30' },
  cancelled: { label: 'Cancelled', tone: 'bg-muted text-muted-foreground border-border' },
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="text-base">
        Upsells
      </CardTitle>
    </CardHeader>
    <CardContent class="p-0">
      <div v-if="items.length === 0" class="flex flex-col items-center gap-2 py-12 text-sm text-muted-foreground">
        <Icon name="lucide:tag" class="size-8 opacity-50" />
        No upsells.
      </div>
      <div v-else class="divide-y">
        <div
          v-for="item in items"
          :key="item.id"
          class="flex items-center justify-between gap-3 px-4 py-3"
        >
          <div class="min-w-0">
            <p class="text-sm font-medium truncate">
              {{ item.name }}
            </p>
            <p class="text-xs text-muted-foreground">
              Purchased {{ new Date(item.purchasedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }}
            </p>
          </div>
          <div class="flex items-center gap-2">
            <Badge variant="outline" :class="statusMeta[item.status].tone">
              {{ statusMeta[item.status].label }}
            </Badge>
            <span class="text-sm font-semibold tabular-nums">
              {{ fmtCurrency(item.price, item.currency) }}
            </span>
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
```

- [ ] **Step 5: Create GuestNotes.vue**

```vue
<script setup lang="ts">
import { toast } from 'vue-sonner'

const props = defineProps<{ notes: string }>()
const emit = defineEmits<{ save: [notes: string] }>()

const draft = ref(props.notes)
watch(() => props.notes, (val) => { draft.value = val })

function save() {
  emit('save', draft.value)
  toast.success('Notes saved')
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="text-base">
        Notes
      </CardTitle>
    </CardHeader>
    <CardContent>
      <Textarea v-model="draft" placeholder="Add notes about this guest..." class="min-h-[100px]" />
      <div class="mt-2 flex justify-end">
        <Button variant="outline" size="sm" @click="save">
          Save notes
        </Button>
      </div>
    </CardContent>
  </Card>
</template>
```

- [ ] **Step 6: Verify components parse**

Run: `pnpm exec vue-tsc --noEmit -p tsconfig.json`
Expected: no new errors.

- [ ] **Step 7: Commit**

```bash
git add app/components/reservations/GuestBookingHistory.vue app/components/reservations/GuestActivityTimeline.vue app/components/reservations/GuestPaymentRequests.vue app/components/reservations/GuestUpsells.vue app/components/reservations/GuestNotes.vue
git commit -m "feat(reservations): add guest history, activity, payments, upsells, and notes components"
```

---

## Task 10: Guest profile page

**Files:**
- Create: `app/pages/reservations/guests/[id].vue`

- [ ] **Step 1: Create the page**

```vue
<script setup lang="ts">
import type { ReservationEntry } from '~/components/reservations/data/reservations'
import { computed, ref } from 'vue'
import { useReservationsModule } from '~/composables/useReservationsModule'
import { usePaymentRequests } from '~/composables/usePaymentRequests'
import { useInbox } from '~/composables/useInbox'
import { useGuestGuideLinks } from '~/composables/useGuestGuideLinks'
import GuestProfileHeader from '~/components/reservations/GuestProfileHeader.vue'
import GuestStatsStrip from '~/components/reservations/GuestStatsStrip.vue'
import GuestReservationsTable from '~/components/reservations/GuestReservationsTable.vue'
import GuestBookingHistory from '~/components/reservations/GuestBookingHistory.vue'
import GuestActivityTimeline from '~/components/reservations/GuestActivityTimeline.vue'
import GuestPaymentRequests from '~/components/reservations/GuestPaymentRequests.vue'
import GuestUpsells from '~/components/reservations/GuestUpsells.vue'
import GuestNotes from '~/components/reservations/GuestNotes.vue'
import NewReservationDialog from '~/components/reservations/NewReservationDialog.vue'

const route = useRoute()
const router = useRouter()

const {
  getGuestById,
  getReservationsForGuest,
  updateGuestNotes,
} = useReservationsModule()
const { requests } = usePaymentRequests()
const { conversations } = useInbox()
const { links } = useGuestGuideLinks()

const guestId = computed(() => String(route.params.id))
const guest = computed(() => getGuestById(guestId.value))

const stays = computed<ReservationEntry[]>(() => guest.value ? getReservationsForGuest(guest.value.id) : [])

const today = new Date().toISOString().split('T')[0]
const upcomingCount = computed(() => stays.value.filter(r => r.checkIn > today && r.status !== 'cancelled').length)
const currentCount = computed(() => stays.value.filter(r => r.checkIn <= today && r.checkOut >= today && r.status !== 'cancelled').length)
const totalSpent = computed(() => stays.value
  .filter(r => r.status !== 'cancelled')
  .reduce((sum, r) => sum + r.totalPrice, 0))
const spentCurrency = computed(() => stays.value.find(r => r.status !== 'cancelled')?.currency ?? 'USD')

// Booking history — from previous-stays data + past stays
const bookingHistory = computed(() => {
  if (!guest.value)
    return []
  return stays.value
    .filter(r => r.status === 'checked_out')
    .map(r => ({
      id: r.id,
      checkIn: r.checkIn,
      nights: r.nights,
      listingName: r.listingName,
      totalPrice: r.totalPrice,
      currency: r.currency,
    }))
})

// Activity — merged from stays
const activity = computed(() => stays.value.flatMap(r => r.activity).sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1)))

// Payment requests — matched by email or explicit link
const guestPaymentRequests = computed(() => {
  if (!guest.value)
    return []
  const email = guest.value.email.toLowerCase()
  return requests.value.filter(r => r.guestEmail.toLowerCase() === email || stays.value.some(s => s.paymentRequestId === r.id))
})

// Upsells — merged from stays
const upsells = computed(() => stays.value.flatMap(r => r.upsellIds ?? []))

// Related links
const relatedConversation = computed(() => {
  if (!guest.value)
    return null
  const convId = stays.value.find(r => r.conversationId)?.conversationId
  return convId ? conversations.value.find(c => c.id === convId) ?? null : null
})

const relatedGuide = computed(() => {
  if (!guest.value)
    return null
  const guideId = stays.value.find(r => r.guestGuideId)?.guestGuideId
  return guideId ? links.value.find(l => l.id === guideId) ?? null : null
})

function openConversation() {
  if (relatedConversation.value)
    router.push(`/inbox?conversation=${relatedConversation.value.id}`)
}

function saveNotes(notes: string) {
  updateGuestNotes(guestId.value, notes)
}

const newReservationOpen = ref(false)
</script>

<template>
  <ClientOnly>
    <div v-if="!guest" class="flex flex-col items-center justify-center gap-4 py-24">
      <Icon name="lucide:user-x" class="size-12 text-muted-foreground" />
      <h2 class="text-lg font-semibold">
        Guest not found
      </h2>
      <p class="text-sm text-muted-foreground">
        The guest you’re looking for doesn’t exist or has been removed.
      </p>
      <Button variant="outline" size="sm" @click="router.push('/reservations')">
        <Icon name="lucide:arrow-left" class="mr-2 size-4" />
        Back to Reservations
      </Button>
    </div>

    <div v-else class="space-y-6 p-6">
      <div class="flex items-center justify-between gap-4">
        <Button variant="ghost" size="sm" @click="router.push('/reservations')">
          <Icon name="lucide:arrow-left" class="mr-2 size-4" />
          Back to Reservations
        </Button>
      </div>

      <GuestProfileHeader :guest="guest" @new-reservation="newReservationOpen = true" />

      <GuestStatsStrip
        :total-stays="stays.length"
        :upcoming="upcomingCount"
        :current="currentCount"
        :total-spent="totalSpent"
        :currency="spentCurrency"
      />

      <!-- Related links -->
      <div v-if="relatedConversation || relatedGuide" class="flex flex-wrap gap-2">
        <Button
          v-if="relatedConversation"
          variant="outline"
          size="sm"
          class="gap-1.5"
          @click="openConversation"
        >
          <Icon name="lucide:message-circle" class="size-3.5" />
          Open conversation
        </Button>
        <Button
          v-if="relatedGuide"
          variant="outline"
          size="sm"
          class="gap-1.5"
          @click="router.push(`/guest-guides/${relatedGuide.id}`)"
        >
          <Icon name="lucide:book-open" class="size-3.5" />
          Guest guide
        </Button>
      </div>

      <!-- Reservations -->
      <section class="space-y-2">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Reservations
        </h2>
        <GuestReservationsTable :reservations="stays" />
      </section>

      <!-- Booking history -->
      <section class="space-y-2">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Booking history
        </h2>
        <GuestBookingHistory :bookings="bookingHistory" />
      </section>

      <!-- Activity -->
      <section class="space-y-2">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Activity
        </h2>
        <GuestActivityTimeline :events="activity" />
      </section>

      <!-- Payment requests -->
      <section class="space-y-2">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Payment requests
        </h2>
        <GuestPaymentRequests :requests="guestPaymentRequests" />
      </section>

      <!-- Upsells -->
      <section class="space-y-2">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Upsells
        </h2>
        <GuestUpsells :items="upsells" />
      </section>

      <!-- Notes -->
      <section class="space-y-2">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Notes
        </h2>
        <GuestNotes :notes="guest.notes" @save="saveNotes" />
      </section>
    </div>

    <NewReservationDialog
      v-if="guest"
      v-model:open="newReservationOpen"
    />

    <template #fallback>
      <div class="space-y-6 p-6">
        <Skeleton class="h-9 w-32" />
        <div class="flex items-start gap-4">
          <Skeleton class="size-16 rounded-full" />
          <div class="flex-1 space-y-2">
            <Skeleton class="h-7 w-48" />
            <Skeleton class="h-4 w-64" />
            <Skeleton class="h-5 w-32" />
          </div>
        </div>
        <Skeleton class="h-24 w-full" />
        <Skeleton class="h-64 w-full" />
      </div>
    </template>
  </ClientOnly>
</template>
```

- [ ] **Step 2: Verify the page parses**

Run: `pnpm exec vue-tsc --noEmit -p tsconfig.json`
Expected: no new errors for `guests/[id].vue`. If `useGuestGuideLinks` doesn't expose `links`, check its actual export name in `app/composables/useGuestGuideLinks.ts` and adjust the import — the related-guide card is optional.

- [ ] **Step 3: Commit**

```bash
git add app/pages/reservations/guests/[id].vue
git commit -m "feat(reservations): add guest profile page"
```

---

## Task 11: Final verification

**Files:**
- None (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `pnpm vitest run`
Expected: all tests pass, including the new `useReservations.spec.ts`.

- [ ] **Step 2: Run lint**

Run: `pnpm lint`
Expected: no new lint errors (pre-existing warnings acceptable).

- [ ] **Step 3: Type-check**

Run: `pnpm exec vue-tsc --noEmit -p tsconfig.json`
Expected: no new type errors (known pre-existing errors acceptable).

- [ ] **Step 4: Manual smoke test in dev**

Run: `pnpm dev` (keep running in background per repo convention), then:
1. Open `http://localhost:3000/reservations` — table renders, stats show counts
2. Search "sarah" — filters to Sarah's row
3. Click the guest name → `/reservations/guests/guest-1` — header, stats, sections render
4. Click "New Reservation" → create a reservation → appears in table
5. Click a row → detail sheet opens
6. Click "Reservations" in sidebar → navigates

Stop the dev server when done.

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "chore(reservations): final verification fixes"
```

---

## Self-Review Notes

- **Spec coverage:** data model (Task 1), composable/filters/stats (Task 2), list page with stats/filters/table/detail-sheet/create (Tasks 4–7), guest profile header/stats/sections/links/not-found (Tasks 8–10), sidebar entry (Task 7), tests (Task 2, Task 11).
- **Cross-links:** guest name → profile, listing → `/listings/[id]`, open-conversation → `/inbox?conversation=`, guest guide → `/guest-guides/[id]`. Inbox side linking back is explicitly out of scope per spec.
- **Type consistency:** `ReservationEntry`, `GuestProfile`, `GuestBookingHistoryItem`, `ReservationDraft` all defined once in Task 1 and reused; composable returns `stats { upcoming, current, past, cancelled }`, `getGuestById`, `getReservationsForGuest`, `createReservation`, `updateGuestNotes`, `reset` — all used consistently in later tasks.
