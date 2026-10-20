<script setup lang="ts">
import type { ReservationEntry, StayExtension } from '~/components/reservations/data/reservations'
import { toast } from 'vue-sonner'
import { isActiveExtension } from '~/components/reservations/data/reservations'
import { useReservationsModule } from '~/composables/useReservationsModule'
import { useStayExtension } from '~/composables/useStayExtension'

// Confirms every cancel from the detail sheet. Two modes:
// - the stay (no `extensionId`, not a linked booking): the stay and every
//   linked booking go, open payment links and cleanings are cancelled, door
//   codes are revoked;
// - one extension (`extensionId`, or `reservation` is its linked booking):
//   only that extension is taken back, if `canCancelExtension` allows it.
const props = defineProps<{
  reservation: ReservationEntry | null
  extensionId?: string
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'cancelled': [ids: string[]]
}>()

const { reservations } = useReservationsModule()
const { cancelStay, cancelExtension, canCancelExtension, previewCancelStay, defaultCancelMessage } = useStayExtension()

const notifyGuest = ref(true)
const message = ref('')
const saving = ref(false)

/** The stay the guest booked, whichever booking the dialog was opened on. */
const stay = computed(() => {
  const r = props.reservation
  if (!r)
    return null
  return r.extensionOf ? reservations.value.find(x => x.id === r.extensionOf) ?? null : r
})

const extension = computed<StayExtension | null>(() => {
  const r = props.reservation
  if (!r || !stay.value)
    return null
  if (props.extensionId)
    return stay.value.extensions?.find(e => e.id === props.extensionId) ?? null
  if (r.extensionOf)
    return stay.value.extensions?.find(e => e.linkedReservationId === r.id && isActiveExtension(e)) ?? null
  return null
})

const isExtensionMode = computed(() => Boolean(props.extensionId || props.reservation?.extensionOf))
const isBefore = computed(() => extension.value?.direction === 'before')

const blocked = computed(() => {
  if (!isExtensionMode.value)
    return null
  if (!stay.value || !extension.value)
    return 'Extension not found.'
  const check = canCancelExtension(stay.value.id, extension.value.id)
  return check.ok ? null : check.error ?? 'This extension cannot be cancelled.'
})

const stayPreview = computed(() => !isExtensionMode.value && stay.value ? previewCancelStay(stay.value.id) : null)
const linkedBookings = computed(() => stayPreview.value?.linked ?? [])

const pendingLinks = computed(() => isExtensionMode.value
  ? (extension.value?.paymentStatus === 'pending' && extension.value.paymentRequestId ? 1 : 0)
  : stayPreview.value?.pendingLinks ?? 0)

// Rebuilt each time the dialog opens; staff can rewrite it or switch it off.
watch(() => props.open, (open) => {
  if (!open || !stay.value)
    return
  notifyGuest.value = true
  saving.value = false
  message.value = defaultCancelMessage(stay.value.id, isExtensionMode.value ? extension.value?.id : undefined)
}, { immediate: true })

const canConfirm = computed(() => !blocked.value && !saving.value && !(notifyGuest.value && !message.value.trim()))

const title = computed(() => {
  if (!isExtensionMode.value)
    return 'Cancel reservation'
  return isBefore.value ? 'Cancel early arrival' : 'Cancel extension'
})

function fmtDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

function isEarly(linked: ReservationEntry): boolean {
  return Boolean(stay.value && linked.checkOut <= stay.value.checkIn)
}

