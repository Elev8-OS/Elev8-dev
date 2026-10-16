<script setup lang="ts">
import { computed, ref } from 'vue'
import { listings as allListings } from '@/components/listings/data/listings'
import { BALI_LISTINGS } from '@/components/upsells/data/upsell-services'
import { cn } from '@/lib/utils'
import BaseSearchInput from '~/components/base/SearchInput.vue'

/**
 * Assigned Listings picker shared by the upsell drawer's Listings step and the
 * catalog's listings sheet: search + tag filter (AND, like the Listings page).
 * Select all and clear act on the visible rows. Filters reset on mount.
 */
const props = defineProps<{
  class?: string
  /** Height limit of the scrolling listing rows, e.g. `max-h-72`. */
  listClass?: string
}>()

const model = defineModel<string[]>({ required: true })

const listingSearch = ref('')
const listingTagFilter = ref<string[]>([])
const listingTagSearch = ref('')
const listingTagPopoverOpen = ref(false)

function listingTags(name: string): string[] {
  return allListings.value.find(l => l.name === name)?.tags ?? []
}

const listingTagOptions = computed(() =>
  [...new Set(BALI_LISTINGS.flatMap(listingTags))].sort((a, b) => a.localeCompare(b)),
)

const filteredListingTagOptions = computed(() => {
  const q = listingTagSearch.value.trim().toLowerCase()
  return q ? listingTagOptions.value.filter(t => t.toLowerCase().includes(q)) : listingTagOptions.value
})

const visibleListings = computed(() => {
  const q = listingSearch.value.trim().toLowerCase()
  return BALI_LISTINGS.filter((name) => {
    if (q && !name.toLowerCase().includes(q))
      return false
    const tags = listingTags(name)
    return listingTagFilter.value.every(t => tags.includes(t))
  })
})

const visibleSelectedCount = computed(() => visibleListings.value.filter(l => model.value.includes(l)).length)
const allVisibleSelected = computed(() => visibleListings.value.length > 0 && visibleSelectedCount.value === visibleListings.value.length)

function toggleListing(listing: string) {
  model.value = model.value.includes(listing)
    ? model.value.filter(l => l !== listing)
    : [...model.value, listing]
}

function toggleListingTag(tag: string) {
  listingTagFilter.value = listingTagFilter.value.includes(tag)
    ? listingTagFilter.value.filter(t => t !== tag)
    : [...listingTagFilter.value, tag]
}

function toggleAllVisibleListings() {
  const visible = new Set(visibleListings.value)
  model.value = allVisibleSelected.value
    ? model.value.filter(l => !visible.has(l))
    : [...new Set([...model.value, ...visibleListings.value])]
}

function clearAll() {
  model.value = []
}
</script>

