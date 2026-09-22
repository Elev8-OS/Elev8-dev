<script setup lang="ts">
import HeroSection from '~/components/sections/HeroSection.vue'
import WelcomeSection from '~/components/sections/WelcomeSection.vue'
import CheckinSection from '~/components/sections/CheckinSection.vue'
import CheckoutSection from '~/components/sections/CheckoutSection.vue'
import HouseRulesSection from '~/components/sections/HouseRulesSection.vue'
import AmenitiesSection from '~/components/sections/AmenitiesSection.vue'
import WifiSection from '~/components/sections/WifiSection.vue'
import LocalTipsSection from '~/components/sections/LocalTipsSection.vue'
import DocumentsSection from '~/components/sections/DocumentsSection.vue'
import UpsellsSection from '~/components/sections/UpsellsSection.vue'
import SmartLockSection from '~/components/sections/SmartLockSection.vue'
import PreArrivalSection from '~/components/sections/PreArrivalSection.vue'
import DamageProtectionSection from '~/components/sections/DamageProtectionSection.vue'
import CustomRichSection from '~/components/sections/CustomRichSection.vue'

import PreArrivalForm from '~/components/forms/PreArrivalForm.vue'
import DamageProtectionForm from '~/components/forms/DamageProtectionForm.vue'
import SmartLockPanel from '~/components/forms/SmartLockPanel.vue'
import LanguageSwitcher from '~/components/forms/LanguageSwitcher.vue'
import BrandHeader from '~/components/BrandHeader.vue'

const route = useRoute()
const token = computed(() => route.params.token as string)

const { fetchGuide, markOpened } = usePublicGuestGuide()
const { currentLang, setLanguage } = useAutoTranslate()

const { data, pending, error } = await useAsyncData(
  `guide-${token.value}`,
  async () => {
    const result = await fetchGuide(token.value)
    await markOpened(token.value)
    return result
  },
)

const guideBrandStyle = computed(() => data.value?.branding?.cssVariables ?? {})

useHead(() => ({
  link: [
    { rel: 'icon', href: data.value?.branding?.favicon?.dataUrl ?? '/favicon.ico' },
  ],
}))

// Push the language into the composable when the user switches.
watch(currentLang, (lang) => {
  setLanguage(lang)
})

// Display sections, sorted and filtered.
const visibleSections = computed(() => {
  if (!data.value?.guide?.sections) return []
  return data.value.guide.sections
    .filter((s: any) => s.enabled)
    .sort((a: any, b: any) => a.order - b.order)
})

// Smart section ordering: reorder by stay phase
// (pre = >24h before check-in, arrival = within 24h, stay = checked in)
const PHASE_ORDERS: Record<string, Record<string, number>> = {
  pre: { pre_arrival: 0, wifi: 1, house_rules: 2, amenities: 3, local_tips: 4, checkin: 5 },
  arrival: { smart_lock: 0, checkin: 1, house_rules: 2, wifi: 3, amenities: 4 },
  stay: { local_tips: 0, upsells: 1, documents: 2, checkout: 3 },
}

const phase = computed<'pre' | 'arrival' | 'stay'>(() => {
  if (!data.value?.checkIn) return 'pre'
  const checkIn = new Date(data.value.checkIn)
  const now = new Date()
  const hoursToCheckIn = (checkIn.getTime() - now.getTime()) / (1000 * 60 * 60)
  if (hoursToCheckIn > 24) return 'pre'
  if (hoursToCheckIn > -2) return 'arrival'
  return 'stay'
})

const sortedSections = computed(() => {
  if (!data.value?.guide?.sections) return []
  const smartOrdering = (data.value.guide as any).smartOrdering === true
  const sections = visibleSections.value
  if (!smartOrdering) return sections
  const phaseOrder = PHASE_ORDERS[phase.value]
  return [...sections].sort((a: any, b: any) => {
    const aOrder = phaseOrder[a.type] ?? 100
    const bOrder = phaseOrder[b.type] ?? 100
    if (aOrder === bOrder) return a.order - b.order
    return aOrder - bOrder
  })
})

