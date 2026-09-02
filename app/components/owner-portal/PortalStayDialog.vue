<script setup lang="ts">
import type { DateRange } from 'reka-ui'
import type { OwnerBookingMode } from '~/components/owners/data/owner-quotas'
import type { OwnerStay, OwnerStaySyncTarget } from '~/components/owners/data/owner-stays'
import type { OwnerStayConflict, OwnerUseCapWarning } from '~/composables/useOwnerStays'
import { CalendarDate } from '@internationalized/date'
import { toast } from 'vue-sonner'
import BaseDateRangePicker from '~/components/base/DateRangePicker.vue'
import { listings } from '~/components/listings/data/listings'
import { OWNER_BOOKING_MODE_LABELS } from '~/components/owners/data/owner-quotas'
import { mockOwnerRooms, mockOwnerRoomTypes } from '~/components/owners/data/owner-reservations-seed'
import SharedPropertyPicker from '~/components/shared/PropertyPicker.vue'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import { useOwnerQuotas } from '~/composables/useOwnerQuotas'
import { useOwners } from '~/composables/useOwners'
import { useOwnerStayApprovals } from '~/composables/useOwnerStayApprovals'
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

const { updateStay, detectConflicts, getCapWarning } = useOwnerStays()
const { requestStay } = useOwnerStayApprovals()
const { getBookingMode, checkQuota } = useOwnerQuotas()
const { byId, mappings } = useOwners()

/** Per-owner annual use cap; 0 / absent means no cap. */
const ownerAnnualCap = computed(() => {
  const owner = byId(props.ownerId)
  const cap = owner?.annualOwnerUseNightCap
  return cap && cap > 0 ? cap : null
})

const guestName = ref(props.stay?.guestName ?? '')
const listingId = ref(props.stay?.listingId ?? props.listingId ?? 'lst-1')

const bookingMode = computed<OwnerBookingMode>(() =>
  getBookingMode(props.ownerId, listingId.value))

const initialCheckIn = props.stay?.checkIn ?? props.defaultCheckIn ?? ''
const unitId = ref(props.stay?.unitId ?? '')

/**
 * Only the properties this owner actually holds. Options carry `id`, so the
 * picker emits listing ids and binds straight to `listingId`.
 */
const propertyOptions = computed(() => {
  const owned = new Set(
    mappings.value.filter(m => m.ownerId === props.ownerId).map(m => m.listingId),
  )
  return listings.value
    .filter(l => owned.has(l.id))
    .map(l => ({
      id: l.id,
      name: l.name,
      city: l.location.split(',')[0]?.trim() ?? l.location,
      region: l.tags?.[0] ?? 'All',
    }))
})

/** Rooms of the selected property, labelled with their type. */
/**
 * Reka UI reserves the empty string for "no selection", so a `SelectItem`
 * with `value=""` is invalid and takes the rest of the list down with it.
 * The whole-property choice therefore needs a real sentinel value.
 */
const WHOLE_PROPERTY = '__whole_property__'

const roomOptions = computed(() => {
  const typeName = new Map(mockOwnerRoomTypes.map(rt => [rt.id, rt.name]))
  return mockOwnerRooms
    .filter(r => r.listingId === listingId.value)
    .map(r => ({
      id: r.id,
      label: typeName.has(r.roomTypeId) ? `${typeName.get(r.roomTypeId)} · ${r.label}` : r.label,
    }))
})

/** Switching property invalidates any room already chosen. */
function selectProperty(ids: string[]) {
  const next = ids[0]
  if (!next || next === 'All Properties')
    return
  listingId.value = next
  unitId.value = ''
}
const checkIn = ref(props.stay?.checkIn ?? initialCheckIn)
const checkOut = ref(props.stay?.checkOut ?? '')
const guestCount = ref(props.stay?.guestCount ?? 2)
const notes = ref(props.stay?.notes ?? '')

/**
 * The two ISO date refs stay the source of truth (validation and save read
 * them); this is a two-way view of them for the range picker.
 */
function toCalendarDate(iso: string): CalendarDate | undefined {
  const [year, month, day] = iso.split('-').map(Number)
  if (!year || !month || !day)
    return undefined
  return new CalendarDate(year, month, day)
}

function toIsoDate(date: { year: number, month: number, day: number }): string {
  return `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`
}

const stayRange = computed<DateRange>({
  get: () => ({
    start: checkIn.value ? toCalendarDate(checkIn.value) : undefined,
    end: checkOut.value ? toCalendarDate(checkOut.value) : undefined,
  }),
  set: (range) => {
    checkIn.value = range.start ? toIsoDate(range.start) : ''
    checkOut.value = range.end ? toIsoDate(range.end) : ''
  },
})

/** Nights in the selected range, so the owner sees the length as they pick. */
const selectedNights = computed(() => {
  if (!checkIn.value || !checkOut.value)
    return 0
  const ms = Date.parse(`${checkOut.value}T00:00:00`) - Date.parse(`${checkIn.value}T00:00:00`)
  return ms > 0 ? Math.round(ms / 86_400_000) : 0
})
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
  capWarning.value = ownerAnnualCap.value
    ? getCapWarning(
        props.ownerId,
        checkIn.value,
        checkOut.value,
        ownerAnnualCap.value,
        props.stay?.id,
      )
    : undefined

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
    // Editing an existing stay — dates can be changed freely; there is no
    // management window for owner stays anymore.
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
  const result = requestStay({ ...base, annualCap: ownerAnnualCap.value ?? undefined })
  saving.value = false
  if (!result.ok) {
    if (result.reason === 'quota_exceeded') {
      error.value = 'These dates exceed your seasonal quota for this property. Pick different dates or contact management.'
    }
    else if (result.reason === 'annual_cap_exceeded') {
      error.value = `These dates exceed your ${ownerAnnualCap.value}-night annual use cap. Pick different dates or contact management.`
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
        <div class="space-y-1.5">
          <Label>Property</Label>
          <SharedPropertyPicker
            :model-value="listingId ? [listingId] : []"
            :options="propertyOptions"
            :multi-select="false"
            @update:model-value="selectProperty"
          />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1.5">
            <Label for="stay-room">Room</Label>
            <Select
              :model-value="unitId || WHOLE_PROPERTY"
              :disabled="!roomOptions.length"
              @update:model-value="(value: unknown) => {
                const next = String(value ?? '')
                unitId = next === WHOLE_PROPERTY ? '' : next
              }"
            >
              <SelectTrigger id="stay-room">
                <SelectValue :placeholder="roomOptions.length ? 'Whole property' : 'No rooms listed'" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem :value="WHOLE_PROPERTY">
                  Whole property
                </SelectItem>
                <SelectItem v-for="room in roomOptions" :key="room.id" :value="room.id">
                  {{ room.label }}
                </SelectItem>
              </SelectContent>
            </Select>
            <p class="text-xs text-muted-foreground">
              Leave as whole property to block every room.
            </p>
          </div>
          <div class="space-y-1.5">
            <Label for="stay-guests">Guests</Label>
            <Input id="stay-guests" v-model.number="guestCount" type="number" min="1" />
          </div>
        </div>
        <div class="space-y-1.5">
          <Label for="stay-dates">Dates</Label>
          <BaseDateRangePicker
            id="stay-dates"
            v-model="stayRange"
            placeholder="Pick your check-in and check-out"
          />
          <p v-if="selectedNights" class="text-xs text-muted-foreground">
            {{ selectedNights }} night{{ selectedNights === 1 ? '' : 's' }}
          </p>
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
