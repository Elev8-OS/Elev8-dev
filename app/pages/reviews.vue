<script setup lang="ts">
import type { ReviewFeedItem } from '~/components/review-hub/data/types'
import type DetailDrawer from '~/components/review-hub/DetailDrawer.vue'

definePageMeta({ layout: 'default' })

const {
  filteredFeedItems,
  searchQuery,
  filterStatus,
  filterChannel,
  filterListing,
  uniqueListings,
  clearFilters,
} = useReviewHub()

const { config: reviewConfig } = useAirbnbReviews()

const drawerOpen = ref(false)
const selectedItem = ref<ReviewFeedItem | null>(null)
const drawerRef = ref<InstanceType<typeof DetailDrawer> | null>(null)
const settingsOpen = ref(false)
const page = ref(1)
const pageSize = 10

type BannerState = 'off' | 'autopost_off' | null

const bannerDismissed = ref(false)

const bannerState = computed<BannerState>(() => {
  if (bannerDismissed.value) {
    return null
  }
  if (!reviewConfig.value.enabled) {
    return 'off'
  }
  const hasAutoPost = reviewConfig.value.auto_post_host_review
    || reviewConfig.value.auto_post_replies.airbnb
    || reviewConfig.value.auto_post_replies.booking_com
  if (!hasAutoPost) {
    return 'autopost_off'
  }
  return null
})

function dismissBanner() {
  bannerDismissed.value = true
}

function openDrawer(item: ReviewFeedItem) {
  selectedItem.value = item
  drawerOpen.value = true
}

function openDrawerAndGenerate(item: ReviewFeedItem) {
  selectedItem.value = item
  drawerOpen.value = true
  drawerRef.value?.generateHostReview()
}
</script>

<template>
  <div class="w-full flex flex-col gap-4">
    <div class="flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 class="text-2xl font-bold tracking-tight">
          Review Hub
        </h2>
        <p class="text-muted-foreground">
          Aggregated guest reviews with AI-powered replies across all channels.
        </p>
      </div>
      <Button variant="outline" size="sm" class="gap-1.5" @click="settingsOpen = true">
        <Icon name="lucide:settings" class="size-4" />
        Settings
      </Button>
    </div>

    <!-- Tabs: Reviews | Analytics -->
    <Tabs default-value="reviews" class="w-full">
      <TabsList>
        <TabsTrigger value="reviews">
          Reviews
        </TabsTrigger>
        <TabsTrigger value="analytics">
          Analytics
        </TabsTrigger>
      </TabsList>

      <TabsContent value="reviews" class="mt-4 space-y-4">
        <!-- ElevAI Promo Banner -->
        <div
          v-if="bannerState"
          class="relative flex items-start gap-4 overflow-hidden rounded-lg border border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-4"
        >
          <div class="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary">
            <SharedAiIcon custom-class="size-5 text-primary-foreground" />
          </div>
          <div class="flex-1 space-y-1">
            <div class="flex items-center gap-2">
              <p class="text-sm font-semibold">
                <template v-if="bannerState === 'off'">
                  Turn on ElevAI review automation
                </template>
                <template v-else>
                  Let ElevAI auto-post your guest reviews
                </template>
              </p>
              <span class="rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary-foreground">
                New
              </span>
            </div>
            <p class="text-xs text-muted-foreground">
              <template v-if="bannerState === 'off'">
                Let ElevAI draft guest reviews in your chosen language and tone, based on stay signals (cleanliness, house rules, communication). Save hours every week.
              </template>
              <template v-else>
                Auto-post AI-drafted reviews to <strong>Airbnb</strong> (14-day window) and <strong>Booking.com</strong> (365-day window) with a configurable delay so you stay in control.
              </template>
            </p>
          </div>
          <div class="flex shrink-0 items-center gap-2">
            <Button
              size="sm"
              @click="settingsOpen = true"
            >
              <template v-if="bannerState === 'off'">
                Enable automation
              </template>
              <template v-else>
                Enable auto-post
              </template>
            </Button>
            <button
              type="button"
              class="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Dismiss"
              @click="dismissBanner"
            >
              <Icon name="lucide:x" class="size-4" />
            </button>
          </div>
        </div>

        <!-- Filters -->
        <ReviewHubFilters
          v-model:search-query="searchQuery"
          v-model:filter-status="filterStatus"
          v-model:filter-channel="filterChannel"
          v-model:filter-listing="filterListing"
          :unique-listings="uniqueListings"
          @clear="clearFilters"
        />

        <!-- Feed Table -->
        <ReviewHubFeedTable
          :items="filteredFeedItems"
          :page="page"
          :page-size="pageSize"
          @select="openDrawer"
          @generate="openDrawerAndGenerate"
          @update:page="page = $event"
        />

        <!-- Detail Drawer -->
        <ReviewHubDetailDrawer
          ref="drawerRef"
          v-model:open="drawerOpen"
          :item="selectedItem"
        />
      </TabsContent>

      <TabsContent value="analytics" class="mt-4 space-y-4">
        <!-- Analytics Filters + Saved Views -->
        <ReviewAnalyticsFilters />

        <!-- KPI Overview -->
        <ReviewAnalyticsOverview />

        <!-- YoY Trend Charts -->
        <ReviewAnalyticsCharts />

        <!-- Category Performance + Tags + Bar Chart -->
        <ReviewAnalyticsCategoryPanel />
      </TabsContent>
    </Tabs>

    <!-- Settings Sheet -->
    <Sheet v-model:open="settingsOpen">
      <SheetContent class="w-[480px] sm:max-w-[480px] flex flex-col p-0 gap-0">
        <SheetHeader class="px-6 pt-5 pb-4 border-b shrink-0">
          <SheetTitle>Review Hub Settings</SheetTitle>
          <SheetDescription>Configure AI-powered guest review automation and reply settings.</SheetDescription>
        </SheetHeader>
        <div class="flex-1 overflow-y-auto p-6">
          <SettingsAirbnbReviewConfig />
        </div>
      </SheetContent>
    </Sheet>
  </div>
</template>
