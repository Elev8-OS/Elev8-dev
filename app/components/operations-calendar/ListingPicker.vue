<script setup lang="ts">
import type { CalendarListing } from '~/components/operations-calendar/data/operations-calendar'
import { allTags, listings } from '~/components/listings/data/listings'
import { getCalendarListings } from '~/components/operations-calendar/data/operations-calendar'

const props = defineProps<{
  modelValue: string
  listingName?: string | null
  placeholder?: string
  inDialog?: boolean
  /** With `pickRooms`: the chosen room of a multi-unit listing; null = the whole property. */
  unitId?: string | null
  /** Offer each multi-unit listing's rooms under it (the cleaning form). */
  pickRooms?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'update:listingName': [value: string]
  'update:unitId': [value: string | null]
}>()

const open = ref(false)
const tagPickerOpen = ref(false)
const search = ref('')
const tagSearch = ref('')
const selectedTags = ref<string[]>([])

const collapsedNodes = ref<Set<string>>(new Set())

const filteredTags = computed(() => {
  if (!tagSearch.value.trim())
    return allTags.value
  const q = tagSearch.value.toLowerCase()
  return allTags.value.filter(t => t.toLowerCase().includes(q))
})

const calendarListings = computed(() => getCalendarListings())

const isSearching = computed(() => search.value.trim().length > 0)

const filteredListings = computed<CalendarListing[]>(() => {
  let list = calendarListings.value
  if (selectedTags.value.length > 0) {
    list = list.filter(l => selectedTags.value.every(t => l.tags.includes(t)))
  }
  if (isSearching.value) {
    const q = search.value.toLowerCase()
    list = list.filter(l =>
      `${l.name} ${l.rooms.map(r => r.name).join(' ')}`.toLowerCase().includes(q),
    )
  }
  return [...list].sort((a, b) => a.name.localeCompare(b.name))
})

const selectedListing = computed(() => listings.value.find(l => l.id === props.modelValue) ?? null)

const selectedRoom = computed(() => props.unitId
  ? calendarListings.value.find(l => l.id === props.modelValue)?.rooms.find(r => r.id === props.unitId)
  : undefined)

const displayLabel = computed(() => {
  if (selectedListing.value)
    return selectedRoom.value ? `${selectedListing.value.name} · ${selectedRoom.value.name}` : selectedListing.value.name
  return props.listingName || props.placeholder || 'Choose a listing'
})

function isNodeExpanded(nodeId: string) {
  return isSearching.value || !collapsedNodes.value.has(nodeId)
}

function toggleNode(nodeId: string) {
  const next = new Set(collapsedNodes.value)
  if (next.has(nodeId))
    next.delete(nodeId)
  else
    next.add(nodeId)
  collapsedNodes.value = next
}

function expandAll() {
  collapsedNodes.value = new Set()
}

function collapseAll() {
  collapsedNodes.value = new Set(filteredListings.value.filter(l => l.rooms.length).map(l => l.id))
}

/** Listings first (a listing is a property); with `pickRooms`, a multi-unit listing's rooms under it. */
interface PickerTreeNode {
  id: string
  type: 'listing' | 'room'
  label: string
  sublabel?: string
  listing: CalendarListing
  unitId?: string
}

const listingTree = computed<PickerTreeNode[]>(() => {
  const tree: PickerTreeNode[] = []
  for (const listing of filteredListings.value) {
    tree.push({ id: listing.id, type: 'listing', label: listing.name, sublabel: props.pickRooms && listing.rooms.length ? 'Whole property' : undefined, listing })
    if (!props.pickRooms || !listing.rooms.length || !isNodeExpanded(listing.id))
      continue
    for (const room of listing.rooms)
      tree.push({ id: `${listing.id}:${room.id}`, type: 'room', label: room.name, sublabel: room.typeName, listing, unitId: room.id })
  }
  return tree
})

function isPicked(node: PickerTreeNode) {
  return props.modelValue === node.listing.id && (node.unitId ?? null) === (props.unitId ?? null)
}

function toggleTag(tag: string) {
  const idx = selectedTags.value.indexOf(tag)
  if (idx === -1)
    selectedTags.value = [...selectedTags.value, tag]
  else selectedTags.value = selectedTags.value.filter(t => t !== tag)
}

function clearTags() {
  selectedTags.value = []
}

function pick(node: PickerTreeNode) {
  emit('update:modelValue', node.listing.id)
  emit('update:listingName', node.listing.name)
  emit('update:unitId', node.unitId ?? null)
  open.value = false
}

