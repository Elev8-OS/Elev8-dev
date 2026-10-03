<script setup lang="ts">
import type { AiSchedule, DateOverride, Listing, OverrideAudience, TimeSlot, Unit } from '~/components/listings/data/listings'
import { toast } from 'vue-sonner'
import { allTags, getUnitById, getUnits, listings } from '~/components/listings/data/listings'
import ListingAssignedUsers from '~/components/listings/ListingAssignedUsers.vue'

const props = defineProps<{ listing: Listing, openSchedule?: boolean }>()
const emit = defineEmits<{ update: [listing: Listing], openTestAi: [], openSchedule: [] }>()
const router = useRouter()

function otaIcon(ota: string) {
  return ota === 'Airbnb' ? 'logos:airbnb' : 'simple-icons:bookingdotcom'
}

// Photo manager
const showPhotoDialog = ref(false)
const fileInputEl = ref<HTMLInputElement | null>(null)
const replaceInputEl = ref<HTMLInputElement | null>(null)
const replaceIndex = ref<number | null>(null)
const previewPhoto = ref<string | null>(null)
const dragIndex = ref<number | null>(null)
const MAX_PHOTOS = 20
const MAX_SIZE = 10 * 1024 * 1024
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp']

function uploadPhotos(files: FileList | null) {
  if (!files)
    return
  const current = props.listing.photos.length
  const remaining = MAX_PHOTOS - current
  const toProcess = Array.from(files).slice(0, remaining)
  toProcess.forEach((file) => {
    if (!ALLOWED.includes(file.type))
      return
    if (file.size > MAX_SIZE)
      return
    const reader = new FileReader()
    reader.onload = (e) => {
      const src = e.target?.result as string
      emit('update', { ...props.listing, photos: [...props.listing.photos, src] })
    }
    reader.readAsDataURL(file)
  })
}

function replacePhoto(files: FileList | null) {
  if (!files || replaceIndex.value === null)
    return
  const file = files[0]
  if (!file || !ALLOWED.includes(file.type) || file.size > MAX_SIZE)
    return
  const reader = new FileReader()
  reader.onload = (e) => {
    const src = e.target?.result as string
    const photos = [...props.listing.photos]
    photos[replaceIndex.value!] = src
    emit('update', { ...props.listing, photos })
    replaceIndex.value = null
  }
  reader.readAsDataURL(file)
}

function startReplace(index: number) {
  replaceIndex.value = index
  replaceInputEl.value?.click()
}

function deletePhoto(index: number) {
  const photos = props.listing.photos.filter((_, i) => i !== index)
  emit('update', { ...props.listing, photos })
}

function onDragStart(index: number) { dragIndex.value = index }
function onDragOver(e: DragEvent) { e.preventDefault() }
function onDrop(targetIndex: number) {
  if (dragIndex.value === null || dragIndex.value === targetIndex)
    return
  const photos = [...props.listing.photos]
  const [moved] = photos.splice(dragIndex.value, 1)
  photos.splice(targetIndex, 0, moved!)
  emit('update', { ...props.listing, photos })
  dragIndex.value = null
}

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
const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const showScheduleSheet = ref(false)
watch(() => props.openSchedule, (val) => {
  if (val)
    showScheduleSheet.value = true
})
const scheduleTab = ref<'weekly' | 'overrides'>('weekly')
const schedule = computed(() => props.listing.aiSchedule)

const aiStatusLabel: Record<string, string> = {
  active: 'AI Active',
  paused: 'AI Paused',
  not_set: 'AI Not Set',
}

const summary = computed(() => {
  if (props.listing.aiStatus !== 'active')
    return null
  if (schedule.value.always)
    return '24/7'
  const count = schedule.value.days.filter(d => d.enabled).length
  return count > 0 ? `${count} day${count > 1 ? 's' : ''}` : 'Off'
})

function patchSchedule(patch: Partial<AiSchedule>) {
  emit('update', { ...props.listing, aiSchedule: { ...schedule.value, ...patch } })
}

function setAlways(val: boolean) {
  patchSchedule({ always: val })
}

function updateDay(index: number, patch: Partial<AiSchedule['days'][number]>) {
  const days = schedule.value.days.map((d, i) => i === index ? { ...d, ...patch } : d)
  patchSchedule({ days })
}

