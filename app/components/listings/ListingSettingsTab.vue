<script setup lang="ts">
import type { Listing, Unit, UnitType } from '~/components/listings/data/listings'
import { reservations as allReservations } from '~/components/inbox/data/conversations'
import { toast } from 'vue-sonner'
import GuideStatusBadge from '~/components/guest-guides/GuideStatusBadge.vue'
import GuideAssignPopover from '~/components/listings/GuideAssignPopover.vue'
import InvoiceTemplateAssignPopover from '~/components/listings/InvoiceTemplateAssignPopover.vue'
import { useInvoiceTemplates } from '~/composables/useInvoiceTemplates'

const props = defineProps<{ listing: Listing }>()
const emit = defineEmits<{ update: [listing: Listing] }>()

const smartLock = useSmartLock()
const { guides } = useGuestGuides()
const assignedGuide = computed(() =>
  guides.value.find(g => g.assignedListingIds.includes(props.listing.id)),
)

const { getTemplateForListing } = useInvoiceTemplates()
const assignedInvoiceTemplate = computed(() => getTemplateForListing(props.listing.id))

const editForm = ref({
  name: props.listing.name,
  location: props.listing.location,
  capacity: props.listing.capacity,
  room: props.listing.room,
  property: props.listing.property,
})

watch(() => props.listing, (l) => {
  editForm.value = { name: l.name, location: l.location, capacity: l.capacity, room: l.room, property: l.property }
})

function saveDetails() {
  emit('update', { ...props.listing, ...editForm.value, capacity: Number(editForm.value.capacity) })
}

const allAmenities = [
  'Pool', 'WiFi', 'AC', 'Kitchen', 'Parking', 'Garden', 'Beach Access', 'Rooftop Deck',
  'Plunge Pool', 'Yoga Deck', 'Hammock Deck', 'Nature Bath', 'Ocean View', 'Cliff Deck',
  'Surfboard Storage', 'Mountain View', 'Hot Tub', 'Fireplace', 'River View', 'Bamboo Construction',
]
const amenitySearch = ref('')
const amenityPopoverOpen = ref(false)
const filteredAmenities = computed(() => {
  const available = allAmenities.filter(a => !props.listing.amenities.includes(a))
  if (!amenitySearch.value)
    return available
  return available.filter(a => a.toLowerCase().includes(amenitySearch.value.toLowerCase()))
})
function addAmenity(amenity: string) { emit('update', { ...props.listing, amenities: [...props.listing.amenities, amenity] }) }
function removeAmenity(amenity: string) { emit('update', { ...props.listing, amenities: props.listing.amenities.filter(a => a !== amenity) }) }

function otaIcon(ota: string) { return ota === 'Airbnb' ? 'logos:airbnb' : 'simple-icons:bookingdotcom' }
const allOtas = ['Airbnb', 'Booking.com']

// Smart Lock state
const unitTypes = computed(() => props.listing.unitTypes ?? [])
const listingLocks = computed(() => smartLock.getLocksForListing(props.listing.id))
const availableDevices = computed(() => smartLock.availableDevices.value)

const showPairDialog = ref(false)
const pairAssignment = ref<'property' | 'room'>('property')
const pairUnitId = ref('')
const selectedDeviceId = ref('')
const newLockName = ref('')
const newLockIsMain = ref(false)
const newLockGenerateHousekeepingCode = ref(false)
const renameLockId = ref<string | null>(null)
const renameValue = ref('')
const swapLockId = ref<string | null>(null)
const swapTargetDeviceId = ref('')
const swapTargetDeviceName = ref('')
const swapTargetOldDeviceName = ref('')

// Flat list of all rooms for the room Select
const allRooms = computed(() =>
  unitTypes.value.flatMap(ut => ut.units.map(u => ({ id: u.id, name: u.name, typeName: ut.name }))),
)

// Brand lookup map for paired locks — keyed by deviceId, returns capitalized provider name + model
const providerMap = computed(() => {
  const map = new Map<string, { name: string; model: string }>()
  for (const device of smartLock.allDevices.value) {
    map.set(device.deviceId, {
      name: device.provider.charAt(0).toUpperCase() + device.provider.slice(1),
      model: device.model,
    })
  }
  return map
})

function getProvider(deviceId: string) {
  return providerMap.value.get(deviceId) ?? null
}

// Grouped locks by scope — property level first, then per-room in unitTypes order
const propertyLocks = computed(() =>
  listingLocks.value.filter(l => l.assignment === 'property' || !l.unitId),
)

// Flat list of every room in this listing (preserving unitType → unit order)
const roomsList = computed(() =>
  unitTypes.value.flatMap(ut => ut.units.map(u => ({
    id: u.id,
    name: u.name,
    typeName: ut.name,
  }))),
)

function roomLocksForUnit(unitId: string) {
  return listingLocks.value.filter(l => l.unitId === unitId && l.assignment === 'room')
}

// Active tab state — property vs rooms
const activeTab = ref<'property' | 'rooms'>('property')

// Total locks across all rooms (for the Rooms tab badge)
const totalRoomLocks = computed(() =>
  roomsList.value.reduce((sum, r) => sum + roomLocksForUnit(r.id).length, 0),
)

// Card-header "Add Lock" button: scopes the pair dialog to the currently active tab.
// For the Rooms tab, defaults to the first room that has no locks yet (or just the first room).
function handleCardHeaderAdd() {
  if (activeTab.value === 'property') {
    openPairDialog('property')
  }
  else {
    const target = roomsList.value.find(r => roomLocksForUnit(r.id).length === 0) ?? roomsList.value[0]
    if (target) openPairDialog('room', target.id)
    else openPairDialog('property')
  }
}

