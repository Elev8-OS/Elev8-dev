<script setup lang="ts">
import type { GuestGuideBrandColors, TenantBranding } from '~/components/settings/data/branding'
import SettingsBrandingAssetField from '~/components/settings/BrandingAssetField.vue'
import SettingsBrandingPreview from '~/components/settings/BrandingPreview.vue'
import {
  cloneTenantBranding,
  isHexColor,
  normalizeHex,
} from '~/components/settings/data/branding'
import { contrastRatio } from '~/lib/branding-colors'

const emit = defineEmits<{ (e: 'next'): void, (e: 'back'): void }>()

const { state, saveBranding } = useOnboarding()
const { branding, saveBranding: persistBranding } = useTenantBranding()

const draft = ref<TenantBranding>(cloneTenantBranding(branding.value))
const isSaving = ref(false)
const assetErrors = ref({ primaryLogo: false, favicon: false, invoiceLogo: false })

// Initialize with onboarding state actionColor if set
if (state.value.actionColor && isHexColor(state.value.actionColor)) {
  draft.value.guestGuideColors.primary = normalizeHex(state.value.actionColor)
}

const colorFields: Array<{ key: keyof GuestGuideBrandColors, label: string, description: string }> = [
  { key: 'primary', label: 'Primary color', description: 'Used for buttons, links, and accents.' },
  { key: 'background', label: 'Background color', description: 'Used for guest guide and card surfaces.' },
  { key: 'text', label: 'Text color', description: 'Used for headings and readable body text.' },
]

function setColor(key: keyof GuestGuideBrandColors, value: string) {
  draft.value.guestGuideColors[key] = value
}

const hasContrastWarning = computed(() => {
  const { background, text } = draft.value.guestGuideColors
  return isHexColor(background) && isHexColor(text) && contrastRatio(background, text) < 4.5
})

async function persist(): Promise<void> {
  isSaving.value = true
  const normalized: TenantBranding = {
    ...cloneTenantBranding(draft.value),
    guestGuideColors: {
      primary: isHexColor(draft.value.guestGuideColors.primary) ? normalizeHex(draft.value.guestGuideColors.primary) : '#F6BB12',
      background: isHexColor(draft.value.guestGuideColors.background) ? normalizeHex(draft.value.guestGuideColors.background) : '#FFFFFF',
      text: isHexColor(draft.value.guestGuideColors.text) ? normalizeHex(draft.value.guestGuideColors.text) : '#18181B',
    },
  }
  await persistBranding(normalized)
  isSaving.value = false
}

async function onContinue(): Promise<void> {
  await persist()
  saveBranding(draft.value.guestGuideColors.primary)
  emit('next')
}
</script>

<template>
  <form id="ob-branding-form" class="flex flex-col gap-6" @submit.prevent="onContinue">
    <div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,400px)]">
      <!-- Left: Asset and Color controls from Settings Branding -->
      <div class="space-y-6">
        <!-- Brand Assets -->
        <section class="space-y-4">
          <div>
            <h4 class="text-sm font-semibold text-foreground">
              Brand assets
            </h4>
            <p class="text-xs text-muted-foreground">
              Upload logo and icon assets for your dashboard, guest guide, and invoices.
            </p>
          </div>
          <SettingsBrandingAssetField
            v-model="draft.primaryLogo"
            kind="primaryLogo"
            label="Primary logo"
            description="PNG, JPEG, or WebP up to 1 MB. Recommended: 400 × 120 px."
            @validation-change="assetErrors.primaryLogo = $event"
          />
          <SettingsBrandingAssetField
            v-model="draft.favicon"
            kind="favicon"
            label="Favicon"
            description="PNG or ICO up to 512 KB. Recommended: 32 × 32 px."
            @validation-change="assetErrors.favicon = $event"
          />
          <SettingsBrandingAssetField
            v-model="draft.invoiceLogo"
            kind="invoiceLogo"
            label="Invoice logo"
            description="PNG, JPEG, or WebP up to 1 MB. Recommended: 400 × 120 px."
            :fallback-label="draft.primaryLogo ? 'Using primary logo' : 'Using ELEV8 default'"
            @validation-change="assetErrors.invoiceLogo = $event"
          />
        </section>

        <!-- Brand Colors -->
        <section class="space-y-4 rounded-xl border border-border/80 bg-card p-5 shadow-xs">
          <div>
            <h4 class="text-sm font-semibold text-foreground">
              Brand colors
            </h4>
            <p class="text-xs text-muted-foreground">
              Colors applied to your guest guide and customer-facing pages.
            </p>
          </div>

          <div v-for="field in colorFields" :key="field.key" class="space-y-1.5">
            <Label :for="`ob-brand-${field.key}`" class="text-xs font-medium">{{ field.label }}</Label>
            <p class="text-[11px] text-muted-foreground">
              {{ field.description }}
            </p>
            <div class="flex gap-2">
              <input
                :id="`ob-brand-${field.key}`"
                type="color"
                :value="isHexColor(draft.guestGuideColors[field.key]) ? draft.guestGuideColors[field.key] : '#000000'"
                class="size-9 shrink-0 cursor-pointer rounded-md border bg-background p-1"
                :aria-label="`${field.label} picker`"
                @input="setColor(field.key, ($event.target as HTMLInputElement).value.toUpperCase())"
              >
              <Input
                :model-value="draft.guestGuideColors[field.key]"
                maxlength="7"
                class="font-mono uppercase text-xs"
                @update:model-value="setColor(field.key, String($event))"
              />
            </div>
          </div>

          <div v-if="hasContrastWarning" class="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700">
            <Icon name="lucide:triangle-alert" class="mt-0.5 size-4 shrink-0" />
            <span>Text and background contrast is low. Some guests may find the guide difficult to read.</span>
          </div>
        </section>
      </div>

      <!-- Right: Live Preview from Settings Branding -->
      <div class="min-w-0">
        <div class="sticky top-6">
          <SettingsBrandingPreview :branding="draft" />
        </div>
      </div>
    </div>
  </form>
</template>