function clearSelection() {
  emit('update:modelValue', '')
  emit('update:listingName', '')
  emit('update:unitId', null)
}
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <Button
        variant="outline"
        class="h-9 w-full justify-start gap-1.5 px-3 text-sm font-normal" :class="[
          !modelValue ? 'text-muted-foreground' : '',
        ]"
      >
        <Icon name="lucide:building-2" class="h-4 w-4 shrink-0 text-muted-foreground" />
        <span class="flex-1 truncate text-left">{{ displayLabel }}</span>
        <Icon name="lucide:chevrons-up-down" class="h-4 w-4 shrink-0 text-muted-foreground" />
      </Button>
    </PopoverTrigger>

    <PopoverContent class="w-80 p-0" align="start" :side-offset="4">
      <!-- Search + Tags row -->
      <div class="flex items-center gap-2 border-b px-3 py-2">
        <Icon name="lucide:search" class="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <input
          v-model="search"
          class="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          placeholder="Search listings…"
        >
        <button v-if="search" class="shrink-0 text-muted-foreground hover:text-foreground" @click="search = ''">
          <Icon name="lucide:x" class="h-3.5 w-3.5" />
        </button>

        <Popover v-model:open="tagPickerOpen">
          <PopoverTrigger as-child>
            <Button
              variant="outline"
              class="h-7 shrink-0 gap-1 px-2 text-xs"
              :class="selectedTags.length > 0 ? 'border-primary text-primary' : 'text-muted-foreground'"
            >
              <Icon name="lucide:tag" class="h-3 w-3" />
              Tags
              <span v-if="selectedTags.length > 0" class="font-semibold">{{ selectedTags.length }}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent class="w-52 p-0" align="end" :side-offset="4">
            <div class="flex items-center gap-2 border-b px-3 py-2">
              <Icon name="lucide:search" class="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <input
                v-model="tagSearch"
                class="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
                placeholder="Search tags…"
              >
            </div>
            <ScrollArea class="h-52">
              <div class="p-1">
                <button
                  v-for="tag in filteredTags"
                  :key="tag"
                  type="button"
                  class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted"
                  @click="toggleTag(tag)"
                >
                  <div
                    class="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border" :class="[
                      selectedTags.includes(tag) ? 'border-primary bg-primary text-primary-foreground' : 'border-input',
                    ]"
                  >
                    <Icon v-if="selectedTags.includes(tag)" name="lucide:check" class="h-3 w-3" />
                  </div>
                  <span class="truncate text-sm">{{ tag }}</span>
                </button>
                <p v-if="filteredTags.length === 0" class="py-4 text-center text-xs text-muted-foreground">
                  No tags found
                </p>
              </div>
            </ScrollArea>
            <div class="flex items-center justify-between border-t px-3 py-2">
              <span class="text-xs text-muted-foreground">{{ selectedTags.length }} selected</span>
              <button
                v-if="selectedTags.length > 0"
                class="text-xs text-muted-foreground hover:text-foreground"
                @click="clearTags"
              >
                Clear
              </button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <!-- Active tag chips -->
      <div v-if="selectedTags.length > 0" class="flex flex-wrap gap-1 border-b px-3 py-2">
        <span
          v-for="tag in selectedTags"
          :key="tag"
          class="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-foreground"
        >
          {{ tag }}
          <button class="hover:text-destructive" @click="toggleTag(tag)">
            <Icon name="lucide:x" class="h-2.5 w-2.5" />
          </button>
        </span>
      </div>

      <!-- Listings, and (pickRooms) their rooms -->
      <div class="flex items-center justify-between border-b px-3 py-1.5">
        <span class="text-xs font-medium text-muted-foreground">{{ pickRooms ? 'Listings and rooms' : 'Listings' }}</span>
        <div v-if="pickRooms" class="flex items-center gap-1">
          <button class="text-muted-foreground hover:text-foreground transition-colors" title="Show all rooms" aria-label="Show all rooms" @click="expandAll">
            <Icon name="lucide:chevrons-down" class="size-3.5" />
          </button>
          <button class="text-muted-foreground hover:text-foreground transition-colors" title="Hide all rooms" aria-label="Hide all rooms" @click="collapseAll">
            <Icon name="lucide:chevrons-up" class="size-3.5" />
          </button>
        </div>
      </div>

      <ScrollArea class="h-56">
        <div class="p-1">
          <template v-if="listingTree.length > 0">
            <div
              v-for="node in listingTree"
              :key="node.id"
              class="flex items-center gap-1 rounded-md transition-colors hover:bg-muted"
              :class="[node.type === 'room' ? 'pl-6' : '', isPicked(node) ? 'bg-accent' : '']"
            >
              <button
                v-if="node.type === 'listing' && pickRooms && node.listing.rooms.length"
                type="button"
                class="ml-1 shrink-0 text-muted-foreground hover:text-foreground"
                :aria-label="isNodeExpanded(node.id) ? `Hide rooms of ${node.label}` : `Show rooms of ${node.label}`"
                @click="toggleNode(node.id)"
              >
                <Icon :name="isNodeExpanded(node.id) ? 'lucide:chevron-down' : 'lucide:chevron-right'" class="size-3.5" />
              </button>
              <button
                type="button"
                class="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left"
                :data-testid="node.type === 'room' ? 'picker-room' : 'picker-listing'"
                @click="pick(node)"
              >
                <div
                  class="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border"
                  :class="isPicked(node) ? 'border-foreground bg-foreground text-background' : 'border-input'"
                >
                  <Icon v-if="isPicked(node)" name="lucide:check" class="h-3 w-3" />
                </div>
                <Icon v-if="node.type === 'room'" name="lucide:door-closed" class="size-3.5 shrink-0 text-muted-foreground" />
                <span class="flex min-w-0 flex-col">
                  <span class="truncate text-sm leading-tight">{{ node.label }}</span>
                  <span v-if="node.sublabel" class="truncate text-[11px] text-muted-foreground">{{ node.sublabel }}</span>
                </span>
              </button>
            </div>
          </template>
          <p v-else class="py-6 text-center text-sm text-muted-foreground">
            No listings found
          </p>
        </div>
      </ScrollArea>

      <!-- Footer -->
      <div class="flex items-center justify-between border-t px-3 py-2">
        <span class="text-xs text-muted-foreground">
          {{ filteredListings.length }} {{ filteredListings.length === 1 ? 'listing' : 'listings' }}
        </span>
        <button
          v-if="modelValue"
          class="text-xs text-muted-foreground hover:text-foreground"
          @click="clearSelection"
        >
          Clear
        </button>
      </div>
    </PopoverContent>
  </Popover>
</template>
