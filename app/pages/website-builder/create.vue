<script setup lang="ts">
import type { PropertySelection } from '~/components/website-builder/steps/PropertyStep.vue'
import type { ReviewSelection } from '~/components/website-builder/steps/ReviewStep.vue'
import type { WebsiteSettings } from '~/components/website-builder/steps/SettingsStep.vue'
import type { Template } from '~/components/website-builder/steps/TemplateStep.vue'
import { websites } from '~/components/website-builder/data/websites'

definePageMeta({
  layout: 'default',
})

const router = useRouter()
const route = useRoute()

const STEPS = [
  { key: 'template', label: 'Template', icon: 'i-lucide-layout-template' },
  { key: 'settings', label: 'Settings', icon: 'i-lucide-settings' },
  { key: 'property', label: 'Property', icon: 'i-lucide-home' },
  { key: 'reviews', label: 'Reviews', icon: 'i-lucide-star' },
  { key: 'preview', label: 'Preview', icon: 'i-lucide-eye' },
] as const

const currentStep = ref(0)
const selectedTemplate = ref<Template | null>(null)
const websiteSettings = ref<WebsiteSettings>({
  name: '',
  domain: '',
  description: '',
  brandColor: '#1a1a2e',
  fontFamily: 'Inter',
  logoFile: null,
  faviconFile: null,
  useDefaultFavicon: false,
})
const propertySelection = ref<PropertySelection>({
  propertyIds: [],
  roomIds: [],
})
const reviewSelection = ref<ReviewSelection>({
  selectedReviewIds: [],
  manualReviews: [],
})

// ── Edit mode: prefill from existing website ─────────────────────
const editId = computed(() => route.query.edit as string | undefined)
const editingWebsite = computed(() => websites.value.find(w => w.id === editId.value) ?? null)

const templates: Template[] = [
  { id: 'luxury-villa', name: 'Luxury Villa', description: 'Elegant design with full-screen hero, amenity showcases, and booking integration for premium properties.', gradient: 'from-amber-500/20 to-orange-600/20', icon: 'i-lucide-crown' },
  { id: 'modern-tropical', name: 'Modern Tropical', description: 'Clean, airy layout with lush imagery and nature-inspired accents for tropical getaways.', gradient: 'from-emerald-500/20 to-teal-600/20', icon: 'i-lucide-palmtree' },
  { id: 'beach-house', name: 'Beach House', description: 'Coastal vibes with ocean palettes, photo galleries, and weather widget for seaside stays.', gradient: 'from-sky-500/20 to-blue-600/20', icon: 'i-lucide-waves' },
  { id: 'minimal-bali', name: 'Minimal Bali', description: 'Minimalist zen aesthetic with earthy tones and focused content for serene Bali retreats.', gradient: 'from-stone-400/20 to-stone-600/20', icon: 'i-lucide-flower-2' },
]

if (import.meta.client && editingWebsite.value) {
  const site = editingWebsite.value
  websiteSettings.value = {
    name: site.name,
    domain: site.url,
    description: '',
    brandColor: '#1a1a2e',
    fontFamily: 'Inter',
    logoFile: null,
    faviconFile: null,
    useDefaultFavicon: false,
  }
  selectedTemplate.value = templates.find(t => t.name === site.template) ?? null
  reviewSelection.value = {
    selectedReviewIds: site.reviewIds ?? [],
    manualReviews: site.manualReviews ?? [],
  }
  currentStep.value = 1
}

function onSelectTemplate(template: Template) {
  selectedTemplate.value = template
}

function goNext() {
  if (currentStep.value === 0 && selectedTemplate.value) {
    currentStep.value = 1
  }
  else if (currentStep.value === 1 && websiteSettings.value.name && websiteSettings.value.domain) {
    currentStep.value = 2
  }
  else if (currentStep.value === 2 && propertySelection.value.propertyIds.length > 0 && propertySelection.value.roomIds.length > 0) {
    currentStep.value = 3
  }
  else if (currentStep.value === 3 && (reviewSelection.value.selectedReviewIds.length > 0 || reviewSelection.value.manualReviews.length > 0)) {
    currentStep.value = 4
  }
}

function goBack() {
  if (currentStep.value > 0) {
    currentStep.value--
  }
  else {
    router.push('/website-builder')
  }
}
</script>

<template>
  <div class="w-full flex flex-col gap-6">
    <!-- Header -->
    <div class="flex items-center gap-4">
      <Button variant="ghost" size="sm" @click="router.push('/website-builder')">
        <Icon name="i-lucide-arrow-left" class="size-4 mr-2" />
        Back to Website Builder
      </Button>
    </div>

    <div>
      <h2 class="text-2xl font-bold tracking-tight">
        {{ editingWebsite ? 'Edit Website' : 'Create Website' }}
      </h2>
      <p class="text-muted-foreground mt-1">
        Set up your new property website in a few steps.
      </p>
    </div>

    <!-- Step Indicator -->
    <div class="flex items-center gap-2">
      <template v-for="(step, index) in STEPS" :key="step.key">
        <div class="flex items-center gap-2">
          <div
            class="flex items-center justify-center size-8 rounded-full border text-xs font-medium transition-colors"
            :class="{
              'bg-primary text-primary-foreground border-primary': index < currentStep,
              'bg-primary text-primary-foreground border-primary ring-2 ring-primary/30': index === currentStep,
              'bg-muted text-muted-foreground border-border': index > currentStep,
            }"
          >
            <Icon v-if="index < currentStep" name="i-lucide-check" class="size-4" />
            <span v-else>{{ index + 1 }}</span>
          </div>
          <span
            class="text-sm font-medium hidden sm:inline"
            :class="index <= currentStep ? 'text-foreground' : 'text-muted-foreground'"
          >
            {{ step.label }}
          </span>
        </div>
        <div
          v-if="index < STEPS.length - 1"
          class="h-px flex-1 min-w-4 max-w-16"
          :class="index < currentStep ? 'bg-primary' : 'bg-border'"
        />
      </template>
    </div>

    <!-- Step Content -->
    <div class="flex-1">
      <WebsiteBuilderStepsTemplateStep
        v-if="currentStep === 0"
        @select="onSelectTemplate"
        @next="goNext"
        @back="goBack"
      />

      <WebsiteBuilderStepsSettingsStep
        v-else-if="currentStep === 1"
        v-model="websiteSettings"
        @next="goNext"
        @back="goBack"
      />

      <!-- Step 3: Property & Rooms -->
      <WebsiteBuilderStepsPropertyStep
        v-else-if="currentStep === 2"
        v-model="propertySelection"
        @next="goNext"
        @back="goBack"
      />

      <!-- Step 4: Reviews -->
      <WebsiteBuilderStepsReviewStep
        v-else-if="currentStep === 3"
        v-model="reviewSelection"
        :property-ids="propertySelection.propertyIds"
        @next="goNext"
        @back="goBack"
      />

      <!-- Step 5: Preview & Publish -->
      <WebsiteBuilderStepsPreviewStep
        v-else-if="currentStep === 4"
        :template="selectedTemplate"
        :settings="websiteSettings"
        :property="propertySelection"
        :reviews="reviewSelection"
        @back="goBack"
        @go-to-step="(s: number) => currentStep = s"
      />
    </div>
  </div>
</template>
