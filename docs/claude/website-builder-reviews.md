> Split out of CLAUDE.md to keep the always-loaded context small. Read this file before working on this area; keep it updated when the code changes.

### Website Builder Review Rules (`app/components/website-builder/`)

The wizard's Reviews step (`ReviewStep.vue`, step in the Create/Edit flow) decides which guest
reviews from Review Hub appear on a generated website. It has two modes:

- **Auto** (the default for a new website): the host sets a minimum rating per channel, in
  that channel's own native scale, and every review clearing its channel's rule appears,
  uncapped, newest first. New reviews that arrive after publishing appear automatically too.
  A single review can still be **hidden by hand** without loosening a rule —
  `WebsiteReviewConfig.excludedReviewIds` (optional, so a site saved before it needs no
  migration; read it through `excludedIds(config)`). Two resolvers, and the difference
  matters: `resolveRuleMatches()` is what the rules admit and what the **picker lists**, so a
  hidden review stays on screen unticked and can be brought back; `resolveAutoReviews()` is
  that minus the exclusions and is what **publishes** (and what `autoReviewStats` counts).
  Exclusions live on the config, so they travel into `Website.reviewConfig` for free, and
  they are cleared when the property selection changes — the ids belong to the old scope,
  while the rules survive it. When the rules match but everything is hidden, the warning says
  so rather than sending the host off to lower a threshold that is not the problem.
- **Manual**: the host hand-picks reviews one by one. Its candidate list is everything in
  scope except Airbnb double-blind (`is_hidden`) reviews. There is intentionally no rating
  floor here, because the score badge is shown on every row and picking is the point of this
  mode.

**`review-config.ts`** (`app/components/website-builder/data/review-config.ts`) is the single
home for the rules, framework-free on purpose (the wizard owns the reactive state and calls
into it):
- `WebsiteReviewConfig`: `{ mode, channels: Record<ReviewSource, ReviewChannelRule>, requireText, minCountToShow, batchSize }`
- `ReviewChannelRule`: `{ enabled, minRating }`, stored in the channel's **native** scale
  (Airbnb/Direct 0-5, Booking.com 0-10), while the Review Hub store normalizes every score to
  0-10 (Channex `guest_rating_overall`). `nativeToNormalized(rating, source)` bridges the two,
  so a host setting "4.5+" on Airbnb always means the same bar as "9+" on Booking.com
- `createDefaultReviewConfig()`: `mode: 'auto'`, all 3 channels enabled at 4.5 (Airbnb/Direct)
  or 9 (Booking.com), `requireText: true`, `minCountToShow: 3`, `batchSize: 12`
- `resolveAutoReviews(records, listingIds, config)`: the resolved pool. In scope, not
  `is_hidden`, channel enabled, rating clears `nativeToNormalized(minRating)`, has text when
  `requireText` is on. Uncapped and sorted newest-first by `review_received_at`. Pure, never
  mutates `records`
- `autoReviewStats(records, listingIds, config)`: `{ total, byChannel }` for the live match
  count in the rules form
- `meetsMinCount(autoTotal, manualCount, config)`: whether the published site should render
  its reviews section at all. Manual testimonials count toward `minCountToShow`, so a new
  property with host-written testimonials can clear the gate before any guest review does

**Display and pagination:**
- `batchSize` is not a cap. `PreviewStep.vue` renders `batchSize` reviews at a time behind a
  **Load more reviews** button that appends another batch per click and disappears once every
  matching review has been shown
- `minCountToShow` hides the entire reviews section on the published site until the combined
  auto + manual count reaches it

**Persistence:** `Website.reviewConfig?: WebsiteReviewConfig` (`app/components/website-builder/data/websites.ts`)
is optional so the seeded mock websites need no migration. Readers fall back to
`createDefaultReviewConfig()` when it is missing. `app/pages/website-builder/create.vue` seeds
a fresh default config for a new website and restores `site.reviewConfig ?? createDefaultReviewConfig()`
when editing an existing one, so reopening a published site returns it in the mode and with the
rules it was saved with.

**Publish state (`setWebsiteStatus`).** A website can be taken back down:
`setWebsiteStatus(id, status)` (`data/websites.ts`) flips `published` ↔ `draft` by spread
mutation and re-stamps `lastUpdated`. **Unpublishing is not a delete** — the site keeps its
content, `reviewIds`, `reviewConfig` and `propertyIds`, so it goes back up unchanged. Two
entry points: the card menu on `/website-builder` (Unpublish on a live site, Publish on a
draft, disabled while building), and the wizard's Preview step, where a live site's secondary
button reads **Unpublish** rather than "Save as draft" — persisting a draft over a published
site always unpublished it, the label just never said so — and its primary button reads
"Update Website". Taking a site off the internet is confirmed with an `AlertDialog` on both
surfaces; publishing again is not, since it only restores what the host already built.
⚠️ `persistWebsite` in `PreviewStep.vue` now also writes `propertyIds`. It previously did
not, so every saved site had **no coverage recorded** and `getListingIdsForWebsite` fell back
to "coverage unknown" — which the promo-code scope step reads as "may cover anything".

