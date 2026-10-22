<script setup lang="ts">
import type { PropertySelection } from '~/components/website-builder/data/property-listings'
import type { Website } from '~/components/website-builder/data/websites'
import type { ReviewSelection } from '~/components/website-builder/steps/ReviewStep.vue'
import type { WebsiteSettings } from '~/components/website-builder/steps/SettingsStep.vue'
import type { Template } from '~/components/website-builder/steps/TemplateStep.vue'
import { useMediaQuery } from '@vueuse/core'
import { nextTick } from 'vue'
import { toast } from 'vue-sonner'
import { ruleSetIssues } from '~/components/channels/data/website-channel'
import { getListingIdsForWebsite } from '~/components/website-builder/data/property-listings'
import { websites } from '~/components/website-builder/data/websites'
import { useWebsiteSave } from '~/composables/useWebsiteSave'

const props = defineProps<{
  website: Website
  template: Template | null
}>()

const settings = defineModel<WebsiteSettings>('settings', { required: true })
const property = defineModel<PropertySelection>('property', { required: true })
const reviews = defineModel<ReviewSelection>('reviews', { required: true })

const SECTIONS = [
  { key: 'ai', label: 'AI Generate', icon: 'elev8:elevai' },
  { key: 'settings', label: 'Site Settings', icon: 'lucide:settings' },
  { key: 'rules', label: 'Booking Rules', icon: 'lucide:calendar-check' },
  { key: 'listings', label: 'Manage Listings', icon: 'lucide:house' },
  { key: 'blog', label: 'Blog', icon: 'lucide:newspaper' },
  { key: 'surroundings', label: 'Surroundings', icon: 'lucide:map-pin' },
  { key: 'reviews', label: 'Reviews', icon: 'lucide:star' },
  { key: 'seo', label: 'SEO', icon: 'lucide:search' },
  { key: 'legal', label: 'Cookie & Legal', icon: 'lucide:shield-check' },
  { key: 'analytics', label: 'Analytics', icon: 'lucide:chart-no-axes-column' },
] as const
type SectionKey = typeof SECTIONS[number]['key']

const section = ref<SectionKey>('ai')
// Below lg the chat sits above the preview instead of beside it.
const wide = useMediaQuery('(min-width: 1024px)')
const current = computed(() => SECTIONS.find(s => s.key === section.value)!)

const { saveWebsite } = useWebsiteSave()
const live = computed(() => websites.value.find(w => w.id === props.website.id) ?? props.website)
const isPublished = computed(() => live.value.status === 'published')
const listingCount = computed(() => getListingIdsForWebsite(live.value).length)
const siteUrl = computed(() => `https://${settings.value.domain}`)

// Same checks the wizard makes before it moves on.
const rulesIssues = computed(() => settings.value.rules
  ? ruleSetIssues({ ...settings.value.rules, name: 'site', websiteIds: ['site'] }, [])
  : [])
const problem = computed(() => {
  if (!settings.value.name.trim() || !settings.value.domain.trim())
    return 'Site Settings needs a name and a domain.'
  if (rulesIssues.value.length)
    return rulesIssues.value[0]!.message
  // A website stores its properties, not the rooms picked in the wizard.
  if (property.value.propertyIds.length === 0)
    return 'Manage Listings needs at least one property.'
  return null
})

const settingsSaved = ref(false)

// Inline title edit: Enter or leaving the field keeps it, Escape drops it. It is saved with the rest of the site.
const editingTitle = ref(false)
const titleDraft = ref('')
const titleInput = ref<{ $el?: HTMLInputElement } | HTMLInputElement | null>(null)

function startTitleEdit() {
  titleDraft.value = settings.value.name
  editingTitle.value = true
  nextTick(() => {
    const el = titleInput.value && '$el' in titleInput.value ? titleInput.value.$el : titleInput.value as HTMLInputElement | null
    el?.focus()
    el?.select()
  })
}
function commitTitle() {
  if (!editingTitle.value)
    return
  editingTitle.value = false
  const name = titleDraft.value.trim()
  if (name && name !== settings.value.name)
    settings.value = { ...settings.value, name }
}
function cancelTitle() {
  editingTitle.value = false
}

function save(status: Website['status'], message: string) {
  if (problem.value) {
    toast.error('Cannot save yet', { description: problem.value })
    return false
  }
  saveWebsite({ template: props.template, settings: settings.value, property: property.value, reviews: reviews.value }, status, props.website.id)
  settingsSaved.value = true
  toast.success(message)
  return true
}

