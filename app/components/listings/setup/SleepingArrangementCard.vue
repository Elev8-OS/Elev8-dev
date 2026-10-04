<script setup lang="ts">
import type { Bed, Listing } from '~/components/listings/data/listings'
import { BED_TYPES, bedArea, capacityCheck, newBed, setSleepingExtras, setUnitTypeBeds, sleepingAreas } from '~/components/listings/data/listing-sleeping'

/**
 * The beds of a room's room type, per bedroom (the room type's bedroom count)
 * plus other sleeping areas, and what can be added on request. Shared by every
 * room of that type, so the card names them, and the total is checked against
 * the room type's max guests.
 */
const props = defineProps<{ listing: Listing, unitTypeId: string }>()
const emit = defineEmits<{ update: [listing: Listing] }>()

const unitType = computed(() => props.listing.unitTypes?.find(ut => ut.id === props.unitTypeId))
const beds = computed(() => unitType.value?.beds ?? [])
const areas = computed(() => unitType.value ? sleepingAreas(unitType.value) : [])
const capacity = computed(() => unitType.value ? capacityCheck(unitType.value) : { sleeps: 0, max: 0, status: 'match' as const })
const sharedWith = computed(() => unitType.value?.units.map(u => u.name) ?? [])
const sharedNote = computed(() => `Shared by every ${unitType.value?.name} room${sharedWith.value.length ? `: ${sharedWith.value.join(', ')}` : ''}.`)
const guestsNote = computed(() => {
  const ut = unitType.value
  if (!ut)
    return ''
  const parts = [`${ut.maxAdults} ${ut.maxAdults === 1 ? 'adult' : 'adults'}`]
  if (ut.maxChildren)
    parts.push(`${ut.maxChildren} ${ut.maxChildren === 1 ? 'child' : 'children'}`)
  return parts.join(', ')
})

function bedsIn(room: number) {
  return unitType.value ? beds.value.filter(b => bedArea(b, unitType.value!) === room) : []
}
function writeBeds(next: Bed[]) {
  emit('update', setUnitTypeBeds(props.listing, props.unitTypeId, next))
}
function patchBed(id: string, patch: Partial<Bed>) {
  writeBeds(beds.value.map(b => b.id === id ? { ...b, ...patch } : b))
}
function stepCount(bed: Bed, delta: number) {
  const count = Math.max(1, Math.min(10, bed.count + delta))
  if (count !== bed.count)
    patchBed(bed.id, { count })
}
</script>

