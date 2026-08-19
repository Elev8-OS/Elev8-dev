<script setup lang="ts">
import type { RegistrationProvider } from './data/guest-registration'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'

const props = defineProps<{
  provider: RegistrationProvider
  accountId: string
  accountLabel: string
}>()

const gr = useGuestRegistration()

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50] as const
const pageSize = ref<number>(10)
const currentPage = ref(1)

// --- Filters ---
const search = ref('')
const selectedTags = ref<string[]>([])
const tagPopoverOpen = ref(false)
const tagSearch = ref('')

const allTags = computed(() => {
  const set = new Set<string>()
  for (const l of gr.listingOptions.value)
    l.tags.forEach(t => set.add(t))
  return [...set].sort()
})

const filteredListings = computed(() => {
  let list = gr.listingOptions.value
  const q = search.value.trim().toLowerCase()
  if (q)
    list = list.filter(l => `${l.name} ${l.location}`.toLowerCase().includes(q))
  if (selectedTags.value.length > 0) {
    list = list.filter(l => selectedTags.value.every(t => l.tags.includes(t)))
  }
  return list
})

// --- Account ownership / conflict resolution ---
function owningAccount(listingId: string) {
  return gr.getAccountForListing(listingId, props.provider)
}

function isOwnedByThis(listingId: string) {
  return gr.getListingRegistration(listingId)?.[props.provider]?.accountId === props.accountId
}

function isTaken(listingId: string) {
  return gr.isListingTaken(listingId, props.provider, props.accountId)
}

// --- Selection (per current filtered page) ---
const selectedIds = ref<string[]>([])

const pageItems = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredListings.value.slice(start, start + pageSize.value)
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredListings.value.length / pageSize.value)))

// Reset page when filters change
watch([search, selectedTags, pageSize], () => {
  currentPage.value = 1
  // Drop selection of listings that are no longer in the filtered set
  const ids = new Set(filteredListings.value.map(l => l.id))
  selectedIds.value = selectedIds.value.filter(id => ids.has(id))
})

const pageSelectable = computed(() => pageItems.value.filter(l => !isTaken(l.id)))

const allPageSelected = computed(() => {
  const sel = pageSelectable.value
  return sel.length > 0 && sel.every(l => selectedIds.value.includes(l.id))
})

function togglePageSelectAll() {
  const sel = pageSelectable.value.map(l => l.id)
  if (allPageSelected.value)
    selectedIds.value = selectedIds.value.filter(id => !sel.includes(id))
  else
    selectedIds.value = [...new Set([...selectedIds.value, ...sel])]
}

function toggleListing(id: string) {
  if (isTaken(id))
    return
  if (selectedIds.value.includes(id))
    selectedIds.value = selectedIds.value.filter(s => s !== id)
  else
    selectedIds.value = [...selectedIds.value, id]
}

function clearSelection() {
  selectedIds.value = []
}

// --- Actions ---
function assignSelected() {
  if (selectedIds.value.length === 0)
    return
  gr.bulkAssignListings(selectedIds.value, props.provider, props.accountId)
  toast.success(`${selectedIds.value.length} listing${selectedIds.value.length !== 1 ? 's' : ''} assigned to ${props.accountLabel}.`)
  clearSelection()
}

function assignOne(listingId: string) {
  if (isTaken(listingId))
    return
  gr.assignListingToAccount(listingId, props.provider, props.accountId)
  toast.success(`Listing assigned to ${props.accountLabel}.`)
}

function unassign(listingId: string) {
  gr.unassignListing(listingId, props.provider)
  toast.info('Listing unassigned.')
}

// --- Tags popover ---
function toggleTag(tag: string) {
  if (selectedTags.value.includes(tag))
    selectedTags.value = selectedTags.value.filter(t => t !== tag)
  else
    selectedTags.value = [...selectedTags.value, tag]
}

const visibleTags = computed(() => allTags.value.filter(t => t.toLowerCase().includes(tagSearch.value.trim().toLowerCase())))

const hasActiveFilters = computed(() => search.value.trim() !== '' || selectedTags.value.length > 0)

function clearFilters() {
  search.value = ''
  selectedTags.value = []
  tagSearch.value = ''
}
</script>