// Keeps the site as it is (live stays live, a draft stays a draft).
function saveSection(message: string) {
  save(isPublished.value ? 'published' : 'draft', message)
}

const unpublishOpen = ref(false)
const rendering = ref(false)

function rerender() {
  rendering.value = true
  setTimeout(() => {
    rendering.value = false
    toast.success('Site re-rendered')
  }, 800)
}

function unpublish() {
  unpublishOpen.value = false
  save('draft', 'Website unpublished. It is a draft again')
}
</script>

<template>
  <div class="flex min-h-[32rem] flex-1 flex-col overflow-hidden rounded-lg border bg-background" data-testid="website-editor">
    <!-- Header -->
    <div class="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
      <div class="min-w-0">
        <div v-if="editingTitle" class="max-w-md">
          <Input
            ref="titleInput"
            v-model="titleDraft"
            class="h-9 text-xl font-semibold tracking-tight"
            aria-label="Website title"
            data-testid="we-title-input"
            @keydown.enter.prevent="commitTitle"
            @keydown.esc.prevent="cancelTitle"
            @blur="commitTitle"
          />
        </div>
        <div v-else class="flex min-w-0 items-center gap-1.5">
          <h2 class="truncate text-xl font-semibold tracking-tight" data-testid="we-title">
            {{ settings.name || 'Untitled website' }}
          </h2>
          <Button variant="ghost" size="icon-sm" aria-label="Edit website title" data-testid="we-title-edit" @click="startTitleEdit">
            <Icon name="lucide:pencil" class="size-4" aria-hidden="true" />
          </Button>
        </div>
        <div class="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <button type="button" class="underline decoration-dotted underline-offset-4 hover:text-foreground" @click="section = 'listings'">
            {{ listingCount }} {{ listingCount === 1 ? 'Listing' : 'Listings' }}
          </button>
          <span aria-hidden="true">·</span>
          <Icon :name="isPublished ? 'lucide:rocket' : 'lucide:file-text'" class="size-4" :class="isPublished && 'text-green-600 dark:text-green-400'" aria-hidden="true" />
          <a :href="siteUrl" target="_blank" rel="noopener" class="inline-flex items-center gap-1 hover:text-foreground">
            {{ settings.domain }}
            <Icon name="lucide:external-link" class="size-3.5" aria-hidden="true" />
          </a>
          <Badge v-if="!isPublished" variant="outline">
            Draft
          </Badge>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <Button variant="outline" :disabled="rendering" data-testid="we-rerender" @click="rerender">
          <Icon name="lucide:refresh-cw" class="mr-2 size-4" :class="rendering && 'animate-spin'" aria-hidden="true" />
          Re-render
        </Button>
        <Button v-if="isPublished" variant="outline" data-testid="we-unpublish" @click="unpublishOpen = true">
          <Icon name="lucide:cloud-off" class="mr-2 size-4" aria-hidden="true" />
          Unpublish
        </Button>
        <Button data-testid="we-save" @click="save('published', isPublished ? 'Website updated' : 'Website published')">
          <Icon name="lucide:rocket" class="mr-2 size-4" aria-hidden="true" />
          {{ isPublished ? 'Save changes' : 'Publish' }}
        </Button>
      </div>
    </div>

    <div class="flex min-h-0 flex-1 flex-col md:flex-row">
      <!-- Sections -->
      <nav class="shrink-0 overflow-y-auto border-b p-3 md:w-60 md:border-b-0 md:border-r" aria-label="Website sections">
        <ul class="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
          <li v-for="s in SECTIONS" :key="s.key" class="shrink-0">
            <button
              type="button"
              class="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors"
              :class="section === s.key ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'"
              :aria-current="section === s.key ? 'page' : undefined"
              :data-testid="`we-nav-${s.key}`"
              @click="section = s.key"
            >
              <Icon :name="s.icon" class="size-4 shrink-0" aria-hidden="true" />
              {{ s.label }}
            </button>
          </li>
        </ul>
      </nav>

      <!-- Content -->
      <div class="min-h-0 min-w-0 flex-1 overflow-y-auto bg-muted/30">
        <!-- AI Generate: chat and live preview, the divider between them can be dragged. v-show keeps the chat and its history while another section is open. -->
        <div v-show="section === 'ai'" class="h-full min-h-[28rem] p-4" data-testid="we-ai">
          <ResizablePanelGroup
            :key="wide ? 'row' : 'column'"
            :direction="wide ? 'horizontal' : 'vertical'"
            :auto-save-id="`website-editor-ai-${wide ? 'row' : 'column'}`"
            class="min-h-[28rem]"
          >
            <ResizablePanel :default-size="40" :min-size="25" :max-size="75" class="overflow-hidden rounded-lg border bg-background">
              <WebsiteBuilderWebsiteAiChat v-model:settings="settings" :baseline="{ label: isPublished ? 'Published version' : 'Latest draft', at: live.lastUpdated }" />
            </ResizablePanel>
            <ResizableHandle with-handle class="mx-1.5 my-1.5 bg-transparent" aria-label="Resize chat" data-testid="we-ai-handle" />
            <ResizablePanel :default-size="60" :min-size="25" class="flex flex-col">
              <WebsiteBuilderWebsitePreviewFrame :settings="settings" :template-name="template?.name" :url="siteUrl" class="min-h-0 flex-1" />
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>

        <!-- Existing builder steps, without their Back / Next -->
        <div v-if="section === 'settings'" class="p-5" data-testid="we-settings">
          <WebsiteBuilderWebsiteSiteSettings
            v-model:settings="settings"
            :published="isPublished"
            :rendering="rendering"
            :saved="settingsSaved"
            @save="moved => save(isPublished ? 'published' : 'draft', 'Settings saved') && moved && rerender()"
            @rerender="rerender"
          />
        </div>
        <div v-else-if="section === 'blog'" class="p-5">
          <WebsiteBuilderWebsiteBlog v-model:settings="settings" @save="saveSection" />
        </div>
        <div v-else-if="section === 'rules'" class="p-5">
          <WebsiteBuilderWebsiteBookingRules
            v-model:settings="settings"
            @save="save(isPublished ? 'published' : 'draft', 'Booking rules saved')"
          />
        </div>
        <div v-else-if="section === 'listings'" class="mx-auto w-full max-w-3xl p-5">
          <WebsiteBuilderStepsListingsStep v-model="property" />
          <div class="mt-6 flex justify-end">
            <Button data-testid="we-save-listings" @click="saveSection('Listings saved')">
              Save changes
            </Button>
          </div>
        </div>
        <div v-else-if="section === 'reviews'" class="p-5">
          <WebsiteBuilderStepsReviewStep v-model="reviews" :property-ids="property.propertyIds" embedded />
          <div class="mx-auto mt-6 flex w-full max-w-3xl justify-end">
            <Button data-testid="we-save-reviews" @click="saveSection('Reviews saved')">
              Save changes
            </Button>
          </div>
        </div>

        <!-- Sections with nothing to set up in this demo yet -->
        <div v-else-if="section === 'analytics'" class="mx-auto w-full max-w-3xl p-5" data-testid="we-analytics">
          <h3 class="text-lg font-semibold">
            Analytics
          </h3>
          <div class="mt-3 rounded-md border bg-background p-4">
            <p class="text-sm text-muted-foreground">
              Visits
            </p>
            <p class="text-2xl font-semibold">
              {{ live.visits.toLocaleString('en-US') }}
            </p>
          </div>
        </div>
        <!-- Not for AI Generate: that panel is `v-show`, so it is outside this v-if chain. -->
        <div v-else-if="section !== 'ai'" class="flex min-h-72 flex-col items-center justify-center gap-2 p-5 text-center" data-testid="we-empty">
          <Icon :name="current.icon" class="size-8 text-muted-foreground" aria-hidden="true" />
          <h3 class="text-lg font-semibold">
            {{ current.label }}
          </h3>
          <p class="max-w-sm text-sm text-muted-foreground">
            Nothing to set up here yet. Use AI Generate to change this part of the site.
          </p>
        </div>
      </div>
    </div>

    <AlertDialog v-model:open="unpublishOpen">
      <AlertDialogContent>
        <AlertDialogTitle>Unpublish {{ settings.name }}?</AlertDialogTitle>
        <AlertDialogDescription>
          Visitors to {{ settings.domain }} will no longer see the site. Nothing is deleted:
          your edits are saved as a draft, and you can publish it again at any time.
        </AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction data-testid="we-unpublish-confirm" @click="unpublish">
            Unpublish
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