<template>
  <div v-if="unitType" class="flex flex-col gap-4 rounded-lg border p-4" data-testid="sleeping-arrangement">
    <div class="flex items-start justify-between gap-3">
      <div class="flex flex-col gap-0.5">
        <h3 class="text-sm font-medium">
          Sleeping arrangement
        </h3>
        <p class="text-xs text-muted-foreground">
          {{ sharedNote }}
        </p>
      </div>
      <span
        class="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium"
        :class="capacity.status === 'short' ? 'border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/20 dark:text-amber-300' : ''"
        data-testid="sleeping-sleeps"
      >
        <Icon name="lucide:users" class="size-3.5" />
        Sleeps {{ capacity.sleeps }} of {{ capacity.max }}
      </span>
    </div>

    <!-- Room type settings this follows -->
    <p class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground" data-testid="sleeping-room-type">
      <span class="inline-flex items-center gap-1"><Icon name="lucide:door-closed" class="size-3.5" />{{ unitType.bedrooms }} {{ unitType.bedrooms === 1 ? 'bedroom' : 'bedrooms' }}</span>
      <span class="inline-flex items-center gap-1"><Icon name="lucide:users" class="size-3.5" />Max {{ guestsNote }}</span>
      <span>From the {{ unitType.name }} room type settings</span>
    </p>

    <p
      v-if="capacity.status !== 'match'"
      class="flex items-start gap-1.5 rounded-md px-3 py-2 text-xs"
      :class="capacity.status === 'short' ? 'bg-amber-50 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200' : 'bg-muted/50 text-muted-foreground'"
      role="status"
      data-testid="sleeping-capacity-note"
    >
      <Icon :name="capacity.status === 'short' ? 'lucide:triangle-alert' : 'lucide:info'" class="mt-0.5 size-3.5 shrink-0" />
      <template v-if="capacity.status === 'short'">
        The beds sleep {{ capacity.sleeps }}, but this room type allows {{ capacity.max }} guests. Add beds, or lower the max guests in the room type settings.
      </template>
      <template v-else>
        The beds sleep {{ capacity.sleeps }}, more than the {{ capacity.max }} guests this room type allows.
      </template>
    </p>

    <!-- One section per bedroom, then other sleeping areas -->
    <div v-for="area in areas" :key="area.room" class="flex flex-col gap-2" :data-testid="`sleeping-area-${area.room}`">
      <span class="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon :name="area.room ? 'lucide:bed-double' : 'lucide:sofa'" class="size-3.5" />
        {{ area.label }}
      </span>
      <div v-for="bed in bedsIn(area.room)" :key="bed.id" class="flex items-center gap-2" data-testid="sleeping-bed">
        <Select :model-value="bed.type" @update:model-value="(v) => patchBed(bed.id, { type: String(v) })">
          <SelectTrigger class="h-9 flex-1" :aria-label="`Bed type in ${area.label}`">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="t in BED_TYPES" :key="t.type" :value="t.type">
              {{ t.type }}
            </SelectItem>
          </SelectContent>
        </Select>
        <div class="flex items-center rounded-md border" role="group" :aria-label="`How many ${bed.type}s`">
          <Button variant="ghost" size="icon" class="size-9 rounded-r-none" :disabled="bed.count <= 1" :aria-label="`One less ${bed.type}`" @click="stepCount(bed, -1)">
            <Icon name="lucide:minus" class="size-3.5" />
          </Button>
          <span class="w-8 text-center text-sm tabular-nums" data-testid="sleeping-count">{{ bed.count }}</span>
          <Button variant="ghost" size="icon" class="size-9 rounded-l-none" :disabled="bed.count >= 10" :aria-label="`One more ${bed.type}`" @click="stepCount(bed, 1)">
            <Icon name="lucide:plus" class="size-3.5" />
          </Button>
        </div>
        <Button variant="ghost" size="icon" class="size-9 shrink-0 text-muted-foreground hover:text-destructive" :aria-label="`Remove ${bed.type}`" @click="writeBeds(beds.filter(b => b.id !== bed.id))">
          <Icon name="lucide:trash-2" class="size-4" />
        </Button>
      </div>
      <Button variant="ghost" size="sm" class="h-8 w-fit gap-1.5 px-2 text-xs" :data-testid="`sleeping-add-${area.room}`" @click="writeBeds([...beds, newBed(area.room, area.room ? 'Double Bed' : 'Sofa Bed')])">
        <Icon name="lucide:plus" class="size-3.5" />
        Add bed
      </Button>
    </div>

    <div class="flex flex-col gap-2 border-t pt-3">
      <span class="text-xs font-medium text-muted-foreground">On request</span>
      <div class="flex items-center justify-between gap-3">
        <Label for="sleeping-extra-bed" class="font-normal">Extra bed</Label>
        <Switch
          id="sleeping-extra-bed"
          :model-value="!!unitType.sleepingExtras?.extraBed"
          @update:model-value="(v: boolean) => emit('update', setSleepingExtras(listing, unitTypeId, { extraBed: v }))"
        />
      </div>
      <div class="flex items-center justify-between gap-3">
        <Label for="sleeping-baby-cot" class="font-normal">Baby cot<span v-if="unitType.maxInfants" class="text-muted-foreground"> (room type allows {{ unitType.maxInfants }} {{ unitType.maxInfants === 1 ? 'infant' : 'infants' }})</span></Label>
        <Switch
          id="sleeping-baby-cot"
          :model-value="!!unitType.sleepingExtras?.babyCot"
          @update:model-value="(v: boolean) => emit('update', setSleepingExtras(listing, unitTypeId, { babyCot: v }))"
        />
      </div>
    </div>
  </div>
</template>
