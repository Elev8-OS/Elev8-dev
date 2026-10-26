# Terms & Conditions in the Website Editor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the editor's placeholder **Cookie & Legal** section with a real section that generates an editable, per-language Terms & Conditions draft from the site's own data and booking rules.

**Architecture:** A pure generator in `data/legal.ts` builds sanitised rich-text HTML. `WebsiteLegal.vue` renders three cards (Legal details, Terms & Conditions, Cookies), auto-generates once into the default language, and saves through the editor's existing `saveSection` path. The document is persisted per language on `Website.legal` via `useWebsiteSave()`.

**Tech Stack:** Nuxt 3, Vue 3 `<script setup>`, TypeScript, Tailwind v4, shadcn-vue, TiPTap via `components/shared/RichTextEditor.vue`, Vitest + Vue Test Utils.

**Spec:** `docs/superpowers/specs/2026-10-26-website-terms-conditions-design.md`

## Global Constraints

- No commits: the user has not asked for any. Do not run `git commit`.
- Every interactive control gets a `data-testid` beginning `wl-` in `WebsiteLegal.vue`.
- Semantic colour tokens only (`bg-card`, `text-muted-foreground`, `border-success/30`, …); no hardcoded colours.
- Rich text goes through `RichTextEditor.vue`; generated HTML uses only `p`, `strong`, `ul`, `li` (TipTap headings are disabled).
- No `v-html` for stored terms.
- Currency/percentage formatting follows the design: plain percentages like `10%`.
- Tests run with `npx vitest run <path>` (there is no `npm test` script).
- Follow existing patterns in `WebsiteBlog.vue`: `defineModel<WebsiteSettings>('settings')`, `emit('save', message)`, patch by replacing the whole settings object.

## Review Focus

- A site with **no booking rules** (`settings.rules` undefined) must still produce useful terms, not clauses full of zeros or the word `undefined`. Tested in Task 1.
- A host's **edited terms must not be silently replaced** when they press Regenerate. Tested in Task 3.
- **Stored HTML** must survive the editor round-trip: generated output is allowlisted tags only, so `RichTextEditor` does not flatten it. Tested in Task 1 (tags) and Task 3 (editor emits HTML).
- **Old websites** have no `legal` field; opening Legal must not throw and must generate. Tested in Task 3.
- **Switching site language** must not overwrite another language's document. Tested in Task 3.

---

### Task 1: Legal data model and generator

**Files:**
- Create: `app/components/website-builder/data/legal.ts`
- Test: `tests/website-builder/legal.spec.ts` (generator describe block)

**Interfaces:**
- Consumes: `WebsiteRuleSet` from `~/components/channels/data/website-channel`.
- Produces:
  - `interface WebsiteLegal { operator?: string, privacyEmail?: string, cancellationPolicy?: string, terms: Record<string, string>, updatedAt?: string }`
  - `const DEFAULT_CANCELLATION_POLICY: string`
  - `function emptyWebsiteLegal(): WebsiteLegal`
  - `function preferredLanguage(languages?: string[], defaultLanguage?: string): string`
  - `function legalFromWizard(operator: string, privacyEmail: string): WebsiteLegal`
  - `function generateTermsDraft(input: { siteName: string, legal?: WebsiteLegal, rules?: WebsiteRuleSet | null }): string`

- [ ] **Step 1: Write the failing tests**

