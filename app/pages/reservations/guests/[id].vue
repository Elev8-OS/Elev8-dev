<script setup lang="ts">
import type { ReservationEntry } from '~/components/reservations/data/reservations'
import { computed, ref } from 'vue'
import GuestActivityTimeline from '~/components/reservations/GuestActivityTimeline.vue'
import GuestBookingHistory from '~/components/reservations/GuestBookingHistory.vue'
import GuestNotes from '~/components/reservations/GuestNotes.vue'
import GuestPaymentRequests from '~/components/reservations/GuestPaymentRequests.vue'
import GuestProfileHeader from '~/components/reservations/GuestProfileHeader.vue'
import GuestReservationsTable from '~/components/reservations/GuestReservationsTable.vue'
import GuestStatsStrip from '~/components/reservations/GuestStatsStrip.vue'
import GuestUpsells from '~/components/reservations/GuestUpsells.vue'
import NewReservationDialog from '~/components/reservations/NewReservationDialog.vue'
import { useGuestGuideLinks } from '~/composables/useGuestGuideLinks'
import { useInbox } from '~/composables/useInbox'
import { usePaymentRequests } from '~/composables/usePaymentRequests'
import { useReservationsModule } from '~/composables/useReservationsModule'

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

const today = new Date().toISOString().split('T')[0] ?? ''
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
        <GuestUpsells :order-ids="upsells" />
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
