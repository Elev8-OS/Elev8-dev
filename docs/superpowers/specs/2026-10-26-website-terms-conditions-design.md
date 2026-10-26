# Terms & Conditions in the Website Editor — Design

Date: 2026-10-26
Status: awaiting approval

## Intent

Hosts need a Terms & Conditions document on their direct-booking site. Today the
editor's **Cookie & Legal** section is a placeholder: it renders the generic
"Nothing to set up here yet" empty state. The wizard does ask for an operator
name and privacy email (`DetailsStep.vue:263`), but those answers are never
saved to the `Website` — they only feed a checklist on the Final Review screen.

The host should open **Cookie & Legal**, find a Terms & Conditions draft already
written from their own site and booking data, and edit it. Manual editing is the
primary path; generation is the starting point.

## Goals

- A working **Cookie & Legal** section in `WebsiteEditor.vue` (no placeholder).
- On first open, a Terms & Conditions draft is generated from: site name,
  operator name, privacy email, cancellation policy, and the site's booking
  rules (`WebsiteRuleSet`).
- The draft is fully editable (rich text) and can be regenerated.
- Terms are stored per site language; the generator writes the default language.
- Legal details (operator, privacy email, cancellation policy) are saved on the
  `Website` and prefilled from the wizard when a site is created there.

## Non-goals

- Rendering the Terms page in `WebsitePreviewFrame.vue` (the preview is an
  abstract mock with no footer or legal pages).
- Real AI generation. Generation is deterministic client-side code.
- Generating terms in every site language. Only the default language is
  generated; other languages are manual for now.
- A cookie-consent configuration UI. The cookie area keeps a short explanatory
  note until it gets its own spec.
- Publishing/versioning legal documents (revisions, effective dates history).

## Anti-goals

- A separate 11th sidebar section for Terms. Legal content stays in one place.
- Silently overwriting a host's edited terms. Regeneration always asks first
  when the current document is non-empty and has been edited.
