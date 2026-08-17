<script setup lang="ts">
export interface PropertySelection {
  propertyIds: string[]
  roomIds: string[]
}

interface Room {
  id: string
  name: string
  type: 'bedroom' | 'bathroom' | 'living' | 'kitchen' | 'outdoor'
  description: string
  amenities: string[]
  photos: string[]
}

interface Property {
  id: string
  title: string
  location: string
  maxCapacity: number
  amenities: string[]
  photos: string[]
  rooms: Room[]
}

const props = defineProps<{
  modelValue: PropertySelection
}>()

const emit = defineEmits<{
  'update:modelValue': [value: PropertySelection]
  'next': []
  'back': []
}>()

const selectedPropertyIds = ref<string[]>([...props.modelValue.propertyIds])
const selectedRoomIds = ref<string[]>([...props.modelValue.roomIds])

watch(() => props.modelValue, (val) => {
  selectedPropertyIds.value = [...val.propertyIds]
  selectedRoomIds.value = [...val.roomIds]
}, { deep: true })

function emitUpdate() {
  emit('update:modelValue', {
    propertyIds: [...selectedPropertyIds.value],
    roomIds: [...selectedRoomIds.value],
  })
}

// ── Mock ELEV8 Data ──────────────────────────────────────────────
const properties: Property[] = [
  {
    id: 'prop-1',
    title: 'Villa Sunset Bay',
    location: 'Seminyak, Bali',
    maxCapacity: 8,
    amenities: ['Pool', 'WiFi', 'Air Conditioning', 'Parking', 'Kitchen', 'BBQ'],
    photos: [
      'https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf?w=800',
      'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800',
      'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800',
    ],
    rooms: [
      { id: 'r1', name: 'Master Bedroom', type: 'bedroom', description: 'Ocean-view suite with king bed', amenities: ['King Bed', 'En-suite', 'Ocean View'], photos: ['photo-1.jpg', 'photo-2.jpg'] },
      { id: 'r2', name: 'Guest Bedroom', type: 'bedroom', description: 'Garden-view room with queen bed', amenities: ['Queen Bed', 'Garden View'], photos: ['photo-3.jpg'] },
      { id: 'r3', name: 'Kids Bedroom', type: 'bedroom', description: 'Twin beds, perfect for children', amenities: ['Twin Beds', 'A/C'], photos: ['photo-4.jpg'] },
      { id: 'r4', name: 'Living Room', type: 'living', description: 'Open-plan living with tropical decor', amenities: ['Smart TV', 'Sofa', 'Ceiling Fan'], photos: ['photo-5.jpg', 'photo-6.jpg'] },
      { id: 'r5', name: 'Kitchen', type: 'kitchen', description: 'Fully equipped modern kitchen', amenities: ['Full Oven', 'Dishwasher', 'Coffee Machine'], photos: ['photo-7.jpg'] },
      { id: 'r6', name: 'Master Bathroom', type: 'bathroom', description: 'Rain shower and soaking tub', amenities: ['Rain Shower', 'Bathtub', 'Double Vanity'], photos: ['photo-8.jpg'] },
      { id: 'r7', name: 'Pool & Terrace', type: 'outdoor', description: 'Infinity pool with sun loungers', amenities: ['Infinity Pool', 'Loungers', 'Daybed'], photos: ['photo-9.jpg', 'photo-10.jpg'] },
    ],
  },
  {
    id: 'prop-2',
    title: 'Ubud Jungle Retreat',
    location: 'Ubud, Bali',
    maxCapacity: 6,
    amenities: ['Pool', 'WiFi', 'Air Conditioning', 'Yoga Deck', 'Rice Field View'],
    photos: [
      'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800',
      'https://images.unsplash.com/photo-1540541338287-41700207dee6?w=800',
    ],
    rooms: [
      { id: 'r8', name: 'Master Suite', type: 'bedroom', description: 'Canopy bed with jungle panorama', amenities: ['Canopy Bed', 'Jungle View', 'En-suite'], photos: ['photo-11.jpg'] },
      { id: 'r9', name: 'Guest Room', type: 'bedroom', description: 'Cozy room with bamboo accents', amenities: ['Queen Bed', 'Bamboo Interior'], photos: ['photo-12.jpg'] },
      { id: 'r10', name: 'Open Living Pavilion', type: 'living', description: 'Open-air pavilion with daybeds', amenities: ['Daybed', 'Ceiling Fan', 'Mosquito Nets'], photos: ['photo-13.jpg'] },
      { id: 'r11', name: 'Bamboo Kitchen', type: 'kitchen', description: 'Compact kitchen with natural materials', amenities: ['Gas Stove', 'Mini Fridge'], photos: ['photo-14.jpg'] },
      { id: 'r12', name: 'Yoga Deck', type: 'outdoor', description: 'Elevated deck overlooking rice paddies', amenities: ['Yoga Mats', 'Sound System'], photos: ['photo-15.jpg'] },
    ],
  },
  {
    id: 'prop-3',
    title: 'Beachfront Canggu Villa',
    location: 'Canggu, Bali',
    maxCapacity: 10,
    amenities: ['Pool', 'WiFi', 'Air Conditioning', 'Beach Access', 'Surfboard Rack', 'BBQ'],
    photos: [
      'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800',
      'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800',
      'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800',
    ],
    rooms: [
      { id: 'r13', name: 'Master Bedroom', type: 'bedroom', description: 'Direct beach access, king bed', amenities: ['King Bed', 'Beach View', 'Walk-in Closet'], photos: ['photo-16.jpg', 'photo-17.jpg'] },
      { id: 'r14', name: 'Ocean View Suite', type: 'bedroom', description: 'Premium suite with balcony', amenities: ['King Bed', 'Balcony', 'Mini Bar'], photos: ['photo-18.jpg'] },
      { id: 'r15', name: 'Garden Room', type: 'bedroom', description: 'Peaceful garden-facing room', amenities: ['Queen Bed', 'Garden Access'], photos: ['photo-19.jpg'] },
      { id: 'r16', name: 'Bunk Room', type: 'bedroom', description: 'Fun bunk-style room for kids', amenities: ['Bunk Beds', 'Play Area'], photos: ['photo-20.jpg'] },
      { id: 'r17', name: 'Main Living Area', type: 'living', description: 'Spacious open-plan living with bar', amenities: ['Bar', 'Smart TV', 'Sound System'], photos: ['photo-21.jpg', 'photo-22.jpg'] },
      { id: 'r18', name: 'Gourmet Kitchen', type: 'kitchen', description: 'Professional-grade kitchen', amenities: ['Double Oven', 'Wine Fridge', 'Island Bench'], photos: ['photo-23.jpg'] },
      { id: 'r19', name: 'Master En-suite', type: 'bathroom', description: 'Luxury spa-style bathroom', amenities: ['Rain Shower', 'Soaking Tub', 'Double Vanity'], photos: ['photo-24.jpg'] },
      { id: 'r20', name: 'Guest Bathroom', type: 'bathroom', description: 'Modern guest bathroom', amenities: ['Shower', 'Vanity'], photos: ['photo-25.jpg'] },
      { id: 'r21', name: 'Pool Deck', type: 'outdoor', description: 'Oceanfront pool with sunset bar', amenities: ['Pool', 'Sunset Bar', 'BBQ Area'], photos: ['photo-26.jpg', 'photo-27.jpg'] },
    ],
  },
  {
    id: 'prop-4',
    title: 'Cliffside Uluwatu',
    location: 'Uluwatu, Bali',
    maxCapacity: 4,
    amenities: ['Pool', 'WiFi', 'Air Conditioning', 'Cliff View', 'Honeymoon Suite'],
    photos: [
      'https://images.unsplash.com/photo-1587381420270-c36e8e87ae84?w=800',
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800',
    ],
    rooms: [
      { id: 'r22', name: 'Honeymoon Suite', type: 'bedroom', description: 'Intimate suite with panoramic cliff views', amenities: ['King Bed', 'Cliff View', 'Jacuzzi'], photos: ['photo-28.jpg', 'photo-29.jpg'] },
      { id: 'r23', name: 'Cozy Lounge', type: 'living', description: 'Intimate living space with fireplace', amenities: ['Fireplace', 'Smart TV', 'Mini Bar'], photos: ['photo-30.jpg'] },
      { id: 'r24', name: 'Kitchenette', type: 'kitchen', description: 'Compact but well-equipped', amenities: ['Induction Cooktop', 'Mini Fridge'], photos: ['photo-31.jpg'] },
      { id: 'r25', name: 'Cliffside Pool', type: 'outdoor', description: 'Private plunge pool on the cliff edge', amenities: ['Plunge Pool', 'Sun Loungers', 'Sunset View'], photos: ['photo-32.jpg'] },
    ],
  },
]

