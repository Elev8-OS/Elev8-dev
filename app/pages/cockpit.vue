<script setup lang="ts">
// Cockpit: every listing on one timeline (`docs/claude/cockpit.md`).
//
// A header row per listing with the share still free each night, then a row
// per unit (the listing, or each room) with its stays. The stays are the
// Reservations page's (`useReservationsModule`), so a bar opens that
// reservation's detail sheet. Owner stay requests
// (PRD 5.4.2) are approved from the Owner requests sheet; once requested they
// are Reservations-module stays, so they show on the board as owner stays.

import type { DateRange } from 'reka-ui'
import type { AvailabilityQuery, CockpitCreateRequest, CockpitRange, CockpitStayFilters, TodayKey } from '~/components/cockpit/data/cockpit'
import type { Booking } from '~/components/listings/data/listings'
import type { ReservationEntry } from '~/components/reservations/data/reservations'
import { parseDate } from '@internationalized/date'
import { toast } from 'vue-sonner'
import BaseDateRangePicker from '~/components/base/DateRangePicker.vue'
import CockpitCreateDialog from '~/components/cockpit/CockpitCreateDialog.vue'
import CockpitFindAvailability from '~/components/cockpit/CockpitFindAvailability.vue'
import CockpitTimeline from '~/components/cockpit/CockpitTimeline.vue'
import CockpitTodayStrip from '~/components/cockpit/CockpitTodayStrip.vue'
import { addIsoMonths, availableRowIds, buildCockpitGroups, COCKPIT_RANGES, cockpitDays, conflictIds, DEFAULT_STAY_FILTERS, filterGroups, groupsWithAction, hasStaysIn, listingCurrency, MAX_CUSTOM_DAYS, rangeLength, rowIdFor, todaySummary } from '~/components/cockpit/data/cockpit'
import { loadCockpitPrefs, saveCockpitPrefs } from '~/components/cockpit/data/cockpit-prefs'
import { addIsoDays, isoDiffDays } from '~/components/gm/data/gm-dashboard'
import { listings } from '~/components/listings/data/listings'
import { formatLocalDateKey } from '~/components/operations-calendar/data/operations-calendar'
import OwnerStayApprovalsPanel from '~/components/owners/OwnerStayApprovalsPanel.vue'
import NewReservationDialog from '~/components/reservations/NewReservationDialog.vue'
import ReservationDetailSheet from '~/components/reservations/ReservationDetailSheet.vue'
import { isTaskCompleted } from '~/components/tasks/data/schema'
import { Button } from '~/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '~/components/ui/sheet'
import { useInbox } from '~/composables/useInbox'
import { useOwnerStayApprovals } from '~/composables/useOwnerStayApprovals'
import { useReservationsModule } from '~/composables/useReservationsModule'
import { useTaskStore } from '~/composables/useTaskStore'

definePageMeta({ layout: 'default' })

const { pendingRequests } = useOwnerStayApprovals()
const { reservations, assignRoom, unassignRoom, createReservation } = useReservationsModule()
const { tasks } = useTaskStore()
const inbox = useInbox()
const { conversations } = inbox

/** Reservations whose Inbox conversation is marked Action needed; their bars carry a marker. */
const actionNeeded = computed(() => new Set(conversations.value
  .filter(c => c.status === 'action_needed' && c.reservationId)
  .map(c => c.reservationId)))

// Resolved once, so the server and the client agree on "today".
const todayKey = useState('cockpit-today', () => formatLocalDateKey(new Date()))

const startKey = ref(todayKey.value)
const range = ref<CockpitRange>('28')
const customDays = ref(28)
const rangeDays = computed(() => rangeLength(range.value, startKey.value, customDays.value))

const days = computed(() => cockpitDays(startKey.value, rangeDays.value, todayKey.value))

/** Custom: the picker shows the period on the board; picking a range moves the board to it. */
const customRange = computed<DateRange>({
  get: () => ({ start: parseDate(startKey.value), end: parseDate(addIsoDays(startKey.value, rangeDays.value - 1)) }),
  set: (value) => {
    if (!value.start || !value.end)
      return
    startKey.value = value.start.toString()
    customDays.value = Math.min(MAX_CUSTOM_DAYS, isoDiffDays(value.start.toString(), value.end.toString()) + 1)
  },
})

/** Switching to Custom starts from the period on screen. */
watch(range, (next, previous) => {
  if (next === 'custom' && previous !== 'custom')
    customDays.value = rangeLength(previous, startKey.value, customDays.value)
})