Create `tests/website-builder/legal.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { newRuleSet } from '~/components/channels/data/website-channel'
import { DEFAULT_CANCELLATION_POLICY, emptyWebsiteLegal, generateTermsDraft, legalFromWizard, preferredLanguage } from '~/components/website-builder/data/legal'

const rules = {
  ...newRuleSet('site'),
  minNights: 3,
  maxNights: 14,
  minDaysBeforeArrival: 2,
  arrivalDays: [1, 5],
  departureDays: [0],
  prepaymentPct: 30,
  lengthOfStayDiscounts: [{ id: 'los-1', minNights: 7, pct: 10 }],
}

const legal = { operator: 'PT Villa Sunset', privacyEmail: 'stay@villa.com', cancellationPolicy: DEFAULT_CANCELLATION_POLICY, terms: {} }

describe('terms generator', () => {
  it('writes the site, operator, policy and contact into the document', () => {
    const html = generateTermsDraft({ siteName: 'Villa Sunset', legal, rules })
    expect(html).toContain('<strong>Villa Sunset</strong>')
    expect(html).toContain('PT Villa Sunset')
    expect(html).toContain(DEFAULT_CANCELLATION_POLICY)
    expect(html).toContain('stay@villa.com')
  })

  it('turns the booking rules into readable clauses', () => {
    const html = generateTermsDraft({ siteName: 'Villa Sunset', legal, rules })
    expect(html).toContain('30%')
    expect(html).toContain('minimum of 3 nights')
    expect(html).toContain('maximum of 14 nights')
    expect(html).toContain('2 days before arrival')
    expect(html).toContain('Monday')
    expect(html).toContain('Friday')
    expect(html).toContain('Sunday')
    expect(html).toContain('7+ nights')
    expect(html).toContain('10%')
  })

  it('omits booking clauses when the site has no rule set', () => {
    const html = generateTermsDraft({ siteName: 'Villa Sunset', legal })
    expect(html).not.toContain('Prepayment')
    expect(html).not.toContain('minimum of')
    expect(html).not.toContain('undefined')
    expect(html).not.toContain('0%')
  })

  it('leaks no empty list items and only allowlisted tags', () => {
    const html = generateTermsDraft({ siteName: 'Villa Sunset', legal, rules })
    expect(html).not.toContain('<li></li>')
    expect(html.match(/<\/?(p|strong|ul|li)\b/g)?.length).toBeGreaterThan(0)
    expect(html).not.toMatch(/<\/?(h[1-6]|div|span|script)\b/i)
  })

  it('escapes user text instead of injecting markup', () => {
    const html = generateTermsDraft({ siteName: 'Villa <Sunset>', legal: { ...legal, operator: 'A & B' }, rules })
    expect(html).toContain('Villa &lt;Sunset&gt;')
    expect(html).toContain('A &amp; B')
    expect(html).not.toContain('<Sunset>')
  })

  it('is deterministic', () => {
    expect(generateTermsDraft({ siteName: 'Villa Sunset', legal, rules }))
      .toBe(generateTermsDraft({ siteName: 'Villa Sunset', legal, rules }))
  })
})

describe('legal data helpers', () => {
  it('starts empty with no terms', () => {
    expect(emptyWebsiteLegal()).toEqual({ terms: {} })
  })

  it('picks the default language when it is offered', () => {
    expect(preferredLanguage(['en', 'de'], 'de')).toBe('de')
    expect(preferredLanguage(['en', 'de'], 'fr')).toBe('en')
    expect(preferredLanguage(undefined, undefined)).toBe('en')
  })

  it('carries the wizard legal answers into the site', () => {
    expect(legalFromWizard('PT Villa', 'a@b.com')).toEqual({ operator: 'PT Villa', privacyEmail: 'a@b.com', terms: {} })
    expect(legalFromWizard('', '')).toEqual({ terms: {} })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/website-builder/legal.spec.ts`
Expected: FAIL — cannot resolve `~/components/website-builder/data/legal`.

- [ ] **Step 3: Implement `data/legal.ts`**

Exports exactly as listed in Interfaces. Body requirements:

- `escapeHtml` locally (escape `&`, `<`, `>`, `"`).
- `weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']`.
- `list(items)` returns `''` for an empty array, otherwise `<ul>` + `<li>` per escaped item.
- Document order: intro paragraph (`These terms apply to bookings made through <strong>{siteName}</strong>.`), operator paragraph when `legal.operator`, `Booking and payment` paragraph + list when `rules` exists, `Cancellations` paragraph with the policy (default constant when unset), `Guest responsibilities` static paragraph/list, `Contact` paragraph with email/operator.
- Booking list clauses (only when the value is meaningful):
  - prepayment: `A prepayment of {n}% is taken at booking.`
  - min nights: `Stays have a minimum of {n} nights.`
  - max nights (not null): `The maximum stay is {n} nights.`
  - lead time (`> 0`): `Bookings close {n} days before arrival.`
  - arrival days: `Check-in is available on {days}.`
  - departure days: `Check-out is available on {days}.`
  - each discount: `{minNights}+ nights: {pct}% off.`
