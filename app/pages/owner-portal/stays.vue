<script setup lang="ts">
// Owner portal — My Stays.
//
// Built around what an owner comes here to do: see what is booked, know how
// many free nights they have left, book more, and cancel if plans change. The
// allowance is stated up front rather than left to be discovered inside the
// booking dialog, and the calendar sits below the list as a way to find dates.

import type { OwnerReservation } from '~/components/owners/data/owner-reservations'
import type { OwnerStay } from '~/components/owners/data/owner-stays'
import { toast } from 'vue-sonner'
import { listings } from '~/components/listings/data/listings'
import PortalOwnerReservationPopover from '~/components/owner-portal/PortalOwnerReservationPopover.vue'
import PortalReservationCalendar from '~/components/owner-portal/PortalReservationCalendar.vue'
import PortalStayDialog from '~/components/owner-portal/PortalStayDialog.vue'
import { mockOwnerReservations } from '~/components/owners/data/owner-reservations-seed'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '~/components/ui/dialog'
import { Label } from '~/components/ui/label'
import { Textarea } from '~/components/ui/textarea'
import { useOwnerPortal } from '~/composables/useOwnerPortal'
import { useOwnerQuotas } from '~/composables/useOwnerQuotas'
import { useOwnerStays } from '~/composables/useOwnerStays'

definePageMeta({ layout: 'owner-portal' })

const { currentOwner, myStays, assignedProperties, ownerUseNights } = useOwnerPortal()
const { cancelStay } = useOwnerStays()

const calendarAnchor = ref<Date>(new Date())
const selectedListingId = ref<string | undefined>(undefined)
const createOpen = ref(false)
const createListingId = ref<string | undefined>(undefined)
const createCheckIn = ref('')
const createCheckOut = ref('')
const localReservations = ref<OwnerReservation[]>([])
const showCalendar = ref(true)
const showPast = ref(false)

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function addDaysISO(iso: string, days: number) {
  const next = new Date(`${iso}T00:00:00`)
  next.setDate(next.getDate() + days)
  return next.toISOString().slice(0, 10)
}

// --- Buckets, in the order an owner cares about ------------------------------

const today = computed(() => todayISO())

const awaitingApproval = computed(() =>
  myStays.value.filter(s => s.status === 'pending_approval'))

const upcoming = computed(() =>
  myStays.value
    .filter(s => s.status === 'active' && s.checkOut >= today.value)
    .sort((a, b) => a.checkIn.localeCompare(b.checkIn)))

/** Finished, declined and cancelled — everything that needs no attention. */
const past = computed(() =>
  myStays.value
    .filter(s => s.status === 'rejected' || s.status === 'cancelled'
      || (s.status === 'active' && s.checkOut < today.value))
    .sort((a, b) => b.checkIn.localeCompare(a.checkIn)))

// --- Allowance ---------------------------------------------------------------

const annualCap = computed(() => currentOwner.value?.annualOwnerUseNightCap ?? 0)
const nightsUsed = computed(() => ownerUseNights.value)
const nightsLeft = computed(() =>
  annualCap.value > 0 ? Math.max(0, annualCap.value - nightsUsed.value) : null)
const capPercent = computed(() =>
  annualCap.value > 0 ? Math.min(100, Math.round((nightsUsed.value / annualCap.value) * 100)) : 0)

// Seasonal windows sit with the annual allowance — they are the same question
// ("how many nights do I have left?") narrowed to a date range, so splitting
// them across two cards made the owner read both to get one answer.
const { quotasForOwnerListing, getRemainingQuota } = useOwnerQuotas()

const quotaWindows = computed(() => {
  const ownerId = currentOwner.value?.id
  if (!ownerId)
    return []
  return assignedProperties.value.flatMap(mapping =>
    quotasForOwnerListing(ownerId, mapping.listingId).map((window) => {
      const remaining = getRemainingQuota(ownerId, mapping.listingId, window.startDate)
      return {
        id: window.id,
        listingId: mapping.listingId,
        startDate: window.startDate,
        endDate: window.endDate,
        maxNights: window.maxNights,
        remaining,
        unlimited: !Number.isFinite(remaining),
      }
    }))
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
})

/** Label the property only when the owner has windows on more than one. */
const quotaSpansProperties = computed(() =>
  new Set(quotaWindows.value.map(w => w.listingId)).size > 1)

function fmtWindow(startDate: string, endDate: string): string {
  const fmt = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  return `${fmt(startDate)} → ${fmt(endDate)}`
}

const propertyNames = computed(() => new Map(listings.value.map(l => [l.id, l.name])))

