<script setup lang="ts">
import { toast } from 'vue-sonner'
import { getUnits, listings } from '~/components/listings/data/listings'

const props = defineProps<{ listingId: string }>()

const listing = computed(() => listings.value.find(l => l.id === props.listingId)!)

function toggle() {
  const idx = listings.value.findIndex(l => l.id === props.listingId)
  if (idx === -1)
    return
  const currentListing = listings.value[idx]!
  const isMulti = currentListing.unitType === 'multi'
  const newStatus = listing.value.status === 'inactive' ? 'active' : 'inactive'
  if (isMulti) {
    const isOn = getUnits(currentListing).some(u => u.status !== 'inactive')
    const newUnitStatus = isOn ? 'inactive' : 'active'
    const unitTypes = currentListing.unitTypes?.map(ut => ({
      ...ut,
      units: ut.units.map(u => ({ ...u, status: newUnitStatus as 'active' | 'inactive', aiStatus: (newUnitStatus === 'inactive' ? 'paused' : 'active') as 'paused' | 'active' })),
      aiStatus: (newUnitStatus === 'inactive' ? 'paused' : 'active') as 'paused' | 'active',
    }))
    listings.value[idx] = { ...currentListing, status: newUnitStatus, aiStatus: newUnitStatus === 'inactive' ? 'paused' : 'active', unitTypes }
    toast[newUnitStatus === 'inactive' ? 'info' : 'success'](`Listing ${newUnitStatus === 'inactive' ? 'deactivated' : 'activated'}`)
  }
  else {
    listings.value[idx] = { ...currentListing, status: newStatus, aiStatus: newStatus === 'inactive' ? 'paused' : 'active' }
    toast[newStatus === 'inactive' ? 'info' : 'success'](`Listing ${newStatus === 'inactive' ? 'deactivated' : 'activated'}`)
  }
}
</script>

<template>
  <Switch
    v-if="listing"
    :model-value="listing.unitType === 'multi' ? getUnits(listing).some(u => u.status !== 'inactive') : listing.status !== 'inactive'"
    @update:model-value="toggle"
  />
</template>