/** "8 Oct to 4 Nov 2026" */
const periodLabel = computed(() => {
  const first = days.value[0]
  const last = days.value[days.value.length - 1]
  if (!first || !last)
    return ''
  const fmt = (key: string, year: boolean) => {
    const [y, m, d] = key.split('-').map(Number)
    return new Date(y!, m! - 1, d!).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(year ? { year: 'numeric' } : {}) })
  }
  return `${fmt(first.key, first.key.slice(0, 4) !== last.key.slice(0, 4))} to ${fmt(last.key, true)}`
})

/** A month steps by calendar month; every other period by its own length. */
function shift(direction: -1 | 1) {
  startKey.value = range.value === 'month'
    ? addIsoMonths(startKey.value, direction)
    : addIsoDays(startKey.value, direction * rangeDays.value)
}

/** The big title: the month shown, or both months when the period crosses one ("October to November 2026"). */
const periodTitle = computed(() => {
  const first = days.value[0]
  const last = days.value[days.value.length - 1]
  if (!first || !last)
    return ''
  if (first.month === last.month)
    return first.month
  const [m1, y1] = first.month.split(' ')
  const [m2, y2] = last.month.split(' ')
  return y1 === y2 ? `${m1} to ${m2} ${y2}` : `${first.month} to ${last.month}`
})

function goToToday() {
  startKey.value = todayKey.value
}

const search = ref('')
const tags = ref<string[]>([])
const filters = ref<CockpitStayFilters>({ ...DEFAULT_STAY_FILTERS })
const collapsed = ref<string[]>([])

// Remembered per browser (`cockpit-prefs.ts`). Read after mount, so the server
// render and the first client render agree; saved on every change after that.
const prefsReady = ref(false)
onMounted(() => {
  const prefs = loadCockpitPrefs()
  range.value = prefs.range
  customDays.value = prefs.customDays
  tags.value = prefs.tags
  filters.value = prefs.filters
  collapsed.value = prefs.collapsed
  prefsReady.value = true
})
watch([range, customDays, tags, filters, collapsed], () => {
  if (prefsReady.value)
    saveCockpitPrefs({ range: range.value, customDays: customDays.value, tags: tags.value, filters: filters.value, collapsed: collapsed.value })
}, { deep: true })

const groups = computed(() => buildCockpitGroups(listings.value, reservations.value))

/* Today's work, double bookings, and the strip's focus. */
const conflicts = computed(() => conflictIds(groups.value))
const today = computed(() => todaySummary(groups.value, todayKey.value, actionNeeded.value))
const todayCounts = computed(() => Object.fromEntries(Object.entries(today.value).map(([k, ids]) => [k, ids.size])) as Record<TodayKey, number>)
const focus = ref<TodayKey | null>(null)
const focusIds = computed(() => focus.value ? today.value[focus.value] : null)

/** Focusing today's work brings today on screen. */
watch(focus, (key) => {
  if (key && !days.value.some(d => d.isToday))
    goToToday()
})

const availability = ref<AvailabilityQuery | null>(null)
const matchingRows = computed(() => availability.value ? availableRowIds(groups.value, availability.value) : null)
const highlightNights = computed(() => {
  const nights = new Set<string>()
  if (!availability.value)
    return nights
  for (let key = availability.value.checkIn; key < availability.value.checkOut; key = addIsoDays(key, 1))
    nights.add(key)
  return nights
})

const firstKey = computed(() => days.value[0]?.key ?? todayKey.value)
const lastKey = computed(() => days.value[days.value.length - 1]?.key ?? todayKey.value)

const visibleGroups = computed(() => {
  let filtered = filterGroups(groups.value, search.value, tags.value)
  if (filters.value.actionOnly)
    filtered = groupsWithAction(filtered, actionNeeded.value, firstKey.value, lastKey.value)
  const matches = matchingRows.value
  return matches ? filtered.filter(g => g.rows.some(r => matches.has(r.id))) : filtered
})

/** No reservation at all touches the period: say so, rather than show an empty board. */
const emptyPeriod = computed(() => !hasStaysIn(groups.value, firstKey.value, lastKey.value))

/** Open tasks per unit row: a single-unit listing's row, or the room a task names. */
const openTasks = computed(() => {
  const byName = new Map(listings.value.map(l => [l.name, l]))
  const counts = new Map<string, number>()
  for (const task of tasks.value) {
    const listing = task.listing ? byName.get(task.listing) : undefined
    if (!listing || isTaskCompleted(task))
      continue
    const id = listing.unitType === 'multi' ? (task.unitId ? rowIdFor(listing.id, task.unitId) : null) : listing.id
    if (id)
      counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  return counts
})

const findOpen = ref(false)

function applyAvailability(query: AvailabilityQuery) {
  availability.value = query
  startKey.value = addIsoDays(query.checkIn, -1)
}

function formatShort(key: string) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y!, m! - 1, d!).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

