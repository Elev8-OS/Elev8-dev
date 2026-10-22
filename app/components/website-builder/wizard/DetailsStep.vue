<script setup lang="ts">
import type { WebsiteRuleSet } from '~/components/channels/data/website-channel'
import type { WizardAnswers } from '~/components/website-builder/data/wizard'
import type { ReviewSelection } from '~/components/website-builder/steps/ReviewStep.vue'
import type { WebsiteSettings } from '~/components/website-builder/steps/SettingsStep.vue'
import { ruleSetIssues } from '~/components/channels/data/website-channel'
import WebsiteRuleSetForm from '~/components/channels/WebsiteRuleSetForm.vue'
import {
  checkCustomDomain,
  checkSubdomain,
  META_DESCRIPTION_MAX,
  SEO_TITLE_MAX,
  SITE_DOMAIN,
  slugify,
} from '~/components/website-builder/data/wizard'

const props = defineProps<{ propertyIds: string[] }>()

const settings = defineModel<WebsiteSettings>('settings', { required: true })
const answers = defineModel<WizardAnswers>('answers', { required: true })
const reviews = defineModel<ReviewSelection>('reviews', { required: true })

function patchSettings(value: Partial<WebsiteSettings>) {
  settings.value = { ...settings.value, ...value }
}
function patchAnswers(value: Partial<WizardAnswers>) {
  answers.value = { ...answers.value, ...value }
}

// ── Address: must be checked before the step can continue ───────────────
const checked = ref<{ value: string, available: boolean, reason?: 'format' | 'taken' } | null>(null)
const subdomainTouched = ref(!!answers.value.subdomain)

const address = computed(() => (answers.value.hasCustomDomain ? answers.value.customDomain : answers.value.subdomain).trim().toLowerCase())
const addressOk = computed(() => !!checked.value && checked.value.available && checked.value.value === address.value)

function checkAddress() {
  const result = answers.value.hasCustomDomain ? checkCustomDomain(address.value) : checkSubdomain(address.value)
  checked.value = { value: address.value, ...result }
}

function onName(name: string) {
  patchSettings({ name })
  if (!subdomainTouched.value && !answers.value.hasCustomDomain) {
    patchAnswers({ subdomain: slugify(name) })
  }
}
function onSubdomain(value: string) {
  subdomainTouched.value = true
  patchAnswers({ subdomain: value.toLowerCase().replace(/\s+/g, '-') })
}

const checkMessage = computed(() => {
  const c = checked.value
  if (!c || c.value !== address.value)
    return null
  if (c.available)
    return { ok: true, text: answers.value.hasCustomDomain ? 'Domain is available' : 'This address is available' }
  if (c.reason === 'taken')
    return { ok: false, text: answers.value.hasCustomDomain ? 'This domain is already used by another website' : 'This address is already taken' }
  return { ok: false, text: answers.value.hasCustomDomain ? 'Enter a domain like www.yourdomain.com' : 'Use 3 or more letters, numbers or hyphens' }
})

// ── Logo and favicon (file names only, nothing is uploaded) ─────────────
function onFile(key: 'logoFile' | 'faviconFile', e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file)
    patchSettings({ [key]: file.name })
}

// ── Validation ──────────────────────────────────────────────────────────
const seoTitleOk = computed(() => answers.value.seoTitle.length <= SEO_TITLE_MAX)
const metaOk = computed(() => answers.value.metaDescription.length <= META_DESCRIPTION_MAX)
const rulesIssues = computed(() => settings.value.rules
  ? ruleSetIssues({ ...settings.value.rules, name: 'site', websiteIds: ['site'] }, [])
  : [])

const hasValidData = computed(() =>
  settings.value.name.trim() !== '' && addressOk.value && seoTitleOk.value && metaOk.value && rulesIssues.value.length === 0,
)

// Sections the user has to look at open themselves.
const open = reactive({ seo: false, legal: false, reviews: false, rules: false })
watch([seoTitleOk, metaOk], ([a, b]) => {
  if (!a || !b)
    open.seo = true
})

defineExpose({ hasValidData })
</script>

