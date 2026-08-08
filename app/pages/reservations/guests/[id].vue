<script setup lang="ts">
import type { ReservationEntry, ReservationStatus } from '~/components/reservations/data/reservations'
import { computed, ref } from 'vue'
import { listings } from '~/components/listings/data/listings'
import { reservationStatusLabels } from '~/components/reservations/data/reservations'
import GuestActivityTimeline from '~/components/reservations/GuestActivityTimeline.vue'
import GuestNotes from '~/components/reservations/GuestNotes.vue'
import GuestPaymentRequests from '~/components/reservations/GuestPaymentRequests.vue'
import GuestReservationsTable from '~/components/reservations/GuestReservationsTable.vue'
import GuestUpsells from '~/components/reservations/GuestUpsells.vue'
import NewReservationDialog from '~/components/reservations/NewReservationDialog.vue'
import ReservationStatusBadge from '~/components/reservations/ReservationStatusBadge.vue'
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
const currentCount = computed(() => stays.value.filter(r => r.checkIn <= today && r.checkOut >= today && r.status !== 'cancelled').length)
const totalSpent = computed(() => stays.value
  .filter(r => r.status !== 'cancelled')
  .reduce((sum, r) => sum + r.totalPrice, 0))
const spentCurrency = computed(() => stays.value.find(r => r.status !== 'cancelled')?.currency ?? 'USD')

