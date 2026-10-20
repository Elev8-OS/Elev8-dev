<script setup lang="ts">
import type { HeroMode, WebsiteSettings } from '~/components/website-builder/steps/SettingsStep.vue'
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import { LANGUAGE_OPTIONS, SITE_DOMAIN, slugify } from '~/components/website-builder/data/wizard'

const props = defineProps<{
  /** The site is live, so its custom domain shows Active instead of Pending. */
  published: boolean
  saving?: boolean
  rendering?: boolean
  /** Set by the editor once a save went through: shows the re-render prompt. */
  saved?: boolean
}>()

const emit = defineEmits<{
  /** `moved`: the subdomain changed, so the site has to be re-rendered at its new address. */
  save: [moved: boolean]
  rerender: []
}>()

const settings = defineModel<WebsiteSettings>('settings', { required: true })

// A site stores one address. Under the platform domain it is the subdomain; any other address is its custom domain,
// and the platform subdomain then stays available as the fallback.
const isPlatform = (domain: string) => domain.endsWith(SITE_DOMAIN)
const subdomain = ref(isPlatform(settings.value.domain) ? settings.value.domain.slice(0, -SITE_DOMAIN.length) : slugify(settings.value.name))
const customDomain = ref(isPlatform(settings.value.domain) ? '' : settings.value.domain)
const originalSubdomain = subdomain.value

const address = computed(() => customDomain.value.trim() ? customDomain.value.trim().toLowerCase() : `${subdomain.value.trim().toLowerCase()}${SITE_DOMAIN}`)

function patch(value: Partial<WebsiteSettings>) {
  settings.value = { ...settings.value, ...value }
}
// Keep the saved address in step with the two fields.
watch(address, domain => patch({ domain }))

const subdomainChanged = computed(() => !customDomain.value.trim() && subdomain.value.trim() !== originalSubdomain)

// Apex and www are both provisioned and need the same CNAME.
const domainTwin = computed(() => {
  const host = customDomain.value.trim().toLowerCase()
  if (!host)
    return ''
  if (host.startsWith('www.'))
    return host.slice(4).includes('.') ? host.slice(4) : ''
  return (host.match(/\./g) ?? []).length === 1 ? `www.${host}` : ''
})
const dnsTarget = 'sites.elev8-stays.com'

// ── Logo and favicon: previews of the picked file, only the name is saved ──
const previews = reactive<{ logoFile: string | null, faviconFile: string | null }>({ logoFile: null, faviconFile: null })
function pick(key: 'logoFile' | 'faviconFile', e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file)
    return
  previews[key] = URL.createObjectURL(file)
  patch({ [key]: file.name, ...(key === 'faviconFile' ? { useDefaultFavicon: false } : {}) })
}
function reset(key: 'logoFile' | 'faviconFile') {
  previews[key] = null
  patch({ [key]: null })
}
onBeforeUnmount(() => Object.values(previews).forEach(url => url && URL.revokeObjectURL(url)))

// ── Hero media: static (first photo), carousel (all photos, in order) or a video ──
const HERO_MODES: { value: HeroMode, label: string, icon: string }[] = [
  { value: 'static', label: 'Static', icon: 'lucide:image' },
  { value: 'carousel', label: 'Carousel', icon: 'lucide:images' },
  { value: 'video', label: 'Video', icon: 'lucide:video' },
]
const heroMode = computed(() => settings.value.heroMode ?? 'static')
const heroImages = computed(() => settings.value.heroImages ?? [])

