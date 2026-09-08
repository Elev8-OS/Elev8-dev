<script setup lang="ts">
import type { TenantProfile } from '~/components/onboarding/data/onboarding'
import { toast } from 'vue-sonner'
import {
  COUNTRY_OPTIONS,
  countryByCode,
  createDefaultProfile,
  CURRENCY_OPTIONS,
  LANGUAGE_OPTIONS,
  TIMEZONE_OPTIONS,
} from '~/components/onboarding/data/onboarding'
import { cloneTenantBranding } from '~/components/settings/data/branding'
import { useTenantBranding } from '~/composables/useTenantBranding'
import { fileToBrandingAsset } from '~/lib/branding-assets'

const emit = defineEmits<{ (e: 'next'): void }>()

const { state, saveProfile } = useOnboarding()
const { branding, saveBranding: persistBranding } = useTenantBranding()

const draft = ref<TenantProfile>({ ...createDefaultProfile(), ...state.value.profile })
const errors = ref<Record<string, string>>({})

// If a branding logo is already stored in settings, keep draft in sync
if (!draft.value.logoUrl && branding.value.primaryLogo?.dataUrl) {
  draft.value.logoUrl = branding.value.primaryLogo.dataUrl
}

const logoFileInput = ref<HTMLInputElement | null>(null)
const isUploadingLogo = ref(false)
const logoPreview = computed(() => draft.value.logoUrl || branding.value.primaryLogo?.dataUrl || '')

async function onLogoSelected(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file)
    return
  isUploadingLogo.value = true
  try {
    const asset = await fileToBrandingAsset(file, 'primaryLogo')
    draft.value.logoUrl = asset.dataUrl
    await persistBranding({
      ...cloneTenantBranding(branding.value),
      primaryLogo: asset,
    })
    toast.success('Logo uploaded successfully')
  }
  catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to upload logo'
    toast.error(message)
  }
  finally {
    isUploadingLogo.value = false
  }
}

async function removeLogo(): Promise<void> {
  draft.value.logoUrl = ''
  await persistBranding({
    ...cloneTenantBranding(branding.value),
    primaryLogo: null,
  })
  toast.info('Logo removed')
}

/** The dial code is picked separately so the stored value stays E.164. */
const dialCode = ref(deriveDialCode(draft.value.phoneNumber))
const localNumber = ref(draft.value.phoneNumber.replace(dialCode.value, ''))

function deriveDialCode(phone: string): string {
  const match = COUNTRY_OPTIONS.find(c => phone.startsWith(c.dialCode))
  return match?.dialCode ?? '+62'
}

watch([dialCode, localNumber], () => {
  draft.value.phoneNumber = `${dialCode.value}${localNumber.value.replace(/\D/g, '')}`
})

/**
 * Country fills currency, timezone, and language. The tenant can still change any
 * one afterwards (PRD 6.3). Only defaults are written, never an override of a
 * value the tenant has already touched by hand.
 */
const currencyTouched = ref(Boolean(draft.value.operatingCurrency))
const timezoneTouched = ref(Boolean(draft.value.timezone))
const languageTouched = ref(Boolean(draft.value.language && draft.value.language !== 'en'))

function onCountryChange(code: string): void {
  draft.value.country = code
  const country = countryByCode(code)
  if (!country)
    return
  dialCode.value = country.dialCode
  if (!currencyTouched.value)
    draft.value.operatingCurrency = country.currency
  if (!timezoneTouched.value)
    draft.value.timezone = country.timezone
  if (!languageTouched.value && country.language)
    draft.value.language = country.language
}

function submit(): void {
  const result = saveProfile(draft.value)
  errors.value = result.errors
  if (result.saved)
    emit('next')
}
</script>

