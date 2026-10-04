<script setup lang="ts">
import type { Listing, Unit } from '~/components/listings/data/listings'
import { toast } from 'vue-sonner'
import { aiActiveRooms, listingAiStatus, roomsWithAi, setListingAi, setRoomAi } from '~/components/listings/data/listing-ai-status'
import { listingSetupProgress } from '~/components/listings/data/listing-setup-progress'
import { allTags, getUnitById, getUnits, listings } from '~/components/listings/data/listings'
import ListingAiScheduleSheet from '~/components/listings/ListingAiScheduleSheet.vue'
import ListingAssignedUsers from '~/components/listings/ListingAssignedUsers.vue'
import ListingPhotosEditor from '~/components/listings/ListingPhotosEditor.vue'

const props = defineProps<{ listing: Listing }>()
const emit = defineEmits<{ update: [listing: Listing] }>()
const router = useRouter()

const setupProgress = computed(() => listingSetupProgress(props.listing))

function otaIcon(ota: string) {
  return ota === 'Airbnb' ? 'logos:airbnb' : 'simple-icons:bookingdotcom'
}

// Photo manager (the dialog holds the shared ListingPhotosEditor)
const showPhotoDialog = ref(false)

// Inline name editing
const editingName = ref(false)
const nameInput = ref(props.listing.name)
const nameInputEl = ref<HTMLInputElement | null>(null)

function startEditName() {
  nameInput.value = props.listing.name
  editingName.value = true
  nextTick(() => nameInputEl.value?.focus())
}

function saveName() {
  if (nameInput.value.trim())
    emit('update', { ...props.listing, name: nameInput.value.trim() })
  editingName.value = false
}

// Tag editing
const tagPopoverOpen = ref(false)
const tagSearch = ref('')
const availableTags = computed(() => allTags.value.filter(t => !props.listing.tags.includes(t)))
const filteredAvailableTags = computed(() => {
  if (!tagSearch.value)
    return availableTags.value
  return availableTags.value.filter(t => t.toLowerCase().includes(tagSearch.value.toLowerCase()))
})
const canCreateTag = computed(() =>
  tagSearch.value.trim().length > 0 && !props.listing.tags.includes(tagSearch.value.trim()),
)

function removeTag(tag: string) {
  emit('update', { ...props.listing, tags: props.listing.tags.filter(t => t !== tag) })
}

function addTag(tag: string) {
  const t = tag.trim()
  if (!t || props.listing.tags.includes(t))
    return
  emit('update', { ...props.listing, tags: [...props.listing.tags, t] })
  tagSearch.value = ''
}

// Unit switcher
const activeUnit = computed(() =>
  props.listing.activeUnitId ? getUnitById(props.listing, props.listing.activeUnitId) : null,
)

function switchUnit(roomId: string) {
  emit('update', { ...props.listing, activeUnitId: roomId })
}

function addUnit() {
  const newUnit: Unit = {
    id: `un-${Date.now()}`,
    name: `Unit ${getUnits(props.listing).length + 1}`,
    capacity: 2,
  }
  // Add to first unit type or create a default one
  const unitTypes = props.listing.unitTypes ?? []
  if (unitTypes.length > 0) {
    const updated = unitTypes.map((ut, i) =>
      i === 0 ? { ...ut, units: [...ut.units, newUnit] } : ut,
    )
    emit('update', {
      ...props.listing,
      unitTypes: updated,
      activeUnitId: newUnit.id,
    })
  }
  else {
    emit('update', {
      ...props.listing,
      unitTypes: [{ id: `ut-${Date.now()}`, name: 'Default', units: [newUnit] }],
      activeUnitId: newUnit.id,
    })
  }
}

// AI Schedule
// Opened from the ElevAI chip menu ("AI schedule").
const showScheduleSheet = ref(false)
const schedule = computed(() => props.listing.aiSchedule)