function addHeroPhotos(e: Event) {
  const input = e.target as HTMLInputElement
  const added = Array.from(input.files ?? []).map(file => ({
    id: `hero-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: file.name,
    url: URL.createObjectURL(file),
  }))
  input.value = ''
  if (added.length)
    patch({ heroImages: [...heroImages.value, ...added] })
}
function removeHeroPhoto(id: string) {
  const gone = heroImages.value.find(i => i.id === id)
  if (gone)
    URL.revokeObjectURL(gone.url)
  patch({ heroImages: heroImages.value.filter(i => i.id !== id) })
}
function reorderHeroPhotos(images: typeof heroImages.value) {
  patch({ heroImages: images })
}
function pickHeroVideo(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file)
    patch({ heroVideoFile: file.name })
}

// ── Languages: the site and its blog are written in each of these ──
const languages = computed(() => settings.value.languages ?? ['en'])
const defaultLanguage = computed(() => settings.value.defaultLanguage ?? languages.value[0] ?? 'en')

function toggleLanguage(code: string) {
  if (languages.value.includes(code)) {
    // The site always keeps one language.
    if (languages.value.length === 1)
      return
    const next = languages.value.filter(c => c !== code)
    patch({ languages: next, defaultLanguage: defaultLanguage.value === code ? next[0] : defaultLanguage.value })
  }
  else {
    patch({ languages: [...languages.value, code], defaultLanguage: defaultLanguage.value })
  }
}

const canSave = computed(() => settings.value.name.trim() !== '' && address.value !== SITE_DOMAIN)
</script>

<template>
  <div class="mx-auto w-full max-w-3xl" data-testid="we-site-settings">
    <h3 class="text-xl font-semibold tracking-tight">
      Site settings
    </h3>
    <p class="mb-6 mt-1 text-sm text-muted-foreground">
      Update your site's name, branding and address. Changes go live with a re-render.
    </p>

    <!-- Identity -->
    <section class="mb-4 rounded-xl border bg-card p-5">
      <div class="text-sm font-semibold">
        Identity
      </div>
      <p class="mb-4 text-xs text-muted-foreground">
        The name and branding shown in the navbar, footer and browser tab.
      </p>

      <div class="space-y-2">
        <Label for="ss-title">Website title *</Label>
        <Input id="ss-title" :model-value="settings.name" placeholder="e.g. Villa Sunset Bali" @update:model-value="patch({ name: String($event) })" />
      </div>

      <div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div v-for="item in ([{ key: 'logoFile', label: 'Logo', accept: 'image/*', box: 'h-28', img: 'max-h-16 max-w-[80%]' }, { key: 'faviconFile', label: 'Favicon', accept: 'image/*,.ico', box: 'h-28', img: 'size-10' }] as const)" :key="item.key" class="space-y-1.5">
          <Label>{{ item.label }}</Label>
          <label
            class="relative flex cursor-pointer items-center justify-center overflow-hidden rounded-lg bg-muted/40"
            :class="[item.box, settings[item.key] ? 'border' : 'border-2 border-dashed']"
          >
            <img v-if="previews[item.key]" :src="previews[item.key]!" :alt="item.label" class="object-contain" :class="item.img">
            <Icon v-else :name="settings[item.key] ? 'lucide:image' : 'lucide:image-plus'" class="size-8 text-muted-foreground" aria-hidden="true" />
            <input type="file" :accept="item.accept" class="sr-only" :aria-label="`Upload ${item.label.toLowerCase()}`" @change="pick(item.key, $event)">
          </label>
          <p v-if="settings[item.key]" class="truncate text-xs text-muted-foreground">
            {{ settings[item.key] }}
          </p>
          <div class="flex items-center gap-3 text-xs">
            <label class="cursor-pointer font-semibold text-primary">
              {{ settings[item.key] ? 'Replace' : `Upload ${item.label.toLowerCase()}` }}
              <input type="file" :accept="item.accept" class="sr-only" @change="pick(item.key, $event)">
            </label>
            <button v-if="settings[item.key]" type="button" class="text-muted-foreground hover:text-foreground" @click="reset(item.key)">
              Reset
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- Hero media -->
    <section class="mb-4 rounded-xl border bg-card p-5" data-testid="ss-hero">
      <div class="text-sm font-semibold">
        Hero media
      </div>
      <p class="mb-4 text-xs text-muted-foreground">
        The first thing visitors see at the top of your homepage.
      </p>

      <div class="space-y-2">
        <Label>Display mode</Label>
        <div class="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Hero display mode">
          <button
            v-for="mode in HERO_MODES"
            :key="mode.value"
            type="button"
            role="radio"
            :aria-checked="heroMode === mode.value"
            class="flex items-center justify-center gap-1.5 rounded-lg border px-3 py-3 text-sm font-medium transition-colors"
            :class="heroMode === mode.value ? 'border-2 border-primary' : 'hover:border-muted-foreground/50'"
            :data-testid="`ss-hero-${mode.value}`"
            @click="patch({ heroMode: mode.value })"
          >
            <Icon :name="mode.icon" class="size-4" aria-hidden="true" />
            {{ mode.label }}
          </button>
        </div>
      </div>

      <div v-if="heroMode !== 'video'" class="mt-4" data-testid="ss-hero-photos">
        <div class="mb-2 text-xs text-muted-foreground">
          Photos ({{ heroImages.length }})
        </div>
        <p class="mb-3 flex items-center gap-1 text-xs text-muted-foreground">
          <Icon name="lucide:info" class="size-3.5" aria-hidden="true" />
          {{ heroMode === 'static' ? 'The first photo becomes the hero. Drag photos to reorder.' : 'Photos play in this order. Drag photos to reorder.' }}
        </p>
        <VueDraggable :model-value="heroImages" :animation="200" class="flex flex-wrap gap-3" @update:model-value="reorderHeroPhotos">
          <div v-for="(img, i) in heroImages" :key="img.id" class="group relative size-24 shrink-0 cursor-grab overflow-hidden rounded-lg border" data-testid="ss-hero-photo">
            <img :src="img.url" :alt="`Hero photo ${i + 1}`" class="size-full object-cover">
            <Badge v-if="heroMode === 'static' && i === 0" class="absolute left-1 top-1">
              Hero
            </Badge>
            <Button
              variant="secondary"
              size="icon-sm"
              class="absolute right-1 top-1 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
              :aria-label="`Remove hero photo ${i + 1}`"
              @click="removeHeroPhoto(img.id)"
            >
              <Icon name="lucide:trash-2" class="size-4" aria-hidden="true" />
            </Button>
          </div>
          <label class="flex size-24 shrink-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed text-muted-foreground transition-colors hover:border-primary">
            <Icon name="lucide:plus" class="size-5" aria-hidden="true" />
            <span class="text-xs">Add photo</span>
            <input type="file" accept="image/*" multiple class="sr-only" aria-label="Add hero photos" @change="addHeroPhotos">
          </label>
        </VueDraggable>
        <p class="mt-3 text-xs text-muted-foreground">
          JPG or PNG.
        </p>
      </div>

      <div v-else class="mt-4 space-y-2" data-testid="ss-hero-video-upload">
        <label class="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-colors hover:border-primary">
          <Icon name="lucide:video" class="size-8 text-muted-foreground" aria-hidden="true" />
          <div>
            <div class="text-sm font-medium">
              {{ settings.heroVideoFile ?? 'Upload video file' }}
            </div>
            <div class="mt-0.5 text-xs text-muted-foreground">
              {{ settings.heroVideoFile ? 'Click to replace' : 'Click to browse' }}
            </div>
          </div>
          <input type="file" accept="video/mp4,video/quicktime,video/webm" class="sr-only" aria-label="Upload hero video" @change="pickHeroVideo">
        </label>
        <p class="text-xs text-muted-foreground">
          Up to 3 minutes and 20 MB, MP4, MOV or WebM. The first photo stays as the poster while the video loads.
        </p>
      </div>
    </section>

    <!-- Languages -->
    <section class="mb-4 rounded-xl border bg-card p-5" data-testid="ss-languages">
      <div class="text-sm font-semibold">
        Languages
      </div>
      <p class="mb-4 text-xs text-muted-foreground">
        The site and its blog are available in each language you add. Use the star to choose the default.
      </p>

      <div class="flex flex-wrap gap-2">
        <template v-for="lang in LANGUAGE_OPTIONS" :key="lang.code">
          <div
            v-if="languages.includes(lang.code)"
            class="flex items-center gap-1 rounded-full border border-primary bg-primary/10 py-1 pl-1.5 pr-2.5 text-sm font-semibold"
            :data-testid="`ss-lang-${lang.code}`"
          >
            <button
              type="button"
              class="rounded-full p-1 hover:bg-primary/10"
              :aria-label="defaultLanguage === lang.code ? `${lang.label} is the default language` : `Set ${lang.label} as default language`"
              :aria-pressed="defaultLanguage === lang.code"
              @click="patch({ defaultLanguage: lang.code })"
            >
              <Icon name="lucide:star" class="size-3.5" :class="defaultLanguage === lang.code && 'fill-current text-primary'" aria-hidden="true" />
            </button>
            {{ lang.label }}
            <button
              type="button"
              class="rounded-full p-1 hover:bg-primary/10 disabled:opacity-40"
              :aria-label="`Remove ${lang.label}`"
              :disabled="languages.length === 1"
              @click="toggleLanguage(lang.code)"
            >
              <Icon name="lucide:x" class="size-3.5" aria-hidden="true" />
            </button>
          </div>
          <button
            v-else
            type="button"
            class="flex items-center gap-1 rounded-full border bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:border-muted-foreground/50"
            :data-testid="`ss-lang-${lang.code}`"
            :aria-label="`Add ${lang.label}`"
            @click="toggleLanguage(lang.code)"
          >
            <Icon name="lucide:plus" class="size-3.5" aria-hidden="true" />
            {{ lang.label }}
          </button>
        </template>
      </div>

      <div class="mt-4 flex cursor-pointer items-center gap-2" data-testid="ss-autodetect" @click="patch({ autoDetectLanguage: !settings.autoDetectLanguage })">
        <div
          class="flex size-4 items-center justify-center rounded-[4px] border"
          :class="settings.autoDetectLanguage ? 'border-primary bg-primary text-primary-foreground' : 'border-input'"
        >
          <Icon v-if="settings.autoDetectLanguage" name="lucide:check" class="size-3" />
        </div>
        <span class="text-sm">Auto-detect visitor language</span>
      </div>
      <p v-if="settings.autoDetectLanguage" class="mt-1.5 text-xs text-muted-foreground">
        If the visitor's browser language is one of these, the site opens in it. Otherwise it opens in the default.
      </p>
    </section>

    <!-- Address -->
    <section class="mb-4 rounded-xl border bg-card p-5">
      <div class="text-sm font-semibold">
        Address
      </div>
      <p class="mb-4 text-xs text-muted-foreground">
        Where your site is reachable: the platform subdomain and an optional custom domain.
      </p>

      <div class="space-y-2">
        <Label for="ss-subdomain">Subdomain</Label>
        <InputGroup>
          <InputGroupInput id="ss-subdomain" :model-value="subdomain" placeholder="Enter subdomain" @update:model-value="subdomain = String($event).toLowerCase().replace(/\s+/g, '-')" />
          <InputGroupAddon align="inline-end">
            <InputGroupText>{{ SITE_DOMAIN }}</InputGroupText>
          </InputGroupAddon>
        </InputGroup>
        <p v-if="subdomainChanged" class="text-xs text-warning" data-testid="ss-subdomain-warning">
          Changing the subdomain moves your site to a new address. It is re-rendered automatically when you save, so the new address serves your content.
        </p>
      </div>

      <div class="mt-4 space-y-2">
        <div class="flex items-center gap-2">
          <Label for="ss-custom">Custom domain</Label>
          <Badge v-if="customDomain.trim()" :variant="published ? 'default' : 'secondary'" data-testid="ss-domain-status">
            {{ published ? 'Active' : 'Pending' }}
          </Badge>
        </div>
        <Input id="ss-custom" :model-value="customDomain" placeholder="www.yourdomain.com" @update:model-value="customDomain = String($event)" />

        <div v-if="customDomain.trim()" class="rounded-lg border bg-muted/40 p-3" data-testid="ss-dns">
          <div class="mb-1.5 text-xs font-semibold">
            Add this DNS record at your domain provider
          </div>
          <div class="grid grid-cols-[auto_1fr_auto_1fr] items-center gap-x-2 gap-y-1 font-mono text-xs">
            <span class="font-semibold">CNAME</span>
            <span class="break-all">{{ customDomain.trim().toLowerCase() }}</span>
            <Icon name="lucide:arrow-right" class="size-3 text-muted-foreground" aria-hidden="true" />
            <span class="break-all">{{ dnsTarget }}</span>
            <template v-if="domainTwin">
              <span class="font-semibold">CNAME</span>
              <span class="break-all">{{ domainTwin }}</span>
              <Icon name="lucide:arrow-right" class="size-3 text-muted-foreground" aria-hidden="true" />
              <span class="break-all">{{ dnsTarget }}</span>
            </template>
          </div>
          <p class="mt-1.5 text-xs italic text-muted-foreground">
            DNS changes can take up to 24 hours to apply.
          </p>
        </div>
      </div>
    </section>

    <!-- Actions -->
    <div class="flex items-center justify-between gap-3">
      <span class="text-xs text-muted-foreground">Changes go live after a re-render.</span>
      <Button :disabled="!canSave || props.saving" data-testid="ss-save" @click="emit('save', subdomainChanged)">
        Save changes
      </Button>
    </div>

    <div v-if="saved" class="mt-4 flex items-center justify-between gap-3 rounded-xl border border-success/30 bg-success/10 p-4" data-testid="ss-saved">
      <div class="text-xs">
        Settings saved. Re-render to bake the new branding into the live site.
      </div>
      <Button variant="outline" size="sm" :disabled="rendering" @click="emit('rerender')">
        Re-render
      </Button>
    </div>
  </div>
</template>