<template>
  <div :class="cn('flex flex-col gap-3', props.class)">
    <div class="flex items-center justify-between gap-2">
      <div class="flex items-center gap-2">
        <Label>Assigned Listings</Label>
        <Badge variant="secondary" class="font-normal">
          {{ model.length }} of {{ BALI_LISTINGS.length }}
        </Badge>
      </div>
      <Button
        v-if="model.length"
        variant="ghost"
        size="sm"
        class="h-7 text-xs text-muted-foreground"
        @click="clearAll"
      >
        Clear selection
      </Button>
    </div>

    <div class="flex items-center gap-2">
      <BaseSearchInput v-model="listingSearch" placeholder="Search listings..." class="flex-1 h-9 sm:max-w-none" />
      <Popover v-model:open="listingTagPopoverOpen">
        <PopoverTrigger as-child>
          <Button
            variant="outline"
            size="sm"
            class="h-9 gap-1.5 text-xs"
            :class="listingTagFilter.length > 0 ? 'border-primary text-primary' : ''"
          >
            <Icon name="lucide:tag" class="size-3.5" />
            Tags
            <Badge v-if="listingTagFilter.length > 0" variant="default" class="ml-0.5 h-4 min-w-4 rounded-full px-1 text-[9px]">
              {{ listingTagFilter.length }}
            </Badge>
          </Button>
        </PopoverTrigger>
        <PopoverContent class="w-56 p-0" align="end" :side-offset="4">
          <div class="p-2">
            <Input v-model="listingTagSearch" placeholder="Search tags..." class="h-7 text-xs" />
          </div>
          <div class="max-h-48 overflow-y-auto px-1 pb-1">
            <div
              v-for="tag in filteredListingTagOptions"
              :key="tag"
              class="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
              @click="toggleListingTag(tag)"
            >
              <div
                class="flex size-4 shrink-0 items-center justify-center rounded-[4px] border"
                :class="listingTagFilter.includes(tag) ? 'border-primary bg-primary text-primary-foreground' : 'border-input'"
              >
                <Icon v-if="listingTagFilter.includes(tag)" name="lucide:check" class="size-3" />
              </div>
              <span class="flex-1">{{ tag }}</span>
            </div>
            <p v-if="filteredListingTagOptions.length === 0" class="px-2 py-1.5 text-xs text-muted-foreground">
              No tags found.
            </p>
          </div>
          <div v-if="listingTagFilter.length > 0" class="border-t px-2 py-2">
            <Button variant="ghost" size="sm" class="h-7 w-full text-xs text-muted-foreground" @click="listingTagFilter = []">
              Clear all tags
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>

    <div v-if="listingTagFilter.length" class="flex flex-wrap items-center gap-1.5">
      <Badge
        v-for="tag in listingTagFilter"
        :key="tag"
        variant="outline"
        class="cursor-pointer gap-1 font-normal"
        @click="toggleListingTag(tag)"
      >
        {{ tag }}
        <Icon name="lucide:x" class="size-3" />
      </Badge>
    </div>

    <div class="flex min-h-0 flex-col overflow-hidden rounded-md border">
      <div
        v-if="visibleListings.length"
        class="flex shrink-0 cursor-pointer items-center gap-3 border-b bg-muted/40 px-3 py-2"
        @click="toggleAllVisibleListings"
      >
        <div
          class="flex size-4 shrink-0 items-center justify-center rounded-[4px] border"
          :class="visibleSelectedCount > 0 ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-background'"
        >
          <Icon v-if="allVisibleSelected" name="lucide:check" class="size-3" />
          <Icon v-else-if="visibleSelectedCount > 0" name="lucide:minus" class="size-3" />
        </div>
        <span class="text-xs font-medium text-muted-foreground">
          {{ listingSearch || listingTagFilter.length ? `Select all ${visibleListings.length} results` : 'Select all listings' }}
        </span>
      </div>
      <div class="overflow-y-auto" :class="listClass">
        <div
          v-for="listing in visibleListings"
          :key="listing"
          class="flex cursor-pointer items-start gap-3 border-b px-3 py-2.5 last:border-b-0 hover:bg-muted/50"
          @click="toggleListing(listing)"
        >
          <div
            class="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-[4px] border"
            :class="model.includes(listing) ? 'border-primary bg-primary text-primary-foreground' : 'border-input'"
          >
            <Icon v-if="model.includes(listing)" name="lucide:check" class="size-3" />
          </div>
          <div class="flex min-w-0 flex-1 flex-col gap-1">
            <span class="text-sm leading-tight">{{ listing }}</span>
            <div v-if="listingTags(listing).length" class="flex flex-wrap gap-1">
              <span
                v-for="tag in listingTags(listing)"
                :key="tag"
                class="rounded px-1.5 py-px text-[10px]"
                :class="listingTagFilter.includes(tag) ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'"
              >
                {{ tag }}
              </span>
            </div>
          </div>
        </div>
        <p v-if="visibleListings.length === 0" class="px-3 py-8 text-center text-sm text-muted-foreground">
          No listings match your search.
        </p>
      </div>
    </div>
  </div>
</template>
