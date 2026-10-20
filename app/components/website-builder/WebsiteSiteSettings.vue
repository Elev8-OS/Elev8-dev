<script setup lang="ts">
import type { WebsiteSettings } from '~/components/website-builder/steps/SettingsStep.vue'
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { SITE_DOMAIN, slugify } from '~/components/website-builder/data/wizard'

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

const canSave = computed(() => settings.value.name.trim() !== '' && address.value !== SITE_DOMAIN)
</script>

<template>
  <div class="max-w-2xl" data-testid="we-site-settings">
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
