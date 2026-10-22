<script setup lang="ts">
import type { DistanceUnit, NearbyPlace } from '~/components/listings/data/listing-content'
import type { Listing } from '~/components/listings/data/listings'
import { computed, ref } from 'vue'
import { formatDistance, listingNearbyPlaces, NEARBY_PLACE_TYPES, sortNearby, toMeters } from '~/components/listings/data/listing-content'

/**
 * Places near the listing and how far they are, which channels show as
 * "nearby" (airport, beach, supermarket...). Closest first.
 */
const props = defineProps<{ listing: Listing }>()
const emit = defineEmits<{ update: [listing: Listing] }>()

const places = computed(() => sortNearby(listingNearbyPlaces(props.listing)))
const open = ref<string[]>(places.value.length ? ['nearby'] : [])

const editingId = ref<string | null>(null)
const type = ref('')
const name = ref('')
const distance = ref('')
const unit = ref<DistanceUnit>('m')

const meters = computed(() => toMeters(distance.value, unit.value))
const canSave = computed(() => !!type.value && meters.value !== null)

function reset() {
  editingId.value = null
  type.value = ''
  name.value = ''
  distance.value = ''
  unit.value = 'm'
}

function edit(place: NearbyPlace) {
  editingId.value = place.id
  type.value = place.type
  name.value = place.name
  unit.value = place.meters >= 1000 ? 'km' : 'm'
  distance.value = String(unit.value === 'km' ? place.meters / 1000 : place.meters)
}

function save() {
  if (!canSave.value)
    return
  const place: NearbyPlace = { id: editingId.value ?? `np-${Date.now().toString(36)}`, type: type.value, name: name.value.trim(), meters: meters.value! }
  const current = listingNearbyPlaces(props.listing)
  const next = editingId.value ? current.map(p => p.id === place.id ? place : p) : [...current, place]
  emit('update', { ...props.listing, nearbyPlaces: next })
  reset()
}

function remove(id: string) {
  emit('update', { ...props.listing, nearbyPlaces: listingNearbyPlaces(props.listing).filter(p => p.id !== id) })
  if (editingId.value === id)
    reset()
}
</script>

<template>
  <Accordion v-model="open" type="multiple" class="rounded-lg border px-4" data-testid="setup-nearby">
    <AccordionItem value="nearby">
      <AccordionTrigger class="items-center hover:no-underline">
        <span class="flex flex-1 items-center gap-2">Nearby places</span>
        <span class="text-xs font-normal text-muted-foreground">
          {{ places.length ? `${places.length} ${places.length === 1 ? 'place' : 'places'}` : 'None yet' }}
        </span>
      </AccordionTrigger>
      <AccordionContent class="flex flex-col gap-4 px-0.5">
        <p class="text-xs text-muted-foreground">
          Channels show these under the listing, e.g. "Beach 300 m". Add what guests ask about.
        </p>

        <ul v-if="places.length" class="flex flex-col divide-y rounded-lg border">
          <li v-for="place in places" :key="place.id" class="flex items-center gap-3 px-3 py-2" :class="editingId === place.id ? 'bg-muted/60' : ''">
            <div class="min-w-0 flex-1 text-sm">
              <span class="font-medium">{{ place.type }}</span>
              <span v-if="place.name" class="text-muted-foreground"> · {{ place.name }}</span>
            </div>
            <span class="shrink-0 text-sm tabular-nums">{{ formatDistance(place.meters) }}</span>
            <Button variant="ghost" size="icon" class="size-8" :aria-label="`Edit ${place.type}`" @click="edit(place)">
              <Icon name="lucide:pencil" class="size-4" />
            </Button>
            <Button variant="ghost" size="icon" class="size-8 text-destructive hover:text-destructive" :aria-label="`Remove ${place.type}`" @click="remove(place.id)">
              <Icon name="lucide:trash-2" class="size-4" />
            </Button>
          </li>
        </ul>

        <div class="grid gap-3 sm:grid-cols-[1fr_1fr_auto]" :aria-label="editingId ? 'Edit place' : 'Add a place'" role="group">
          <div class="flex flex-col gap-1.5">
            <Label for="nearby-type" class="text-xs">Place</Label>
            <Select v-model="type">
              <SelectTrigger id="nearby-type" class="w-full">
                <SelectValue placeholder="Choose" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="t in NEARBY_PLACE_TYPES" :key="t" :value="t">
                  {{ t }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="nearby-name" class="text-xs">Name (optional)</Label>
            <Input id="nearby-name" v-model="name" placeholder="e.g. Ngurah Rai International" />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="nearby-distance" class="text-xs">Distance</Label>
            <div class="flex gap-1.5">
              <Input id="nearby-distance" v-model="distance" inputmode="decimal" class="w-24" @keydown.enter.prevent="save" />
              <Select v-model="unit">
                <SelectTrigger class="w-20" aria-label="Distance unit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="m">
                    m
                  </SelectItem>
                  <SelectItem value="km">
                    km
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <div class="flex gap-2">
          <Button size="sm" :disabled="!canSave" data-testid="nearby-save" @click="save">
            {{ editingId ? 'Save place' : 'Add place' }}
          </Button>
          <Button v-if="editingId" size="sm" variant="ghost" @click="reset">
            Cancel
          </Button>
        </div>
      </AccordionContent>
    </AccordionItem>
  </Accordion>
</template>
