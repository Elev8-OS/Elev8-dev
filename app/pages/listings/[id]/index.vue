<script setup lang="ts">
import type { ListingCustomTab } from '~/components/listings/data/listing-custom-tabs'
import type { Listing } from '~/components/listings/data/listings'
import { toast } from 'vue-sonner'
import { customTabValue, listingCustomTabs, moveCustomTab, removeCustomTab, saveCustomTab } from '~/components/listings/data/listing-custom-tabs'
import { getUnitById, listings } from '~/components/listings/data/listings'
import ListingCalendarTab from '~/components/listings/ListingCalendarTab.vue'
import ListingCustomTabDialog from '~/components/listings/ListingCustomTabDialog.vue'
import ListingCustomTabFrame from '~/components/listings/ListingCustomTabFrame.vue'
import ListingGuestGuideTab from '~/components/listings/ListingGuestGuideTab.vue'
import ListingHeroCompact from '~/components/listings/ListingHeroCompact.vue'
import ListingMaintenanceTab from '~/components/listings/ListingMaintenanceTab.vue'
import ListingOverviewTab from '~/components/listings/ListingOverviewTab.vue'
import ListingPricingTab from '~/components/listings/ListingPricingTab.vue'
import ListingRevenueTab from '~/components/listings/ListingRevenueTab.vue'
import ListingReviewsTab from '~/components/listings/ListingReviewsTab.vue'
import ListingSettingsTab from '~/components/listings/ListingSettingsTab.vue'

definePageMeta({ layout: 'default' })

const route = useRoute()
const router = useRouter()

const listingIndex = computed(() => listings.value.findIndex(l => l.id === route.params.id))
const listing = computed(() => listingIndex.value !== -1 ? listings.value[listingIndex.value] : undefined)

function updateListing(updated: Listing) {
  if (listingIndex.value !== -1) {
    listings.value[listingIndex.value] = updated
  }
}

const activeUnitId = computed(() => listing.value?.activeUnitId ?? null)
const activeUnit = computed(() => listing.value ? getUnitById(listing.value, activeUnitId.value ?? '') : null)

const TABS = ['overview', 'pricing', 'revenue', 'calendar', 'reviews', 'maintenance', 'guest-guide', 'settings']
const customTabs = computed(() => listingCustomTabs(listing.value))
const isTab = (tab: string) => TABS.includes(tab) || customTabs.value.some(t => customTabValue(t) === tab)
// `?tab=maintenance` opens a tab directly, e.g. from the reservation's "Set up checklists" link; `?tab=custom:<id>` opens a custom tab.
const activeTab = ref(isTab(String(route.query.tab)) ? String(route.query.tab) : 'overview')

// A link to `?tab=…` from inside the page switches the tab.
watch(() => route.query.tab, (tab) => {
  if (isTab(String(tab)))
    activeTab.value = String(tab)
})

// Custom tabs: a name and a link, opened in a frame (`ListingCustomTabFrame`).
const tabDialogOpen = ref(false)
const editingTab = ref<ListingCustomTab | null>(null)
const removingTab = ref<ListingCustomTab | null>(null)

function setCustomTabs(tabs: ListingCustomTab[]) {
  if (listing.value)
    updateListing({ ...listing.value, customTabs: tabs })
}

function openAddTab() {
  editingTab.value = null
  tabDialogOpen.value = true
}

function openEditTab(tab: ListingCustomTab) {
  editingTab.value = tab
  tabDialogOpen.value = true
}

function onSaveTab(tab: ListingCustomTab) {
  const isNew = !customTabs.value.some(t => t.id === tab.id)
  setCustomTabs(saveCustomTab(customTabs.value, tab))
  activeTab.value = customTabValue(tab)
  toast.success(isNew ? `Tab "${tab.name}" added` : 'Tab updated')
}

function confirmRemoveTab() {
  const tab = removingTab.value
  if (!tab)
    return
  setCustomTabs(removeCustomTab(customTabs.value, tab.id))
  if (activeTab.value === customTabValue(tab))
    activeTab.value = 'overview'
  removingTab.value = null
  toast.success(`Tab "${tab.name}" removed`)
}
</script>