// Primary (most relevant) stay for the Booking Info / Room Info cards
const primaryStay = computed<ReservationEntry | null>(() => {
  if (stays.value.length === 0)
    return null
  const active = stays.value.find(r => r.checkIn <= today && r.checkOut >= today && r.status !== 'cancelled')
  if (active)
    return active
  const upcoming = stays.value.find(r => r.checkIn > today && r.status !== 'cancelled')
  return upcoming ?? stays.value[0] ?? null
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

// Formatting helpers
const df = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

function fmtDate(iso: string): string {
  return df.format(new Date(`${iso}T00:00:00Z`))
}

function fmtCurrency(amount: number, currency: string): string {
  return `${amount.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${currency}`
}

function listingPhoto(listingId: string): string {
  return listings.value.find(l => l.id === listingId)?.photos?.[0] ?? ''
}

function callPhone(phone: string) {
  window.location.href = `tel:${phone.replace(/[^\d+]/g, '')}`
}

function reservationStatusMeta(status?: ReservationStatus): string {
  const map: Record<ReservationStatus, string> = {
    unverified: 'bg-neutral-400/20 text-neutral-700 border-neutral-400/40',
    verified: 'bg-green-500/10 text-green-700 border-green-500/30',
    checked_in: 'bg-orange-500/10 text-orange-700 border-orange-500/30',
    checked_out: 'bg-blue-500/10 text-blue-700 border-blue-500/30',
    cancelled: 'bg-muted text-muted-foreground border-border',
    blocked: 'bg-black/80 text-white border-black/80',
    inquiry: 'bg-amber-500/10 text-amber-700 border-amber-500/30',
  }
  return status ? map[status] : ''
}
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

      <!-- Top: 3-column cards (Profile | Booking Info | Room Info) -->
      <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
        <!-- Profile card -->
        <Card>
          <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle class="text-base">
              Profile
            </CardTitle>
            <DropdownMenu>
              <DropdownMenuTrigger as-child>
                <Button variant="ghost" size="sm" class="h-8 w-8 p-0">
                  <Icon name="lucide:more-horizontal" class="size-4" />
                  <span class="sr-only">Menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem @click="newReservationOpen = true">
                  <Icon name="lucide:plus" class="mr-2 size-4" />
                  New reservation
                </DropdownMenuItem>
                <DropdownMenuItem @click="router.push('/reservations')">
                  <Icon name="lucide:arrow-left" class="mr-2 size-4" />
                  Back to list
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </CardHeader>
          <CardContent class="space-y-4">
            <div class="flex items-center gap-3">
              <Avatar class="size-12">
                <AvatarFallback class="bg-primary/10 text-primary">
                  {{ guest.name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase() }}
                </AvatarFallback>
              </Avatar>
              <div class="min-w-0">
                <p class="font-semibold truncate">
                  {{ guest.name }}
                </p>
                <p class="text-xs text-muted-foreground">
                  ID: {{ guest.id }}
                </p>
              </div>
            </div>
            <div class="space-y-1.5 text-sm">
              <p class="flex items-center gap-2 text-muted-foreground">
                <Icon name="lucide:phone" class="size-3.5" />
                <button type="button" class="hover:underline" @click="callPhone(guest.phone)">
                  {{ guest.phone }}
                </button>
              </p>
              <p class="flex items-center gap-2 text-muted-foreground">
                <Icon name="lucide:mail" class="size-3.5" />
                <a :href="`mailto:${guest.email}`" class="hover:underline truncate">{{ guest.email }}</a>
              </p>
              <p class="flex items-center gap-2 text-muted-foreground">
                <Icon name="lucide:languages" class="size-3.5" />
                {{ guest.language }}
              </p>
            </div>
            <Separator />
            <div class="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p class="text-xs text-muted-foreground uppercase tracking-wide">
                  Joined
                </p>
                <p class="font-medium">
                  {{ fmtDate(guest.createdAt) }}
                </p>
              </div>
              <div>
                <p class="text-xs text-muted-foreground uppercase tracking-wide">
                  Previous stays
                </p>
                <p class="font-medium">
                  {{ guest.previousStays }}
                </p>
              </div>
              <div>
                <p class="text-xs text-muted-foreground uppercase tracking-wide">
                  Total spent
                </p>
                <p class="font-medium">
                  {{ fmtCurrency(totalSpent, spentCurrency) }}
                </p>
              </div>
              <div>
                <p class="text-xs text-muted-foreground uppercase tracking-wide">
                  Current stay
                </p>
                <p class="font-medium">
                  {{ currentCount }}
                </p>
              </div>
            </div>
            <div v-if="guest.tags.length" class="flex flex-wrap gap-1.5">
              <Badge v-for="tag in guest.tags" :key="tag" variant="secondary">
                {{ tag }}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <!-- Booking Info card -->
        <Card>
          <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle class="text-base">
              Booking Info
            </CardTitle>
            <Badge variant="outline" :class="reservationStatusMeta(primaryStay?.status)">
              {{ primaryStay ? reservationStatusLabels[primaryStay.status] : 'No booking' }}
            </Badge>
          </CardHeader>
          <CardContent class="space-y-4">
            <template v-if="primaryStay">
              <div class="space-y-1.5 text-sm">
                <p class="flex items-center gap-2 text-muted-foreground">
                  <Icon name="lucide:hash" class="size-3.5" />
                  Booking ID:
                  <span class="font-mono font-medium text-foreground">{{ primaryStay.id }}</span>
                </p>
                <p class="flex items-center gap-2 text-muted-foreground">
                  <Icon name="lucide:calendar" class="size-3.5" />
                  {{ fmtDate(primaryStay.checkIn) }} → {{ fmtDate(primaryStay.checkOut) }}
                </p>
                <p class="flex items-center gap-2 text-muted-foreground">
                  <Icon name="lucide:moon" class="size-3.5" />
                  {{ primaryStay.nights }} nights · {{ primaryStay.guestCount }} guests
                </p>
              </div>
              <Separator />
              <div class="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p class="text-xs text-muted-foreground uppercase tracking-wide">
                    Channel
                  </p>
                  <p class="font-medium">
                    {{ primaryStay.channel }}
                  </p>
                </div>
                <div>
                  <p class="text-xs text-muted-foreground uppercase tracking-wide">
                    Total
                  </p>
                  <p class="font-medium">
                    {{ fmtCurrency(primaryStay.totalPrice, primaryStay.currency) }}
                  </p>
                </div>
              </div>
              <div v-if="primaryStay.guestNotes" class="rounded-md border-l-2 border-primary bg-muted/40 p-2.5 text-xs text-muted-foreground">
                {{ primaryStay.guestNotes }}
              </div>
            </template>
            <p v-else class="text-sm text-muted-foreground italic">
              No active booking for this guest.
            </p>
          </CardContent>
        </Card>

        <!-- Room Info card -->
        <Card>
          <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle class="text-base">
              Room Info
            </CardTitle>
            <Button v-if="primaryStay" variant="link" size="sm" class="h-8 p-0 text-xs" as-child>
              <NuxtLink :to="`/listings/${primaryStay.listingId}`">
                View detail
              </NuxtLink>
            </Button>
          </CardHeader>
          <CardContent class="space-y-4">
            <template v-if="primaryStay">
              <div class="flex h-28 w-full items-center justify-center overflow-hidden border bg-muted/40">
                <img
                  v-if="listingPhoto(primaryStay.listingId)"
                  :src="listingPhoto(primaryStay.listingId)"
                  :alt="primaryStay.listingName"
                  class="h-full w-full object-cover"
                >
                <Icon v-else name="lucide:building-2" class="size-8 text-muted-foreground/50" />
              </div>
              <div>
                <p class="text-sm font-semibold leading-tight">
                  {{ primaryStay.listingName }}
                </p>
                <p class="text-xs text-muted-foreground">
                  {{ primaryStay.guestCount }} guests
                </p>
              </div>
              <Separator />
              <div class="space-y-1.5 text-sm">
                <p class="flex items-center justify-between">
                  <span class="text-muted-foreground">Status</span>
                  <ReservationStatusBadge :status="primaryStay.status" />
                </p>
              </div>
            </template>
            <p v-else class="text-sm text-muted-foreground italic">
              No room booked.
            </p>
          </CardContent>
        </Card>
      </div>

      <!-- Booking History table (full width) -->
      <section class="space-y-2">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Booking History
        </h2>
        <GuestReservationsTable :reservations="stays" />
      </section>

      <!-- Related links -->
      <div v-if="relatedConversation || relatedGuide" class="flex flex-wrap items-center gap-2">
        <span class="text-sm font-semibold uppercase tracking-wide text-muted-foreground mr-2">
          Quick links
        </span>
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
          Payment Requests
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