<template>
  <form id="ob-profile-form" class="flex flex-col gap-6" @submit.prevent="submit">
    <!-- Centered Logo Upload Component at the top -->
    <div class="flex flex-col items-center justify-center gap-2 pb-1">
      <div class="relative">
        <input
          ref="logoFileInput"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          aria-label="Upload brand logo"
          class="hidden"
          @change="onLogoSelected"
        >

        <!-- Preview when logo is uploaded -->
        <div
          v-if="logoPreview"
          class="group relative flex size-24 sm:size-28 items-center justify-center overflow-hidden rounded-2xl border border-border/80 bg-background p-2 shadow-xs transition-all hover:border-primary/60"
        >
          <img
            :src="logoPreview"
            alt="Brand logo"
            class="max-h-full max-w-full object-contain"
          >
          <!-- Hover overlay to change logo -->
          <button
            type="button"
            class="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100 cursor-pointer"
            @click="logoFileInput?.click()"
          >
            <Icon name="lucide:camera" class="size-4" />
            <span class="text-[10px] font-medium">Change</span>
          </button>
          <!-- Delete button -->
          <button
            type="button"
            class="absolute right-1.5 top-1.5 z-10 flex size-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-xs transition-transform hover:scale-110 cursor-pointer"
            aria-label="Remove logo"
            @click.stop="removeLogo"
          >
            <Icon name="lucide:x" class="size-3" />
          </button>
        </div>

        <!-- Upload trigger when no logo -->
        <button
          v-else
          type="button"
          class="group flex size-24 sm:size-28 flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-border/80 bg-muted/20 p-2 text-center shadow-xs transition-all hover:border-primary/60 hover:bg-muted/40 cursor-pointer"
          :disabled="isUploadingLogo"
          @click="logoFileInput?.click()"
        >
          <Icon
            :name="isUploadingLogo ? 'lucide:loader-2' : 'lucide:image-plus'"
            class="size-7 text-muted-foreground transition-colors group-hover:text-primary stroke-[1.5]"
            :class="[isUploadingLogo && 'animate-spin']"
          />
          <span class="text-xs font-medium leading-tight text-muted-foreground transition-colors group-hover:text-foreground">
            {{ isUploadingLogo ? 'Uploading' : 'Upload logo' }}
          </span>
          <span class="text-[10px] text-muted-foreground/70">PNG, JPG, WebP</span>
        </button>
      </div>
      <p class="text-xs text-muted-foreground">
        Brand or property logo
      </p>
    </div>

    <!-- Company Name, Brand Name, and Email -->
    <div class="grid gap-4 sm:grid-cols-2">
      <div class="grid gap-1.5">
        <Label for="ob-company" class="text-xs font-medium">Company name</Label>
        <Input
          id="ob-company"
          v-model="draft.companyName"
          placeholder="e.g. PT ELEV8 Hospitality"
          :aria-invalid="Boolean(errors.companyName)"
        />
        <p v-if="errors.companyName" class="text-xs text-destructive">
          {{ errors.companyName }}
        </p>
      </div>

      <div class="grid gap-1.5">
        <Label for="ob-brand" class="text-xs font-medium">Brand name</Label>
        <Input
          id="ob-brand"
          v-model="draft.brandName"
          placeholder="e.g. ELEV8 Bali"
          :aria-invalid="Boolean(errors.brandName)"
        />
        <p v-if="errors.brandName" class="text-xs text-destructive">
          {{ errors.brandName }}
        </p>
      </div>

      <div class="grid gap-1.5 sm:col-span-2">
        <Label for="ob-email" class="text-xs font-medium">Account email</Label>
        <Input
          id="ob-email"
          :model-value="state.email || 'owner@example.com'"
          disabled
          class="bg-muted/30 text-muted-foreground cursor-not-allowed"
        />
      </div>
    </div>

    <!-- Form grid with Country & Language at the top to auto-populate beneath -->
    <div class="grid gap-4 sm:grid-cols-2">
      <!-- Row 1: Country & Language -->
      <div class="grid gap-1.5">
        <Label for="ob-country" class="text-xs font-medium">Country</Label>
        <Select :model-value="draft.country" @update:model-value="(v) => onCountryChange(String(v))">
          <SelectTrigger id="ob-country" :aria-invalid="Boolean(errors.country)">
            <SelectValue placeholder="Select a country" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="c in COUNTRY_OPTIONS" :key="c.code" :value="c.code">
              {{ c.name }}
            </SelectItem>
          </SelectContent>
        </Select>
        <p v-if="errors.country" class="text-xs text-destructive">
          {{ errors.country }}
        </p>
      </div>

      <div class="grid gap-1.5">
        <Label for="ob-language" class="text-xs font-medium">Language</Label>
        <Select
          :model-value="draft.language || 'en'"
          @update:model-value="(v) => { draft.language = String(v); languageTouched = true }"
        >
          <SelectTrigger id="ob-language">
            <SelectValue placeholder="Select language" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="lang in LANGUAGE_OPTIONS" :key="lang.code" :value="lang.code">
              {{ lang.name }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <!-- Row 2: Operating currency & Timezone -->
      <div class="grid gap-1.5">
        <Label for="ob-currency" class="text-xs font-medium">Operating currency</Label>
        <Select
          :model-value="draft.operatingCurrency"
          @update:model-value="(v) => { draft.operatingCurrency = String(v); currencyTouched = true }"
        >
          <SelectTrigger id="ob-currency" :aria-invalid="Boolean(errors.operatingCurrency)">
            <SelectValue placeholder="Select a currency" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="code in CURRENCY_OPTIONS" :key="code" :value="code">
              {{ code }}
            </SelectItem>
          </SelectContent>
        </Select>
        <p v-if="errors.operatingCurrency" class="text-xs text-destructive">
          {{ errors.operatingCurrency }}
        </p>
      </div>

      <div class="grid gap-1.5">
        <Label for="ob-timezone" class="text-xs font-medium">Timezone</Label>
        <Select
          :model-value="draft.timezone"
          @update:model-value="(v) => { draft.timezone = String(v); timezoneTouched = true }"
        >
          <SelectTrigger id="ob-timezone" :aria-invalid="Boolean(errors.timezone)">
            <SelectValue placeholder="Select a timezone" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="tz in TIMEZONE_OPTIONS" :key="tz" :value="tz">
              {{ tz }}
            </SelectItem>
          </SelectContent>
        </Select>
        <p v-if="errors.timezone" class="text-xs text-destructive">
          {{ errors.timezone }}
        </p>
      </div>

      <!-- Row 3: Phone number & Website -->
      <div class="grid gap-1.5">
        <Label for="ob-phone" class="text-xs font-medium">Phone number</Label>
        <div class="flex gap-2">
          <Select v-model="dialCode">
            <SelectTrigger id="ob-phone-code" class="w-28" aria-label="Country calling code">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="c in COUNTRY_OPTIONS" :key="c.code" :value="c.dialCode">
                {{ c.dialCode }} {{ c.code }}
              </SelectItem>
            </SelectContent>
          </Select>
          <Input
            id="ob-phone"
            v-model="localNumber"
            class="flex-1"
            inputmode="numeric"
            placeholder="81234567890"
            :aria-invalid="Boolean(errors.phoneNumber)"
          />
        </div>
        <p v-if="errors.phoneNumber" class="text-xs text-destructive">
          {{ errors.phoneNumber }}
        </p>
      </div>

      <div class="grid gap-1.5">
        <Label for="ob-website" class="text-xs font-medium">
          Website <span class="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id="ob-website"
          v-model="draft.website"
          placeholder="https://yourcompany.com"
          :aria-invalid="Boolean(errors.website)"
        />
        <p v-if="errors.website" class="text-xs text-destructive">
          {{ errors.website }}
        </p>
      </div>

      <!-- Row 4: Street address & City -->
      <div class="grid gap-1.5">
        <Label for="ob-address" class="text-xs font-medium">Street address</Label>
        <Input
          id="ob-address"
          v-model="draft.addressLine"
          placeholder="e.g. Jl. Raya Pantai Batu Bolong No. 10"
          :aria-invalid="Boolean(errors.addressLine)"
        />
        <p v-if="errors.addressLine" class="text-xs text-destructive">
          {{ errors.addressLine }}
        </p>
      </div>

      <div class="grid gap-1.5">
        <Label for="ob-city" class="text-xs font-medium">City</Label>
        <Input
          id="ob-city"
          v-model="draft.city"
          placeholder="e.g. Canggu or Badung"
          :aria-invalid="Boolean(errors.city)"
        />
        <p v-if="errors.city" class="text-xs text-destructive">
          {{ errors.city }}
        </p>
      </div>

      <!-- Row 5: Zip / Postal code -->
      <div class="grid gap-1.5">
        <Label for="ob-zip" class="text-xs font-medium">Zip / Postal code</Label>
        <Input
          id="ob-zip"
          v-model="draft.zipCode"
          placeholder="e.g. 80361"
          :aria-invalid="Boolean(errors.zipCode)"
        />
        <p v-if="errors.zipCode" class="text-xs text-destructive">
          {{ errors.zipCode }}
        </p>
      </div>
    </div>
  </form>
</template>