// ── Computed ─────────────────────────────────────────────────────
const selectedProperties = computed(() =>
  properties.filter(p => selectedPropertyIds.value.includes(p.id)),
)

const totalPhotos = computed(() => {
  if (selectedProperties.value.length === 0)
    return 0
  return selectedProperties.value
    .flatMap(p => p.rooms)
    .filter(r => selectedRoomIds.value.includes(r.id))
    .reduce((sum, r) => sum + r.photos.length, 0)
})

const isValid = computed(() =>
  selectedPropertyIds.value.length > 0 && selectedRoomIds.value.length > 0,
)

// ── Room type helpers ────────────────────────────────────────────
const roomTypeConfig: Record<Room['type'], { label: string, variant: 'default' | 'secondary' | 'destructive' | 'outline', icon: string }> = {
  bedroom: { label: 'Bedroom', variant: 'default', icon: 'i-lucide-bed' },
  bathroom: { label: 'Bathroom', variant: 'secondary', icon: 'i-lucide-bath' },
  living: { label: 'Living', variant: 'secondary', icon: 'i-lucide-sofa' },
  kitchen: { label: 'Kitchen', variant: 'outline', icon: 'i-lucide-chef-hat' },
  outdoor: { label: 'Outdoor', variant: 'outline', icon: 'i-lucide-trees' },
}

