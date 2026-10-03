<script setup lang="ts">
import type { ListingAddress } from '~/components/listings/data/listing-address'
import type { AvoidTopic } from '~/components/listings/data/listing-avoid-topics'
import type { ListingSetupSection } from '~/components/listings/data/listing-setup-progress'
import type { Listing, Unit } from '~/components/listings/data/listings'
import { toast } from 'vue-sonner'
import AvoidTopicDialog from '~/components/listings/AvoidTopicDialog.vue'
import { countryName, LISTING_COUNTRIES, listingAddress, listingPropertyType, listingTimeZone, locationLabel, PROPERTY_TYPES, timeZoneOptions } from '~/components/listings/data/listing-address'
import { amenityConfigKey, LISTING_ROOMS_TARGET, PROPERTY_AMENITY_GROUPS, propertyAmenityGroups, ROOM_AMENITY_GROUPS, roomAmenityTargets, setRoomAmenities, toggleAmenity } from '~/components/listings/data/listing-amenities'
import { AVOID_TOPIC_ACTIONS, avoidTopicActionLabel, avoidTopicStagesLabel, copyAvoidTopicsToListings, listingAvoidTopics, removeAvoidTopic, removeAvoidTopics, saveAvoidTopic } from '~/components/listings/data/listing-avoid-topics'
import { LISTING_DETAIL_GROUPS } from '~/components/listings/data/listing-details'
import { addCustomSop, copySopsToListings, customSopConfigKey, customSopCounts, customSopSelectionId, customSopsIn, deleteSops, removeCustomSop, removedSopFieldsIn, restoreSopGroup, selectableSopIds, SOP_GROUPS, updateCustomSop, visibleSopGroups } from '~/components/listings/data/listing-sops'
import { getUnitById } from '~/components/listings/data/listings'
import FieldConfigDialog from '~/components/listings/FieldConfigDialog.vue'
import ListingSetupFieldGroups from '~/components/listings/ListingSetupFieldGroups.vue'
import SetupBulkBar from '~/components/listings/setup/SetupBulkBar.vue'
import SetupSelectBox from '~/components/listings/setup/SetupSelectBox.vue'

const props = defineProps<{
  listing: Listing
  viewMode?: 'property' | 'unit'
  activeUnitId?: string
  /** Hide the tab bar when the parent drives `section` (the setup page's sidebar). */
  hideNav?: boolean
}>()
const emit = defineEmits<{ update: [listing: Listing] }>()

const activeUnit = computed(() => props.activeUnitId ? getUnitById(props.listing, props.activeUnitId) : undefined)
function updateUnit(patch: Partial<Unit>) {
  const unitTypes = props.listing.unitTypes?.map(ut => ({
    ...ut,
    units: ut.units.map(u => u.id === props.activeUnitId ? { ...u, ...patch } : u),
  }))
  emit('update', { ...props.listing, unitTypes })
}

const configField = ref<{ key: string, label: string } | null>(null)
function openConfig(key: string, label: string) { configField.value = { key, label } }
function hasConfig(key: string) { return !!props.listing.resources.fieldConfig?.[key] }

const activeTab = defineModel<ListingSetupSection>('section', { default: 'basics' })

function updateResources(patch: Partial<Listing['resources']>) {
  emit('update', { ...props.listing, resources: { ...props.listing.resources, ...patch } })
}
const address = computed(() => listingAddress(props.listing))
const timeZone = computed(() => listingTimeZone(props.listing))
const propertyType = computed(() => listingPropertyType(props.listing))
const timeZones = computed(() => timeZoneOptions(timeZone.value))

/** Writes the address and keeps the `location` label shown across the app in step. */
function updateAddress(patch: Partial<ListingAddress>) {
  const next = { ...address.value, ...patch }
  emit('update', { ...props.listing, address: next, location: locationLabel(next, props.listing.location) })
}
const locationComplete = computed(() => !!propertyType.value && (['street', 'city', 'state', 'postalCode', 'country'] as const).every(k => !!address.value[k].trim()))
// Unfinished cards start open, finished ones collapsed. Set once, so a card
// does not snap shut the moment its last field is filled in.
const openLocation = ref(locationComplete.value ? [] : ['location'])

