<script setup lang="ts">
import type { WebsiteLegal } from '~/components/website-builder/data/legal'
import type { WebsiteSettings } from '~/components/website-builder/steps/SettingsStep.vue'
import { computed, onMounted, ref } from 'vue'
import RichTextEditor from '~/components/shared/RichTextEditor.vue'
import { COOKIE_POLICY_DRAFT, emptyWebsiteLegal, generateImpressumDraft, generateTermsDraft, preferredLanguage } from '~/components/website-builder/data/legal'
import { LANGUAGE_OPTIONS } from '~/components/website-builder/data/wizard'
import { isRichTextEmpty } from '~/lib/rich-text'

const emit = defineEmits<{
  /** Legal copy lives on the website, so saving it is saving the site. */
  save: [message: string]
}>()

const settings = defineModel<WebsiteSettings>('settings', { required: true })

const languages = computed(() => settings.value.languages ?? ['en'])
const language = ref(preferredLanguage(settings.value.languages, settings.value.defaultLanguage))
const languageOptions = computed(() => LANGUAGE_OPTIONS.filter(option => languages.value.includes(option.code)))
const terms = computed(() => settings.value.legal?.terms[language.value] ?? '')

const generated = ref(false)
const regenerateOpen = ref(false)

function setLegal(patch: Partial<WebsiteLegal>) {
  settings.value = {
    ...settings.value,
    legal: { ...(settings.value.legal ?? emptyWebsiteLegal()), ...patch },
  }
}

function setTerms(html: string) {
  setLegal({ terms: { ...(settings.value.legal?.terms ?? {}), [language.value]: html } })
  generated.value = false
}

const termsModel = computed({
  get: () => terms.value,
  set: (value: string) => setTerms(value),
})

const impressumModel = computed({
  get: () => settings.value.legal?.impressum ?? '',
  set: (value: string) => setLegal({ impressum: value }),
})

const cookiePolicyModel = computed({
  get: () => settings.value.legal?.cookiePolicy ?? '',
  set: (value: string) => setLegal({ cookiePolicy: value }),
})

const cookieBanner = computed(() => settings.value.legal?.cookieBanner ?? false)

function freshDraft() {
  return generateTermsDraft({
    siteName: settings.value.name,
    legal: settings.value.legal,
    rules: settings.value.rules,
  })
}

function applyDraft() {
  setTerms(freshDraft())
  generated.value = true
  regenerateOpen.value = false
}

function regenerate() {
  if (!isRichTextEmpty(terms.value) && terms.value !== freshDraft()) {
    regenerateOpen.value = true
    return
  }
  applyDraft()
}

// First open: a draft shows up instead of an empty page. It is still only a draft until saved.
onMounted(() => {
  if (!terms.value)
    applyDraft()
})
</script>

