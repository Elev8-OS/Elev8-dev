<script setup lang="ts">
import { allListings } from '~/composables/useListingMappings'

export interface PropertyPickerOption {
  /** Optional stable id. When present it is used as the emitted value instead of `name`. */
  id?: string
  name: string
  city: string
  region: string
}

const props = withDefaults(defineProps<{
  modelValue: string[]
  /** Override the source list (defaults to the finance-derived allListings). */
  options?: PropertyPickerOption[]
  /** When false, toggling a property selects only that one (single-select). */
  multiSelect?: boolean
}>(), {
  options: () => allListings,
  multiSelect: true,
})

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
}>()

const open = ref(false)
const tagPickerOpen = ref(false)
const search = ref('')
const tagSearch = ref('')
const selectedTags = ref<string[]>([])

// Derive tags: unique cities only (regions removed per request), sorted
const allTags = computed(() => {
  const cities = new Set<string>()
  props.options.forEach((l) => { cities.add(l.city) })
  return [...Array.from(cities).sort()]
})

const filteredTags = computed(() => {
  if (!tagSearch.value.trim())
    return allTags.value
  const q = tagSearch.value.toLowerCase()
  return allTags.value.filter(t => t.toLowerCase().includes(q))
})

const filteredListings = computed(() => {
  let list = props.options
  if (selectedTags.value.length > 0) {
    list = list.filter(l => selectedTags.value.some(t => l.region === t || l.city === t))
  }
  if (search.value.trim()) {
    const q = search.value.toLowerCase()
    list = list.filter(l => l.name.toLowerCase().includes(q) || l.city.toLowerCase().includes(q))
  }
  return list
})

const isAllProperties = computed(() =>
  props.modelValue.length === 0 || props.modelValue.includes('All Properties'),
)

function toggleTag(tag: string) {
  const idx = selectedTags.value.indexOf(tag)
  if (idx === -1)
    selectedTags.value.push(tag)
  else selectedTags.value.splice(idx, 1)
}

function valueFor(listing: PropertyPickerOption): string {
  return listing.id ?? listing.name
}

function toggleAllProperties() {
  emit('update:modelValue', ['All Properties'])
}

function isSelected(listing: PropertyPickerOption) {
  return !isAllProperties.value && props.modelValue.includes(valueFor(listing))
}

function toggleProperty(listing: PropertyPickerOption) {
  const value = valueFor(listing)
  // Single-select: choosing a property replaces the current selection and
  // closes the popover — there is nothing left to pick.
  if (!props.multiSelect) {
    emit('update:modelValue', [value])
    open.value = false
    return
  }
  if (isAllProperties.value) {
    emit('update:modelValue', [value])
    return
  }
  const current = [...props.modelValue]
  const idx = current.indexOf(value)
  if (idx === -1) {
    current.push(value)
  }
  else {
    current.splice(idx, 1)
    if (current.length === 0) {
      emit('update:modelValue', ['All Properties'])
      return
    }
  }
  emit('update:modelValue', current)
}

function selectAll() {
  if (!props.multiSelect)
    return
  emit('update:modelValue', props.options.map(l => valueFor(l)))
}

function unselectAll() {
  emit('update:modelValue', props.multiSelect ? ['All Properties'] : [])
}

/**
 * Index options by their emitted value (id when present, otherwise name) so
 * the trigger can render a human-readable name even when the model holds ids.
 */
const optionByValue = computed(() => {
  const map = new Map<string, PropertyPickerOption>()
  for (const option of props.options)
    map.set(valueFor(option), option)
  return map
})

const displayLabel = computed(() => {
  if (isAllProperties.value) {
    return props.multiSelect ? 'All Properties' : 'Select property'
  }
  const value = props.modelValue[0]
  if (props.modelValue.length === 1 && value) {
    const label = optionByValue.value.get(value)?.name ?? value
    return label.length > 22 ? `${label.slice(0, 22)}…` : label
  }
  return `${props.modelValue.length} properties`
})