// Reactive default for "Set as main" — true if no lock in the selected scope yet
watch([pairAssignment, pairUnitId, showPairDialog], () => {
  if (!showPairDialog.value) return
  if (pairAssignment.value === 'property') {
    newLockIsMain.value = listingLocks.value.filter(l => l.assignment === 'property' || !l.unitId).length === 0
  }
  else {
    newLockIsMain.value = listingLocks.value.filter(l => l.unitId === pairUnitId.value).length === 0
  }
})

function openPairDialog(kind: 'property' | 'room' = 'property', unitId?: string) {
  pairAssignment.value = kind
  pairUnitId.value = unitId ?? ''
  selectedDeviceId.value = ''
  newLockName.value = ''
  newLockGenerateHousekeepingCode.value = false
  showPairDialog.value = true
}

async function handlePair() {
  if (!selectedDeviceId.value) return
  if (pairAssignment.value === 'room' && !pairUnitId.value) return
  const result = smartLock.pairLock({
    providerDeviceId: selectedDeviceId.value,
    name: newLockName.value.trim(),
    assignment: pairAssignment.value,
    listingId: props.listing.id,
    unitId: pairAssignment.value === 'room' ? pairUnitId.value : undefined,
    isMain: newLockIsMain.value,
  })
  if (!result.success) {
    toast.error(result.error ?? 'Failed to pair lock.')
    return
  }
  const scope = pairAssignment.value === 'room'
    ? `to room ${getUnitName(pairUnitId.value) || 'selected'}`
    : 'to this property'

  // Look up the device's provider for brand-shared code generation
  const device = smartLock.allDevices.value.find(d => d.deviceId === selectedDeviceId.value)
  const provider = device?.provider

  // Auto-generate brand-shared codes for each current + future guest
  const generatedSummaries: string[] = []
  if (provider) {
    for (const reservation of relevantReservations.value) {
      const existingCode = smartLock.findActiveBrandCode(reservation.id, provider)
      const r = await smartLock.generateAccessCode({
        lockId: result.lock!.id,
        reservationId: reservation.id,
        guestName: reservation.guestDetails.name,
        code: existingCode, // reuses the same value across locks of this brand for this guest
      })
      if (r.code) {
        const tag = existingCode ? '(shared)' : '(new)'
        generatedSummaries.push(`${reservation.guestDetails.name}: ${r.code.code} ${tag}`)
      }
    }
  }

  // Optional housekeeping code (per-lock, not brand-shared)
  if (newLockGenerateHousekeepingCode.value) {
    const r = await smartLock.generateAccessCode({
      lockId: result.lock!.id,
      guestName: 'Housekeeping',
    })
    if (r.code) generatedSummaries.push(`Housekeeping: ${r.code.code}`)
  }

  if (generatedSummaries.length > 0) {
    const summary = generatedSummaries.length > 3
      ? `${generatedSummaries.slice(0, 3).join(', ')} +${generatedSummaries.length - 3} more`
      : generatedSummaries.join(', ')
    toast.success(`"${result.lock!.name}" paired ${scope}. Codes: ${summary}`)
  }
  else {
    toast.success(`"${result.lock!.name}" paired ${scope}.`)
  }
  showPairDialog.value = false
}

function handleUnpair(lockId: string, name: string) {
  smartLock.unpairLock(lockId)
  toast.info(`"${name}" unpaired.`)
}

function handleSetMain(lockId: string) {
  smartLock.setMainLock(lockId)
  toast.success('Main lock updated.')
}

function startRename(lockId: string, currentName: string) {
  renameLockId.value = lockId
  renameValue.value = currentName
}

function commitRename() {
  if (!renameLockId.value || !renameValue.value.trim()) {
    renameLockId.value = null
    return
  }
  smartLock.renameLock(renameLockId.value, renameValue.value.trim())
  renameLockId.value = null
  toast.success('Lock renamed.')
}

function startSwap(lockId: string) {
  const lock = listingLocks.value.find(l => l.id === lockId)
  if (!lock) return
  const oldDevice = smartLock.allDevices.value.find(d => d.deviceId === lock.providerDeviceId)
  swapLockId.value = lockId
  swapTargetDeviceId.value = ''
  swapTargetOldDeviceName.value = oldDevice?.name ?? 'current device'
}

function handleSwap() {
  if (!swapLockId.value || !swapTargetDeviceId.value) return
  const result = smartLock.swapDevice(swapLockId.value, swapTargetDeviceId.value)
  if (!result.success) {
    toast.error(result.error ?? 'Failed to swap device.')
    return
  }
  toast.success(`Device swapped to "${result.lock!.name === smartLock.allDevices.value.find(d => d.deviceId === swapTargetDeviceId.value)?.name ? result.lock!.name : swapTargetDeviceName.value}".`)
  swapLockId.value = null
  swapTargetDeviceId.value = ''
  swapTargetDeviceName.value = ''
}

const swappableDevices = computed(() => {
  if (!swapLockId.value) return []
  const lock = listingLocks.value.find(l => l.id === swapLockId.value)
  if (!lock) return []
  return smartLock.allDevices.value.filter(d => d.deviceId !== lock.providerDeviceId)
})

const swapDialogOpen = computed({
  get: () => swapLockId.value !== null,
  set: (val: boolean) => {
    if (!val) swapLockId.value = null
  },
})

