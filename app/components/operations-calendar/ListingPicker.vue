<script setup lang="ts">
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

const filteredTags = computed(() => {
  if (!tagSearch.value.trim())
    return allTags.value
  const q = tagSearch.value.toLowerCase()
  return allTags.value.filter(t => t.toLowerCase().includes(q))
})

const filteredListings = computed(() => {
  let list = listings.value
  if (selectedTags.value.length > 0) {
    list = list.filter(l => selectedTags.value.every(t => l.tags.includes(t)))
  }
  if (search.value.trim()) {
    const q = search.value.toLowerCase()
    list = list.filter(l => l.name.toLowerCase().includes(q) || l.location.toLowerCase().includes(q))
  }
  return list
})

const selectedListing = computed(() => listings.value.find(l => l.id === props.modelValue) ?? null)

const displayLabel = computed(() => {
  if (selectedListing.value)
    return selectedListing.value.name
  return props.listingName || props.placeholder || 'Choose a listing'
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
          placeholder="Search properties…"
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

      <!-- Listings list -->
      <ScrollArea class="h-56">
        <div class="p-1">
          <template v-if="filteredListings.length > 0">
            <button
              v-for="listing in filteredListings"
              :key="listing.id"
              type="button"
              class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted"
              :class="modelValue === listing.id ? 'bg-accent' : ''"
              @click="pick(listing.id, listing.name)"
            >
              <div
                class="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border" :class="[
                  modelValue === listing.id ? 'border-primary bg-primary text-primary-foreground' : 'border-input',
                ]"
              >
                <Icon v-if="modelValue === listing.id" name="lucide:check" class="h-3 w-3" />
              </div>
              <div class="flex min-w-0 flex-col text-left">
                <span class="truncate text-sm leading-tight">{{ listing.name }}</span>
                <span class="text-xs text-muted-foreground">{{ listing.location }}</span>
              </div>
            </button>
          </template>
          <p v-else class="py-6 text-center text-sm text-muted-foreground">
            No properties found
          </p>
        </div>
      </ScrollArea>

      <!-- Footer -->
      <div class="flex items-center justify-between border-t px-3 py-2">
        <span class="text-xs text-muted-foreground">
          {{ filteredListings.length }} properties
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
