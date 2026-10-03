<script setup lang="ts">
import type { Listing } from '~/components/listings/data/listings'
import { toast } from 'vue-sonner'
import { getUnits, listings } from '~/components/listings/data/listings'

const props = defineProps<{ listing: Listing }>()
const router = useRouter()

const isInactive = computed(() => props.listing.status === 'inactive')

const aiStatusLabel = computed(() => props.listing.aiStatus === 'active' ? 'Pause AI' : 'Activate AI')

function viewDetail() {
  router.push(`/listings/${props.listing.id}`)
}

function toggleListing() {
  const idx = listings.value.findIndex(l => l.id === props.listing.id)
  if (idx === -1)
    return
  const newStatus = isInactive.value ? 'active' : 'inactive'
  listings.value[idx] = { ...listings.value[idx], status: newStatus }
  toast.success(`Listing ${newStatus === 'inactive' ? 'deactivated' : 'activated'}`)
}

function toggleUnit(unitId: string) {
  const idx = listings.value.findIndex(l => l.id === props.listing.id)
  if (idx === -1)
    return
  const listing = listings.value[idx]!
  const unitTypes = listing.unitTypes?.map(ut => ({
    ...ut,
    units: ut.units.map(u =>
      u.id === unitId ? { ...u, status: (u.status === 'inactive' ? 'active' : 'inactive') as 'active' | 'inactive' } : u,
    ),
  }))
  listings.value[idx] = { ...listing, unitTypes }
  const unit = getUnits(listing).find(u => u.id === unitId)
  toast.success(`${unit?.name} ${unit?.status === 'inactive' ? 'deactivated' : 'activated'}`)
}

function toggleAi() {
  const idx = listings.value.findIndex(l => l.id === props.listing.id)
  if (idx === -1)
    return
  const aiStatus = listings.value[idx]!.aiStatus === 'active' ? 'paused' : 'active'
  listings.value[idx] = { ...listings.value[idx]!, aiStatus }
}
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="ghost" size="sm" class="h-8 w-8 p-0">
        <Icon name="lucide:ellipsis-vertical" class="size-4" />
        <span class="sr-only">Open menu</span>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="w-48">
      <DropdownMenuItem class="gap-2" @click="viewDetail">
        <Icon name="lucide:eye" class="size-4" />
        View Detail
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem class="gap-2" @click="toggleListing">
        <Icon :name="isInactive ? 'lucide:toggle-right' : 'lucide:toggle-left'" class="size-4" />
        {{ isInactive ? 'Activate Listing' : 'Deactivate Listing' }}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem class="gap-2" @click="toggleAi">
        <SharedAiIcon :custom-class="listing.aiStatus === 'active' ? 'size-4' : 'size-4 grayscale opacity-50'" />
        {{ aiStatusLabel }}
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