const availabilitySummary = computed(() => {
  const q = availability.value
  if (!q)
    return ''
  const count = matchingRows.value?.size ?? 0
  return `${formatShort(q.checkIn)} to ${formatShort(q.checkOut)}, ${q.guests} ${q.guests === 1 ? 'guest' : 'guests'}: ${count} ${count === 1 ? 'unit' : 'units'} free`
})

const approvalsOpen = ref(false)

// Every bar is a reservation (it keeps the reservation's id). Read it live, so
// an edit made in the sheet shows on the sheet and the board at once.
const detailId = ref<string | null>(null)
const detailOpen = ref(false)
const detailReservation = computed(() => reservations.value.find(r => r.id === detailId.value) ?? null)

function openStay(booking: Booking) {
  detailId.value = booking.id
  detailOpen.value = true
}

/** The Action needed marker: straight to the guest's conversation, as the sheet's Inbox button does. */
function openInbox(booking: Booking) {
  const reservation = reservations.value.find(r => r.id === booking.id)
  const opened = reservation ? inbox.openForReservation(reservation) : null
  if (!opened) {
    toast.error('This guest has no conversation and no email address yet.')
    return
  }
  navigateTo('/inbox')
}

/** A stay dropped on a room, or back on "Not assigned to a room". Placement only: the price is untouched. */
function assignStay(bookingId: string, unitId: string | null) {
  const reservation = reservations.value.find(r => r.id === bookingId)
  const guest = reservation?.guestName ?? 'Guest'
  if (!unitId) {
    unassignRoom(bookingId)
    toast.success(`${guest} has no room for now`)
    return
  }
  const result = assignRoom(bookingId, unitId)
  if (!result.success) {
    toast.error(result.error ?? 'Could not put the stay in that room.')
    return
  }
  const room = listings.value.flatMap(l => l.unitTypes ?? []).flatMap(t => t.units).find(u => u.id === unitId)?.name ?? 'the room'
  toast.success(`${guest} is in ${room}`)
}

/* Click or drag across free nights: book a guest there, or block the nights. */
const createRequest = ref<CockpitCreateRequest | null>(null)
const createOpen = ref(false)
const newReservationOpen = ref(false)
const newReservationPrefill = ref<{ listingId: string, checkIn: string, checkOut: string } | null>(null)

function requestCreate(request: CockpitCreateRequest) {
  if (!request.free) {
    toast.error(`${request.rowName} is not free on all of those nights.`)
    return
  }
  createRequest.value = request
  createOpen.value = true
}

function reserve(request: CockpitCreateRequest) {
  newReservationPrefill.value = { listingId: request.listing.id, checkIn: request.checkIn, checkOut: request.checkOut }
  newReservationOpen.value = true
}

/** A new reservation made from a room row goes into that room. */
function onReservationCreated(reservation: ReservationEntry) {
  const unitId = createRequest.value?.unitId
  if (unitId && createRequest.value?.listing.id === reservation.listingId)
    assignRoom(reservation.id, unitId)
  createRequest.value = null
}

function block(request: CockpitCreateRequest, reason: string) {
  const nights = isoDiffDays(request.checkIn, request.checkOut)
  const result = createReservation({
    guestName: '—',
    guestEmail: '',
    guestPhone: '',
    guestLanguage: 'en',
    // A block's reason is read back from its notes (`reservationToBooking`).
    guestNotes: reason,
    listingId: request.listing.id,
    listingName: request.listing.name,
    channel: 'Direct',
    checkIn: request.checkIn,
    checkOut: request.checkOut,
    nights,
    guestCount: 0,
    totalPrice: 0,
    currency: listingCurrency(request.listing),
    status: 'blocked',
  })
  if (!result.success || !result.id) {
    toast.error('Could not block those nights.')
    return
  }
  if (request.unitId)
    assignRoom(result.id, request.unitId)
  toast.success(`${request.rowName} blocked for ${nights} ${nights === 1 ? 'night' : 'nights'}`)
}
</script>

