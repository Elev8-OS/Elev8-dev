<script setup lang="ts">
import type { ReservationEntry, ReservationStatus } from '~/components/reservations/data/reservations'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import BasePersonAvatar from '~/components/base/PersonAvatar.vue'
import { listings } from '~/components/listings/data/listings'
import PaymentRequestCreateDialog from '~/components/payment-request/PaymentRequestCreateDialog.vue'
import { reservationStatusLabels } from '~/components/reservations/data/reservations'
import EditReservationDialog from '~/components/reservations/EditReservationDialog.vue'
import GuestActivityTimeline from '~/components/reservations/GuestActivityTimeline.vue'
import GuestNotes from '~/components/reservations/GuestNotes.vue'
import GuestPaymentRequests from '~/components/reservations/GuestPaymentRequests.vue'
import GuestReservationsTable from '~/components/reservations/GuestReservationsTable.vue'
import GuestUpsells from '~/components/reservations/GuestUpsells.vue'
import NewReservationDialog from '~/components/reservations/NewReservationDialog.vue'
import ReservationDetailSheet from '~/components/reservations/ReservationDetailSheet.vue'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'
import { useGuestGuideLinks } from '~/composables/useGuestGuideLinks'
import { useInbox } from '~/composables/useInbox'
import { usePaymentRequests } from '~/composables/usePaymentRequests'
import { useReservationsModule } from '~/composables/useReservationsModule'
import { useUpsellOrders } from '~/composables/useUpsellOrders'

const route = useRoute()
const router = useRouter()

const {
  getGuestById,
  getReservationsForGuest,
  updateGuestNotes,
} = useReservationsModule()
const { requests } = usePaymentRequests()
const { orders: upsellOrders } = useUpsellOrders()
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

// Primary (most relevant) stay, shown in the Booking Info card
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

// Picking a stay from Booking History opens its detail sheet, which is where
// that stay's price breakdown and its folio (Charges & extras) live. The sheet
// re-resolves the reservation from live state, so a posting made in it shows up
// here without this page having to refresh anything.
const detailStay = ref<ReservationEntry | null>(null)
const detailOpen = ref(false)

function openStayDetail(reservation: ReservationEntry) {
  detailStay.value = reservation
  detailOpen.value = true
}

// Upsells — merged from stays
const upsells = computed(() => stays.value.flatMap(r => r.upsellIds ?? []))
// Resolved orders, so the tab badge counts what the tab will actually list
// rather than every id, including any that no longer resolve to an order.
const linkedUpsellOrders = computed(() => upsellOrders.value.filter(o => upsells.value.includes(o.id)))

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
const editReservationOpen = ref(false)
const newPaymentRequestOpen = ref(false)

// The created request lands in the shared payment-request store, and
// guestPaymentRequests matches on this guest's email, so a request raised here
// shows up in the tab without this page tracking it separately.
function handlePaymentRequestCreated() {
  toast.success('Payment request created')
}