- Do **not** include the current date or any timestamp: output must stay deterministic.
- `generateTermsDraft` must never interpolate `undefined`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/website-builder/legal.spec.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Run lint on the new files**

Run: `npx eslint app/components/website-builder/data/legal.ts tests/website-builder/legal.spec.ts`
Expected: no errors.

---

### Task 2: Persist legal on the Website

**Files:**
- Modify: `app/components/website-builder/data/websites.ts` (add `legal?: WebsiteLegal`)
- Modify: `app/components/website-builder/steps/SettingsStep.vue` (add `legal?: WebsiteLegal` to `WebsiteSettings`)
- Modify: `app/composables/useWebsiteSave.ts` (map legal, stamp `updatedAt`)
- Modify: `app/pages/website-builder/create.vue` (edit prefill + wizard carry-over)
- Test: `tests/website-builder/legal.spec.ts` (add save describe block)

**Interfaces:**
- Consumes: `WebsiteLegal`, `emptyWebsiteLegal` from Task 1.
- Produces: `Website.legal?: WebsiteLegal`; `WebsiteSettings.legal?: WebsiteLegal`; `useWebsiteSave().saveWebsite` persists it.

- [ ] **Step 1: Write the failing test**

Append to `tests/website-builder/legal.spec.ts`. Extend the existing `vitest` import to `import { afterEach, describe, expect, it } from 'vitest'` (no duplicate import statements):

```ts
import { useWebsiteSave } from '~/composables/useWebsiteSave'
import { websites } from '~/components/website-builder/data/websites'
import { createDefaultReviewConfig } from '~/components/website-builder/data/review-config'

describe('saving legal', () => {
  const original = JSON.parse(JSON.stringify(websites.value))
  afterEach(() => { websites.value = original })

  it('stores the terms and stamps updatedAt', () => {
    const { saveWebsite } = useWebsiteSave()
    const id = saveWebsite({
      template: null,
      settings: {
        name: 'Villa Legal', domain: 'villa-legal.com', description: '', brandColor: '#000',
        fontFamily: 'Inter', logoFile: null, faviconFile: null, useDefaultFavicon: false,
        legal: { operator: 'PT Villa', terms: { en: '<p>My terms</p>' } },
      },
      property: { propertyIds: ['prop-1'], roomIds: [] },
      reviews: { selectedReviewIds: [], featuredReviewIds: [], manualReviews: [], featuredManualReviewIds: [], config: createDefaultReviewConfig() },
    }, 'draft')!
    const saved = websites.value.find(w => w.id === id)!
    expect(saved.legal?.terms.en).toBe('<p>My terms</p>')
    expect(saved.legal?.operator).toBe('PT Villa')
    expect(saved.legal?.updatedAt).toBeTruthy()
  })

  it('leaves legal untouched when the draft has none', () => {
    const { saveWebsite } = useWebsiteSave()
    const id = saveWebsite({
      template: null,
      settings: {
        name: 'Villa No Legal', domain: 'villa-no-legal.com', description: '', brandColor: '#000',
        fontFamily: 'Inter', logoFile: null, faviconFile: null, useDefaultFavicon: false,
      },
      property: { propertyIds: ['prop-1'], roomIds: [] },
      reviews: { selectedReviewIds: [], featuredReviewIds: [], manualReviews: [], featuredManualReviewIds: [], config: createDefaultReviewConfig() },
    }, 'draft')!
    expect(websites.value.find(w => w.id === id)!.legal).toBeUndefined()
  })
})
```

