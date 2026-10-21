<script setup lang="ts">
import type { GuestDocument, GuestOccupant, ReservationEntry, ReservationPaymentMethod, ReservationStatus } from '~/components/reservations/data/reservations'
import type { UpsellOrder } from '~/components/upsells/data/upsell-orders'
import { toast } from 'vue-sonner'
import DatePicker from '~/components/base/DatePicker.vue'
import BasePersonAvatar from '~/components/base/PersonAvatar.vue'
import { cleanerOptions } from '~/components/cleaning/data/cleaning-jobs'
import { everyGuestUploadsDocuments, listingGuestVerification } from '~/components/listings/data/guest-verification'
import { listings } from '~/components/listings/data/listings'
import { folioBookingTotal } from '~/components/reservations/data/folio'
import { guestRatingForReservation } from '~/components/reservations/data/guest-rating'
import { DOCUMENT_KIND_LABELS, manualPaymentMethods, reservationPaymentMethodLabels, reservationStatusLabels } from '~/components/reservations/data/reservations'
import EditReservationDialog from '~/components/reservations/EditReservationDialog.vue'
import GuestActivityTimeline from '~/components/reservations/GuestActivityTimeline.vue'
import ReservationCancelExtensionDialog from '~/components/reservations/ReservationCancelExtensionDialog.vue'
import ReservationCityTaxSection from '~/components/reservations/ReservationCityTaxSection.vue'
import ReservationDamageProtectionSection from '~/components/reservations/ReservationDamageProtectionSection.vue'
import ReservationExtensionsSection from '~/components/reservations/ReservationExtensionsSection.vue'
import ReservationFolioSection from '~/components/reservations/ReservationFolioSection.vue'
import ReservationGuestRatingSection from '~/components/reservations/ReservationGuestRatingSection.vue'
import ReservationHousekeepingSection from '~/components/reservations/ReservationHousekeepingSection.vue'
import ReservationModifyMenu from '~/components/reservations/ReservationModifyMenu.vue'
import ReservationStatusBadge from '~/components/reservations/ReservationStatusBadge.vue'
import { Button } from '~/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '~/components/ui/dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '~/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '~/components/ui/tooltip'
import { getOrderStatus, getOrderStatusMeta } from '~/components/upsells/data/upsell-orders'
import UpsellOrderDrawer from '~/components/upsells/UpsellOrderDrawer.vue'
import { useCleaningJobs } from '~/composables/useCleaningJobs'
import { useGuestRegistration } from '~/composables/useGuestRegistration'
import { useInbox } from '~/composables/useInbox'
import { useReservationsModule } from '~/composables/useReservationsModule'
import { useSmartLock } from '~/composables/useSmartLock'
import { useUpsellOrders } from '~/composables/useUpsellOrders'
import { buildFolioInvoicePdf } from '~/lib/folio-invoice-pdf'
import { buildHouseRulesAgreementPdf, houseRulesAgreementInput } from '~/lib/house-rules-agreement-pdf'

const props = defineProps<{
  reservation: ReservationEntry | null
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'openGuest': [id: string]
}>()

const { requests: paymentRequests, cancelRequest: cancelPaymentRequest } = usePaymentRequests()
const { reservations, markReservationPaid, updateReservationStatus, getCheckInTime, getCheckOutTime, saveGuestDocument, removeGuestDocument } = useReservationsModule()
const inbox = useInbox()

/**
 * The reservation's conversation, or an email one on the guest's address when
 * it has none. Disabled only when there is neither: nobody to write to.
 */
const hasConversation = computed(() =>
  Boolean(props.reservation && inbox.conversations.value.some(c => c.reservationId === props.reservation!.id)))
const canOpenInbox = computed(() => hasConversation.value || Boolean(props.reservation?.guestEmail?.trim()))

function openInInbox() {
  if (!props.reservation)
    return
  const opened = inbox.openForReservation(props.reservation)
  if (!opened) {
    toast.error('This guest has no conversation and no email address yet.')
    return
  }
  if (opened.created)
    toast.info(`Started an email conversation with ${props.reservation.guestName}`)
  emit('update:open', false)
  navigateTo('/inbox')
}
const { orders: upsellOrders } = useUpsellOrders()

// Resolve the reservation from live state so status edits reflect immediately
const reservation = computed<ReservationEntry | null>(() => {
  if (!props.reservation)
    return null
  return reservations.value.find(r => r.id === props.reservation!.id) ?? props.reservation
})

function localToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const markPaidMethod = ref<ReservationPaymentMethod>('bank_transfer')
const markPaidAmount = ref(0)
const markPaidOn = ref<string | null>(localToday())
const bookingTotal = computed(() => reservation.value ? folioBookingTotal(reservation.value) : 0)
const balance = computed(() => Math.max(Math.round((bookingTotal.value - (reservation.value?.priceDetails?.guestPaid ?? 0)) * 100) / 100, 0))
const canMarkPaid = computed(() => {
  const r = reservation.value
  if (!r?.priceDetails || ['blocked', 'owner_request', 'cancelled'].includes(r.status) || r.paidAt)
    return false
  return bookingTotal.value > 0 && balance.value > 0
})
const markPaidIsFull = computed(() => markPaidAmount.value >= balance.value)
const markPaidError = computed(() => {
  if (!(markPaidAmount.value > 0))
    return 'Enter an amount above 0.'
  if (markPaidAmount.value > balance.value)
    return 'That is more than the balance due.'
  if (!markPaidOn.value)
    return 'Pick the date the money arrived.'
  if (markPaidOn.value > localToday())
    return 'The payment date cannot be in the future.'
  return ''
})

// Each stay starts from its own defaults, not from the last one looked at.
watch(() => reservation.value?.id, () => {
  markPaidMethod.value = 'bank_transfer'
  markPaidOn.value = localToday()
  markPaidAmount.value = balance.value
}, { immediate: true })
// After a partial payment the box offers what is left.
watch(balance, (left) => { markPaidAmount.value = left })

// A link still open for this stay would let the guest pay a second time.
const openPaymentRequest = computed(() => {
  const id = reservation.value?.paymentRequestId
  return id ? paymentRequests.value.find(p => p.id === id && p.status === 'pending') : undefined
})

// The guest already paid the link: settle the stay with it instead of asking staff to repeat it.
const paidPaymentRequest = computed(() => {
  const id = reservation.value?.paymentRequestId
  return id ? paymentRequests.value.find(p => p.id === id && p.status === 'paid') : undefined
})
watch([paidPaymentRequest, () => reservation.value?.id], ([paid]) => {
  const r = reservation.value
  if (paid && r && !r.paidAt && !['blocked', 'owner_request', 'cancelled'].includes(r.status))
    markReservationPaid(r.id, 'payment_link')
}, { immediate: true })

