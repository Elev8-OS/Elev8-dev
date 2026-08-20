<script setup lang="ts">
// Cockpit — staff approval queue + calendar for owner stay requests (PRD 5.4.2).
//
// Pending owner self-book requests (request-to-book mode) surface here with
// a distinct visual treatment: staff approve/decline, and the calendar shows
// pending (amber), approved (emerald) and rejected (muted) owner blocks.

import type { OwnerReservation } from '~/components/owners/data/owner-reservations'
import PortalReservationCalendar from '~/components/owner-portal/PortalReservationCalendar.vue'
import OwnerStayApprovalsPanel from '~/components/owners/OwnerStayApprovalsPanel.vue'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { useOwnerStayApprovals } from '~/composables/useOwnerStayApprovals'
import { useOwnerStays } from '~/composables/useOwnerStays'

definePageMeta({ layout: 'default' })

const { pendingRequests } = useOwnerStayApprovals()
const { stays } = useOwnerStays()

const calendarAnchor = ref<Date>(new Date())
const selectedListingId = ref<string | undefined>(undefined)

// Owner stays rendered as calendar bars with their approval status.
const reservations = computed<OwnerReservation[]>(() =>
  stays.value.map(stay => ({
    id: `cockpit-${stay.id}`,
    type: 'owner_block' as const,
    listingId: stay.listingId,
    guestName: stay.guestName,
    note: stay.notes,
    checkIn: stay.checkIn,
    checkOut: stay.checkOut,
    status: stay.status === 'active' ? 'confirmed' : stay.status === 'pending_approval' ? 'pending' : 'cancelled',
    ownerStayStatus: stay.status,
  })))
</script>

<template>
  <div class="space-y-6 p-6">
    <div class="space-y-1">
      <h1 class="text-2xl font-bold tracking-tight">
        Cockpit
      </h1>
      <p class="text-sm text-muted-foreground">
        Review owner stay requests and see how owner blocks fit against the calendar.
      </p>
    </div>

    <Card>
      <CardHeader>
        <CardTitle class="text-base">
          Pending owner stay requests
          <Badge v-if="pendingRequests.length" variant="destructive" class="ml-2">
            {{ pendingRequests.length }}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <OwnerStayApprovalsPanel />
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle class="text-base">
          Owner calendar
        </CardTitle>
      </CardHeader>
      <CardContent>
        <PortalReservationCalendar
          v-model:anchor="calendarAnchor"
          v-model:listing-id="selectedListingId"
          :reservations="reservations"
        />
      </CardContent>
    </Card>
  </div>
</template>