function getUnitName(unitId?: string): string {
  if (!unitId) return ''
  for (const ut of unitTypes.value) {
    const u = ut.units.find(x => x.id === unitId)
    if (u) return u.name
  }
  return ''
}

// Current + future reservations for this listing (used to auto-generate guest codes on add lock)
const relevantReservations = computed(() => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Object.values(allReservations).filter((r) => {
    if (r.listingName !== props.listing.name) return false
    const checkOut = new Date(r.checkOut)
    return checkOut >= today
  })
})

// --- Per-lock card UI state ---
const unlockingLockId = ref<string | null>(null)

// --- Codes dialog (one dialog, scoped to one lock at a time) ---
const codesDialogLockId = ref<string | null>(null)

// "Add code" form state
const newCodePurpose = ref('')
const newCodeValue = ref('')
const newCodeScheduleType = ref<'ongoing' | 'range'>('ongoing')
const newCodeStartAt = ref('')
const newCodeEndAt = ref('')
const savingNewCode = ref(false)
const newCodeError = ref('')

const codesDialogOpen = computed({
  get: () => codesDialogLockId.value !== null,
  set: (val: boolean) => {
    if (!val) codesDialogLockId.value = null
  },
})

function openCodesDialog(lockId: string) {
  codesDialogLockId.value = lockId
  // Reset form (random 6-digit default so user can save immediately if they want)
  newCodePurpose.value = ''
  newCodeValue.value = generateRandomCode()
  newCodeScheduleType.value = 'ongoing'
  newCodeStartAt.value = ''
  newCodeEndAt.value = ''
  newCodeError.value = ''
}

function generateRandomCode() {
  return Array.from({ length: 6 }, () => Math.floor(Math.random() * 10)).join('')
}

// Sorted codes for a given lock (newest first)
function codesForLock(lockId: string) {
  return smartLock.codes.value
    .filter(c => c.lockId === lockId)
    .sort((a, b) => +new Date(b.startsAt) - +new Date(a.startsAt))
}

/**
 * 3-state lifecycle badge driven by scheduleType + current time + status:
 *  - 'unset'   = revoked, expired, or scheduled in the future with no active window
 *  - 'setting' = auto-generated (no explicit schedule yet) OR future-scheduled with explicit range
 *  - 'set'     = currently within an explicit active window (ongoing or within range)
 */
type CodeTimeStatus = 'unset' | 'setting' | 'set'

function getCodeTimeStatus(code: { status: string, startsAt: string, endsAt: string, scheduleType?: 'ongoing' | 'range' }): CodeTimeStatus {
  if (code.status === 'revoked') return 'unset'
  const now = Date.now()
  const start = +new Date(code.startsAt)
  const end = +new Date(code.endsAt)
  if (end <= now) return 'unset'

  if (code.scheduleType === 'ongoing') return 'set'
  if (code.scheduleType === 'range') return start > now ? 'setting' : 'set'

  // No explicit schedule = auto-generated, sitting in transition
  return 'setting'
}

function timeStatusLabel(s: CodeTimeStatus): string {
  return s === 'set' ? 'Set' : s === 'setting' ? 'Setting' : 'Unset'
}

function timeStatusClass(s: CodeTimeStatus): string {
  if (s === 'set') return 'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400'
  if (s === 'setting') return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400'
  return 'border-muted-foreground/30 bg-muted text-muted-foreground'
}

function timeUntilExpiry(endsAt: string): string {
  const ms = +new Date(endsAt) - Date.now()
  if (ms <= 0) return 'expired'
  const hours = Math.floor(ms / (1000 * 60 * 60))
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))
  if (hours <= 0) return `${minutes}m left`
  if (hours < 24) return `${hours}h ${minutes}m left`
  const days = Math.floor(hours / 24)
  return `${days}d left`
}

async function handleUnlock(lockId: string) {
  unlockingLockId.value = lockId
  await new Promise(r => setTimeout(r, 800))
  unlockingLockId.value = null
  const lock = smartLock.locks.value.find(l => l.id === lockId)
  toast.success(`"${lock?.name ?? 'Lock'}" unlocked.`)
}

async function handleSaveNewCode() {
  if (!codesDialogLockId.value) return
  newCodeError.value = ''
  const purpose = newCodePurpose.value.trim()
  if (!purpose) {
    newCodeError.value = 'Code name is required.'
    return
  }
  const value = newCodeValue.value.trim()
  if (!/^\d{6}$/.test(value)) {
    newCodeError.value = 'Code must be 6 digits.'
    return
  }
  let startsAt: string | undefined
  let endsAt: string | undefined
  if (newCodeScheduleType.value === 'range') {
    if (!newCodeStartAt.value || !newCodeEndAt.value) {
      newCodeError.value = 'Start and end times are required for a range.'
      return
    }
    startsAt = new Date(newCodeStartAt.value).toISOString()
    endsAt = new Date(newCodeEndAt.value).toISOString()
    if (+new Date(startsAt) >= +new Date(endsAt)) {
      newCodeError.value = 'End time must be after start time.'
      return
    }
  }

  savingNewCode.value = true
  const result = await smartLock.generateAccessCode({
    lockId: codesDialogLockId.value,
    code: value,
    purpose,
    scheduleType: newCodeScheduleType.value,
    startsAt,
    endsAt,
  })
  savingNewCode.value = false
  if (!result.code) {
    newCodeError.value = 'Failed to create code.'
    return
  }
  toast.success(`Code "${purpose}" created.`)
  // Reset form so the user can add another code
  newCodePurpose.value = ''
  newCodeValue.value = generateRandomCode()
  newCodeStartAt.value = ''
  newCodeEndAt.value = ''
}

