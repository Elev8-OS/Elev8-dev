<script setup lang="ts">
import type { UnitType } from '~/components/listings/data/listings'
import { toast } from 'vue-sonner'
import { otaIcon } from '~/components/channels/data/channels'
import { roomAiStatus, setRoomAi } from '~/components/listings/data/listing-ai-status'
import { listings } from '~/components/listings/data/listings'

/**
 * A multi-unit listing's rooms as rows of the listings table, under the
 * listing and lined up with its columns: a row per room type (how many of its
 * rooms have ElevAI on), then a row per room (its on/off switch in the status
 * column, its ElevAI switch in the AI Status column, its channels in the OTA
 * column). Turning a room off also pauses its ElevAI. The listing's own switch
 * already turns every room on or off.
 */
const props = defineProps<{
  listingId: string
  /** The table's visible column ids, in order, so the cells line up. */
  columnIds: string[]
}>()

const listing = computed(() => listings.value.find(l => l.id === props.listingId)!)

function toggleUnit(unitId: string) {
  const idx = listings.value.findIndex(l => l.id === props.listingId)
  if (idx === -1)
    return
  const currentListing = listings.value[idx]!
  const unitTypes = currentListing.unitTypes?.map(ut => ({
    ...ut,
    units: ut.units.map((u) => {
      if (u.id !== unitId)
        return u
      const deactivating = u.status !== 'inactive'
      return { ...u, status: (deactivating ? 'inactive' : 'active') as 'active' | 'inactive', aiStatus: (deactivating ? 'paused' : 'active') as 'active' | 'paused' }
    }),
  }))
  // derive property status from units
  const allUnits = unitTypes?.flatMap(ut => ut.units) ?? []
  const allOff = allUnits.every(u => u.status === 'inactive')
  const newStatus = allOff ? 'inactive' : 'active'
  const anyAi = allUnits.some(u => u.aiStatus === 'active' || (u.aiStatus === undefined && u.status !== 'inactive'))
  listings.value[idx] = { ...currentListing, status: newStatus, aiStatus: anyAi ? 'active' : 'paused', unitTypes }
  const toggled = allUnits.find(u => u.id === unitId)
  toast[toggled?.status === 'inactive' ? 'info' : 'success'](`${toggled?.name} ${toggled?.status === 'inactive' ? 'deactivated' : 'activated'}`)
}

function toggleRoomAi(unitId: string, name: string, on: boolean) {
  const idx = listings.value.findIndex(l => l.id === props.listingId)
  if (idx === -1)
    return
  listings.value[idx] = setRoomAi(listings.value[idx]!, unitId, on)
  toast[on ? 'success' : 'info'](`ElevAI ${on ? 'activated' : 'paused'} for ${name}`)
}

function roomsAiOn(unitType: UnitType) {
  return unitType.units.filter(u => roomAiStatus(unitType, u) === 'active').length
}
</script>

<template>
  <template v-if="listing">
    <template v-for="unitType in listing.unitTypes" :key="unitType.id">
      <!-- Room type -->
      <TableRow class="bg-muted/30 hover:bg-muted/40" data-testid="listing-rooms-type">
        <TableCell v-for="col in columnIds" :key="col" :class="col === 'status' ? 'w-12 pr-1' : 'py-2'">
          <div v-if="col === 'name'" class="flex items-center gap-2 pl-5">
            <Icon name="lucide:layers" class="size-3.5 shrink-0 text-muted-foreground" />
            <span class="text-xs font-medium">{{ unitType.name }}</span>
            <span class="text-xs text-muted-foreground">· {{ unitType.units.length }} {{ unitType.units.length === 1 ? 'room' : 'rooms' }}</span>
          </div>
          <span v-else-if="col === 'aiStatus'" class="text-xs text-muted-foreground" data-testid="listing-rooms-type-ai">
            ElevAI on {{ roomsAiOn(unitType) }} of {{ unitType.units.length }}
          </span>
        </TableCell>
      </TableRow>

      <!-- Rooms of that type -->
      <TableRow v-for="unit in unitType.units" :key="unit.id" class="hover:bg-muted/20" data-testid="listing-rooms-room">
        <TableCell v-for="col in columnIds" :key="col" :class="col === 'status' ? 'w-12 pr-1' : 'py-2'">
          <Switch
            v-if="col === 'status'"
            class="ml-0.5"
            :model-value="unit.status !== 'inactive'"
            :aria-label="`${unit.name} active`"
            @update:model-value="toggleUnit(unit.id)"
          />
          <div v-else-if="col === 'name'" class="flex items-center gap-2 pl-10">
            <Icon name="lucide:door-closed" class="size-3.5 shrink-0" :class="unit.status === 'inactive' ? 'text-muted-foreground/50' : 'text-muted-foreground'" />
            <span class="text-sm" :class="unit.status === 'inactive' ? 'text-muted-foreground' : ''">{{ unit.name }}</span>
            <Badge v-if="unit.status === 'inactive'" variant="outline" class="px-1.5 py-0 text-[10px] text-muted-foreground">
              Inactive
            </Badge>
          </div>
          <div v-else-if="col === 'aiStatus'" class="flex items-center gap-2">
            <Switch
              :model-value="roomAiStatus(unitType, unit) === 'active'"
              :aria-label="`ElevAI for ${unit.name}`"
              data-testid="listing-room-ai"
              @update:model-value="(v: boolean) => toggleRoomAi(unit.id, unit.name, v)"
            />
            <span class="text-xs" :class="roomAiStatus(unitType, unit) === 'active' ? 'text-foreground' : 'text-muted-foreground'">
              {{ roomAiStatus(unitType, unit) === 'active' ? 'ElevAI on' : 'ElevAI off' }}
            </span>
          </div>
          <div v-else-if="col === 'otaConnected'" class="flex items-center gap-1.5">
            <Icon
              v-for="ota in (unit.otaConnected ?? listing.otaConnected)"
              :key="ota"
              :name="otaIcon(ota)"
              class="size-4"
              :class="unit.status === 'inactive' ? 'opacity-30' : ''"
              :aria-label="ota"
            />
          </div>
        </TableCell>
      </TableRow>
    </template>
  </template>
</template>
