<script setup lang="ts">
import type { Website } from '~/components/website-builder/data/websites'
import type { PropertySelection } from '~/components/website-builder/steps/PropertyStep.vue'
import type { ReviewSelection } from '~/components/website-builder/steps/ReviewStep.vue'
import type { WebsiteSettings } from '~/components/website-builder/steps/SettingsStep.vue'
import type { Template } from '~/components/website-builder/steps/TemplateStep.vue'
import { toast } from 'vue-sonner'
import { websites } from '~/components/website-builder/data/websites'

// Re-export for convenience
export type { PropertySelection, Template, WebsiteSettings }

interface Room {
  id: string
  name: string
  type: 'bedroom' | 'bathroom' | 'living' | 'kitchen' | 'outdoor'
  description: string
  amenities: string[]
  photos: string[]
}

interface Property {
  id: string
  title: string
  location: string
  maxCapacity: number
  amenities: string[]
  photos: string[]
  rooms: Room[]
}

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

// ── Mock properties (mirrors PropertyStep data) ─────────────────
const allProperties: Property[] = [
  {
    id: 'prop-1',
    title: 'Villa Sunset Bay',
    location: 'Seminyak, Bali',
    maxCapacity: 8,
    amenities: ['Pool', 'WiFi', 'A/C'],
    photos: [],
    rooms: [
      { id: 'r1', name: 'Master Bedroom', type: 'bedroom', description: '', amenities: [], photos: ['p1', 'p2'] },
      { id: 'r2', name: 'Guest Bedroom', type: 'bedroom', description: '', amenities: [], photos: ['p3'] },
      { id: 'r3', name: 'Kids Bedroom', type: 'bedroom', description: '', amenities: [], photos: ['p4'] },
      { id: 'r4', name: 'Living Room', type: 'living', description: '', amenities: [], photos: ['p5', 'p6'] },
      { id: 'r5', name: 'Kitchen', type: 'kitchen', description: '', amenities: [], photos: ['p7'] },
      { id: 'r6', name: 'Master Bathroom', type: 'bathroom', description: '', amenities: [], photos: ['p8'] },
      { id: 'r7', name: 'Pool & Terrace', type: 'outdoor', description: '', amenities: [], photos: ['p9', 'p10'] },
    ],
  },
  {
    id: 'prop-2',
    title: 'Ubud Jungle Retreat',
    location: 'Ubud, Bali',
    maxCapacity: 6,
    amenities: ['Pool', 'WiFi'],
    photos: [],
    rooms: [
      { id: 'r8', name: 'Master Suite', type: 'bedroom', description: '', amenities: [], photos: ['p11'] },
      { id: 'r9', name: 'Guest Room', type: 'bedroom', description: '', amenities: [], photos: ['p12'] },
      { id: 'r10', name: 'Open Living Pavilion', type: 'living', description: '', amenities: [], photos: ['p13'] },
      { id: 'r11', name: 'Bamboo Kitchen', type: 'kitchen', description: '', amenities: [], photos: ['p14'] },
      { id: 'r12', name: 'Yoga Deck', type: 'outdoor', description: '', amenities: [], photos: ['p15'] },
    ],
  },
  {
    id: 'prop-3',
    title: 'Beachfront Canggu Villa',
    location: 'Canggu, Bali',
    maxCapacity: 10,
    amenities: ['Pool', 'WiFi', 'Beach Access'],
    photos: [],
    rooms: [
      { id: 'r13', name: 'Master Bedroom', type: 'bedroom', description: '', amenities: [], photos: ['p16', 'p17'] },
      { id: 'r14', name: 'Ocean View Suite', type: 'bedroom', description: '', amenities: [], photos: ['p18'] },
      { id: 'r15', name: 'Garden Room', type: 'bedroom', description: '', amenities: [], photos: ['p19'] },
      { id: 'r16', name: 'Bunk Room', type: 'bedroom', description: '', amenities: [], photos: ['p20'] },
      { id: 'r17', name: 'Main Living Area', type: 'living', description: '', amenities: [], photos: ['p21', 'p22'] },
      { id: 'r18', name: 'Gourmet Kitchen', type: 'kitchen', description: '', amenities: [], photos: ['p23'] },
      { id: 'r19', name: 'Master En-suite', type: 'bathroom', description: '', amenities: [], photos: ['p24'] },
      { id: 'r20', name: 'Guest Bathroom', type: 'bathroom', description: '', amenities: [], photos: ['p25'] },
      { id: 'r21', name: 'Pool Deck', type: 'outdoor', description: '', amenities: [], photos: ['p26', 'p27'] },
    ],
  },
  {
    id: 'prop-4',
    title: 'Cliffside Uluwatu',
    location: 'Uluwatu, Bali',
    maxCapacity: 4,
    amenities: ['Pool', 'WiFi'],
    photos: [],
    rooms: [
      { id: 'r22', name: 'Honeymoon Suite', type: 'bedroom', description: '', amenities: [], photos: ['p28', 'p29'] },
      { id: 'r23', name: 'Cozy Lounge', type: 'living', description: '', amenities: [], photos: ['p30'] },
      { id: 'r24', name: 'Kitchenette', type: 'kitchen', description: '', amenities: [], photos: ['p31'] },
      { id: 'r25', name: 'Cliffside Pool', type: 'outdoor', description: '', amenities: [], photos: ['p32'] },
    ],
  },
]