function markPaid() {
  const r = reservation.value
  if (!r)
    return
  if (markPaidError.value) {
    toast.error(markPaidError.value)
    return
  }
  const full = markPaidIsFull.value
  const request = openPaymentRequest.value
  // Only paying everything retires the link: a part payment leaves it for the rest.
  const cancelsLink = Boolean(request) && full
  const method = markPaidMethod.value
  if (!markReservationPaid(r.id, method, { amount: markPaidAmount.value, paidOn: markPaidOn.value ?? undefined, linkCancelled: cancelsLink })) {
    toast.error('Could not record the payment.')
    return
  }
  if (request && cancelsLink)
    cancelPaymentRequest(request.id, `Marked as paid via ${reservationPaymentMethodLabels[method]}`)
  toast.success(full ? `Marked as paid via ${reservationPaymentMethodLabels[method]}` : `Partial payment recorded via ${reservationPaymentMethodLabels[method]}`)
}

// Upsell orders for this reservation: linked by the order's own reservationId,
// plus any listed on the reservation's legacy `upsellIds`. Newest service date first.
const reservationUpsells = computed(() => {
  const r = reservation.value
  if (!r)
    return []
  const legacyIds = new Set(r.upsellIds ?? [])
  return upsellOrders.value
    .filter(o => o.reservationId === r.id || legacyIds.has(o.id))
    .sort((a, b) => b.serviceDate.localeCompare(a.serviceDate))
})

const selectedUpsellOrder = ref<UpsellOrder | null>(null)
const upsellOrderDrawerOpen = ref(false)

function openUpsellOrder(order: UpsellOrder) {
  selectedUpsellOrder.value = order
  upsellOrderDrawerOpen.value = true
}

function fmtOrderDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(y!, m! - 1, d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

const { jobs: cleaningJobs } = useCleaningJobs()
const housekeepingJobs = computed(() => {
  const r = reservation.value
  if (!r)
    return []
  return cleaningJobs.value
    .filter(j => j.listingId === r.listingId)
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
})
const housekeepingCount = computed(() => housekeepingJobs.value.length)

// Shown once the guest has checked out and housekeeping has completed a rated cleaning.
const guestRating = computed(() =>
  reservation.value ? guestRatingForReservation(reservation.value, cleaningJobs.value) : null)

type ReservationTab = 'details' | 'charges' | 'activity' | 'upsells' | 'housekeeping' | 'guest_rating'
const activeTab = ref<ReservationTab>('details')

watch(guestRating, (rating) => {
  if (!rating && activeTab.value === 'guest_rating')
    activeTab.value = 'details'
})

function selectTab(tab: ReservationTab) {
  activeTab.value = tab
}

watch(() => props.open, (isOpen) => {
  if (!isOpen) {
    activeTab.value = 'details'
    upsellOrderDrawerOpen.value = false
  }
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

// Documents are grouped per guest. The listing's verification settings decide which
// slots each guest must fill: "Verify person", or "Verify group" with "All guests
// must upload documents" on, asks every guest for a selfie and ID; otherwise only
// the main guest uploads. Only the main guest (or the first one listed) ever signs.
// Anything uploaded beyond that still shows under its owner.
const verificationSettings = computed(() => {
  const r = reservation.value
  return listingGuestVerification(listings.value.find(l => l.id === r?.listingId))
})
const verificationMode = computed(() => verificationSettings.value.mode)
const verifyEveryGuest = computed(() => !!reservation.value?.guests?.length && everyGuestUploadsDocuments(verificationSettings.value))

interface DocSlot { kind: GuestDocument['kind'], doc?: GuestDocument }
interface DocGroup { guest: GuestOccupant | null, isMain: boolean, slots: DocSlot[], required: number }

const MAIN_GUEST_KINDS: GuestDocument['kind'][] = ['selfie', 'id', 'signature', 'agreement']

function requiredKinds(isMain: boolean): GuestDocument['kind'][] {
  if (verificationMode.value === 'none')
    return []
  if (isMain)
    return MAIN_GUEST_KINDS
  return verifyEveryGuest.value ? ['selfie', 'id'] : []
}

function slotsFor(owned: GuestDocument[], kinds: GuestDocument['kind'][]): DocSlot[] {
  const extra = owned.filter(d => !kinds.includes(d.kind)).map(doc => ({ kind: doc.kind, doc }))
  return [...kinds.map(kind => ({ kind, doc: owned.find(d => d.kind === kind) })), ...extra]
}

const docGroups = computed<DocGroup[]>(() => {
  const guests = reservation.value?.guests ?? []
  if (!guests.length) {
    const kinds = requiredKinds(true)
    return [{ guest: null, isMain: true, slots: slotsFor(identityDocs.value, kinds), required: kinds.length }]
  }
  const mainId = (guests.find(g => g.isPrimary) ?? guests[0])!.id
  return guests.map((guest) => {
    const isMain = guest.id === mainId
    const kinds = requiredKinds(isMain)
    const owned = identityDocs.value.filter(d => (d.guestId ?? mainId) === guest.id)
    return { guest, isMain, slots: slotsFor(owned, kinds), required: kinds.length }
  }).filter(g => g.slots.length)
})

const docsHint = computed(() => {
  if (verifyEveryGuest.value)
    return 'Every guest uploads a selfie and ID. Only the main guest signs the house rules.'
  if (verificationMode.value === 'group')
    return 'Only the main guest uploads documents and signs the house rules.'
  return null
})

// Staff can upload a missing document or replace / remove one. One hidden file
// input serves every slot; `pendingSlot` remembers which slot opened it.
const docFileInput = ref<HTMLInputElement | null>(null)
const pendingSlot = ref<{ group: DocGroup, kind: Exclude<GuestDocument['kind'], 'agreement'> } | null>(null)

function canEditDoc(kind: GuestDocument['kind']): kind is Exclude<GuestDocument['kind'], 'agreement'> {
  return kind !== 'agreement'
}

function pickDocFile(group: DocGroup, kind: GuestDocument['kind']) {
  if (!canEditDoc(kind))
    return
  pendingSlot.value = { group, kind }
  docFileInput.value?.click()
}

function onDocFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  const slot = pendingSlot.value
  input.value = ''
  pendingSlot.value = null
  if (!file || !slot || !reservation.value)
    return
  const reservationId = reservation.value.id
  const reader = new FileReader()
  reader.onload = () => {
    const result = saveGuestDocument(reservationId, {
      guestId: slot.group.isMain ? undefined : slot.group.guest?.id,
      kind: slot.kind,
      fileName: file.name,
      url: String(reader.result),
    })
    if (result.success)
      toast.success(`${docKindMeta(slot.kind).label} saved`)
    else
      toast.error(result.error ?? 'Could not save the document')
  }
  reader.onerror = () => toast.error('Could not read that file')
  reader.readAsDataURL(file)
}

function removeDoc(doc: GuestDocument) {
  if (!reservation.value)
    return
  removeGuestDocument(reservation.value.id, doc.id)
  toast.success(`${docKindMeta(doc.kind).label} removed`)
}

// The agreement is generated from the listing's house rules rather than stored,
// so preview and download always show a real PDF.
const { guides: guestGuides } = useGuestGuides()
const agreementPreviewUrl = ref<string | null>(null)

function agreementInput() {
  return reservation.value
    ? houseRulesAgreementInput(reservation.value, { listings: listings.value, guides: guestGuides.value })
    : null
}

function revokeAgreementPreview() {
  if (agreementPreviewUrl.value)
    URL.revokeObjectURL(agreementPreviewUrl.value)
  agreementPreviewUrl.value = null
}

function previewDoc(doc: GuestDocument) {
  revokeAgreementPreview()
  if (doc.kind === 'agreement') {
    const input = agreementInput()
    if (input) {
      try {
        agreementPreviewUrl.value = URL.createObjectURL(buildHouseRulesAgreementPdf(input))
      }
      catch (err) {
        console.error(err)
        toast.error('Failed to generate the house rules agreement')
      }
    }
  }
  docViewDoc.value = doc
}

function closeDocPreview() {
  revokeAgreementPreview()
  docViewDoc.value = null
}

function downloadAgreement() {
  const input = agreementInput()
  if (!input)
    return
  try {
    buildHouseRulesAgreementPdf(input, { download: true })
    toast.success('House rules agreement downloaded')
  }
  catch (err) {
    console.error(err)
    toast.error('Failed to generate the house rules agreement')
  }
}

onBeforeUnmount(revokeAgreementPreview)

const verifiedCount = computed(() => reservation.value?.guests?.filter(g => g.identityVerified).length ?? 0)

function docKindMeta(kind: GuestDocument['kind']) {
  const icons: Record<GuestDocument['kind'], string> = {
    id: 'lucide:credit-card',
    selfie: 'lucide:camera',
    signature: 'lucide:pen-line',
    agreement: 'lucide:file-check-2',
  }
  return { label: DOCUMENT_KIND_LABELS[kind], icon: icons[kind] }
}

function fmtUploadTime(iso: string): string {
  if (!iso)
    return ''
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
}

// Every cancel is confirmed first and runs through useStayExtension().cancelStay:
// linked bookings, payment links, cleanings, door codes and the guest message
// (see ReservationCancelExtensionDialog).
const cancelDialogOpen = ref(false)

function onStatusChange(value: unknown) {
  if (!reservation.value)
    return
  const status = value as ReservationStatus
  if (status === 'cancelled' && reservation.value.status !== 'cancelled') {
    cancelDialogOpen.value = true
    return
  }
  const others = updateReservationStatus(reservation.value.id, status).filter(id => id !== reservation.value!.id)
  toast.success(`Status updated to ${reservationStatusLabels[status]}`, others.length
    ? { description: `Linked booking${others.length === 1 ? '' : 's'} updated too: ${others.join(', ')}` }
    : undefined)
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
  if (provider === 'apoa')
    return 'APOA'
  if (provider === 'feratel')
    return 'Feratel'
  return 'AVS Meldeschein'
}

const df = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })

