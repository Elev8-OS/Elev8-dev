<script setup lang="ts">
import type { Website } from '~/components/website-builder/data/websites'
import type { PropertySelection } from '~/components/website-builder/steps/PropertyStep.vue'
import type { ReviewSelection } from '~/components/website-builder/steps/ReviewStep.vue'
import type { WebsiteSettings } from '~/components/website-builder/steps/SettingsStep.vue'
import type { Template } from '~/components/website-builder/steps/TemplateStep.vue'
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
  { key: 'hero', label: 'Hero Media', icon: 'lucide:image' },
  { key: 'listings', label: 'Manage Listings', icon: 'lucide:house' },
  { key: 'blog', label: 'Blog', icon: 'lucide:newspaper' },
  { key: 'surroundings', label: 'Surroundings', icon: 'lucide:map-pin' },
  { key: 'reviews', label: 'Reviews', icon: 'lucide:star' },
  { key: 'seo', label: 'SEO', icon: 'lucide:search' },
  { key: 'legal', label: 'Cookie & Legal', icon: 'lucide:shield-check' },
  { key: 'history', label: 'Version History', icon: 'lucide:history' },
  { key: 'analytics', label: 'Analytics', icon: 'lucide:chart-no-axes-column' },
] as const
type SectionKey = typeof SECTIONS[number]['key']

const section = ref<SectionKey>('ai')
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

function save(status: Website['status'], message: string) {
  if (problem.value) {
    toast.error('Cannot save yet', { description: problem.value })
    return
  }
  saveWebsite({ template: props.template, settings: settings.value, property: property.value, reviews: reviews.value }, status, props.website.id)
  toast.success(message)
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

// ── AI Generate (mock: nothing is sent anywhere) ──────────────────
const SUGGESTIONS = {
  Content: ['Hero headline', 'Shorter subtext', 'Rename feature', 'Footer tagline', 'Fix airport time', 'More emotional'],
  Design: ['Bolder colors', 'Larger photos', 'Simpler menu', 'Softer buttons'],
  SEO: ['Meta description', 'Page titles', 'Alt text for photos', 'Local keywords'],
} as const
const scope = ref<keyof typeof SUGGESTIONS>('Content')
const prompt = ref('')
const editing = ref(false)

function startEditing() {
  if (!prompt.value.trim())
    return
  editing.value = true
  setTimeout(() => {
    editing.value = false
    prompt.value = ''
    toast.success('ElevAI updated the draft', { description: 'Re-render the site to publish the change.' })
  }, 1200)
}

const created = computed(() => new Date(live.value.lastUpdated).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }))
</script>

