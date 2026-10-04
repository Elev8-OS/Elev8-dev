<script setup lang="ts">
import type { Listing, Unit, UnitType } from '~/components/listings/data/listings'
import { reservations as allReservations } from '~/components/inbox/data/conversations'
import { toast } from 'vue-sonner'
import { roomCustomCount } from '~/components/listings/data/listing-room-overrides'
import { getUnits } from '~/components/listings/data/listings'
import ListingSetupFieldPanel from '~/components/listings/ListingSetupFieldPanel.vue'
import UnitTypeManager from '~/components/listings/UnitTypeManager.vue'

const props = defineProps<{ listing: Listing }>()
const emit = defineEmits<{ update: [listing: Listing] }>()

const unitTypes = computed(() => props.listing.unitTypes ?? [])
const units = computed(() => getUnits(props.listing))

const activeUnitId = ref(props.listing.activeUnitId ?? units.value[0]?.id ?? '')

// Keep selection valid when units change
watch(units, (next) => {
  if (!next.some(u => u.id === activeUnitId.value))
    activeUnitId.value = next[0]?.id ?? ''
}, { immediate: true })

const activeUnit = computed(() => units.value.find(u => u.id === activeUnitId.value))
const activeUnitType = computed(() =>
  unitTypes.value.find(ut => ut.units.some(u => u.id === activeUnitId.value)) ?? null,
)

function selectUnit(id: string) {
  activeUnitId.value = id
}

const showAddRoom = ref(false)
const newRoomName = ref('')
const newRoomTypeId = ref(unitTypes.value[0]?.id ?? '')

watch(showAddRoom, (open) => {
  if (open) {
    newRoomName.value = ''
    newRoomTypeId.value = activeUnitType.value?.id ?? unitTypes.value[0]?.id ?? ''
  }
})

function addRoom() {
  const name = newRoomName.value.trim()
  const typeId = newRoomTypeId.value
  if (!name || !typeId)
    return
  const targetType = unitTypes.value.find(t => t.id === typeId)
  if (!targetType)
    return
  const newUnit: Unit = {
    id: `un-${Date.now()}`,
    name,
    identifier: `${targetType.identifier || targetType.name.toLowerCase().replace(/\s+/g, '')}${targetType.units.length + 1}`,
  }
  emit('update', {
    ...props.listing,
    unitTypes: unitTypes.value.map(t =>
      t.id === typeId ? { ...t, units: [...t.units, newUnit] } : t,
    ),
  })
  activeUnitId.value = newUnit.id
  showAddRoom.value = false
  toast.success(`"${name}" added to ${targetType.name}`)
}

const showTypesDialog = ref(false)

function removeRoom(unitId: string) {
  const unit = units.value.find(u => u.id === unitId)
  if (!unit)
    return
  emit('update', {
    ...props.listing,
    unitTypes: unitTypes.value.map(t => ({
      ...t,
      units: t.units.filter(u => u.id !== unitId),
    })),
  })
  if (activeUnitId.value === unitId) {
    const remaining = units.value.filter(u => u.id !== unitId)
    activeUnitId.value = remaining[0]?.id ?? ''
  }
  toast.success(`"${unit.name}" removed`)
}

const expandedTypes = ref<Set<string>>(new Set(unitTypes.value.map(t => t.id)))

function toggleType(id: string) {
  const next = new Set(expandedTypes.value)
  next.has(id) ? next.delete(id) : next.add(id)
  expandedTypes.value = next
}

const smartLock = useSmartLock()

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
function getRoomLockCount(unitId: string): number {
  return smartLock.getLockCount(props.listing.id, unitId)
}
function getRoomLocks(unitId: string) {
  return smartLock.getLocksForUnit(props.listing.id, unitId)
}