function updateListingField<K extends keyof Listing>(key: K, value: Listing[K]) {
  emit('update', { ...props.listing, [key]: value })
}

// Amenities: Property (`listing.amenities`) or Room (per room type). The Rooms
// view shows only the room amenities of the selected room's type.
const amenityKind = ref<'property' | 'room'>('property')
const amenitySearch = ref('')
const roomTargets = computed(() => roomAmenityTargets(props.listing))
const roomTargetId = ref(roomTargets.value[0]?.id ?? LISTING_ROOMS_TARGET)
const activeUnitTypeId = computed(() => props.listing.unitTypes?.find(ut => ut.units.some(u => u.id === props.activeUnitId))?.id)
const shownKind = computed(() => props.viewMode === 'unit' ? 'room' : amenityKind.value)
const roomTarget = computed(() => {
  const id = props.viewMode === 'unit' ? activeUnitTypeId.value : roomTargetId.value
  return roomTargets.value.find(t => t.id === id) ?? roomTargets.value[0]
})
const selectedAmenities = computed(() => shownKind.value === 'property' ? props.listing.amenities : roomTarget.value?.amenities ?? [])
/** The shown kind's groups, narrowed by the search; a group with no match is hidden. */
const visibleAmenityGroups = computed(() => {
  const groups = shownKind.value === 'property' ? propertyAmenityGroups(props.listing) : ROOM_AMENITY_GROUPS
  const q = amenitySearch.value.trim().toLowerCase()
  return groups
    .map(g => ({ ...g, items: q ? g.items.filter(a => a.toLowerCase().includes(q)) : g.items }))
    .filter(g => g.items.length)
})
// Every group starts open; a search reopens them all so no match hides in a collapsed one.
const openAmenityGroups = ref<string[]>([...PROPERTY_AMENITY_GROUPS, ...ROOM_AMENITY_GROUPS].map(g => g.key).concat('other'))
watch(amenitySearch, (q) => {
  if (q.trim())
    openAmenityGroups.value = visibleAmenityGroups.value.map(g => g.key)
})
function toggleAmenityRow(name: string) {
  if (shownKind.value === 'property')
    emit('update', { ...props.listing, amenities: toggleAmenity(props.listing.amenities, name) })
  else if (roomTarget.value)
    emit('update', setRoomAmenities(props.listing, roomTarget.value.id, toggleAmenity(roomTarget.value.amenities, name)))
}
function amenityKey(name: string) {
  return shownKind.value === 'property' ? amenityConfigKey('property', name) : amenityConfigKey('room', name, roomTarget.value?.id)
}

// Bulk select on SOPs and Topics to Avoid. A selection drops ids that are no
// longer selectable (an answer cleared, a topic removed).
const selectingSops = ref(false)
const selectedSops = ref<string[]>([])
watch(selectingSops, (on) => {
  if (!on)
    selectedSops.value = []
})
const customSopSelectable = computed(() => Object.fromEntries(
  SOP_GROUPS.map(g => [g.key, customSopsIn(props.listing, g.key).map(s => customSopSelectionId(s.id))]),
))
const sopSelectable = computed(() => selectableSopIds(props.listing))
watch(sopSelectable, (ids) => { selectedSops.value = selectedSops.value.filter(id => ids.includes(id)) })
function toggleSop(id: string) {
  selectedSops.value = selectedSops.value.includes(id) ? selectedSops.value.filter(x => x !== id) : [...selectedSops.value, id]
}
function copySelectedSops(targetIds: string[]) {
  const count = copySopsToListings(props.listing, selectedSops.value, targetIds)
  toast.success(`${selectedSops.value.length} ${selectedSops.value.length === 1 ? 'SOP' : 'SOPs'} copied to ${count} ${count === 1 ? 'listing' : 'listings'}`)
  selectedSops.value = []
}
function deleteSelectedSops() {
  const n = selectedSops.value.length
  emit('update', deleteSops(props.listing, selectedSops.value))
  selectedSops.value = []
  toast.success(`${n} ${n === 1 ? 'SOP' : 'SOPs'} deleted`)
}

const selectingTopics = ref(false)
const selectedTopics = ref<string[]>([])
watch(selectingTopics, (on) => {
  if (!on)
    selectedTopics.value = []
})