<template>
  <div class="flex w-full flex-col gap-4">
    <!-- Title left, « ‹ Today › » centred, period and Find availability right. Stacks on a phone. -->
    <div class="grid grid-cols-1 items-center gap-3 lg:grid-cols-[1fr_auto_1fr]">
      <div class="flex flex-col">
        <h1 class="text-2xl font-bold tracking-tight" aria-live="polite">
          <span class="sr-only">Cockpit, </span>{{ periodTitle }}
        </h1>
        <span class="text-xs text-muted-foreground tabular-nums" data-testid="cockpit-period">{{ periodLabel }}</span>
      </div>

      <div class="flex items-center gap-1 lg:justify-center" data-testid="cockpit-nav">
        <Button variant="ghost" size="icon" aria-label="Back one month" title="Back one month" @click="startKey = addIsoMonths(startKey, -1)">
          <Icon name="lucide:chevrons-left" class="size-4" />
        </Button>
        <Button variant="ghost" size="icon" aria-label="Previous period" title="Previous period" @click="shift(-1)">
          <Icon name="lucide:chevron-left" class="size-4" />
        </Button>
        <Button variant="outline" class="rounded-full px-5" @click="goToToday">
          Today
        </Button>
        <Button variant="ghost" size="icon" aria-label="Next period" title="Next period" @click="shift(1)">
          <Icon name="lucide:chevron-right" class="size-4" />
        </Button>
        <Button variant="ghost" size="icon" aria-label="Forward one month" title="Forward one month" @click="startKey = addIsoMonths(startKey, 1)">
          <Icon name="lucide:chevrons-right" class="size-4" />
        </Button>
      </div>

      <div class="flex flex-wrap items-center gap-2 lg:justify-end">
        <Select v-model="range">
          <SelectTrigger class="w-40" aria-label="Period shown">
            <Icon name="lucide:calendar-days" class="size-4 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="r in COCKPIT_RANGES" :key="r.value" :value="r.value">
              {{ r.label }}
            </SelectItem>
          </SelectContent>
        </Select>
        <BaseDateRangePicker
          v-if="range === 'custom'"
          v-model="customRange"
          :number-of-months="2"
          placeholder="Pick the dates"
          class="w-64"
          data-testid="cockpit-custom-range"
        />
        <Button @click="findOpen = true">
          <Icon name="lucide:search" class="mr-2 size-4" />
          Find availability
        </Button>
      </div>
    </div>

    <CockpitTodayStrip
      v-model:focus="focus"
      :counts="todayCounts"
      :owner-requests="pendingRequests.length"
      @owner-requests="approvalsOpen = true"
    />

    <div v-if="emptyPeriod" class="flex flex-wrap items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground" data-testid="cockpit-empty">
      <Icon name="lucide:calendar-x" class="size-4" />
      <span>No reservations from {{ periodLabel }}.</span>
      <NuxtLink to="/reservations" class="font-medium text-foreground underline-offset-4 hover:underline">
        Open Reservations
      </NuxtLink>
      <span>or click a free night on the board to book one.</span>
    </div>

    <div v-if="availability" class="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm" data-testid="cockpit-availability">
      <Icon name="lucide:calendar-check" class="size-4 text-primary" />
      <span>{{ availabilitySummary }}</span>
      <Button variant="ghost" size="sm" class="ml-auto h-7" @click="availability = null">
        <Icon name="lucide:x" class="mr-1 size-3.5" />
        Clear
      </Button>
    </div>

    <ClientOnly>
      <CockpitTimeline
        v-model:search="search"
        v-model:tags="tags"
        v-model:filters="filters"
        v-model:collapsed="collapsed"
        :groups="visibleGroups"
        :days="days"
        :open-tasks="openTasks"
        :action-needed="actionNeeded"
        :conflicts="conflicts"
        :focus-ids="focusIds"
        :highlight-nights="highlightNights"
        :matching-rows="matchingRows"
        class="max-h-[calc(100svh-12rem)]"
        @open="openStay"
        @open-inbox="openInbox"
        @create="requestCreate"
        @assign="assignStay"
        @new-reservation="newReservationPrefill = null; createRequest = null; newReservationOpen = true"
      />
      <template #fallback>
        <div class="flex h-96 items-center justify-center rounded-lg border bg-card text-sm text-muted-foreground">
          Loading cockpit…
        </div>
      </template>
    </ClientOnly>

    <CockpitFindAvailability v-model:open="findOpen" :today-key="todayKey" @search="applyAvailability" />

    <CockpitCreateDialog v-model:open="createOpen" :request="createRequest" @reserve="reserve" @block="block" />

    <NewReservationDialog
      :open="newReservationOpen"
      :prefill="newReservationPrefill"
      @update:open="newReservationOpen = $event"
      @created="onReservationCreated"
    />

    <Sheet v-model:open="approvalsOpen">
      <SheetContent class="w-full overflow-y-auto sm:max-w-5xl">
        <SheetHeader>
          <SheetTitle>Owner stay requests</SheetTitle>
          <SheetDescription>
            Approve or decline the stays owners asked for. A request shows on the board as an owner stay.
          </SheetDescription>
        </SheetHeader>
        <div class="overflow-x-auto px-4 pb-4">
          <OwnerStayApprovalsPanel />
        </div>
      </SheetContent>
    </Sheet>

    <ClientOnly>
      <ReservationDetailSheet
        :reservation="detailReservation"
        :open="detailOpen"
        @update:open="detailOpen = $event"
        @open-guest="navigateTo(`/reservations/guests/${$event}`)"
      />
    </ClientOnly>
  </div>
</template>