// Per-room lock management dialog
const showRoomLockDialog = ref(false)
const roomLockDialogUnitId = ref<string | null>(null)
const roomLockDialogUnitName = ref('')
const roomPairDeviceId = ref('')
const roomPairName = ref('')
const roomPairIsMain = ref(false)
const roomPairGenerateHousekeepingCode = ref(false)
const roomPairExtraPurpose = ref<string>('Housekeeping')
const roomPairCustomPurpose = ref('')
const showRoomPairForm = ref(false)

function openRoomLockDialog(unitId: string, unitName: string) {
  roomLockDialogUnitId.value = unitId
  roomLockDialogUnitName.value = unitName
  roomPairDeviceId.value = ''
  roomPairName.value = ''
  roomPairIsMain.value = false
  roomPairGenerateHousekeepingCode.value = false
  roomPairExtraPurpose.value = 'Housekeeping'
  roomPairCustomPurpose.value = ''
  showRoomPairForm.value = false
  showRoomLockDialog.value = true
}

function startRoomPair() {
  showRoomPairForm.value = true
  const isFirst = getRoomLockCount(roomLockDialogUnitId.value ?? '') === 0
  roomPairIsMain.value = isFirst
}

async function handleRoomPair() {
  if (!roomLockDialogUnitId.value || !roomPairDeviceId.value) return
  const result = smartLock.pairLock({
    providerDeviceId: roomPairDeviceId.value,
    name: roomPairName.value.trim(),
    assignment: 'room',
    listingId: props.listing.id,
    unitId: roomLockDialogUnitId.value,
    isMain: roomPairIsMain.value,
  })
  if (!result.success) {
    toast.error(result.error ?? 'Failed to pair lock.')
    return
  }

  // Look up device provider for brand-shared code generation
  const device = smartLock.allDevices.value.find(d => d.deviceId === roomPairDeviceId.value)
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
        code: existingCode,
      })
      if (r.code) {
        const tag = existingCode ? '(shared)' : '(new)'
        generatedSummaries.push(`${reservation.guestDetails.name}: ${r.code.code} ${tag}`)
      }
    }
  }

  // Optional extra code for a custom purpose (per-lock)
  if (roomPairGenerateHousekeepingCode.value) {
    const purpose = roomPairExtraPurpose.value === 'custom'
      ? roomPairCustomPurpose.value.trim() || 'Custom'
      : roomPairExtraPurpose.value
    if (purpose) {
      const r = await smartLock.generateAccessCode({
        lockId: result.lock!.id,
        guestName: purpose,
        purpose,
      })
      if (r.code) generatedSummaries.push(`${purpose}: ${r.code.code}`)
    }
  }

  if (generatedSummaries.length > 0) {
    const summary = generatedSummaries.length > 3
      ? `${generatedSummaries.slice(0, 3).join(', ')} +${generatedSummaries.length - 3} more`
      : generatedSummaries.join(', ')
    toast.success(`"${result.lock!.name}" paired to ${roomLockDialogUnitName.value}. Codes: ${summary}`)
  }
  else {
    toast.success(`"${result.lock!.name}" paired to ${roomLockDialogUnitName.value}.`)
  }
  roomPairDeviceId.value = ''
  roomPairName.value = ''
  showRoomPairForm.value = false
}

function handleRoomUnpair(lockId: string, name: string) {
  smartLock.unpairLock(lockId)
  toast.info(`"${name}" unpaired.`)
}

function handleRoomSetMain(lockId: string) {
  smartLock.setMainLock(lockId)
  toast.success('Main lock updated.')
}

function getRoomLockProvider(lockId: string): { name: string, model: string } | null {
  const lock = smartLock.locks.value.find(l => l.id === lockId)
  if (!lock) return null
  const device = smartLock.allDevices.value.find(d => d.deviceId === lock.providerDeviceId)
  if (!device) return null
  return { name: device.provider.charAt(0).toUpperCase() + device.provider.slice(1), model: device.model }
}

const roomSwapLockId = ref<string | null>(null)
const roomSwapDeviceId = ref('')
const roomSwapDeviceName = ref('')
const roomSwapOldDeviceName = ref('')