- Storing legal copy on `WebsiteSettings` only (it would be lost on save, like
  the wizard's legal answers are today).

## Constraints

- `WebsiteSettings` is the editor model; `useWebsiteSave()` maps it onto the
  `Website`. Anything that must survive a save has to be mapped there.
- `Website` is a mock in-memory `ref` (`data/websites.ts`); no migration
  machinery. New fields are optional with readers falling back safely.
- The shared `RichTextEditor.vue` (TipTap) is the editor; it emits sanitised
  HTML via `app/lib/rich-text.ts`.
- Existing component/test conventions: `data-testid` on every interactive
  control, `housekeeping.spec.ts` style Vitest + Vue Test Utils tests.

## Approaches considered

**A. Deterministic template generator (chosen).** A pure function builds the
document from real values: prepayment %, min/max nights, lead time, arrival and
departure days, length-of-stay discounts, early-bird/last-minute windows,
operator, privacy email, cancellation policy. Instant, testable, identical on
every run, no network.

**B. Mock AI writer.** Reuse the `GeneratingStep` / `WebsiteAiChat` mock pattern
(spinner, canned sentences). Reads better, but ignores the actual rules, is not
reproducible, and cannot be asserted in tests beyond "some text appeared".

A was chosen. B remains possible later as an "Improve with ElevAI" action on top
of A's output, without changing the storage model.

## Decisions

1. **Placement.** `Cookie & Legal` becomes a real section built by a new
   `WebsiteLegal.vue`. It has three stacked cards: Legal details, Terms &
   Conditions, Cookies (note only). No new sidebar item.
2. **Data model.** New types live in `app/components/website-builder/data/legal.ts`:

   ```ts
   export interface WebsiteLegal {
     operator?: string
     privacyEmail?: string
     cancellationPolicy?: string
     /** Rich-text HTML per language code. */
     terms: Record<string, string>
     updatedAt?: string
   }
   ```

   `Website.legal?: WebsiteLegal`. `WebsiteSettings.legal?: WebsiteLegal`.
   `useWebsiteSave()` maps `legal: settings.legal`. `create.vue` edit prefill
   reads `site.legal`.
3. **Generation trigger.** If `terms[defaultLanguage]` is missing when the
   section mounts, generate once into that slot and show a subtle "Draft
   generated from your site settings" note. Never regenerate automatically
   afterwards.
4. **Regeneration.** "Regenerate" replaces the current language's document.
   The "was it edited?" check compares the current document against a fresh
   `generateTermsDraft()` call for the current inputs — no stored baseline, so
   a reload behaves the same. When they differ, an `AlertDialog` confirms
   first. `Generate draft` appears when the slot is empty and no draft was
   produced automatically (e.g. a newly added language).
5. **Languages.** A small language switcher lists `settings.languages` (or
   `['en']`). Each language has its own document. Generated copy is English.
   Switching to a language with no document shows an empty editor plus
   "Generate draft" and a note that generation runs in English.
6. **Cancellation policy.** `WebsiteRuleSet` has no cancellation field, so Legal
   details gains a short free-text `cancellationPolicy` (default:
   "Free cancellation up to 7 days before check-in."). The generator quotes it.
7. **Save.** The section uses the editor's existing pattern: a "Save changes"
   button calling `saveSection('Legal changes saved')`. `updatedAt` is stamped
   by the save, not by typing.
8. **Wizard prefill.** `create.vue`'s `finalSettings` includes
   `legal: { operator: answers.legalCompany, privacyEmail: answers.legalPrivacyEmail, terms: {} }`
   so the wizard's answers stop being dropped. The legal section then fills in
   the rest on first open.

## What the generator writes

A readable document with these sections, omitting any that do not apply:

- Who you are booking with (operator, site name, privacy email)
- Booking and payment (prepayment %, min/max nights, lead time, arrival /
  departure days, length-of-stay discounts, early-bird / last-minute)
- Cancellations (the host's `cancellationPolicy` text)
- Guest responsibilities and liability (static, editable boilerplate)
- Governing law and contact (operator + privacy email)

Values are formatted with the project's currency/locale conventions; weekday
names come from `arrivalDays` / `departureDays`.

Builder calls made while planning:

- Output uses only `<p>`, `<strong>`, `<ul>`, `<li>` — `RichTextEditor` disables
  TipTap headings, so generated `<h2>` would be flattened anyway.
- No `settings.rules` means the booking/payment clauses are omitted rather than
  written with zeros.
- The language used for generation is `settings.defaultLanguage` when it is in
  `settings.languages`, otherwise the first language, otherwise `'en'`.
- Component tests stub `RichTextEditor` so TipTap is not exercised in jsdom.

## Files touched

- `app/components/website-builder/data/legal.ts` — new: types, defaults,
  `generateTermsDraft()`, `termsAreCustom()` helper.
- `app/components/website-builder/WebsiteLegal.vue` — new: the section UI.
- `app/components/website-builder/WebsiteEditor.vue` — render the new component
  for `section === 'legal'`, wire save.
- `app/components/website-builder/data/websites.ts` — `Website.legal`.
- `app/components/website-builder/steps/SettingsStep.vue` — `WebsiteSettings.legal`.
- `app/composables/useWebsiteSave.ts` — map `legal`.
- `app/pages/website-builder/create.vue` — prefill + wizard answer carry-over.
- Tests: `tests/website-builder/legal.spec.ts` (generator + component) and an
  added case in `tests/website-builder/website-editor.spec.ts`.

## Testing

- Generator: a full rule set includes prepayment/nights/discount values; a bare
  rule set omits absent clauses; output contains operator/site name; no
  `undefined` or empty `<li>` leaks into the HTML.
- Component: mounts with an empty legal object, auto-generates once, shows the
  editor; typing updates the model; an added language starts empty; Regenerate
  asks for confirmation only when the document was edited; Save emits.
- Editor: selecting the legal nav item renders `WebsiteLegal` instead of the
  empty state; Save changes stamps the website's `legal.updatedAt`.
- `useWebsiteSave`: legal survives a save round-trip.

## Open question for the builder

None blocking. Currency formatting for discount percentages is plain (`10%`),
not a currency.