function fmtDate(iso: string): string {
  return df.format(new Date(`${iso}T00:00:00Z`))
}

function fmtPaidDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtCurrency(amount: number | undefined, currency: string): string {
  return `${currency} ${(amount ?? 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}`
}

function channelIcon(channel: string): string {
  if (channel === 'Airbnb')
    return 'logos:airbnb'
  if (channel === 'Booking.com')
    return 'simple-icons:bookingdotcom'
  return 'lucide:globe'
}

// --- Smart lock ---
function locksForListing(listingId: string) {
  return smartLock.getLocksForListing(listingId)
}

/**
 * Locks by room for a multi-room stay (plus any property-level lock), so each
 * room shows its own lock and codes. A single-room stay is one untitled group.
 */
const lockGroups = computed(() => {
  const r = reservation.value
  if (!r)
    return []
  if (!r.rooms?.length)
    return [{ key: 'listing', title: '', locks: locksForListing(r.listingId) }]
  const groups = r.rooms.map(room => ({ key: room.id, title: room.unitName, locks: smartLock.getLocksForUnit(r.listingId, room.unitId) }))
  const shared = locksForListing(r.listingId).filter(l => !l.unitId)
  return shared.length ? [...groups, { key: 'property', title: 'Property', locks: shared }] : groups
})

const hasAnyLock = computed(() => lockGroups.value.some(g => g.locks.length))

