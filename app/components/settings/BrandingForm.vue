<script setup lang="ts">
import type { BrandingAssetKind, GuestGuideBrandColors, TenantBranding } from '~/components/settings/data/branding'
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  cloneTenantBranding,
  createDefaultTenantBranding,
  isHexColor,
  normalizeHex,
  resolveButtonColor,
} from '~/components/settings/data/branding'
import { useTenantBranding } from '~/composables/useTenantBranding'
import { contrastRatio, getReadableForeground } from '~/lib/branding-colors'
import BrandingAssetField from './BrandingAssetField.vue'

const { branding, isHydrated, saveBranding, syncGuestGuideBranding } = useTenantBranding()
const draft = ref<TenantBranding>(cloneTenantBranding(branding.value))
const isSaving = ref(false)
const assetFieldKey = ref(0)
const assetErrors = ref<Record<BrandingAssetKind, boolean>>({
  primaryLogo: false,
  favicon: false,
  invoiceLogo: false,
})
const hasAppliedHydratedState = ref(false)

watch(isHydrated, (hydrated) => {
  if (!hydrated || hasAppliedHydratedState.value)
    return
  draft.value = cloneTenantBranding(branding.value)
  hasAppliedHydratedState.value = true
}, { immediate: true, flush: 'sync' })

const colorFields: Array<{ key: keyof GuestGuideBrandColors, label: string, description: string, testId: string }> = [
  { key: 'primary', label: 'Primary color', description: 'Buttons, active states, icons, and accents.', testId: 'primary' },
  { key: 'background', label: 'Background color', description: 'Guest Guide page and card surfaces.', testId: 'background' },
  { key: 'text', label: 'Text color', description: 'Guest Guide headings and body text.', testId: 'text' },
]

function comparable(value: TenantBranding) {
  return { ...cloneTenantBranding(value), updatedAt: '' }
}

const isDirty = computed(() => JSON.stringify(comparable(draft.value)) !== JSON.stringify(comparable(branding.value)))
const colorErrors = computed(() => {
  const errors = {} as Record<keyof GuestGuideBrandColors, string>
  for (const field of colorFields) {
    errors[field.key] = isHexColor(draft.value.guestGuideColors[field.key])
      ? ''
      : 'Use a six-digit hex value such as #18181B.'
  }
  return errors
})
const buttonColorError = computed(() =>
  isHexColor(draft.value.buttonColor) ? '' : 'Use a six-digit hex value such as #F6BB12.')
const previewButtonColor = computed(() => resolveButtonColor(draft.value))
const hasBlockingError = computed(() =>
  Object.values(colorErrors.value).some(Boolean)
  || Boolean(buttonColorError.value)
  || Object.values(assetErrors.value).some(Boolean),
)
const hasContrastWarning = computed(() => {
  const { background, text } = draft.value.guestGuideColors
  return isHexColor(background) && isHexColor(text) && contrastRatio(background, text) < 4.5
})
const canSave = computed(() => isDirty.value && !hasBlockingError.value && !isSaving.value)

function setColor(key: keyof GuestGuideBrandColors, value: string) {
  draft.value = {
    ...draft.value,
    guestGuideColors: { ...draft.value.guestGuideColors, [key]: value },
  }
}

function setButtonColor(value: string) {
  draft.value = { ...draft.value, buttonColor: value }
}

function setAssetError(kind: BrandingAssetKind, hasError: boolean) {
  assetErrors.value = { ...assetErrors.value, [kind]: hasError }
}

function resetDraft() {
  draft.value = createDefaultTenantBranding()
  assetErrors.value = { primaryLogo: false, favicon: false, invoiceLogo: false }
  assetFieldKey.value++
}

async function retrySync() {
  if (await syncGuestGuideBranding())
    toast.success('Guest Guide branding synchronized')
  else toast.error('Guest Guide branding is still unavailable')
}

async function handleSave() {
  if (!canSave.value)
    return
  isSaving.value = true
  try {
    const normalized: TenantBranding = {
      ...cloneTenantBranding(draft.value),
      guestGuideColors: {
        primary: normalizeHex(draft.value.guestGuideColors.primary),
        background: normalizeHex(draft.value.guestGuideColors.background),
        text: normalizeHex(draft.value.guestGuideColors.text),
      },
      buttonColor: normalizeHex(draft.value.buttonColor ?? ''),
    }
    const result = await saveBranding(normalized)

    if (!result.saved) {
      toast.error(result.error ?? 'Branding could not be saved')
      return
    }

    draft.value = cloneTenantBranding(branding.value)
    if (result.synced) {
      toast.success('Branding saved')
      return
    }

    toast.info('Branding saved locally, but the Guest Guide could not be updated.', {
      action: { label: 'Retry', onClick: retrySync },
    })
  }
  catch {
    toast.error('Branding could not be saved')
  }
  finally {
    isSaving.value = false
  }
}
</script>

