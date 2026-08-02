<script setup lang="ts">
import type { CalendarListing } from '~/components/operations-calendar/data/operations-calendar'
import { getCalendarListings } from '~/components/operations-calendar/data/operations-calendar'
import { allTags, listings } from '~/components/listings/data/listings'

const props = defineProps<{
  modelValue: string
  listingName?: string | null
  placeholder?: string
  inDialog?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'update:listingName': [value: string]
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
      `${l.property} ${l.unitTypeLabel} ${l.roomLabel}`.toLowerCase().includes(q),
    )
  }
  return list
})

const selectedListing = computed(() => listings.value.find(l => l.id === props.modelValue) ?? null)

const displayLabel = computed(() => {
  if (selectedListing.value)
    return selectedListing.value.name
  return props.listingName || props.placeholder || 'Choose a listing'
})

function groupBy<T>(items: T[], keyFn: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const item of items) {
    const key = keyFn(item)
    const list = map.get(key) ?? []
    list.push(item)
    map.set(key, list)
  }
  return map
}

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
  const ids = new Set<string>()
  for (const listing of filteredListings.value)
    ids.add(`prop-${listing.property}`)
  for (const listing of filteredListings.value) {
    if (!listing.isSingleUnit)
      ids.add(`unit-${listing.property}-${listing.unitTypeLabel}`)
  }
  collapsedNodes.value = ids
}

interface PickerTreeNode {
  id: string
  type: 'property' | 'unitType' | 'room'
  label: string
  listing?: CalendarListing
  depth: number
}

const listingTree = computed<PickerTreeNode[]>(() => {
  const tree: PickerTreeNode[] = []
  const byProperty = groupBy(filteredListings.value, l => l.property)

  for (const [property, propertyListings] of byProperty) {
    const propertyId = `prop-${property}`
    tree.push({ id: propertyId, type: 'property', label: property, depth: 0 })

    if (!isNodeExpanded(propertyId))
      continue

    const hasMultiUnit = propertyListings.some(l => !l.isSingleUnit)

    if (!hasMultiUnit) {
      for (const listing of propertyListings) {
        tree.push({ id: listing.id, type: 'room', label: listing.roomLabel, listing, depth: 1 })
      }
    }
    else {
      const byUnitType = groupBy(propertyListings, l => l.unitTypeLabel)
      for (const [unitType, unitListings] of byUnitType) {
        const unitId = `unit-${property}-${unitType}`
        tree.push({ id: unitId, type: 'unitType', label: unitType, depth: 1 })

        if (!isNodeExpanded(unitId))
          continue

        for (const listing of unitListings) {
          tree.push({ id: listing.id, type: 'room', label: listing.roomLabel, listing, depth: 2 })
        }
      }
    }
  }

  return tree
})

function toggleTag(tag: string) {
  const idx = selectedTags.value.indexOf(tag)
  if (idx === -1)
    selectedTags.value = [...selectedTags.value, tag]
  else selectedTags.value = selectedTags.value.filter(t => t !== tag)
}

function clearTags() {
  selectedTags.value = []
}

function pick(listingId: string, listingName: string) {
  emit('update:modelValue', listingId)
  emit('update:listingName', listingName)
  open.value = false
}

function clearSelection() {
  emit('update:modelValue', '')
  emit('update:listingName', '')
}
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <Button
        variant="outline"
        :class="[
          'h-9 w-full justify-start gap-1.5 px-3 text-sm font-normal',
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
          placeholder="Search rooms…"
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
          class="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
        >
          {{ tag }}
          <button class="hover:text-destructive" @click="toggleTag(tag)">
            <Icon name="lucide:x" class="h-2.5 w-2.5" />
          </button>
        </span>
      </div>

      <!-- Property → Unit type → Room tree -->
      <div class="flex items-center justify-between border-b px-3 py-1.5">
        <span class="text-xs font-medium text-muted-foreground">Rooms by property</span>
        <div class="flex items-center gap-1">
          <button class="text-muted-foreground hover:text-foreground transition-colors" title="Expand all" @click="expandAll">
            <Icon name="lucide:chevrons-down" class="size-3.5" />
          </button>
          <button class="text-muted-foreground hover:text-foreground transition-colors" title="Collapse all" @click="collapseAll">
            <Icon name="lucide:chevrons-up" class="size-3.5" />
          </button>
        </div>
      </div>

      <ScrollArea class="h-56">
        <div class="p-1">
          <template v-if="listingTree.length > 0">
            <template v-for="node in listingTree" :key="node.id">
              <!-- Property group header -->
              <div
                v-if="node.type === 'property'"
                class="flex w-full cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted"
                @click="toggleNode(node.id)"
              >
                <Icon
                  :name="isNodeExpanded(node.id) ? 'lucide:chevron-down' : 'lucide:chevron-right'"
                  class="size-3.5 shrink-0 text-muted-foreground"
                />
                <Icon name="lucide:building-2" class="size-3.5 shrink-0 text-muted-foreground" />
                <span class="truncate text-xs font-semibold text-muted-foreground">{{ node.label }}</span>
              </div>

              <!-- Unit type group header -->
              <div
                v-else-if="node.type === 'unitType'"
                class="flex w-full cursor-pointer items-center gap-1.5 rounded-md py-1.5 pl-6 pr-2 text-left transition-colors hover:bg-muted"
                @click="toggleNode(node.id)"
              >
                <Icon
                  :name="isNodeExpanded(node.id) ? 'lucide:chevron-down' : 'lucide:chevron-right'"
                  class="size-3.5 shrink-0 text-muted-foreground"
                />
                <span class="truncate text-xs font-medium">{{ node.label }}</span>
              </div>

              <!-- Room row (selectable) -->
              <button
                v-else
                type="button"
                class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted"
                :class="[node.depth === 2 ? 'pl-12' : 'pl-8', modelValue === node.listing?.id ? 'bg-accent' : '']"
                @click="node.listing && pick(node.listing.id, node.listing.name)"
              >
                <div
                  class="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border" :class="[
                    modelValue === node.listing?.id ? 'border-primary bg-primary text-primary-foreground' : 'border-input',
                  ]"
                >
                  <Icon v-if="modelValue === node.listing?.id" name="lucide:check" class="h-3 w-3" />
                </div>
                <span class="truncate text-sm leading-tight">{{ node.label }}</span>
              </button>
            </template>
          </template>
          <p v-else class="py-6 text-center text-sm text-muted-foreground">
            No rooms found
          </p>
        </div>
      </ScrollArea>

      <!-- Footer -->
      <div class="flex items-center justify-between border-t px-3 py-2">
        <span class="text-xs text-muted-foreground">
          {{ filteredListings.length }} rooms
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
