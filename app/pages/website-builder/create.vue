<script setup lang="ts">
import type { PropertySelection } from '~/components/website-builder/data/property-listings'
import type { ReviewSelection } from '~/components/website-builder/steps/ReviewStep.vue'
import type { WebsiteSettings } from '~/components/website-builder/steps/SettingsStep.vue'
import type { Template } from '~/components/website-builder/steps/TemplateStep.vue'
import { cloneRuleSet, newRuleSet, ruleSetForWebsite, websiteChannel } from '~/components/channels/data/website-channel'
import { getListingsForProperties, selectionForListings } from '~/components/website-builder/data/property-listings'
import { createDefaultReviewConfig } from '~/components/website-builder/data/review-config'
import { websites } from '~/components/website-builder/data/websites'
import { fontFamilyFor, GUEST_OPTIONS, newWizardAnswers, SITE_DOMAIN, STYLE_PRESETS, templateForPreset, TONE_OPTIONS } from '~/components/website-builder/data/wizard'
import { useWebsiteChannel } from '~/composables/useWebsiteChannel'

definePageMeta({
  layout: 'builder',
})

const router = useRouter()
const route = useRoute()

// The mobile onboarding order: short questions first, then style, listings and details.
type StepKey = 'guests' | 'tone' | 'languages' | 'transition' | 'style' | 'listings' | 'details' | 'review' | 'generating' | 'preview'
const step = ref<StepKey>('guests')
const answers = ref(newWizardAnswers())

// Steps with a progress bar entry. Transition and Generating are full-screen, Preview has its own footer.
const PROGRESS: { key: StepKey, label: string }[] = [
  { key: 'guests', label: 'Guests' },
  { key: 'tone', label: 'Tone' },
  { key: 'languages', label: 'Languages' },
  { key: 'style', label: 'Style' },
  { key: 'listings', label: 'Listings' },
  { key: 'details', label: 'Details' },
  { key: 'review', label: 'Review' },
]
const progressIndex = computed(() => PROGRESS.findIndex(p => p.key === step.value))
const progressPercent = computed(() => Math.round(((progressIndex.value + 1) / PROGRESS.length) * 100))
const selectedTemplate = computed<Template>(() => templateForPreset(answers.value.stylePreset))

const websiteSettings = ref<WebsiteSettings>({
  name: '',
  domain: '',
  description: '',
  brandColor: '#1a1a2e',
  fontFamily: 'Inter',
  logoFile: null,
  faviconFile: null,
  useDefaultFavicon: false,
  rules: newRuleSet(),
})
const propertySelection = ref<PropertySelection>({
  propertyIds: [],
  roomIds: [],
})
const reviewSelection = ref<ReviewSelection>({
  selectedReviewIds: [],
  featuredReviewIds: [],
  manualReviews: [],
  featuredManualReviewIds: [],
  config: createDefaultReviewConfig(),
})

// ── Edit mode: prefill from existing website ─────────────────────
const editId = computed(() => route.query.edit as string | undefined)
const editingWebsite = computed(() => websites.value.find(w => w.id === editId.value) ?? null)

const STYLE_TEMPLATES = STYLE_PRESETS.map(p => p.template)

// Edit mode only: the saved site stores the template by name.
const editTemplate = computed<Template | null>(() => {
  const name = editingWebsite.value?.template
  return name ? STYLE_TEMPLATES.find(t => t.name === name) ?? null : null
})

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
    rules: newRuleSet(),
    languages: site.languages ?? ['en'],
    defaultLanguage: site.defaultLanguage ?? site.languages?.[0] ?? 'en',
    autoDetectLanguage: site.autoDetectLanguage ?? false,
    blogPosts: site.blogPosts ?? [],
  }
  propertySelection.value = selectionForListings(getListingsForProperties(site.propertyIds ?? []))
  reviewSelection.value = {
    selectedReviewIds: site.reviewIds ?? [],
    featuredReviewIds: site.featuredReviewIds ?? [],
    manualReviews: site.manualReviews ?? [],
    featuredManualReviewIds: site.featuredManualReviewIds ?? [],
    config: site.reviewConfig ?? createDefaultReviewConfig(),
  }
}

// The site's rules come from the Website channel, saved in localStorage, so it is
// read after mount to keep the server and first client render the same.
const { hydrate } = useWebsiteChannel()
onMounted(() => {
  hydrate()
  if (editingWebsite.value) {
    websiteSettings.value = {
      ...websiteSettings.value,
      rules: cloneRuleSet(ruleSetForWebsite(websiteChannel.value, editingWebsite.value.id) ?? newRuleSet()),
    }
  }
})

const FLOW: StepKey[] = ['guests', 'tone', 'languages', 'transition', 'style', 'listings', 'details', 'review']
const detailsRef = ref<{ hasValidData: boolean } | null>(null)

// What the site is saved with: the wizard's address and font choices folded into the settings.
const finalSettings = computed<WebsiteSettings>(() => ({
  ...websiteSettings.value,
  domain: answers.value.hasCustomDomain ? answers.value.customDomain.trim().toLowerCase() : `${answers.value.subdomain.trim().toLowerCase()}${SITE_DOMAIN}`,
  fontFamily: fontFamilyFor(answers.value.fontPairing),
  languages: answers.value.languages,
  defaultLanguage: answers.value.defaultLanguage,
  autoDetectLanguage: answers.value.autoDetectLanguage,
  blogPosts: [],
}))