**Picking UI (`ReviewPickerCard.vue` + the rebuilt Reviews step):** picking a review means
judging what it says, so the review text is the largest thing on screen, not a one-line
truncation. `WebsiteBuilderReviewPickerCard` (`app/components/website-builder/ReviewPickerCard.vue`)
renders one review as a card — guest, score in the channel's own scale, channel, listing,
date, then the comment clamped to three lines with a **Read full review** expander — and is
the single card used by all three lists: the hand-pick list, the Auto pool, and the host's
own testimonials. Props: `data` (a `ReviewCardData` view model, so a manual testimonial uses
the same card), `selectable` (Manual only; Auto cards read "Shows on your site" instead of
`selected`, `editable`, `removable`. One tick per card means the same thing in both modes —
"this shows on the site" — but writes to a different place: a pick in Manual
(`selectedReviewIds`), an un-hide in Auto (`excludedReviewIds`), routed through
`toggleShown()` / `isShown()`. The footer reads `Shown on site` / `Hidden`; only the host's
own testimonials are unselectable, since they always show.
- Both modes share **one toolbar and one flat card list** — search (guest, wording, listing),
  property filter (rendered only when the site markets more than one), channel filter, sort
  (newest / highest rated), a "with a written comment" filter in Manual, and **one** bulk
  control — a shadcn `Checkbox` plus a sibling `<Label for>` (never wrapping: that
  double-toggles reka-ui), labelled `Select all` / `Unselect all`. **Manual only** — Auto has
  no bulk counterpart on purpose: hiding there is the escape hatch for the odd review, and a
  "hide all" would just be Manual mode with extra steps. It is **tri-state**:
  `bulkSelectState` returns `'indeterminate'` while only part of the visible set is picked,
  and since reka-ui resolves a click on an indeterminate box to `true`, `setBulkSelect` reads
  that as "take everything on screen". The indeterminate look needs its own
  `data-[state=indeterminate]:*` classes plus a `<Icon i-lucide-minus>` in the default slot —
  the base component paints and ticks only `data-[state=checked]`. Per-property collapsible groups
  with per-group pagination are **gone**: each card names its own listing, so a property is
  just another filter. The list is **paged** (shadcn `Pagination`, 10 a page, prev / numbers /
  ellipsis / next, hidden at a single page); the status line above it reads a range,
  `Showing 11-14 of 14 reviews`. A `watch(totalPages)` clamps the page so a tightened rule
  cannot strand the host past the last one, and every filter change resets to page 1.
  ⚠️ `Select all` stays scoped to `filteredPool`, **not** the page on screen — paging is a
  view, never a selection boundary. The wizard's own Back/Next carry
  `data-testid="review-step-back|next"`, because the pager's Next now also matches on text.
- **Layout.** The step root is `mx-auto w-full max-w-3xl`, so every section — mode cards,
  rules, picker, testimonials, preview — shares one medium reading width, centred in the page
  instead of stretching over a wide screen. Reviews render as a **single-column list** (`flex flex-col gap-2`), never a
  two-column card board: a row per review keeps the comment on one measure and the scan
  vertical. The same goes for the testimonials and the collapsible preview.
- **Scale (a site with dozens of reviews).** The toolbar is `sticky top-0` inside the picker
  card, so filters and the bulk control stay reachable while scrolling. `Select all` is
  **visible-scoped** — it acts on `filteredPool`, everything matching the current filters,
  not just the 12 rendered — and `Unselect all` drops only those, leaving picks made under a
  different filter alone. Because "all" therefore means something different with a filter
  running, a status line under the toolbar spells it out: `Showing 12 of 34 reviews ·
  filtered from 47 · 6 selected` (the middle clause only when a filter is narrowing, the last
  only in Manual). Do not put the count back in the button label — it reads as "select these
  N" and hides the distinction between the visible slice and the matching set.
- **There is no main-page toggle.** Every review the site publishes is shown on the home
  page as well as the reviews page, so `featuredReviewIds` / `featuredManualReviewIds` are
  **derived in `emitUpdate()`** from `featuredPool` (the Auto pool, or the hand-picked
  records) and every testimonial — they stay in the payload because the published site and
  `Website.featuredReviewIds` still read them, but nothing is starred by hand. Deriving them
  at emit time also means a rule change, a mode switch or an undone pick can never strand a
  stale id, which the old star flow needed a pruning watcher to handle. The old UI hid the
  star until a review was selected and kept a second, duplicate list ("Choose main page
  reviews") in Auto mode; both are gone.
- Mode is chosen with **two cards that state what they currently yield** ("5 reviews would
  show right now" / "0 of 9 chosen"), not a segmented pill plus a helper line.
- Own testimonials render as the same cards (edit + remove per card) rather than a chip row,
  and the dialog now **edits** an existing testimonial as well as adding one. Its rating is
  entered in the chosen channel's native scale and stored normalized 0-10 via
  `nativeToNormalized`, so `ManualReview.rating` keeps its existing meaning.
- ⚠️ The card's checkbox binds `model-value` / `@update:model-value`. The old row used
  `:checked` / `@update:checked`, which reka-ui ignores — the box never rendered as checked
  and only the row's own `@click` made picking work at all.

**Related fix (`app/components/review-hub/data/types.ts`):** `getDisplayScore()` used to halve
only for `source === 'airbnb'`, so a Direct review (also a 5-star channel) rendered as `10.0/5`
instead of `5.0/5`. It now derives the halving from `getDisplayMax(source) === 5` (true for
both Airbnb and Direct, false for Booking.com's 10-point scale). Since `FeedTable.vue` and
`DetailGuestPanel.vue` both call the shared `getDisplayScore()` helper, this one change
corrected their Direct-channel display too.
