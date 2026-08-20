<script setup lang="ts">
// My Stays page — owner-portal entry point for owner reservations and
// personal-use blocks. Renders the redesigned PortalReservationCalendar
// (single-property month grid with property info, occupancy stats, and
// room-type selector) plus the dialog for creating owner blocks.
//
// Flow 4/7 wiring: submitting a stay goes through `requestStay` (auto-approve
// or the GM/Admin queue), and cancelling inside the 72h cutoff becomes a
// management request instead of an immediate cancellation.

import type { OwnerReservation } from '~/components/owners/data/owner-reservations'
import type { OwnerStay, OwnerStayStatus } from '~/components/owners/data/owner-stays'
import { ref } from 'vue'
import { toast } from 'vue-sonner'
import PortalOwnerReservationPopover from '~/components/owner-portal/PortalOwnerReservationPopover.vue'
import PortalReservationCalendar from '~/components/owner-portal/PortalReservationCalendar.vue'
import PortalStayDialog from '~/components/owner-portal/PortalStayDialog.vue'
import { mockOwnerReservations } from '~/components/owners/data/owner-reservations-seed'
import { ownerStayStatusLabels } from '~/components/owners/data/owner-stays'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Card, CardContent } from '~/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '~/components/ui/dialog'
import { Label } from '~/components/ui/label'
import { Textarea } from '~/components/ui/textarea'
import { useOwnerPortal } from '~/composables/useOwnerPortal'
import { useOwnerStays } from '~/composables/useOwnerStays'

definePageMeta({
  layout: 'owner-portal',
})

const { currentOwner, myStays } = useOwnerPortal()
const { cancelStay } = useOwnerStays()

const calendarAnchor = ref<Date>(new Date())
const selectedListingId = ref<string | undefined>(undefined)
const createOpen = ref(false)
const createListingId = ref<string | undefined>(undefined)
const createCheckIn = ref('')
const createCheckOut = ref('')
const createNote = ref('')
const localReservations = ref<OwnerReservation[]>([])

const statusFilter = ref<'all' | OwnerStayStatus>('all')

const stays = computed(() => {
  if (statusFilter.value === 'all')
    return myStays.value
  return myStays.value.filter(stay => stay.status === statusFilter.value)
})

const reservations = computed<OwnerReservation[]>(() => {
  const base = mockOwnerReservations
  return [...base, ...localReservations.value]
})

// Owner stays rendered as owner_block reservations so the calendar shows
// pending/active stays with status badges.
const stayReservations = computed<OwnerReservation[]>(() =>
  myStays.value.map(stay => ({
    id: `stay-${stay.id}`,
    type: 'owner_block' as const,
    listingId: stay.listingId,
    guestName: stay.guestName,
    note: stay.notes,
    checkIn: stay.checkIn,
    checkOut: stay.checkOut,
    status: stay.status === 'active' ? 'confirmed' : stay.status === 'pending_approval' ? 'pending' : 'cancelled',
    ownerStayStatus: stay.status,
  })))

const allReservations = computed<OwnerReservation[]>(() => [...stayReservations.value, ...reservations.value])

const statusTabs: Array<{ value: 'all' | OwnerStayStatus, label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'pending_approval', label: 'Pending approval' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
]