const canNext = computed(() => {
  if (step.value === 'listings')
    return propertySelection.value.propertyIds.length > 0
  if (step.value === 'details')
    return detailsRef.value?.hasValidData ?? false
  return true
})
const showFooter = computed(() => ['style', 'listings', 'details'].includes(step.value))

function goNext() {
  const i = FLOW.indexOf(step.value)
  if (i >= 0 && i < FLOW.length - 1 && canNext.value)
    step.value = FLOW[i + 1]!
}

// Back skips the transition screen.
function goBack() {
  const i = FLOW.indexOf(step.value)
  if (i <= 0) {
    router.push('/website-builder')
    return
  }
  const prev = FLOW[i - 1]!
  step.value = prev === 'transition' ? 'languages' : prev
}

// PreviewStep's "Change" buttons use the old numbered steps.
const PREVIEW_STEP_TARGETS: Record<number, StepKey> = { 0: 'style', 1: 'details', 2: 'listings', 3: 'details' }
function onPreviewGoTo(index: number) {
  step.value = PREVIEW_STEP_TARGETS[index] ?? 'review'
}
</script>

<template>
  <!-- h-full: the builder layout is a definite-height flex column, so the editor fills it instead of guessing a header height. -->
  <div v-if="editingWebsite" class="flex h-full w-full flex-col gap-4">
    <Button variant="ghost" size="sm" class="shrink-0 self-start" @click="router.push('/website-builder')">
      <Icon name="i-lucide-arrow-left" class="size-4 mr-2" />
      Back to Website Builder
    </Button>
    <WebsiteBuilderWebsiteEditor
      v-model:settings="websiteSettings"
      v-model:property="propertySelection"
      v-model:reviews="reviewSelection"
      :website="editingWebsite"
      :template="editTemplate"
    />
  </div>

  <div v-else class="flex w-full flex-col gap-6" data-testid="create-wizard">
    <!-- Progress (question, style, listing and detail screens only) -->
    <div v-if="progressIndex >= 0" class="mx-auto w-full max-w-2xl" data-testid="wz-progress">
      <ol class="mb-2 flex justify-between">
        <li
          v-for="(p, i) in PROGRESS"
          :key="p.key"
          class="text-xs font-medium transition-colors"
          :class="progressIndex >= i ? 'text-foreground' : 'text-muted-foreground'"
          :aria-current="progressIndex === i ? 'step' : undefined"
        >
          {{ p.label }}
        </li>
      </ol>
      <Progress :model-value="progressPercent" class="h-1.5" />
    </div>

    <div class="flex-1">
      <WebsiteBuilderWizardChoiceStep
        v-if="step === 'guests'"
        v-model="answers.guestType"
        title="Who are your guests?"
        :options="GUEST_OPTIONS"
        @next="goNext"
      />

      <WebsiteBuilderWizardChoiceStep
        v-else-if="step === 'tone'"
        v-model="answers.tone"
        title="What's the tone of voice?"
        :options="TONE_OPTIONS"
        @next="goNext"
      />

      <WebsiteBuilderWizardLanguagesStep v-else-if="step === 'languages'" v-model="answers" @next="goNext" />

      <WebsiteBuilderWizardTransitionStep v-else-if="step === 'transition'" @done="step = 'style'" />

      <WebsiteBuilderWizardStyleStep
        v-else-if="step === 'style'"
        v-model:answers="answers"
        v-model:settings="websiteSettings"
        class="mx-auto max-w-4xl"
      />

      <div v-else-if="step === 'listings'" class="mx-auto w-full max-w-4xl">
        <WebsiteBuilderStepsListingsStep v-model="propertySelection" />
      </div>

      <WebsiteBuilderWizardDetailsStep
        v-else-if="step === 'details'"
        ref="detailsRef"
        v-model:settings="websiteSettings"
        v-model:answers="answers"
        v-model:reviews="reviewSelection"
        :property-ids="propertySelection.propertyIds"
      />

      <WebsiteBuilderWizardFinalReviewStep
        v-else-if="step === 'review'"
        :settings="finalSettings"
        :answers="answers"
        :property="propertySelection"
        @generate="step = 'generating'"
        @go-to="step = $event"
      />

      <WebsiteBuilderWizardGeneratingStep v-else-if="step === 'generating'" @done="step = 'preview'" @back="step = 'review'" />

      <WebsiteBuilderStepsPreviewStep
        v-else-if="step === 'preview'"
        :template="selectedTemplate"
        :settings="finalSettings"
        :property="propertySelection"
        :reviews="reviewSelection"
        @back="step = 'review'"
        @go-to-step="onPreviewGoTo"
      />
    </div>

    <!-- Footer: Back and Next. Question screens move on by themselves; review and generate have their own button. -->
    <div v-if="showFooter || step === 'review'" class="mx-auto flex w-full items-center justify-between border-t pt-4" :class="step === 'details' || step === 'review' ? 'max-w-3xl' : 'max-w-4xl'">
      <Button variant="ghost" data-testid="wz-back" @click="goBack">
        <Icon name="i-lucide-arrow-left" class="mr-2 size-4" />
        Back
      </Button>
      <Button v-if="showFooter" :disabled="!canNext" data-testid="wz-next" @click="goNext">
        Next
        <Icon name="i-lucide-arrow-right" class="ml-2 size-4" />
      </Button>
    </div>
    <div v-else-if="step === 'guests' || step === 'tone' || step === 'languages'" class="mx-auto w-full max-w-2xl">
      <Button variant="ghost" data-testid="wz-back" @click="goBack">
        <Icon name="i-lucide-arrow-left" class="mr-2 size-4" />
        Back
      </Button>
    </div>
  </div>
</template>
