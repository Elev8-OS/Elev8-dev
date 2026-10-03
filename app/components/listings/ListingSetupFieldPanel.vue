<script setup lang="ts">
import type { Listing, Unit } from '~/components/listings/data/listings'
import { GUIDE_CONTENT_META, listingGuideItems } from '~/components/listings/data/guest-guide-content'
import { getUnitById } from '~/components/listings/data/listings'
import FieldConfigDialog from '~/components/listings/FieldConfigDialog.vue'

const props = defineProps<{ listing: Listing, viewMode?: 'property' | 'unit', activeUnitId?: string }>()
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

const activeTab = ref('basics')
const basics = computed(() => props.listing.resources.basics)

/** Summary of the guide content the Guest Guide tab owns (no editing here). */
const guideContentRows = computed(() => (['checkin', 'checkout', 'house_rules'] as const).map(kind => ({
  kind,
  label: GUIDE_CONTENT_META[kind].label,
  noun: GUIDE_CONTENT_META[kind].noun,
  count: listingGuideItems(props.listing, kind).length,
})))

function updateBasics(patch: Partial<typeof basics.value>) {
  emit('update', { ...props.listing, resources: { ...props.listing.resources, basics: { ...basics.value, ...patch } } })
}
function updateResources(patch: Partial<Listing['resources']>) {
  emit('update', { ...props.listing, resources: { ...props.listing.resources, ...patch } })
}
function updateListingField<K extends keyof Listing>(key: K, value: Listing[K]) {
  emit('update', { ...props.listing, [key]: value })
}

const allAmenities = [
  'Pool',
  'WiFi',
  'AC',
  'Kitchen',
  'Parking',
  'Garden',
  'Beach Access',
  'Rooftop Deck',
  'Plunge Pool',
  'Yoga Deck',
  'Hammock Deck',
  'Nature Bath',
  'Ocean View',
  'Cliff Deck',
  'Surfboard Storage',
  'Mountain View',
  'Hot Tub',
  'Fireplace',
  'River View',
  'Bamboo Construction',
]
const amenitySearch = ref('')
const amenityPopoverOpen = ref(false)
const filteredAmenities = computed(() => {
  const available = allAmenities.filter(a => !props.listing.amenities.includes(a))
  if (!amenitySearch.value)
    return available
  return available.filter(a => a.toLowerCase().includes(amenitySearch.value.toLowerCase()))
})
function addAmenity(a: string) { emit('update', { ...props.listing, amenities: [...props.listing.amenities, a] }) }
function removeAmenity(a: string) { emit('update', { ...props.listing, amenities: props.listing.amenities.filter(x => x !== a) }) }

const topicInput = ref('')
function addTopic() {
  const t = topicInput.value.trim()
  if (!t || props.listing.resources.topicsToAvoid?.includes(t))
    return
  updateResources({ topicsToAvoid: [...(props.listing.resources.topicsToAvoid ?? []), t] })
  topicInput.value = ''
}
function removeTopic(t: string) {
  updateResources({ topicsToAvoid: props.listing.resources.topicsToAvoid?.filter(x => x !== t) })
}