function startCreate(payload: { checkIn: string, checkOut: string, listingId?: string }) {
  if (!payload.listingId) {
    toast.error('No listing available for this owner.')
    return
  }
  createListingId.value = payload.listingId
  createCheckIn.value = payload.checkIn ?? todayISO()
  createCheckOut.value = payload.checkOut ?? addDaysISO(createCheckIn.value, 2)
  createNote.value = ''
  createOpen.value = true
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function addDaysISO(iso: string, days: number) {
  const next = new Date(`${iso}T00:00:00`)
  next.setDate(next.getDate() + days)
  return next.toISOString().slice(0, 10)
}

const popoverOpen = ref(false)
const selectedReservation = ref<OwnerReservation | null>(null)

function openReservation(reservation: OwnerReservation) {
  selectedReservation.value = reservation
  popoverOpen.value = true
}

// --- Flow 7 cancellation ---

const cancelTarget = ref<OwnerStay | null>(null)
const cancelReason = ref('')

function requestCancel(stay: OwnerStay) {
  cancelTarget.value = stay
  cancelReason.value = ''
}

function confirmCancel() {
  if (!cancelTarget.value)
    return
  const result = cancelStay(cancelTarget.value.id, cancelReason.value || 'Cancelled by owner')
  if (result.ok) {
    if (result.requiresApproval)
      toast.info('This stay is within the 72h management window — your cancellation has been sent to management for approval.')
    else
      toast.success('Stay cancelled.')
    cancelTarget.value = null
    cancelReason.value = ''
  }
  else if (result.reason === 'pending_approval') {
    toast.info('This stay is still pending approval — wait for the decision or contact management.')
  }
  else {
    toast.error('Could not cancel this stay.')
  }
}

function saved(_stay: OwnerStay) {
  createOpen.value = false
}
</script>

<template>
  <div class="flex h-[calc(100vh-9rem)] min-h-0 flex-col gap-4 p-4 sm:p-6 lg:p-8">
    <header class="space-y-1">
      <h1 class="text-2xl font-semibold tracking-tight">
        My Stays
      </h1>
      <p class="text-sm text-muted-foreground">
        See upcoming guest reservations and book your own personal stays. High-season dates go to management for approval.
      </p>
    </header>

    <div class="flex items-center justify-between">
      <div class="flex flex-wrap gap-2">
        <Badge
          v-for="tab in statusTabs"
          :key="tab.value"
          :variant="statusFilter === tab.value ? 'default' : 'outline'"
          class="cursor-pointer"
          @click="statusFilter = tab.value"
        >
          {{ tab.label }}
        </Badge>
      </div>
      <Button @click="startCreate({ checkIn: todayISO(), checkOut: addDaysISO(todayISO(), 2) })">
        <Icon name="lucide:plus" class="mr-2 size-4" />
        Book my stay
      </Button>
    </div>

    <div class="flex min-h-0 flex-1 flex-col">
      <Card v-if="!allReservations.length" class="flex-1">
        <CardContent class="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
          <Icon name="lucide:calendar-off" class="size-8 opacity-50" />
          <p>No reservations on your properties yet.</p>
          <Button size="sm" @click="startCreate({ checkIn: todayISO(), checkOut: addDaysISO(todayISO(), 2) })">
            Book your first stay
          </Button>
        </CardContent>
      </Card>

      <PortalReservationCalendar
        v-else
        v-model:anchor="calendarAnchor"
        v-model:listing-id="selectedListingId"
        :reservations="allReservations"
        class="flex-1"
        @create-owner-reservation="startCreate"
        @edit-owner-reservation="openReservation"
        @remove-owner-reservation="(res) => { localReservations = localReservations.filter(r => r.id !== res.id); toast.info('Owner block removed.') }"
      />
    </div>

    <div v-if="stays.length" class="overflow-auto rounded-md border">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b text-left text-muted-foreground">
            <th class="p-3 font-medium">
              Dates
            </th>
            <th class="p-3 font-medium">
              Guest
            </th>
            <th class="p-3 font-medium">
              Status
            </th>
            <th class="p-3 font-medium">
              Guests
            </th>
            <th class="p-3 font-medium">
              Notes
            </th>
            <th class="p-3 text-right font-medium">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="stay in stays" :key="stay.id" class="border-b last:border-0">
            <td class="p-3">
              {{ stay.checkIn }} → {{ stay.checkOut }}
            </td>
            <td class="p-3 font-medium">
              {{ stay.guestName }}
            </td>
            <td class="p-3">
              <Badge variant="outline">
                {{ ownerStayStatusLabels[stay.status] }}
              </Badge>
            </td>
            <td class="p-3">
              {{ stay.guestCount ?? 1 }}
            </td>
            <td class="max-w-40 truncate p-3 text-muted-foreground">
              {{ stay.notes ?? '—' }}
            </td>
            <td class="p-3 text-right">
              <Button
                v-if="stay.status === 'active'"
                size="sm"
                variant="ghost"
                @click="requestCancel(stay)"
              >
                Cancel
              </Button>
              <span v-else-if="stay.status === 'rejected' && stay.approval?.reason" class="text-xs text-muted-foreground">
                {{ stay.approval.reason }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <PortalStayDialog
      v-model="createOpen"
      :owner-id="currentOwner?.id ?? 'own-1'"
      :listing-id="createListingId"
      :default-check-in="createCheckIn"
      @saved="saved"
    />
    <Dialog :open="!!cancelTarget" @update:open="(v: boolean) => { if (!v) cancelTarget = null }">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cancel stay?</DialogTitle>
          <DialogDescription>
            {{ cancelTarget?.checkIn }} → {{ cancelTarget?.checkOut }}. If this stay is within 72 hours of check-in, management must approve the cancellation.
          </DialogDescription>
        </DialogHeader>
        <div class="space-y-1.5">
          <Label for="cancel-reason">Reason (optional)</Label>
          <Textarea id="cancel-reason" v-model="cancelReason" placeholder="e.g. Plans changed" />
        </div>
        <DialogFooter>
          <Button variant="outline" @click="cancelTarget = null">
            Keep stay
          </Button>
          <Button variant="destructive" @click="confirmCancel">
            Cancel stay
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <PortalOwnerReservationPopover
      v-model:open="popoverOpen"
      :reservation="selectedReservation"
      @edit="(res) => { selectedReservation = res; popoverOpen = false; toast.info(`Editing owner block: ${res.note ?? res.id}`) }"
      @remove="(res) => { localReservations = localReservations.filter(r => r.id !== res.id); popoverOpen = false; toast.info('Owner block removed.') }"
    />
  </div>
</template>