function toggleDayAudience(index: number, value: OverrideAudience) {
  const day = schedule.value.days[index]!
  const activeFor = day.activeFor.includes(value)
    ? day.activeFor.filter(a => a !== value)
    : [...day.activeFor, value]
  updateDay(index, { activeFor })
}

// Time slot helpers
function addMinutes(t: string, mins: number): string {
  const [h, m] = t.split(':').map(Number)
  const total = Math.min(Math.max((h! * 60 + m!) + mins, 0), 23 * 60 + 59)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

// Sort slots and push each start past the previous end so they never overlap
function normalizeSlots(slots: TimeSlot[]): TimeSlot[] {
  const sorted = [...slots].sort((a, b) => a.start.localeCompare(b.start))
  let prevEnd = '00:00'
  return sorted.map((s) => {
    let start = s.start
    let end = s.end
    if (start < prevEnd)
      start = prevEnd
    if (end <= start)
      end = addMinutes(start, 60)
    prevEnd = end
    return { ...s, start, end }
  })
}

function updateSlot(dayIndex: number, slotId: string, patch: Partial<TimeSlot>) {
  const day = schedule.value.days[dayIndex]!
  const slots = normalizeSlots(day.slots.map(s => s.id === slotId ? { ...s, ...patch } : s))
  updateDay(dayIndex, { slots })
}

function addSlot(dayIndex: number) {
  const day = schedule.value.days[dayIndex]!
  const last = day.slots[day.slots.length - 1]
  const start = last ? last.end : '09:00'
  const slot: TimeSlot = { id: `ts-${Date.now()}`, start, end: addMinutes(start, 120) }
  updateDay(dayIndex, { slots: normalizeSlots([...day.slots, slot]) })
}

function removeSlot(dayIndex: number, slotId: string) {
  const day = schedule.value.days[dayIndex]!
  updateDay(dayIndex, { slots: day.slots.filter(s => s.id !== slotId) })
}

// Clear All: reset hours + settings only (keep enabled state)
function clearAll() {
  const days = schedule.value.days.map(d => ({
    ...d,
    slots: [{ id: 'ts-0', start: '00:00', end: '23:59' }],
    activeFor: ['future', 'current', 'inquiry'] as OverrideAudience[],
  }))
  patchSchedule({ days })
}

function saveSchedule() {
  toast.success('Schedule saved')
  showScheduleSheet.value = false
}

// Copy to other listings
const showCopyDialog = ref(false)
const copyTargets = ref<string[]>([])
const copySearch = ref('')
const copyTagFilters = ref<string[]>([])
const copyTagSearch = ref('')
const copyTagPopoverOpen = ref(false)
const otherListings = computed(() => listings.value.filter(l => l.id !== props.listing.id))

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

const filteredCopyTags = computed(() => {
  if (!copyTagSearch.value)
    return allTags.value
  const q = copyTagSearch.value.toLowerCase()
  return allTags.value.filter(t => t.toLowerCase().includes(q))
})

watch(copyTagPopoverOpen, (open) => {
  if (!open)
    copyTagSearch.value = ''
})

const filteredCopyListings = computed(() => otherListings.value.filter((l) => {
  const matchesSearch = !copySearch.value || l.name.toLowerCase().includes(copySearch.value.toLowerCase())
  const matchesTags = copyTagFilters.value.length === 0 || copyTagFilters.value.every(t => l.tags.includes(t))
  return matchesSearch && matchesTags
}))

const allFilteredSelected = computed(() =>
  filteredCopyListings.value.length > 0 && filteredCopyListings.value.every(l => copyTargets.value.includes(l.id)),
)

function toggleCopyTag(tag: string) {
  copyTagFilters.value = copyTagFilters.value.includes(tag)
    ? copyTagFilters.value.filter(t => t !== tag)
    : [...copyTagFilters.value, tag]
}

function toggleSelectAll() {
  const ids = filteredCopyListings.value.map(l => l.id)
  if (allFilteredSelected.value) {
    copyTargets.value = copyTargets.value.filter(id => !ids.includes(id))
  }
  else {
    copyTargets.value = [...new Set([...copyTargets.value, ...ids])]
  }
}

function toggleTarget(id: string) {
  copyTargets.value = copyTargets.value.includes(id)
    ? copyTargets.value.filter(t => t !== id)
    : [...copyTargets.value, id]
}

function applyCopy() {
  const clone = JSON.parse(JSON.stringify(schedule.value)) as AiSchedule
  listings.value = listings.value.map(l =>
    copyTargets.value.includes(l.id) ? { ...l, aiSchedule: JSON.parse(JSON.stringify(clone)) } : l,
  )
  toast.success(`Copied to ${copyTargets.value.length} listing${copyTargets.value.length > 1 ? 's' : ''}`)
  copyTargets.value = []
  copySearch.value = ''
  copyTagFilters.value = []
  copyTagSearch.value = ''
  showCopyDialog.value = false
}

// Date overrides
const audienceOptions: { value: OverrideAudience, label: string }[] = [
  { value: 'future', label: 'Future' },
  { value: 'current', label: 'Current' },
  { value: 'inquiry', label: 'Inquiry' },
]

function addOverride() {
  const today = new Date().toISOString().split('T')[0]!
  const o: DateOverride = {
    id: `do-${Date.now()}`,
    startDate: today,
    startTime: '09:00',
    endDate: today,
    endTime: '17:00',
    activeFor: ['future', 'current', 'inquiry'],
  }
  patchSchedule({ dateOverrides: [...schedule.value.dateOverrides, o] })
}

function updateOverride(id: string, patch: Partial<DateOverride>) {
  patchSchedule({ dateOverrides: schedule.value.dateOverrides.map(o => o.id === id ? { ...o, ...patch } : o) })
}

function removeOverride(id: string) {
  patchSchedule({ dateOverrides: schedule.value.dateOverrides.filter(o => o.id !== id) })
}

function toggleAudience(o: DateOverride, value: OverrideAudience) {
  const activeFor = o.activeFor.includes(value)
    ? o.activeFor.filter(a => a !== value)
    : [...o.activeFor, value]
  updateOverride(o.id, { activeFor })
}
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
            <NuxtLink :to="`/listings/${listing.id}/setup`">
              <Icon name="lucide:layout-panel-left" class="size-4" />
              Listing Setup
            </NuxtLink>
          </Button>
          <Button variant="outline" size="sm" class="h-9 gap-2 px-3 text-sm" @click="emit('openTestAi')">
            <SharedAiIcon custom-class="size-4" />
            Test AI
          </Button>
          <Button variant="outline" size="sm" class="h-9 gap-2 px-3 text-sm" @click="emit('openSchedule')">
            <Icon name="lucide:clock" class="size-4" />
            Schedule
          </Button>
        </div>
      </div>
    </div>

    <!-- Photo Manager Dialog -->
    <Dialog v-model:open="showPhotoDialog">
      <DialogContent class="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Manage Photos</DialogTitle>
          <DialogDescription>
            Drag to reorder · First photo is the thumbnail · Max {{ MAX_PHOTOS }} photos · Max 10MB per file · JPEG, PNG, WebP
          </DialogDescription>
        </DialogHeader>

        <ScrollArea class="max-h-[65vh]">
          <div class="grid grid-cols-3 gap-3 p-1">
            <div
              v-for="(photo, index) in listing.photos"
              :key="photo"
              class="group relative aspect-video overflow-hidden rounded-lg border-2 cursor-grab transition-colors"
              :class="index === 0 ? 'border-primary' : 'border-transparent hover:border-muted-foreground/30'"
              draggable="true"
              @dragstart="onDragStart(index)"
              @dragover="onDragOver"
              @drop="onDrop(index)"
            >
              <img :src="photo" :alt="`Photo ${index + 1}`" class="size-full object-cover">

              <!-- Hover overlay -->
              <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <button
                  class="flex size-8 items-center justify-center rounded-full bg-white/20 hover:bg-white/40 text-white transition-colors"
                  title="View full"
                  @click.stop="previewPhoto = photo"
                >
                  <Icon name="lucide:expand" class="size-4" />
                </button>
                <button
                  class="flex size-8 items-center justify-center rounded-full bg-white/20 hover:bg-white/40 text-white transition-colors"
                  title="Replace"
                  @click.stop="startReplace(index)"
                >
                  <Icon name="lucide:image-plus" class="size-4" />
                </button>
                <button
                  class="flex size-8 items-center justify-center rounded-full bg-white/20 hover:bg-red-500/80 text-white transition-colors"
                  title="Delete"
                  @click.stop="deletePhoto(index)"
                >
                  <Icon name="lucide:trash-2" class="size-4" />
                </button>
              </div>

              <Badge v-if="index === 0" class="absolute top-1.5 left-1.5 text-[10px] px-1.5 py-0">
                Thumbnail
              </Badge>
            </div>

            <!-- Upload slot -->
            <button
              v-if="listing.photos.length < MAX_PHOTOS"
              class="aspect-video rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-1.5 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
              @click="fileInputEl?.click()"
            >
              <Icon name="lucide:plus" class="size-6" />
              <span class="text-xs">Add photo</span>
              <span class="text-[10px]">{{ listing.photos.length }}/{{ MAX_PHOTOS }}</span>
            </button>
          </div>
        </ScrollArea>

        <!-- Hidden file inputs -->
        <input
          ref="fileInputEl" type="file" accept="image/jpeg,image/png,image/webp" multiple class="hidden"
          @change="uploadPhotos(($event.target as HTMLInputElement).files)"
        >
        <input
          ref="replaceInputEl" type="file" accept="image/jpeg,image/png,image/webp" class="hidden"
          @change="replacePhoto(($event.target as HTMLInputElement).files)"
        >
      </DialogContent>
    </Dialog>

    <!-- Full preview lightbox -->
    <Dialog :open="!!previewPhoto" @update:open="(v) => { if (!v) previewPhoto = null }">
      <DialogContent class="max-w-5xl p-2 bg-black/90 border-0">
        <img v-if="previewPhoto" :src="previewPhoto" class="w-full max-h-[85vh] object-contain rounded">
      </DialogContent>
    </Dialog>

    <!-- AI Schedule Sheet -->
    <Sheet v-model:open="showScheduleSheet">
      <SheetContent class="w-full sm:max-w-md p-0">
        <SheetHeader>
          <SheetTitle>Schedule</SheetTitle>
          <SheetDescription>{{ listing.name }}</SheetDescription>
        </SheetHeader>

        <!-- Scrollable body -->
        <div class="flex-1 overflow-y-auto px-4">
          <Tabs v-model="scheduleTab">
            <TabsList class="w-full">
              <TabsTrigger value="weekly" class="flex-1">
                Weekly Schedule
              </TabsTrigger>
              <TabsTrigger value="overrides" class="flex-1">
                Date Overrides
              </TabsTrigger>
            </TabsList>

            <!-- Weekly Schedule -->
            <TabsContent value="weekly" class="mt-5 flex flex-col gap-5">
              <p class="text-xs text-muted-foreground">
                Set the hours when ElevAI is active for guests, repeated every week. Turn on 24/7 for always-on coverage, or customize by day.
              </p>

              <!-- 24/7 Toggle -->
              <div class="flex items-start justify-between gap-3 rounded-lg border p-4">
                <div class="flex flex-col gap-0.5">
                  <span class="text-sm font-medium">24/7 Availability</span>
                  <span class="text-xs text-muted-foreground">ElevAI will be on 24/7, ready to respond to any guest message at any time.</span>
                </div>
                <Switch :model-value="schedule.always" @update:model-value="(val: boolean) => setAlways(val)" />
              </div>

              <!-- Custom Schedule (disabled when 24/7 on) -->
              <div class="flex flex-col gap-3" :class="schedule.always ? 'pointer-events-none opacity-50' : ''">
                <span class="text-sm font-medium">Custom Schedule</span>
                <div
                  v-for="(day, index) in schedule.days"
                  :key="index"
                  class="flex flex-col gap-2 rounded-lg border p-3"
                >
                  <div class="flex items-center gap-3">
                    <Switch :model-value="day.enabled" class="shrink-0" @update:model-value="(val: boolean) => updateDay(index, { enabled: val })" />
                    <span class="text-sm font-medium">{{ dayNames[index] }}</span>
                    <span v-if="!day.enabled" class="ml-auto text-xs text-muted-foreground">Unavailable</span>
                  </div>

                  <div v-if="day.enabled" class="flex flex-col gap-2 pl-12">
                    <!-- Time slots -->
                    <div v-for="slot in day.slots" :key="slot.id" class="flex items-center gap-1.5">
                      <Input type="time" :model-value="slot.start" class="h-8 text-xs" @update:model-value="(val) => updateSlot(index, slot.id, { start: String(val) })" />
                      <span class="text-xs text-muted-foreground">to</span>
                      <Input type="time" :model-value="slot.end" class="h-8 text-xs" @update:model-value="(val) => updateSlot(index, slot.id, { end: String(val) })" />
                      <Button variant="ghost" size="icon" class="size-7 shrink-0 text-muted-foreground hover:text-destructive" :disabled="day.slots.length === 1" @click="removeSlot(index, slot.id)">
                        <Icon name="lucide:x" class="size-3.5" />
                      </Button>
                    </div>

                    <Button variant="ghost" size="sm" class="h-6 w-fit gap-1 text-[11px] text-muted-foreground" @click="addSlot(index)">
                      <Icon name="lucide:plus" class="size-3" />
                      Add time
                    </Button>

                    <!-- Audience -->
                    <div class="flex flex-wrap gap-1.5 pt-1">
                      <Button
                        v-for="opt in audienceOptions"
                        :key="opt.value"
                        variant="outline"
                        size="sm"
                        class="h-6 text-[11px] px-2"
                        :class="day.activeFor.includes(opt.value) ? 'border-primary text-primary bg-primary/5' : ''"
                        @click="toggleDayAudience(index, opt.value)"
                      >
                        {{ opt.label }}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <!-- Date Overrides -->
            <TabsContent value="overrides" class="mt-5 flex flex-col gap-3">
              <p class="text-xs text-muted-foreground">
                Override your weekly schedule for specific date ranges — ideal for holidays, vacations, or special events. These rules take priority over the weekly schedule.
              </p>

              <div
                v-for="o in schedule.dateOverrides"
                :key="o.id"
                class="flex flex-col gap-3 rounded-lg border p-4"
              >
                <div class="flex items-center justify-between">
                  <span class="text-sm font-medium">Date Range</span>
                  <Button variant="ghost" size="icon" class="size-7 text-muted-foreground hover:text-destructive" @click="removeOverride(o.id)">
                    <Icon name="lucide:trash-2" class="size-4" />
                  </Button>
                </div>

                <!-- Start -->
                <div class="flex flex-col gap-1.5">
                  <Label class="text-xs">Start</Label>
                  <div class="flex items-center gap-2">
                    <Input type="date" :model-value="o.startDate" class="h-8 flex-1 text-xs" @update:model-value="(val) => updateOverride(o.id, { startDate: String(val) })" />
                    <Input type="time" :model-value="o.startTime" class="h-8 w-28 text-xs" @update:model-value="(val) => updateOverride(o.id, { startTime: String(val) })" />
                  </div>
                </div>

                <!-- End -->
                <div class="flex flex-col gap-1.5">
                  <Label class="text-xs">End</Label>
                  <div class="flex items-center gap-2">
                    <Input type="date" :model-value="o.endDate" class="h-8 flex-1 text-xs" @update:model-value="(val) => updateOverride(o.id, { endDate: String(val) })" />
                    <Input type="time" :model-value="o.endTime" class="h-8 w-28 text-xs" @update:model-value="(val) => updateOverride(o.id, { endTime: String(val) })" />
                  </div>
                </div>

                <!-- Active for -->
                <div class="flex flex-col gap-1.5">
                  <Label class="text-xs">Active for</Label>
                  <div class="flex flex-wrap gap-1.5">
                    <Button
                      v-for="opt in audienceOptions"
                      :key="opt.value"
                      variant="outline"
                      size="sm"
                      class="h-7 text-xs"
                      :class="o.activeFor.includes(opt.value) ? 'border-primary text-primary bg-primary/5' : ''"
                      @click="toggleAudience(o, opt.value)"
                    >
                      {{ opt.label }}
                    </Button>
                  </div>
                </div>
              </div>

              <p v-if="schedule.dateOverrides.length === 0" class="text-sm text-muted-foreground text-center py-6">
                No date overrides yet.
              </p>

              <Button variant="outline" size="sm" class="w-fit gap-1.5" @click="addOverride">
                <Icon name="lucide:plus" class="size-4" />
                Add Date Range
              </Button>
            </TabsContent>
          </Tabs>
        </div>

        <!-- Fixed Footer -->
        <SheetFooter class="border-t">
          <div class="flex items-center justify-between gap-2">
            <Button variant="ghost" size="sm" class="text-xs text-muted-foreground" @click="clearAll">
              Clear All
            </Button>
            <div class="flex items-center gap-2">
              <Button variant="outline" size="sm" class="text-xs gap-1" @click="showCopyDialog = true">
                <Icon name="lucide:copy" class="size-3" />
                Copy to Properties
              </Button>
              <Button size="sm" class="text-xs" @click="saveSchedule">
                Save Schedule
              </Button>
            </div>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>

    <!-- Copy to Other Listings Dialog -->
    <Dialog v-model:open="showCopyDialog">
      <DialogContent class="max-w-md">
        <DialogHeader>
          <DialogTitle>Copy Schedule to Listings</DialogTitle>
          <DialogDescription>Apply this listing's AI schedule to other listings.</DialogDescription>
        </DialogHeader>

        <!-- Search + Tag filter -->
        <div class="flex items-center gap-2">
          <div class="relative flex-1">
            <Icon name="lucide:search" class="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input v-model="copySearch" placeholder="Search listings..." class="h-9 pl-8" />
          </div>
          <Popover v-model:open="copyTagPopoverOpen">
            <PopoverTrigger as-child>
              <Button variant="outline" size="sm" class="h-9 gap-1.5 text-xs" :class="copyTagFilters.length > 0 ? 'border-primary text-primary' : ''">
                <Icon name="lucide:tag" class="size-3.5" />
                Tags
                <Badge v-if="copyTagFilters.length > 0" variant="default" class="ml-0.5 h-4 min-w-4 rounded-full px-1 text-[9px]">
                  {{ copyTagFilters.length }}
                </Badge>
              </Button>
            </PopoverTrigger>
            <PopoverContent class="w-56 p-0" align="end" :side-offset="4">
              <div class="p-2">
                <Input v-model="copyTagSearch" placeholder="Search tags..." class="h-7 text-xs" />
              </div>
              <ScrollArea class="h-48 overflow-hidden">
                <div class="space-y-1">
                  <div v-for="tag in filteredCopyTags" :key="tag" class="flex items-center gap-2 cursor-pointer rounded-sm px-2 py-1.5 text-sm hover:bg-accent" @click="toggleCopyTag(tag)">
                    <div class="flex size-4 shrink-0 items-center justify-center rounded-[4px] border" :class="copyTagFilters.includes(tag) ? 'border-primary bg-primary text-primary-foreground' : 'border-input'">
                      <Icon v-if="copyTagFilters.includes(tag)" name="lucide:check" class="size-3" />
                    </div>
                    <span class="flex-1">{{ tag }}</span>
                  </div>
                  <p v-if="filteredCopyTags.length === 0" class="px-2 py-1.5 text-xs text-muted-foreground">
                    No tags found.
                  </p>
                </div>
              </ScrollArea>
              <div v-if="copyTagFilters.length > 0" class="border-t px-2 py-2">
                <Button variant="ghost" size="sm" class="h-7 w-full text-xs text-muted-foreground" @click="copyTagFilters = []">
                  Clear all tags
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <!-- Select all -->
        <div class="flex items-center justify-between border-b pb-2">
          <div class="flex items-center gap-2 cursor-pointer" @click="toggleSelectAll">
            <div class="flex size-4 shrink-0 items-center justify-center rounded-[4px] border" :class="allFilteredSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-input'">
              <Icon v-if="allFilteredSelected" name="lucide:check" class="size-3" />
            </div>
            <span class="text-xs font-medium">Select all</span>
          </div>
          <span class="text-xs text-muted-foreground">{{ copyTargets.length }} selected</span>
        </div>

        <ScrollArea class="max-h-64">
          <div class="flex flex-col gap-1">
            <div
              v-for="l in filteredCopyListings"
              :key="l.id"
              class="flex items-center gap-3 rounded-md px-2 py-2 cursor-pointer hover:bg-accent"
              @click="toggleTarget(l.id)"
            >
              <div class="flex size-4 shrink-0 items-center justify-center rounded-[4px] border" :class="copyTargets.includes(l.id) ? 'border-primary bg-primary text-primary-foreground' : 'border-input'">
                <Icon v-if="copyTargets.includes(l.id)" name="lucide:check" class="size-3" />
              </div>
              <span class="text-sm truncate">{{ l.name }}</span>
            </div>
            <p v-if="filteredCopyListings.length === 0" class="text-sm text-muted-foreground text-center py-6">
              No listings found.
            </p>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" @click="showCopyDialog = false">
            Cancel
          </Button>
          <Button :disabled="copyTargets.length === 0" @click="applyCopy">
            Copy to {{ copyTargets.length || '' }} listing{{ copyTargets.length > 1 ? 's' : '' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