function listingName(id: string): string {
  return propertyNames.value.get(id) ?? id
}

// --- Calendar feed ----------------------------------------------------------

const stayReservations = computed<OwnerReservation[]>(() =>
  myStays.value.map(stay => ({
    id: `stay-${stay.id}`,
    type: 'owner_block' as const,
    listingId: stay.listingId,
    // A stay booked into a specific room shows on that room's row; one with no
    // room blocks the whole property and shows on every room row.
    roomId: stay.unitId,
    guestName: stay.guestName,
    note: stay.notes,
    checkIn: stay.checkIn,
    checkOut: stay.checkOut,
    status: stay.status === 'active' ? 'confirmed' : stay.status === 'pending_approval' ? 'pending' : 'cancelled',
    ownerStayStatus: stay.status,
  })))

const allReservations = computed<OwnerReservation[]>(() =>
  [...stayReservations.value, ...mockOwnerReservations, ...localReservations.value])

// --- Booking ----------------------------------------------------------------

function startCreate(payload?: { checkIn?: string, checkOut?: string, listingId?: string }) {
  const listingId = payload?.listingId ?? selectedListingId.value ?? assignedProperties.value[0]?.listingId
  if (!listingId) {
    toast.error('You have no properties assigned yet.')
    return
  }
  createListingId.value = listingId
  createCheckIn.value = payload?.checkIn ?? todayISO()
  createCheckOut.value = payload?.checkOut ?? addDaysISO(createCheckIn.value, 2)
  createOpen.value = true
}

const popoverOpen = ref(false)
const selectedReservation = ref<OwnerReservation | null>(null)

function openReservation(reservation: OwnerReservation) {
  selectedReservation.value = reservation
  popoverOpen.value = true
}

// --- Cancelling -------------------------------------------------------------

const cancelTarget = ref<OwnerStay | null>(null)
const cancelReason = ref('')

function confirmCancel() {
  if (!cancelTarget.value)
    return
  const result = cancelStay(cancelTarget.value.id, cancelReason.value || 'Cancelled by owner')
  if (result.ok) {
    toast.success('Stay cancelled — the dates are free again.')
    cancelTarget.value = null
    cancelReason.value = ''
  }
  else if (result.reason === 'pending_approval') {
    toast.info('This request is still being reviewed. Wait for the decision, or contact your manager.')
  }
  else {
    toast.error('Could not cancel this stay.')
  }
}

// --- Presentation -----------------------------------------------------------

const dateFmt = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short' })
const longFmt = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

function fmtRange(stay: OwnerStay): string {
  const from = dateFmt.format(new Date(`${stay.checkIn}T00:00:00`))
  const to = longFmt.format(new Date(`${stay.checkOut}T00:00:00`))
  return `${from} → ${to}`
}

/** Days until check-in, in words. */
function countdown(stay: OwnerStay): string {
  const days = Math.round(
    (Date.parse(`${stay.checkIn}T00:00:00`) - Date.parse(`${today.value}T00:00:00`)) / 86_400_000,
  )
  if (days < 0)
    return 'Staying now'
  if (days === 0)
    return 'Arriving today'
  if (days === 1)
    return 'Tomorrow'
  if (days < 7)
    return `In ${days} days`
  if (days < 14)
    return 'Next week'
  return `In ${Math.round(days / 7)} weeks`
}

function pastState(stay: OwnerStay): { label: string, tone: string } {
  if (stay.status === 'rejected')
    return { label: 'Declined', tone: 'bg-destructive/10 text-destructive' }
  if (stay.status === 'cancelled')
    return { label: 'Cancelled', tone: 'bg-muted text-muted-foreground' }
  return { label: 'Completed', tone: 'bg-muted text-muted-foreground' }
}
</script>