<template>
  <div v-if="!listing" class="flex flex-col items-center justify-center gap-4 py-24">
    <Icon name="lucide:alert-circle" class="size-12 text-muted-foreground" />
    <h2 class="text-lg font-semibold">
      Listing not found
    </h2>
    <Button variant="outline" size="sm" @click="router.push('/listings')">
      <Icon name="lucide:arrow-left" class="size-4" />
      Back to Listings
    </Button>
  </div>

  <div v-else class="flex flex-col gap-6">
    <ListingHeroCompact :listing="listing" @update="updateListing" />

    <Tabs :key="activeUnitId ?? 'no-unit'" v-model="activeTab">
      <div class="overflow-x-auto">
        <TabsList>
          <TabsTrigger value="overview">
            <Icon name="lucide:layout-grid" class="mr-1.5 size-3.5" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="pricing">
            <Icon name="lucide:dollar-sign" class="mr-1.5 size-3.5" />
            Pricing
          </TabsTrigger>
          <TabsTrigger value="revenue">
            <Icon name="lucide:trending-up" class="mr-1.5 size-3.5" />
            Revenue
          </TabsTrigger>
          <TabsTrigger value="calendar">
            <Icon name="lucide:calendar" class="mr-1.5 size-3.5" />
            Calendar
          </TabsTrigger>
          <TabsTrigger value="reviews">
            <Icon name="lucide:star" class="mr-1.5 size-3.5" />
            Reviews
          </TabsTrigger>
          <TabsTrigger value="maintenance">
            <Icon name="lucide:wrench" class="mr-1.5 size-3.5" />
            Maintenance
          </TabsTrigger>
          <TabsTrigger value="guest-guide">
            <Icon name="lucide:book-open" class="mr-1.5 size-3.5" />
            Guest Guide
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Icon name="lucide:settings" class="mr-1.5 size-3.5" />
            Settings
          </TabsTrigger>
          <TabsTrigger
            v-for="tab in customTabs"
            :key="tab.id"
            :value="customTabValue(tab)"
            :data-testid="`custom-tab-${tab.id}`"
          >
            <Icon name="lucide:globe" class="mr-1.5 size-3.5" />
            {{ tab.name }}
          </TabsTrigger>
          <Button
            variant="ghost"
            size="sm"
            class="ml-1 h-7 px-2 text-muted-foreground"
            aria-label="Add custom tab"
            data-testid="add-custom-tab"
            @click="openAddTab"
          >
            <Icon name="lucide:plus" class="size-3.5" />
            <span class="hidden sm:inline">Add tab</span>
          </Button>
        </TabsList>
      </div>

      <TabsContent value="overview" class="mt-6">
        <ListingOverviewTab :listing="listing" :active-unit="activeUnit" @switch-tab="activeTab = $event" />
      </TabsContent>

      <TabsContent value="pricing" class="mt-6">
        <ListingPricingTab :listing="listing" :active-unit="activeUnit" @update="updateListing" />
      </TabsContent>

      <TabsContent value="revenue" class="mt-6">
        <ListingRevenueTab :listing="listing" :active-unit="activeUnit" />
      </TabsContent>

      <TabsContent value="calendar" class="mt-6">
        <ListingCalendarTab :listing="listing" :active-unit="activeUnit" />
      </TabsContent>

      <TabsContent value="reviews" class="mt-6">
        <ListingReviewsTab :listing="listing" :active-unit="activeUnit" @update="updateListing" />
      </TabsContent>

      <TabsContent value="maintenance" class="mt-6">
        <ListingMaintenanceTab :listing="listing" :active-unit="activeUnit" @update="updateListing" />
      </TabsContent>

      <TabsContent value="guest-guide" class="mt-6">
        <ListingGuestGuideTab :listing="listing" @update="updateListing" />
      </TabsContent>

      <TabsContent value="settings" class="mt-6">
        <ListingSettingsTab :listing="listing" @update="updateListing" />
      </TabsContent>

      <TabsContent v-for="(tab, i) in customTabs" :key="tab.id" :value="customTabValue(tab)" class="mt-6">
        <ListingCustomTabFrame
          :tab="tab"
          :can-move-left="i > 0"
          :can-move-right="i < customTabs.length - 1"
          @edit="openEditTab(tab)"
          @remove="removingTab = tab"
          @move="setCustomTabs(moveCustomTab(customTabs, tab.id, $event))"
        />
      </TabsContent>
    </Tabs>

    <ListingCustomTabDialog v-model:open="tabDialogOpen" :tab="editingTab" @save="onSaveTab" />

    <AlertDialog :open="!!removingTab" @update:open="!$event && (removingTab = null)">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove "{{ removingTab?.name }}"?</AlertDialogTitle>
          <AlertDialogDescription>
            The tab is removed from this listing. The page it links to is not affected.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction class="bg-destructive text-white hover:bg-destructive/90" @click="confirmRemoveTab">
            Remove tab
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
