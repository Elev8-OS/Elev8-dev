<script setup lang="ts">
import type { GuestDocument, ReservationEntry, ReservationStatus } from '~/components/reservations/data/reservations'
import { toast } from 'vue-sonner'
import { cleanerOptions } from '~/components/cleaning/data/cleaning-jobs'
import { reservationStatusLabels } from '~/components/reservations/data/reservations'
import EditReservationDialog from '~/components/reservations/EditReservationDialog.vue'
import GuestActivityTimeline from '~/components/reservations/GuestActivityTimeline.vue'
import ReservationStatusBadge from '~/components/reservations/ReservationStatusBadge.vue'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'
import { getOrderStatusMeta } from '~/components/upsells/data/upsell-orders'
import { useReservationsModule } from '~/composables/useReservationsModule'

const props = defineProps<{
  reservation: ReservationEntry | null
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'openGuest': [id: string]
}>()

const { reservations, updateReservationStatus } = useReservationsModule()
const { orders: upsellOrders } = useUpsellOrders()
const { jobs: cleaningJobs, createJob, deleteJob } = useCleaningJobs()

// Resolve the reservation from live state so status edits reflect immediately
const reservation = computed<ReservationEntry | null>(() => {
  if (!props.reservation)
    return null
  return reservations.value.find(r => r.id === props.reservation!.id) ?? props.reservation
})

// Upsell orders purchased for this reservation
const reservationUpsells = computed(() => {
  const r = reservation.value
  if (!r?.upsellIds?.length)
    return []
  return upsellOrders.value.filter(o => r.upsellIds!.includes(o.id))
})

const editOpen = ref(false)
const editGuestIndex = ref<number | null>(null)
const priceView = ref<'guest' | 'payout'>('guest')

// Party breakdown from occupants, e.g. "2 Adults · 1 Child · 1 Infant"
const partyBreakdown = computed(() => {
  const r = reservation.value
  const guests = r?.guests ?? []
  if (!guests.length)
    return `${r?.guestCount ?? 0} guests`
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

const statusOptions = Object.entries(reservationStatusLabels).map(([value, label]) => ({ value, label }))

const statusDotClass = computed(() => {
  const map: Record<ReservationStatus, string> = {
    unverified: 'bg-neutral-400',
    verified: 'bg-green-600',
    checked_in: 'bg-orange-500',
    checked_out: 'bg-blue-600',
    cancelled: 'bg-neutral-400',
    blocked: 'bg-black',
    inquiry: 'bg-amber-500',
    owner_request: 'bg-violet-500',
  }
  return reservation.value ? map[reservation.value.status] : 'bg-neutral-400'
})

const bookingNoteBody = computed(() => {
  const note = reservation.value?.bookingNote ?? ''
  const idx = note.indexOf('BOOKING NOTE :')
  return idx >= 0 ? note.slice(idx + 'BOOKING NOTE :'.length).trim() : note
})

// --- Identity verification ---
const docViewDoc = ref<GuestDocument | null>(null)

const identityDocs = computed(() => reservation.value?.identity?.documents ?? [])

const verifiedCount = computed(() => reservation.value?.guests?.filter(g => g.identityVerified).length ?? 0)

function docKindMeta(kind: GuestDocument['kind']) {
  const map: Record<GuestDocument['kind'], { label: string, icon: string }> = {
    id: { label: 'ID Document', icon: 'lucide:credit-card' },
    selfie: { label: 'Selfie', icon: 'lucide:camera' },
    signature: { label: 'Signature', icon: 'lucide:pen-line' },
    agreement: { label: 'House Rules Agreement', icon: 'lucide:file-check-2' },
  }
  return map[kind]
}

function fmtUploadTime(iso: string): string {
  if (!iso)
    return ''
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function onStatusChange(value: unknown) {
  if (!reservation.value)
    return
  const status = value as ReservationStatus
  updateReservationStatus(reservation.value.id, status)
  toast.success(`Status updated to ${reservationStatusLabels[status]}`)
}

const smartLock = useSmartLock()

// --- Guest registration (APOA / AVS Meldeschein) ---
const guestRegistration = useGuestRegistration()

const reservationRegistrations = computed(() => {
  const r = reservation.value
  if (!r)
    return []
  return guestRegistration.getRegistrationsForReservation(r.id)
})

function registrationStatusVariant(status: string) {
  switch (status) {
    case 'submitted': return 'default'
    case 'pending': return 'secondary'
    case 'failed': return 'destructive'
    case 'void': return 'outline'
    case 'incomplete': return 'secondary'
    default: return 'secondary'
  }
}

function registrationProviderLabel(provider: string) {
  return provider === 'apoa' ? 'APOA' : 'AVS Meldeschein'
}

const df = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })

function fmtDate(iso: string): string {
  return df.format(new Date(`${iso}T00:00:00Z`))
}

function fmtCurrency(amount: number, currency: string): string {
  return `${amount.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${currency}`
}

function channelIcon(channel: string): string {
  if (channel === 'Airbnb')
    return 'logos:airbnb'
  if (channel === 'Booking.com')
    return 'simple-icons:bookingdotcom'
  return 'lucide:globe'
}

function initials(name: string): string {
  return name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()
}

// --- Smart lock ---
function locksForListing(listingId: string) {
  return smartLock.getLocksForListing(listingId)
}

function codesForReservation(reservation: ReservationEntry) {
  return smartLock.codes.value
    .filter(c => c.reservationId === reservation.id && c.status === 'active')
    .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime())
}

