<script setup lang="ts">
import type { Listing } from '~/components/listings/data/listings'
import { getUnitById, listings } from '~/components/listings/data/listings'
import ListingCalendarTab from '~/components/listings/ListingCalendarTab.vue'
import ListingHeroCompact from '~/components/listings/ListingHeroCompact.vue'
import ListingMaintenanceTab from '~/components/listings/ListingMaintenanceTab.vue'
import ListingOverviewTab from '~/components/listings/ListingOverviewTab.vue'
import ListingPricingTab from '~/components/listings/ListingPricingTab.vue'
import ListingProtectionTab from '~/components/listings/ListingProtectionTab.vue'
import ListingReviewsTab from '~/components/listings/ListingReviewsTab.vue'
import ListingSettingsTab from '~/components/listings/ListingSettingsTab.vue'
import ListingSetupOverlay from '~/components/listings/ListingSetupOverlay.vue'
import ListingTestAIDialog from '~/components/listings/ListingTestAIDialog.vue'

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

const activeTab = ref('overview')

const showSetup = ref(false)
const showTestAi = ref(false)
const openSchedule = ref(false)

function handleOpenSchedule() {
  openSchedule.value = true
  nextTick(() => { openSchedule.value = false })
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
    <ListingHeroCompact
      :listing="listing"
      :open-schedule="openSchedule"
      @update="updateListing"
      @open-setup="showSetup = true"
      @open-test-ai="showTestAi = true"
      @open-schedule="handleOpenSchedule"
    />

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
          <TabsTrigger value="protection">
            <Icon name="lucide:shield-check" class="mr-1.5 size-3.5" />
            Protection
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Icon name="lucide:settings" class="mr-1.5 size-3.5" />
            Settings
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="overview" class="mt-6">
        <ListingOverviewTab :listing="listing" :active-unit="activeUnit" @switch-tab="activeTab = $event" />
      </TabsContent>

      <TabsContent value="pricing" class="mt-6">
        <ListingPricingTab :listing="listing" :active-unit="activeUnit" @update="updateListing" />
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

      <TabsContent value="protection" class="mt-6">
        <ListingProtectionTab :listing="listing" />
      </TabsContent>

      <TabsContent value="settings" class="mt-6">
        <ListingSettingsTab :listing="listing" @update="updateListing" />
      </TabsContent>
    </Tabs>

    <ListingSetupOverlay
      v-if="showSetup"
      :listing="listing"
      :open="showSetup"
      @update:open="showSetup = $event"
      @update="updateListing"
    />

    <ListingTestAIDialog
      :listing="listing"
      :open="showTestAi"
      @update:open="showTestAi = $event"
    />
  </div>
</template>