Remove the unused `beforeEach` import if lint flags it.- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/website-builder/legal.spec.ts`
Expected: FAIL — `legal` is not a known property / saved legal is undefined.

- [ ] **Step 3: Wire the fields**

- `data/websites.ts`: import `WebsiteLegal` and add `legal?: WebsiteLegal` to `Website` with a comment that older sites have none.
- `steps/SettingsStep.vue`: import `WebsiteLegal`, add `legal?: WebsiteLegal` to `WebsiteSettings` (the Blog posts field is the precedent).
- `useWebsiteSave.ts`: build the base fields as today, then:
  ```ts
  const legal = settings.legal
    ? { ...settings.legal, updatedAt: new Date().toISOString() }
    : undefined
  const fields = { ...base, ...(legal ? { legal } : {}) }
  ```
  This deliberately omits the key when absent so an existing site's legal is not erased.
- `create.vue`:
  - In the edit-mode prefill object add `legal: site.legal`.
  - In the `onMounted` merge add `legal: websiteSettings.value.legal ?? site.legal`.
  - In `finalSettings` add `legal: legalFromWizard(answers.value.legalCompany, answers.value.legalPrivacyEmail)` (import it).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/website-builder/legal.spec.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Typecheck the touched files**

Run: `npm run typecheck`
Expected: no new errors. (The repo has known pre-existing errors in `pages/journeys` — ignore those.)

---

### Task 3: The Legal section component

**Files:**
- Create: `app/components/website-builder/WebsiteLegal.vue`
- Test: `tests/website-builder/legal.spec.ts` (component describe block)

**Interfaces:**
- Consumes: `WebsiteSettings` (with `legal`), Task 1 helpers, `RichTextEditor` from `~/components/shared/RichTextEditor.vue`, `isRichTextEmpty` from `~/lib/rich-text`, `LANGUAGE_OPTIONS` from `data/wizard`.
- Produces: `<WebsiteBuilderWebsiteLegal v-model:settings="settings" @save="saveSection" />`; emits `save: [message: string]`.

- [ ] **Step 1: Write the failing component tests**

Append to `tests/website-builder/legal.spec.ts`:

```ts
import { mount } from '@vue/test-utils'
import WebsiteLegal from '~/components/website-builder/WebsiteLegal.vue'

const passthrough = { template: '<div><slot /></div>' }
const RichTextStub = {
  props: ['modelValue'],
  emits: ['update:modelValue'],
  template: `<textarea data-testid="rich-text-stub" :value="modelValue"
    @input="$emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)" />`,
}
const global = {
  stubs: {
    Icon: true,
    Button: { template: '<button><slot /></button>' },
    Input: { props: ['modelValue'], template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)">' },
    Textarea: { props: ['modelValue'], template: '<textarea :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />' },
    Label: passthrough,
    AlertDialog: { props: ['open'], template: '<div v-if="open"><slot /></div>' },
    AlertDialogContent: passthrough,
    AlertDialogTitle: passthrough,
    AlertDialogDescription: passthrough,
    AlertDialogFooter: passthrough,
    AlertDialogCancel: passthrough,
    AlertDialogAction: { template: '<button><slot /></button>' },
    RichTextEditor: RichTextStub,
  },
  config: { warnHandler: () => {} },
}

function baseSettings(extra: Record<string, unknown> = {}) {
  return {
    name: 'Villa Sunset', domain: 'villa.com', description: '', brandColor: '#000',
    fontFamily: 'Inter', logoFile: null, faviconFile: null, useDefaultFavicon: false,
    rules: newRuleSet('site'), languages: ['en', 'de'], defaultLanguage: 'en',
    ...extra,
  }
}

function mountLegal(extra: Record<string, unknown> = {}) {
  return mount(WebsiteLegal, { props: { settings: baseSettings(extra) }, global })
}
const lastLegal = (w: ReturnType<typeof mountLegal>) =>
  (w.emitted('update:settings')!.at(-1)![0] as { legal: { terms: Record<string, string> } }).legal