function handleRevokeCode(codeId: string) {
  smartLock.revokeAccessCode(codeId)
  toast.info('Code revoked.')
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <Card class="p-5">
      <h3 class="text-sm font-semibold mb-4">
        Distribution Channels
      </h3>
      <div class="flex flex-col gap-3">
        <div v-for="ota in allOtas" :key="ota" class="flex items-center justify-between rounded-lg border p-4">
          <div class="flex items-center gap-3">
            <Icon :name="otaIcon(ota)" class="size-5" />
            <span class="text-sm font-medium">{{ ota }}</span>
          </div>
          <Badge :variant="listing.otaConnected.includes(ota) ? 'default' : 'secondary'" class="text-xs">
            {{ listing.otaConnected.includes(ota) ? 'Connected' : 'Not Connected' }}
          </Badge>
        </div>
      </div>
    </Card>

    <!-- Smart Locks -->
    <Card class="p-5">
      <div class="mb-4 flex items-end justify-between gap-2">
        <div>
          <h3 class="text-sm font-semibold">
            Smart Locks
          </h3>
          <p class="text-xs text-muted-foreground mt-0.5">
            Pair smart lock devices to this property or specific rooms. Guest access codes can be auto-shared via the Inbox.
          </p>
        </div>
        <Button
          v-if="smartLock.isConnected.value"
          size="sm"
          class="gap-1.5"
          :disabled="availableDevices.length === 0"
          @click="handleCardHeaderAdd"
        >
          <Icon name="lucide:plus" class="size-3.5" />
          Add Lock
        </Button>
      </div>

      <!-- Not connected -->
      <div v-if="!smartLock.isConnected.value" class="rounded-lg border border-dashed bg-muted/30 p-6 text-center">
        <Icon name="lucide:key-round" class="mx-auto mb-2 size-6 text-muted-foreground/60" />
        <p class="text-sm text-muted-foreground">
          Connect Smart Lock in
          <NuxtLink to="/settings/integrations" class="text-primary underline">
            Settings → Integrations
          </NuxtLink>
          to pair smart locks.
        </p>
      </div>

      <!-- Tabs: Property vs Rooms -->
      <Tabs v-else v-model="activeTab" class="w-full">
        <TabsList class="grid w-full grid-cols-2">
          <TabsTrigger value="property" class="gap-1.5">
            <Icon name="lucide:building-2" class="size-3.5" />
            Property
            <Badge variant="secondary" class="ml-1 h-4 px-1.5 text-[10px]">
              {{ propertyLocks.length }}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="rooms" class="gap-1.5">
            <Icon name="lucide:door-open" class="size-3.5" />
            Rooms
            <Badge variant="secondary" class="ml-1 h-4 px-1.5 text-[10px]">
              {{ totalRoomLocks }}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <!-- Property tab -->
        <TabsContent value="property" class="mt-4 space-y-2">
          <div v-if="propertyLocks.length === 0" class="rounded-lg border border-dashed p-6 text-center">
            <p class="text-sm text-muted-foreground">
              No locks paired at property level.
            </p>
            <Button
              size="sm"
              variant="outline"
              class="mt-3 gap-1.5"
              :disabled="availableDevices.length === 0"
              @click="openPairDialog('property')"
            >
              <Icon name="lucide:plus" class="size-3.5" />
              Add Lock
            </Button>
          </div>
          <div v-else class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <div
              v-for="lock in propertyLocks"
              :key="lock.id"
              class="flex flex-col gap-3 rounded-lg border p-4"
            >
              <!-- Header: icon + name + brand + main -->
              <div class="flex items-start gap-2">
                <div
                  class="flex size-9 shrink-0 items-center justify-center rounded-md border"
                  :class="lock.online ? 'bg-green-500/10' : 'bg-muted'"
                >
                  <Icon
                    :name="lock.online ? 'lucide:lock' : 'lucide:lock-open'"
                    class="size-4"
                    :class="lock.online ? 'text-green-600' : 'text-muted-foreground'"
                  />
                </div>
                <div class="min-w-0 flex-1 space-y-1">
                  <div class="flex items-center gap-1.5">
                    <input
                      v-if="renameLockId === lock.id"
                      v-model="renameValue"
                      class="w-full text-sm font-medium bg-transparent border-b border-primary outline-none"
                      @keydown.enter="commitRename"
                      @keydown.esc="renameLockId = null"
                      @blur="commitRename"
                    >
                    <p v-else class="truncate text-sm font-medium">
                      {{ lock.name }}
                    </p>
                  </div>
                  <div class="flex flex-wrap items-center gap-1.5">
                    <span
                      v-if="getProvider(lock.providerDeviceId)"
                      class="inline-flex items-center gap-0.5 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                      :title="getProvider(lock.providerDeviceId)?.model"
                    >
                      {{ getProvider(lock.providerDeviceId)?.name }}
                    </span>
                    <Badge v-if="lock.isMain" variant="default" class="text-[9px] px-1 py-0">
                      Main
                    </Badge>
                    <span
                      v-if="!lock.isMain"
                      class="cursor-pointer text-muted-foreground hover:text-foreground"
                      title="Set as main"
                      @click="handleSetMain(lock.id)"
                    >
                      <Icon name="lucide:star" class="size-3" />
                    </span>
                  </div>
                </div>
              </div>

              <!-- Meta -->
              <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                <span class="inline-flex items-center gap-0.5">
                  <Icon name="lucide:battery" class="size-3" :class="lock.batteryLevel <= 20 ? 'text-amber-500' : 'text-muted-foreground'" />
                  {{ lock.batteryLevel }}%
                </span>
                <span class="inline-flex items-center gap-0.5">
                  <span class="size-1.5 rounded-full" :class="lock.online ? 'bg-green-500' : 'bg-muted-foreground/50'" />
                  {{ lock.online ? 'Online' : 'Offline' }}
                </span>
                <span>Property</span>
              </div>

              <!-- Actions -->
              <div class="flex flex-wrap items-center gap-1.5">
                <Button
                  size="sm"
                  class="h-7 gap-1 px-2 text-xs"
                  :disabled="!lock.online || unlockingLockId === lock.id"
                  @click="handleUnlock(lock.id)"
                >
                  <Icon v-if="unlockingLockId === lock.id" name="lucide:loader-2" class="size-3 animate-spin" />
                  <Icon v-else name="lucide:lock-keyhole" class="size-3" />
                  Unlock
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  class="h-7 gap-1 px-2 text-xs"
                  @click="openCodesDialog(lock.id)"
                >
                  <Icon name="lucide:key" class="size-3" />
                  Codes {{ codesForLock(lock.id).length }}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  class="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                  title="Rename"
                  @click="startRename(lock.id, lock.name)"
                >
                  <Icon name="lucide:pencil" class="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  class="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                  title="Swap device"
                  @click="startSwap(lock.id)"
                >
                  <Icon name="lucide:refresh-cw" class="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  class="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                  title="Unpair"
                  @click="handleUnpair(lock.id, lock.name)"
                >
                  <Icon name="lucide:trash-2" class="size-3.5" />
                </Button>
              </div>

            </div>
          </div>
        </TabsContent>

        <!-- Rooms tab -->
        <TabsContent value="rooms" class="mt-4 space-y-4">
          <div
            v-if="roomsList.length === 0"
            class="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground"
          >
            This listing has no rooms. Add rooms in the listing setup to pair per-room locks.
          </div>
          <div
            v-for="room in roomsList"
            v-else
            :key="room.id"
            class="space-y-2"
          >
            <div class="flex items-center justify-between gap-2">
              <div class="flex min-w-0 items-center gap-2">
                <Icon name="lucide:door-open" class="size-3.5 shrink-0 text-muted-foreground" />
                <h4 class="truncate text-sm font-medium">
                  {{ room.name }}
                </h4>
                <span class="text-[11px] text-muted-foreground">· {{ room.typeName }}</span>
                <Badge variant="secondary" class="text-[10px]">
                  {{ roomLocksForUnit(room.id).length }}
                </Badge>
              </div>
              <Button
                size="sm"
                variant="ghost"
                class="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                :disabled="availableDevices.length === 0"
                @click="openPairDialog('room', room.id)"
              >
                <Icon name="lucide:plus" class="size-3" />
                Add another
              </Button>
            </div>
            <div v-if="roomLocksForUnit(room.id).length === 0" class="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
              No locks paired to this room.
            </div>
            <div v-else class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <div
                v-for="lock in roomLocksForUnit(room.id)"
                :key="lock.id"
                class="flex flex-col gap-3 rounded-lg border p-4"
              >
                <!-- Header: icon + name + brand + main -->
                <div class="flex items-start gap-2">
                  <div
                    class="flex size-9 shrink-0 items-center justify-center rounded-md border"
                    :class="lock.online ? 'bg-green-500/10' : 'bg-muted'"
                  >
                    <Icon
                      :name="lock.online ? 'lucide:lock' : 'lucide:lock-open'"
                      class="size-4"
                      :class="lock.online ? 'text-green-600' : 'text-muted-foreground'"
                    />
                  </div>
                  <div class="min-w-0 flex-1 space-y-1">
                    <div class="flex items-center gap-1.5">
                      <input
                        v-if="renameLockId === lock.id"
                        v-model="renameValue"
                        class="w-full text-sm font-medium bg-transparent border-b border-primary outline-none"
                        @keydown.enter="commitRename"
                        @keydown.esc="renameLockId = null"
                        @blur="commitRename"
                      >
                      <p v-else class="truncate text-sm font-medium">
                        {{ lock.name }}
                      </p>
                    </div>
                    <div class="flex flex-wrap items-center gap-1.5">
                      <span
                        v-if="getProvider(lock.providerDeviceId)"
                        class="inline-flex items-center gap-0.5 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                        :title="getProvider(lock.providerDeviceId)?.model"
                      >
                        {{ getProvider(lock.providerDeviceId)?.name }}
                      </span>
                      <Badge v-if="lock.isMain" variant="default" class="text-[9px] px-1 py-0">
                        Main
                      </Badge>
                      <span
                        v-if="!lock.isMain"
                        class="cursor-pointer text-muted-foreground hover:text-foreground"
                        title="Set as main"
                        @click="handleSetMain(lock.id)"
                      >
                        <Icon name="lucide:star" class="size-3" />
                      </span>
                    </div>
                  </div>
                </div>

                <!-- Meta -->
                <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                  <span class="inline-flex items-center gap-0.5">
                    <Icon name="lucide:battery" class="size-3" :class="lock.batteryLevel <= 20 ? 'text-amber-500' : 'text-muted-foreground'" />
                    {{ lock.batteryLevel }}%
                  </span>
                  <span class="inline-flex items-center gap-0.5">
                    <span class="size-1.5 rounded-full" :class="lock.online ? 'bg-green-500' : 'bg-muted-foreground/50'" />
                    {{ lock.online ? 'Online' : 'Offline' }}
                  </span>
                </div>

                <!-- Actions -->
                <div class="flex flex-wrap items-center gap-1.5">
                  <Button
                    size="sm"
                    class="h-7 gap-1 px-2 text-xs"
                    :disabled="!lock.online || unlockingLockId === lock.id"
                    @click="handleUnlock(lock.id)"
                  >
                    <Icon v-if="unlockingLockId === lock.id" name="lucide:loader-2" class="size-3 animate-spin" />
                    <Icon v-else name="lucide:lock-keyhole" class="size-3" />
                    Unlock
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    class="h-7 gap-1 px-2 text-xs"
                    @click="openCodesDialog(lock.id)"
                  >
                    <Icon name="lucide:key" class="size-3" />
                    Codes {{ codesForLock(lock.id).length }}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    class="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                    title="Rename"
                    @click="startRename(lock.id, lock.name)"
                  >
                    <Icon name="lucide:pencil" class="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    class="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                    title="Swap device"
                    @click="startSwap(lock.id)"
                  >
                    <Icon name="lucide:refresh-cw" class="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    class="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    title="Unpair"
                    @click="handleUnpair(lock.id, lock.name)"
                  >
                    <Icon name="lucide:trash-2" class="size-3.5" />
                  </Button>
                </div>

              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </Card>

    <Card>
      <CardHeader class="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Guest Guide</CardTitle>
          <CardDescription>Welcome page auto-sent to guests on booking</CardDescription>
        </div>
        <GuideAssignPopover
          :listing-id="listing.id"
          :listing-name="listing.name"
        />
      </CardHeader>
      <CardContent>
        <div v-if="assignedGuide" class="flex items-center justify-between">
          <div>
            <div class="font-medium">{{ assignedGuide.title }}</div>
            <GuideStatusBadge :status="assignedGuide.status" />
          </div>
          <div class="flex gap-2">
            <NuxtLink :to="`/guest-guides/${assignedGuide.id}`">
              <Button variant="outline" size="sm">Edit</Button>
            </NuxtLink>
            <NuxtLink :to="`/guest-guides/${assignedGuide.id}/preview`">
              <Button variant="outline" size="sm">Preview</Button>
            </NuxtLink>
          </div>
        </div>
        <div v-else class="text-sm text-muted-foreground">
          No guide assigned. <NuxtLink to="/guest-guides/new" class="underline">Create one</NuxtLink>.
        </div>
      </CardContent>
    </Card>

    <!-- Invoice Template Card -->
    <Card>
      <CardHeader class="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Invoice Template</CardTitle>
          <CardDescription>Company billing entity and bank account used on guest tax invoices</CardDescription>
        </div>
        <InvoiceTemplateAssignPopover
          :listing-id="listing.id"
          :listing-name="listing.name"
        />
      </CardHeader>
      <CardContent>
        <div v-if="assignedInvoiceTemplate" class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div class="space-y-1">
            <div class="flex items-center gap-2">
              <span class="font-medium text-foreground">{{ assignedInvoiceTemplate.name }}</span>
              <Badge v-if="assignedInvoiceTemplate.isDefault" variant="secondary" class="text-[10px]">
                Default Entity
              </Badge>
            </div>
            <p class="text-xs text-muted-foreground">
              {{ assignedInvoiceTemplate.company.companyName }}
              <span v-if="assignedInvoiceTemplate.company.vatNumber">· {{ assignedInvoiceTemplate.company.vatNumber }}</span>
            </p>
            <p class="text-[11px] text-muted-foreground">
              Bank: {{ assignedInvoiceTemplate.bank.bankName }} ({{ assignedInvoiceTemplate.bank.iban || assignedInvoiceTemplate.bank.accountNumber || '—' }})
            </p>
          </div>

          <div class="flex gap-2 shrink-0">
            <NuxtLink to="/settings/invoice-templates">
              <Button variant="outline" size="sm">
                Manage Templates
              </Button>
            </NuxtLink>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- Codes Dialog (per-lock) -->
    <Dialog v-model:open="codesDialogOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <Icon name="lucide:key" class="size-4 text-primary" />
            Access Codes
          </DialogTitle>
          <DialogDescription>
            Manage access codes for this lock. Codes auto-expire after their scheduled window.
          </DialogDescription>
        </DialogHeader>

        <!-- Codes list -->
        <div class="space-y-2 max-h-56 overflow-y-auto pr-1">
          <div v-if="codesDialogLockId && codesForLock(codesDialogLockId).length === 0" class="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
            No codes generated yet.
          </div>
          <div
            v-for="code in codesDialogLockId ? codesForLock(codesDialogLockId) : []"
            v-else
            :key="code.id"
            class="flex items-start gap-2 rounded-lg border p-3"
          >
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5">
                <Icon name="lucide:user" class="size-3 shrink-0 text-muted-foreground" />
                <span class="truncate text-sm font-medium">
                  {{ code.purpose ?? code.guestName ?? 'Manual code' }}
                </span>
                <Badge
                  variant="outline"
                  class="ml-auto h-4 px-1.5 text-[9px] uppercase tracking-wider"
                  :class="timeStatusClass(getCodeTimeStatus(code))"
                >
                  {{ timeStatusLabel(getCodeTimeStatus(code)) }}
                </Badge>
              </div>
              <div class="mt-1 font-mono text-lg tracking-widest">
                {{ code.code }}
              </div>
              <div class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
                <span v-if="code.scheduleType === 'ongoing'">
                  <Icon name="lucide:infinity" class="mr-0.5 inline size-3" />
                  Ongoing
                </span>
                <span v-else-if="code.scheduleType === 'range'">
                  <Icon name="lucide:clock" class="mr-0.5 inline size-3" />
                  {{ new Date(code.startsAt).toLocaleString() }} → {{ new Date(code.endsAt).toLocaleString() }}
                </span>
                <span v-else>
                  <Icon name="lucide:zap" class="mr-0.5 inline size-3" />
                  Auto · {{ timeUntilExpiry(code.endsAt) }}
                </span>
                <span v-if="code.status === 'revoked'" class="text-destructive">
                  · Revoked
                </span>
              </div>
            </div>
            <Button
              v-if="code.status === 'active'"
              variant="ghost"
              size="sm"
              class="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
              title="Revoke"
              @click="handleRevokeCode(code.id)"
            >
              <Icon name="lucide:trash-2" class="size-3.5" />
            </Button>
          </div>
        </div>

        <!-- Add-code form -->
        <div class="space-y-3 border-t pt-4">
          <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Add code
          </p>

          <!-- Name + code field with Generate button -->
          <div class="space-y-2">
            <Label>Code name</Label>
            <Input v-model="newCodePurpose" placeholder="e.g. Anna Schmidt — Evening access" />
          </div>

          <div class="space-y-2">
            <Label>Code</Label>
            <div class="flex items-center gap-1.5">
              <Input
                v-model="newCodeValue"
                placeholder="6 digits"
                maxlength="6"
                inputmode="numeric"
                class="font-mono tracking-widest"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                class="h-9 gap-1.5 text-xs"
                @click="newCodeValue = generateRandomCode()"
              >
                <Icon name="lucide:refresh-cw" class="size-3.5" />
                Generate
              </Button>
            </div>
            <p class="text-[11px] text-muted-foreground">
              Click Generate to create a random 6-digit code, or type your own.
            </p>
          </div>

          <!-- Schedule type radio -->
          <div class="space-y-2">
            <Label>Schedule</Label>
            <div class="flex gap-0.5 rounded-md border p-0.5">
              <button
                type="button"
                class="flex-1 rounded-sm px-3 py-1.5 text-xs font-medium transition-colors"
                :class="newCodeScheduleType === 'ongoing' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'"
                @click="newCodeScheduleType = 'ongoing'"
              >
                <Icon name="lucide:infinity" class="mr-1 inline size-3" />
                Ongoing
              </button>
              <button
                type="button"
                class="flex-1 rounded-sm px-3 py-1.5 text-xs font-medium transition-colors"
                :class="newCodeScheduleType === 'range' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'"
                @click="newCodeScheduleType = 'range'"
              >
                <Icon name="lucide:clock" class="mr-1 inline size-3" />
                Start/end times
              </button>
            </div>

            <!-- Range pickers -->
            <div v-if="newCodeScheduleType === 'range'" class="grid grid-cols-2 gap-2 pt-1">
              <div class="space-y-1.5">
                <Label class="text-xs">Start</Label>
                <Input v-model="newCodeStartAt" type="datetime-local" />
              </div>
              <div class="space-y-1.5">
                <Label class="text-xs">End</Label>
                <Input v-model="newCodeEndAt" type="datetime-local" />
              </div>
            </div>
            <p v-else class="text-[11px] text-muted-foreground">
              <Icon name="lucide:infinity" class="mr-0.5 inline size-3" />
              Always active. Revoke manually to disable.
            </p>
          </div>

          <p v-if="newCodeError" class="text-[11px] text-destructive">
            {{ newCodeError }}
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" @click="codesDialogOpen = false">
            Close
          </Button>
          <Button
            size="sm"
            class="gap-1.5"
            :disabled="savingNewCode || !newCodePurpose.trim() || !newCodeValue.trim()"
            @click="handleSaveNewCode"
          >
            <Icon v-if="savingNewCode" name="lucide:loader-2" class="size-3.5 animate-spin" />
            <Icon v-else name="lucide:plus" class="size-3.5" />
            Create code
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Pair Lock Dialog -->
    <Dialog v-model:open="showPairDialog">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pair Smart Lock</DialogTitle>
          <DialogDescription>
            Select a smart lock device and choose whether to assign it to the whole property or a specific room.
          </DialogDescription>
        </DialogHeader>
        <div class="space-y-4 py-2">
          <!-- Assign to picker -->
          <div class="space-y-2">
            <Label>Assign to</Label>
            <div class="flex gap-0.5 rounded-md border p-0.5">
              <button
                type="button"
                class="flex-1 rounded-sm px-3 py-1.5 text-xs font-medium transition-colors"
                :class="pairAssignment === 'property' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'"
                @click="pairAssignment = 'property'"
              >
                <Icon name="lucide:building-2" class="mr-1 inline size-3" />
                Property
              </button>
              <button
                type="button"
                class="flex-1 rounded-sm px-3 py-1.5 text-xs font-medium transition-colors"
                :class="pairAssignment === 'room' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'"
                :disabled="allRooms.length === 0"
                @click="pairAssignment = 'room'"
              >
                <Icon name="lucide:door-open" class="mr-1 inline size-3" />
                Room
              </button>
            </div>

            <!-- Room Select (only when Room is chosen) -->
            <div v-if="pairAssignment === 'room'" class="mt-2">
              <Select
                :model-value="pairUnitId"
                @update:model-value="(v) => pairUnitId = String(v)"
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a room" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="room in allRooms"
                    :key="room.id"
                    :value="room.id"
                  >
                    {{ room.name }} <span class="text-muted-foreground text-xs">· {{ room.typeName }}</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div class="space-y-2">
            <Label>Smart Lock Device</Label>
            <div v-if="availableDevices.length === 0" class="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
              All available devices are already paired. Disconnect one to pair another.
            </div>
            <div v-else class="space-y-1.5 max-h-56 overflow-y-auto">
              <button
                v-for="device in availableDevices"
                :key="device.deviceId"
                type="button"
                class="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent"
                :class="selectedDeviceId === device.deviceId ? 'border-primary bg-primary/5' : ''"
                @click="selectedDeviceId = device.deviceId; newLockName = device.name"
              >
                <Icon
                  :name="device.online ? 'lucide:wifi' : 'lucide:wifi-off'"
                  class="size-4 shrink-0"
                  :class="device.online ? 'text-green-600' : 'text-muted-foreground'"
                />
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium">{{ device.name }}</p>
                  <p class="truncate text-[11px] text-muted-foreground">
                    {{ device.model }} · {{ device.provider }}
                  </p>
                </div>
                <span
                  class="text-[11px] font-medium"
                  :class="device.batteryLevel <= 20 ? 'text-amber-600' : 'text-muted-foreground'"
                >
                  {{ device.batteryLevel }}%
                </span>
              </button>
            </div>
          </div>

          <div class="space-y-2">
            <Label>Lock Name (optional)</Label>
            <Input v-model="newLockName" placeholder="e.g., Front Door" />
          </div>

          <label class="flex items-center gap-2 cursor-pointer">
            <input
              v-model="newLockIsMain"
              type="checkbox"
              class="size-4 rounded border-input accent-primary"
            >
            <span class="text-sm">Set as main lock for this {{ pairAssignment === 'room' ? 'room' : 'property' }}</span>
          </label>

          <div class="space-y-2 rounded-md border bg-muted/30 p-3">
            <p class="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Access codes
            </p>
            <p class="text-[11px] text-muted-foreground">
              <Icon name="lucide:user" class="mr-0.5 inline size-3" />
              A code will be auto-generated for each current and future guest.
            </p>
            <label class="flex items-center gap-2 cursor-pointer">
              <input
                v-model="newLockGenerateHousekeepingCode"
                type="checkbox"
                class="size-4 rounded border-input accent-primary"
              >
              <Icon name="lucide:brush-cleaning" class="size-3.5 text-muted-foreground" />
              <span class="text-sm">Also generate code for housekeeping</span>
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" @click="showPairDialog = false">
            Cancel
          </Button>
          <Button
            size="sm"
            :disabled="!selectedDeviceId || (pairAssignment === 'room' && !pairUnitId)"
            class="gap-1.5"
            @click="handlePair"
          >
            <Icon name="lucide:link" class="size-3.5" />
            Pair Lock
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Swap Device Dialog -->
    <Dialog v-model:open="swapDialogOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <Icon name="lucide:refresh-cw" class="size-4 text-primary" />
            Swap Device
          </DialogTitle>
          <DialogDescription>
            Replace the physical device paired to this lock. The lock name, assignment, and main status are kept.
          </DialogDescription>
        </DialogHeader>
        <div class="space-y-3 py-2">
          <div class="rounded-md border bg-muted/30 px-3 py-2 text-xs">
            <span class="text-muted-foreground">Current device:</span>
            <span class="ml-1 font-medium">{{ swapTargetOldDeviceName }}</span>
          </div>

          <div v-if="swappableDevices.length === 0" class="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
            No other devices available to swap to.
          </div>
          <div v-else class="space-y-1.5 max-h-64 overflow-y-auto">
            <button
              v-for="device in swappableDevices"
              :key="device.deviceId"
              type="button"
              class="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent"
              :class="swapTargetDeviceId === device.deviceId ? 'border-primary bg-primary/5' : ''"
              :disabled="device.paired"
              @click="!device.paired && (swapTargetDeviceId = device.deviceId, swapTargetDeviceName = device.name)"
            >
              <Icon
                :name="device.online ? 'lucide:wifi' : 'lucide:wifi-off'"
                class="size-4 shrink-0"
                :class="device.online ? 'text-green-600' : 'text-muted-foreground'"
              />
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium">{{ device.name }}</p>
                <p class="truncate text-[11px] text-muted-foreground">
                  {{ device.model }} · {{ device.provider }}
                </p>
              </div>
              <span
                class="text-[11px] font-medium"
                :class="device.batteryLevel <= 20 ? 'text-amber-600' : 'text-muted-foreground'"
              >
                {{ device.batteryLevel }}%
              </span>
              <Badge v-if="device.paired" variant="outline" class="text-[9px]">
                Paired
              </Badge>
            </button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" @click="swapLockId = null">
            Cancel
          </Button>
          <Button
            size="sm"
            :disabled="!swapTargetDeviceId"
            class="gap-1.5"
            @click="handleSwap"
          >
            <Icon name="lucide:refresh-cw" class="size-3.5" />
            Swap
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