// ── Computed ─────────────────────────────────────────────────────
const selectedProperties = computed(() =>
  allProperties.filter(p => props.property.propertyIds.includes(p.id)),
)

const selectedRooms = computed(() =>
  selectedProperties.value.flatMap(p => p.rooms).filter(r => props.property.roomIds.includes(r.id)),
)

const totalPhotos = computed(() =>
  selectedRooms.value.reduce((sum, r) => sum + r.photos.length, 0),
)

// ── Room type helpers ────────────────────────────────────────────
const roomTypeConfig: Record<Room['type'], { label: string, variant: 'default' | 'secondary' | 'outline', icon: string }> = {
  bedroom: { label: 'Bedroom', variant: 'default', icon: 'i-lucide-bed' },
  bathroom: { label: 'Bathroom', variant: 'secondary', icon: 'i-lucide-bath' },
  living: { label: 'Living', variant: 'secondary', icon: 'i-lucide-sofa' },
  kitchen: { label: 'Kitchen', variant: 'outline', icon: 'i-lucide-chef-hat' },
  outdoor: { label: 'Outdoor', variant: 'outline', icon: 'i-lucide-trees' },
}

// ── Actions ──────────────────────────────────────────────────────
const isPublishing = ref(false)
const route = useRoute()
const editId = computed(() => route.query.edit as string | undefined)

function persistWebsite(status: Website['status'], message: string) {
  isPublishing.value = true
  setTimeout(() => {
    isPublishing.value = false
    if (editId.value) {
      const index = websites.value.findIndex(w => w.id === editId.value)
      const existing = websites.value[index]
      if (existing) {
        websites.value[index] = {
          ...existing,
          name: props.settings.name,
          url: props.settings.domain,
          status,
          template: props.template?.name ?? existing.template,
          lastUpdated: new Date().toISOString(),
          reviewIds: props.reviews.selectedReviewIds,
          featuredReviewIds: props.reviews.featuredReviewIds,
          manualReviews: props.reviews.manualReviews,
        }
      }
    }
    else {
      websites.value.push({
        id: String(Date.now()),
        name: props.settings.name,
        url: props.settings.domain,
        status,
        template: props.template?.name ?? 'Luxury Villa',
        visits: 0,
        lastUpdated: new Date().toISOString(),
        thumbnail: null,
        reviewIds: props.reviews.selectedReviewIds,
        featuredReviewIds: props.reviews.featuredReviewIds,
        manualReviews: props.reviews.manualReviews,
      })
    }
    toast.success(message)
    navigateTo('/website-builder')
  }, 800)
}

function saveDraft() {
  persistWebsite('draft', 'Website saved as draft')
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
                {{ selectedProperties.length }} propert{{ selectedProperties.length !== 1 ? 'ies' : 'y' }} selected
              </p>
              <p class="text-xs text-muted-foreground">
                {{ selectedProperties.map(p => p.title).join(', ') }}
              </p>
            </div>
          </div>

          <!-- Rooms -->
          <div class="space-y-2">
            <p class="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Rooms ({{ selectedRooms.length }})
            </p>
            <div class="flex flex-wrap gap-2">
              <div
                v-for="room in selectedRooms"
                :key="room.id"
                class="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs"
              >
                <Icon :name="roomTypeConfig[room.type].icon" class="size-3 text-muted-foreground" />
                <span class="font-medium">{{ room.name }}</span>
                <Badge :variant="roomTypeConfig[room.type].variant" class="text-[9px] px-1 py-0 ml-0.5">
                  {{ roomTypeConfig[room.type].label }}
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
            No property selected
          </p>
          <Button variant="outline" size="sm" @click="emit('goToStep', 2)">
            Select Property
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
        <div class="flex items-center gap-2 text-sm">
          <Icon name="i-lucide-star" class="size-4 text-muted-foreground" />
          <span class="font-medium">{{ reviews.selectedReviewIds.length + reviews.manualReviews.length }}</span>
          <span class="text-muted-foreground">review{{ reviews.selectedReviewIds.length + reviews.manualReviews.length !== 1 ? 's' : '' }} selected</span>
        </div>
        <div v-if="reviews.featuredReviewIds.length > 0" class="flex items-center gap-2 text-sm">
          <Icon name="i-lucide-star" class="size-4 text-primary" />
          <span class="font-medium">{{ reviews.featuredReviewIds.length }}</span>
          <span class="text-muted-foreground">featured on main page</span>
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
      </CardContent>
    </Card>

    <!-- Navigation -->
    <div class="flex items-center justify-between pt-2">
      <Button variant="ghost" :disabled="isPublishing" @click="handleBack">
        <Icon name="i-lucide-arrow-left" class="size-4 mr-2" />
        Back
      </Button>
      <div class="flex items-center gap-2">
        <Button variant="outline" :disabled="isPublishing" @click="saveDraft">
          <Icon name="i-lucide-file-text" class="size-4 mr-2" />
          Save as Draft
        </Button>
        <Button :disabled="isPublishing" @click="publishWebsite">
          <Icon v-if="isPublishing" name="i-lucide-loader-2" class="size-4 mr-2 animate-spin" />
          <Icon v-else name="i-lucide-rocket" class="size-4 mr-2" />
          Publish Website
        </Button>
      </div>
    </div>
  </div>
</template>