<template>
  <div class="flex flex-col overflow-hidden rounded-lg border bg-background" data-testid="website-editor">
    <!-- Header -->
    <div class="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
      <div class="min-w-0">
        <h2 class="truncate text-xl font-semibold tracking-tight" data-testid="we-title">
          {{ settings.name || 'Untitled website' }}
        </h2>
        <div class="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <button type="button" class="underline decoration-dotted underline-offset-4 hover:text-foreground" @click="section = 'listings'">
            {{ listingCount }} {{ listingCount === 1 ? 'Listing' : 'Listings' }}
          </button>
          <span aria-hidden="true">·</span>
          <Icon :name="isPublished ? 'lucide:rocket' : 'lucide:file-text'" class="size-4" :class="isPublished && 'text-success'" aria-hidden="true" />
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

    <div class="flex min-h-[32rem] flex-col md:flex-row">
      <!-- Sections -->
      <nav class="shrink-0 border-b p-3 md:w-60 md:border-b-0 md:border-r" aria-label="Website sections">
        <ul class="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
          <li v-for="s in SECTIONS" :key="s.key" class="shrink-0">
            <button
              type="button"
              class="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors"
              :class="section === s.key ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'"
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
      <div class="min-w-0 flex-1 bg-muted/30">
        <!-- AI Generate: suggestions, prompt and live preview -->
        <div v-if="section === 'ai'" class="flex flex-col gap-4 p-5" data-testid="we-ai">
          <div class="flex flex-wrap items-center gap-2">
            <span class="inline-flex items-center gap-1.5 text-sm font-medium">
              <Icon name="elev8:elevai" class="size-4" aria-hidden="true" />
              Quick suggestions
            </span>
            <Select v-model="scope">
              <SelectTrigger class="h-8 w-32" aria-label="Suggestion type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="key in Object.keys(SUGGESTIONS)" :key="key" :value="key">
                  {{ key }}
                </SelectItem>
              </SelectContent>
            </Select>
            <Button
              v-for="chip in SUGGESTIONS[scope]"
              :key="chip"
              variant="outline"
              size="sm"
              class="rounded-full"
              @click="prompt = chip"
            >
              {{ chip }}
            </Button>
          </div>
          <div class="flex items-start gap-2">
            <Textarea v-model="prompt" class="min-h-20 flex-1 bg-background" placeholder="e.g. Make the hero headline more punchy..." aria-label="What should ElevAI change?" />
            <Button :disabled="!prompt.trim() || editing" data-testid="we-start-editing" @click="startEditing">
              <Icon :name="editing ? 'lucide:loader-circle' : 'elev8:elevai'" class="mr-2 size-4" :class="editing && 'animate-spin'" aria-hidden="true" />
              Start editing
            </Button>
          </div>

          <!-- Preview -->
          <div class="overflow-hidden rounded-lg border bg-background" data-testid="we-preview">
            <div class="flex items-center gap-3 border-b bg-muted/50 px-4 py-2.5">
              <div class="flex gap-1.5" aria-hidden="true">
                <span class="size-2.5 rounded-full bg-destructive" />
                <span class="size-2.5 rounded-full bg-warning" />
                <span class="size-2.5 rounded-full bg-success" />
              </div>
              <div class="min-w-0 flex-1 truncate rounded-md border bg-background px-3 py-1 text-xs text-muted-foreground">
                {{ siteUrl }}
              </div>
              <a :href="siteUrl" target="_blank" rel="noopener" aria-label="Open the site in a new tab" class="text-muted-foreground hover:text-foreground">
                <Icon name="lucide:external-link" class="size-4" aria-hidden="true" />
              </a>
            </div>
            <div class="flex min-h-72 flex-col bg-gradient-to-br from-muted to-muted-foreground/30 p-4">
              <div class="flex items-center justify-between gap-3 rounded-full bg-background/80 px-5 py-2.5 backdrop-blur">
                <span class="truncate text-lg font-semibold" :style="{ fontFamily: settings.fontFamily }">{{ settings.name }}</span>
                <span class="hidden text-sm text-muted-foreground sm:inline">Properties · About · Contact · Blog</span>
                <span class="rounded-full px-4 py-1.5 text-sm font-medium text-white" :style="{ backgroundColor: settings.brandColor }">Book now</span>
              </div>
              <div class="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
                <p class="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                  {{ template?.name ?? 'Bali' }}
                </p>
                <p class="max-w-xl text-3xl font-semibold" :style="{ fontFamily: settings.fontFamily }">
                  {{ settings.description || 'Your private retreat in the heart of Bali' }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Existing builder steps, without their Back / Next -->
        <div v-else-if="section === 'settings'" class="p-5" data-testid="we-settings">
          <WebsiteBuilderStepsSettingsStep v-model="settings" embedded />
        </div>
        <div v-else-if="section === 'listings'" class="p-5">
          <WebsiteBuilderStepsPropertyStep v-model="property" embedded />
        </div>
        <div v-else-if="section === 'reviews'" class="p-5">
          <WebsiteBuilderStepsReviewStep v-model="reviews" :property-ids="property.propertyIds" embedded />
        </div>

        <!-- Sections with nothing to set up in this demo yet -->
        <div v-else-if="section === 'history'" class="p-5" data-testid="we-history">
          <h3 class="text-lg font-semibold">
            Version History
          </h3>
          <ul class="mt-3 divide-y rounded-md border bg-background text-sm">
            <li class="flex items-center justify-between gap-3 px-4 py-3">
              <span class="font-medium">{{ isPublished ? 'Published version' : 'Latest draft' }}</span>
              <span class="text-muted-foreground">{{ created }}</span>
            </li>
          </ul>
        </div>
        <div v-else-if="section === 'analytics'" class="p-5" data-testid="we-analytics">
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
        <div v-else class="flex min-h-72 flex-col items-center justify-center gap-2 p-5 text-center" data-testid="we-empty">
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