const aiStatus = computed(() => listingAiStatus(props.listing))
const aiRooms = computed(() => aiActiveRooms(props.listing))
const aiRoomList = computed(() => roomsWithAi(props.listing))
const aiMenuOpen = ref(false)
function setAi(on: boolean) {
  emit('update', setListingAi(props.listing, on))
  toast.success(on ? 'ElevAI activated for this listing' : 'ElevAI paused for this listing')
}
function setRoomAiFor(unitId: string, name: string, on: boolean) {
  emit('update', setRoomAi(props.listing, unitId, on))
  toast.success(on ? `ElevAI activated for ${name}` : `ElevAI paused for ${name}`)
}
const AI_CHIP: Record<string, { label: string, class: string }> = {
  active: { label: 'ElevAI active', class: 'bg-green-100 text-green-800 ring-green-300 dark:bg-green-500/15 dark:text-green-300 dark:ring-green-500/40' },
  paused: { label: 'ElevAI paused', class: 'bg-amber-100 text-amber-800 ring-amber-300 dark:bg-amber-500/20 dark:text-amber-300 dark:ring-amber-500/40' },
  not_set: { label: 'ElevAI not set up', class: 'bg-muted text-muted-foreground ring-border' },
}

const summary = computed(() => {
  if (aiStatus.value !== 'active')
    return null
  if (schedule.value.always)
    return '24/7'
  const count = schedule.value.days.filter(d => d.enabled).length
  return count > 0 ? `${count} day${count > 1 ? 's' : ''}` : 'Off'
})

