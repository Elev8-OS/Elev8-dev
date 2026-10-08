> Split out of CLAUDE.md to keep the always-loaded context small. Read this file before working on this area; keep it updated when the code changes.

### Damage Protection (`app/components/reservations/data/damage-protection.ts` + `app/composables/useDamageProtection.ts`)

Something breaks: who pays, and out of what? The guest chooses before arrival between a
non-refundable **damage waiver** and a **security deposit, which is a card kept on file**.

**Set ONCE FOR THE TENANT, in Settings, Damage protection** (owner's decision, 2026-10-08; it replaced the
per-listing setup of 2026-10-06). There is no Protection tab on the listing detail page any more.
- ⚠️ **One upsell of category `'Damage Protection'` (`PROTECTION_CATEGORY`) sells ONE package**: its
  single item, `UpsellItem.coverTier` (an Elev8 Cover tier) plus `price`, what the guest pays per 30
  nights. Bronze and Silver are two upsells. The drawer's Package step is a tier picker and a price,
  not an item list (`packageOf`, `protectionPackageOptions`). ⚠️ The drawer has **no Listings step** for
  this category and saves `assignedListings: []`: an upsell's listings mean nothing for protection.
- **`ProtectionSettings`** (`damage-protection/data/listing-protection-setup.ts`, framework-free), one
  record for the tenant: `waiver`, `packageServiceId` (the protection upsell every listing offers),
  `deposit`, `depositLimit` (flat, charged in each listing's own payout currency), `settleWithinDays`,
  `depositChannels`, `payer` (`'guest' | 'host'`), `hostFallback`, `hostFallbackDays`. Persisted to
  `elev8-damage-protection-v5` (v4 held per-listing setups and payers and is not read).
- ⚠️ **The waiver runs on EVERY listing at once, with the one package.** There is no listing picker.
  `selectedPackage(services, settings)` is the package while its upsell is active and sells one;
  pausing or deleting it turns the waiver off everywhere (`no_package`).
- ⚠️ **The waiver brings the deposit** (`applySettingsPatch`): switching the waiver on switches the
  deposit on, and the deposit cannot be switched off while the waiver is (the switch shows on and
  locked). With the waiver off, the deposit is its own switch and can run alone, without a package.
- ⚠️ **`policies` and `assignments` are DERIVED** (computed in `useDamageProtection` by
  `listingPolicy(settings, package, listing, payoutCurrency)`), never stored: one policy per protected
  listing, id `lp-<listingId>`, one band 1 to open-ended. Everything downstream (`buildOptions`,
  freezing, host cover, Tern sync, billing) still reads `DamageProtectionPolicy`, unchanged. No policy,
  with the reason in `block`: `no_package`, `nothing_offered`, `no_deposit_channel`,
  `no_payout_currency`, `currency_mismatch` (the package currency is not the listing's payout
  currency; no conversion, ever, so the IDR listings are not covered by a USD package). A listing with
  no payout account still runs the waiver, in the package's currency.
- ⚠️ **One setup for every stay length.** Extending a stay only adds packages at the frozen price and
  never re-opens the choice.
- **Deposit channels**: a deposit ON ITS OWN is asked on `depositChannels` (absent = Direct only).
  ⚠️ With the waiver on they are ignored: every channel is covered and the chips show on and locked.
- ⚠️ **A protection upsell is never sold as an upsell**: `sellableServices` / `isProtectionService`
  keep it out of the inbox order creator, the folio catalog (`folioCatalogRows`) and the promo picker,
  and off the **Upsells page** altogether (2026-10-08: `useUpsellServices().filteredServices` drops it,
  `CATALOG_CATEGORIES` leaves the category out of the create menu and filter). It is reached only from
  Settings, Damage protection (Edit package) and the activation wizard.
- Writers: `setProtectionSettings(patch)` (refuses `package_missing`, `host_needs_waiver`,
  `deposit_limit_missing`, `settle_days_missing`), `setProtectionPayer(payer)` (refuses
  `waiver_not_activated`, then as above) and `turnOffProtection()` (waiver and deposit off, guest pays,
  the package stays picked). All run `syncHostCover`; so does the upsell drawer after saving or deleting
  a protection upsell. Reads: `settings`, `currentPackage`, `packages`, `listingProtection(listingId)`
  (`policy`, `block`, `currency`), `payerFor(listingId)` (tenant-wide; the argument is kept for call sites).
- Seed (`seedProtectionSettings`): waiver on with `svc-dp-bronze` (USD 39), deposit USD 500 (Direct
  when alone), guest pays. Covers lst-1, lst-2, lst-18 (USD Stripe) and the listings with no payout
  account; lst-3/4/5 (IDR) are not covered. The demo stays keep the terms frozen on them, the Silver
  long stay on lst-18 included.

- ⚠️ **Three states per property, nothing else** (owner's decision, 2026-09-25):
  **no protection**, **guest pays** (the guest buys the waiver in the guest guide), or **host
  pays** (the guest is never asked; Elev8 bills the host the Tern per-stay fee and pays Tern).
  `ListingProtectionMode` (`off | guest_paid | host_paid`) is DERIVED: `off` means the listing
  has no policy (see above), otherwise the tenant's `settings.payer` decides.
- ⚠️ **A waiver covers EVERY channel. There is no OTA-only, and no channel-only waiver.**
  `protectionOffered` answers true for Airbnb and Booking.com whenever the policy offers the
  waiver, and the deposit beside it rides along on every channel too (`channelsSelectable` is
  false; the sheet shows the switches on and locked). Only a **deposit-only** policy picks its
  channels, and there an unset channel still falls back to `'skip'`, the OPPOSITE of the city
  tax `'host'` fallback. Do not unify the two fallbacks.
- ⚠️ **Status is checked before channel.** `GUEST_STAY_STATUSES` excludes `cancelled`,
  `blocked` and `owner_request`, which are all channel `Direct`. Owners make their own
  reservations and pay nothing, so an owner stay is never protected, on either payer.
- ⚠️ **The tenant never writes a coverage amount or an exclusion.** The waiver's cover comes
  from a **Tern tier** (`data/tern-products.ts`: Bronze / Silver / Gold plus Bronze+ / Silver+ / Gold+
  (2026-10-06): a "+" tier has its base tier's size (`baseTier`) and the SAME damage cover (`coverageCap`); only its
  liability limit is higher (`PLUS_LIABILITY_FACTOR`, placeholder) and it costs more, so
  `recommendedTier` only ever names a base tier and `tierTooSmall` compares sizes, never cover. Seeded
  as three unassigned upsells `svc-dp-*-plus`. Sized by
  `Listing.capacity`, each with a `coverageCap`, a fixed `perStayFee` Elev8 charges the tenant
  per package, and Tern's exclusions, which include wear and tear). A policy stores only
  `waiver: { tier, guestPrice }`: the one number the tenant types is what they charge the guest
  per package, shown next to Elev8's fee and the margin. **The figures are placeholders** until
  Tern hands over its price list, and they are **per currency, never converted**: only USD is
  priced today, so a waiver policy in IDR / EUR / CHF is refused by `policyErrors` ("The Bronze
  cover is not available in IDR yet"). The listings table flags a tier smaller than the
  property's size (`tierTooSmall`); a bigger one is never flagged.
- ⚠️ **One cover package lasts 30 nights** (`COVER_PACKAGE_NIGHTS`, `coverPackagesFor`, owner's
  decision 2026-09-29). A stay takes one package per started 30 nights (1-30 = 1, 31-60 = 2, ...):
  the **guest price and the Elev8 fee both multiply**, the **cover cap does not**. The count is
  frozen on the protection as `packages` (absent = 1, every protection written before), and
  `amount` / `elev8Fee` are stored already multiplied. `buildOptions` returns `packages` and
  `packagePrice`, and the guest card names them ("2 × USD 39.00, one for every 30 nights of your
  stay") only when there is more than one. The 30-night package and the 28-night long-stay band are
  separate rules: a 29-night stay is a long stay on one package.
- **Policy templates** (`POLICY_TEMPLATES`) are no longer assigned to anything. They remain the
  standard starting points for the demo stays' frozen terms, the Elev8 Cover pitch's try-out price
  and the demo guest guides. `WAIVER_TERMS` / `DEPOSIT_TERMS` word a listing's terms
  (`setupTermsText`).
- ⚠️ **A host-paid stay is covered by a real protection record**, written by `syncHostCover()`
  (from `hostCoverProtection`: `paidBy: 'host'`, `amount: 0`, `acceptedVia: 'host_cover'`, tier
  and `elev8Fee` frozen), so claims, the partner claim and the Elev8 fee all hang off something
  frozen. It runs on `hydrate()`, after every settings or payer change and after a protection upsell is
  saved; there is no booking-created hook.
  It covers a guest stay that has not checked out and has no protection yet (or only an
  unanswered `awaiting_choice`); it never overwrites a guest's own accepted choice; it closes a
  cancelled stay's cover with **nothing to refund**; and it removes the cover from a stay that has
  not started, with no claim, once the tenant stops being host-paid. Idempotent.
  `isOfferedFor` is **false** on a host-paid listing: the guest is never asked. A host-paid
  listing needs no guest guide section (`listingsMissingGuideSection` skips it), and the waiver
  switch cannot be turned off while the host pays (`host_needs_waiver`).
- **The Elev8 fee** is frozen on every waiver protection as `elev8Fee`, and `elev8FeeTotals`
  reports it per currency, split guest-paid / host-paid, as its own figure on the worklist,
  never netted against what guests paid.
- ⚠️ **`amount`, `coverageCap`, `termsVersion` and `termsText` are FROZEN at acceptance.**
  `policyId` is provenance, never a live join. Same rule as a folio catalog pick.
- ⚠️ **Nothing here writes `priceDetails` or the folio.** A damage charge is not revenue, so
  it must never reach `guestPaid`, `payout` or an owner statement; and
  `useReservationFolio.commit()` REPLACES `priceDetails.extras` outright, so a second writer
  of that field is silently wiped by the next posting. Excess damage is posted to the folio
  BY HAND: deciding a guest owes more than they agreed is a judgement call.
- ⚠️ **No currency conversion, ever.** A package priced in another currency than the listing's
  payout account builds no policy (`currency_mismatch`); the Settings page's Listings table marks such
  listings "Not covered", and the upsell drawer refuses a package in a currency Elev8 Cover does not price.
- **States**: `awaiting_choice` → `waiver_active`, or `card_on_file` → `deposit_released`
  (closed, nothing charged) / `deposit_charged` / `charge_failed` (retryable), plus `cancelled`.
  Buckets (derived): `on_file` until check-out, then `decision_due`, `decision_overdue` past
  `settleDueAt`, `failed`, `refund_due` (a cancelled stay's waiver fee), `settled`. The policy's
  `deposit.settleWithinDays` replaced the old charge-lead and refund-window days; the storage
  key moved to `elev8-damage-protection-v2` so a v1 policy cannot load with the dead fields.

**A claim is recorded on BOTH paths.** `ProtectionClaim` is what the saved card is charged for on a deposit;
on a waiver it moves no money and records what the pot paid out. `waiverPotTotal` is the
only signal that says whether the fee is priced right, and the worklist shows fees collected
against claims paid as **two figures, never netted**. `claimCoverage()` splits an assessed
amount into covered and excess; `isClaimValid` deliberately does **not** cap the amount,
because capping at input time would shrink the operator's own record of what a stay cost.

⚠️ **`canSettle` refuses while any claim lacks `guestNotifiedAt`.** A charge the guest first
meets on their card statement is a chargeback, so nothing is charged, and nothing closed, until
every claim has been told. `settleDeposit` then makes **one** off-session charge for the covered
total (`chargeableTotal`), never one per claim, or closes without a charge when that total is
zero. The excess above the limit is still posted to the folio BY HAND. A charged deposit cannot
be undone here (returning money is a gateway refund this mock does not model); a deposit closed
without a charge can be reopened. `notifyGuestOfClaim` reaches the inbox
through a **dynamic** `import('~/composables/useInbox')` (a static import closes a cycle,
same rule as `useUpsellLockAccess.messageGuest`). It sends to the reservation's thread, or,
when there is none, to a **new email conversation** opened on the guest's address by
`useInbox.ensureConversationForReservation`: a direct booking often has no inbox thread, and
refusing there left the claim unnotifiable and the card uncharged forever. Only a guest with
no thread **and** no email returns `no_contact`, leaving the stamp unset so the gate stays shut
rather than opening on a notice nobody received. ⚠️ The stamp is written when the message is
queued, not when `sendMessage`'s mock reports it sent, so a notice that then fails to send
(the mock fails 10 percent at random) still counts as given; a real integration must stamp on
delivery.

**A claim can be raised from a cleaning report** (`data/claim-cleaning.ts`, framework-free).
`ProtectionClaimDialog` lists the stay's finished cleaning reports above the manual form; each
checklist line marked **Problem** is one pickable finding, labelled Problem in red (towels on
the floor is a problem nobody pays for, a cracked screen is one the guest may; that stays a
staff call). Picking one fills the label and a reason naming who found it and when, and
attaches the report, **with the housekeeper's photos**, as evidence. The amount is never
filled: a housekeeper reports what broke, not what it costs. Manual entry is unchanged.
- ⚠️ **The report's free-text `CleaningFeedback.damages` list is NOT offered as a finding.** It
  carries no photo, so a claim raised from it would show the guest a sentence and nothing to
  look at; it was offered at first and removed on request. It still renders in the report
  panel's Guest Cleanliness tab. `ClaimCleaningReport` has no `kind` field for the same
  reason: every finding is a Problem.
- **Evidence is an upload OR a cleaning report, either one alone** (`hasClaimEvidence`). The
  guest notice and the claim card both name it via `claimEvidenceSummary`.
- **The dialog shows the photos, not just a count** (`ClaimPhotoThumb.vue`): a thumbnail inside
  each finding row, the picked report's photos under Evidence, and a preview of each uploaded
  image. **Clicking any of them opens it in the dialog's own image viewer, zoomable**, never
  a new tab. A finding row is a bordered box holding the select button and, beside it, the
  photo buttons: a photo inside the select button would be a button inside a button, so
  opening a photo never picks the finding. ⚠️ An upload's preview is a local object URL
  kept in `previews`, used for display only; `evidenceUrls` still stores the mock path, and the
  object URL is revoked on remove, on reopen and on unmount. A PDF keeps its file row. The same
  file picked twice is recorded once. A photo that fails to load reads "Photo unavailable".
- ⚠️ **`ProtectionClaim.cleaningReport` is a SNAPSHOT** (`ClaimCleaningReport`, photos
  included in `photoUrls`), copied in `recordClaim`. `cleaningJobId` / `findingId` are provenance, never a live join, so editing
  the housekeeper's report later cannot change what the guest was told.
- ⚠️ **Reports are matched on the job's `reservationId`** (`cleaningReportsForReservation`),
  never re-derived at claim time. The link itself is set automatically, see below.
- ⚠️ **A cleaning on or before check-in day is never offered**, even though it is linked
  (`cleaningFollowsStay`): it prepared for this guest's arrival, so what it found was there
  before they were. This is what makes linking a pre-arrival cleaning to the arriving stay safe.

**Every cleaning links itself to the stay it belongs to** (`cleaning/data/cleaning-link.ts`,
framework-free), resolved against **both** stay sources (`allStays` in
`operations-calendar/data/calendar-stays.ts`), so a cleaning can link to a `listing.bookings` id
(`bk-*`) as well as a Reservations-module one; only the latter can ever reach a damage claim.
`useCleaningJobs.createJob` runs `resolveStayForCleaning` on every create, from
any surface (the calendar, a listing's maintenance tab); a caller that already knows the stay (a
reservation's own schedule, an owner stay) passes `reservationId` and is trusted. One stay can own
any number of cleanings. The rule, same listing, same room when both name one, first step that
finds anything wins:
1. a guest **in the house** that day (`checkIn < day < checkOut`): mid-stay and daily cleaning;
2. a guest **checking out** that day: the turnover clean, which beats a same-day arrival;
3. a guest **checking in** that day: the pre-arrival preparation.
- **A date with no stay creates the cleaning unlinked.** That is a normal cleaning, not an error.
- ⚠️ **A tie links to nothing.** Two stays at the same step (two rooms of a multi-unit listing and
  a cleaning with no room) is a guess, and a guess can put a bill on the wrong guest.
- Cancelled stays, maintenance blocks and inquiries never count; an owner stay does.
- ⚠️ **The day is read in property time** (`cleaningDateKey`, UTC+8), never sliced off the
  string: a job stored as `...Z` would land on the previous day before 08:00 local.
- **Moving a cleaning** (`updateJob`): to another listing or room relinks from scratch, possibly to
  nothing; to another date relinks when a stay fits the new date and otherwise keeps the old link,
  so a turnover clean pushed to the next morning still belongs to the guest who left. A patch that
  names `reservationId` is taken as given.
- Seeded jobs with no stay are linked on load by the same rule (a seed's `null` means "not
  recorded"). Of the 33 unlinked seeds, 5 fall on a `listing.bookings` stay and link to it; the
  other 28 fall on no stay and stay unlinked.
- `CleaningJobForm` previews the link under the date ("Linked to Anna Schmidt's stay, 1 Nov to 5
  Nov" / "No stay on this date..."), computed with the same rule the save uses.
- **One finding, one claim.** `recordClaim` refuses `finding_already_claimed`, and the dialog
  shows an already-claimed finding disabled and marked **Claimed**. A report that flagged
  nothing still renders ("Flagged nothing."), distinct from "no report linked".
- ⚠️ **Demo stay names follow the listing ids.** They used to call lst-1 "The R Villa Merapi" and
  lst-2 "Villa Sanur Retreat"; those are not those listings' names (Merapi is lst-4), so the
  Reservations page and the Operations Calendar named one stay's property two ways. They now use
  the listings' own names (`LST_1`, `LST_2`, `LST_18`), and a spec asserts it. The 60-night stay
  (`res-dp-long-stay`, Hannah Brecht) moved from lst-1, where it overlapped every other demo stay
  for two months, to **lst-18 "Apartments Pool - Room 3"**: free across its window, same Seminyak
  Suites property as lst-2, added to the same USD Stripe account (`pay-1`) and guest guide, with
  its own long-stay band. Demo cleaning times are written `+08:00` (`at()`), never `toISOString()`,
  because the calendar chip slices the time off the string.
- Demo: `cln-dp-unnotified` (`damageProtectionDemoCleaningJobs`, appended to the cleaning
  seed) is the check-out cleaning of `res-dp-unnotified`. Its shower-screen Problem is already
  on the seeded claim, which carries both the cleaning report (with its photo) and an upload;
  the torn sofa cover Problem is still pickable.

**Cleaning checklist status is OK or Problem, nothing else** (`CleaningChecklistItemStatus`,
`CLEANING_CHECKLIST_STATUS_LABELS` in `cleaning/data/cleaning-jobs.ts`). There is deliberately
no N/A: a line that does not apply belongs off that property's checklist, and a third answer is
where a real problem gets parked because photographing it was a hassle.
- ⚠️ **A Problem must carry at least one photo** (`CleaningChecklistItem.photoUrls`). The rule
  is stated once, in `checklistItemError`. Reports are written in the housekeeping app, which is
  **not in this repo**, so that app must refuse to submit a Problem without a photo; nothing
  here writes a cleaning report. The dashboard does not trust the writer either:
  `CleaningReportPanel` shows each Problem in red with its photos (click to view full size,
  zoomable, in the panel's own viewer), and flags one that arrived
  without a photo (`problemsMissingPhotos`) rather than rendering it as if it were complete.
- A seed test asserts every seeded Problem has a photo. Seed photos are real Unsplash URLs, so
  they render; a photo that fails to load falls back to a stated "Photo unavailable".

⚠️ **A cancellation admits no claim.** No stay happened, so no damage did. `resolveBucket`
reads `reservation.status`, so a cancelled stay acts **immediately** regardless of check-out:
a saved card is `decision_due` (release it, "Release card"), a waiver fee is `refund_due`
("Refund waiver fee"); `cancelProtection` does either. This deliberately does not reuse the
graduated ladder in `upsells/data/cancellation-policies.ts`, which prices a service the operator
held capacity for. A no-show on a non-refundable rate is a folio charge.

⚠️ **`charge_failed` keeps its claims and stays open** (`failed` bucket, `DEPOSIT_CHARGE_FAILED`
alert, Retry charge). A declined charge that read as settled would lose the money silently.

**Long stays** (`LONG_STAY_THRESHOLD_NIGHTS = 28`) no longer have their own band: a listing has one
setup for every length (2026-10-06). Wear and tear stays an explicit exclusion, and there is
deliberately **no recurring waiver billing**. `useReservationsModule.extendReservation` calls
`reassessOnExtension` (⚠️ through a **dynamic** `import()`: `useDamageProtection` imports the
reservations composable). An active waiver that now needs more packages takes them at the prices
**frozen on the stay** (`withExtraPackages`, per-package price read back as `amount / packages`),
never the live setup, with a "Cover packages added" activity line; collecting the guest's
difference is not modelled. Its band-boundary re-ask (`stay_extended_across_band`) cannot fire any
more while every listing has one policy.

**Upsells, Damage Protection category** (`UpsellDrawer.vue`): steps Basic Info, **Package** (the tier
cards with their cover, and the guest price with Elev8's fee and the margin), Settings (no Listings,
Visibility, availability, lock access, tax/service or WhatsApp users). Priced in USD, the only
currency Elev8 Cover prices today (the drawer has no currency field). Save refuses an unpriced tier
or a zero price.

**Settings, Damage protection** (`settings/DamageProtectionPanel.vue`, `/settings/damage-protection`,
in the sidebar under Booking & Payments after Payouts; the worklist's **Settings** button and Billing's
"Not activated" link point here). Top to bottom:
- **`TernActivationCard`** with the **Activate** button (or Connect Stripe without a Stripe payout).
- **Damage waiver** card: the switch (disabled until activated; once activation is undone it reads
  "Paused"), **Package, every listing**, read only (no picker, 2026-10-08: the waiver uses ONE upsell; "Paused" when
  its upsell is inactive) with **Edit package**, which opens `PartnerPackageDialog`: the SAME partner
  packages and guest price as the activation step (`PartnerPackagePicker`, shared), never the upsell form.
  Save calls `setWaiverPackage(tier, price, currency, turnOn)`; an edit leaves the waiver as it is and
  switches a paused upsell back on. "Choose a package" shows only when no package exists; saving it while
  active also turns the waiver on., the package summary
  with Elev8's fee, "What's covered" (`CoverageBreakdown`), **Who pays** (Guest pays / Host pays, Host
  pays disabled until activation and the waiver on) and, under Guest pays, the host-cover fallback.
- **Deposit** card: switch (on and locked while the waiver is on), card limit and decision days (saved
  on blur), Booking channels chips (locked while the waiver is on).
- **Listings** card, read only: every listing with its payout and what its guests are offered under
  these settings (Waiver or deposit / Waiver only / Deposit only / Waiver, host pays / Not covered, with
  the `blockText` reason, the no-Stripe note or the undersized flag).
- ⚠️ Specs that click the package cards fake ONLY `setTimeout` (`vi.useFakeTimers({ toFake: ['setTimeout'] })`):
  a faked clock dates the cards' click handlers in the future, and Vue drops the real-time click as stale.
- **Turn off** sits in the activation card beside Change bank account (shown while active and anything is on): `turnOffProtection()`.
- **Auto-activate host-paid protection if the guest doesn't buy the upsell** (Guest pays only):
  `hostFallback` + `hostFallbackDays` (1, 2, 3, 5, 7 or 14; default 1).
  `syncHostCover` covers a guest stay with no choice yet (or only `awaiting_choice`) once
  `hostFallbackDue` says the cut-off has come, with the same `hostCoverProtection` plus
  `autoHostCover: true` and an activity line saying the guest did not buy. ⚠️ From then on the guest
  is not asked (`isOfferedFor` is false for a stay the host covers). A deposit card or a bought waiver
  is never overridden. Turning the setting off removes the cover from a stay not started yet, as for
  host-paid. Needs the waiver on and the service activated. No scheduler: it runs on `hydrate()` and
  every settings change, like the rest of `syncHostCover`. Labelled "Host pays, guest did not buy" on the
  worklist, "The host (the guest did not buy it)" on the stay.
- The Elev8 Cover pitch dialog (`TernPromoDialog`, `tern-pitch.ts`) went with the listing tab (2026-10-08).
- Wording lives in `damage-protection/data/listing-protection.ts` (`waiverSummary`, `depositSummary`,
  `packageSummary`, `undersizedText`, `blockText`, `protectionRefusalText`).

**Permissions**: `damage_protection` is its own `PermissionModule`. `dashboardView` opens the
worklist, **`dashboardEdit` gates charging or closing a deposit and releasing a cancelled
stay's card**. Reading a stay
must not imply the right to take money from it.

**Alerts** (every one must stay in `FINANCE_TYPES` or it is invisible in the bell):
`PROTECTION_CHOICE_MISSING` (WARNING), `DEPOSIT_DECISION_DUE` (WARNING, after check-out:
charge or close), `DEPOSIT_DECISION_OVERDUE` and `DEPOSIT_CHARGE_FAILED` (CRITICAL),
`DAMAGE_CLAIM_RECORDED` (INFO, named for the claim because it fires on the waiver path too).
The three `DEPOSIT_REFUND_*` types went with the refund leg. `DEPOSIT_FAILED_AT_CHECKIN`
stays defined but is emitted by nothing again, as before this feature: nothing is charged at
check-in any more. Settling, retrying successfully and cancelling resolve the open deposit
alerts **directly**, not through `dismiss()`.

**Activating the damage waiver** (`data/tern-activation.ts` framework-free,
`useTernActivation`, owner's decision 2026-09-25). Before any waiver runs, the tenant activates
the service in a 5-step wizard (`TernActivationWizard.vue`, opened from `TernActivationCard.vue` at
the top of Settings, Damage protection): **Terms** (`TERN_ACTIVATION_TERMS`, the tier table, the
deductible) → **Package** (2026-10-08: ⚠️ the PARTNER's packages, never upsells. `useTernApi().fetchPackages
(PACKAGE_CURRENCY)` reads the partner's catalogue when the wizard opens (loading state; Tern's API v0 has no
catalogue endpoint, so the mock answers from `TERN_PRODUCTS` after 600ms; the picker reads it on mount), one card per tier with its size,
cover and Elev8's fee; then the tenant MUST set **Guest pays per package (30 nights)**, with the margin shown.
`ActivationDraft.packageTier` + `guestPrice`, both required (`validatePackageChoice`, shared with Edit package); starts from the
current package and its price. `PACKAGE_CURRENCY` is USD, the only currency the partner prices.)
→ **Who pays** (`ActivationDraft.payer`, Guest pays / Host pays, starts from `settings.payer`; applied with
`setProtectionPayer` right after `setWaiverPackage` on success) → **Bank account** (where Tern pays claims) → **Review** (with a Who pays row; ⚠️ guest-paid shows an amber
"Guests cannot skip this" warning: every guest booking must buy the waiver or leave a deposit card before
arrival), then **Activate** registers the
tenant as an organization on Tern (mock, 1.5s, stores an integer `ternOrganizationId`; a "simulate
Tern refusing" switch makes it fail). ⚠️ Tern's API v0 has no organization endpoint: in production
Tern sets the organization up and hands over its id, and the bank account is registered with Tern
outside the API (`ternRegistrationPayload` has nowhere to go yet).
- ⚠️ **A connected Stripe payout account comes first** (owner's decision, 2026-09-28).
  `hasConnectedStripePayout` (only `provider: 'stripe'` with `status: 'connected'` counts) backs
  `useTernActivation().hasStripePayout`; without it `activate` refuses (`no_stripe_payout`, checked
  before the draft), and every way in points to `PAYOUT_SETTINGS_PATH` instead of the wizard: the
  settings activation card and the listing tab banner show **Connect Stripe**, the Elev8 Cover pitch
  swaps its button for **Connect Stripe** with "First, connect a Stripe payout account", and the
  wizard itself shows a notice and keeps Activate disabled (Review row "Stripe payout account").
  Losing the Stripe account after activation is not handled: nothing deactivates the service.
- ⚠️ **There is no card step** (owner's decision, 2026-09-25). The per-stay fees go on the card the
  tenant already saved at onboarding for its Elev8 subscription:
  `useOnboarding().subscription.stripePaymentMethodId` is copied onto the activation as
  `billingPaymentMethodId` at Activate. Without one, `activate` refuses (`no_subscription_card`)
  and the Review step says so with Activate disabled. Onboarding stores no brand or last four, so
  the screens say "the card on your Elev8 subscription". Do not add a second card form.
- ⚠️ **Nothing that uses the waiver works until `status === 'active'`.** `pausedUntilActivation`
  pauses a policy offering the waiver WHOLE (its deposit too, rather than quietly becoming
  deposit-only on channels nobody picked), `setProtectionPayer('host')` is refused
  (`waiver_not_activated`), `syncHostCover` writes nothing, and no claim can be filed with Tern.
  A deposit on its own is not Tern's and keeps working. The Settings page marks a paused waiver
  and disables "Host pays".
- ⚠️ **A successful Activate switches the waiver on for EVERY listing** with the picked package, and
  the deposit with it: the wizard calls `useDamageProtection().setWaiverPackage(tier, guestPrice, currency)`,
  which writes the tier and price onto the waiver's ONE Damage Protection upsell (the current one, renamed
  "Elev8 Cover <tier>" only while it still has its default name; a new one when none exists, with no
  listings) and sets it as `packageServiceId` with the waiver on. Refuses `package_not_priced` and
  `guest_price_missing`. `useTernActivation` never reads `useDamageProtection` (that would close a
  cycle), so the write lives in the wizard. A settings change before activation is not refused: the
  waiver simply stays paused, and the page says so.
- ⚠️ **One bank account per tenant for now.** Whether Tern accepts one per listing is still to be
  confirmed with Tern; one account works either way, and `payoutAccountFor(listingId)` keeps its
  argument so a per-listing account needs no call-site change. The bank step **copies** from an
  invoice template's bank details (`bankDraftFromInvoiceTemplate`, provenance in
  `bankCopiedFromTemplateId`), never a live link, so editing an invoice cannot move where Tern pays.
- ⚠️ **IBAN or account number, never an IBAN specifically** (Indonesian banks issue none), with the
  mod-97 checksum from `owner-payout-details.ts`; an account number needs a SWIFT code, since a
  transfer from Tern crosses borders. Country is a two-letter code.
- ⚠️ **The card never goes to Tern.** `ternRegistrationPayload` carries the organization, the terms
  version and the bank transfer details only: Elev8 bills the tenant on its subscription card and
  pays Tern.
- A failed registration keeps what was entered (`registration_failed`, retry from Review); a reload
  mid-registration reads as failed, never active. Changing the bank later ("Change bank account",
  the wizard in `mode: 'bank'`) affects only claims filed afterwards.
- ⚠️ **The demo tenant starts ACTIVE** (`seedTernActivation`: BCA account, the demo subscription
  card `pm_demo`, `cover_org_demo_0001`) so the seeded waivers and insurance claims keep working; **Replay
  activation (demo)** resets it to show the flow. Persisted to `elev8-tern-activation-v1`;
  `useDamageProtection().hydrate()` hydrates it first.
- **Not implemented:** a real Tern API call or webhook, deactivating the service, per-listing bank accounts, and
  verifying the account (no micro-deposit or name match). A later change of the subscription card
  is not copied onto the activation.

**Elev8 billing the tenant on the 1st** (`damage-protection/data/waiver-billing.ts` framework-free,
`useWaiverBilling`, owner's decision 2026-09-28). On the 1st of every month Elev8 invoices the Tern
per-stay fee for every covered stay whose guest **checked out** in the month before, and charges it
to the card on the tenant's Elev8 subscription. Surface: **Settings, Billing** only
(`settings/BillingPanel.vue`, see `tenant-billing.md`). ⚠️ The `/damage-protection` worklist has **no
billing tab** (removed 2026-09-28, it duplicated Settings); it still runs `runDueBilling()` on mount so
a declined charge alerts early, and `WAIVER_INVOICE_PAYMENT_FAILED` links to `/settings/billing`.
- ⚠️ **Billed on check-out, not on booking**, the same way Tern bills Elev8 (monthly in arrears for
  completed bookings, per Tern's PMC handbook). A cancelled stay never reaches an invoice, so there
  are no credit lines. Guest-paid and host-paid stays are both billed.
- ⚠️ **The fee is the frozen `elev8Fee`** (already times the stay's packages), never re-read from
  `tern-products.ts`. Lines are snapshots (`WaiverInvoiceLine`, carrying `packages`; the PDF prints
  "Silver x2"), and `billTo` is frozen at issue.
- ⚠️ **One invoice per currency per month**, numbered `E8-DW-YYYYMM-NNN` (running within the month).
  Nothing converted or blended.
- ⚠️ **A stay is billed once, ever** (`billableLines` skips any reservation id already on an invoice),
  and **a month once**: every billed month is a `WaiverBillingRun`, even with nothing to bill.
- **Billable** = `option: 'waiver'`, `state: 'waiver_active'`, a numeric `elev8Fee`, reservation
  status not `cancelled` / `blocked` / `owner_request` / `inquiry`, check-out inside the month.
- **No scheduler**: `runDueBilling(now)` catches up every 1st since the month of
  `activation.registeredAt` (`periodsDue`), called on the worklist's mount. **Run the 1 Oct billing now
  (demo)** passes the coming 1st as `now`; the next invoice then moves on a month. Settings, Billing shows the
  month so far (`upcoming`, check-outs up to today) and the history, each row
  downloadable (the stay lines are in the PDF) (`app/lib/waiver-invoice-pdf.ts`, drawn in the shared `elev8-invoice-pdf-kit.ts` frame, see `tenant-billing.md`; it states in every state
  whether it was paid).
- ⚠️ **Same card as the subscription.** The mock charge (1.5s) is **declined while
  `useSubscriptionBilling().needsPaymentUpdate`** (the header's payment-failed banner), with that
  decline reason. That raises `WAIVER_INVOICE_PAYMENT_FAILED` (WARNING, in `FINANCE_TYPES`); **Retry
  charge** (on the failed row of the Settings billing history, not permission-gated, like Update card) goes through once the card is updated there and resolves the alert. A
  reload mid-charge reads as `payment_failed`, never paid. Demo: the seeded subscription is failing,
  so the demo run shows the declined path first.
- **Bill to** is the onboarding profile when filled in, else the tenant's default invoice template
  company (with its VAT number). The issuer is `ELEV8_BILLING_ENTITY`, **Elev8 Software AG**
  (confirmed 2026-09-28). ⚠️ Name only: its address and tax number are not known yet and none is invented.
- **Emails to the tenant** (`damage-protection/data/waiver-billing-emails.ts` framework-free, sent by
  `useWaiverBilling.charge()` through the mock `server/api/billing/send-email.post.ts`, which logs):
  `invoice_paid` on the 1st (every stay line, amount, card), `payment_failed` (the decline reason,
  "nothing was taken", update the card and retry in Settings, Billing), `payment_received` after a
  retry went through. `waiverBillingEmailKindFor` decides: a failure is emailed **once per invoice**,
  not on every failed retry; paid after a failure email sends `payment_received`, not `invoice_paid`.
  - Recipient: `useTenantBillTo().billingEmail()`, the signup email (`onboarding.state.email`), else the
    default invoice template company email; none means no send. Read at send time, not frozen.
  - ⚠️ **Never shown to the tenant.** `invoice.emailsSent` is internal, for idempotency only. Settings,
    Billing is the tenant's point of view: no "emailed to" log, no resend (owner's call 2026-09-29).
  - ⚠️ Sender is **Elev8 Software AG by name only**, no address invented. The PDF is an attachment
    descriptor (`{ filename, invoiceId }`); the real provider renders it server-side and attaches it.
  - A failed send never touches the charge and is left unrecorded; the mock does not retry it.
- **Not implemented:** a real charge or Stripe invoice, a scheduled job, tax on the invoice (none is
  added: Tern's rate is stated tax-inclusive, Elev8's own VAT position is a finance decision), a real
  email provider (sending address, PDF attachment, retries), and suspending the waiver on a long-unpaid
  invoice.
- Persisted to `elev8-waiver-billing-v1`. Tests: `tests/lib/waiver-billing.spec.ts` (10),
  `tests/composables/useWaiverBilling.spec.ts` (13), `tests/lib/waiver-invoice-pdf.spec.ts` (4),
  `tests/lib/waiver-billing-emails.spec.ts` (7).

**Insurance partner (master policy)** (`data/partner-claims.ts` framework-free,
`usePartnerClaims`, owner's decision 2026-09-24). The property manager is the insured under a
master policy with an insurance partner. What the waiver pot pays on a claim is claimed back
from the partner for the part **above the deductible**, and the partner pays **by bank
transfer** into the account the tenant registered at **activation** (see below). The guest is
never a party to it.
- ⚠️ **Elev8 integrates with the partner ONCE, for every tenant.** There is no per-tenant
  partner, contract or API key. `elev8CoverPartner` (`damage-protection-seed.ts`, **Tern**, with
  mock policy number and terms until the contract lands) is a read-only platform constant: policy
  number, currency, `deductiblePerClaim`, optional `maxPerClaim`, `paymentTermsDays`. What a
  tenant gives is only at activation: a card and a bank account.
- ⚠️ **The payout lands in the tenant's activation bank account, by bank transfer, never Wise
  and no longer the Stripe payout account** (owner's decision, 2026-09-25;
  `stripePayoutAccountFor` is gone). `usePartnerClaims().payoutAccountFor` returns
  `useTernActivation().payoutTarget` (the Tern organization id plus a masked label, "BCA ••••
  3456"). It is frozen on the claim at filing (`payoutAccountId`, `payoutAccountName`), so a later
  bank change cannot redirect money on its way. Until the service is active, submission is refused
  (`waiver_not_activated`) and the panel says where to fix it. Claims filed before this change keep
  the Stripe account they froze.
- `partnerEligibility`: waiver-covered amount minus the deductible, capped per claim. At or below
  the deductible the pot carries it and it is **never filed** (and never listed). A deposit claim
  or another currency is refused.
- ⚠️ **`ProtectionClaim.partnerClaim` freezes what was filed** (`claimedAmount`, `deductible`,
  `policyNumber`, partner name, payout account) at submission.
- **Statuses** (`PartnerClaimStatus`): `submitting` → `submitted` | `submission_failed` (retry on
  the same record, or withdraw) → `under_review` → `info_requested` ⇄ (`info_sent`, our answer,
  back to `under_review`) → `approved` / `partially_approved` / `rejected` → `payout_scheduled` →
  `paid` → `received`, plus `withdrawn`. ⚠️ `paid` is the partner's word that it sent the money;
  `received` is staff confirming it **arrived in the bank account**, with the amount that
  actually arrived. `payoutShortfall` flags anything short of the approval.
- ⚠️ **Every change goes through `applyPartnerEvent`**, staff action and webhook alike: a
  duplicate event id is refused (`duplicate_event`), an out-of-order one is refused
  (`illegal_transition`, the `NEXT` table), an approval above the claim or a rejection without a
  reason is refused. Partial vs full approval is read off the amount, never trusted from the event.
- ⚠️ **The partner is reached through the Tern API layer** (see *Tern API integration* below):
  `submitToPartner` syncs the stay's Tern booking, creates the Tern claim (gross amount) and uploads
  the evidence; Tern's replies come in by **polling** (`pollPartnerUpdates`); answering an
  information request and withdrawing are Tern calls too. `simulatePartner` plays Tern's staff on
  the mock ("Simulate partner response", offering only the replies that can follow the current
  status) and then polls, the way production reads changes.
- Writes go through `useDamageProtection().patchClaim` (one narrow door: only `partnerClaim`, one
  activity line "Insurance claim update" per step), so `useDamageProtection` stays the only writer
  of the protection. `removeClaim` refuses a claim filed with the partner (`filed_with_partner`).
- **Surfaces**: `PartnerClaimPanel.vue` on every waiver claim card in the reservation section
  (takes the stay's `listingId`, unused while there is one account per tenant); an **Insurance claims** tab on
  `/damage-protection` (`PartnerClaimTable.vue`, queues To submit / Action needed / With partner /
  Awaiting payout / Confirm receipt / Closed, and four per-currency figures never netted:
  claimable not filed, with the partner, approved not received, received); the evidence PDF
  prints an *Insurance claim* section.
- **Alerts** (in `FINANCE_TYPES`): `PARTNER_CLAIM_SUBMISSION_FAILED`, `PARTNER_CLAIM_INFO_REQUESTED`,
  `PARTNER_CLAIM_REJECTED` (WARNING) and `PARTNER_CLAIM_PAYOUT_OVERDUE` (CRITICAL, from
  `emitPartnerAlerts` once the payment terms since approval have passed). Answering, withdrawing
  and a payment resolve the matching alert directly, keyed by `claim_id`.
- Demo: six waiver stays on lst-1 (`res-dp-ins-*`) plus Hannah Brecht's long stay make every queue
  reachable: to submit, information requested, approved and overdue, paid awaiting confirmation,
  received USD 15 short, rejected, and one below the deductible.

**Claim evidence PDF** (`app/lib/claim-evidence-pdf.ts`, jsPDF, the invoice / owner-statement
document family). **Download evidence** on each claim card builds one A4 file for a dispute or a
chargeback: guest and stay, the claim (reason, assessed, covered, excess), when the guest was
notified (stated in amber when they were not), the protection chosen with the saved card by
its last four digits, the frozen terms and the **quoted charge consent**, the cleaning report,
the attached files, and the photos **embedded**, two a row, capped at 70mm tall. The letterhead
is `useInvoiceTemplates().getTemplateForListing`, like the other documents.
- ⚠️ **The file always says whether the card was charged.** "Charged to card" appears only once
  the deposit is `deposit_charged`. Until then the claim reads "Covered by the deposit ... Not
  charged yet." and the protection block states the card's position in every state (on file and
  not charged yet, declined, closed without a charge, released with a cancelled stay). A missing
  line must never be what tells a dispute reader that nothing was taken.
- ⚠️ **A photo that cannot be embedded is listed, never dropped** ("Not embedded ... could not
  be loaded into this file: <url>"). `loadEvidencePhotos` fetches each one to a data URL first;
  jsPDF takes PNG and JPEG only, so anything else, a 404, or a refused `addImage` lands in that
  list. The demo's uploaded evidence is mock paths (`/mock/evidence/...`), so it always does;
  the cleaning photos are Unsplash URLs, which send `access-control-allow-origin: *`.
- A section heading carries `keepWith`, the room its first item needs, so "Photos" never sits
  alone at the foot of a page with its photo overleaf.
- ⚠️ `tests/setup.ts` stubs `fetch` (it returns an empty text body), so a real render in Vitest
  must hand `loadEvidencePhotos` its own fetcher. The spec replaces jsPDF with a recorder; after
  changing the geometry, render a real file and look at it (`pdftoppm -png`).

**Surfaces:** `ReservationDamageProtectionSection.vue` (accordion, right after city tax, with
the same header and `px-3` content padding as the city tax and folio sections: a
`lucide:shield-check` icon, the title, then the status chip),
`ProtectionClaimDialog.vue` (shows the covered/excess split live),
`ProtectionChoiceDialog.vue` (staff recording a choice at the desk, the only resolution for
`awaiting_choice` since a fee cannot be charged against terms nobody accepted; a deposit takes
a mock card form, the consent wording and a "simulate a declined card" switch, and hands the
card back for the section to save FIRST, so a declined card records nothing),
`DamageProtectionStatusChip.vue` (shared with `ReservationTable`), the `/damage-protection`
worklist, the Upsells Damage Protection service, Settings, Damage protection, and in the guide app
`sections/DamageProtectionSection.vue` + `forms/DamageProtectionForm.vue` behind
`POST /api/guest-guides/by-token/[token]/protection-choice`.

⚠️ **That endpoint's body never accepts a `reservationId`** — the token identifies the
reservation. Same access model as `saveForCurrentOwner` in `useOwnerPayoutDetails`.
⚠️ **`ProtectionOptionCards` names its prop `selectable`, not `readonly`**: `readonly`
resolves to Vue's auto-imported `readonly()` inside a template, never to the prop.
⚠️ A protected listing is a **silent no-op** unless its guest guide has an enabled
`damage_protection` section. `listingsMissingGuideSection()` still computes the mismatch; with
the settings page gone, nothing shows it yet.
⚠️ **The guide API does not compute the options yet.** `GET /api/guest-guides/by-token/[token]`
returns the stored section data as-is, and `DamageProtectionForm` renders `section.data.options`,
`termsText` and `longStay` from it, so nothing shows until the server builds them per stay with
`buildOptions`. Until then, `guest-guides/data/damage-protection-demo-guides.ts` bakes one demo
guide per guest case with `buildOptions`, opened at `http://localhost:3001/<token>`: `dpboth`
(waiver and deposit), `dpwaiver` (waiver only), `dplong` (45 nights, two packages), `dpdeposit`
(deposit only), `dphost` (host pays, no section). They assign no listing, so they never change
`listingsMissingGuideSection`, and are drafts. The guest form posts to
`${apiBaseUrl}/api/...` like the other guide forms (it used a relative URL, which hit the guide
app's own host and always failed), and repeats the dashboard card's 30-night package line.
Separately, the guide app has no Tailwind installed, so its pages render unstyled.

**Seeds:** `damage-protection-seed.ts` (`seedProtectionSettings`, the tenant's one setting) and `damage-protection-demo.ts`
(nine stays making every bucket reachable on load: awaiting choice, a card on file before
arrival, an unnotified claim blocking the charge, a decision overdue, a declined charge, a
cancelled stay whose card must be released, a 60-night waiver-only stay with a claim, plus an
owner stay and a block that render nothing). Every deposit stay carries a `SavedCard` and a
frozen `chargeMandate`. ⚠️ Its dates are **relative to today**,
computed at module load; a fixed fixture rots into a stay that already ended.

**Tests:** `tests/lib/damage-protection.spec.ts` (65),
`tests/lib/claim-cleaning.spec.ts` (17),
`tests/lib/cleaning-link.spec.ts` (11),
`tests/lib/calendar-stays.spec.ts` (10),
`tests/lib/stay-bar-span.spec.ts` (10),
`tests/lib/damage-protection-demo.spec.ts` (5),
`tests/server/utils/protection-choice.spec.ts` (6),
`tests/components/operations-calendar/OperationsCalendarBoard.spec.ts` (5),
`tests/composables/useCleaningJobs-link.spec.ts` (8),
`tests/components/inbox/ImageViewer.spec.ts` (5),
`tests/lib/cleaning-checklist.spec.ts` (5),
`tests/composables/useDamageProtection.spec.ts` (78),
`tests/components/reservations/ReservationDamageProtection.spec.ts` (20),
`tests/components/reservations/ProtectionChoiceDialog.spec.ts` (5),
`tests/composables/useInbox-reservation-conversation.spec.ts` (8),
`tests/lib/claim-evidence-pdf.spec.ts` (18),
`tests/lib/partner-claims.spec.ts` (21),
`tests/lib/listing-protection-setup.spec.ts` (9),
`tests/components/settings/DamageProtectionPanel.spec.ts` (4),
`tests/composables/usePartnerClaims.spec.ts` (17),
`tests/components/damage-protection/PartnerClaimPanel.spec.ts` (9),
`tests/lib/tern-activation.spec.ts` (13),
`tests/composables/useTernActivation.spec.ts` (8),
`tests/components/damage-protection/TernActivation.spec.ts` (4),
`tests/components/reservations/ProtectionClaimDialog.spec.ts` (17),
`tests/components/operations-calendar/CleaningReportPanel.spec.ts` (6).
⚠️ The composable spec clears `reservations.value` in `beforeEach`: the demo seeds exist for
the UI and would otherwise land in portfolio-wide totals. ⚠️ `settle()` fakes timers **before**
the call, the only ordering that works against the 1.5s gateway mock. ⚠️ Date assertions
compare **local** day strings: `toISOString()` shifts a UTC+8 midnight to the previous date.

**NOT implemented (intentionally out of scope):** real gateway calls (saving a card and the
off-session charge are mocked timers; no Stripe Elements, SetupIntent, Customer or SCA
re-authentication flow); authorization holds (ruled out, see above); refunding a charged
deposit; detaching the saved card at the gateway when a deposit closes (the record says it is
no longer on file, nothing calls Stripe); a deposit on any non-Stripe gateway; the real Tern API
(the layer is built to its spec but runs on the mock: no server routes, API key, scheduled poll,
retry queue, or premium and bordereau reporting); appealing a partner's rejection; a partner claim on a deposit; a
claims workflow beyond a recorded claim (no adjuster, appeal or guest dispute); any accounting push (a damage charge's posting rules are a finance
decision); owner payout impact; booking-widget collection (`BookingWidgetConfig.depositPct`
keeps its unrelated meaning); per-room protection on a multi-room booking; early check-out (the
decision deadline keys off the booked check-out); and any background job (alerts come from
`emitProtectionAlerts()`). ⚠️ The guest-guide app has no `vue-tsc`, so
`guide-app/app/components/forms/DamageProtectionForm.vue` is not typechecked by anything.


### Tern API integration (`app/lib/tern/`, `useTernApi`)

The demo is a frontend mock, built so the real Tern API drops in. Spec: Tern API v0,
`https://dev-app.terngrp.com/api/swagger-ui/index.html` (read 2026-09-29).

- **`lib/tern/types.ts`**: Tern's schemas field for field (`TernBooking`, `TernClaim`,
  `TernClaimNote`, `TernDocument`, the 14 `TernClaimStatus` values, list queries). ⚠️ Never reshape
  them to suit Elev8: mapping lives in `mappers.ts`.
- **`lib/tern/client.ts`**: `TernApiClient`, one method per endpoint (Tern's operationIds), and
  `createTernHttpClient({ baseUrl, apiKey })`, a `fetch` wrapper sending `X-API-Key`. ⚠️ Server only.
- **`lib/tern/mock-client.ts`**: an in-memory Tern with the same contract (ids, display ids,
  strictly increasing `modStamp`, 400/404 like the API, its own deductible) plus `controls`, which
  play Tern's staff for the demo and have no production counterpart.
- **`lib/tern/mappers.ts`**: the only place the two models meet. `toTernBooking` (reservation,
  protection, listing, manager → booking; `insuranceCost` = the frozen `elev8Fee`),
  `toTernClaim` (gross `claimAmount`, `externalClaimSystem: 'Elev8'`, our claim id as
  `externalClaimId`), `TERN_STATUS_MAP` (14 statuses onto ours; `Closed` read off the amounts),
  `partnerEventsFromTern` (a Tern snapshot → our events, idempotent ids from `modStamp`),
  `ternClaimCorrections` (Tern's `deductibleApplied` is authoritative; raw `partnerStatus`,
  `partnerClaimId`, `exGratiaAmount` kept on the `PartnerClaim`). `TERN_PRODUCT_IDS` and
  `TERN_POLICY_ID` are placeholders until Tern hands them over (no catalogue endpoint).
- **`useTernApi`**: the single integration point (`client`). It syncs every covered stay as a Tern
  booking (`syncBooking`, called from `useDamageProtection.commit` when the cover's state,
  packages or fee change, from `reassessOnExtension`, and when host cover is removed): create when
  cover starts, PUT on a change, `active: false` + `cancelledDate` when it ends, never DELETE.
  Tern booking ids live in `bookingIds` (not on the protection, one writer per field).
- **Polling, not webhooks**: Tern's spec has none. ⚠️ `GET /v1/claim` has **no `modStampFrom`
  filter** and no modStamp sort (bookings and notes do), so `pollPartnerUpdates` pages through
  every Elev8 claim and skips one whose `modStamp` equals the last applied (`seenStamps`).
  Information requests and denial reasons arrive as Tern's latest **Public claim note**. Events
  built from a poll carry source `'poll'` ("read from the partner" in the event log), their time
  the snapshot's `modStamp` (Tern's `paymentSentDate` has no time of day).
- **Going live**: replace `client` in `useTernApi` with one calling our own Nitro routes, and
  implement those routes with `createTernHttpClient({ baseUrl, apiKey: runtimeConfig.ternApiKey })`;
  move `bookingIds` and `seenStamps` into the database; run `pollPartnerUpdates` from a scheduled
  job; upload evidence as the **original bytes** (Tern reads EXIF/GPS and flags edited or AI
  photos, `getDocumentMetadata`), which the housekeeping app must preserve.
- **Products and coverage** (2026-10-06): `TernProductSpec` (`lib/tern/types.ts`) follows Tern's product
  field reference (`productCode`, `rate*`, `unit*`, `personal*`, `realProperty*`, `liability*`, `bedBug*`,
  `smokingEndorsement`, `pets`), shared after the swagger read, so its value types are inferred.
  Each tier's price carries a `coverage` (`TernCoverage`, with its `productCode`), shown by
  `CoverageBreakdown.vue` under the upsell form's tier cards and behind "What's covered" in the listing's
  waiver box. ⚠️ The figures are `placeholderCoverage`, scaled from the tier's cap (the unit limit IS the
  cap); `ternCoverageFromSpec` reads a real product in once Tern sends them. ⚠️ Tern's reference says a
  booking points to a `productCode`; `toTernBooking` still sends the numeric `productId`
  (`TERN_PRODUCT_IDS`), to be confirmed with Tern.
- **Open with Tern**: organization onboarding and the payout bank account (no endpoint); webhooks
  or a `modStampFrom` on claims; product and policy ids per tier, and IDR pricing; how a stay over
  30 nights is billed (we send one booking with the multiplied `insuranceCost`); whether a booking
  can change after `startDatePassed`; whether `approvedCurrency` can differ from `claimCurrency`
  (we never convert); how Tern invoices Elev8 (no statement endpoint); the production URL and
  whether the API key is per platform or per organization.
- Tests: `tests/lib/tern-mappers.spec.ts`, `tests/lib/tern-client.spec.ts`,
  `tests/composables/useTernApi.spec.ts`, `tests/composables/usePartnerClaims.spec.ts`.
