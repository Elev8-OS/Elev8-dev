<script setup lang="ts">
import type { Listing, UnitType } from '~/components/listings/data/listings'
import type { PropertySelection } from '~/components/website-builder/data/property-listings'
import { computed, ref } from 'vue'
import { getUnits, listings } from '~/components/listings/data/listings'

/**
 * Picks listings, and inside a multi-unit listing its room types and rooms, from the real Listings data.
 * Ticking a listing or room type ticks everything under it; unticking the last room unticks the listing.
 * `propertyIds` are the listing ids with at least one room picked (or a ticked single-unit listing),
 * `roomIds` the picked rooms (units).
 */
const model = defineModel<PropertySelection>({ required: true })

const search = ref('')
const expanded = ref<string[]>([])

const unitTypes = (l: Listing): UnitType[] => l.unitTypes ?? []
const isMulti = (l: Listing) => unitTypes(l).length > 0

const visible = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q)
    return listings.value
  return listings.value.filter(l =>
    `${l.name} ${l.location} ${l.property}`.toLowerCase().includes(q)
    || unitTypes(l).some(t => t.name.toLowerCase().includes(q) || t.units.some(u => u.name.toLowerCase().includes(q))),
  )
})

type State = 'all' | 'some' | 'none'

function listingState(l: Listing): State {
  if (!isMulti(l))
    return model.value.propertyIds.includes(l.id) ? 'all' : 'none'
  return stateOf(getUnits(l).map(u => u.id))
}
function typeState(t: UnitType): State {
  return stateOf(t.units.map(u => u.id))
}
function stateOf(ids: string[]): State {
  const n = ids.filter(id => model.value.roomIds.includes(id)).length
  return n === 0 ? 'none' : n === ids.length ? 'all' : 'some'
}

/** Writes the rooms, then derives `propertyIds` from them so the two never disagree. */
function commit(roomIds: string[], singles: string[]) {
  const propertyIds = listings.value
    .filter(l => isMulti(l) ? getUnits(l).some(u => roomIds.includes(u.id)) : singles.includes(l.id))
    .map(l => l.id)
  model.value = { propertyIds, roomIds }
}

const singlesPicked = () => model.value.propertyIds.filter(id => !isMulti(listings.value.find(l => l.id === id)!))

function setUnits(ids: string[], on: boolean) {
  const rest = model.value.roomIds.filter(id => !ids.includes(id))
  commit(on ? [...rest, ...ids] : rest, singlesPicked())
}

function toggleListing(l: Listing) {
  if (isMulti(l)) {
    setUnits(getUnits(l).map(u => u.id), listingState(l) !== 'all')
    return
  }
  const singles = singlesPicked()
  commit(model.value.roomIds, singles.includes(l.id) ? singles.filter(id => id !== l.id) : [...singles, l.id])
}
function toggleType(t: UnitType) {
  setUnits(t.units.map(u => u.id), typeState(t) !== 'all')
}
function toggleUnit(id: string) {
  setUnits([id], !model.value.roomIds.includes(id))
}

function toggleExpanded(id: string) {
  expanded.value = expanded.value.includes(id) ? expanded.value.filter(x => x !== id) : [...expanded.value, id]
}
const isOpen = (l: Listing) => !!search.value.trim() || expanded.value.includes(l.id)

const selectedCount = computed(() => model.value.propertyIds.length)
const roomCount = computed(() => model.value.roomIds.length)

function selectAll() {
  const roomIds = listings.value.flatMap(l => getUnits(l).map(u => u.id))
  commit(roomIds, listings.value.filter(l => !isMulti(l)).map(l => l.id))
}
function clearAll() {
  model.value = { propertyIds: [], roomIds: [] }
}
</script>

