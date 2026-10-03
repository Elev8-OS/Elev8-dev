<script setup lang="ts">
import type { ListingSetupSection } from '~/components/listings/data/listing-setup-progress'
import type { Listing } from '~/components/listings/data/listings'
import { toast } from 'vue-sonner'
import { listingSetupProgress } from '~/components/listings/data/listing-setup-progress'
import { listings } from '~/components/listings/data/listings'
import ListingSetupFieldPanel from '~/components/listings/ListingSetupFieldPanel.vue'
import ListingSetupResourcePanel from '~/components/listings/ListingSetupResourcePanel.vue'
import RoomsPanel from '~/components/listings/RoomsPanel.vue'

definePageMeta({ layout: 'default' })

const route = useRoute()

const listingIndex = computed(() => listings.value.findIndex(l => l.id === route.params.id))
const listing = computed(() => listingIndex.value !== -1 ? listings.value[listingIndex.value] : undefined)
const detailPath = computed(() => `/listings/${route.params.id}`)

function updateListing(updated: Listing) {
  if (listingIndex.value !== -1)
    listings.value[listingIndex.value] = updated
}

const viewMode = ref<'property' | 'rooms'>('property')
const section = ref<ListingSetupSection>('basics')
const showResources = ref(false)

const hasRooms = computed(() => (listing.value?.unitTypes?.length ?? 0) > 0)
const progress = computed(() => listing.value ? listingSetupProgress(listing.value) : undefined)

function selectSection(key: ListingSetupSection) {
  section.value = key
  viewMode.value = 'property'
  showResources.value = false
}

function saveChanges() {
  toast.success('Changes saved successfully')
  navigateTo(detailPath.value)
}
</script>

<template>
  <div v-if="!listing" class="flex flex-col items-center justify-center gap-4 py-24">
    <Icon name="lucide:alert-circle" class="size-12 text-muted-foreground" />
    <h2 class="text-lg font-semibold">
      Listing not found
    </h2>
    <Button variant="outline" size="sm" as-child>
      <NuxtLink to="/listings">
        <Icon name="lucide:arrow-left" class="size-4" />
        Back to Listings
      </NuxtLink>
    </Button>
  </div>

  <div v-else class="flex h-full min-h-0 flex-col gap-4">
    <!-- Header -->
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex min-w-0 items-center gap-3">
        <Button variant="outline" size="icon" class="size-9 shrink-0" as-child>
          <NuxtLink :to="detailPath" aria-label="Back to listing">
            <Icon name="lucide:arrow-left" class="size-4" />
          </NuxtLink>
        </Button>
        <div class="min-w-0">
          <h1 class="text-lg font-semibold leading-tight">
            Listing Setup
          </h1>
          <p class="truncate text-sm text-muted-foreground">
            {{ listing.name }}
          </p>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <div v-if="hasRooms" class="flex items-center gap-0.5 rounded-md border p-0.5">
          <Button
            :variant="viewMode === 'property' ? 'secondary' : 'ghost'"
            size="sm" class="h-7 gap-1.5 text-xs"
            @click="viewMode = 'property'"
          >
            <Icon name="lucide:building-2" class="size-3.5" /> Property
          </Button>
          <Button
            :variant="viewMode === 'rooms' ? 'secondary' : 'ghost'"
            size="sm" class="h-7 gap-1.5 text-xs"
            @click="viewMode = 'rooms'"
          >
            <Icon name="lucide:layers" class="size-3.5" /> Rooms
          </Button>
        </div>
        <Button variant="outline" size="sm" class="h-9 gap-1.5 lg:hidden" @click="showResources = !showResources">
          <Icon name="lucide:database" class="size-3.5" />
          Resources
        </Button>
        <Button size="sm" class="h-9" @click="saveChanges">
          <Icon name="lucide:check" class="size-3.5" />
          Save Changes
        </Button>
      </div>
    </div>

    <!-- Body -->
    <div class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border bg-card md:flex-row">
      <!-- Section sidebar with completion progress -->
      <aside v-if="progress" class="flex shrink-0 flex-col border-b md:w-64 md:border-b-0 md:border-r" data-testid="setup-sidebar">
        <div class="flex flex-col gap-2 border-b p-4">
          <div class="flex items-baseline justify-between gap-2">
            <span class="text-sm font-medium">Setup progress</span>
            <span class="text-sm font-semibold tabular-nums" data-testid="setup-percent">{{ progress.percent }}%</span>
          </div>
          <!-- Neutral bar: the tenant primary (yellow) on white is too faint to read. -->
          <Progress :model-value="progress.percent" class="h-1.5 bg-muted [&>[data-slot=progress-indicator]]:bg-foreground" />
          <span class="text-xs text-muted-foreground">
            {{ progress.completeSections }} of {{ progress.sections.length }} sections complete
          </span>
        </div>

        <nav class="flex gap-1 overflow-x-auto p-2 md:flex-col md:overflow-x-visible" aria-label="Setup sections">
          <button
            v-for="s in progress.sections"
            :key="s.key"
            type="button"
            class="flex shrink-0 items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
            :class="viewMode === 'property' && section === s.key ? 'bg-muted font-medium' : 'text-muted-foreground'"
            :aria-current="viewMode === 'property' && section === s.key ? 'page' : undefined"
            @click="selectSection(s.key)"
          >
            <Icon :name="s.icon" class="size-4 shrink-0" />
            <span class="flex-1 whitespace-nowrap">{{ s.label }}</span>
            <Icon v-if="s.complete" name="lucide:circle-check" class="size-4 shrink-0 text-green-600 dark:text-green-400" aria-label="Complete" />
            <span v-else-if="s.total > 1" class="text-xs tabular-nums text-muted-foreground">{{ s.done }}/{{ s.total }}</span>
            <Icon v-else name="lucide:circle-dashed" class="size-4 shrink-0 text-muted-foreground" aria-label="Not filled in" />
          </button>
        </nav>
      </aside>

      <!-- Fields -->
      <div class="min-h-0 min-w-0 flex-1 overflow-hidden" :class="showResources ? 'hidden lg:flex lg:flex-col' : 'flex flex-col'">
        <RoomsPanel v-if="viewMode === 'rooms' && hasRooms" :listing="listing" @update="updateListing" />
        <ListingSetupFieldPanel
          v-else
          v-model:section="section"
          :listing="listing"
          view-mode="property"
          hide-nav
          @update="updateListing"
        />
      </div>

      <!-- Resources: fixed column on lg, toggled on smaller screens -->
      <div
        class="min-h-0 overflow-hidden lg:border-l"
        :class="showResources ? 'flex flex-1 flex-col lg:w-[300px] lg:flex-none' : 'hidden lg:flex lg:w-[300px] lg:flex-col'"
      >
        <ListingSetupResourcePanel :listing="listing" @update="updateListing" />
      </div>
    </div>
  </div>
</template>
