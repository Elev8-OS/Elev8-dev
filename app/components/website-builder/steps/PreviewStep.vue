<script setup lang="ts">
import type { ReviewSource } from '~/components/review-hub/data/types'
import type { PropertySelection } from '~/components/website-builder/data/property-listings'
import type { Website } from '~/components/website-builder/data/websites'
import type { ReviewSelection } from '~/components/website-builder/steps/ReviewStep.vue'
import type { WebsiteSettings } from '~/components/website-builder/steps/SettingsStep.vue'
import type { Template } from '~/components/website-builder/steps/TemplateStep.vue'
import { toast } from 'vue-sonner'
import { ruleSetSummary } from '~/components/channels/data/website-channel'
import { getUnitTypes, listings } from '~/components/listings/data/listings'
import {
  channelIcons,
  channelLabels,
  getDisplayMax,
  getDisplayScore,
} from '~/components/review-hub/data/types'
import { getListingsForProperties } from '~/components/website-builder/data/property-listings'
import { compareByReceivedDesc, meetsMinCount, resolveAutoReviews } from '~/components/website-builder/data/review-config'
import { websites } from '~/components/website-builder/data/websites'
import { useReviewHub } from '~/composables/useReviewHub'
import { useWebsiteSave } from '~/composables/useWebsiteSave'

// Re-export for convenience
export type { PropertySelection, Template, WebsiteSettings }

const props = defineProps<{
  template: Template | null
  settings: WebsiteSettings
  property: PropertySelection
  reviews: ReviewSelection
}>()

const emit = defineEmits<{
  back: []
  goToStep: [step: number]
}>()

// ── Picked listings and rooms, from the real Listings data ─────────────
const selectedProperties = computed(() =>
  listings.value.filter(l => props.property.propertyIds.includes(l.id)),
)

const selectedRooms = computed(() =>
  selectedProperties.value.flatMap(l =>
    getUnitTypes(l).flatMap(t => t.units
      .filter(u => props.property.roomIds.includes(u.id))
      .map(u => ({ id: u.id, name: u.name, typeName: t.name }))),
  ),
)

const totalPhotos = computed(() =>
  selectedProperties.value.reduce((sum, l) => sum + l.photos.length, 0),
)

// ── Review resolution (mirrors what the published site will render) ─────
const { reviewRecords } = useReviewHub()

const reviewConfig = computed(() => props.reviews.config)
const isAutoMode = computed(() => reviewConfig.value.mode === 'auto')

const CHANNELS: ReviewSource[] = ['airbnb', 'booking_com', 'direct']

const activeRules = computed(() =>
  CHANNELS
    .filter(source => reviewConfig.value.channels[source].enabled)
    .map(source => `${channelLabels[source]} ${reviewConfig.value.channels[source].minRating}+`),
)

const resolvedReviews = computed(() =>
  isAutoMode.value
    ? resolveAutoReviews(
        reviewRecords.value,
        getListingsForProperties(props.property.propertyIds),
        reviewConfig.value,
      )
    : reviewRecords.value
        .filter(r => props.reviews.selectedReviewIds.includes(r.id))
        .sort(compareByReceivedDesc),
)

// Manual is an explicit, host-made decision — the minimum-count safety net only guards
// against Auto's rules surfacing a near-empty section, and Manual's control for it
// (ReviewAutoSettings) is not even reachable in that mode.
const sectionHidden = computed(() =>
  isAutoMode.value
  && !meetsMinCount(
    resolvedReviews.value.length,
    props.reviews.manualReviews.length,
    reviewConfig.value,
  ),
)

// Load more, exactly as a visitor will meet it.
const visibleCount = ref(reviewConfig.value.batchSize)
watch([resolvedReviews, () => reviewConfig.value.batchSize], () => {
  visibleCount.value = reviewConfig.value.batchSize
})
const visibleReviews = computed(() => resolvedReviews.value.slice(0, visibleCount.value))
const hasMoreReviews = computed(() => visibleCount.value < resolvedReviews.value.length)
function loadMoreReviews() {
  visibleCount.value += reviewConfig.value.batchSize
}

// ── Actions ──────────────────────────────────────────────────────
const isPublishing = ref(false)
const route = useRoute()
const editId = computed(() => route.query.edit as string | undefined)
const { saveWebsite } = useWebsiteSave()

function persistWebsite(status: Website['status'], message: string) {
  isPublishing.value = true
  setTimeout(() => {
    isPublishing.value = false
    saveWebsite({ template: props.template, settings: props.settings, property: props.property, reviews: props.reviews }, status, editId.value)
    toast.success(message)
    navigateTo('/website-builder')
  }, 800)
}