const isFilled = (val?: string) => !!val?.trim()
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Tabs v-model="activeTab" class="flex flex-col h-full overflow-hidden">
      <!-- Tab bar -->
      <div class="flex-shrink-0 border-b py-3 overflow-x-auto">
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
            <TabsTrigger value="upsells">
              Property Upsells
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
              <button class="text-primary underline" @click="emit('update', { ...listing })">
                Edit room type settings
              </button>
            </p>
          </template>

          <!-- Property view: property-level fields -->
          <template v-else>
            <div class="grid grid-cols-2 gap-4">
              <div class="flex flex-col gap-1.5">
                <div class="flex items-center gap-1.5">
                  <Label>Property Name</Label>
                  <button class="relative text-muted-foreground hover:text-foreground" @click="openConfig('name', 'Property Name')">
                    <Icon name="lucide:pencil" class="size-3" />
                    <span v-if="hasConfig('name')" class="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-primary" />
                  </button>
                </div>
                <Input :model-value="listing.name" @update:model-value="(v) => emit('update', { ...listing, name: String(v) })" />
              </div>
              <div class="flex flex-col gap-1.5">
                <div class="flex items-center gap-1.5">
                  <Label>Location</Label>
                  <button class="relative text-muted-foreground hover:text-foreground" @click="openConfig('location', 'Location')">
                    <Icon name="lucide:pencil" class="size-3" />
                    <span v-if="hasConfig('location')" class="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-primary" />
                  </button>
                </div>
                <Input :model-value="listing.location" @update:model-value="(v) => emit('update', { ...listing, location: String(v) })" />
              </div>
              <div class="flex flex-col gap-1.5">
                <div class="flex items-center gap-1.5">
                  <Label>Check-in Time</Label>
                  <button class="relative text-muted-foreground hover:text-foreground" @click="openConfig('checkInTime', 'Check-in Time')">
                    <Icon name="lucide:pencil" class="size-3" />
                    <span v-if="hasConfig('checkInTime')" class="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-primary" />
                  </button>
                </div>
                <Input type="time" :model-value="basics.checkInTime ?? '14:00'" @update:model-value="(v) => updateBasics({ checkInTime: String(v) })" />
              </div>
              <div class="flex flex-col gap-1.5">
                <div class="flex items-center gap-1.5">
                  <Label>Check-out Time</Label>
                  <button class="relative text-muted-foreground hover:text-foreground" @click="openConfig('checkOutTime', 'Check-out Time')">
                    <Icon name="lucide:pencil" class="size-3" />
                    <span v-if="hasConfig('checkOutTime')" class="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-primary" />
                  </button>
                </div>
                <Input type="time" :model-value="basics.checkOutTime ?? '11:00'" @update:model-value="(v) => updateBasics({ checkOutTime: String(v) })" />
              </div>
            </div>

            <div class="flex flex-col gap-1.5 pt-2">
              <h3 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Connectivity & Access
              </h3>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div class="flex flex-col gap-1.5">
                <Label>Wi-Fi SSID</Label>
                <Input
                  :model-value="listing.wifiSsid ?? ''"
                  placeholder="e.g. VillaBali_5G"
                  @update:model-value="(v) => updateListingField('wifiSsid', String(v))"
                />
              </div>
              <div class="flex flex-col gap-1.5">
                <Label>Wi-Fi Password</Label>
                <Input
                  type="password"
                  :model-value="listing.wifiPassword ?? ''"
                  placeholder="Network password"
                  @update:model-value="(v) => updateListingField('wifiPassword', String(v))"
                />
              </div>
            </div>

            <div class="flex flex-col gap-1.5 pt-2">
              <h3 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Arrival & Departure
              </h3>
            </div>

            <!-- Check-in/out steps and house rules are owned by the listing's Guest Guide tab (`guest-guide-content.ts`). -->
            <div class="flex flex-col gap-2 rounded-lg border bg-muted/20 p-3" data-testid="setup-guide-content">
              <div
                v-for="row in guideContentRows"
                :key="row.kind"
                class="flex items-center justify-between gap-2 text-sm"
              >
                <span class="flex items-center gap-1.5">
                  {{ row.label }}
                  <button
                    v-if="row.kind === 'house_rules'"
                    class="relative text-muted-foreground hover:text-foreground"
                    aria-label="House rules AI settings"
                    @click="openConfig('houseRules', 'House Rules')"
                  >
                    <Icon name="lucide:pencil" class="size-3" />
                    <span v-if="hasConfig('houseRules')" class="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-primary" />
                  </button>
                </span>
                <span class="text-xs text-muted-foreground">{{ row.count ? `${row.count} ${row.noun}${row.count === 1 ? '' : 's'}` : 'Not set up' }}</span>
              </div>
              <NuxtLink
                :to="`/listings/${listing.id}?tab=guest-guide`"
                class="mt-1 inline-flex w-fit items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                Edit in the Guest Guide tab
                <Icon name="lucide:arrow-right" class="size-3" />
              </NuxtLink>
            </div>

            <div class="flex flex-col gap-1.5">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-1.5">
                  <Label>Property Description</Label>
                  <button class="relative text-muted-foreground hover:text-foreground" @click="openConfig('description', 'Property Description')">
                    <Icon name="lucide:pencil" class="size-3" />
                    <span v-if="hasConfig('description')" class="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-primary" />
                  </button>
                </div>
                <span v-if="isFilled(basics.description)" class="text-[10px] text-primary flex items-center gap-1">
                  <Icon name="elev8:elevai" class="size-3" /> AI filled
                </span>
              </div>
              <Textarea :model-value="basics.description ?? ''" rows="5" placeholder="Describe your property..." @update:model-value="(v) => updateBasics({ description: String(v) })" />
            </div>

            <div class="flex flex-col gap-1.5">
              <div class="flex items-center gap-1.5">
                <Label>Neighborhood Info</Label>
                <button class="relative text-muted-foreground hover:text-foreground" @click="openConfig('neighborhood', 'Neighborhood Info')">
                  <Icon name="lucide:pencil" class="size-3" />
                  <span v-if="hasConfig('neighborhood')" class="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-primary" />
                </button>
              </div>
              <Textarea :model-value="basics.neighborhood ?? ''" rows="3" placeholder="Nearby attractions, transport..." @update:model-value="(v) => updateBasics({ neighborhood: String(v) })" />
            </div>
          </template>
        </div>
      </TabsContent>

      <!-- Listing Details -->
      <TabsContent value="listing-details" class="flex-1 overflow-y-auto mt-0">
        <div class="mx-auto w-full max-w-2xl px-6 py-5 flex flex-col gap-4">
          <div class="flex flex-col gap-1.5">
            <div class="flex items-center justify-between">
              <Label>Full Listing Description</Label>
              <span v-if="isFilled(listing.resources.listingDetails)" class="text-[10px] text-primary flex items-center gap-1">
                <Icon name="elev8:elevai" class="size-3" /> AI filled
              </span>
            </div>
            <Textarea
              :model-value="listing.resources.listingDetails ?? ''" rows="12"
              placeholder="Full description for OTA listings..."
              @update:model-value="(v) => updateResources({ listingDetails: String(v) })"
            />
          </div>
        </div>
      </TabsContent>

      <!-- Amenities -->
      <TabsContent value="amenities" class="flex-1 overflow-y-auto mt-0">
        <div class="mx-auto w-full max-w-2xl px-6 py-5 flex flex-col gap-4">
          <div class="flex items-center justify-between">
            <Label>Amenities</Label>
            <Popover v-model:open="amenityPopoverOpen">
              <PopoverTrigger as-child>
                <Button variant="ghost" size="sm" class="h-7 gap-1 text-xs">
                  <Icon name="lucide:plus" class="size-3" /> Add
                </Button>
              </PopoverTrigger>
              <PopoverContent class="w-56 p-0" align="end">
                <div class="p-2">
                  <Input v-model="amenitySearch" placeholder="Search..." class="h-7 text-xs" />
                </div>
                <ScrollArea class="h-48">
                  <div class="space-y-1">
                    <div
                      v-for="a in filteredAmenities" :key="a"
                      class="cursor-pointer rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                      @click="addAmenity(a)"
                    >
                      {{ a }}
                    </div>
                    <p v-if="filteredAmenities.length === 0" class="px-2 py-1.5 text-xs text-muted-foreground">
                      No amenities found.
                    </p>
                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>
          </div>
          <div class="flex flex-wrap gap-2">
            <Badge v-for="a in listing.amenities" :key="a" variant="secondary" class="text-xs gap-1 cursor-pointer" @click="removeAmenity(a)">
              {{ a }} <Icon name="lucide:x" class="size-3" />
            </Badge>
          </div>
        </div>
      </TabsContent>

      <!-- SOPs -->
      <TabsContent value="sops" class="flex-1 overflow-y-auto mt-0">
        <div class="mx-auto w-full max-w-2xl px-6 py-5 flex flex-col gap-4">
          <div class="flex flex-col gap-1.5">
            <Label>Standard Operating Procedures</Label>
            <Textarea
              :model-value="listing.resources.sops ?? ''" rows="14"
              placeholder="e.g. Check-in procedure, cleaning checklist, emergency contacts..."
              @update:model-value="(v) => updateResources({ sops: String(v) })"
            />
          </div>
        </div>
      </TabsContent>

      <!-- Topics to Avoid -->
      <TabsContent value="topics" class="flex-1 overflow-y-auto mt-0">
        <div class="mx-auto w-full max-w-2xl px-6 py-5 flex flex-col gap-4">
          <div class="flex flex-col gap-2">
            <Label>Topics to Avoid</Label>
            <p class="text-xs text-muted-foreground">
              Topics the AI should not discuss with guests.
            </p>
            <div class="flex gap-2">
              <Input v-model="topicInput" placeholder="e.g. competitor pricing" class="flex-1" @keydown.enter="addTopic" />
              <Button size="sm" @click="addTopic">
                Add
              </Button>
            </div>
            <div class="flex flex-wrap gap-2 mt-2">
              <Badge v-for="t in listing.resources.topicsToAvoid" :key="t" variant="secondary" class="text-xs gap-1 cursor-pointer" @click="removeTopic(t)">
                {{ t }} <Icon name="lucide:x" class="size-3" />
              </Badge>
            </div>
          </div>
        </div>
      </TabsContent>

      <!-- Property Upsells -->
      <TabsContent value="upsells" class="flex-1 overflow-y-auto mt-0">
        <div class="mx-auto w-full max-w-2xl px-6 py-5 flex flex-col gap-4">
          <p class="text-sm text-muted-foreground">
            Link upsell services the AI can promote to guests.
          </p>
          <p class="text-xs text-muted-foreground italic">
            Upsell catalog integration coming soon.
          </p>
        </div>
      </TabsContent>
    </Tabs>
  </div>

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
