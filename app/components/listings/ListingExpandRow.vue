<script setup lang="ts">
import { toast } from 'vue-sonner'
import { otaIcon } from '~/components/channels/data/channels'
import { getUnits, getUnitTypes, listings } from '~/components/listings/data/listings'

const props = defineProps<{ listingId: string }>()

const listing = computed(() => listings.value.find(l => l.id === props.listingId)!)

function toggleProperty() {
  const idx = listings.value.findIndex(l => l.id === props.listingId)
  if (idx === -1)
    return
  const currentListing = listings.value[idx]!
  const allOff = getUnits(currentListing).every(u => u.status === 'inactive')
  // if all off → turn all on; if any on → turn all off
  const newUnitStatus = allOff ? 'active' : 'inactive'
  const unitTypes = currentListing.unitTypes?.map(ut => ({
    ...ut,
    units: ut.units.map(u => ({ ...u, status: newUnitStatus as 'active' | 'inactive' })),
    aiStatus: (newUnitStatus === 'inactive' ? 'paused' : 'active') as 'paused' | 'active',
  }))
  const newStatus = newUnitStatus === 'inactive' ? 'inactive' : 'active'
  listings.value[idx] = { ...currentListing, status: newStatus, aiStatus: newStatus === 'inactive' ? 'paused' : 'active', unitTypes }
  toast[newStatus === 'inactive' ? 'info' : 'success'](`All units ${newStatus === 'inactive' ? 'deactivated' : 'activated'}`)
}

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
      return { ...u, status: (deactivating ? 'inactive' : 'active') as 'active' | 'inactive' }
    }),
  }))
  // derive property status from units
  const allUnits = unitTypes?.flatMap(ut => ut.units) ?? []
  const allOff = allUnits.every(u => u.status === 'inactive')
  const newStatus = allOff ? 'inactive' : 'active'
  listings.value[idx] = { ...currentListing, status: newStatus, aiStatus: allOff ? 'paused' : 'active', unitTypes }
  const toggled = allUnits.find(u => u.id === unitId)
  toast[toggled?.status === 'inactive' ? 'info' : 'success'](`${toggled?.name} ${toggled?.status === 'inactive' ? 'deactivated' : 'activated'}`)
}

function toggleUnitTypeAi(unitTypeId: string) {
  const idx = listings.value.findIndex(l => l.id === props.listingId)
  if (idx === -1)
    return
  const currentListing = listings.value[idx]!
  const unitTypes = currentListing.unitTypes?.map((ut) => {
    if (ut.id !== unitTypeId)
      return ut
    const current = ut.aiStatus ?? 'active'
    return { ...ut, aiStatus: (current === 'active' ? 'paused' : 'active') as 'active' | 'paused' }
  })
  // derive listing-level aiStatus from unit types
  const allUnitTypes = getUnitTypes({ ...currentListing, unitTypes })
  const allOff = allUnitTypes.every(ut => ut.aiStatus === 'paused')
  const anyOn = allUnitTypes.some(ut => (ut.aiStatus ?? 'active') === 'active')
  const derivedAi: 'active' | 'paused' | 'not_set' = allOff ? 'paused' : (anyOn ? 'active' : 'not_set')
  listings.value[idx] = { ...currentListing, aiStatus: derivedAi, unitTypes }
  const toggled = allUnitTypes.find(ut => ut.id === unitTypeId)
  toast[derivedAi === 'paused' ? 'info' : 'success'](`${toggled?.name} AI ${toggled?.aiStatus === 'paused' ? 'paused' : 'activated'}`)
}
</script>

<template>
  <div v-if="listing" class="mt-2 border-l-2 border-muted ml-1 pl-3 space-y-1">
    <!-- Property-level toggle -->
    <div class="flex items-center justify-between gap-2 py-1">
      <span class="text-xs font-medium text-muted-foreground">Property</span>
      <Switch
        :model-value="getUnits(listing).some(u => u.status !== 'inactive')"
        @update:model-value="toggleProperty"
      />
    </div>
    <div class="border-t border-muted" />

    <!-- Per unit type -->
    <template v-for="unitType in listing.unitTypes" :key="unitType.id">
      <!-- Unit type header (AI toggle lives here) -->
      <div class="flex items-center justify-between gap-2 py-1">
        <div class="flex items-center gap-1.5 min-w-0">
          <Icon name="lucide:layers" class="size-3 shrink-0 text-muted-foreground" />
          <span class="text-xs font-medium text-muted-foreground truncate">{{ unitType.name }}</span>
        </div>
        <button
          type="button"
          class="text-[10px] px-1.5 py-0.5 rounded transition-colors"
          :class="(unitType.aiStatus ?? 'active') === 'active' ? 'bg-[#C8A84B]/15 text-[#C8A84B]' : 'bg-muted text-muted-foreground'"
          @click.stop="toggleUnitTypeAi(unitType.id)"
        >
          {{ (unitType.aiStatus ?? 'active') === 'active' ? 'AI On' : 'AI Off' }}
        </button>
      </div>

      <!-- Per-unit rows -->
      <div
        v-for="unit in unitType.units"
        :key="unit.id"
        class="flex items-center justify-between gap-2 py-1 pl-3"
      >
        <div class="flex items-center gap-1.5 min-w-0 flex-1">
          <Icon name="lucide:door-open" class="size-3 shrink-0" :class="unit.status === 'inactive' ? 'text-muted-foreground/40' : 'text-muted-foreground'" />
          <span class="text-xs truncate" :class="unit.status === 'inactive' ? 'text-muted-foreground/50 line-through' : ''">{{ unit.name }}</span>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <!-- OTA icons -->
          <template v-for="ota in (unit.otaConnected ?? listing.otaConnected)" :key="ota">
            <Icon :name="otaIcon(ota)" class="size-3" :class="unit.status === 'inactive' ? 'opacity-30' : ''" />
          </template>
          <!-- Unit toggle -->
          <Switch
            :model-value="unit.status !== 'inactive'"
            @update:model-value="toggleUnit(unit.id)"
          />
        </div>
      </div>
    </template>
  </div>
</template>