function startRoomSwap(lockId: string) {
  const lock = smartLock.locks.value.find(l => l.id === lockId)
  if (!lock) return
  const oldDevice = smartLock.allDevices.value.find(d => d.deviceId === lock.providerDeviceId)
  roomSwapLockId.value = lockId
  roomSwapDeviceId.value = ''
  roomSwapOldDeviceName.value = oldDevice?.name ?? 'current device'
}

function handleRoomSwap() {
  if (!roomSwapLockId.value || !roomSwapDeviceId.value) return
  const result = smartLock.swapDevice(roomSwapLockId.value, roomSwapDeviceId.value)
  if (!result.success) {
    toast.error(result.error ?? 'Failed to swap device.')
    return
  }
  toast.success('Device swapped.')
  roomSwapLockId.value = null
  roomSwapDeviceId.value = ''
  roomSwapDeviceName.value = ''
}

const roomSwappableDevices = computed(() => {
  if (!roomSwapLockId.value) return []
  const lock = smartLock.locks.value.find(l => l.id === roomSwapLockId.value)
  if (!lock) return []
  return smartLock.allDevices.value.filter(d => d.deviceId !== lock.providerDeviceId)
})

const roomSwapDialogOpen = computed({
  get: () => roomSwapLockId.value !== null,
  set: (val: boolean) => {
    if (!val) roomSwapLockId.value = null
  },
})

const availableDevices = computed(() => smartLock.availableDevices.value)
</script>

