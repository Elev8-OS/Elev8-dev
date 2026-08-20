<script setup lang="ts">
import type { OwnerBookingMode } from '~/components/owners/data/owner-quotas'
import type { OwnerStay, OwnerStaySyncTarget } from '~/components/owners/data/owner-stays'
import type { OwnerStayConflict, OwnerUseCapWarning } from '~/composables/useOwnerStays'
import { toast } from 'vue-sonner'
import { OWNER_BOOKING_MODE_LABELS } from '~/components/owners/data/owner-quotas'
import { useOwnerQuotas } from '~/composables/useOwnerQuotas'
import { useOwnerStayApprovals } from '~/composables/useOwnerStayApprovals'
import { isWithinCancelWindow, useOwnerStays } from '~/composables/useOwnerStays'

defineOptions({ name: 'PortalStayDialog' })

const props = defineProps<{
  modelValue: boolean
  stay?: OwnerStay | null
  ownerId: string
  listingId?: string
  defaultCheckIn?: string
  syncFailureTargets?: OwnerStaySyncTarget[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'saved': [value: OwnerStay]
  'cancelled': []
}>()

const open = computed<boolean>({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value),
})

const { updateStay, detectConflicts, getCapWarning } = useOwnerStays()
const { requestStay } = useOwnerStayApprovals()
const { getBookingMode, checkQuota } = useOwnerQuotas()

const guestName = ref(props.stay?.guestName ?? '')
const listingId = ref(props.stay?.listingId ?? props.listingId ?? 'lst-1')

const bookingMode = computed<OwnerBookingMode>(() =>
  getBookingMode(props.ownerId, listingId.value))

const initialCheckIn = props.stay?.checkIn ?? props.defaultCheckIn ?? ''
const unitId = ref(props.stay?.unitId ?? '')
const checkIn = ref(props.stay?.checkIn ?? initialCheckIn)
const checkOut = ref(props.stay?.checkOut ?? '')
const guestCount = ref(props.stay?.guestCount ?? 2)
const notes = ref(props.stay?.notes ?? '')
const conflicts = ref<OwnerStayConflict[]>([])
const capWarning = ref<OwnerUseCapWarning | undefined>()
const quotaWarning = ref('')
const error = ref('')
const saving = ref(false)
const _syncTargets: OwnerStaySyncTarget[] = ['cockpit', 'channex', 'notifications']
void _syncTargets

watch(() => props.stay?.id, () => {
  guestName.value = props.stay?.guestName ?? ''
  listingId.value = props.stay?.listingId ?? props.listingId ?? 'lst-1'
  unitId.value = props.stay?.unitId ?? ''
  checkIn.value = props.stay?.checkIn ?? ''
  checkOut.value = props.stay?.checkOut ?? ''
  guestCount.value = props.stay?.guestCount ?? 2
  notes.value = props.stay?.notes ?? ''
  conflicts.value = []
  error.value = ''
  capWarning.value = undefined
  quotaWarning.value = ''
})

watch(open, (value) => {
  if (value) {
    conflicts.value = []
    error.value = ''
    quotaWarning.value = ''
  }
})

const invalid = computed(() =>
  !guestName.value.trim()
  || !checkIn.value
  || !checkOut.value
  || checkOut.value <= checkIn.value
  || guestCount.value < 1,
)

function validate() {
  conflicts.value = detectConflicts({
    listingId: listingId.value,
    unitId: unitId.value || undefined,
    checkIn: checkIn.value,
    checkOut: checkOut.value,
    excludeStayId: props.stay?.id,
  })
  capWarning.value = getCapWarning(props.ownerId, checkIn.value, checkOut.value, 30, props.stay?.id)

  // Seasonal quota advisory (PRD 5.2) — direct mode blocks below, so here
  // we only surface the remaining nights for information.
  const quota = checkQuota(props.ownerId, listingId.value, checkIn.value, checkOut.value, props.stay?.id)
  quotaWarning.value = quota.windows
    .filter(w => w.maxNights > 0)
    .map(w => `${w.startDate} → ${w.endDate}: ${Math.max(0, w.remaining - w.requestedNights)} of ${w.maxNights} nights left`)
    .join(' · ')

  error.value = invalid.value
    ? 'Select a valid check-in, check-out, and guest count.'
    : conflicts.value.length
      ? 'These dates conflict with an existing booking.'
      : ''
  return !invalid.value && !conflicts.value.length
}