<template>
  <div class="space-y-6">
    <header class="flex flex-wrap items-start justify-between gap-3">
      <div class="space-y-1">
        <h1 class="text-2xl font-semibold tracking-tight">
          My Stays
        </h1>
        <p class="text-sm text-muted-foreground">
          Book time at your own properties and see what is already reserved.
        </p>
      </div>
      <Button @click="startCreate()">
        <Icon name="lucide:plus" class="mr-2 size-4" />
        Book a stay
      </Button>
    </header>

    <!-- Find dates — first, because picking dates is what this page is for -->
    <section class="space-y-3">
      <div class="flex items-center justify-between gap-3">
        <h2 class="text-sm font-semibold">
          Availability calendar
        </h2>
        <Button variant="ghost" size="sm" class="text-xs" @click="showCalendar = !showCalendar">
          <Icon :name="showCalendar ? 'lucide:chevron-up' : 'lucide:chevron-down'" class="mr-1 size-3.5" />
          {{ showCalendar ? 'Hide' : 'Show' }}
        </Button>
      </div>
      <p v-if="showCalendar" class="text-xs text-muted-foreground">
        Guest bookings are green, your own stays amber. Check here for free dates before booking.
      </p>
      <PortalReservationCalendar
        v-if="showCalendar"
        v-model:anchor="calendarAnchor"
        v-model:listing-id="selectedListingId"
        :owner-id="currentOwner?.id ?? null"
        :reservations="allReservations"
        @edit-owner-reservation="openReservation"
        @remove-owner-reservation="(res) => { localReservations = localReservations.filter(r => r.id !== res.id); toast.info('Owner block removed.') }"
      />
    </section>

    <!-- Allowance — stated up front, not buried in the booking dialog -->
    <div class="grid gap-3">
      <div class="rounded-lg border p-4">
        <div class="flex items-baseline justify-between gap-3">
          <p class="text-xs uppercase tracking-wide text-muted-foreground">
            Your nights this year
          </p>
          <p class="text-sm tabular-nums">
            <span class="font-semibold">{{ nightsUsed }}</span>
            <span class="text-muted-foreground">{{ annualCap > 0 ? ` of ${annualCap}` : ' nights used' }}</span>
          </p>
        </div>
        <div v-if="annualCap > 0" class="mt-2.5 h-2 overflow-hidden rounded-full bg-muted">
          <div
            class="h-full rounded-full transition-all"
            :class="capPercent >= 100 ? 'bg-destructive' : capPercent >= 80 ? 'bg-amber-500' : 'bg-primary'"
            :style="{ width: `${capPercent}%` }"
          />
        </div>
        <p class="mt-2 text-xs text-muted-foreground">
          <template v-if="nightsLeft === null">
            You have no annual limit on personal stays.
          </template>
          <template v-else-if="nightsLeft === 0">
            You have used your full allowance for this year.
          </template>
          <template v-else>
            {{ nightsLeft }} night{{ nightsLeft === 1 ? '' : 's' }} left.
          </template>
        </p>

        <!-- Seasonal windows narrow the annual figure, so they belong here -->
        <div v-if="quotaWindows.length" class="mt-3 space-y-1.5 border-t pt-3">
          <p class="text-xs font-medium text-muted-foreground">
            Limits by season
          </p>
          <div
            v-for="window in quotaWindows"
            :key="window.id"
            class="flex items-baseline justify-between gap-3 text-xs"
          >
            <span class="min-w-0 text-muted-foreground">
              {{ fmtWindow(window.startDate, window.endDate) }}
              <span v-if="quotaSpansProperties" class="text-muted-foreground/70">
                · {{ listingName(window.listingId) }}
              </span>
            </span>
            <span
              class="shrink-0 tabular-nums"
              :class="!window.unlimited && window.remaining === 0 ? 'text-destructive' : 'font-medium'"
            >
              <template v-if="window.unlimited">No limit</template>
              <template v-else-if="window.maxNights === 0">Not available</template>
              <template v-else>{{ window.remaining }} of {{ window.maxNights }} nights left</template>
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Waiting on management -->
    <section v-if="awaitingApproval.length" class="space-y-3">
      <h2 class="flex items-center gap-2 text-sm font-semibold">
        <Icon name="lucide:clock" class="size-4 text-amber-600 dark:text-amber-400" />
        Waiting for approval
      </h2>
      <div
        v-for="stay in awaitingApproval"
        :key="stay.id"
        class="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4"
      >
        <div class="flex flex-wrap items-start justify-between gap-2">
          <div class="space-y-1">
            <p class="font-medium leading-snug">
              {{ fmtRange(stay) }} · {{ stay.nights }} night{{ stay.nights === 1 ? '' : 's' }}
            </p>
            <p class="text-xs text-muted-foreground">
              {{ listingName(stay.listingId) }}
            </p>
          </div>
          <Badge variant="outline" class="border-transparent bg-amber-500/10 text-amber-700 dark:text-amber-300">
            Under review
          </Badge>
        </div>
        <p class="mt-2 text-xs text-muted-foreground">
          Your manager is reviewing these dates. You will see the decision here.
        </p>
      </div>
    </section>

    <!-- Confirmed and coming up -->
    <section class="space-y-3">
      <h2 class="text-sm font-semibold">
        Upcoming
      </h2>

      <div v-if="!upcoming.length" class="rounded-lg border border-dashed p-8 text-center">
        <Icon name="lucide:calendar-plus" class="mx-auto size-7 text-muted-foreground" aria-hidden="true" />
        <p class="mt-3 text-sm text-muted-foreground">
          You have no stays booked. Use <span class="font-medium text-foreground">Book a stay</span> above to reserve dates.
        </p>
      </div>

      <div
        v-for="stay in upcoming"
        :key="stay.id"
        class="rounded-lg border p-4 space-y-3"
      >
        <div class="flex flex-wrap items-start justify-between gap-2">
          <div class="min-w-0 space-y-1">
            <p class="font-medium leading-snug">
              {{ fmtRange(stay) }}
            </p>
            <p class="text-xs text-muted-foreground">
              {{ listingName(stay.listingId) }} ·
              {{ stay.nights }} night{{ stay.nights === 1 ? '' : 's' }}
              <template v-if="stay.guestCount">
                · {{ stay.guestCount }} guests
              </template>
            </p>
          </div>
          <Badge
            variant="outline"
            class="border-transparent"
            :class="stay.checkIn <= today
              ? 'bg-green-500/10 text-green-700 dark:text-green-300'
              : 'bg-blue-500/10 text-blue-700 dark:text-blue-300'"
          >
            {{ countdown(stay) }}
          </Badge>
        </div>

        <p v-if="stay.notes" class="text-sm text-muted-foreground">
          {{ stay.notes }}
        </p>

        <div class="flex flex-wrap items-center gap-3 border-t pt-3">
          <Button variant="outline" size="sm" @click="cancelTarget = stay; cancelReason = ''">
            Cancel this stay
          </Button>
          <span v-if="stay.countsAgainstOwnerUseCap && annualCap > 0" class="text-xs text-muted-foreground">
            Counts toward your {{ annualCap }}-night allowance
          </span>
          <span v-else-if="!stay.countsAgainstOwnerUseCap" class="text-xs text-muted-foreground">
            Does not count toward your allowance
          </span>
        </div>
      </div>
    </section>

    <!-- History, out of the way -->
    <section v-if="past.length" class="space-y-3">
      <div class="flex items-center justify-between gap-3">
        <h2 class="text-sm font-semibold">
          Past stays
        </h2>
        <Button variant="ghost" size="sm" class="text-xs" @click="showPast = !showPast">
          <Icon :name="showPast ? 'lucide:chevron-up' : 'lucide:chevron-down'" class="mr-1 size-3.5" />
          {{ showPast ? 'Hide' : 'Show' }}
        </Button>
      </div>

      <div v-if="showPast" class="divide-y rounded-lg border">
        <div v-for="stay in past" :key="stay.id" class="space-y-1 p-3">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <p class="text-sm">
              {{ fmtRange(stay) }}
              <span class="text-muted-foreground">· {{ listingName(stay.listingId) }}</span>
            </p>
            <Badge variant="outline" class="border-transparent" :class="pastState(stay).tone">
              {{ pastState(stay).label }}
            </Badge>
          </div>
          <p v-if="stay.status === 'rejected' && stay.approval?.reason" class="text-xs text-destructive">
            Reason: {{ stay.approval.reason }}
          </p>
          <p v-else-if="stay.cancellationReason" class="text-xs text-muted-foreground">
            {{ stay.cancellationReason }}
          </p>
        </div>
      </div>
    </section>

    <PortalStayDialog
      v-model="createOpen"
      :owner-id="currentOwner?.id ?? ''"
      :listing-id="createListingId"
      :default-check-in="createCheckIn"
      @saved="createOpen = false"
    />

    <PortalOwnerReservationPopover
      v-model:open="popoverOpen"
      :reservation="selectedReservation"
    />

    <Dialog :open="!!cancelTarget" @update:open="(v: boolean) => { if (!v) cancelTarget = null }">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cancel this stay?</DialogTitle>
          <DialogDescription>
            {{ cancelTarget ? fmtRange(cancelTarget) : '' }} at
            {{ cancelTarget ? listingName(cancelTarget.listingId) : '' }}.
            The dates go back on the market and the nights return to your allowance.
          </DialogDescription>
        </DialogHeader>
        <div class="space-y-1.5">
          <Label for="cancel-reason">Reason (optional)</Label>
          <Textarea id="cancel-reason" v-model="cancelReason" placeholder="Anything your manager should know" />
        </div>
        <DialogFooter>
          <Button variant="outline" @click="cancelTarget = null">
            Keep it
          </Button>
          <Button variant="destructive" @click="confirmCancel">
            Cancel stay
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