// ── Actions ──────────────────────────────────────────────────────
function toggleProperty(property: Property) {
  const idx = selectedPropertyIds.value.indexOf(property.id)
  if (idx === -1) {
    selectedPropertyIds.value.push(property.id)
    // Auto-select all rooms of newly added property
    selectedRoomIds.value.push(...property.rooms.map(r => r.id))
  }
  else {
    selectedPropertyIds.value.splice(idx, 1)
    // Remove rooms that belong to the deselected property
    const roomIdsToRemove = new Set(property.rooms.map(r => r.id))
    selectedRoomIds.value = selectedRoomIds.value.filter(id => !roomIdsToRemove.has(id))
  }
  emitUpdate()
}

function allRoomsSelectedFor(property: Property): boolean {
  return property.rooms.length > 0 && property.rooms.every(r => selectedRoomIds.value.includes(r.id))
}

function toggleAllRoomsFor(property: Property) {
  const propertyRoomIds = property.rooms.map(r => r.id)
  const allSelected = allRoomsSelectedFor(property)
  if (allSelected) {
    const removeSet = new Set(propertyRoomIds)
    selectedRoomIds.value = selectedRoomIds.value.filter(id => !removeSet.has(id))
  }
  else {
    const currentSet = new Set(selectedRoomIds.value)
    for (const id of propertyRoomIds) {
      if (!currentSet.has(id))
        selectedRoomIds.value.push(id)
    }
  }
  emitUpdate()
}

function toggleRoom(roomId: string) {
  const idx = selectedRoomIds.value.indexOf(roomId)
  if (idx === -1) {
    selectedRoomIds.value.push(roomId)
  }
  else {
    selectedRoomIds.value.splice(idx, 1)
  }
  emitUpdate()
}

function handleNext() {
  if (isValid.value)
    emit('next')
}