<template>
  <div class="mx-auto flex w-full max-w-3xl flex-col gap-6 pb-8">
    <div>
      <h2 class="text-2xl font-semibold tracking-tight">
        Configure details
      </h2>
      <p class="mt-1 text-sm text-muted-foreground">
        Finalize the core information and content structure for your site.
      </p>
    </div>

    <!-- Website basics -->
    <Card>
      <CardContent class="space-y-5 p-5">
        <h3 class="text-base font-semibold">
          Website basics
        </h3>
        <div class="flex flex-col gap-6 sm:flex-row">
          <div class="flex flex-1 flex-col gap-4">
            <div class="space-y-2">
              <Label for="wz-name">Website title *</Label>
              <Input id="wz-name" :model-value="settings.name" placeholder="e.g. Villa Sunset Bali" @update:model-value="onName(String($event))" />
            </div>

            <div class="space-y-2">
              <Label :for="answers.hasCustomDomain ? 'wz-custom' : 'wz-url'">{{ answers.hasCustomDomain ? 'Custom domain *' : 'Website URL *' }}</Label>
              <div class="flex items-center gap-2">
                <InputGroup class="flex-1">
                  <InputGroupInput
                    v-if="!answers.hasCustomDomain"
                    id="wz-url"
                    :model-value="answers.subdomain"
                    placeholder="villa-sunset-bali"
                    @update:model-value="onSubdomain(String($event))"
                  />
                  <InputGroupInput
                    v-else
                    id="wz-custom"
                    :model-value="answers.customDomain"
                    placeholder="www.yourdomain.com"
                    @update:model-value="patchAnswers({ customDomain: String($event) })"
                  />
                  <InputGroupAddon v-if="!answers.hasCustomDomain" align="inline-end">
                    <InputGroupText>{{ SITE_DOMAIN }}</InputGroupText>
                  </InputGroupAddon>
                </InputGroup>
                <Button variant="outline" :disabled="!address" data-testid="wz-check-address" @click="checkAddress">
                  Check
                </Button>
              </div>
              <p v-if="checkMessage" class="flex items-center gap-1 text-xs" :class="checkMessage.ok ? 'text-success' : 'text-destructive'" data-testid="wz-address-result">
                <Icon :name="checkMessage.ok ? 'lucide:circle-check' : 'lucide:circle-alert'" class="size-3.5" aria-hidden="true" />
                {{ checkMessage.text }}
              </p>
              <p v-else-if="address" class="text-xs text-muted-foreground">
                Check availability to continue.
              </p>
            </div>

            <div class="flex cursor-pointer items-center gap-2" @click="patchAnswers({ hasCustomDomain: !answers.hasCustomDomain })">
              <div
                class="flex size-4 items-center justify-center rounded-[4px] border"
                :class="answers.hasCustomDomain ? 'border-primary bg-primary text-primary-foreground' : 'border-input'"
              >
                <Icon v-if="answers.hasCustomDomain" name="lucide:check" class="size-3" />
              </div>
              <span class="text-sm">I have my own domain</span>
            </div>
          </div>

          <!-- Logo and favicon -->
          <div class="flex shrink-0 flex-col gap-4 sm:w-40">
            <div class="space-y-1.5">
              <Label>Logo</Label>
              <div class="flex h-20 items-center justify-center rounded-lg border bg-muted/40 p-3">
                <Icon name="lucide:image" class="size-6 text-muted-foreground" aria-hidden="true" />
              </div>
              <p v-if="settings.logoFile" class="truncate text-xs text-muted-foreground">
                {{ settings.logoFile }}
              </p>
              <label class="inline-block cursor-pointer text-xs font-medium text-primary">
                {{ settings.logoFile ? 'Replace logo' : 'Upload logo' }}
                <input type="file" accept="image/*" class="sr-only" @change="onFile('logoFile', $event)">
              </label>
            </div>
            <div class="space-y-1.5">
              <Label>Favicon</Label>
              <div class="flex size-12 items-center justify-center rounded-lg border bg-muted/40">
                <Icon name="lucide:globe" class="size-5 text-muted-foreground" aria-hidden="true" />
              </div>
              <p v-if="settings.faviconFile" class="truncate text-xs text-muted-foreground">
                {{ settings.faviconFile }}
              </p>
              <label class="inline-block cursor-pointer text-xs font-medium text-primary">
                {{ settings.faviconFile ? 'Replace favicon' : 'Upload favicon' }}
                <input type="file" accept="image/*,.ico" class="sr-only" @change="onFile('faviconFile', $event)">
              </label>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- Contact -->
    <Card>
      <CardContent class="space-y-4 p-5">
        <h3 class="text-base font-semibold">
          Contact
        </h3>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div class="space-y-2">
            <Label for="wz-phone">Phone number / WhatsApp</Label>
            <Input id="wz-phone" :model-value="answers.phone" placeholder="+62 812 3456 7890" @update:model-value="patchAnswers({ phone: String($event) })" />
          </div>
          <div class="space-y-2">
            <Label for="wz-email">Email</Label>
            <Input id="wz-email" type="email" :model-value="answers.email" placeholder="info@yourproperty.com" @update:model-value="patchAnswers({ email: String($event) })" />
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- Reviews -->
    <Collapsible v-model:open="open.reviews" class="rounded-lg border bg-card" data-testid="wz-section-reviews">
      <CollapsibleTrigger class="flex w-full items-center justify-between px-5 py-4 text-left">
        <h3 class="text-base font-semibold">
          Reviews
        </h3>
        <Icon name="lucide:chevron-down" class="size-4 text-muted-foreground transition-transform" :class="open.reviews && 'rotate-180'" aria-hidden="true" />
      </CollapsibleTrigger>
      <CollapsibleContent class="border-t p-5">
        <WebsiteBuilderStepsReviewStep v-model="reviews" :property-ids="props.propertyIds" embedded />
      </CollapsibleContent>
    </Collapsible>

    <!-- SEO -->
    <Collapsible v-model:open="open.seo" class="rounded-lg border bg-card" data-testid="wz-section-seo">
      <CollapsibleTrigger class="flex w-full items-center justify-between px-5 py-4 text-left">
        <span class="flex items-center gap-2">
          <h3 class="text-base font-semibold">SEO and AI search</h3>
          <Icon v-if="!seoTitleOk || !metaOk" name="lucide:circle-alert" class="size-4 text-destructive" aria-label="A character limit is exceeded" />
        </span>
        <Icon name="lucide:chevron-down" class="size-4 text-muted-foreground transition-transform" :class="open.seo && 'rotate-180'" aria-hidden="true" />
      </CollapsibleTrigger>
      <CollapsibleContent class="space-y-4 border-t p-5">
        <p class="text-xs text-muted-foreground">
          Leave these empty and ElevAI writes them from your listings.
        </p>
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <Label for="wz-seo-title">Title tag</Label>
            <span class="text-xs" :class="seoTitleOk ? 'text-muted-foreground' : 'text-destructive'">{{ answers.seoTitle.length }}/{{ SEO_TITLE_MAX }}</span>
          </div>
          <Input id="wz-seo-title" :model-value="answers.seoTitle" placeholder="e.g. Villa Sunset Bali, Direct Booking" :aria-invalid="!seoTitleOk" @update:model-value="patchAnswers({ seoTitle: String($event) })" />
          <p v-if="!seoTitleOk" class="text-xs text-destructive">
            Title tag must be {{ SEO_TITLE_MAX }} characters or fewer.
          </p>
        </div>
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <Label for="wz-meta">Meta description</Label>
            <span class="text-xs" :class="metaOk ? 'text-muted-foreground' : 'text-destructive'">{{ answers.metaDescription.length }}/{{ META_DESCRIPTION_MAX }}</span>
          </div>
          <Textarea id="wz-meta" :model-value="answers.metaDescription" class="min-h-20" placeholder="Brief description of your property..." :aria-invalid="!metaOk" @update:model-value="patchAnswers({ metaDescription: String($event) })" />
          <p v-if="!metaOk" class="text-xs text-destructive">
            Meta description must be {{ META_DESCRIPTION_MAX }} characters or fewer.
          </p>
        </div>
      </CollapsibleContent>
    </Collapsible>

    <!-- Legal -->
    <Collapsible v-model:open="open.legal" class="rounded-lg border bg-card" data-testid="wz-section-legal">
      <CollapsibleTrigger class="flex w-full items-center justify-between px-5 py-4 text-left">
        <h3 class="text-base font-semibold">
          Legal and privacy
        </h3>
        <Icon name="lucide:chevron-down" class="size-4 text-muted-foreground transition-transform" :class="open.legal && 'rotate-180'" aria-hidden="true" />
      </CollapsibleTrigger>
      <CollapsibleContent class="border-t p-5">
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div class="space-y-2">
            <Label for="wz-company">Operator / company name</Label>
            <Input id="wz-company" :model-value="answers.legalCompany" placeholder="Your Company LLC" @update:model-value="patchAnswers({ legalCompany: String($event) })" />
          </div>
          <div class="space-y-2">
            <Label for="wz-privacy">Privacy contact email</Label>
            <Input id="wz-privacy" type="email" :model-value="answers.legalPrivacyEmail" placeholder="privacy@yourcompany.com" @update:model-value="patchAnswers({ legalPrivacyEmail: String($event) })" />
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>

    <!-- Booking rules (this website only) -->
    <Collapsible v-if="settings.rules" v-model:open="open.rules" class="rounded-lg border bg-card" data-testid="ws-booking-rules">
      <CollapsibleTrigger class="flex w-full items-center justify-between px-5 py-4 text-left">
        <span class="flex items-center gap-2">
          <h3 class="text-base font-semibold">Booking rules</h3>
          <Icon v-if="rulesIssues.length" name="lucide:circle-alert" class="size-4 text-destructive" aria-label="Booking rules need attention" />
        </span>
        <Icon name="lucide:chevron-down" class="size-4 text-muted-foreground transition-transform" :class="open.rules && 'rotate-180'" aria-hidden="true" />
      </CollapsibleTrigger>
      <CollapsibleContent class="space-y-4 border-t p-5">
        <p class="text-sm text-muted-foreground">
          Length of stay discounts and stay rules for direct bookings on this website only.
        </p>
        <WebsiteRuleSetForm :rule-set="settings.rules" :issues="rulesIssues" site-only @update:rule-set="(rules: WebsiteRuleSet) => patchSettings({ rules })" />
      </CollapsibleContent>
    </Collapsible>
  </div>
</template>
