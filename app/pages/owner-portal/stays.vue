<script setup lang="ts">
// My Stays page — owner-portal entry point for owner reservations and
// personal-use blocks. Renders the redesigned PortalReservationCalendar
// (single-property month grid with property info, occupancy stats, and
// room-type selector) plus the dialog for creating owner blocks.

import type { OwnerReservation } from '~/components/owners/data/owner-reservations'
import { ref } from 'vue'
import { toast } from 'vue-sonner'
import PortalOwnerReservationPopover from '~/components/owner-portal/PortalOwnerReservationPopover.vue'
import PortalReservationCalendar from '~/components/owner-portal/PortalReservationCalendar.vue'
import { mockOwnerReservations } from '~/components/owners/data/owner-reservations-seed'
import { Button } from '~/components/ui/button'
import { Card, CardContent } from '~/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { useOwnerPortal } from '~/composables/useOwnerPortal'

definePageMeta({
  layout: 'owner-portal',
})

const { currentOwner, myOwnerIds, listings } = useOwnerPortal()
void currentOwner
void myOwnerIds
void listings

const calendarAnchor = ref<Date>(new Date())
const selectedListingId = ref<string | null>(null)
const createOpen = ref(false)
const createListingId = ref<string | null>(null)
const createCheckIn = ref('')
const createCheckOut = ref('')
const createNote = ref('')
const localReservations = ref<OwnerReservation[]>([])

const reservations = computed<OwnerReservation[]>(() => {
  const base = mockOwnerReservations
  return [...base, ...localReservations.value]
})

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

function confirmCreate() {
  if (!createCheckIn.value || !createCheckOut.value || !createListingId.value) {
    toast.error('Pick a check-in and check-out date.')
    return
  }
  if (createCheckOut.value <= createCheckIn.value) {
    toast.error('Check-out must be after check-in.')
    return
  }
  const id = `or-local-${Date.now().toString(36)}`
  localReservations.value = [
    ...localReservations.value,
    {
      id,
      type: 'owner_block',
      listingId: createListingId.value,
      note: createNote.value.trim() || 'Owner block',
      checkIn: createCheckIn.value,
      checkOut: createCheckOut.value,
      status: 'confirmed',
    },
  ]
  toast.success('Owner block created.')
  createOpen.value = false
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
</script>

<template>
  <div class="flex h-[calc(100vh-9rem)] min-h-0 flex-col gap-4 p-4 sm:p-6 lg:p-8">
    <header class="space-y-1">
      <h1 class="text-2xl font-semibold tracking-tight">
        My Stays
      </h1>
      <p class="text-sm text-muted-foreground">
        See upcoming guest reservations and block out dates for your own personal stays.
      </p>
    </header>

    <div class="flex min-h-0 flex-1 flex-col">
      <Card v-if="!reservations.length" class="flex-1">
        <CardContent class="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
          <Icon name="lucide:calendar-off" class="size-8 opacity-50" />
          <p>No reservations on your properties yet.</p>
          <Button size="sm" @click="startCreate({ checkIn: todayISO(), checkOut: addDaysISO(todayISO(), 2) })">
            Block your first dates
          </Button>
        </CardContent>
      </Card>

      <PortalReservationCalendar
        v-else
        v-model:anchor="calendarAnchor"
        v-model:listing-id="selectedListingId"
        :reservations="reservations"
        class="flex-1"
        @create-owner-reservation="startCreate"
        @edit-owner-reservation="openReservation"
        @remove-owner-reservation="(res) => { localReservations = localReservations.filter(r => r.id !== res.id); toast.info('Owner block removed.') }"
      />
    </div>

    <Dialog v-model:open="createOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            New owner reservation
          </DialogTitle>
          <DialogDescription>
            Block out dates for your own personal stay. These nights will be removed from guest availability.
          </DialogDescription>
        </DialogHeader>
        <div class="space-y-3">
          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-1.5">
              <Label for="owner-stay-checkin">Check-in</Label>
              <Input
                id="owner-stay-checkin"
                v-model="createCheckIn"
                type="date"
              />
            </div>
            <div class="space-y-1.5">
              <Label for="owner-stay-checkout">Check-out</Label>
              <Input
                id="owner-stay-checkout"
                v-model="createCheckOut"
                type="date"
              />
            </div>
          </div>
          <div class="space-y-1.5">
            <Label for="owner-stay-note">Note (optional)</Label>
            <Input
              id="owner-stay-note"
              v-model="createNote"
              placeholder="e.g. Family visit"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="createOpen = false">
            Cancel
          </Button>
          <Button @click="confirmCreate">
            Create block
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