<template>
  <div class="mx-auto w-full max-w-3xl" data-testid="wl-legal">
    <h3 class="text-xl font-semibold tracking-tight">
      Cookie & legal
    </h3>
    <p class="mb-6 mt-1 text-sm text-muted-foreground">
      Your operator details and the Terms & Conditions guests accept when they book.
    </p>

    <!-- Legal details: what the generated terms are written from -->
    <section class="mb-4 rounded-xl border bg-card p-5" data-testid="wl-details">
      <div class="text-sm font-semibold">
        Legal details
      </div>
      <p class="mb-4 text-xs text-muted-foreground">
        Used to build your Impressum / legal notice. Leave a field empty to omit it.
      </p>

      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div class="space-y-2">
          <Label for="wl-operator">Operator / company name</Label>
          <Input
            id="wl-operator"
            data-testid="wl-operator"
            :model-value="settings.legal?.operator ?? ''"
            placeholder="Your Company LLC"
            @update:model-value="setLegal({ operator: String($event) })"
          />
        </div>
        <div class="space-y-2">
          <Label for="wl-vat">VAT / registration number</Label>
          <Input
            id="wl-vat"
            data-testid="wl-vat"
            :model-value="settings.legal?.vatNumber ?? ''"
            placeholder="CHE-123.456.789"
            @update:model-value="setLegal({ vatNumber: String($event) })"
          />
        </div>
        <div class="space-y-2">
          <Label for="wl-street">Street &amp; number</Label>
          <Input
            id="wl-street"
            data-testid="wl-street"
            :model-value="settings.legal?.street ?? ''"
            placeholder="Musterstrasse 12"
            @update:model-value="setLegal({ street: String($event) })"
          />
        </div>
        <div class="space-y-2">
          <Label for="wl-postal">Postal code</Label>
          <Input
            id="wl-postal"
            data-testid="wl-postal"
            :model-value="settings.legal?.postalCode ?? ''"
            placeholder="8000"
            @update:model-value="setLegal({ postalCode: String($event) })"
          />
        </div>
        <div class="space-y-2">
          <Label for="wl-city">City</Label>
          <Input
            id="wl-city"
            data-testid="wl-city"
            :model-value="settings.legal?.city ?? ''"
            placeholder="Zürich"
            @update:model-value="setLegal({ city: String($event) })"
          />
        </div>
        <div class="space-y-2">
          <Label for="wl-country">Country</Label>
          <Input
            id="wl-country"
            data-testid="wl-country"
            :model-value="settings.legal?.country ?? ''"
            placeholder="Switzerland"
            @update:model-value="setLegal({ country: String($event) })"
          />
        </div>
      </div>
    </section>

    <!-- Impressum / legal notice: empty = generated from the company details above -->
    <section class="mb-4 rounded-xl border bg-card p-5" data-testid="wl-impressum-section">
      <div class="text-sm font-semibold">
        Impressum / Legal notice
      </div>
      <p class="mt-1 text-xs text-muted-foreground">
        Optional: a custom notice below overrides the auto-generated one from the company details above.
      </p>
      <div class="mt-4" data-testid="wl-impressum">
        <RichTextEditor
          v-model="impressumModel"
          aria-label="Custom Impressum"
          content-class="min-h-40 text-sm"
          placeholder="Leave empty to auto-generate from your company details (HTML allowed)."
        />
      </div>
      <p class="mt-2 text-xs text-muted-foreground">
        Leave empty to auto-generate from your company details (HTML allowed).
      </p>
      <div v-if="!settings.legal?.impressum" class="mt-3 rounded-lg bg-muted/60 p-3" data-testid="wl-impressum-preview">
        <p class="text-xs font-medium">
          Auto-generated from your company details:
        </p>
        <div class="prose prose-sm dark:prose-invert" v-html="generateImpressumDraft(settings.legal) || '<p class=\'text-xs text-muted-foreground\'>Fill in the company details above and the Impressum builds itself.</p>'" />
      </div>
    </section>

    <!-- Terms & Conditions: generated once, then the host's own -->
    <section class="mb-4 rounded-xl border bg-card p-5" data-testid="wl-terms">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div class="text-sm font-semibold">
            Terms & Conditions
          </div>
          <p class="text-xs text-muted-foreground">
            Shown on the site and linked from the booking checkout.
          </p>
        </div>
        <div v-if="languageOptions.length > 1" class="flex flex-wrap gap-1" role="group" aria-label="Terms language">
          <button
            v-for="option in languageOptions"
            :key="option.code"
            type="button"
            class="rounded-full border px-3 py-1 text-xs font-medium transition-colors"
            :class="language === option.code ? 'border-2 border-primary' : 'hover:border-muted-foreground/50'"
            :aria-pressed="language === option.code"
            :data-testid="`wl-lang-${option.code}`"
            @click="language = option.code"
          >
            {{ option.label }}
          </button>
        </div>
      </div>

      <p v-if="generated" class="mt-4 flex items-center gap-1.5 rounded-lg bg-muted/60 px-3 py-2 text-xs" data-testid="wl-generated-note">
        <Icon name="lucide:sparkles" class="size-3.5 text-[#C8A84B]" aria-hidden="true" />
        Draft generated from your site settings. Edit anything you like, then save.
      </p>

      <div class="mt-4" data-testid="wl-terms-editor">
        <RichTextEditor
          v-model="termsModel"
          aria-label="Terms and conditions"
          content-class="min-h-80 text-sm"
          placeholder="Write your terms, or generate a draft from your booking rules…"
        />
      </div>

      <div class="mt-4 flex flex-wrap items-center justify-end gap-2">
        <Button
          v-if="!terms"
          data-testid="wl-generate"
          @click="applyDraft"
        >
          <Icon name="lucide:sparkles" class="mr-2 size-4" aria-hidden="true" />
          Generate draft
        </Button>
        <Button
          v-else
          variant="outline"
          data-testid="wl-regenerate"
          @click="regenerate"
        >
          <Icon name="lucide:refresh-cw" class="mr-2 size-4" aria-hidden="true" />
          Regenerate
        </Button>
      </div>

      <p v-if="language !== (settings.defaultLanguage ?? languages[0])" class="mt-3 text-xs text-muted-foreground">
        Generated text is written in English. Write this language yourself, or start from the English draft.
      </p>
    </section>

    <!-- Cookie policy: empty = auto-generated -->
    <section class="mb-4 rounded-xl border bg-card p-5" data-testid="wl-cookie-policy-section">
      <div class="text-sm font-semibold">
        Cookie policy
      </div>
      <div class="mt-4" data-testid="wl-cookie-policy">
        <RichTextEditor
          v-model="cookiePolicyModel"
          aria-label="Cookie policy"
          content-class="min-h-40 text-sm"
          placeholder="Leave empty to auto-generate (HTML allowed)."
        />
      </div>
      <p class="mt-2 text-xs text-muted-foreground">
        Leave empty to auto-generate (HTML allowed).
      </p>
      <div v-if="!settings.legal?.cookiePolicy" class="mt-3 rounded-lg bg-muted/60 p-3" data-testid="wl-cookie-policy-preview">
        <p class="text-xs font-medium">
          Auto-generated:
        </p>
        <div class="prose prose-sm dark:prose-invert" v-html="COOKIE_POLICY_DRAFT" />
      </div>
    </section>

    <!-- Cookie consent banner: gates every tracking pixel behind visitor consent -->
    <section class="mb-4 rounded-xl border bg-card p-5" data-testid="wl-cookies">
      <div class="flex items-center justify-between gap-4">
        <div>
          <div class="text-sm font-semibold">
            Cookie consent banner
          </div>
          <p class="mt-1 max-w-md text-xs text-muted-foreground">
            Tracking pixels (GA4, Meta, etc.) only fire after the visitor accepts. Required for GDPR/FADP
            compliance whenever any pixel is configured.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          class="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors"
          :class="cookieBanner ? 'bg-primary' : 'bg-input'"
          :aria-checked="cookieBanner"
          aria-label="Cookie consent banner"
          data-testid="wl-banner"
          @click="setLegal({ cookieBanner: !cookieBanner })"
        >
          <span
            class="block size-4 rounded-full bg-background shadow transition-transform"
            :class="cookieBanner ? 'translate-x-[1.125rem]' : 'translate-x-0.5'"
          />
        </button>
      </div>
      <p class="mt-3 text-xs text-muted-foreground">
        {{ cookieBanner
          ? 'The banner is on: visitors choose before any tracking pixel loads.'
          : 'The banner is off: no tracking pixels may be configured on this site.' }}
      </p>
    </section>

    <div class="flex items-center justify-between gap-3">
      <span class="text-xs text-muted-foreground">Changes go live when you save.</span>
      <Button data-testid="wl-save" @click="emit('save', 'Legal changes saved')">
        Save changes
      </Button>
    </div>

    <AlertDialog v-model:open="regenerateOpen">
      <AlertDialogContent>
        <AlertDialogTitle>Replace these terms?</AlertDialogTitle>
        <AlertDialogDescription>
          Regenerating replaces the current document in this language and discards the edits you made. This cannot
          be undone.
        </AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction data-testid="wl-regenerate-confirm" @click="applyDraft">
            Replace terms
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