// Saving a live site as a draft *is* unpublishing it, so on a published site the button
// says so — and asks first, since it takes the site off the internet.
const editingWebsite = computed(() =>
  editId.value ? websites.value.find(w => w.id === editId.value) ?? null : null,
)
const isEditingPublished = computed(() => editingWebsite.value?.status === 'published')
const unpublishOpen = ref(false)

function saveDraft() {
  persistWebsite('draft', 'Website saved as draft')
}

function unpublishWebsite() {
  unpublishOpen.value = false
  persistWebsite('draft', 'Website unpublished — it is a draft again')
}

function publishWebsite() {
  persistWebsite('published', 'Website published successfully!')
}

function handleBack() {
  emit('back')
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- Header -->
    <div>
      <h3 class="text-lg font-semibold">
        Preview & Publish
      </h3>
      <p class="text-sm text-muted-foreground">
        Review your website configuration before publishing.
      </p>
    </div>

    <!-- Website Preview Card -->
    <Card>
      <CardHeader class="pb-3">
        <div class="flex items-center justify-between">
          <CardTitle class="text-base">
            Website Preview
          </CardTitle>
          <Button variant="ghost" size="sm" class="text-xs h-7" @click="emit('goToStep', 0)">
            <Icon name="i-lucide-pencil" class="size-3 mr-1" />
            Edit
          </Button>
        </div>
      </CardHeader>
      <CardContent class="space-y-4">
        <!-- Template -->
        <div class="flex items-center gap-3">
          <div class="flex size-12 items-center justify-center rounded-lg bg-muted">
            <Icon :name="template?.icon ?? 'i-lucide-layout-template'" class="size-6 text-muted-foreground" />
          </div>
          <div>
            <p class="text-sm font-medium">
              {{ template?.name ?? 'No template selected' }}
            </p>
            <p class="text-xs text-muted-foreground">
              Template
            </p>
          </div>
        </div>

        <Separator />

        <!-- Site Info -->
        <div class="grid grid-cols-1 gap-3 @xl/main:grid-cols-2">
          <div class="space-y-1">
            <p class="text-xs text-muted-foreground">
              Website Name
            </p>
            <p class="text-sm font-medium">
              {{ settings.name || '—' }}
            </p>
          </div>
          <div class="space-y-1">
            <p class="text-xs text-muted-foreground">
              Domain
            </p>
            <p class="text-sm font-medium">
              {{ settings.domain || '—' }}
            </p>
          </div>
          <div class="space-y-1 @xl/main:col-span-2">
            <p class="text-xs text-muted-foreground">
              Description
            </p>
            <p class="text-sm text-muted-foreground line-clamp-2">
              {{ settings.description || '—' }}
            </p>
          </div>
          <div v-if="settings.rules" class="space-y-1 @xl/main:col-span-2" data-testid="preview-rule-set">
            <p class="text-xs text-muted-foreground">
              Booking rules
            </p>
            <p class="text-sm font-medium">
              {{ ruleSetSummary(settings.rules) }}, minimum {{ settings.rules.minNights }} {{ settings.rules.minNights === 1 ? 'night' : 'nights' }}
            </p>
          </div>
        </div>

        <Separator />

        <!-- Branding -->
        <div class="grid grid-cols-1 gap-3 @xl/main:grid-cols-2">
          <div class="flex items-center gap-3">
            <div
              class="size-8 shrink-0 rounded-md border"
              :style="{ backgroundColor: settings.brandColor }"
            />
            <div>
              <p class="text-sm font-medium font-mono">
                {{ settings.brandColor }}
              </p>
              <p class="text-xs text-muted-foreground">
                Brand Color
              </p>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <div class="flex size-8 items-center justify-center rounded-md border bg-muted">
              <Icon name="i-lucide-type" class="size-4 text-muted-foreground" />
            </div>
            <div>
              <p class="text-sm font-medium">
                {{ settings.fontFamily }}
              </p>
              <p class="text-xs text-muted-foreground">
                Font Family
              </p>
            </div>
          </div>
        </div>

        <Separator />

        <!-- Logo / Favicon Status -->
        <div class="grid grid-cols-1 gap-3 @xl/main:grid-cols-2">
          <div class="flex items-center gap-3">
            <div class="flex size-8 items-center justify-center rounded-md border bg-muted">
              <Icon name="i-lucide-image" class="size-4 text-muted-foreground" />
            </div>
            <div>
              <p class="text-sm font-medium truncate">
                {{ settings.logoFile ?? 'Not uploaded' }}
              </p>
              <p class="text-xs text-muted-foreground">
                Logo
              </p>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <div class="flex size-8 items-center justify-center rounded-md border bg-muted">
              <Icon name="i-lucide-globe" class="size-4 text-muted-foreground" />
            </div>
            <div>
              <p class="text-sm font-medium truncate">
                {{ settings.useDefaultFavicon ? 'Default' : (settings.faviconFile ?? 'Not uploaded') }}
              </p>
              <p class="text-xs text-muted-foreground">
                Favicon
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- Selected Content Summary -->
    <Card>
      <CardHeader class="pb-3">
        <div class="flex items-center justify-between">
          <CardTitle class="text-base">
            Selected Content
          </CardTitle>
          <Button variant="ghost" size="sm" class="text-xs h-7" @click="emit('goToStep', 2)">
            <Icon name="i-lucide-pencil" class="size-3 mr-1" />
            Edit
          </Button>
        </div>
      </CardHeader>
      <CardContent class="space-y-4">
        <!-- Property Info -->
        <div v-if="selectedProperties.length > 0">
          <div class="flex items-center gap-2 mb-3">
            <Icon name="i-lucide-home" class="size-4 text-muted-foreground" />
            <div>
              <p class="text-sm font-medium">
                {{ selectedProperties.length }} listing{{ selectedProperties.length !== 1 ? 's' : '' }} selected
              </p>
              <p class="text-xs text-muted-foreground">
                {{ selectedProperties.map(p => p.name).join(', ') }}
              </p>
            </div>
          </div>

          <!-- Rooms (multi-unit listings only) -->
          <div v-if="selectedRooms.length > 0" class="space-y-2">
            <p class="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Rooms ({{ selectedRooms.length }})
            </p>
            <div class="flex flex-wrap gap-2">
              <div
                v-for="room in selectedRooms"
                :key="room.id"
                class="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs"
              >
                <Icon name="i-lucide-bed" class="size-3 text-muted-foreground" />
                <span class="font-medium">{{ room.name }}</span>
                <Badge variant="secondary" class="text-[9px] px-1 py-0 ml-0.5">
                  {{ room.typeName }}
                </Badge>
              </div>
            </div>
          </div>

          <!-- Photos Count -->
          <div class="flex items-center gap-2 mt-3 pt-3 border-t">
            <Icon name="i-lucide-image" class="size-4 text-muted-foreground" />
            <span class="text-sm">
              <span class="font-medium">{{ totalPhotos }}</span> photo{{ totalPhotos !== 1 ? 's' : '' }} included
            </span>
          </div>
        </div>

        <div v-else class="flex flex-col items-center justify-center py-6 gap-2 text-muted-foreground">
          <Icon name="i-lucide-alert-circle" class="size-8" />
          <p class="text-sm">
            No listing selected
          </p>
          <Button variant="outline" size="sm" @click="emit('goToStep', 2)">
            Select listings
          </Button>
        </div>
      </CardContent>
    </Card>

    <!-- Reviews Summary -->
    <Card>
      <CardHeader class="pb-3">
        <div class="flex items-center justify-between">
          <CardTitle class="text-base">
            Guest Reviews
          </CardTitle>
          <Button variant="ghost" size="sm" class="text-xs h-7" @click="emit('goToStep', 3)">
            <Icon name="i-lucide-pencil" class="size-3 mr-1" />
            Edit
          </Button>
        </div>
      </CardHeader>
      <CardContent class="space-y-3">
        <div class="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant="outline" class="text-[10px] px-1.5 py-0">
            {{ isAutoMode ? 'Auto' : 'Manual' }}
          </Badge>
          <Icon name="i-lucide-star" class="size-4 text-muted-foreground" />
          <span class="font-medium">{{ resolvedReviews.length + reviews.manualReviews.length }}</span>
          <span class="text-muted-foreground">{{ ' ' }}{{ isAutoMode
            ? `review${resolvedReviews.length + reviews.manualReviews.length === 1 ? ' matches' : 's match'}`
            : `review${resolvedReviews.length + reviews.manualReviews.length === 1 ? '' : 's'} selected` }}</span>
        </div>
        <div v-if="isAutoMode" class="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span v-if="activeRules.length > 0">{{ activeRules.join(' · ') }}</span>
          <span v-else class="text-destructive">Every channel is switched off</span>
          <span>· {{ reviewConfig.batchSize }} per batch, no total limit</span>
        </div>
        <div v-if="sectionHidden" class="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs">
          <Icon name="i-lucide-eye-off" class="size-3.5 shrink-0 mt-0.5 text-amber-600" />
          <span>
            The reviews section stays hidden until at least
            {{ reviewConfig.minCountToShow }} reviews match.
          </span>
        </div>
        <!-- Every published review is also on the home page, so this states the rule
             rather than counting a hand-picked subset. -->
        <div v-if="resolvedReviews.length + reviews.manualReviews.length > 0" class="flex items-center gap-2 text-sm">
          <Icon name="i-lucide-star" class="size-4 text-primary" />
          <span class="text-muted-foreground">All of them show on the home page</span>
        </div>
        <div v-if="reviews.manualReviews.length > 0" class="flex flex-wrap gap-2">
          <div
            v-for="m in reviews.manualReviews"
            :key="m.id"
            class="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs"
          >
            <Badge variant="secondary" class="text-[9px] px-1 py-0">
              {{ m.rating }}/10
            </Badge>
            <span class="font-medium">{{ m.guestName }}</span>
            <Badge variant="outline" class="text-[9px] px-1 py-0">
              Manual
            </Badge>
          </div>
        </div>

        <div v-if="visibleReviews.length > 0" class="space-y-3 border-t pt-3">
          <p class="text-xs font-medium text-muted-foreground">
            Reviews page preview
          </p>
          <div class="grid grid-cols-1 gap-3 @xl/main:grid-cols-2">
            <div
              v-for="r in visibleReviews"
              :key="r.id"
              data-testid="preview-review-card"
              class="rounded-lg border bg-card p-4"
            >
              <div class="flex items-center justify-between mb-1">
                <span class="text-sm font-medium">{{ r.guest_name }}</span>
                <span class="text-sm font-semibold">
                  {{ getDisplayScore(r.guest_rating_overall, r.source) }}/{{ getDisplayMax(r.source) }}
                </span>
              </div>
              <p class="text-sm text-muted-foreground line-clamp-3">
                {{ r.guest_review_text || 'No written review' }}
              </p>
              <div class="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                <Icon :name="channelIcons[r.source]" class="size-3" />
                {{ channelLabels[r.source] }}
              </div>
            </div>
          </div>
          <button
            v-if="hasMoreReviews"
            type="button"
            data-testid="preview-load-more"
            class="w-full flex items-center justify-center gap-1.5 rounded-md border border-dashed py-2 text-xs text-muted-foreground hover:bg-muted/50"
            @click="loadMoreReviews"
          >
            <Icon name="i-lucide-chevron-down" class="size-3" />
            Load more reviews
          </button>
        </div>
      </CardContent>
    </Card>

    <!-- Navigation -->
    <div class="flex items-center justify-between pt-2">
      <Button variant="ghost" :disabled="isPublishing" @click="handleBack">
        <Icon name="i-lucide-arrow-left" class="size-4 mr-2" />
        Back
      </Button>
      <div class="flex items-center gap-2">
        <Button
          v-if="isEditingPublished"
          variant="outline"
          data-testid="preview-unpublish"
          :disabled="isPublishing"
          @click="unpublishOpen = true"
        >
          <Icon name="i-lucide-eye-off" class="size-4 mr-2" />
          Unpublish
        </Button>
        <Button v-else variant="outline" :disabled="isPublishing" @click="saveDraft">
          <Icon name="i-lucide-file-text" class="size-4 mr-2" />
          Save as Draft
        </Button>
        <Button :disabled="isPublishing" @click="publishWebsite">
          <Icon v-if="isPublishing" name="i-lucide-loader-2" class="size-4 mr-2 animate-spin" />
          <Icon v-else name="i-lucide-rocket" class="size-4 mr-2" />
          {{ isEditingPublished ? 'Update Website' : 'Publish Website' }}
        </Button>
      </div>
    </div>

    <AlertDialog v-model:open="unpublishOpen">
      <AlertDialogContent>
        <AlertDialogTitle>Unpublish {{ settings.name }}?</AlertDialogTitle>
        <AlertDialogDescription>
          Visitors to {{ settings.domain }} will no longer see the site. Nothing is deleted —
          your edits are saved as a draft, and you can publish it again at any time.
        </AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction data-testid="preview-unpublish-confirm" @click="unpublishWebsite">
            Unpublish
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