async function save() {
  if (!validate())
    return

  saving.value = true
  await new Promise(resolve => setTimeout(resolve, 120))

  const base = {
    ownerId: props.ownerId,
    listingId: listingId.value,
    unitId: unitId.value || undefined,
    guestName: guestName.value.trim(),
    checkIn: checkIn.value,
    checkOut: checkOut.value,
    guestCount: guestCount.value,
    notes: notes.value || undefined,
  }

  if (props.stay) {
    // Editing an existing stay — inside the cutoff the change needs to be
    // handled by management (Flow 7). For the mock, reschedule inside the
    // window is routed through a manual request.
    if (isWithinCancelWindow(props.stay.checkIn)) {
      error.value = 'This stay is within the 72h management window. Contact management to reschedule.'
      saving.value = false
      return
    }
    const result = updateStay(props.stay.id, { ...base, syncFailureTargets: props.syncFailureTargets })
    saving.value = false
    if (!result.ok) {
      error.value = result.reason === 'conflict'
        ? 'These dates conflict with an existing booking.'
        : 'Select a valid check-in and check-out date.'
      conflicts.value = result.conflicts ?? []
      return
    }
    emit('saved', result.stay)
    open.value = false
    return
  }

  // New request — booking mode decides direct vs request (PRD 5.2).
  const result = requestStay(base)
  saving.value = false
  if (!result.ok) {
    if (result.reason === 'quota_exceeded') {
      error.value = 'These dates exceed your seasonal quota for this property. Pick different dates or contact management.'
    }
    else {
      error.value = result.reason === 'conflict'
        ? 'These dates conflict with an existing booking.'
        : 'Select a valid check-in and check-out date.'
    }
    conflicts.value = (result.conflicts ?? []) as OwnerStayConflict[]
    return
  }
  if (!result.autoApproved) {
    toast.info('Your stay request has been sent for review by management.')
  }
  emit('saved', result.stay)
  open.value = false
}
</script>

<template>
  <Dialog :open="open" @update:open="(v) => open = v">
    <DialogContent aria-describedby="stay-dialog-description" class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{{ stay ? 'Edit stay' : 'Book my stay' }}</DialogTitle><DialogDescription id="stay-dialog-description">
          Reserve owner-use dates without affecting guest bookings.
        </DialogDescription>
      </DialogHeader>
      <div class="grid gap-4 py-2">
        <div class="rounded-md border p-3 text-sm">
          <span class="font-medium">{{ OWNER_BOOKING_MODE_LABELS[bookingMode] }}</span>
          <p class="mt-0.5 text-xs text-muted-foreground">
            {{ bookingMode === 'direct'
              ? 'Your dates are blocked immediately.'
              : 'Management must approve your dates before they are blocked.' }}
          </p>
        </div>
        <div><Label for="stay-guest">Guest name</Label><Input id="stay-guest" v-model="guestName" placeholder="Owner or guest name" /></div>
        <div><Label for="stay-property">Property</Label><Input id="stay-property" v-model="listingId" /></div>
        <div class="grid grid-cols-2 gap-3">
          <div><Label for="stay-room">Room (optional)</Label><Input id="stay-room" v-model="unitId" placeholder="Room ID" /></div>
          <div><Label for="stay-guests">Guests</Label><Input id="stay-guests" v-model.number="guestCount" type="number" min="1" /></div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div><Label for="stay-in">Check-in</Label><Input id="stay-in" v-model="checkIn" type="date" /></div><div><Label for="stay-out">Check-out</Label><Input id="stay-out" v-model="checkOut" type="date" /></div>
        </div>
        <div><Label for="stay-notes">Notes</Label><Textarea id="stay-notes" v-model="notes" /></div>
        <Alert v-if="error" variant="destructive">
          <AlertDescription>{{ error }}</AlertDescription>
        </Alert>
        <Alert v-if="conflicts.length" variant="destructive">
          <AlertTitle>Conflict details</AlertTitle><AlertDescription>{{ conflicts.map(c => `${c.type}: ${c.start} to ${c.end}`).join(' · ') }}</AlertDescription>
        </Alert>
        <Alert v-if="quotaWarning">
          <AlertTitle>Seasonal quota</AlertTitle><AlertDescription>{{ quotaWarning }}</AlertDescription>
        </Alert>
        <Alert v-if="capWarning?.exceeds">
          <AlertTitle>Annual use cap warning</AlertTitle><AlertDescription>{{ capWarning.projectedNights }} nights projected against a {{ capWarning.cap }}-night cap. You can still confirm.</AlertDescription>
        </Alert>
      </div>
      <DialogFooter>
        <Button variant="outline" @click="open = false">
          Cancel
        </Button><Button :disabled="saving || invalid" @click="save">
          {{ saving ? 'Saving…' : (stay ? 'Save changes' : (bookingMode === 'direct' ? 'Block dates' : 'Submit request')) }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