const activeCodesCount = computed(() => {
  const r = reservation.value
  return r ? codesForReservation(r).length : 0
})

const generatingLockId = ref<string | null>(null)

async function generateCode(reservation: ReservationEntry, lockId: string) {
  if (generatingLockId.value)
    return
  generatingLockId.value = lockId
  try {
    const result = await smartLock.generateAccessCode({
      lockId,
      reservationId: reservation.id,
      guestName: reservation.guestName,
    })
    if (!result.success) {
      toast.error(result.error ?? 'Failed to generate code.')
      return
    }
    toast.success(`Access code generated: ${result.code!.code}`)
  }
  finally {
    generatingLockId.value = null
  }
}

function revokeCode(codeId: string) {
  smartLock.revokeAccessCode(codeId)
  toast.info('Access code revoked.')
}

async function copyCode(code: string) {
  try {
    await navigator.clipboard.writeText(code)
    toast.success('Code copied to clipboard.')
  }
  catch {
    toast.error(`Failed to copy. Code: ${code}`)
  }
}

function formatExpiry(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function categoryLabel(category: string): string {
  const map: Record<string, string> = { adult: 'Adult', child: 'Child', infant: 'Infant' }
  return map[category] ?? category
}

function idTypeLabel(type: string): string {
  const map: Record<string, string> = { passport: 'Passport', id_card: 'ID Card', drivers_license: 'Driver\'s License' }
  return map[type] ?? type
}

function editGuest(index: number) {
  editGuestIndex.value = index
  editOpen.value = true
}

function fmtDob(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

// --- Housekeeping schedule ---
const housekeepingJobs = computed(() => {
  const r = reservation.value
  if (!r)
    return []
  return cleaningJobs.value
    .filter(job => job.listingId === r.listingId && (job.reservationId === r.id || !job.reservationId))
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
})

const nextCleaning = computed(() => {
  const now = new Date().toISOString()
  return housekeepingJobs.value.find(job => job.scheduledAt >= now && !['done', 'cancelled', 'missed'].includes(job.status))
    ?? housekeepingJobs.value.find(job => job.scheduledAt >= now)
    ?? null
})

const addCleaningOpen = ref(false)
const newCleaningDate = ref('')
const newCleaningTime = ref('11:00')
const newCleaningAssignee = ref<string>('')

function openAddCleaning() {
  newCleaningDate.value = reservation.value?.checkOut?.slice(0, 10) ?? ''
  newCleaningTime.value = '11:00'
  newCleaningAssignee.value = ''
  addCleaningOpen.value = true
}

function addCleaning() {
  const r = reservation.value
  if (!r || !newCleaningDate.value)
    return
  const assignee = cleanerOptions.find(c => c.id === newCleaningAssignee.value)
  createJob({
    listingId: r.listingId,
    listingName: r.listingName,
    scheduledAt: `${newCleaningDate.value}T${newCleaningTime.value || '11:00'}:00`,
    cleanerIds: assignee ? [assignee.id] : [],
    cleanerNames: assignee ? [assignee.name] : [],
    teamName: 'Housekeeping',
    status: 'scheduled',
    priority: 'normal',
    durationMinutes: 180,
    notes: `Cleaning for reservation ${r.id}`,
    source: 'custom',
    reservationId: r.id,
    recurrence: null,
  })
  toast.success('Cleaning scheduled')
  addCleaningOpen.value = false
}

function removeCleaning(jobId: string) {
  deleteJob(jobId)
  toast.info('Cleaning removed')
}

function fmtCleaningDate(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <Sheet :open="open" @update:open="emit('update:open', $event)">
    <SheetContent class="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md" side="right">
      <template v-if="reservation">
        <ScrollArea class="h-full min-h-0 flex-1">
          <div class="flex flex-col">
            <!-- Header: status dropdown + channel + listing name -->
            <div class="flex items-start justify-between gap-3 border-b px-5 py-4">
              <div class="min-w-0">
                <NuxtLink :to="`/listings/${reservation.listingId}`" class="text-foreground hover:underline text-base font-semibold leading-tight">
                  {{ reservation.listingName }}
                </NuxtLink>
                <div class="mt-2">
                  <Select :model-value="reservation.status" @update:model-value="onStatusChange">
                    <SelectTrigger class="h-8 gap-2 border-0 bg-muted/60 px-3 text-sm font-semibold shadow-none hover:bg-muted">
                      <span class="inline-flex items-center gap-1.5 whitespace-nowrap">
                        <span class="size-2 shrink-0 rounded-full" :class="statusDotClass" />
                        {{ reservationStatusLabels[reservation.status] }}
                      </span>
                    </SelectTrigger>
                    <SelectContent class="min-w-[200px]">
                      <SelectItem v-for="opt in statusOptions" :key="opt.value" :value="opt.value" class="py-2.5">
                        <span class="flex items-center gap-2 whitespace-nowrap">
                          <ReservationStatusBadge :status="opt.value as ReservationStatus" />
                          <span class="ml-1">{{ opt.label }}</span>
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div class="flex shrink-0 items-center gap-2">
                <Button variant="outline" size="sm" class="h-8 w-8 p-0" title="Edit reservation" @click="editOpen = true">
                  <Icon name="lucide:pencil" class="size-3.5" />
                  <span class="sr-only">Edit</span>
                </Button>
                <div class="flex size-9 items-center justify-center border bg-muted/40">
                  <Icon :name="channelIcon(reservation.channel)" class="size-4" />
                </div>
              </div>
            </div>

            <!-- Reservation id + price (expandable) -->
            <Accordion type="single" collapsible class="w-full border-b px-2">
              <AccordionItem value="price" class="border-b-0">
                <AccordionTrigger class="px-3 py-3 hover:no-underline">
                  <span class="flex w-full items-center justify-between gap-3">
                    <span class="min-w-0 text-left">
                      <span class="block text-xs text-muted-foreground">
                        Reservation
                      </span>
                      <span class="block font-mono text-sm font-semibold">
                        {{ reservation.id }}
                      </span>
                    </span>
                    <span class="text-right">
                      <span class="block text-xs text-muted-foreground">
                        {{ priceView === 'guest' ? 'Guest paid' : 'Payout' }}
                      </span>
                      <span class="block text-xl font-bold">
                        {{ priceView === 'guest'
                          ? fmtCurrency(reservation.priceDetails?.guestPaid ?? reservation.totalPrice, reservation.currency)
                          : fmtCurrency(reservation.priceDetails?.payout ?? reservation.totalPrice, reservation.currency) }}
                      </span>
                    </span>
                  </span>
                </AccordionTrigger>
                <AccordionContent class="px-3 pb-3">
                  <!-- View toggle -->
                  <div v-if="reservation.priceDetails" class="mb-3 flex rounded-md border bg-muted/40 p-0.5">
                    <button
                      type="button"
                      class="flex-1 rounded-sm px-3 py-1.5 text-xs font-medium transition-colors"
                      :class="priceView === 'guest' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'"
                      @click="priceView = 'guest'"
                    >
                      Guest paid
                    </button>
                    <button
                      type="button"
                      class="flex-1 rounded-sm px-3 py-1.5 text-xs font-medium transition-colors"
                      :class="priceView === 'payout' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'"
                      @click="priceView = 'payout'"
                    >
                      Payout
                    </button>
                  </div>

                  <!-- Price breakdown -->
                  <template v-if="reservation.priceDetails">
                    <div class="space-y-1.5 text-sm">
                      <div class="flex items-center justify-between">
                        <span class="text-muted-foreground">Subtotal ({{ reservation.nights }} nights)</span>
                        <span class="font-medium">{{ fmtCurrency(reservation.priceDetails.subtotal, reservation.currency) }}</span>
                      </div>
                      <div v-if="reservation.priceDetails.cleaningFee" class="flex items-center justify-between">
                        <span class="text-muted-foreground">Cleaning fee</span>
                        <span class="font-medium">{{ fmtCurrency(reservation.priceDetails.cleaningFee, reservation.currency) }}</span>
                      </div>
                      <div v-if="reservation.priceDetails.serviceFee" class="flex items-center justify-between">
                        <span class="text-muted-foreground">Service fee</span>
                        <span class="font-medium">{{ fmtCurrency(reservation.priceDetails.serviceFee, reservation.currency) }}</span>
                      </div>
                      <div v-if="reservation.priceDetails.tax" class="flex items-center justify-between">
                        <span class="text-muted-foreground">Tax</span>
                        <span class="font-medium">{{ fmtCurrency(reservation.priceDetails.tax, reservation.currency) }}</span>
                      </div>
                      <div v-if="reservation.priceDetails.extras" class="flex items-center justify-between">
                        <span class="text-muted-foreground">Extras</span>
                        <span class="font-medium">{{ fmtCurrency(reservation.priceDetails.extras, reservation.currency) }}</span>
                      </div>
                      <Separator class="my-1.5" />
                      <!-- Guest paid view -->
                      <template v-if="priceView === 'guest'">
                        <div class="flex items-center justify-between font-medium">
                          <span>Guest paid</span>
                          <span>{{ fmtCurrency(reservation.priceDetails.guestPaid, reservation.currency) }}</span>
                        </div>
                      </template>
                      <!-- Payout view -->
                      <template v-else>
                        <div class="flex items-center justify-between text-muted-foreground">
                          <span>Guest paid</span>
                          <span>{{ fmtCurrency(reservation.priceDetails.guestPaid, reservation.currency) }}</span>
                        </div>
                        <div class="flex items-center justify-between text-muted-foreground">
                          <span class="flex items-center gap-1.5">
                            <Icon name="lucide:percent" class="size-3" />
                            Commission ({{ reservation.channel }})
                          </span>
                          <span>− {{ fmtCurrency(reservation.priceDetails.commission, reservation.currency) }}</span>
                        </div>
                        <div class="flex items-center justify-between rounded-md bg-green-500/10 px-2 py-1.5 font-semibold text-green-700 dark:text-green-400">
                          <span>Payout</span>
                          <span>{{ fmtCurrency(reservation.priceDetails.payout, reservation.currency) }}</span>
                        </div>
                      </template>
                    </div>
                  </template>
                  <p v-else class="text-sm text-muted-foreground">
                    {{ fmtCurrency(reservation.totalPrice, reservation.currency) }}
                  </p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <!-- Guest -->
            <div class="border-b px-5 py-4">
              <div class="flex items-center gap-3">
                <Avatar class="size-11">
                  <AvatarFallback class="bg-primary/10 text-primary text-sm">
                    {{ initials(reservation.guestName) }}
                  </AvatarFallback>
                </Avatar>
                <div class="min-w-0 flex-1">
                  <button
                    type="button"
                    class="block text-left hover:underline"
                    @click="emit('openGuest', reservation.guestId)"
                  >
                    <span class="font-semibold">{{ reservation.guestName }}</span>
                  </button>
                  <p class="text-xs text-muted-foreground truncate">
                    {{ reservation.guestEmail }} · {{ reservation.guestPhone }}
                  </p>
                </div>
              </div>
              <div class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span class="flex items-center gap-1.5">
                  <Icon name="lucide:users" class="size-3.5" />
                  {{ partyBreakdown }}
                </span>
                <span class="flex items-center gap-1.5">
                  <Icon :name="channelIcon(reservation.channel)" class="size-3.5" />
                  {{ reservation.channel }}
                </span>
              </div>
              <div v-if="reservation.guestNotes" class="mt-3 flex items-start gap-2 border-l-2 border-primary bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
                <Icon name="lucide:notebook-pen" class="mt-0.5 size-3.5 shrink-0" />
                {{ reservation.guestNotes }}
              </div>
            </div>

            <!-- Guests group (occupants) + identity & documents -->
            <Accordion v-if="reservation.guests?.length" type="single" collapsible class="w-full border-b px-2">
              <AccordionItem value="guests" class="border-b-0">
                <AccordionTrigger class="px-3 py-3 text-xs text-muted-foreground hover:no-underline">
                  <span class="flex items-center gap-2">
                    <Icon name="lucide:users" class="size-4" />
                    Guests
                    <Badge variant="secondary" class="h-4 min-w-4 px-1 text-[9px]">
                      {{ verifiedCount }}/{{ reservation.guests.length }} verified
                    </Badge>
                  </span>
                </AccordionTrigger>
                <AccordionContent class="px-3 pb-3">
                  <Tabs default-value="guests">
                    <TabsList class="w-full">
                      <TabsTrigger value="guests" class="flex-1">
                        Guests
                      </TabsTrigger>
                      <TabsTrigger value="documents" class="flex-1">
                        Identity & Documents
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="guests" class="mt-3">
                      <div class="space-y-2">
                        <div
                          v-for="(g, index) in reservation.guests"
                          :key="g.id"
                          class="border p-3"
                        >
                          <div class="flex items-center gap-2.5">
                            <Avatar class="size-9">
                              <AvatarFallback class="bg-primary/10 text-primary text-xs">
                                {{ initials(g.name) }}
                              </AvatarFallback>
                            </Avatar>
                            <div class="min-w-0 flex-1">
                              <div class="flex items-center gap-1.5">
                                <p class="text-sm font-medium truncate">
                                  {{ g.name }}
                                </p>
                                <Badge v-if="g.isPrimary" variant="default" class="text-[9px] px-1 py-0">
                                  Main
                                </Badge>
                                <Badge
                                  v-if="g.identityVerified"
                                  variant="outline"
                                  class="border-green-500/40 bg-green-500/10 text-[9px] px-1 py-0 text-green-700 dark:text-green-400"
                                >
                                  <Icon name="lucide:badge-check" class="size-2.5" />
                                  Verified
                                </Badge>
                                <Badge
                                  v-else
                                  variant="outline"
                                  class="text-[9px] px-1 py-0 text-muted-foreground"
                                >
                                  Not verified
                                </Badge>
                              </div>
                              <p class="text-[10px] text-muted-foreground">
                                {{ categoryLabel(g.category) }}
                                <template v-if="g.dob">
                                  · {{ fmtDob(g.dob) }}
                                </template>
                                <template v-if="g.nationality">
                                  · {{ g.nationality }}
                                </template>
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              class="h-7 w-7 shrink-0 p-0"
                              title="Edit guest info"
                              @click="editGuest(index)"
                            >
                              <Icon name="lucide:pencil" class="size-3.5" />
                              <span class="sr-only">Edit {{ g.name }}</span>
                            </Button>
                          </div>
                          <div class="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                            <p v-if="g.email" class="flex items-center gap-1.5 truncate">
                              <Icon name="lucide:mail" class="size-3 shrink-0" />
                              {{ g.email }}
                            </p>
                            <p v-if="g.phone" class="flex items-center gap-1.5 truncate">
                              <Icon name="lucide:phone" class="size-3 shrink-0" />
                              {{ g.phone }}
                            </p>
                            <p v-if="g.idType" class="flex items-center gap-1.5">
                              <Icon name="lucide:credit-card" class="size-3 shrink-0" />
                              {{ idTypeLabel(g.idType) }}: {{ g.idNumber }}
                            </p>
                          </div>
                        </div>
                      </div>
                    </TabsContent>
                    <TabsContent value="documents" class="mt-3">
                      <div v-if="identityDocs.length === 0" class="border border-dashed p-3 text-center text-xs text-muted-foreground">
                        No documents uploaded yet.
                      </div>

                      <div v-else class="space-y-2">
                        <div
                          v-for="doc in identityDocs"
                          :key="doc.id"
                          class="flex items-center gap-3 border p-2.5"
                        >
                          <div class="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted/60">
                            <Icon :name="docKindMeta(doc.kind).icon" class="size-4 text-muted-foreground" />
                          </div>
                          <div class="min-w-0 flex-1">
                            <p class="truncate text-sm font-medium">
                              {{ doc.name }}
                            </p>
                            <p class="text-[10px] text-muted-foreground">
                              {{ docKindMeta(doc.kind).label }}
                              <template v-if="doc.fileName">
                                · {{ doc.fileName }}
                              </template>
                              <template v-if="doc.uploadedAt">
                                · {{ fmtUploadTime(doc.uploadedAt) }}
                              </template>
                            </p>
                          </div>
                          <div class="flex shrink-0 items-center gap-1">
                            <Button variant="ghost" size="sm" class="h-7 w-7 p-0" title="Preview" @click="docViewDoc = doc">
                              <Icon name="lucide:eye" class="size-3.5" />
                            </Button>
                            <a v-if="doc.url" :href="doc.url" :download="doc.fileName ?? doc.name" class="shrink-0">
                              <Button variant="ghost" size="sm" class="h-7 w-7 p-0" title="Download">
                                <Icon name="lucide:download" class="size-3.5" />
                              </Button>
                            </a>
                          </div>
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <!-- Guest registration (APOA / AVS Meldeschein) -->
            <Accordion type="single" collapsible class="w-full border-b px-2">
              <AccordionItem value="guest-registration" class="border-b-0">
                <AccordionTrigger class="px-3 py-3 text-xs text-muted-foreground hover:no-underline">
                  <span class="flex items-center gap-2">
                    <Icon name="lucide:file-badge" class="size-4" />
                    Guest registration
                    <Badge v-if="reservationRegistrations.length" variant="secondary" class="h-4 min-w-4 px-1 text-[9px]">
                      {{ reservationRegistrations.length }}
                    </Badge>
                  </span>
                </AccordionTrigger>
                <AccordionContent class="px-3 pb-3">
                  <div
                    v-if="!guestRegistration.isConnected('apoa') && !guestRegistration.isConnected('avs')"
                    class="border border-dashed p-3 text-center"
                  >
                    <p class="text-xs text-muted-foreground">
                      No government registration provider connected.
                    </p>
                    <NuxtLink to="/settings/integrations" class="mt-1 inline-block text-xs text-primary underline">
                      Connect in Settings
                    </NuxtLink>
                  </div>

                  <div v-else-if="reservationRegistrations.length === 0" class="border border-dashed p-3 text-center text-xs text-muted-foreground">
                    No guest registrations for this reservation yet. They're created automatically after check-in.
                  </div>

                  <div v-else class="space-y-2">
                    <div
                      v-for="reg in reservationRegistrations"
                      :key="reg.id"
                      class="flex items-center justify-between gap-2 border p-3"
                    >
                      <div class="min-w-0 flex-1">
                        <p class="text-sm font-medium truncate">
                          {{ reg.guestName }}
                        </p>
                        <p class="text-[10px] text-muted-foreground">
                          {{ registrationProviderLabel(reg.provider) }}
                          <template v-if="reg.submissionId">
                            · {{ reg.submissionId }}
                          </template>
                        </p>
                      </div>
                      <Badge :variant="registrationStatusVariant(reg.status)" class="shrink-0 text-[10px]">
                        {{ reg.status }}
                      </Badge>
                    </div>
                    <NuxtLink to="/guest-registration" class="block text-center text-xs text-primary underline">
                      View all in Guest Registration
                    </NuxtLink>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <!-- Activity timeline -->
            <Accordion type="single" collapsible class="w-full border-b px-2">
              <AccordionItem value="activity" class="border-b-0">
                <AccordionTrigger class="px-3 py-3 text-xs text-muted-foreground hover:no-underline">
                  <span class="flex items-center gap-2">
                    <Icon name="lucide:activity" class="size-4" />
                    Activity
                    <Badge v-if="reservation.activity.length" variant="secondary" class="h-4 min-w-4 px-1 text-[9px]">
                      {{ reservation.activity.length }}
                    </Badge>
                  </span>
                </AccordionTrigger>
                <AccordionContent class="px-3 pb-3">
                  <GuestActivityTimeline :events="reservation.activity" bare />
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <!-- Dates -->
            <div class="border-b px-5 py-4">
              <div class="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <div>
                  <div class="text-xs text-muted-foreground">
                    Check-in
                  </div>
                  <div class="text-base font-semibold">
                    {{ fmtDate(reservation.checkIn) }}
                  </div>
                  <div class="text-xs text-muted-foreground">
                    2:00 PM
                  </div>
                </div>
                <div class="flex flex-col items-center gap-1">
                  <div class="flex h-9 w-9 items-center justify-center bg-primary/10 text-primary">
                    <Icon name="lucide:moon-star" class="size-4" />
                  </div>
                  <span class="text-[11px] font-medium text-muted-foreground">
                    {{ reservation.nights }} nights
                  </span>
                </div>
                <div class="text-right">
                  <div class="text-xs text-muted-foreground">
                    Check-out
                  </div>
                  <div class="text-base font-semibold">
                    {{ fmtDate(reservation.checkOut) }}
                  </div>
                  <div class="text-xs text-muted-foreground">
                    11:00 AM
                  </div>
                </div>
              </div>
            </div>

            <!-- Booking note (below dates) -->
            <div v-if="reservation.bookingNote" class="border-b px-5 py-4">
              <div class="border border-amber-400/60 bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
                <p class="font-semibold tracking-wide">
                  ** THIS RESERVATION HAS BEEN PRE-PAID **
                </p>
                <p class="mt-1.5 whitespace-pre-line leading-relaxed text-amber-800 dark:text-amber-200/90">
                  {{ bookingNoteBody }}
                </p>
              </div>
            </div>

            <!-- Upsells purchased by the guest (accordion) -->
            <Accordion type="single" collapsible class="w-full border-b px-2">
              <AccordionItem value="upsells" class="border-b-0">
                <AccordionTrigger class="px-3 py-3 text-xs text-muted-foreground hover:no-underline">
                  <span class="flex items-center gap-2">
                    <Icon name="lucide:tag" class="size-4" />
                    Upsells
                    <Badge v-if="reservationUpsells.length" variant="secondary" class="h-4 min-w-4 px-1 text-[9px]">
                      {{ reservationUpsells.length }}
                    </Badge>
                  </span>
                </AccordionTrigger>
                <AccordionContent class="px-3 pb-3">
                  <div v-if="reservationUpsells.length === 0" class="border border-dashed p-3 text-center text-xs text-muted-foreground">
                    No upsells purchased for this reservation.
                  </div>

                  <div v-else class="space-y-2">
                    <div
                      v-for="order in reservationUpsells"
                      :key="order.id"
                      class="flex items-center justify-between gap-3 border p-3"
                    >
                      <div class="min-w-0">
                        <p class="text-sm font-medium truncate">
                          {{ order.serviceName }}
                        </p>
                        <p class="text-[10px] text-muted-foreground">
                          {{ new Date(order.orderDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) }} · {{ order.guestName }}
                        </p>
                      </div>
                      <div class="flex shrink-0 items-center gap-2">
                        <Badge variant="outline" class="rounded-full" :class="getOrderStatusMeta(order).color">
                          {{ getOrderStatusMeta(order).label }}
                        </Badge>
                        <span class="text-sm font-semibold tabular-nums">
                          {{ fmtCurrency(order.grandTotal, order.currency) }}
                        </span>
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <!-- Smart lock (collapsible accordion) -->
            <Accordion type="single" collapsible class="w-full border-b px-2">
              <AccordionItem value="smartlock" class="border-b-0">
                <AccordionTrigger class="px-3 py-3 text-xs text-muted-foreground hover:no-underline">
                  <span class="flex items-center gap-2">
                    <Icon name="lucide:key-round" class="size-4" />
                    Smart lock
                    <Badge v-if="activeCodesCount" variant="secondary" class="h-4 min-w-4 px-1 text-[9px]">
                      {{ activeCodesCount }}
                    </Badge>
                  </span>
                </AccordionTrigger>
                <AccordionContent class="px-3 pb-3">
                  <div v-if="!smartLock.isConnected.value" class="border border-dashed p-3 text-center">
                    <p class="text-xs text-muted-foreground">
                      Smart Lock isn't connected.
                    </p>
                    <NuxtLink to="/settings/integrations" class="mt-1 inline-block text-xs text-primary underline">
                      Connect in Settings
                    </NuxtLink>
                  </div>

                  <div v-else-if="locksForListing(reservation.listingId).length === 0" class="border border-dashed p-3 text-center text-xs text-muted-foreground">
                    No smart locks paired to this listing.
                  </div>

                  <div v-else class="space-y-2">
                    <div
                      v-for="lock in locksForListing(reservation.listingId)"
                      :key="lock.id"
                      class="border p-3"
                    >
                      <div class="flex items-center gap-2">
                        <Icon
                          :name="lock.online ? 'lucide:lock' : 'lucide:lock-open'"
                          class="size-4 shrink-0"
                          :class="lock.online ? 'text-green-600' : 'text-muted-foreground'"
                        />
                        <div class="min-w-0 flex-1">
                          <p class="text-sm font-medium truncate">
                            {{ lock.name }}
                          </p>
                          <p class="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <Icon name="lucide:battery" class="size-2.5" :class="lock.batteryLevel <= 20 ? 'text-amber-500' : ''" />
                            {{ lock.batteryLevel }}%
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          class="h-7 gap-1 text-xs"
                          :disabled="!lock.online || generatingLockId === lock.id"
                          @click="generateCode(reservation, lock.id)"
                        >
                          <Icon
                            v-if="generatingLockId === lock.id"
                            name="lucide:loader-2"
                            class="size-3 animate-spin"
                          />
                          <Icon v-else name="lucide:plus" class="size-3" />
                          {{ generatingLockId === lock.id ? 'Generating…' : 'Generate code' }}
                        </Button>
                      </div>

                      <div
                        v-for="code in codesForReservation(reservation).filter(c => c.lockId === lock.id)"
                        :key="code.id"
                        class="mt-2 flex items-center justify-between gap-2 border bg-muted/30 p-2"
                      >
                        <div class="min-w-0 flex-1">
                          <p class="font-mono text-base font-bold tracking-widest">
                            {{ code.code }}
                          </p>
                          <p class="text-[10px] text-muted-foreground">
                            {{ code.guestName || 'Guest' }} · expires {{ formatExpiry(code.endsAt) }}
                          </p>
                        </div>
                        <div class="flex shrink-0 items-center gap-1">
                          <Button variant="ghost" size="sm" class="h-7 w-7 p-0" title="Copy code" @click="copyCode(code.code)">
                            <Icon name="lucide:copy" class="size-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" class="h-7 w-7 p-0 hover:text-destructive" title="Revoke" @click="revokeCode(code.id)">
                            <Icon name="lucide:trash-2" class="size-3.5" />
                          </Button>
                        </div>
                      </div>

                      <p v-if="codesForReservation(reservation).filter(c => c.lockId === lock.id).length === 0" class="mt-2 text-[10px] text-muted-foreground italic">
                        No active codes. Click "Generate code" to create one.
                      </p>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <!-- Housekeeping schedule (accordion) -->
            <Accordion type="single" collapsible class="w-full border-b px-2">
              <AccordionItem value="housekeeping" class="border-b-0">
                <AccordionTrigger class="px-3 py-3 text-xs text-muted-foreground hover:no-underline">
                  <span class="flex items-center gap-2">
                    <Icon name="lucide:sparkles" class="size-4" />
                    Housekeeping
                    <Badge v-if="housekeepingJobs.length" variant="secondary" class="h-4 min-w-4 px-1 text-[9px]">
                      {{ housekeepingJobs.length }}
                    </Badge>
                  </span>
                </AccordionTrigger>
                <AccordionContent class="px-3 pb-3">
                  <div v-if="!nextCleaning" class="border border-dashed p-3 text-center text-xs text-muted-foreground">
                    No upcoming cleaning scheduled.
                  </div>

                  <div v-else class="border p-3">
                    <div class="flex items-center justify-between gap-3">
                      <div class="min-w-0">
                        <p class="text-[10px] text-muted-foreground">
                          Next cleaning
                        </p>
                        <p class="mt-0.5 text-sm font-semibold">
                          {{ fmtCleaningDate(nextCleaning.scheduledAt) }}
                        </p>
                      </div>
                      <Badge variant="outline" class="shrink-0 text-[10px]">
                        {{ nextCleaning.status }}
                      </Badge>
                    </div>
                    <p v-if="nextCleaning.cleanerNames.length" class="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Icon name="lucide:user-round" class="size-3" />
                      {{ nextCleaning.cleanerNames.join(', ') }}
                    </p>
                  </div>

                  <!-- All scheduled cleanings -->
                  <div v-if="housekeepingJobs.length" class="mt-3 space-y-1.5">
                    <div
                      v-for="job in housekeepingJobs"
                      :key="job.id"
                      class="flex items-center justify-between gap-2 border bg-muted/20 px-2.5 py-1.5"
                    >
                      <div class="min-w-0">
                        <p class="truncate text-xs font-medium">
                          {{ fmtCleaningDate(job.scheduledAt) }}
                        </p>
                        <p v-if="job.cleanerNames.length" class="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Icon name="lucide:user-round" class="size-2.5" />
                          {{ job.cleanerNames.join(', ') }}
                        </p>
                      </div>
                      <div class="flex shrink-0 items-center gap-1">
                        <Badge variant="outline" class="text-[9px]">
                          {{ job.status }}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          class="h-6 w-6 p-0 hover:text-destructive"
                          title="Delete cleaning"
                          @click="removeCleaning(job.id)"
                        >
                          <Icon name="lucide:trash-2" class="size-3" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  <Button variant="outline" size="sm" class="mt-3 w-full gap-1.5" @click="openAddCleaning">
                    <Icon name="lucide:plus" class="size-3.5" />
                    Add cleaning
                  </Button>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <!-- Actions -->
            <div class="flex gap-2 px-5 py-4">
              <Button variant="outline" size="sm" class="flex-1 gap-1.5" @click="emit('openGuest', reservation.guestId)">
                <Icon name="lucide:user-round" class="size-3.5" />
                Guest profile
              </Button>
              <Button variant="outline" size="sm" class="flex-1 gap-1.5" as-child>
                <NuxtLink :to="`/listings/${reservation.listingId}`">
                  <Icon name="lucide:building-2" class="size-3.5" />
                  View listing
                </NuxtLink>
              </Button>
            </div>
          </div>
        </ScrollArea>
      </template>

      <template v-else>
        <SheetHeader class="border-b px-6 py-4">
          <SheetTitle>
            Reservation
          </SheetTitle>
        </SheetHeader>
        <div class="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
          No reservation selected.
        </div>
      </template>
    </SheetContent>
  </Sheet>

  <!-- Add cleaning dialog -->
  <Dialog :open="addCleaningOpen" @update:open="addCleaningOpen = $event">
    <DialogContent class="sm:max-w-sm">
      <DialogHeader>
        <DialogTitle>
          Schedule cleaning
        </DialogTitle>
        <DialogDescription>
          Add a housekeeping job for this reservation.
        </DialogDescription>
      </DialogHeader>
      <div class="grid gap-4 py-2">
        <div class="space-y-2">
          <Label>Date</Label>
          <Input v-model="newCleaningDate" type="date" />
        </div>
        <div class="space-y-2">
          <Label>Time</Label>
          <Input v-model="newCleaningTime" type="time" />
        </div>
        <div class="space-y-2">
          <Label>Assignee (optional)</Label>
          <Select v-model="newCleaningAssignee">
            <SelectTrigger>
              <SelectValue placeholder="Select assignee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">
                Unassigned
              </SelectItem>
              <SelectItem v-for="c in cleanerOptions" :key="c.id" :value="c.id">
                {{ c.name }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" @click="addCleaningOpen = false">
          Cancel
        </Button>
        <Button :disabled="!newCleaningDate" @click="addCleaning">
          Schedule
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- Edit reservation dialog -->
  <EditReservationDialog
    :reservation="reservation"
    :open="editOpen"
    :focus-guest-index="editGuestIndex"
    @update:open="editOpen = $event; if (!$event) editGuestIndex = null"
  />

  <!-- Document preview dialog -->
  <Dialog :open="!!docViewDoc" @update:open="docViewDoc = null">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>
          {{ docViewDoc?.name }}
        </DialogTitle>
        <DialogDescription v-if="docViewDoc">
          {{ docViewDoc?.kind ? docKindMeta(docViewDoc.kind).label : '' }}
          <template v-if="docViewDoc?.uploadedAt">
            · uploaded {{ fmtUploadTime(docViewDoc.uploadedAt) }}
          </template>
        </DialogDescription>
      </DialogHeader>
      <div class="py-2">
        <div v-if="docViewDoc?.url" class="flex items-center justify-center rounded-md border bg-muted/30 p-2">
          <img
            :src="docViewDoc.url"
            :alt="docViewDoc.name"
            class="max-h-80 w-auto rounded-sm object-contain"
          >
        </div>
        <p v-else class="py-8 text-center text-sm text-muted-foreground">
          No preview available for this document.
        </p>
      </div>
      <DialogFooter>
        <a v-if="docViewDoc?.url" :href="docViewDoc.url" :download="docViewDoc.fileName ?? docViewDoc.name">
          <Button class="gap-1.5">
            <Icon name="lucide:download" class="size-3.5" />
            Download
          </Button>
        </a>
        <Button variant="outline" @click="docViewDoc = null">
          Close
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