<template>
  <div class="flex flex-col gap-3" data-testid="listing-room-picker">
    <div class="flex flex-wrap items-center gap-2">
      <BaseSearchInput v-model="search" placeholder="Search listings, room types or rooms..." class="sm:max-w-sm" />
      <div class="ml-auto flex items-center gap-1">
        <Button variant="ghost" size="sm" class="h-8 text-xs" data-testid="lrp-select-all" @click="selectAll">
          Select all
        </Button>
        <Button variant="ghost" size="sm" class="h-8 text-xs text-muted-foreground" :disabled="selectedCount === 0" data-testid="lrp-clear" @click="clearAll">
          Clear
        </Button>
      </div>
    </div>

    <p class="text-xs text-muted-foreground" data-testid="lrp-summary">
      {{ selectedCount }} {{ selectedCount === 1 ? 'listing' : 'listings' }}<template v-if="roomCount > 0">
        , {{ roomCount }} {{ roomCount === 1 ? 'room' : 'rooms' }}
      </template> selected
    </p>

    <ul class="divide-y overflow-hidden rounded-lg border bg-card">
      <li v-for="l in visible" :key="l.id" data-testid="lrp-listing">
        <div class="flex items-center gap-3 px-4 py-3">
          <div
            class="flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-[4px] border"
            :class="listingState(l) === 'none' ? 'border-input' : 'border-primary bg-primary text-primary-foreground'"
            role="checkbox"
            tabindex="0"
            :aria-checked="listingState(l) === 'all' ? 'true' : listingState(l) === 'some' ? 'mixed' : 'false'"
            :aria-label="`Select ${l.name}`"
            @click="toggleListing(l)"
            @keydown.space.prevent="toggleListing(l)"
            @keydown.enter.prevent="toggleListing(l)"
          >
            <Icon v-if="listingState(l) === 'all'" name="lucide:check" class="size-3" />
            <Icon v-else-if="listingState(l) === 'some'" name="lucide:minus" class="size-3" />
          </div>
          <div class="min-w-0 flex-1 cursor-pointer" @click="toggleListing(l)">
            <p class="truncate text-sm font-medium">
              {{ l.name }}
            </p>
            <p class="truncate text-xs text-muted-foreground">
              {{ l.location }}<template v-if="isMulti(l)">
                · {{ getUnits(l).length }} {{ getUnits(l).length === 1 ? 'room' : 'rooms' }}
              </template>
            </p>
          </div>
          <Button
            v-if="isMulti(l)"
            variant="ghost"
            size="icon-sm"
            :aria-label="isOpen(l) ? `Hide rooms of ${l.name}` : `Show rooms of ${l.name}`"
            :aria-expanded="isOpen(l)"
            @click="toggleExpanded(l.id)"
          >
            <Icon name="lucide:chevron-down" class="size-4 transition-transform" :class="isOpen(l) && 'rotate-180'" aria-hidden="true" />
          </Button>
        </div>

        <div v-if="isMulti(l) && isOpen(l)" class="space-y-1 border-t bg-muted/30 px-4 py-3 pl-11" data-testid="lrp-types">
          <div v-for="t in unitTypes(l)" :key="t.id">
            <div class="flex cursor-pointer items-center gap-2 py-1" @click="toggleType(t)">
              <div
                class="flex size-4 shrink-0 items-center justify-center rounded-[4px] border"
                :class="typeState(t) === 'none' ? 'border-input' : 'border-primary bg-primary text-primary-foreground'"
                role="checkbox"
                :aria-checked="typeState(t) === 'all' ? 'true' : typeState(t) === 'some' ? 'mixed' : 'false'"
                :aria-label="`Select room type ${t.name}`"
              >
                <Icon v-if="typeState(t) === 'all'" name="lucide:check" class="size-3" />
                <Icon v-else-if="typeState(t) === 'some'" name="lucide:minus" class="size-3" />
              </div>
              <span class="text-sm font-medium">{{ t.name }}</span>
              <span class="text-xs text-muted-foreground">{{ t.units.length }} {{ t.units.length === 1 ? 'room' : 'rooms' }}</span>
            </div>
            <div class="ml-6 flex flex-wrap gap-x-4 gap-y-1">
              <div v-for="u in t.units" :key="u.id" class="flex cursor-pointer items-center gap-2 py-0.5" data-testid="lrp-unit" @click="toggleUnit(u.id)">
                <div
                  class="flex size-4 shrink-0 items-center justify-center rounded-[4px] border"
                  :class="model.roomIds.includes(u.id) ? 'border-primary bg-primary text-primary-foreground' : 'border-input'"
                  role="checkbox"
                  :aria-checked="model.roomIds.includes(u.id)"
                  :aria-label="`Select room ${u.name}`"
                >
                  <Icon v-if="model.roomIds.includes(u.id)" name="lucide:check" class="size-3" />
                </div>
                <span class="text-sm">{{ u.name }}</span>
              </div>
            </div>
          </div>
        </div>
      </li>
      <li v-if="visible.length === 0" class="px-4 py-8 text-center text-sm text-muted-foreground">
        No listings found.
      </li>
    </ul>
  </div>
</template>