const selectedCount = computed(() => isAllProperties.value ? 0 : props.modelValue.length)
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <Button variant="outline" class="h-8 w-44 justify-start gap-1.5 text-sm font-normal">
        <Icon name="i-lucide-building-2" class="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span class="flex-1 truncate text-left">{{ displayLabel }}</span>
        <Icon name="i-lucide-chevrons-up-down" class="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </Button>
    </PopoverTrigger>

    <PopoverContent class="w-80 p-0" align="end" :side-offset="6">
      <!-- Search + Tag button -->
      <div class="flex items-center gap-2 border-b px-3 py-2">
        <Icon name="i-lucide-search" class="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <input
          v-model="search"
          class="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          placeholder="Search properties…"
        >
        <button v-if="search" class="shrink-0 text-muted-foreground hover:text-foreground" @click="search = ''">
          <Icon name="i-lucide-x" class="h-3.5 w-3.5" />
        </button>

        <!-- Tag picker -->
        <Popover v-model:open="tagPickerOpen">
          <PopoverTrigger as-child>
            <Button
              variant="outline"
              class="h-7 shrink-0 gap-1 px-2 text-xs"
              :class="selectedTags.length > 0 ? 'border-primary text-primary' : 'text-muted-foreground'"
            >
              <Icon name="i-lucide-tag" class="h-3 w-3" />
              Tags
              <span v-if="selectedTags.length > 0" class="font-semibold">{{ selectedTags.length }}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent class="w-52 p-0" align="end" :side-offset="4">
            <!-- Tag search -->
            <div class="flex items-center gap-2 border-b px-3 py-2">
              <Icon name="i-lucide-search" class="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <input
                v-model="tagSearch"
                class="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
                placeholder="Search tags…"
              >
            </div>
            <!-- Tag list -->
            <ScrollArea class="h-52">
              <div class="p-1">
                <button
                  v-for="tag in filteredTags"
                  :key="tag"
                  class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted"
                  @click="toggleTag(tag)"
                >
                  <div
                    class="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border" :class="[
                      selectedTags.includes(tag) ? 'border-primary bg-primary text-primary-foreground' : 'border-input',
                    ]"
                  >
                    <Icon v-if="selectedTags.includes(tag)" name="i-lucide-check" class="h-3 w-3" />
                  </div>
                  <span class="truncate text-sm">{{ tag }}</span>
                </button>
                <p v-if="filteredTags.length === 0" class="py-4 text-center text-xs text-muted-foreground">
                  No tags found
                </p>
              </div>
            </ScrollArea>
            <!-- Tag footer -->
            <div class="flex items-center justify-between border-t px-3 py-2">
              <span class="text-xs text-muted-foreground">{{ selectedTags.length }} selected</span>
              <button
                v-if="selectedTags.length > 0"
                class="text-xs text-muted-foreground hover:text-foreground"
                @click="selectedTags = []"
              >
                Clear
              </button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <!-- Active tag chips (shown when tags are selected) -->
      <div v-if="selectedTags.length > 0" class="flex flex-wrap gap-1 border-b px-3 py-2">
        <span
          v-for="tag in selectedTags"
          :key="tag"
          class="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
        >
          {{ tag }}
          <button class="hover:text-destructive" @click="toggleTag(tag)">
            <Icon name="i-lucide-x" class="h-2.5 w-2.5" />
          </button>
        </span>
      </div>

      <!-- Property list -->
      <ScrollArea class="h-56">
        <div class="p-1">
          <button
            v-if="multiSelect"
            class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted"
            @click="toggleAllProperties"
          >
            <div
              class="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border" :class="[
                isAllProperties ? 'border-primary bg-primary text-primary-foreground' : 'border-input',
              ]"
            >
              <Icon v-if="isAllProperties" name="i-lucide-check" class="h-3 w-3" />
            </div>
            <span class="font-medium">All Properties</span>
            <span class="ml-auto text-xs text-muted-foreground">{{ props.options.length }}</span>
          </button>

          <Separator v-if="multiSelect" class="my-1" />

          <template v-if="filteredListings.length > 0">
            <button
              v-for="listing in filteredListings"
              :key="valueFor(listing)"
              class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-muted"
              @click="toggleProperty(listing)"
            >
              <div
                class="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border" :class="[
                  isSelected(listing) ? 'border-primary bg-primary text-primary-foreground' : 'border-input',
                ]"
              >
                <Icon v-if="isSelected(listing)" name="i-lucide-check" class="h-3 w-3" />
              </div>
              <div class="flex min-w-0 flex-col text-left">
                <span class="truncate text-sm leading-tight">{{ listing.name }}</span>
                <span class="text-xs text-muted-foreground">{{ listing.city }}</span>
              </div>
            </button>
          </template>
          <p v-else class="py-6 text-center text-sm text-muted-foreground">
            No properties found
          </p>
        </div>
      </ScrollArea>

      <!-- Footer -->
      <div class="flex items-center justify-between gap-2 border-t px-3 py-2">
        <div v-if="multiSelect" class="flex items-center gap-1">
          <Button variant="ghost" size="sm" class="h-7 px-2 text-xs" @click="selectAll">
            Select all
          </Button>
          <Button variant="ghost" size="sm" class="h-7 px-2 text-xs" @click="unselectAll">
            Unselect all
          </Button>
        </div>
        <div v-else class="flex-1" />
        <span class="text-xs text-muted-foreground">
          {{ selectedCount > 0 ? `${selectedCount} selected` : `${filteredListings.length} properties` }}
        </span>
        <button v-if="selectedCount > 0" class="text-xs text-muted-foreground hover:text-foreground" @click="emit('update:modelValue', multiSelect ? ['All Properties'] : [])">
          Clear
        </button>
      </div>
    </PopoverContent>
  </Popover>
</template>
