<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue'
import type { TenantProfile } from '~/components/onboarding/data/onboarding'
import { nextTick } from 'vue'
import {
  COUNTRY_OPTIONS,
  countryByCode,
  createDefaultProfile,
  CURRENCY_OPTIONS,
  LANGUAGE_OPTIONS,
  TIMEZONE_OPTIONS,
} from '~/components/onboarding/data/onboarding'

const emit = defineEmits<{ (e: 'next'): void }>()

const { state, saveProfile } = useOnboarding()

const draft = ref<TenantProfile>({ ...createDefaultProfile(), ...state.value.profile })
const errors = ref<Record<string, string>>({})

/**
 * The dial code is picked separately so the stored value stays E.164. The picker
 * holds a country, not a dial code, since several countries share one (+1, +44, +7).
 */
const phoneCountry = ref(derivePhoneCountry(draft.value.phoneNumber))
const dialCode = computed(() => countryByCode(phoneCountry.value)?.dialCode ?? '+62')
const localNumber = ref(draft.value.phoneNumber.replace(dialCode.value, ''))

function flagUrl(code: string): string {
  return `https://hatscripts.github.io/circle-flags/flags/${code.toLowerCase()}.svg`
}

function derivePhoneCountry(phone: string): string {
  const own = countryByCode(draft.value.country)
  if (own && phone.startsWith(own.dialCode))
    return own.code
  const match = COUNTRY_OPTIONS.find(c => phone.startsWith(c.dialCode))
  return match?.code ?? 'ID'
}

/** Shows the offset and zone name next to the IANA id, sorted west to east. */
function timezoneInfo(tz: string): { offset: string, minutes: number, name: string } {
  const now = new Date()
  const part = (style: 'longOffset' | 'long') =>
    new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: style })
      .formatToParts(now)
      .find(p => p.type === 'timeZoneName')
      ?.value ?? ''
  const offset = part('longOffset') === 'GMT' ? 'GMT+00:00' : part('longOffset')
  const [, sign, h, m] = offset.match(/([+-])(\d{2}):(\d{2})/) ?? []
  const minutes = sign ? (Number(h) * 60 + Number(m)) * (sign === '-' ? -1 : 1) : 0
  return { offset, minutes, name: part('long') }
}

const timezoneOptions = TIMEZONE_OPTIONS
  .map(tz => ({ value: tz, ...timezoneInfo(tz) }))
  .sort((a, b) => a.minutes - b.minutes || a.value.localeCompare(b.value))

/** The select trigger only copies item text, so flags and offsets are rendered here. */
const selectedCountry = computed(() => countryByCode(draft.value.country))
const selectedPhoneCountry = computed(() => countryByCode(phoneCountry.value))
const selectedTimezone = computed(() => timezoneOptions.find(tz => tz.value === draft.value.timezone))

const phoneInput = ref<ComponentPublicInstance | null>(null)

/** Typed letters never reach the field. */
function onPhoneBeforeInput(event: InputEvent): void {
  if (event.inputType === 'insertText' && event.data && /\D/.test(event.data))
    event.preventDefault()
}

// Paste and autofill skip the check above, so strip here and force the field to match.
watch(localNumber, (value) => {
  const digits = value.replace(/\D/g, '')
  if (digits === value)
    return
  localNumber.value = digits
  nextTick(() => {
    const el = phoneInput.value?.$el as HTMLInputElement | undefined
    if (el && el.value !== digits)
      el.value = digits
  })
})

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
  phoneCountry.value = country.code
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
            <SelectValue placeholder="Select a country">
              <span v-if="selectedCountry" class="flex items-center gap-2">
                <img :src="flagUrl(selectedCountry.code)" alt="" class="size-4 shrink-0 rounded-full">
                {{ selectedCountry.name }}
              </span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="c in COUNTRY_OPTIONS" :key="c.code" :value="c.code">
              <img :src="flagUrl(c.code)" alt="" class="size-4 shrink-0 rounded-full">
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
            <SelectValue placeholder="Select a timezone">
              <span v-if="selectedTimezone" class="flex min-w-0 items-center gap-2">
                <span class="shrink-0 tabular-nums text-muted-foreground">{{ selectedTimezone.offset }}</span>
                <span class="truncate">{{ selectedTimezone.value }}</span>
              </span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="tz in timezoneOptions" :key="tz.value" :value="tz.value">
              <span class="shrink-0 tabular-nums text-muted-foreground">{{ tz.offset }}</span>
              <span class="shrink-0">{{ tz.value }}</span>
              <span class="truncate text-muted-foreground">{{ tz.name }}</span>
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
          <Select v-model="phoneCountry">
            <SelectTrigger id="ob-phone-code" class="w-32" aria-label="Country calling code">
              <SelectValue>
                <span v-if="selectedPhoneCountry" class="flex items-center gap-2">
                  <img :src="flagUrl(selectedPhoneCountry.code)" alt="" class="size-4 shrink-0 rounded-full">
                  {{ selectedPhoneCountry.dialCode }} {{ selectedPhoneCountry.code }}
                </span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="c in COUNTRY_OPTIONS" :key="c.code" :value="c.code">
                <img :src="flagUrl(c.code)" alt="" class="size-4 shrink-0 rounded-full">
                {{ c.dialCode }} {{ c.code }}
              </SelectItem>
            </SelectContent>
          </Select>
          <Input
            id="ob-phone"
            ref="phoneInput"
            v-model="localNumber"
            type="tel"
            autocomplete="tel-national"
            class="flex-1"
            inputmode="numeric"
            placeholder="81234567890"
            :aria-invalid="Boolean(errors.phoneNumber)"
            @beforeinput="onPhoneBeforeInput"
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