async function confirm() {
  if (!stay.value || !canConfirm.value)
    return
  saving.value = true
  const guestMessage = notifyGuest.value ? message.value : ''
  const result = isExtensionMode.value && extension.value
    ? await cancelExtension(stay.value.id, extension.value.id, { guestMessage })
    : await cancelStay(stay.value.id, { guestMessage })
  saving.value = false
  if (!result.success) {
    toast.error(result.error ?? 'Could not cancel.')
    return
  }
  const details = [
    result.cancelledIds.length > 1 ? `${plural(result.cancelledIds.length - 1, 'linked booking')} cancelled too` : '',
    result.paymentLinksCancelled ? `${plural(result.paymentLinksCancelled, 'payment link')} cancelled` : '',
    result.codesRevoked ? `${plural(result.codesRevoked, 'door code')} revoked` : '',
    result.guestNotified ? 'guest notified' : '',
  ].filter(Boolean).join(', ')
  const done = !isExtensionMode.value ? 'Reservation cancelled' : isBefore.value ? 'Early arrival cancelled' : 'Extension cancelled'
  toast.success(done, details ? { description: details.charAt(0).toUpperCase() + details.slice(1) } : undefined)
  emit('cancelled', result.cancelledIds)
  emit('update:open', false)
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{{ title }}</DialogTitle>
        <DialogDescription v-if="stay">
          {{ stay.id }} · {{ stay.guestName }}
        </DialogDescription>
      </DialogHeader>

      <div v-if="stay" class="space-y-3 text-sm">
        <Alert v-if="blocked" variant="destructive" data-testid="cancel-blocked">
          <Icon name="lucide:ban" class="size-4" />
          <AlertTitle>Cannot cancel</AlertTitle>
          <AlertDescription>{{ blocked }}</AlertDescription>
        </Alert>

        <!-- The whole stay -->
        <template v-if="!isExtensionMode">
          <p>{{ linkedBookings.length ? 'The stay and every booking linked to it are cancelled.' : 'The stay is cancelled.' }}</p>
          <ul v-if="linkedBookings.length" class="space-y-1.5 rounded-md border p-3" data-testid="cancel-linked-list">
            <li v-for="linked in linkedBookings" :key="linked.id" class="flex items-center gap-2">
              <Icon name="lucide:link-2" class="size-4 shrink-0 text-muted-foreground" />
              <span class="min-w-0 flex-1">
                {{ isEarly(linked) ? 'Early arrival' : 'Extension' }}
                <span class="whitespace-nowrap font-mono text-xs">{{ linked.id }}</span>
              </span>
              <span class="shrink-0 text-xs text-muted-foreground">{{ fmtDate(linked.checkIn) }} to {{ fmtDate(linked.checkOut) }}</span>
            </li>
          </ul>
        </template>

        <!-- One extension -->
        <template v-else-if="extension && !blocked">
          <p v-if="extension.linkedReservationId">
            Direct booking <span class="font-mono text-xs">{{ extension.linkedReservationId }}</span>
            ({{ plural(extension.extraNights, 'night') }}) is cancelled. The {{ stay.channel }} booking is unchanged.
          </p>
          <p v-else-if="isBefore">
            Check-in goes back to {{ fmtDate(extension.previousCheckIn!) }} ({{ plural(extension.extraNights, 'night') }} fewer).
          </p>
          <p v-else>
            Check-out goes back to {{ fmtDate(extension.previousCheckOut!) }} ({{ plural(extension.extraNights, 'night') }} fewer).
          </p>
          <p class="text-muted-foreground">
            Door codes and cleanings go back to the original dates.
          </p>
        </template>

        <ul v-if="stayPreview && (stayPreview.codes || stayPreview.cleanings)" class="space-y-1.5" data-testid="cancel-operations">
          <li v-if="stayPreview.codes" class="flex items-start gap-2">
            <Icon name="lucide:key-round" class="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <span>{{ plural(stayPreview.codes, 'door code') }} {{ stayPreview.codes === 1 ? 'is' : 'are' }} revoked</span>
          </li>
          <li v-if="stayPreview.cleanings" class="flex items-start gap-2">
            <Icon name="lucide:brush-cleaning" class="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <span>{{ plural(stayPreview.cleanings, 'open cleaning') }} {{ stayPreview.cleanings === 1 ? 'is' : 'are' }} cancelled</span>
          </li>
        </ul>

        <ul v-if="!blocked && pendingLinks" class="space-y-1.5" data-testid="cancel-money">
          <li v-if="pendingLinks" class="flex items-start gap-2">
            <Icon name="lucide:link" class="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <span>{{ plural(pendingLinks, 'open payment link') }} {{ pendingLinks === 1 ? 'is' : 'are' }} cancelled</span>
          </li>
        </ul>

        <div v-if="!blocked" class="space-y-2 rounded-md border p-3">
          <div class="flex items-center justify-between gap-3">
            <Label for="cancel-notify" class="text-sm">Message the guest</Label>
            <Switch id="cancel-notify" :model-value="notifyGuest" @update:model-value="notifyGuest = $event" />
          </div>
          <Textarea
            v-if="notifyGuest"
            :model-value="message"
            rows="6"
            class="text-sm"
            data-testid="cancel-message"
            @update:model-value="message = String($event)"
          />
        </div>
      </div>

      <DialogFooter class="gap-2">
        <Button variant="outline" @click="emit('update:open', false)">
          Keep
        </Button>
        <Button variant="destructive" :disabled="!canConfirm" data-testid="cancel-confirm" @click="confirm">
          <Icon v-if="saving" name="lucide:loader-2" class="size-4 animate-spin" />
          {{ title }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