const avoidTopics = computed(() => listingAvoidTopics(props.listing))
watch(avoidTopics, (topics) => { selectedTopics.value = selectedTopics.value.filter(id => topics.some(t => t.id === id)) })
function copySelectedTopics(targetIds: string[]) {
  const topics = avoidTopics.value.filter(t => selectedTopics.value.includes(t.id))
  const count = copyAvoidTopicsToListings(props.listing.id, topics, targetIds)
  toast.success(`${topics.length} ${topics.length === 1 ? 'topic' : 'topics'} copied to ${count} ${count === 1 ? 'listing' : 'listings'}`)
  selectedTopics.value = []
}
function deleteSelectedTopics() {
  const n = selectedTopics.value.length
  emit('update', removeAvoidTopics(props.listing, selectedTopics.value))
  selectedTopics.value = []
  toast.success(`${n} ${n === 1 ? 'topic' : 'topics'} deleted`)
}
const topicDialogOpen = ref(false)
const editingTopic = ref<AvoidTopic | null>(null)
function openTopicDialog(topic: AvoidTopic | null = null) {
  editingTopic.value = topic
  topicDialogOpen.value = true
}
function actionIcon(topic: AvoidTopic) {
  return AVOID_TOPIC_ACTIONS.find(a => a.value === topic.action)?.icon ?? 'lucide:message-circle'
}
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Tabs v-model="activeTab" class="flex flex-col h-full overflow-hidden">
      <!-- Tab bar -->
      <div v-if="!hideNav" class="flex-shrink-0 border-b py-3 overflow-x-auto">
        <div class="flex justify-center min-w-max px-6">
          <TabsList class="shrink-0">
            <TabsTrigger value="basics">
              Basics
            </TabsTrigger>
            <TabsTrigger value="listing-details">
              Listing Details
            </TabsTrigger>
            <TabsTrigger value="amenities">
              Amenities
            </TabsTrigger>
            <TabsTrigger value="sops">
              SOPs
            </TabsTrigger>
            <TabsTrigger value="topics">
              Topics to Avoid
            </TabsTrigger>
          </TabsList>
        </div>
      </div>

      <!-- Basics -->
      <TabsContent value="basics" class="flex-1 overflow-y-auto mt-0">
        <div class="mx-auto w-full max-w-2xl px-6 py-5 flex flex-col gap-4">
          <!-- Unit view: unit-specific fields -->
          <template v-if="viewMode === 'unit' && activeUnit">
            <div class="flex flex-col gap-1.5">
              <Label>Unit Name</Label>
              <Input :model-value="activeUnit.name" @update:model-value="(v) => updateUnit({ name: String(v) })" />
            </div>
            <p class="text-xs text-muted-foreground">
              Guest capacity is configured at the room type level.
              <button class="text-foreground underline underline-offset-2" @click="emit('update', { ...listing })">
                Edit room type settings
              </button>
            </p>
          </template>

          <!-- Property view: property-level fields -->
          <template v-else>
            <div class="flex flex-col gap-1.5">
              <div class="flex items-center gap-1.5">
                <Label for="setup-name">Property Name</Label>
                <button class="relative text-muted-foreground hover:text-foreground" aria-label="Property name AI settings" @click="openConfig('name', 'Property Name')">
                  <Icon name="lucide:pencil" class="size-3" />
                  <span v-if="hasConfig('name')" class="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-primary" />
                </button>
              </div>
              <Input id="setup-name" :model-value="listing.name" @update:model-value="(v) => emit('update', { ...listing, name: String(v) })" />
            </div>

            <div class="flex flex-col gap-1.5">
              <Label for="setup-time-zone">Property Time Zone</Label>
              <Select :model-value="timeZone" @update:model-value="(v) => updateListingField('timeZone', String(v))">
                <SelectTrigger id="setup-time-zone" class="w-full">
                  <SelectValue placeholder="Select a time zone" />
                </SelectTrigger>
                <SelectContent class="max-h-72">
                  <SelectItem v-for="zone in timeZones" :key="zone" :value="zone">
                    {{ zone }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Accordion v-model="openLocation" type="multiple" class="rounded-lg border px-4" data-testid="setup-location">
              <AccordionItem value="location">
                <div class="flex items-center gap-2">
                  <div class="min-w-0 flex-1">
                    <AccordionTrigger class="items-center hover:no-underline">
                      <span class="flex flex-1 items-center gap-2">
                        Location
                        <Icon v-if="locationComplete" name="lucide:circle-check" class="size-4 text-green-600 dark:text-green-400" aria-label="Complete" />
                      </span>
                      <span class="text-xs font-normal text-muted-foreground">7 fields</span>
                    </AccordionTrigger>
                  </div>
                  <button class="relative text-muted-foreground hover:text-foreground" aria-label="Location AI settings" @click="openConfig('location', 'Location')">
                    <Icon name="lucide:pencil" class="size-3" />
                    <span v-if="hasConfig('location')" class="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-primary" />
                  </button>
                </div>
                <AccordionContent class="flex flex-col gap-4 px-0.5">
                  <div class="flex flex-col gap-1.5">
                    <Label for="setup-property-type">Property Type</Label>
                    <Select :model-value="propertyType" @update:model-value="(v) => updateListingField('propertyType', String(v))">
                      <SelectTrigger id="setup-property-type" class="w-full">
                        <SelectValue placeholder="Select a property type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem v-for="type in PROPERTY_TYPES" :key="type" :value="type">
                          {{ type }}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div class="flex flex-col gap-1.5">
                    <Label for="setup-street">Street Address</Label>
                    <Input id="setup-street" :model-value="address.street" placeholder="Street and number" @update:model-value="(v) => updateAddress({ street: String(v) })" />
                  </div>

                  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div class="flex flex-col gap-1.5">
                      <Label for="setup-unit-number">Unit Number</Label>
                      <Input id="setup-unit-number" :model-value="address.unitNumber" placeholder="e.g. 123" @update:model-value="(v) => updateAddress({ unitNumber: String(v) })" />
                    </div>
                    <div class="flex flex-col gap-1.5">
                      <Label for="setup-city">City</Label>
                      <Input id="setup-city" :model-value="address.city" @update:model-value="(v) => updateAddress({ city: String(v) })" />
                    </div>
                    <div class="flex flex-col gap-1.5">
                      <Label for="setup-state">State</Label>
                      <Input id="setup-state" :model-value="address.state" @update:model-value="(v) => updateAddress({ state: String(v) })" />
                    </div>
                    <div class="flex flex-col gap-1.5">
                      <Label for="setup-postal-code">Area Code</Label>
                      <Input id="setup-postal-code" :model-value="address.postalCode" @update:model-value="(v) => updateAddress({ postalCode: String(v) })" />
                    </div>
                  </div>

                  <div class="flex flex-col gap-1.5">
                    <Label for="setup-country">Country</Label>
                    <Select :model-value="address.country" @update:model-value="(v) => updateAddress({ country: String(v) })">
                      <SelectTrigger id="setup-country" class="w-full">
                        <SelectValue placeholder="Select a country" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem v-for="code in LISTING_COUNTRIES" :key="code" :value="code">
                          {{ countryName(code) }} ({{ code }})
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </template>
        </div>
      </TabsContent>

      <!-- Listing Details -->
      <TabsContent value="listing-details" class="flex-1 overflow-y-auto mt-0">
        <div class="mx-auto w-full max-w-2xl px-6 py-5 flex flex-col gap-4">
          <template v-if="viewMode !== 'unit'">
            <ListingSetupFieldGroups
              :listing="listing"
              :groups="LISTING_DETAIL_GROUPS"
              testid-prefix="setup-details"
              @update="emit('update', $event)"
              @configure="openConfig"
            />
          </template>

          <!-- Not one of the three groups, but ElevAI reads it and host corrections write it (`ai-knowledge.ts`). -->
          <div class="flex flex-col gap-1.5">
            <Label for="setup-listing-details">Anything else ElevAI should know</Label>
            <Textarea
              id="setup-listing-details"
              :model-value="listing.resources.listingDetails ?? ''" rows="4"
              placeholder="Anything not covered above."
              @update:model-value="(v) => updateResources({ listingDetails: String(v) })"
            />
          </div>
        </div>
      </TabsContent>

      <!-- Amenities -->
      <TabsContent value="amenities" class="flex-1 overflow-y-auto mt-0">
        <div class="mx-auto w-full max-w-2xl px-6 py-5 flex flex-col gap-4">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div v-if="viewMode !== 'unit'" class="flex items-center gap-0.5 rounded-md border p-0.5" role="group" aria-label="Amenity type">
              <Button
                v-for="kind in (['property', 'room'] as const)"
                :key="kind"
                :variant="amenityKind === kind ? 'secondary' : 'ghost'"
                size="sm"
                class="h-7 gap-1.5 text-xs"
                :aria-pressed="amenityKind === kind"
                @click="amenityKind = kind; amenitySearch = ''"
              >
                <Icon :name="kind === 'property' ? 'lucide:building-2' : 'lucide:bed-double'" class="size-3.5" />
                {{ kind === 'property' ? 'Property' : 'Room' }}
              </Button>
            </div>
            <span v-else class="text-sm font-medium">Room amenities<template v-if="roomTarget"> · {{ roomTarget.label }}</template></span>

            <Select v-if="viewMode !== 'unit' && amenityKind === 'room' && roomTargets.length > 1" v-model="roomTargetId">
              <SelectTrigger class="h-8 w-48" aria-label="Room type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="target in roomTargets" :key="target.id" :value="target.id">
                  {{ target.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <p v-if="shownKind === 'room' && roomTargets.length > 1" class="text-xs text-muted-foreground">
            Room amenities apply to every room of the selected room type.
          </p>

          <div class="flex items-center gap-3">
            <Input v-model="amenitySearch" placeholder="Search amenities" class="h-8" aria-label="Search amenities" />
            <span class="shrink-0 text-xs text-muted-foreground tabular-nums">{{ selectedAmenities.length }} selected</span>
          </div>

          <Accordion v-model="openAmenityGroups" type="multiple" class="flex flex-col gap-3">
            <AccordionItem
              v-for="group in visibleAmenityGroups"
              :key="group.key"
              :value="group.key"
              class="rounded-lg border px-4 last:border-b"
              :data-testid="`setup-amenities-${group.key}`"
            >
              <AccordionTrigger class="items-center hover:no-underline">
                <span class="flex flex-1 items-center gap-3">
                  <span class="flex size-8 shrink-0 items-center justify-center rounded-md border bg-muted/50">
                    <Icon :name="group.icon" class="size-4 text-muted-foreground" />
                  </span>
                  <span class="flex flex-col gap-0.5">
                    {{ group.label }}
                    <span class="text-xs font-normal text-muted-foreground">
                      {{ group.items.filter(a => selectedAmenities.includes(a)).length }} of {{ group.items.length }} selected
                    </span>
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div class="grid grid-cols-1 gap-2 sm:grid-cols-2" :data-testid="`setup-amenity-grid-${group.key}`">
                  <div
                    v-for="name in group.items"
                    :key="name"
                    role="checkbox"
                    tabindex="0"
                    :aria-checked="selectedAmenities.includes(name)"
                    class="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2 transition-colors hover:bg-muted/50"
                    :class="selectedAmenities.includes(name) ? 'border-foreground/25 bg-muted/40' : ''"
                    @click="toggleAmenityRow(name)"
                    @keydown.space.prevent="toggleAmenityRow(name)"
                    @keydown.enter.prevent="toggleAmenityRow(name)"
                  >
                    <!-- Neutral tick, not the tenant primary: yellow on white is unreadable. -->
                    <div
                      class="flex size-4 shrink-0 items-center justify-center rounded-[4px] border"
                      :class="selectedAmenities.includes(name) ? 'border-foreground bg-foreground text-background' : 'border-input'"
                    >
                      <Icon v-if="selectedAmenities.includes(name)" name="lucide:check" class="size-3" />
                    </div>
                    <span class="flex-1 text-sm" :class="selectedAmenities.includes(name) ? 'font-medium' : 'text-muted-foreground'">{{ name }}</span>
                    <button
                      v-if="selectedAmenities.includes(name)"
                      class="relative text-muted-foreground hover:text-foreground"
                      :aria-label="`${name} AI settings`"
                      @click.stop="openConfig(amenityKey(name), name)"
                      @keydown.stop
                    >
                      <Icon name="lucide:pencil" class="size-3.5" />
                      <span v-if="hasConfig(amenityKey(name))" class="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-primary" />
                    </button>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
          <p v-if="!visibleAmenityGroups.length" class="text-sm text-muted-foreground">
            No amenities match "{{ amenitySearch }}".
          </p>
        </div>
      </TabsContent>

      <!-- SOPs -->
      <TabsContent value="sops" class="flex-1 overflow-y-auto mt-0">
        <div class="mx-auto w-full max-w-2xl px-6 py-5 flex flex-col gap-4">
          <SetupBulkBar
            v-model:selecting="selectingSops"
            :listing-id="listing.id"
            :selected-count="selectedSops.length"
            :total="sopSelectable.length"
            noun="SOP"
            copy-note="The listings you pick get these answers, replacing their own answers to the same questions. Unanswered questions are skipped. Custom SOPs are added."
            delete-note="The selected questions and custom SOPs are removed from this listing. Their sections stay, and deleted default questions can be restored."
            @copy="copySelectedSops"
            @delete="deleteSelectedSops"
          />
          <ListingSetupFieldGroups
            v-model:selected="selectedSops"
            :listing="listing"
            :groups="visibleSopGroups(listing)"
            :selectable="sopSelectable"
            :selecting="selectingSops"
            :extra-selectable="customSopSelectable"
            testid-prefix="setup-sops"
            :extra-counts="customSopCounts(listing)"
            @update="emit('update', $event)"
            @configure="openConfig"
          >
            <template #extra="{ group }">
              <!-- SOPs the host names and writes, in every group. Not counted in the setup progress. -->
              <div class="flex flex-col gap-3" :data-testid="`setup-custom-sops-${group.key}`">
                <div v-for="item in customSopsIn(listing, group.key)" :key="item.id" class="flex flex-col gap-2 rounded-md border p-3">
                  <div class="flex items-center gap-2">
                    <SetupSelectBox
                      v-if="selectingSops"
                      class="mr-1"
                      :checked="selectedSops.includes(customSopSelectionId(item.id))"
                      :label="`Select ${item.title || 'custom SOP'}`"
                      @toggle="toggleSop(customSopSelectionId(item.id))"
                    />
                    <Input
                      :model-value="item.title"
                      placeholder="SOP title, e.g. Pool cleaning"
                      aria-label="SOP title"
                      class="h-8"
                      @update:model-value="(v) => emit('update', updateCustomSop(listing, item.id, { title: String(v) }))"
                    />
                    <button
                      class="relative shrink-0 px-1 text-muted-foreground hover:text-foreground"
                      :aria-label="`${item.title || 'Custom SOP'} AI settings`"
                      @click="openConfig(customSopConfigKey(item.id), item.title || 'Custom SOP')"
                    >
                      <Icon name="lucide:pencil" class="size-3.5" />
                      <span v-if="hasConfig(customSopConfigKey(item.id))" class="absolute -top-0.5 right-0 size-1.5 rounded-full bg-primary" />
                    </button>
                    <Button variant="ghost" size="icon" class="size-8 shrink-0" :aria-label="`Remove ${item.title || 'SOP'}`" @click="emit('update', removeCustomSop(listing, item.id))">
                      <Icon name="lucide:trash-2" class="size-4" />
                    </Button>
                  </div>
                  <Textarea
                    :model-value="item.text"
                    rows="3"
                    placeholder="What should the team do?"
                    aria-label="SOP text"
                    @update:model-value="(v) => emit('update', updateCustomSop(listing, item.id, { text: String(v) }))"
                  />
                </div>
                <div class="flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="sm" class="w-fit gap-1.5" @click="emit('update', addCustomSop(listing, group.key))">
                    <Icon name="lucide:plus" class="size-3.5" />
                    Add SOP
                  </Button>
                  <Button
                    v-if="removedSopFieldsIn(listing, group.key).length"
                    variant="ghost"
                    size="sm"
                    class="w-fit gap-1.5 text-muted-foreground"
                    :data-testid="`restore-sops-${group.key}`"
                    @click="emit('update', restoreSopGroup(listing, group.key))"
                  >
                    <Icon name="lucide:rotate-ccw" class="size-3.5" />
                    Restore default questions ({{ removedSopFieldsIn(listing, group.key).length }})
                  </Button>
                </div>
              </div>
            </template>
          </ListingSetupFieldGroups>
        </div>
      </TabsContent>

      <!-- Topics to Avoid -->
      <TabsContent value="topics" class="flex-1 overflow-y-auto mt-0">
        <div class="mx-auto w-full max-w-2xl px-6 py-5 flex flex-col gap-4">
          <div class="flex items-start justify-between gap-3">
            <div class="flex flex-col gap-1">
              <Label>Topics to Avoid</Label>
              <p class="text-xs text-muted-foreground">
                Topics ElevAI should not answer on its own, and what it does instead.
              </p>
            </div>
            <Button size="sm" class="shrink-0 gap-1.5" @click="openTopicDialog()">
              <Icon name="lucide:plus" class="size-3.5" />
              Add topic
            </Button>
          </div>

          <SetupBulkBar
            v-if="avoidTopics.length"
            v-model:selecting="selectingTopics"
            select-all
            :listing-id="listing.id"
            :selected-count="selectedTopics.length"
            :total="avoidTopics.length"
            noun="topic"
            copy-note="The topics are added to the listings you pick, with their action and stages. A topic with the same name there is replaced."
            delete-note="The selected topics are removed from this listing."
            @toggle-all="selectedTopics = selectedTopics.length === avoidTopics.length ? [] : avoidTopics.map(t => t.id)"
            @copy="copySelectedTopics"
            @delete="deleteSelectedTopics"
          />
          <div v-if="avoidTopics.length" class="flex flex-col gap-2" data-testid="setup-avoid-topics">
            <div
              v-for="t in avoidTopics"
              :key="t.id"
              class="flex items-start gap-3 rounded-lg border p-3"
              :class="{ 'border-foreground/40 bg-muted/30': selectedTopics.includes(t.id) }"
            >
              <SetupSelectBox
                v-if="selectingTopics"
                class="mt-0.5"
                :checked="selectedTopics.includes(t.id)"
                :label="`Select ${t.topic}`"
                @toggle="selectedTopics = selectedTopics.includes(t.id) ? selectedTopics.filter(id => id !== t.id) : [...selectedTopics, t.id]"
              />
              <div class="flex min-w-0 flex-1 flex-col gap-1">
                <span class="text-sm font-medium">{{ t.topic }}</span>
                <span v-if="t.description" class="text-xs text-muted-foreground">{{ t.description }}</span>
                <span class="mt-1 inline-flex w-fit items-center gap-1.5 rounded-md border bg-muted/40 px-2 py-0.5 text-xs">
                  <Icon :name="actionIcon(t)" class="size-3.5 text-muted-foreground" />
                  {{ avoidTopicActionLabel(t) }}
                  <span v-if="t.action === 'share_contact' && t.contact" class="text-muted-foreground">· {{ t.contact }}</span>
                </span>
                <span class="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Icon name="lucide:calendar-range" class="size-3.5" />
                  {{ avoidTopicStagesLabel(t) }}
                </span>
              </div>
              <div class="flex shrink-0 items-center gap-1">
                <Button variant="ghost" size="icon" class="size-8" :aria-label="`Edit ${t.topic}`" @click="openTopicDialog(t)">
                  <Icon name="lucide:pencil" class="size-4" />
                </Button>
                <Button variant="ghost" size="icon" class="size-8" :aria-label="`Remove ${t.topic}`" @click="emit('update', removeAvoidTopic(listing, t.id))">
                  <Icon name="lucide:trash-2" class="size-4" />
                </Button>
              </div>
            </div>
          </div>
          <div v-else class="flex flex-col items-center gap-2 rounded-lg border border-dashed px-6 py-10 text-center">
            <Icon name="lucide:message-circle-off" class="size-6 text-muted-foreground" />
            <p class="text-sm font-medium">
              No topics yet
            </p>
            <p class="text-xs text-muted-foreground">
              Add early check-in, refund or discount requests, or your own topic.
            </p>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  </div>

  <AvoidTopicDialog
    v-model:open="topicDialogOpen"
    :topic="editingTopic"
    @save="(t) => emit('update', saveAvoidTopic(listing, t))"
  />

  <FieldConfigDialog
    v-if="configField"
    :open="!!configField"
    :field-key="configField.key"
    :field-label="configField.label"
    :listing="listing"
    @update:open="(v) => { if (!v) configField = null }"
    @update="emit('update', $event)"
  />
</template>
