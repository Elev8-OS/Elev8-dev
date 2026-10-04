<script setup lang="ts">
import type { AiSchedule, DateOverride, Listing, OverrideAudience, TimeSlot } from '~/components/listings/data/listings'
import { toast } from 'vue-sonner'
import { allTags, listings } from '~/components/listings/data/listings'

/**
 * ElevAI's schedule for a listing: weekly hours, date overrides, and copy to
 * other listings. Opened from the listing hero and from Listing Setup.
 */
const props = defineProps<{ listing: Listing }>()
const emit = defineEmits<{ update: [listing: Listing] }>()
const open = defineModel<boolean>('open', { default: false })

const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const scheduleTab = ref<'weekly' | 'overrides'>('weekly')
const schedule = computed(() => props.listing.aiSchedule)

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
  open.value = false
}

// Copy to other listings
const showCopyDialog = ref(false)
const copyTargets = ref<string[]>([])
const copySearch = ref('')
const copyTagFilters = ref<string[]>([])
const copyTagSearch = ref('')
const copyTagPopoverOpen = ref(false)
const otherListings = computed(() => listings.value.filter(l => l.id !== props.listing.id))

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
  <!-- AI Schedule Sheet -->
  <Sheet v-model:open="open">
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
                      :class="day.activeFor.includes(opt.value) ? 'border-primary text-foreground bg-primary/5' : ''"
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
                    :class="o.activeFor.includes(opt.value) ? 'border-primary text-foreground bg-primary/5' : ''"
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
</template>