function handleBack() {
  emit('back')
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- Header -->
    <div>
      <h3 class="text-lg font-semibold">
        Property & Rooms
      </h3>
      <p class="text-sm text-muted-foreground">
        Select a property and choose which rooms to include on your website.
      </p>
    </div>

    <!-- Property Selector -->
    <div>
      <Label class="text-sm font-medium mb-3 block">Select Properties</Label>
      <div class="grid grid-cols-1 gap-4 @xl/main:grid-cols-2">
        <div
          v-for="property in properties"
          :key="property.id"
          class="group cursor-pointer rounded-lg border bg-card transition-all hover:shadow-md"
          :class="{
            'ring-2 ring-primary border-primary': selectedPropertyIds.includes(property.id),
          }"
          @click="toggleProperty(property)"
        >
          <!-- Property Image -->
          <div class="relative aspect-video w-full overflow-hidden rounded-t-lg bg-muted">
            <img
              :src="property.photos[0]"
              :alt="property.title"
              class="size-full object-cover transition-transform group-hover:scale-105"
              loading="lazy"
            >
            <div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div class="absolute bottom-3 left-3 right-3">
              <h4 class="font-semibold text-white">
                {{ property.title }}
              </h4>
              <p class="text-xs text-white/80">
                {{ property.location }}
              </p>
            </div>
            <!-- Selected indicator -->
            <div
              v-if="selectedPropertyIds.includes(property.id)"
              class="absolute top-3 right-3 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground"
            >
              <Icon name="i-lucide-check" class="size-3.5" />
            </div>
          </div>

          <!-- Property Info -->
          <div class="p-3 space-y-2">
            <div class="flex items-center gap-4 text-xs text-muted-foreground">
              <span class="flex items-center gap-1">
                <Icon name="i-lucide-users" class="size-3.5" />
                {{ property.maxCapacity }} guests
              </span>
              <span class="flex items-center gap-1">
                <Icon name="i-lucide-door-open" class="size-3.5" />
                {{ property.rooms.length }} rooms
              </span>
              <span class="flex items-center gap-1">
                <Icon name="i-lucide-image" class="size-3.5" />
                {{ property.photos.length }} photos
              </span>
            </div>
            <div class="flex flex-wrap gap-1">
              <Badge
                v-for="amenity in property.amenities.slice(0, 4)"
                :key="amenity"
                variant="secondary"
                class="text-[10px] px-1.5 py-0"
              >
                {{ amenity }}
              </Badge>
              <Badge
                v-if="property.amenities.length > 4"
                variant="outline"
                class="text-[10px] px-1.5 py-0"
              >
                +{{ property.amenities.length - 4 }}
              </Badge>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Room Selector (per selected property) -->
    <div v-if="selectedProperties.length > 0" class="space-y-4">
      <div
        v-for="property in selectedProperties"
        :key="property.id"
        class="space-y-3"
      >
        <div class="flex items-center justify-between">
          <Label class="text-sm font-medium">
            {{ property.title }} — Rooms
          </Label>
          <Button
            variant="ghost"
            size="sm"
            class="text-xs h-7"
            @click="toggleAllRoomsFor(property)"
          >
            <Icon
              :name="allRoomsSelectedFor(property) ? 'i-lucide-square' : 'i-lucide-check-square'"
              class="size-3.5 mr-1.5"
            />
            {{ allRoomsSelectedFor(property) ? 'Deselect All' : 'Select All' }}
          </Button>
        </div>

        <div class="grid grid-cols-1 gap-2 @xl/main:grid-cols-2">
          <div
            v-for="room in property.rooms"
            :key="room.id"
            class="flex items-start gap-3 rounded-lg border p-3 transition-colors cursor-pointer hover:bg-muted/50"
            :class="{
              'bg-muted/30 border-primary/30': selectedRoomIds.includes(room.id),
            }"
            @click="toggleRoom(room.id)"
          >
            <Checkbox
              :checked="selectedRoomIds.includes(room.id)"
              class="mt-0.5"
              @update:checked="toggleRoom(room.id)"
            />
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <span class="text-sm font-medium">{{ room.name }}</span>
                <Badge :variant="roomTypeConfig[room.type].variant" class="text-[10px] px-1.5 py-0">
                  <Icon :name="roomTypeConfig[room.type].icon" class="size-3 mr-0.5" />
                  {{ roomTypeConfig[room.type].label }}
                </Badge>
              </div>
              <p class="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                {{ room.description }}
              </p>
              <div class="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                <span class="flex items-center gap-1">
                  <Icon name="i-lucide-image" class="size-3" />
                  {{ room.photos.length }} photo{{ room.photos.length !== 1 ? 's' : '' }}
                </span>
                <span class="flex items-center gap-1">
                  <Icon name="i-lucide-list" class="size-3" />
                  {{ room.amenities.length }} amenities
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Data Preview Summary -->
    <div
      v-if="selectedProperties.length > 0"
      class="rounded-lg border bg-muted/30 p-4"
    >
      <div class="flex items-center gap-2 mb-2">
        <Icon name="i-lucide-info" class="size-4 text-muted-foreground" />
        <span class="text-sm font-medium">Selection Summary</span>
      </div>
      <div class="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
        <div class="flex items-center gap-2">
          <span class="text-muted-foreground">Properties:</span>
          <span class="font-medium">{{ selectedProperties.length }}</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-muted-foreground">Rooms:</span>
          <span class="font-medium">{{ selectedRoomIds.length }} selected</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-muted-foreground">Photos to pull:</span>
          <span class="font-medium">{{ totalPhotos }}</span>
        </div>
      </div>
    </div>

    <!-- Navigation -->
    <div class="flex items-center justify-between pt-2">
      <Button variant="ghost" @click="handleBack">
        <Icon name="i-lucide-arrow-left" class="size-4 mr-2" />
        Back
      </Button>
      <Button :disabled="!isValid" @click="handleNext">
        Next
        <Icon name="i-lucide-arrow-right" class="size-4 ml-2" />
      </Button>
    </div>
  </div>
</template>