function roomLockLabel(unitId: string): string {
  const r = reservation.value
  if (!r || !smartLock.isConnected.value)
    return 'No smart lock'
  const names = smartLock.getLocksForUnit(r.listingId, unitId).map(l => l.name)
  return names.length ? names.join(', ') : 'No smart lock'
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
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
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

// No invoice for stays that are not a paid booking.
const canDownloadInvoice = computed(() =>
  Boolean(reservation.value) && !['inquiry', 'blocked', 'owner_request'].includes(reservation.value!.status))

function downloadInvoice() {
  if (!reservation.value)
    return
  try {
    buildFolioInvoicePdf(reservation.value, { download: true })
    toast.success('Invoice PDF downloaded')
  }
  catch (err) {
    console.error(err)
    toast.error('Failed to generate invoice PDF')
  }
}

const { findByReservation: findGuestGuideLink, findForRoom: findRoomGuideLink } = useGuestGuideLinks()

const guestGuideRoute = computed(() => {
  if (!reservation.value)
    return '/guest-guides'
  const link = findGuestGuideLink(reservation.value.id)
  if (link)
    return `/guest-guides/${link.guideId}`
  if (reservation.value.guestGuideId)
    return `/guest-guides/${reservation.value.guestGuideId}`
  const assignedGuide = guestGuides.value.find(g => g.assignedListingIds?.includes(reservation.value!.listingId))
  if (assignedGuide)
    return `/guest-guides/${assignedGuide.id}`
  return '/guest-guides'
})

/** A room's own guide link when it has one, else the stay's guide. */
function roomGuideRoute(unitId: string): string {
  const link = reservation.value ? findRoomGuideLink(reservation.value.id, unitId) : undefined
  return link ? `/guest-guides/${link.guideId}` : guestGuideRoute.value
}
</script>

<template>
  <div>
    <Sheet :open="open" @update:open="emit('update:open', $event)">
      <SheetContent
        class="flex w-full flex-row gap-0 overflow-hidden p-0 sm:max-w-lg [&>button:last-child]:top-0 [&>button:last-child]:right-0 [&>button:last-child]:h-14 [&>button:last-child]:w-12 [&>button:last-child]:flex [&>button:last-child]:items-center [&>button:last-child]:justify-center [&>button:last-child]:rounded-none"
        side="right"
      >
        <template v-if="reservation">
          <!-- Main pane -->
          <div class="min-w-0 flex-1 flex-col h-full overflow-hidden flex">
            <!-- Details view (default) -->
            <div v-if="activeTab === 'details'" class="flex flex-col h-full overflow-hidden">
              <!-- Header: status dropdown + Modify menu (edit / check-in time / extend) -->
              <div class="flex h-14 shrink-0 items-center justify-between gap-3 border-b px-5">
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

                <div class="flex items-center gap-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger as-child>
                        <!-- A span keeps the tooltip working while the button is disabled. -->
                        <span>
                          <Button
                            variant="outline"
                            size="sm"
                            class="h-8 gap-1.5 text-xs font-medium"
                            :disabled="!canOpenInbox"
                            data-testid="reservation-open-inbox"
                            @click="openInInbox"
                          >
                            <Icon name="lucide:message-square" class="size-3.5" />
                            <span>Inbox</span>
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        <p>
                          {{ hasConversation
                            ? 'Open the conversation with this guest'
                            : canOpenInbox
                              ? 'No conversation yet. Starts an email one with the guest'
                              : 'No conversation and no email address for this guest' }}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <ReservationModifyMenu
                    :reservation="reservation"
                    button-class="h-8 gap-1.5 text-xs font-medium"
                    @edit="editOpen = true"
                  />
                </div>
              </div>

              <ScrollArea class="h-full min-h-0 flex-1">
                <div class="flex flex-col">
                  <!-- Guest -->
                  <div class="border-b px-5 py-4">
                    <div class="flex items-center gap-3">
                      <BasePersonAvatar :name="reservation.guestName" class="size-11" text-class="text-sm" />
                      <div class="min-w-0 flex-1">
                        <button
                          type="button"
                          class="block text-left hover:underline"
                          @click="emit('openGuest', reservation.guestId)"
                        >
                          <span class="font-semibold">{{ reservation.guestName }}</span>
                        </button>
                        <p v-if="reservation.contactType === 'business' && reservation.companyName" class="flex items-center gap-1.5 text-xs font-medium truncate">
                          <Icon name="lucide:building-2" class="size-3.5 shrink-0 text-muted-foreground" />
                          {{ reservation.companyName }}<span v-if="reservation.companyVatId" class="text-muted-foreground font-normal">· {{ reservation.companyVatId }}</span>
                        </p>
                        <p class="text-xs text-muted-foreground truncate">
                          {{ reservation.guestEmail }} · {{ reservation.guestPhone }}
                        </p>
                      </div>
                    </div>

                    <div class="mt-3 space-y-1.5 text-xs text-muted-foreground">
                      <div class="flex items-center gap-1.5">
                        <Icon name="lucide:building-2" class="size-3.5 shrink-0 text-muted-foreground" />
                        <NuxtLink
                          :to="`/listings/${reservation.listingId}`"
                          class="font-medium text-foreground hover:underline truncate"
                        >
                          {{ reservation.listingName }}
                        </NuxtLink>
                      </div>
                      <div class="flex flex-wrap items-center gap-x-4 gap-y-1">
                        <span class="flex items-center gap-1.5">
                          <Icon name="lucide:users" class="size-3.5" />
                          {{ partyBreakdown }}
                        </span>
                        <span class="flex items-center gap-1.5">
                          <Icon :name="channelIcon(reservation.channel)" class="size-3.5" />
                          {{ reservation.channel }}
                        </span>
                      </div>
                      <!-- Frozen at booking: which website the guest booked on and the rule set that priced it. -->
                      <div v-if="reservation.channel === 'Direct' && reservation.websiteBooking" class="flex items-start gap-1.5" data-testid="reservation-website-booking">
                        <Icon name="lucide:monitor-smartphone" class="mt-0.5 size-3.5 shrink-0" />
                        <div class="min-w-0 space-y-0.5">
                          <p class="truncate">
                            Booked on <span class="font-medium text-foreground">{{ reservation.websiteBooking.websiteName }}</span> · {{ reservation.websiteBooking.websiteUrl }}
                          </p>
                          <p>{{ reservation.websiteBooking.ruleSetName ? `Rule set: ${reservation.websiteBooking.ruleSetName}` : 'No rule set' }}</p>
                          <p v-for="(d, i) in reservation.websiteBooking.discounts" :key="i">
                            {{ d.label }} · {{ fmtCurrency(d.amount, reservation.currency) }} off
                          </p>
                        </div>
                      </div>
                    </div>

                    <!-- Dates (Check-in / Check-out) -->
                    <div class="mt-4 border-t pt-4">
                      <div class="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                        <div>
                          <div class="text-xs text-muted-foreground">
                            Check-in
                          </div>
                          <div class="text-base font-semibold">
                            {{ fmtDate(reservation.checkIn) }}
                          </div>
                          <div class="text-xs text-muted-foreground" data-testid="reservation-checkin-time">
                            {{ getCheckInTime(reservation) }}
                          </div>
                        </div>
                        <div class="flex flex-col items-center gap-1">
                          <div class="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-foreground">
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
                            {{ getCheckOutTime(reservation) }}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div v-if="reservation.guestNotes" class="mt-4 flex items-start gap-2 border-l-2 border-primary bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
                      <Icon name="lucide:notebook-pen" class="mt-0.5 size-3.5 shrink-0" />
                      <span class="leading-relaxed">{{ reservation.guestNotes }}</span>
                    </div>

                    <div v-if="reservation.bookingNote" class="mt-2.5 border border-amber-400/60 bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
                      <p v-if="reservation.bookingNote.includes('PRE-PAID')" class="font-semibold tracking-wide">
                        ** THIS RESERVATION HAS BEEN PRE-PAID **
                      </p>
                      <p v-else class="font-semibold tracking-wide">
                        Booking Note
                      </p>
                      <p class="mt-1.5 whitespace-pre-line leading-relaxed text-amber-800 dark:text-amber-200/90">
                        {{ bookingNoteBody }}
                      </p>
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

                        <!-- Mark as paid -->
                        <div v-if="canMarkPaid" class="mt-3 space-y-3 rounded-md border bg-muted/40 p-3" data-testid="mark-paid">
                          <div class="flex items-center justify-between text-xs text-muted-foreground">
                            <span>Balance due</span>
                            <span class="font-medium text-foreground" data-testid="mark-paid-balance">{{ fmtCurrency(balance, reservation.currency) }}</span>
                          </div>
                          <div class="grid gap-3 sm:grid-cols-2">
                            <div class="space-y-1.5">
                              <Label class="text-xs">Amount</Label>
                              <div class="relative">
                                <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{{ reservation.currency }}</span>
                                <Input
                                  v-model.number="markPaidAmount"
                                  type="number"
                                  min="0"
                                  step="any"
                                  class="h-9 pl-14"
                                  aria-label="Amount received"
                                  data-testid="mark-paid-amount"
                                  :class="markPaidError && markPaidAmount !== balance ? 'border-destructive' : ''"
                                />
                              </div>
                            </div>
                            <div class="space-y-1.5">
                              <Label class="text-xs">Received on</Label>
                              <DatePicker v-model="markPaidOn" :max="localToday()" data-testid="mark-paid-date" />
                            </div>
                          </div>
                          <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <Select v-model="markPaidMethod">
                              <SelectTrigger class="h-9 sm:flex-1" aria-label="Payment method">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem v-for="value in manualPaymentMethods" :key="value" :value="value">
                                  {{ reservationPaymentMethodLabels[value] }}
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            <Button size="sm" class="h-9" data-testid="mark-paid-button" :disabled="Boolean(markPaidError)" @click="markPaid">
                              <Icon name="lucide:badge-check" class="size-4" />
                              {{ markPaidIsFull ? 'Mark as paid' : 'Record part payment' }}
                            </Button>
                          </div>
                          <p v-if="markPaidError" class="text-xs text-destructive" data-testid="mark-paid-error">
                            {{ markPaidError }}
                          </p>
                          <p v-if="openPaymentRequest" class="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-2.5 py-2 text-xs font-medium" data-testid="mark-paid-link-warning">
                            <Icon name="lucide:link" class="mt-0.5 size-3.5 shrink-0" />
                            {{ markPaidIsFull ? 'The payment link sent to the guest is still open. Marking as paid cancels it.' : 'The payment link sent to the guest stays open for the rest.' }}
                          </p>
                        </div>
                        <div v-else-if="reservation.paidAt && reservation.paymentMethod" class="mt-3 flex items-center gap-2 rounded-md bg-green-500/10 px-3 py-2 text-xs font-medium text-green-700 dark:text-green-400" data-testid="paid-via">
                          <Icon name="lucide:badge-check" class="size-4" />
                          Paid via {{ reservationPaymentMethodLabels[reservation.paymentMethod] }} on {{ fmtPaidDate(reservation.paidAt) }}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>

                  <!-- Rooms (multi-room booking) -->
                  <Accordion v-if="reservation.rooms?.length" type="single" collapsible class="w-full border-b px-2">
                    <AccordionItem value="rooms" class="border-b-0">
                      <AccordionTrigger class="px-3 py-3 text-xs text-muted-foreground hover:no-underline">
                        <span class="flex items-center gap-2">
                          <Icon name="lucide:door-open" class="size-4" />
                          Rooms
                          <Badge variant="secondary" class="h-4 min-w-4 px-1 text-[9px]">
                            {{ reservation.rooms.length }}
                          </Badge>
                          <Badge v-if="reservation.bookingMode === 'entire_property'" variant="outline" class="h-4 px-1 text-[9px]">
                            Entire property
                          </Badge>
                        </span>
                      </AccordionTrigger>
                      <AccordionContent class="px-3 pb-3">
                        <div class="space-y-2">
                          <div
                            v-for="room in reservation.rooms"
                            :key="room.id"
                            class="rounded-md border bg-muted/20 px-3 py-2"
                          >
                            <div class="flex items-center justify-between gap-2">
                              <div class="min-w-0">
                                <p class="text-sm font-medium">
                                  {{ room.unitName }}
                                </p>
                                <p class="text-xs text-muted-foreground">
                                  {{ room.rateLabel }}
                                  <template v-if="room.guestNames">
                                    · {{ room.guestNames }}
                                  </template>
                                </p>
                              </div>
                              <span class="shrink-0 text-sm font-medium">
                                {{ fmtCurrency(room.lineTotal, reservation.currency) }}
                              </span>
                            </div>
                            <div class="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                              <span>{{ fmtCurrency(room.pricePerNight, reservation.currency) }} × {{ reservation.nights }} nights</span>
                            </div>
                            <div class="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                              <span class="flex items-center gap-1" data-testid="room-lock">
                                <Icon name="lucide:key-round" class="size-3" />
                                {{ roomLockLabel(room.unitId) }}
                              </span>
                              <NuxtLink :to="roomGuideRoute(room.unitId)" class="flex items-center gap-1 text-primary hover:underline" data-testid="room-guide-link">
                                <Icon name="lucide:book-open" class="size-3" />
                                Guest guide
                              </NuxtLink>
                            </div>
                          </div>
                          <div v-if="reservation.paymentFeeMode && reservation.paymentFeeMode !== 'no_fee'" class="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2 text-xs">
                            <span class="text-muted-foreground">Payment charge</span>
                            <span class="font-medium">
                              {{ reservation.paymentFeeMode === 'card' ? 'Card (+3%)' : `Custom (${reservation.paymentCustomFeePct}%)` }}
                            </span>
                          </div>
                          <div v-for="charge in reservation.charges" :key="charge.id" class="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2 text-xs">
                            <span class="text-muted-foreground">{{ charge.label }}{{ charge.inclusive ? ' (included in price)' : '' }}</span>
                            <span class="font-medium">{{ fmtCurrency(charge.amount, reservation.currency) }}</span>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>

                  <!-- Extensions: added nights, their payment, the linked OTA stay -->
                  <ReservationExtensionsSection :reservation="reservation" />

                  <!-- City tax: what the municipality is owed on this stay -->
                  <ReservationCityTaxSection :reservation="reservation" />

                  <ReservationDamageProtectionSection :reservation="reservation" />

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
                                  <BasePersonAvatar :name="g.name" class="size-9" />
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
                            <input
                              ref="docFileInput"
                              type="file"
                              accept="image/*,application/pdf"
                              class="hidden"
                              data-testid="reservation-doc-file-input"
                              @change="onDocFileChange"
                            >
                            <div v-if="docGroups.length === 0" class="border border-dashed p-3 text-center text-xs text-muted-foreground">
                              No documents uploaded yet.
                            </div>

                            <div v-else class="space-y-3">
                              <p v-if="docsHint" class="flex items-start gap-1.5 text-[11px] text-muted-foreground" data-testid="reservation-docs-hint">
                                <Icon name="lucide:info" class="mt-px size-3 shrink-0" />
                                {{ docsHint }}
                              </p>
                              <div
                                v-for="group in docGroups"
                                :key="group.guest?.id ?? 'all'"
                                :class="group.guest && 'border'"
                                :data-testid="group.guest ? `reservation-docs-guest-${group.guest.id}` : undefined"
                              >
                                <div v-if="group.guest" class="flex items-center gap-2.5 border-b bg-muted/30 px-3 py-2">
                                  <BasePersonAvatar :name="group.guest.name" class="size-7" />
                                  <div class="min-w-0 flex-1">
                                    <div class="flex items-center gap-1.5">
                                      <p class="truncate text-sm font-medium">
                                        {{ group.guest.name }}
                                      </p>
                                      <Badge v-if="group.isMain" variant="default" class="text-[9px] px-1 py-0">
                                        Main
                                      </Badge>
                                    </div>
                                    <p class="text-[10px] text-muted-foreground">
                                      {{ categoryLabel(group.guest.category) }}
                                    </p>
                                  </div>
                                  <span class="shrink-0 text-[10px] text-muted-foreground">
                                    <template v-if="group.required">
                                      {{ group.slots.filter(s => s.doc).length }}/{{ group.slots.length }} uploaded
                                    </template>
                                    <template v-else>
                                      {{ group.slots.length }} {{ group.slots.length === 1 ? 'document' : 'documents' }}
                                    </template>
                                  </span>
                                </div>
                                <div class="space-y-2" :class="group.guest && 'p-2'">
                                  <div
                                    v-for="slot in group.slots"
                                    :key="slot.doc?.id ?? `${group.guest?.id}-${slot.kind}`"
                                    class="flex items-center gap-3 border p-2.5"
                                    :class="!slot.doc && 'border-dashed'"
                                  >
                                    <div class="flex size-9 shrink-0 items-center justify-center rounded-md" :class="slot.doc ? 'bg-muted/60' : 'bg-muted/40'">
                                      <Icon :name="docKindMeta(slot.kind).icon" class="size-4" :class="slot.doc ? 'text-muted-foreground' : 'text-muted-foreground/60'" />
                                    </div>
                                    <div class="min-w-0 flex-1">
                                      <template v-if="slot.doc">
                                        <p class="truncate text-sm font-medium">
                                          {{ slot.doc.name }}
                                        </p>
                                        <p class="text-[10px] text-muted-foreground">
                                          {{ docKindMeta(slot.doc.kind).label }}
                                          <template v-if="slot.doc.fileName">
                                            · {{ slot.doc.fileName }}
                                          </template>
                                          <template v-if="slot.doc.uploadedAt">
                                            · {{ fmtUploadTime(slot.doc.uploadedAt) }}
                                          </template>
                                        </p>
                                      </template>
                                      <template v-else>
                                        <p class="truncate text-sm text-muted-foreground">
                                          {{ docKindMeta(slot.kind).label }}
                                        </p>
                                        <p class="text-[10px] text-muted-foreground">
                                          {{ slot.kind === 'agreement' ? 'Not signed yet' : 'Not uploaded yet' }}
                                        </p>
                                      </template>
                                    </div>
                                    <div class="flex shrink-0 items-center gap-1">
                                      <template v-if="slot.doc">
                                        <Button variant="ghost" size="sm" class="h-7 w-7 p-0" title="Preview" aria-label="Preview" @click="previewDoc(slot.doc)">
                                          <Icon name="lucide:eye" class="size-3.5" />
                                        </Button>
                                        <Button
                                          v-if="slot.doc.kind === 'agreement'"
                                          variant="ghost"
                                          size="sm"
                                          class="h-7 w-7 p-0"
                                          title="Download"
                                          aria-label="Download house rules agreement"
                                          data-testid="reservation-download-agreement"
                                          @click="downloadAgreement"
                                        >
                                          <Icon name="lucide:download" class="size-3.5" />
                                        </Button>
                                        <a v-else-if="slot.doc.url" :href="slot.doc.url" :download="slot.doc.fileName ?? slot.doc.name" class="shrink-0">
                                          <Button variant="ghost" size="sm" class="h-7 w-7 p-0" title="Download" aria-label="Download">
                                            <Icon name="lucide:download" class="size-3.5" />
                                          </Button>
                                        </a>
                                        <DropdownMenu v-if="canEditDoc(slot.doc.kind)">
                                          <DropdownMenuTrigger as-child>
                                            <Button variant="ghost" size="sm" class="h-7 w-7 p-0" aria-label="Document actions" data-testid="reservation-doc-actions">
                                              <Icon name="lucide:ellipsis-vertical" class="size-3.5" />
                                            </Button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent align="end">
                                            <DropdownMenuItem data-testid="reservation-doc-replace" @click="pickDocFile(group, slot.kind)">
                                              <Icon name="lucide:refresh-cw" class="size-3.5" />
                                              Replace
                                            </DropdownMenuItem>
                                            <DropdownMenuItem class="text-destructive" data-testid="reservation-doc-remove" @click="removeDoc(slot.doc)">
                                              <Icon name="lucide:trash-2" class="size-3.5" />
                                              Remove
                                            </DropdownMenuItem>
                                          </DropdownMenuContent>
                                        </DropdownMenu>
                                      </template>
                                      <Button
                                        v-else-if="canEditDoc(slot.kind)"
                                        variant="outline"
                                        size="sm"
                                        class="h-7 gap-1 px-2 text-xs"
                                        data-testid="reservation-doc-upload"
                                        @click="pickDocFile(group, slot.kind)"
                                      >
                                        <Icon name="lucide:upload" class="size-3.5" />
                                        Upload
                                      </Button>
                                    </div>
                                  </div>
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
                          v-if="!guestRegistration.isConnected('apoa') && !guestRegistration.isConnected('avs') && !guestRegistration.isConnected('feratel')"
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

                        <div v-else-if="!hasAnyLock" class="border border-dashed p-3 text-center text-xs text-muted-foreground">
                          No smart locks paired to this listing.
                        </div>

                        <div v-else class="space-y-3">
                          <div v-for="group in lockGroups" :key="group.key" class="space-y-2" :data-testid="`lock-group-${group.key}`">
                            <p v-if="group.title" class="flex items-center gap-1.5 text-xs font-medium">
                              <Icon name="lucide:door-open" class="size-3.5 text-muted-foreground" />
                              {{ group.title }}
                            </p>
                            <p v-if="group.title && !group.locks.length" class="text-[10px] italic text-muted-foreground">
                              No lock paired to this room.
                            </p>
                            <div
                              v-for="lock in group.locks"
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
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>

                  <!-- Actions -->
                  <div class="flex flex-col gap-2 px-5 py-4">
                    <Button
                      v-if="canDownloadInvoice"
                      variant="outline"
                      size="sm"
                      class="w-full gap-1.5"
                      data-testid="reservation-download-invoice"
                      @click="downloadInvoice"
                    >
                      <Icon name="lucide:download" class="size-3.5" />
                      Download invoice
                    </Button>
                    <DropdownMenu v-if="(reservation.rooms?.length ?? 0) > 1">
                      <DropdownMenuTrigger as-child>
                        <Button variant="outline" size="sm" class="w-full gap-1.5" data-testid="view-guest-guide-menu">
                          <Icon name="lucide:book-open" class="size-3.5" />
                          View guest guide
                          <Icon name="lucide:chevron-down" class="size-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" class="w-64">
                        <DropdownMenuLabel>Guest guide per room</DropdownMenuLabel>
                        <DropdownMenuItem v-for="room in reservation.rooms" :key="room.id" as-child>
                          <NuxtLink :to="roomGuideRoute(room.unitId)" data-testid="guide-menu-room">
                            <Icon name="lucide:door-open" class="size-3.5" />
                            {{ room.unitName }}
                          </NuxtLink>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button v-else variant="outline" size="sm" class="w-full gap-1.5" as-child>
                      <NuxtLink :to="guestGuideRoute">
                        <Icon name="lucide:book-open" class="size-3.5" />
                        View guest guide
                      </NuxtLink>
                    </Button>
                  </div>
                </div>
              </ScrollArea>
            </div>

            <!-- 2. Charges & Extras Tab View -->
            <div v-else-if="activeTab === 'charges'" class="flex flex-col h-full">
              <div class="flex h-14 shrink-0 items-center justify-between border-b px-5 bg-muted/20">
                <div class="flex items-center gap-2">
                  <Icon name="lucide:receipt-text" class="size-4 text-foreground" />
                  <h3 class="text-sm font-semibold">
                    Charges & Extras
                  </h3>
                  <Badge v-if="reservation.folioItems?.length" variant="secondary" class="h-4 min-w-4 px-1.5 text-[10px]">
                    {{ reservation.folioItems.length }}
                  </Badge>
                </div>
              </div>
              <ScrollArea class="h-full min-h-0 flex-1">
                <div class="p-5">
                  <ReservationFolioSection
                    :reservation="reservation"
                    bare
                  />
                </div>
              </ScrollArea>
            </div>

            <!-- 3. Activity Tab View -->
            <div v-else-if="activeTab === 'activity'" class="flex flex-col h-full">
              <div class="flex h-14 shrink-0 items-center justify-between border-b px-5 bg-muted/20">
                <div class="flex items-center gap-2">
                  <Icon name="lucide:activity" class="size-4 text-foreground" />
                  <h3 class="text-sm font-semibold">
                    Activity Timeline
                  </h3>
                  <Badge v-if="reservation.activity?.length" variant="secondary" class="h-4 min-w-4 px-1.5 text-[10px]">
                    {{ reservation.activity.length }}
                  </Badge>
                </div>
              </div>
              <ScrollArea class="h-full min-h-0 flex-1">
                <div class="p-5">
                  <div v-if="!reservation.activity?.length" class="border border-dashed p-6 text-center text-xs text-muted-foreground">
                    No activity recorded for this reservation.
                  </div>
                  <GuestActivityTimeline v-else :events="reservation.activity" bare />
                </div>
              </ScrollArea>
            </div>

            <!-- 4. Upsells Tab View -->
            <div v-else-if="activeTab === 'upsells'" class="flex flex-col h-full">
              <div class="flex h-14 shrink-0 items-center justify-between border-b px-5 bg-muted/20">
                <div class="flex items-center gap-2">
                  <Icon name="lucide:tag" class="size-4 text-foreground" />
                  <h3 class="text-sm font-semibold">
                    Upsells
                  </h3>
                  <Badge v-if="reservationUpsells.length" variant="secondary" class="h-4 min-w-4 px-1.5 text-[10px]">
                    {{ reservationUpsells.length }}
                  </Badge>
                </div>
              </div>
              <ScrollArea class="h-full min-h-0 flex-1">
                <div class="p-5">
                  <div v-if="reservationUpsells.length === 0" class="border border-dashed p-6 text-center text-xs text-muted-foreground">
                    No upsells purchased for this reservation.
                  </div>
                  <div v-else class="space-y-2.5">
                    <button
                      v-for="order in reservationUpsells"
                      :key="order.id"
                      type="button"
                      class="w-full rounded-lg border bg-card p-3 text-left transition-colors hover:bg-muted/50"
                      data-testid="reservation-upsell-card"
                      @click="openUpsellOrder(order)"
                    >
                      <div class="flex items-start justify-between gap-3">
                        <div class="min-w-0">
                          <p class="truncate text-sm font-medium">
                            {{ order.serviceName }}
                          </p>
                          <p class="text-xs text-muted-foreground">
                            {{ order.items.length }} {{ order.items.length === 1 ? 'item' : 'items' }}
                          </p>
                        </div>
                        <Badge variant="secondary" class="shrink-0 text-xs" :class="getOrderStatusMeta(order).color">
                          {{ getOrderStatusMeta(order).label }}
                        </Badge>
                      </div>
                      <div class="mt-2.5 flex items-end justify-between gap-3 border-t pt-2.5">
                        <div class="min-w-0">
                          <p class="flex items-center gap-1.5 text-xs font-medium">
                            <Icon name="lucide:calendar" class="size-3.5 shrink-0 text-muted-foreground" />
                            <template v-if="order.serviceEndDate">
                              {{ fmtOrderDate(order.serviceDate) }} – {{ fmtOrderDate(order.serviceEndDate) }}
                            </template>
                            <template v-else>
                              {{ fmtOrderDate(order.serviceDate) }}
                            </template>
                          </p>
                          <p class="mt-0.5 text-[11px] text-muted-foreground">
                            Ordered {{ fmtOrderDate(order.orderDate) }}
                          </p>
                        </div>
                        <div class="flex shrink-0 items-center gap-1.5">
                          <span
                            class="text-sm font-semibold tabular-nums"
                            :class="getOrderStatus(order) === 'declined' ? 'text-muted-foreground line-through' : ''"
                          >
                            {{ fmtCurrency(order.grandTotal, order.currency) }}
                          </span>
                          <Icon name="lucide:chevron-right" class="size-4 text-muted-foreground" />
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
              </ScrollArea>
            </div>

            <!-- 5. Housekeeping Tab View -->
            <div v-else-if="activeTab === 'housekeeping'" class="flex flex-col h-full">
              <div class="flex h-14 shrink-0 items-center justify-between border-b px-5 bg-muted/20">
                <div class="flex items-center gap-2">
                  <Icon name="lucide:sparkles" class="size-4 text-foreground" />
                  <h3 class="text-sm font-semibold">
                    Housekeeping
                  </h3>
                  <Badge v-if="housekeepingCount" variant="secondary" class="h-4 min-w-4 px-1.5 text-[10px]">
                    {{ housekeepingCount }}
                  </Badge>
                </div>
              </div>
              <ScrollArea class="h-full min-h-0 flex-1">
                <div class="p-5">
                  <ReservationHousekeepingSection
                    :reservation="reservation"
                    :cleaner-options="cleanerOptions"
                    bare
                  />
                </div>
              </ScrollArea>
            </div>

            <!-- Guest rating Tab View (housekeeping's rating of the guest) -->
            <div v-else-if="activeTab === 'guest_rating' && guestRating" class="flex flex-col h-full">
              <div class="flex h-14 shrink-0 items-center justify-between border-b px-5 bg-muted/20">
                <div class="flex items-center gap-2">
                  <Icon name="lucide:star" class="size-4 text-foreground" />
                  <h3 class="text-sm font-semibold">
                    Guest rating
                  </h3>
                </div>
              </div>
              <ScrollArea class="h-full min-h-0 flex-1">
                <div class="p-5">
                  <ReservationGuestRatingSection :rating="guestRating" />
                </div>
              </ScrollArea>
            </div>
          </div>

          <!-- Icon Rail (Rightmost column) -->
          <div class="flex w-12 shrink-0 flex-col border-l bg-muted/20">
            <!-- Close button anchor cell (matches h-14 header with border-b) -->
            <div class="flex h-14 shrink-0 items-center justify-center border-b" />

            <div class="flex flex-col items-center gap-3 py-3">
              <!-- Details (Default) -->
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <button
                      type="button"
                      class="relative flex size-9 items-center justify-center rounded-md transition-colors"
                      :class="activeTab === 'details' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground'"
                      @click="selectTab('details')"
                    >
                      <Icon name="lucide:calendar-check" class="size-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="left">
                    <p>Reservation details</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <!-- Charges & Extras -->
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <button
                      type="button"
                      class="relative flex size-9 items-center justify-center rounded-md transition-colors"
                      :class="activeTab === 'charges' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground'"
                      @click="selectTab('charges')"
                    >
                      <Icon name="lucide:receipt-text" class="size-4" />
                      <span
                        v-if="reservation.folioItems?.length"
                        class="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold"
                        :class="activeTab === 'charges' ? 'bg-background text-foreground' : 'bg-primary text-primary-foreground'"
                      >
                        {{ reservation.folioItems.length }}
                      </span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="left">
                    <p>Charges & extras{{ reservation.folioItems?.length ? ` (${reservation.folioItems.length})` : '' }}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <!-- Activity -->
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <button
                      type="button"
                      class="relative flex size-9 items-center justify-center rounded-md transition-colors"
                      :class="activeTab === 'activity' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground'"
                      @click="selectTab('activity')"
                    >
                      <Icon name="lucide:activity" class="size-4" />
                      <span
                        v-if="reservation.activity?.length"
                        class="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold"
                        :class="activeTab === 'activity' ? 'bg-background text-foreground' : 'bg-primary text-primary-foreground'"
                      >
                        {{ reservation.activity.length }}
                      </span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="left">
                    <p>Activity ({{ reservation.activity?.length ?? 0 }})</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <!-- Upsells -->
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <button
                      type="button"
                      class="relative flex size-9 items-center justify-center rounded-md transition-colors"
                      :class="activeTab === 'upsells' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground'"
                      @click="selectTab('upsells')"
                    >
                      <Icon name="lucide:tag" class="size-4" />
                      <span
                        v-if="reservationUpsells.length"
                        class="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold"
                        :class="activeTab === 'upsells' ? 'bg-background text-foreground' : 'bg-primary text-primary-foreground'"
                      >
                        {{ reservationUpsells.length }}
                      </span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="left">
                    <p>Upsells ({{ reservationUpsells.length }})</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <!-- Housekeeping -->
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <button
                      type="button"
                      class="relative flex size-9 items-center justify-center rounded-md transition-colors"
                      :class="activeTab === 'housekeeping' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground'"
                      @click="selectTab('housekeeping')"
                    >
                      <Icon name="lucide:sparkles" class="size-4" />
                      <span
                        v-if="housekeepingCount"
                        class="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold"
                        :class="activeTab === 'housekeeping' ? 'bg-background text-foreground' : 'bg-primary text-primary-foreground'"
                      >
                        {{ housekeepingCount }}
                      </span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="left">
                    <p>Housekeeping ({{ housekeepingCount }})</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip v-if="guestRating">
                  <TooltipTrigger as-child>
                    <button
                      type="button"
                      class="relative flex size-9 items-center justify-center rounded-md transition-colors"
                      :class="activeTab === 'guest_rating' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground'"
                      aria-label="Guest rating"
                      data-testid="reservation-tab-guest-rating"
                      @click="selectTab('guest_rating')"
                    >
                      <Icon name="lucide:star" class="size-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="left">
                    <p>Guest rating ({{ guestRating.overall }} / 5)</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
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

    <ReservationCancelExtensionDialog v-model:open="cancelDialogOpen" :reservation="reservation" />

    <!-- Edit reservation dialog -->
    <UpsellOrderDrawer
      :order="selectedUpsellOrder"
      :open="upsellOrderDrawerOpen"
      @update:open="upsellOrderDrawerOpen = $event"
    />
    <EditReservationDialog
      :reservation="reservation"
      :open="editOpen"
      :focus-guest-index="editGuestIndex"
      @update:open="editOpen = $event; if (!$event) editGuestIndex = null"
    />

    <!-- Document preview dialog -->
    <Dialog :open="!!docViewDoc" @update:open="closeDocPreview">
      <DialogContent :class="agreementPreviewUrl ? 'sm:max-w-3xl' : 'sm:max-w-md'">
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
          <iframe
            v-if="agreementPreviewUrl"
            :src="agreementPreviewUrl"
            :title="docViewDoc?.name ?? 'House Rules Agreement'"
            class="h-[70vh] w-full rounded-md border"
          />
          <iframe
            v-else-if="docViewDoc?.url?.startsWith('data:application/pdf')"
            :src="docViewDoc.url"
            :title="docViewDoc.name"
            class="h-[70vh] w-full rounded-md border"
          />
          <div v-else-if="docViewDoc?.url" class="flex items-center justify-center rounded-md border bg-muted/30 p-2">
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
          <Button v-if="docViewDoc?.kind === 'agreement'" class="gap-1.5" @click="downloadAgreement">
            <Icon name="lucide:download" class="size-3.5" />
            Download
          </Button>
          <a v-else-if="docViewDoc?.url" :href="docViewDoc.url" :download="docViewDoc.fileName ?? docViewDoc.name">
            <Button class="gap-1.5">
              <Icon name="lucide:download" class="size-3.5" />
              Download
            </Button>
          </a>
          <Button variant="outline" @click="closeDocPreview">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