// Listing switcher
const listingSwitchSearch = ref('')
const filteredListingsForSwitch = computed(() => {
  if (!listingSwitchSearch.value)
    return listings.value
  const q = listingSwitchSearch.value.toLowerCase()
  return listings.value.filter(l =>
    l.name.toLowerCase().includes(q)
    || l.location.toLowerCase().includes(q),
  )
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- Navigation: Back button + Listing switcher -->
    <div class="flex items-center justify-between gap-2">
      <Button variant="ghost" size="sm" class="h-8 gap-1.5 pl-2" @click="router.push('/listings')">
        <Icon name="lucide:arrow-left" class="size-4" />
        Back
      </Button>

      <!-- Listing switcher dropdown -->
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button variant="ghost" size="sm" class="h-8 gap-1.5">
            <Icon name="lucide:building-2" class="size-4" />
            Switch Listing
            <Icon name="lucide:chevron-down" class="size-3.5" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent class="w-72 max-h-96" align="start">
          <div class="px-2 py-1.5">
            <div class="relative">
              <Icon name="lucide:search" class="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                v-model="listingSwitchSearch"
                placeholder="Search listings..."
                class="h-8 pl-7 text-xs"
              />
            </div>
          </div>

          <DropdownMenuSeparator />

          <ScrollArea class="h-64">
            <DropdownMenuItem
              v-for="l in filteredListingsForSwitch"
              :key="l.id"
              class="flex items-center gap-3 cursor-pointer"
              @click="router.push(`/listings/${l.id}`)"
            >
              <div class="size-10 rounded overflow-hidden bg-muted shrink-0">
                <img :src="l.photos[0]" :alt="l.name" class="size-full object-cover">
              </div>
              <div class="flex flex-col flex-1 min-w-0 leading-tight">
                <span class="text-sm font-medium truncate">{{ l.name }}</span>
                <span class="text-xs text-muted-foreground truncate">{{ l.location }}</span>
              </div>
              <Icon v-if="l.id === listing.id" name="lucide:check" class="size-4 shrink-0 text-primary" />
            </DropdownMenuItem>

            <div v-if="filteredListingsForSwitch.length === 0" class="px-2 py-6 text-center text-sm text-muted-foreground">
              No listings found
            </div>
          </ScrollArea>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>

    <!-- Hero: photo + info -->
    <div class="flex flex-col gap-4 md:flex-row md:items-stretch">
      <!-- Photo + unit button (same width) -->
      <div class="w-full md:w-64 shrink-0 flex flex-col gap-1.5">
        <!-- 16/9 landscape photo -->
        <div class="relative w-full aspect-video overflow-hidden rounded-lg bg-muted group cursor-pointer" @click="showPhotoDialog = true">
          <img :src="listing.photos[0]" :alt="listing.name" class="size-full object-cover">
          <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Icon name="lucide:pencil" class="size-5 text-white" />
          </div>
        </div>

        <!-- Unit switcher + Action buttons row -->
        <div class="flex items-center gap-2">
          <DropdownMenu v-if="getUnits(listing).length > 0 || listing.unitType === 'multi'">
            <DropdownMenuTrigger as-child>
              <button class="flex flex-1 items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors hover:bg-accent">
                <div class="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
                  <Icon :name="activeUnit ? 'lucide:door-open' : 'lucide:building-2'" class="size-4 text-muted-foreground" />
                </div>
                <div class="grid flex-1 text-left text-sm leading-tight">
                  <span class="truncate font-semibold">{{ activeUnit ? activeUnit.name : 'Multi-Unit' }}</span>
                  <span class="truncate text-xs text-muted-foreground">
                    {{ activeUnit ? '' : `${getUnits(listing).length} units` }}
                  </span>
                </div>
                <Icon name="lucide:chevrons-up-down" class="size-4 shrink-0 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent class="w-56" align="start">
              <DropdownMenuItem class="flex items-center justify-between cursor-pointer" @click="emit('update', { ...listing, activeUnitId: undefined })">
                <div class="flex items-center gap-2">
                  <div class="flex size-7 items-center justify-center rounded-md bg-muted">
                    <Icon name="lucide:building-2" class="size-3.5 text-muted-foreground" />
                  </div>
                  <div class="flex flex-col leading-tight">
                    <span class="text-sm font-medium">Multi-Unit</span>
                    <span class="text-xs text-muted-foreground">{{ getUnits(listing).length }} units</span>
                  </div>
                </div>
                <Icon v-if="!listing.activeUnitId" name="lucide:check" class="size-4 shrink-0 text-primary" />
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <template v-for="unitType in listing.unitTypes" :key="unitType.id">
                <DropdownMenuLabel class="text-xs text-muted-foreground">
                  {{ unitType.name }}
                </DropdownMenuLabel>
                <DropdownMenuItem v-for="unit in unitType.units" :key="unit.id" class="flex items-center justify-between cursor-pointer" @click="switchUnit(unit.id)">
                  <div class="flex flex-col leading-tight">
                    <span class="text-sm font-medium">{{ unit.name }}</span>
                    <span class="text-xs text-muted-foreground">{{ unitType.maxAdults + unitType.maxChildren }} guests</span>
                  </div>
                  <Icon v-if="unit.id === listing.activeUnitId" name="lucide:check" class="size-4 shrink-0 text-primary" />
                </DropdownMenuItem>
              </template>
              <DropdownMenuSeparator />
              <DropdownMenuItem class="flex items-center gap-2 cursor-pointer text-muted-foreground" @click="addUnit">
                <Icon name="lucide:plus" class="size-4" />
                <span class="text-sm">Add Unit</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Badge v-else variant="outline" class="flex-1 justify-center text-xs py-2">
            <Icon name="lucide:home" class="size-3 mr-1" />
            Single Unit
          </Badge>
        </div>
      </div>

      <!-- Listing info -->
      <div class="flex flex-col gap-4 flex-1 w-full min-w-0 justify-between">
        <div class="flex flex-col gap-2 w-full min-w-0">
          <!-- Editable name -->
          <div v-if="editingName" class="flex flex-col gap-2">
            <input
              ref="nameInputEl"
              v-model="nameInput"
              class="w-full text-2xl font-bold tracking-tight bg-transparent border-b border-primary outline-none"
              @keydown.enter="saveName"
              @keydown.escape="editingName = false"
            >
            <div class="flex items-center gap-2">
              <Button size="sm" class="h-7 text-xs" @click="saveName">
                Save
              </Button>
              <Button size="sm" variant="ghost" class="h-7 text-xs" @click="editingName = false">
                Cancel
              </Button>
            </div>
          </div>
          <h1
            v-else
            class="text-2xl font-bold tracking-tight leading-tight cursor-pointer hover:text-muted-foreground transition-colors group flex items-center gap-2"
            @click="startEditName"
          >
            {{ listing.name }}
            <Icon name="lucide:pencil" class="size-3.5 opacity-0 group-hover:opacity-50 transition-opacity" />
          </h1>

          <span class="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Icon name="lucide:map-pin" class="size-3.5" />
            {{ listing.location }}
          </span>

          <!-- Editable tags -->
          <div class="flex flex-wrap items-center gap-1.5">
            <Badge
              v-for="tag in listing.tags"
              :key="tag"
              variant="secondary"
              class="text-xs gap-1 cursor-pointer"
              @click="removeTag(tag)"
            >
              {{ tag }}
              <Icon name="lucide:x" class="size-3" />
            </Badge>

            <Popover v-model:open="tagPopoverOpen">
              <PopoverTrigger as-child>
                <button class="flex items-center gap-1 rounded-full border border-dashed px-2 py-0.5 text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors">
                  <Icon name="lucide:plus" class="size-3" />
                  Add tag
                </button>
              </PopoverTrigger>
              <PopoverContent class="w-48 p-0" align="start">
                <div class="p-2">
                  <Input v-model="tagSearch" placeholder="Search tags..." class="h-7 text-xs" />
                </div>
                <ScrollArea class="h-40">
                  <div class="space-y-0.5 p-1">
                    <div
                      v-if="canCreateTag"
                      class="cursor-pointer rounded-sm px-2 py-1.5 text-sm hover:bg-accent flex items-center gap-2"
                      @click="addTag(tagSearch); tagPopoverOpen = false"
                    >
                      <Icon name="lucide:plus" class="size-3.5 text-muted-foreground" />
                      Create <span class="font-medium">"{{ tagSearch.trim() }}"</span>
                    </div>
                    <div
                      v-for="tag in filteredAvailableTags"
                      :key="tag"
                      class="cursor-pointer rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                      @click="addTag(tag); tagPopoverOpen = false"
                    >
                      {{ tag }}
                    </div>
                    <p v-if="filteredAvailableTags.length === 0 && !canCreateTag" class="px-2 py-1.5 text-xs text-muted-foreground">
                      No tags found.
                    </p>
                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <!-- Action buttons -->
        <div class="flex items-center gap-2 mt-auto self-end">
          <ListingAssignedUsers :listing="listing" />
          <Button variant="outline" size="sm" class="h-9 gap-2 px-3 text-sm" as-child>
            <NuxtLink
              :to="`/listings/${listing.id}/setup`"
              :aria-label="`Listing Setup, ${setupProgress.percent}% complete`"
              data-testid="listing-setup-link"
            >
              <Icon name="lucide:layout-panel-left" class="size-4" />
              Listing Setup
              <!-- Same numbers as the setup page sidebar (`listingSetupProgress`). -->
              <Icon
                v-if="setupProgress.percent === 100"
                name="lucide:circle-check"
                class="size-4 text-green-600 dark:text-green-400"
              />
              <!-- Amber while unfinished so it catches the eye; a mini ring shows how far along. -->
              <span
                v-else
                class="inline-flex items-center gap-1 rounded-full bg-amber-100 py-0.5 pl-1 pr-1.5 text-[11px] font-semibold leading-none tabular-nums text-amber-800 ring-1 ring-amber-300 dark:bg-amber-500/20 dark:text-amber-300 dark:ring-amber-500/40"
                :title="`${setupProgress.completeSections} of ${setupProgress.sections.length} sections complete`"
                data-testid="listing-setup-progress"
              >
                <svg viewBox="0 0 16 16" class="size-3.5 -rotate-90" aria-hidden="true">
                  <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="2.5" class="opacity-25" />
                  <circle
                    cx="8"
                    cy="8"
                    r="6"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    :stroke-dasharray="`${(setupProgress.percent / 100) * 37.7} 37.7`"
                  />
                </svg>
                {{ setupProgress.percent }}%
              </span>
            </NuxtLink>
          </Button>
          <!-- ElevAI on or off: the chip opens switches for the listing and, multi-unit, each room. -->
          <Popover v-model:open="aiMenuOpen">
            <PopoverTrigger as-child>
              <button
                type="button"
                class="inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium ring-1 transition-opacity hover:opacity-80"
                :class="AI_CHIP[aiStatus]?.class"
                :aria-label="`${AI_CHIP[aiStatus]?.label}. Change`"
                data-testid="hero-ai-status"
              >
                <SharedAiIcon :custom-class="aiStatus === 'active' ? 'size-4' : 'size-4 grayscale opacity-50'" />
                {{ AI_CHIP[aiStatus]?.label }}
                <template v-if="aiStatus === 'active'">
                  <span v-if="aiRooms && aiRooms.active < aiRooms.total" class="font-normal opacity-80">· on {{ aiRooms.active }} of {{ aiRooms.total }} rooms</span>
                  <span v-else-if="summary" class="font-normal opacity-80">· {{ summary }}</span>
                </template>
                <Icon name="lucide:chevron-down" class="size-3 opacity-70" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" class="w-72 p-0" data-testid="hero-ai-menu">
              <div class="flex items-center justify-between gap-3 border-b px-3 py-2.5">
                <div class="flex items-center gap-2">
                  <SharedAiIcon custom-class="size-4" />
                  <div class="flex flex-col">
                    <span class="text-sm font-medium">ElevAI</span>
                    <span class="text-xs text-muted-foreground">Replies to guests for this listing</span>
                  </div>
                </div>
                <Switch
                  :model-value="aiStatus === 'active'"
                  aria-label="ElevAI for this listing"
                  data-testid="hero-ai-switch"
                  @update:model-value="(v: boolean) => setAi(v)"
                />
              </div>
              <div v-if="aiRoomList.length && listing.unitType === 'multi'" class="flex max-h-64 flex-col gap-1 overflow-y-auto border-b px-3 py-2" data-testid="hero-ai-rooms">
                <span class="text-xs font-medium text-muted-foreground">Rooms</span>
                <div v-for="room in aiRoomList" :key="room.unit.id" class="flex items-center justify-between gap-3 py-1">
                  <div class="flex min-w-0 flex-col">
                    <span class="truncate text-sm">{{ room.unit.name }}</span>
                    <span class="truncate text-xs text-muted-foreground">{{ room.typeName }}</span>
                  </div>
                  <Switch
                    :model-value="room.aiStatus === 'active'"
                    :aria-label="`ElevAI for ${room.unit.name}`"
                    @update:model-value="(v: boolean) => setRoomAiFor(room.unit.id, room.unit.name, v)"
                  />
                </div>
              </div>
              <button
                type="button"
                class="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-muted/60"
                @click="aiMenuOpen = false; showScheduleSheet = true"
              >
                <Icon name="lucide:clock" class="size-4 text-muted-foreground" />
                AI schedule
                <span v-if="summary" class="ml-auto text-xs text-muted-foreground">{{ summary }}</span>
              </button>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>

    <!-- Photo Manager Dialog -->
    <Dialog v-model:open="showPhotoDialog">
      <DialogContent class="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Manage Photos</DialogTitle>
          <DialogDescription>
            Drag to reorder. The first photo is the thumbnail. Max 20 photos, 10MB each (JPEG, PNG, WebP).
          </DialogDescription>
        </DialogHeader>

        <ScrollArea class="max-h-[65vh]">
          <div class="p-1">
            <ListingPhotosEditor
              :photos="listing.photos"
              @update:photos="(photos) => emit('update', { ...listing, photos })"
            />
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>

    <ListingAiScheduleSheet v-model:open="showScheduleSheet" :listing="listing" @update="emit('update', $event)" />
  </div>
</template>