const sectionComponentMap: Record<string, any> = {
  hero: HeroSection,
  welcome: WelcomeSection,
  checkin: CheckinSection,
  checkout: CheckoutSection,
  house_rules: HouseRulesSection,
  amenities: AmenitiesSection,
  wifi: WifiSection,
  local_tips: LocalTipsSection,
  documents: DocumentsSection,
  upsells: UpsellsSection,
  smart_lock: SmartLockSection,
  pre_arrival: PreArrivalSection,
  damage_protection: DamageProtectionSection,
  custom_rich: CustomRichSection,
}

function resolveSection(type: string) {
  // pre_arrival is handled inline (form is appended under the heading).
  if (type === 'pre_arrival') return PreArrivalSection
  return sectionComponentMap[type]
}

function handleUpsellAdd(serviceId: string) {
  // Phase 4 placeholder — wire to upsell order creation in a later phase.
  // eslint-disable-next-line no-alert
  alert(`Added upsell ${serviceId} (Phase 4 placeholder)`)
}
</script>

<template>
  <div class="min-h-screen bg-background text-foreground" :style="guideBrandStyle">
    <div class="mx-auto max-w-3xl p-4 md:p-6">
      <div v-if="pending" class="py-12 text-center text-muted-foreground">
        Loading your guide...
      </div>
      <div v-else-if="error" class="py-12 text-center">
        <h1 class="text-xl font-semibold">
          We couldn't find your guide
        </h1>
        <p class="mt-2 text-sm text-muted-foreground">
          Please check the link or contact your host.
        </p>
      </div>
      <div v-else-if="data">
        <BrandHeader :branding="data.branding" />

        <header class="mb-4 flex items-center justify-between">
          <div>
            <p class="text-xs uppercase tracking-wider text-muted-foreground">
              Guest guide
            </p>
            <h1 class="text-xl font-bold">
              {{ data.guide.title }}
            </h1>
          </div>
          <LanguageSwitcher v-model="currentLang" />
        </header>

        <p class="mb-6 text-sm text-muted-foreground">
          Welcome, {{ data.link.guestName }}!
        </p>

        <div class="space-y-6">
          <template v-for="section in sortedSections" :key="section.id">
            <!-- Pre-arrival section: render heading + inline form -->
            <div v-if="section.type === 'pre_arrival'" class="space-y-4">
              <PreArrivalSection :data="section.data" :listing="data.listing" />
              <div class="rounded-xl border bg-card p-6">
                <PreArrivalForm :token="token" :fields="section.data?.fields" />
              </div>
            </div>

            <!-- Damage protection: heading + the choice form, same shape as pre-arrival -->
            <div v-else-if="section.type === 'damage_protection'" class="space-y-4">
              <DamageProtectionSection :data="section.data" />
              <div class="rounded-xl border bg-card p-6">
                <DamageProtectionForm
                  :token="token"
                  :options="section.data?.options"
                  :terms-text="section.data?.termsText"
                  :rail="section.data?.rail"
                  :long-stay="section.data?.longStay"
                />
              </div>
            </div>

            <!-- Smart lock section: render heading + lock panel -->
            <div v-else-if="section.type === 'smart_lock'" class="space-y-4">
              <SmartLockSection :data="section.data" :listing="data.listing" :token="token" />
              <SmartLockPanel :token="token" />
            </div>

            <!-- Upsells: pass add handler down -->
            <UpsellsSection
              v-else-if="section.type === 'upsells'"
              :data="section.data"
              :listing="data.listing"
              :token="token"
              @add="handleUpsellAdd"
            />

            <!-- Default: section renderer -->
            <component
              :is="resolveSection(section.type)"
              v-else
              :data="section.data"
              :listing="data.listing"
              :token="token"
            />
          </template>
        </div>
      </div>
    </div>
  </div>
</template>