<template>
  <div class="flex h-full min-h-0">
    <!-- Sidebar: rooms grouped by type -->
    <div class="w-[280px] flex-shrink-0 border-r flex flex-col bg-muted/20">
      <!-- Same height as the room editor's header (h-24), so the two bottom borders meet. -->
      <div class="flex h-24 flex-shrink-0 flex-col justify-center border-b px-4">
        <h3 class="text-base font-semibold">
          Rooms
        </h3>
        <p class="text-xs text-muted-foreground mt-0.5">
          {{ units.length }} room{{ units.length !== 1 ? 's' : '' }} across {{ unitTypes.length }} type{{ unitTypes.length !== 1 ? 's' : '' }}
        </p>
      </div>

      <div class="flex-1 overflow-y-auto min-h-0">
        <div v-if="unitTypes.length === 0" class="px-3 py-6 text-center">
          <Icon name="lucide:layers" class="size-7 text-muted-foreground/50 mx-auto mb-2" />
          <p class="text-sm text-muted-foreground">
            No room types yet
          </p>
        </div>

        <div v-else class="flex flex-col py-1.5">
          <div v-for="ut in unitTypes" :key="ut.id" class="flex flex-col">
            <!-- Type header -->
            <button
              type="button"
              class="flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors w-full"
              @click="toggleType(ut.id)"
            >
              <Icon
                name="lucide:chevron-right"
                class="size-3.5 transition-transform shrink-0"
                :class="expandedTypes.has(ut.id) ? 'rotate-90' : ''"
              />
              <Icon name="lucide:layers" class="size-3.5 shrink-0" />
              <span class="flex-1 text-left truncate">{{ ut.name }}</span>
              <span class="text-xs text-muted-foreground">{{ ut.units.length }}</span>
            </button>

            <!-- Rooms in this type -->
            <div v-if="expandedTypes.has(ut.id)" class="flex flex-col">
              <button
                v-for="unit in ut.units"
                :key="unit.id"
                type="button"
                class="group flex items-center gap-2 pl-8 pr-2 py-2 text-sm hover:bg-accent transition-colors w-full text-left"
                :class="activeUnitId === unit.id ? 'bg-accent text-accent-foreground font-medium' : ''"
                @click="selectUnit(unit.id)"
              >
                <Icon
                  :name="activeUnitId === unit.id ? 'lucide:door-open' : 'lucide:door-closed'"
                  class="size-3.5 shrink-0"
                  :class="activeUnitId === unit.id ? 'text-foreground' : 'text-muted-foreground'"
                />
                <span class="flex-1 truncate" :class="unit.status === 'inactive' ? 'text-muted-foreground line-through' : ''">
                  {{ unit.name }}
                </span>
                <!-- How many settings this room sets for itself (the rest come from the property). -->
                <span
                  v-if="roomCustomCount(unit)"
                  class="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium leading-none text-amber-800 dark:bg-amber-500/20 dark:text-amber-300"
                  :title="`${roomCustomCount(unit)} custom for this room`"
                  data-testid="room-custom-count"
                >
                  {{ roomCustomCount(unit) }} custom
                </span>
                <button
                  v-if="getRoomLockCount(unit.id) > 0"
                  type="button"
                  class="inline-flex items-center gap-0.5 rounded-full bg-amber-500/15 px-2 py-1 text-[10px] font-medium text-amber-700 hover:bg-amber-500/25 transition-colors"
                  :title="`${getRoomLockCount(unit.id)} smart lock${getRoomLockCount(unit.id) !== 1 ? 's' : ''} paired — click to manage`"
                  @click.stop="openRoomLockDialog(unit.id, unit.name)"
                >
                  <Icon name="lucide:lock" class="size-3" />
                  {{ getRoomLockCount(unit.id) }}
                </button>
                <button
                  v-else-if="smartLock.isConnected.value"
                  type="button"
                  class="opacity-0 group-hover:opacity-100 inline-flex items-center gap-0.5 rounded-full bg-muted px-2 py-1 text-[10px] font-medium text-muted-foreground hover:bg-amber-500/15 hover:text-amber-700 transition-all"
                  title="Pair a smart lock to this room"
                  @click.stop="openRoomLockDialog(unit.id, unit.name)"
                >
                  <Icon name="lucide:lock-keyhole" class="size-3" />
                  Lock
                </button>
                <button
                  v-if="ut.units.length > 1"
                  type="button"
                  class="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                  @click.stop="removeRoom(unit.id)"
                >
                  <Icon name="lucide:x" class="size-3.5" />
                </button>
              </button>

              <!-- No rooms placeholder -->
              <p v-if="ut.units.length === 0" class="pl-8 pr-3 py-2 text-xs text-muted-foreground italic">
                No rooms in this type
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Sidebar footer actions -->
      <div class="border-t p-3 flex flex-col gap-2 flex-shrink-0">
        <Button
          variant="outline"
          size="default"
          class="w-full gap-2 text-sm justify-start h-10"
          @click="showAddRoom = true"
        >
          <Icon name="lucide:plus" class="size-4" />
          Add Room
        </Button>
        <Button
          variant="ghost"
          size="default"
          class="w-full gap-2 text-sm justify-start h-10 text-muted-foreground"
          @click="showTypesDialog = true"
        >
          <Icon name="lucide:settings-2" class="size-4" />
          Manage Room Types
        </Button>
      </div>
    </div>

    <!-- Main area: room editor -->
    <div class="flex-1 min-w-0 flex flex-col">
      <div v-if="activeUnit" class="flex-1 min-h-0">
        <ListingSetupFieldPanel
          :listing="listing"
          view-mode="unit"
          :active-unit-id="activeUnitId"
          @update="emit('update', $event)"
        />
      </div>
      <div v-else class="flex-1 flex items-center justify-center">
        <div class="text-center max-w-sm px-6">
          <Icon name="lucide:door-open" class="size-10 text-muted-foreground/50 mx-auto mb-3" />
          <p class="text-sm font-medium">
            No room selected
          </p>
          <p class="text-xs text-muted-foreground mt-1">
            Add a room or pick one from the sidebar to start editing.
          </p>
          <Button size="sm" class="mt-4 gap-1.5" @click="showAddRoom = true">
            <Icon name="lucide:plus" class="size-3.5" />
            Add your first room
          </Button>
        </div>
      </div>
    </div>

    <!-- Add Room Dialog -->
    <Dialog v-model:open="showAddRoom">
      <DialogContent class="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Room</DialogTitle>
          <DialogDescription>
            Add a new room to one of your room types.
          </DialogDescription>
        </DialogHeader>
        <div class="flex flex-col gap-4 py-2">
          <div class="flex flex-col gap-1.5">
            <Label>Room Type</Label>
            <Select :model-value="newRoomTypeId" @update:model-value="(v) => newRoomTypeId = String(v)">
              <SelectTrigger>
                <SelectValue placeholder="Select a type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="ut in unitTypes" :key="ut.id" :value="ut.id">
                  {{ ut.name }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="flex flex-col gap-1.5">
            <Label>Room Name *</Label>
            <Input v-model="newRoomName" placeholder="e.g., Master Suite, Garden Unit" @keydown.enter="addRoom" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" @click="showAddRoom = false">
            Cancel
          </Button>
          <Button size="sm" :disabled="!newRoomName.trim() || !newRoomTypeId" @click="addRoom">
            <Icon name="lucide:check" class="size-3.5 mr-1.5" />
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Manage Room Types Dialog -->
    <Dialog v-model:open="showTypesDialog">
      <DialogContent class="h-[85vh] max-h-[85vh] w-[calc(100vw-2rem)] max-w-5xl sm:max-w-5xl flex flex-col p-0 gap-0">
        <DialogHeader class="px-6 py-4 border-b flex-shrink-0">
          <DialogTitle class="flex items-center gap-2">
            <Icon name="lucide:settings-2" class="size-4" />
            Manage Room Types
          </DialogTitle>
          <DialogDescription>
            Add, edit, or remove room types for {{ listing.name }}.
          </DialogDescription>
        </DialogHeader>
        <div class="flex-1 overflow-y-auto min-h-0 px-6 py-4">
          <UnitTypeManager :listing="listing" @update="emit('update', $event)" />
        </div>
        <DialogFooter class="px-6 py-4 border-t flex-shrink-0">
          <Button size="sm" @click="showTypesDialog = false">
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Per-room Smart Lock dialog -->
    <Dialog v-model:open="showRoomLockDialog">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <Icon name="lucide:lock" class="size-4 text-amber-600" />
            Smart Locks — {{ roomLockDialogUnitName }}
          </DialogTitle>
          <DialogDescription>
            Pair smart lock devices to this room. The main lock receives guest access codes by default.
          </DialogDescription>
        </DialogHeader>

        <div class="space-y-3 max-h-[55vh] overflow-y-auto px-1">
          <!-- Empty state (not connected) -->
          <div v-if="!smartLock.isConnected.value" class="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
            Connect Smart Lock in
            <NuxtLink to="/settings/integrations" class="text-primary underline">
              Settings → Integrations
            </NuxtLink>
            to pair smart locks.
          </div>

          <!-- Empty state (no locks yet) -->
          <div
            v-else-if="getRoomLocks(roomLockDialogUnitId ?? '').length === 0 && !showRoomPairForm"
            class="rounded-lg border border-dashed p-6 text-center"
          >
            <Icon name="lucide:lock-keyhole" class="mx-auto mb-2 size-5 text-muted-foreground/60" />
            <p class="text-xs text-muted-foreground">
              No smart locks paired to this room yet.
            </p>
          </div>

          <!-- Existing locks list -->
          <div v-else class="space-y-2">
            <div
              v-for="lock in getRoomLocks(roomLockDialogUnitId ?? '')"
              :key="lock.id"
              class="flex items-center gap-2 rounded-lg border p-2.5"
            >
              <Icon
                :name="lock.online ? 'lucide:lock' : 'lucide:lock-open'"
                class="size-4 shrink-0"
                :class="lock.online ? 'text-green-600' : 'text-muted-foreground'"
              />
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-1">
                  <p class="truncate text-sm font-medium">{{ lock.name }}</p>
                  <span
                    v-if="getRoomLockProvider(lock.id)"
                    class="inline-flex items-center gap-0.5 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                    :title="getRoomLockProvider(lock.id)?.model"
                  >
                    {{ getRoomLockProvider(lock.id)?.name }}
                  </span>
                  <Badge v-if="lock.isMain" variant="default" class="text-[9px] px-1 py-0">Main</Badge>
                </div>
                <p class="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Icon name="lucide:battery" class="size-2.5" :class="lock.batteryLevel <= 20 ? 'text-amber-500' : ''" />
                  {{ lock.batteryLevel }}%
                </p>
              </div>
              <button
                v-if="!lock.isMain"
                type="button"
                class="text-muted-foreground hover:text-foreground"
                title="Set as main"
                @click="handleRoomSetMain(lock.id)"
              >
                <Icon name="lucide:star" class="size-3.5" />
              </button>
              <button
                type="button"
                class="text-muted-foreground hover:text-foreground"
                title="Swap device"
                @click="startRoomSwap(lock.id)"
              >
                <Icon name="lucide:refresh-cw" class="size-3.5" />
              </button>
              <button
                type="button"
                class="text-muted-foreground hover:text-destructive"
                title="Unpair"
                @click="handleRoomUnpair(lock.id, lock.name)"
              >
                <Icon name="lucide:trash-2" class="size-3.5" />
              </button>
            </div>
          </div>

          <!-- Add Lock form (collapsible) -->
          <div v-if="showRoomPairForm" class="space-y-3 rounded-lg border bg-muted/30 p-3">
            <div class="flex items-center justify-between">
              <span class="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Pair new lock
              </span>
              <button
                type="button"
                class="text-muted-foreground hover:text-foreground"
                @click="showRoomPairForm = false"
              >
                <Icon name="lucide:x" class="size-3.5" />
              </button>
            </div>

            <div v-if="availableDevices.length === 0" class="rounded border border-dashed p-3 text-center text-xs text-muted-foreground">
              All available devices are already paired. Disconnect one to pair another.
            </div>
            <div v-else class="space-y-1.5 max-h-40 overflow-y-auto">
              <button
                v-for="device in availableDevices"
                :key="device.deviceId"
                type="button"
                class="flex w-full items-center gap-2 rounded-md border p-2 text-left transition-colors hover:bg-accent"
                :class="roomPairDeviceId === device.deviceId ? 'border-primary bg-primary/5' : ''"
                @click="roomPairDeviceId = device.deviceId; roomPairName = device.name"
              >
                <Icon
                  :name="device.online ? 'lucide:wifi' : 'lucide:wifi-off'"
                  class="size-3.5 shrink-0"
                  :class="device.online ? 'text-green-600' : 'text-muted-foreground'"
                />
                <div class="min-w-0 flex-1">
                  <p class="truncate text-xs font-medium">{{ device.name }}</p>
                  <p class="truncate text-[10px] text-muted-foreground">
                    {{ device.model }} · {{ device.batteryLevel }}%
                  </p>
                </div>
              </button>
            </div>

            <div class="space-y-1.5">
              <Label class="text-xs">Lock Name (optional)</Label>
              <Input v-model="roomPairName" placeholder="e.g., Front Door" class="h-8 text-sm" />
            </div>

            <label class="flex items-center gap-2 cursor-pointer">
              <input
                v-model="roomPairIsMain"
                type="checkbox"
                class="size-3.5 rounded border-input accent-primary"
              >
              <span class="text-xs">Set as main lock for this room</span>
            </label>

            <div class="space-y-1 rounded-md border bg-background p-2">
              <p class="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                Access codes
              </p>
              <p class="text-[10px] text-muted-foreground">
                <Icon name="lucide:user" class="mr-0.5 inline size-2.5" />
                Auto-generate a code for each current/future guest
                <span v-if="relevantReservations.length === 0">(no guests)</span>
                <span v-else>({{ relevantReservations.length }})</span>.
                Same brand = shared code value.
              </p>
              <label class="flex items-center gap-2 cursor-pointer">
                <input
                  v-model="roomPairGenerateHousekeepingCode"
                  type="checkbox"
                  class="size-3.5 rounded border-input accent-primary"
                >
                <Icon name="lucide:key" class="size-3 text-muted-foreground" />
                <span class="text-xs">Also generate for:</span>
              </label>
              <div v-if="roomPairGenerateHousekeepingCode" class="flex flex-col gap-1.5 pl-5">
                <Select
                  :model-value="roomPairExtraPurpose"
                  @update:model-value="(v) => roomPairExtraPurpose = String(v)"
                >
                  <SelectTrigger class="h-7 text-xs">
                    <SelectValue placeholder="Select purpose" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Housekeeping">Housekeeping</SelectItem>
                    <SelectItem value="Maintenance">Maintenance</SelectItem>
                    <SelectItem value="Vendor">Vendor</SelectItem>
                    <SelectItem value="Owner">Owner</SelectItem>
                    <SelectItem value="Manager">Manager</SelectItem>
                    <SelectItem value="custom">Custom…</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  v-if="roomPairExtraPurpose === 'custom'"
                  v-model="roomPairCustomPurpose"
                  placeholder="e.g., Photographer, Inspector"
                  class="h-7 text-xs"
                />
              </div>
            </div>

            <Button
              size="sm"
              class="w-full gap-1.5"
              :disabled="!roomPairDeviceId"
              @click="handleRoomPair"
            >
              <Icon name="lucide:link" class="size-3.5" />
              Pair to room
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button
            v-if="smartLock.isConnected.value && !showRoomPairForm"
            variant="outline"
            size="sm"
            class="gap-1.5"
            :disabled="availableDevices.length === 0"
            @click="startRoomPair"
          >
            <Icon name="lucide:plus" class="size-3.5" />
            Add Lock
          </Button>
          <Button size="sm" variant="ghost" @click="showRoomLockDialog = false">
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Per-room Swap Device Dialog -->
    <Dialog v-model:open="roomSwapDialogOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <Icon name="lucide:refresh-cw" class="size-4 text-primary" />
            Swap Device
          </DialogTitle>
          <DialogDescription>
            Replace the physical device paired to this room's lock. The lock name and main status are kept.
          </DialogDescription>
        </DialogHeader>
        <div class="space-y-3 py-2">
          <div class="rounded-md border bg-muted/30 px-3 py-2 text-xs">
            <span class="text-muted-foreground">Current device:</span>
            <span class="ml-1 font-medium">{{ roomSwapOldDeviceName }}</span>
          </div>

          <div v-if="roomSwappableDevices.length === 0" class="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
            No other devices available to swap to.
          </div>
          <div v-else class="space-y-1.5 max-h-64 overflow-y-auto">
            <button
              v-for="device in roomSwappableDevices"
              :key="device.deviceId"
              type="button"
              class="flex w-full items-center gap-2 rounded-md border p-2 text-left transition-colors hover:bg-accent"
              :class="roomSwapDeviceId === device.deviceId ? 'border-primary bg-primary/5' : ''"
              :disabled="device.paired"
              @click="!device.paired && (roomSwapDeviceId = device.deviceId, roomSwapDeviceName = device.name)"
            >
              <Icon
                :name="device.online ? 'lucide:wifi' : 'lucide:wifi-off'"
                class="size-3.5 shrink-0"
                :class="device.online ? 'text-green-600' : 'text-muted-foreground'"
              />
              <div class="min-w-0 flex-1">
                <p class="truncate text-xs font-medium">{{ device.name }}</p>
                <p class="truncate text-[10px] text-muted-foreground">
                  {{ device.model }} · {{ device.batteryLevel }}%
                </p>
              </div>
              <Badge v-if="device.paired" variant="outline" class="text-[9px]">Paired</Badge>
            </button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" @click="roomSwapLockId = null">
            Cancel
          </Button>
          <Button
            size="sm"
            :disabled="!roomSwapDeviceId"
            class="gap-1.5"
            @click="handleRoomSwap"
          >
            <Icon name="lucide:refresh-cw" class="size-3.5" />
            Swap
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