describe('legal section', () => {
  it('generates a draft in the default language when the site has none', () => {
    const wrapper = mountLegal()
    const terms = lastLegal(wrapper).terms
    expect(terms.en).toContain('Villa Sunset')
    expect(wrapper.find('[data-testid="wl-generated-note"]').exists()).toBe(true)
  })

  it('edits the current language without touching the other', async () => {
    const wrapper = mountLegal({ legal: { terms: { en: '<p>English</p>', de: '<p>Deutsch</p>' } } })
    await wrapper.get('[data-testid="rich-text-stub"]').setValue('<p>Edited</p>')
    expect(lastLegal(wrapper).terms.en).toBe('<p>Edited</p>')
    expect(lastLegal(wrapper).terms.de).toBe('<p>Deutsch</p>')
  })

  it('generates into a language that has no document yet', async () => {
    const wrapper = mountLegal({ legal: { terms: { en: '<p>English</p>' } } })
    await wrapper.get('[data-testid="wl-lang-de"]').trigger('click')
    expect(wrapper.find('[data-testid="wl-generate"]').exists()).toBe(true)
    await wrapper.get('[data-testid="wl-generate"]').trigger('click')
    expect(lastLegal(wrapper).terms.de).toContain('Villa Sunset')
    expect(lastLegal(wrapper).terms.en).toBe('<p>English</p>')
  })

  it('asks before replacing edited terms, then replaces them', async () => {
    const wrapper = mountLegal({ legal: { terms: { en: '<p>My custom terms</p>' } } })
    await wrapper.get('[data-testid="wl-regenerate"]').trigger('click')
    expect(wrapper.find('[data-testid="wl-regenerate-confirm"]').exists()).toBe(true)
    await wrapper.get('[data-testid="wl-regenerate-confirm"]').trigger('click')
    expect(lastLegal(wrapper).terms.en).toContain('Villa Sunset')
    expect(lastLegal(wrapper).terms.en).not.toContain('My custom terms')
  })

  it('does not ask when the document is still the generated draft', async () => {
    const wrapper = mountLegal()
    await wrapper.get('[data-testid="wl-regenerate"]').trigger('click')
    expect(wrapper.find('[data-testid="wl-regenerate-confirm"]').exists()).toBe(false)
  })

  it('patches legal details and asks the editor to save', async () => {
    const wrapper = mountLegal()
    await wrapper.get('[data-testid="wl-operator"]').setValue('PT Villa')
    await wrapper.get('[data-testid="wl-privacy"]').setValue('stay@villa.com')
    await wrapper.get('[data-testid="wl-cancellation"]').setValue('Free cancellation up to 3 days before arrival.')
    const legal = lastLegal(wrapper) as { operator?: string, privacyEmail?: string, cancellationPolicy?: string }
    expect(legal.operator).toBe('PT Villa')
    expect(legal.privacyEmail).toBe('stay@villa.com')
    expect(legal.cancellationPolicy).toBe('Free cancellation up to 3 days before arrival.')
    await wrapper.get('[data-testid="wl-save"]').trigger('click')
    expect(wrapper.emitted('save')![0]).toEqual(['Legal changes saved'])
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/website-builder/legal.spec.ts`
Expected: FAIL — cannot resolve `WebsiteLegal.vue`.

- [ ] **Step 3: Implement `WebsiteLegal.vue`**

Structure (script setup, TypeScript):

- `const settings = defineModel<WebsiteSettings>('settings', { required: true })`
- `const emit = defineEmits<{ save: [message: string] }>()`
- `const language = ref(preferredLanguage(settings.value.languages, settings.value.defaultLanguage))`
- `const languages = computed(() => settings.value.languages ?? ['en'])`
- `const terms = computed(() => settings.value.legal?.terms[language.value] ?? '')`
- `const generated = ref(false)`
- `const regenerateOpen = ref(false)`
- `function setLegal(patch: Partial<WebsiteLegal>)` replaces `settings.value` with a new object (spread), merging into `settings.value.legal ?? emptyWebsiteLegal()`.
- `function setTerms(html: string)` writes `terms[language.value] = html`, sets `generated.value = false`.
- `function freshDraft()` calls `generateTermsDraft({ siteName: settings.value.name, legal: settings.value.legal, rules: settings.value.rules })`.
- `function applyDraft()` calls `setTerms(freshDraft())`, sets `generated.value = true`, closes the dialog.
- `function regenerate()`: if `terms.value` is non-empty and `terms.value !== freshDraft()` open the dialog, else `applyDraft()`.
- `onMounted(() => { if (!terms.value) applyDraft() })`.

Template: `mx-auto w-full max-w-3xl` wrapper `data-testid="wl-legal"` with heading "Cookie & legal" and a one-line description.

1. Card **Legal details** (`wl-details`): operator `Input` (`wl-operator`), privacy email `Input type=email` (`wl-privacy`), cancellation policy `Textarea` (`wl-cancellation`, default value `DEFAULT_CANCELLATION_POLICY` when unset).
2. Card **Terms & Conditions** (`wl-terms`): language buttons from `LANGUAGE_OPTIONS.filter(l => languages.includes(l.code))` labelled with `l.label`, `data-testid="wl-lang-${code}"`, active state on the current language (only rendered when `languages.length > 1`); a note `wl-generated-note` with `lucide:sparkles` when `generated`; `<RichTextEditor v-model="termsModel" aria-label="Terms and conditions" content-class="min-h-80 text-sm" placeholder="Write your terms…" />` where `termsModel` is a computed get/set over `terms`/`setTerms`; the empty-state button `wl-generate` "Generate draft" when `!terms`; the `wl-regenerate` button "Regenerate" when `terms` exists.
3. Card **Cookies**: a muted paragraph explaining cookie consent is not configured yet.
4. Footer: "Save changes" `wl-save` calling `emit('save', 'Legal changes saved')`.
5. `AlertDialog` bound to `regenerateOpen`; action button `data-testid="wl-regenerate-confirm"` calling `applyDraft()`. Description must say the current terms will be replaced and edits lost.

Import `RichTextEditor` explicitly (it is not auto-imported elsewhere in the repo).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/website-builder/legal.spec.ts`
Expected: PASS, 17 tests.

- [ ] **Step 5: Lint the component**

Run: `npx eslint app/components/website-builder/WebsiteLegal.vue`
Expected: no errors.

---

### Task 4: Editor integration and end-to-end save

**Files:**
- Modify: `app/components/website-builder/WebsiteEditor.vue`
- Test: `tests/website-builder/website-editor.spec.ts`

**Interfaces:**
- Consumes: `WebsiteBuilderWebsiteLegal` from Task 3.
- Produces: selecting the `legal` nav item renders the section; its save goes through `saveSection`, which saves the website with the current published/draft status.

- [ ] **Step 1: Write the failing test**

In `tests/website-builder/website-editor.spec.ts`:

- Add to the `global.stubs` object: `WebsiteBuilderWebsiteLegal: { template: '<div data-testid="legal-section" />' }`.
- Add a test:

```ts
it('opens the legal section instead of the empty state', async () => {
  const wrapper = mountEditor()
  await wrapper.get('[data-testid="we-nav-legal"]').trigger('click')
  expect(wrapper.find('[data-testid="legal-section"]').exists()).toBe(true)
  expect(wrapper.find('[data-testid="we-empty"]').exists()).toBe(false)
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/website-builder/website-editor.spec.ts`
Expected: FAIL — `we-empty` is shown for the legal section.

- [ ] **Step 3: Render the section**

In `WebsiteEditor.vue`, before the placeholder branch, add:

```html
<div v-else-if="section === 'legal'" class="p-5">
  <WebsiteBuilderWebsiteLegal v-model:settings="settings" @save="saveSection" />
</div>
```

No import needed: sibling website-builder components are auto-registered (same as `WebsiteBuilderWebsiteBlog`).

- [ ] **Step 4: Run the editor tests**

Run: `npx vitest run tests/website-builder/website-editor.spec.ts`
Expected: PASS.

- [ ] **Step 5: Verify no regression in the builder suite**

Run: `npx vitest run tests/website-builder`
Expected: all files pass.

---

### Task 5: Full verification

**Files:** none modified.

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass.

- [ ] **Step 2: Lint the repository**

Run: `npm run lint`
Expected: no errors (warnings that already exist on the base branch are acceptable).

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: only the known pre-existing `JourneyStatus`/`lastModified` errors; no errors in the files touched by this plan.

- [ ] **Step 4: Smoke the dev server**

The server is already running on port 3000. Open `http://localhost:3000/website-builder/create?edit=1`, click **Cookie & Legal**, confirm:
- Terms are generated and visible.
- Editing text and pressing Save changes persists after switching sections.
- Regenerate asks for confirmation after an edit.