<template>
  <div class="space-y-3">
    <!-- Filter bar -->
    <div class="flex flex-wrap items-center gap-2">
      <div class="relative min-w-[220px] flex-1">
        <Icon name="lucide:search" class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input v-model="search" placeholder="Search listing or location..." class="h-9 pl-9 text-xs" />
      </div>

      <!-- Tag filter -->
      <Popover v-model:open="tagPopoverOpen">
        <PopoverTrigger as-child>
          <Button variant="outline" class="h-9 gap-2 text-xs font-normal">
            <Icon name="lucide:tags" class="size-3.5" />
            Tags
            <Badge v-if="selectedTags.length" variant="secondary" class="ml-0.5 h-4 px-1 text-[10px]">
              {{ selectedTags.length }}
            </Badge>
          </Button>
        </PopoverTrigger>
        <PopoverContent class="w-72 p-0" align="start" :side-offset="4">
          <div class="border-b p-2">
            <Input v-model="tagSearch" placeholder="Search tags..." class="h-8 text-xs" />
          </div>
          <div class="max-h-56 overflow-auto p-1">
            <button
              v-for="tag in visibleTags"
              :key="tag"
              type="button"
              class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
              @click="toggleTag(tag)"
            >
              <Checkbox :model-value="selectedTags.includes(tag)" class="size-3.5" @update:model-value="() => toggleTag(tag)" />
              <span>{{ tag }}</span>
            </button>
            <p v-if="!visibleTags.length" class="px-2 py-3 text-center text-xs text-muted-foreground">
              No tags found.
            </p>
          </div>
          <div v-if="selectedTags.length" class="border-t p-2">
            <Button variant="ghost" size="sm" class="h-6 text-xs text-muted-foreground" @click="selectedTags = []">
              Clear all
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <Button v-if="hasActiveFilters" variant="ghost" class="h-9 text-xs" @click="clearFilters">
        Clear filters
      </Button>
    </div>

    <!-- Selection toolbar -->
    <div class="flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2">
      <div class="flex items-center gap-2">
        <Checkbox :model-value="allPageSelected" :disabled="pageSelectable.length === 0" @update:model-value="togglePageSelectAll" />
        <p class="text-xs text-muted-foreground">
          <span class="font-medium text-foreground">{{ selectedIds.length }}</span> selected · {{ pageItems.length }} shown
        </p>
      </div>
      <div class="flex items-center gap-2">
        <Button size="sm" class="h-8 gap-1.5" :disabled="selectedIds.length === 0" @click="assignSelected">
          <Icon name="lucide:check-check" class="size-3.5" />
          Assign selected
        </Button>
      </div>
    </div>

    <!-- Listing rows -->
    <div class="rounded-lg border bg-card overflow-hidden">
      <div class="border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
        Listings ({{ filteredListings.length }})
      </div>
      <div class="divide-y">
        <div
          v-for="listing in pageItems"
          :key="listing.id"
          class="flex items-center gap-3 px-3 py-2 text-sm"
        >
          <Checkbox
            :model-value="selectedIds.includes(listing.id)"
            :disabled="isTaken(listing.id)"
            @update:model-value="() => toggleListing(listing.id)"
          />
          <Icon name="lucide:building-2" class="size-4 shrink-0 text-muted-foreground" />
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium">
              {{ listing.name }}
            </p>
            <p class="text-[11px] text-muted-foreground">
              {{ listing.location }}
            </p>
            <div class="mt-1 flex flex-wrap gap-1">
              <Badge v-for="tag in listing.tags" :key="tag" variant="outline" class="text-[10px]">
                {{ tag }}
              </Badge>
            </div>
          </div>

          <!-- Ownership / conflict state -->
          <template v-if="isOwnedByThis(listing.id)">
            <Badge variant="default" class="shrink-0">
              <Icon name="lucide:check-check" class="mr-1 size-3" />
              Assigned
            </Badge>
            <Button variant="ghost" size="sm" class="h-8 shrink-0 text-muted-foreground hover:text-destructive" @click="unassign(listing.id)">
              <Icon name="lucide:x" class="size-3.5" />
            </Button>
          </template>
          <template v-else-if="isTaken(listing.id)">
            <Badge variant="secondary" class="shrink-0 gap-1.5">
              <Icon name="lucide:user" class="size-3" />
              Used by {{ owningAccount(listing.id)?.apoa?.accommodationName || owningAccount(listing.id)?.avs?.firmName || 'another account' }}
            </Badge>
          </template>
          <Button v-else variant="outline" size="sm" class="h-8 shrink-0" @click="assignOne(listing.id)">
            <Icon name="lucide:plus" class="size-3.5" />
            Assign
          </Button>
        </div>
        <p v-if="pageItems.length === 0" class="px-3 py-6 text-center text-xs text-muted-foreground">
          No listings match the current filters.
        </p>
      </div>
    </div>

    <!-- Pagination -->
    <div class="flex items-center justify-between px-2">
      <div class="flex items-center gap-2">
        <p class="text-sm font-medium">
          Rows per page
        </p>
        <Select :model-value="`${pageSize}`" @update:model-value="(v) => { pageSize = Number(v); currentPage = 1 }">
          <SelectTrigger class="h-8 w-[70px]">
            <SelectValue :placeholder="`${pageSize}`" />
          </SelectTrigger>
          <SelectContent side="top">
            <SelectItem v-for="s in PAGE_SIZE_OPTIONS" :key="s" :value="`${s}`">
              {{ s }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div class="flex items-center justify-center text-sm font-medium">
        Page {{ currentPage }} of {{ totalPages }}
      </div>
      <div class="flex items-center gap-2">
        <Button
          variant="outline"
          class="hidden h-8 w-8 p-0 lg:flex"
          :disabled="currentPage <= 1"
          @click="currentPage = 1"
        >
          <span class="sr-only">First page</span>
          <Icon name="lucide:chevrons-left" class="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          class="h-8 w-8 p-0"
          :disabled="currentPage <= 1"
          @click="currentPage = currentPage - 1"
        >
          <span class="sr-only">Previous page</span>
          <Icon name="lucide:chevron-left" class="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          class="h-8 w-8 p-0"
          :disabled="currentPage >= totalPages"
          @click="currentPage = currentPage + 1"
        >
          <span class="sr-only">Next page</span>
          <Icon name="lucide:chevron-right" class="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          class="hidden h-8 w-8 p-0 lg:flex"
          :disabled="currentPage >= totalPages"
          @click="currentPage = totalPages"
        >
          <span class="sr-only">Last page</span>
          <Icon name="lucide:chevrons-right" class="h-4 w-4" />
        </Button>
      </div>
    </div>
  </div>
</template>
