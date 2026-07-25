<script setup lang="ts">
import type { OwnerStay, OwnerStaySyncTarget } from '~/components/owners/data/owner-stays'
import type { OwnerStayConflict, OwnerUseCapWarning } from '~/composables/useOwnerStays'
import { useOwnerStays } from '~/composables/useOwnerStays'

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

const { createStay, updateStay, detectConflicts, getCapWarning } = useOwnerStays()

const guestName = ref(props.stay?.guestName ?? '')
const listingId = ref(props.stay?.listingId ?? props.listingId ?? 'lst-1')
const initialCheckIn = props.stay?.checkIn ?? props.defaultCheckIn ?? ''
const unitId = ref(props.stay?.unitId ?? '')
const checkIn = ref(props.stay?.checkIn ?? initialCheckIn)
const checkOut = ref(props.stay?.checkOut ?? '')
const notes = ref(props.stay?.notes ?? '')
const conflicts = ref<OwnerStayConflict[]>([])
const capWarning = ref<OwnerUseCapWarning | undefined>()
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
  notes.value = props.stay?.notes ?? ''
  conflicts.value = []
  error.value = ''
  capWarning.value = undefined
})

watch(open, (value) => {
  if (value) {
    conflicts.value = []
    error.value = ''
  }
})

const invalid = computed(() =>
  !guestName.value.trim()
  || !checkIn.value
  || !checkOut.value
  || checkOut.value <= checkIn.value,
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
  error.value = invalid.value
    ? 'Select a valid check-in and check-out date.'
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
  const input = {
    ownerId: props.ownerId,
    listingId: listingId.value,
    unitId: unitId.value || undefined,
    guestName: guestName.value.trim(),
    checkIn: checkIn.value,
    checkOut: checkOut.value,
    notes: notes.value || undefined,
    syncFailureTargets: props.syncFailureTargets,
  }
  const result = props.stay
    ? updateStay(props.stay.id, input)
    : createStay(input)
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
}
</script>

<template>
  <Dialog :open="open" @update:open="(v) => open = v">
    <DialogContent aria-describedby="stay-dialog-description" class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{{ stay ? 'Edit stay' : 'Create stay' }}</DialogTitle><DialogDescription id="stay-dialog-description">
          Reserve owner-use dates without affecting guest bookings.
        </DialogDescription>
      </DialogHeader>
      <div class="grid gap-4 py-2">
        <div><Label for="stay-guest">Guest name</Label><Input id="stay-guest" v-model="guestName" placeholder="Owner or guest name" /></div>
        <div><Label for="stay-property">Property</Label><Input id="stay-property" v-model="listingId" /></div>
        <div><Label for="stay-room">Room (optional)</Label><Input id="stay-room" v-model="unitId" placeholder="Room ID" /></div>
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
        <Alert v-if="capWarning?.exceeds">
          <AlertTitle>Annual use cap warning</AlertTitle><AlertDescription>{{ capWarning.projectedNights }} nights projected against a {{ capWarning.cap }}-night cap. You can still confirm.</AlertDescription>
        </Alert>
      </div>
      <DialogFooter>
        <Button variant="outline" @click="open = false">
          Cancel
        </Button><Button :disabled="saving || invalid" @click="save">
          {{ saving ? 'Saving…' : 'Confirm stay' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
