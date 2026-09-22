<script lang="ts" setup>
interface InternalNavProps {
  isCollapsed: boolean
}

defineProps<InternalNavProps>()

const {
  roomSearch,
  activeTagFilters,
  availableTags,
  listingCardGroups,
  activeListingId,
  selectListing,
  toggleTagFilter,
  clearTagFilters,
  unreadForListing,
  isLoading,
} = useInternalInbox()

const tagPopoverOpen = ref(false)
const tagSearch = ref('')

const visibleTags = computed(() => {
  const q = tagSearch.value.trim().toLowerCase()
  if (!q)
    return availableTags.value
  return availableTags.value.filter(t => t.toLowerCase().includes(q))
})
</script>

<template>
  <!-- Height is the panel minus its 56px header and the 1px rule under it, so
       the card list below can scroll instead of pushing the panel taller. -->
  <div class="flex h-[calc(100%-57px)] flex-col gap-2 py-2">
    <!-- Collapsed: the photos alone, which are still recognisable at 40px. -->
    <template v-if="isCollapsed">
      <ScrollArea class="min-h-0 flex-1">
        <div class="flex flex-col items-center gap-1.5 px-2">
          <Tooltip v-for="group of listingCardGroups" :key="group.listingId" :delay-duration="0">
            <TooltipTrigger as-child>
              <button
                type="button"
                class="relative size-10 shrink-0 overflow-hidden rounded-md border-2"
                :class="activeListingId === group.listingId ? 'border-primary' : 'border-transparent'"
                :aria-label="group.listingName"
                :aria-pressed="activeListingId === group.listingId"
                @click="selectListing(group.listingId)"
              >
                <img v-if="group.photo" :src="group.photo" :alt="group.listingName" class="size-full object-cover">
                <div v-else class="flex size-full items-center justify-center bg-muted">
                  <Icon name="lucide:building-2" class="size-4 text-muted-foreground" />
                </div>
                <Badge
                  v-if="unreadForListing(group.listingId) > 0"
                  class="absolute -right-1 -top-1 h-3.5 min-w-3.5 justify-center px-1 text-[9px]"
                >
                  {{ unreadForListing(group.listingId) }}
                </Badge>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {{ group.listingName }}
            </TooltipContent>
          </Tooltip>
        </div>
      </ScrollArea>
    </template>

    <!-- The skeleton mirrors the real layout row for row, so nothing jumps
         when the rooms arrive. -->
    <template v-else-if="isLoading">
      <div class="shrink-0 space-y-2 px-2">
        <div class="flex items-center gap-1.5">
          <Skeleton class="h-8 flex-1" />
          <Skeleton class="h-8 w-14" />
        </div>
      </div>
      <div class="space-y-1.5 px-2" data-testid="nav-skeleton">
        <div v-for="n of 4" :key="n" class="flex items-center gap-2.5 rounded-lg border p-2">
          <Skeleton class="size-10 shrink-0 rounded-md" />
          <div class="min-w-0 flex-1 space-y-1.5">
            <Skeleton class="h-3 w-full" />
            <Skeleton class="h-2.5 w-20" />
          </div>
        </div>
      </div>
    </template>

    <template v-else>
      <!-- Search and tags share a row: two controls over one list. -->
      <div class="shrink-0 space-y-2 px-2">
        <div class="flex items-center gap-1.5">
          <div class="relative flex-1">
            <Icon name="lucide:search" class="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input v-model="roomSearch" placeholder="Search listings or rooms" class="h-8 pl-7 text-xs" />
          </div>

          <Popover v-model:open="tagPopoverOpen">
            <PopoverTrigger as-child>
              <Button
                variant="outline"
                size="sm"
                class="h-8 shrink-0 px-2 text-xs font-normal"
                :class="activeTagFilters.length && 'border-primary text-foreground'"
              >
                <Icon name="lucide:tag" class="size-3.5" />
                <Badge v-if="activeTagFilters.length" variant="secondary" class="h-4 px-1 text-[10px]">
                  {{ activeTagFilters.length }}
                </Badge>
                <span v-else>Tags</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent class="w-56 p-0" align="end" :side-offset="4">
              <div class="border-b p-2">
                <Input v-model="tagSearch" placeholder="Search tags" class="h-7 text-xs" />
              </div>
              <ScrollArea class="h-52">
                <div class="p-1">
                  <p v-if="visibleTags.length === 0" class="px-2 py-6 text-center text-xs text-muted-foreground">
                    No tags match.
                  </p>
                  <!-- A reka-ui Checkbox inside a label double-toggles, so the
                       row is a div with its own tick. -->
                  <div
                    v-for="tag of visibleTags"
                    :key="tag"
                    class="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent"
                    @click="toggleTagFilter(tag)"
                  >
                    <div
                      class="flex size-4 shrink-0 items-center justify-center rounded-[4px] border"
                      :class="activeTagFilters.includes(tag) ? 'border-primary bg-primary text-primary-foreground' : 'border-input'"
                    >
                      <Icon v-if="activeTagFilters.includes(tag)" name="lucide:check" class="size-3" />
                    </div>
                    <span class="truncate text-xs">{{ tag }}</span>
                  </div>
                </div>
              </ScrollArea>
              <div v-if="activeTagFilters.length" class="border-t p-1">
                <Button variant="ghost" size="sm" class="h-7 w-full text-xs" @click="clearTagFilters">
                  Clear all
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <div v-if="activeTagFilters.length" class="flex flex-wrap gap-1">
          <button
            v-for="tag of activeTagFilters"
            :key="tag"
            type="button"
            class="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[10px] text-secondary-foreground hover:bg-secondary/70"
            :aria-label="`Remove tag ${tag}`"
            @click="toggleTagFilter(tag)"
          >
            {{ tag }}
            <Icon name="lucide:x" class="size-2.5" />
          </button>
        </div>
      </div>

      <ScrollArea class="min-h-0 flex-1">
        <div class="space-y-1.5 px-2 pb-2">
          <p v-if="listingCardGroups.length === 0" class="px-1 py-6 text-center text-xs text-muted-foreground">
            No listings match these filters.
          </p>
          <InboxInternalListingCard
            v-for="group of listingCardGroups"
            :key="group.listingId"
            :group="group"
            :selected="activeListingId === group.listingId"
            :unread="unreadForListing(group.listingId)"
            @select="selectListing(group.listingId)"
          />
        </div>
      </ScrollArea>
    </template>
  </div>
</template>