<template>
  <div>
    <h3 class="text-lg font-medium">
      Branding
    </h3>
    <p class="text-sm text-muted-foreground">
      Customize how your brand appears in the dashboard, Guest Guide, and invoices.
    </p>
  </div>
  <Separator />

  <div>
    <div class="max-w-2xl space-y-6">
      <section class="space-y-4">
        <div>
          <h4 class="font-medium">
            Brand assets
          </h4>
          <p class="text-sm text-muted-foreground">
            Upload images for each branded surface.
          </p>
        </div>
        <BrandingAssetField :key="`primary-${assetFieldKey}`" v-model="draft.primaryLogo" kind="primaryLogo" label="Primary logo" description="PNG, JPEG, or WebP up to 1 MB. Recommended: 400 × 120 px." @validation-change="setAssetError('primaryLogo', $event)" />
        <BrandingAssetField :key="`favicon-${assetFieldKey}`" v-model="draft.favicon" kind="favicon" label="Favicon" description="PNG or ICO up to 512 KB. Recommended: 32 × 32 px or 64 × 64 px." @validation-change="setAssetError('favicon', $event)" />
        <BrandingAssetField :key="`invoice-${assetFieldKey}`" v-model="draft.invoiceLogo" kind="invoiceLogo" label="Invoice logo" description="PNG, JPEG, or WebP up to 1 MB. Recommended: 400 × 120 px." :fallback-label="draft.primaryLogo ? 'Using primary logo' : 'Using Elev8 default'" @validation-change="setAssetError('invoiceLogo', $event)" />
      </section>

      <section class="space-y-4 rounded-lg border bg-card p-5">
        <div>
          <h4 class="font-medium">
            Guest Guide colors
          </h4>
          <p class="text-sm text-muted-foreground">
            These colors do not affect the dashboard or invoices.
          </p>
        </div>
        <div v-for="field in colorFields" :key="field.key" class="space-y-2">
          <Label :for="`${field.key}-hex`">{{ field.label }}</Label>
          <p class="text-xs text-muted-foreground">
            {{ field.description }}
          </p>
          <div class="flex gap-2">
            <input
              :aria-label="`${field.label} picker`"
              type="color"
              :value="isHexColor(draft.guestGuideColors[field.key]) ? draft.guestGuideColors[field.key] : '#000000'"
              class="size-10 shrink-0 cursor-pointer rounded-md border bg-background p-1"
              @input="setColor(field.key, ($event.target as HTMLInputElement).value.toUpperCase())"
            >
            <Input
              :id="`${field.key}-hex`"
              :data-testid="`${field.testId}-hex-input`"
              :model-value="draft.guestGuideColors[field.key]"
              maxlength="7"
              class="font-mono uppercase"
              @update:model-value="setColor(field.key, String($event))"
            />
          </div>
          <p v-if="colorErrors[field.key]" role="alert" class="text-sm text-destructive">
            {{ colorErrors[field.key] }}
          </p>
        </div>
        <div v-if="hasContrastWarning" role="status" class="flex gap-2 rounded-md border bg-muted/40 p-3 text-sm">
          <Icon name="lucide:triangle-alert" class="mt-0.5 size-4 shrink-0" />
          <span>Text and background contrast is below WCAG AA (4.5:1). You can still save, but some guests may find the guide difficult to read.</span>
        </div>
      </section>

      <section class="space-y-2 rounded-lg border bg-card p-5">
        <div>
          <h4 class="font-medium">
            Button color
          </h4>
          <p class="text-sm text-muted-foreground">
            The color of your main action buttons. The label turns black or white to stay readable.
          </p>
        </div>
        <Label for="button-hex">Button color</Label>
        <div class="flex gap-2">
          <input
            aria-label="Button color picker"
            type="color"
            :value="previewButtonColor"
            class="size-10 shrink-0 cursor-pointer rounded-md border bg-background p-1"
            @input="setButtonColor(($event.target as HTMLInputElement).value.toUpperCase())"
          >
          <Input
            id="button-hex"
            data-testid="button-hex-input"
            :model-value="draft.buttonColor"
            maxlength="7"
            class="font-mono uppercase"
            @update:model-value="setButtonColor(String($event))"
          />
        </div>
        <p v-if="buttonColorError" role="alert" class="text-sm text-destructive">
          {{ buttonColorError }}
        </p>
        <span
          class="inline-flex h-9 items-center rounded-md px-4 text-sm font-medium shadow-xs"
          :style="{ backgroundColor: previewButtonColor, color: getReadableForeground(previewButtonColor) }"
        >
          Preview button
        </span>
      </section>

      <div class="flex flex-wrap gap-2">
        <Button data-testid="save-branding" type="button" :disabled="!canSave" @click="handleSave">
          <Icon v-if="isSaving" name="lucide:loader-2" class="mr-2 size-4 animate-spin" />
          Save changes
        </Button>
        <Button
          data-testid="reset-branding"
          type="button"
          variant="outline"
          @click="resetDraft"
        >
          Reset to Elev8 defaults
        </Button>
      </div>
    </div>
  </div>
</template>