// Party summary from occupants, e.g. "2 Adults · 1 Child · 1 Infant"
const partySummary = computed(() => {
  const guests = primaryStay.value?.guests ?? []
  if (!guests.length)
    return `${primaryStay.value?.guestCount ?? 0} guests`
  const adults = guests.filter(g => g.category === 'adult').length
  const children = guests.filter(g => g.category === 'child').length
  const infants = guests.filter(g => g.category === 'infant').length
  const parts: string[] = []
  if (adults)
    parts.push(`${adults} Adult${adults > 1 ? 's' : ''}`)
  if (children)
    parts.push(`${children} Child${children > 1 ? 'ren' : ''}`)
  if (infants)
    parts.push(`${infants} Infant${infants > 1 ? 's' : ''}`)
  return parts.join(' · ')
})

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
    owner_request: 'bg-violet-500/10 text-violet-700 border-violet-500/40',
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

      <!-- Top row: Profile, then Booking Info with the booked room inside it -->
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
              <BasePersonAvatar :name="guest.name" class="size-12" text-class="text-sm" />
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
                <p class="text-xs text-muted-foreground">
                  Joined
                </p>
                <p class="font-medium">
                  {{ fmtDate(guest.createdAt) }}
                </p>
              </div>
              <div>
                <p class="text-xs text-muted-foreground">
                  Previous stays
                </p>
                <p class="font-medium">
                  {{ guest.previousStays }}
                </p>
              </div>
              <div>
                <p class="text-xs text-muted-foreground">
                  Total spent
                </p>
                <p class="font-medium">
                  {{ fmtCurrency(totalSpent, spentCurrency) }}
                </p>
              </div>
              <div>
                <p class="text-xs text-muted-foreground">
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

        <!-- Booking Info card, with the booked room as a column inside it -->
        <Card class="md:col-span-2">
          <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle class="text-base">
              Booking Info
            </CardTitle>
            <div class="flex items-center gap-1.5">
              <Badge variant="outline" :class="reservationStatusMeta(primaryStay?.status)">
                {{ primaryStay ? reservationStatusLabels[primaryStay.status] : 'No booking' }}
              </Badge>
              <Button v-if="primaryStay" variant="ghost" size="sm" class="h-7 w-7 p-0" title="Edit reservation" @click="editReservationOpen = true">
                <Icon name="lucide:pencil" class="size-3.5" />
                <span class="sr-only">Edit</span>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <template v-if="primaryStay">
              <div class="grid gap-6 sm:grid-cols-2">
                <!-- Booking detail -->
                <div class="space-y-4">
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

                  <!-- Party breakdown -->
                  <div v-if="primaryStay.guests?.length" class="flex items-center gap-3">
                    <div class="flex -space-x-2">
                      <BasePersonAvatar
                        v-for="g in primaryStay.guests.slice(0, 4)"
                        :key="g.id"
                        :name="g.name"
                        class="size-8 border-2 border-background"
                        text-class="text-[10px]"
                      />
                      <span
                        v-if="primaryStay.guests.length > 4"
                        class="flex size-8 items-center justify-center rounded-full border-2 border-background bg-muted text-[10px] font-medium text-muted-foreground"
                      >
                        +{{ primaryStay.guests.length - 4 }}
                      </span>
                    </div>
                    <div class="text-xs text-muted-foreground">
                      <p class="font-medium text-foreground">
                        {{ partySummary }}
                      </p>
                      <p>
                        {{ primaryStay.guests.map(g => g.name).join(', ') }}
                      </p>
                    </div>
                  </div>
                  <Separator />
                  <div class="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p class="text-xs text-muted-foreground">
                        Channel
                      </p>
                      <p class="font-medium">
                        {{ primaryStay.channel }}
                      </p>
                    </div>
                    <div>
                      <p class="text-xs text-muted-foreground">
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
                </div>

                <!-- The booked room, formerly its own card -->
                <div class="space-y-3">
                  <div class="flex items-center justify-between">
                    <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Room
                    </p>
                    <Button variant="link" size="sm" class="h-auto p-0 text-xs" as-child>
                      <NuxtLink :to="`/listings/${primaryStay.listingId}`">
                        View detail
                      </NuxtLink>
                    </Button>
                  </div>
                  <div class="flex h-28 w-full items-center justify-center overflow-hidden rounded-md border bg-muted/40">
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
                </div>
              </div>
            </template>
            <p v-else class="text-sm text-muted-foreground italic">
              No active booking for this guest.
            </p>
          </CardContent>
        </Card>
      </div>

      <!-- Activity, booking history, payment requests and upsells: one card, four tabs -->
      <Tabs default-value="activity" class="space-y-4">
        <TabsList>
          <TabsTrigger value="activity">
            <Icon name="lucide:activity" class="mr-2 size-4" />
            Activity
            <Badge v-if="activity.length" variant="secondary" class="ml-2">
              {{ activity.length }}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="bookings">
            <Icon name="lucide:history" class="mr-2 size-4" />
            Booking History
            <Badge v-if="stays.length" variant="secondary" class="ml-2">
              {{ stays.length }}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="payments">
            <Icon name="lucide:link" class="mr-2 size-4" />
            Payment Requests
            <Badge v-if="guestPaymentRequests.length" variant="secondary" class="ml-2">
              {{ guestPaymentRequests.length }}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="upsells">
            <Icon name="lucide:tag" class="mr-2 size-4" />
            Upsells
            <Badge v-if="linkedUpsellOrders.length" variant="secondary" class="ml-2">
              {{ linkedUpsellOrders.length }}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="activity">
          <Card>
            <CardContent class="px-6 py-4">
              <GuestActivityTimeline :events="activity" bare />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bookings">
          <Card>
            <CardContent class="px-6 py-4">
              <GuestReservationsTable :reservations="stays" @open-detail="openStayDetail" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments">
          <Card>
            <CardContent class="px-6 py-4">
              <div class="mb-1 flex items-center justify-end">
                <Button variant="outline" size="sm" class="gap-1.5" @click="newPaymentRequestOpen = true">
                  <Icon name="lucide:plus" class="size-3.5" />
                  New payment request
                </Button>
              </div>
              <GuestPaymentRequests :requests="guestPaymentRequests" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="upsells">
          <Card>
            <CardContent class="px-6 py-4">
              <GuestUpsells :order-ids="upsells" />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <!-- Related links -->
      <div v-if="relatedConversation || relatedGuide" class="flex flex-wrap items-center gap-2">
        <span class="text-sm font-semibold text-muted-foreground mr-2">
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

      <!-- Notes -->
      <GuestNotes :notes="guest.notes" @save="saveNotes" />
    </div>

    <NewReservationDialog
      v-if="guest"
      v-model:open="newReservationOpen"
    />

    <EditReservationDialog
      v-if="primaryStay"
      :reservation="primaryStay"
      :open="editReservationOpen"
      @update:open="editReservationOpen = $event"
    />

    <PaymentRequestCreateDialog
      v-if="guest"
      v-model:open="newPaymentRequestOpen"
      :initial-guest="{ name: guest.name, email: guest.email, phone: guest.phone }"
      @created="handlePaymentRequestCreated"
    />

    <!-- The picked stay's price breakdown and folio -->
    <ReservationDetailSheet
      :reservation="detailStay"
      :open="detailOpen"
      @update:open="detailOpen = $event"
      @open-guest="detailOpen = false"
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
