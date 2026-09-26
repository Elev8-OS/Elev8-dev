> Split out of CLAUDE.md to keep the always-loaded context small. Read this file before working on this area; keep it updated when the code changes.

### Damage Protection (`app/components/reservations/data/damage-protection.ts` + `app/composables/useDamageProtection.ts`)

Something breaks: who pays, and out of what? The guest chooses before arrival between a
non-refundable **damage waiver** and a **security deposit, which is a card kept on file**.

- ⚠️ **The deposit is a CARD SAVED WITH STRIPE, charged only if there is damage.** Nothing is
  charged at booking and nothing is held. It replaced a charge-upfront-and-refund deposit
  (the owner's call, 2026-09-24). **Not an authorization hold**: a hold lapses in about 7 days
  (Stripe 7, 30 with extended auth on IC+ pricing only; Xendit ~7 with a single capture), which
  a stay plus its cleaning report outlasts, while a saved card (a SetupIntent on a Customer)
  lasts until the card expires. The trade-off is stated, not hidden: nothing is guaranteed, and
  the charge after check-out **can be declined** (`charge_failed`) or disputed.
- ⚠️ **Only a Stripe listing can take a deposit** (`railForListing === 'card'`). QRIS, virtual
  account and e-wallet cannot be saved and charged later, so every other rail, including a
  listing with no payout account, is offered **the waiver only** (`buildOptions` drops the
  deposit; a deposit-only policy on such a listing offers nothing and is not asked at all).
- ⚠️ **The deposit is made the less appealing option, on purpose.** A deposit that costs nothing
  upfront would otherwise be the obvious pick and empty the waiver pot. So the waiver is
  **always listed first and pre-selected** (there is no `defaultOption` on a policy any more),
  its card leads with "Nothing more to pay after you leave" and "No card kept on file", and the
  deposit states plainly that the card can be charged up to the limit after check-out and asks
  for more: a card **and** an explicit consent tick. Prices were deliberately not touched.
- ⚠️ **The consent is frozen onto the protection** (`chargeMandate`, from `chargeMandateText`):
  the ceiling, only for damage, only after the guest is told, and no later than
  `settleWithinDays` after check-out. It is the record that answers a chargeback.
- ⚠️ **No card number is ever stored.** `SavedCard` is the gateway reference
  (`paymentMethodId`), brand, last four and expiry. `saveCard` (mock SetupIntent, 1.5s) drops
  the input; in production Stripe Elements owns the fields and the number never reaches this
  app. The guest-guide endpoint **refuses** a body carrying `number`, `cvc` and the like
  (`server/utils/protection-choice.ts`) rather than ignoring it.
- ⚠️ **To the guest it is a waiver, never insurance.** Distributing insurance in Indonesia
  needs OJK licensing, so nothing guest-facing (the choice cards, the guide form, the claim
  notice, the terms) says `insurance`. The insurance is the **property manager's master policy**
  with a partner (see *Insurance partner* below): staff-facing screens may call a partner claim
  an insurance claim, because to the manager it is one.
- ⚠️ **Three choices per property, nothing else** (owner's decision, 2026-09-25):
  **no protection**, **guest pays** (the guest buys the waiver in the guest guide), or **host
  pays** (the guest is never asked; Elev8 bills the host the Tern per-stay fee and pays Tern).
  `ListingProtectionMode` (`off | guest_paid | host_paid`) is DERIVED: `off` means the listing
  has no assignment, otherwise `payers[listingId]` (absent = guest) decides. `setListingMode` is
  the way in; turning a listing on assigns the standard templates in its payout currency (or
  any usable policy in that currency), never a policy in another currency
  (`no_policy_in_currency`).
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
  from a **Tern tier** (`data/tern-products.ts`: Bronze / Silver / Gold, sized by
  `Listing.capacity`, each with a `coverageCap`, a fixed `perStayFee` Elev8 charges the tenant,
  and Tern's exclusions, which include wear and tear). A policy stores only
  `waiver: { tier, guestPrice }`: the one number the tenant types is what they charge the guest,
  flat per stay, shown next to Elev8's fee and the margin. **The figures are placeholders** until
  Tern hands over its price list, and they are **per currency, never converted**: only USD is
  priced today, so a waiver policy in IDR / EUR / CHF is refused by `policyErrors` ("The Bronze
  cover is not available in IDR yet"). The listings table flags a tier smaller than the
  property's size (`tierTooSmall`); a bigger one is never flagged.
- **Policy templates** (`POLICY_TEMPLATES`: *Standard short-term* waiver + deposit on Bronze,
  *Standard long-term* 28+ nights waiver-only on Silver, *Deposit only* on Direct) are complete
  policies a tenant assigns rather than builds; `policyFromTemplate` makes one and records
  `templateId` as provenance. The seeds are built from them. The long-stay line stays at 28 nights.
- ⚠️ **A host-paid stay is covered by a real protection record**, written by `syncHostCover()`
  (from `hostCoverProtection`: `paidBy: 'host'`, `amount: 0`, `acceptedVia: 'host_cover'`, tier
  and `elev8Fee` frozen), so claims, the partner claim and the Elev8 fee all hang off something
  frozen. It runs on `hydrate()` and after every listing change; there is no booking-created hook.
  It covers a guest stay that has not checked out and has no protection yet (or only an
  unanswered `awaiting_choice`); it never overwrites a guest's own accepted choice; it closes a
  cancelled stay's cover with **nothing to refund**; and it removes the cover from a stay that has
  not started, with no claim, once the listing stops being host-paid. Idempotent.
  `isOfferedFor` is **false** on a host-paid listing: the guest is never asked. A host-paid
  listing needs no guest guide section (`listingsMissingGuideSection` skips it), and a
  deposit-only policy cannot be used there (`host_needs_waiver`).
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
- ⚠️ **No currency conversion, ever.** `assignBand` refuses a policy whose currency differs
  from the listing's payout account, at assignment time rather than at charge time.
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

**Long stays are a different product.** `LONG_STAY_THRESHOLD_NIGHTS = 28`. Bands live on the
**assignment** (`DamageProtectionAssignment`, non-overlapping per listing), not as price
tiers, because the exclusions, terms, SLA and offered options all differ across the
threshold. Every policy lookup therefore takes `nights`. Long-stay bands ship **waiver-only**
pending a per-market legal answer on whether a months-long deposit is a tenancy deposit
(Bali, Germany, Switzerland differ sharply). Wear and tear must be an explicit exclusion, and
there is deliberately **no recurring waiver billing**: a renewal failing in month four with a
guest in the property who believes they are covered is a state nothing else here has.
Extending across a band boundary re-opens the choice for the added period via
`reassessOnExtension` and never re-prices the original.

**Settings page** (`/settings/damage-protection`, redesigned for plain use 2026-09-24):
`DamageProtectionSettingsPanel.vue` has two tabs.
- **Policies**: a summary card per policy in plain words ("Waiver: Tern Bronze, covers up to ...
  Guest pays USD 39.00, Elev8 charges you USD 9.00 per stay" / "Deposit: card on file, charged up
  to ... only for damage, decided within 7 days"), its channels ("All channels" whenever the
  waiver is on), and where it is used; **Edit**, **New policy**, and delete (disabled while any
  listing uses it). A read-only line names Tern as the cover partner; there is nothing to set.
- **Listings**: one row per listing with a **Protection** select (No protection / Guest pays /
  Host pays) and, unless it is off, two selects, *Stays under 28 nights* and *Stays of 28+
  nights*, instead of typed night ranges. Where the host pays, a deposit-only policy is disabled
  in the list. A policy in another currency than the listing's payouts
  is disabled in the list. Rows flag "Waiver only here" (a deposit policy on a non-Stripe listing)
  and "Not in the guest guide yet", with a banner counting the latter.
  - **Assigning many at once**: tick rows (custom boxes, not reka-ui's `Checkbox`, so the header
    can show "some"), or **Select all shown**, which takes every row the search, **tag** and
    **No protection / Guest pays / Host pays** filters leave, so a filter is how a group is
    picked. The bulk bar sets who pays (applied first) and short and/or long stays ("Keep as is" leaves a slot alone, "No protection" clears it) through
    `setSlotsForListings`, which applies listing by listing and reports what it skipped and why
    (currency, custom ranges). ⚠️ A listing whose two slots cannot both apply is rolled back
    whole, never left half-changed, and the skipped ones stay ticked afterwards.
  - ⚠️ **The two slots are a view over the same bands** (`SLOT_RANGES`: 1-27 and 28+;
    `listingSlots` reads them). `setListingSlot` replaces exactly one slot's band and still goes
    through `assignBand` (currency and overlap checks), rolling back on a refusal. A listing with
    any other range is `custom`, shown read-only with "Switch to short and long stays"
    (`resetListingBands`); nothing silently rewrites a custom setup.
- **Editing** is `DamageProtectionPolicySheet.vue`, a side sheet on a **draft** (Save / Cancel;
  nothing reaches the policy before Save). Sections: name (currency only chosen for a new
  policy), *Start from a template* (new policies only), *What guests can choose* (the waiver
  with the Tern tier picker, the guest price, Elev8's fee and the margin, and Tern's exclusions
  read-only; the deposit with card limit and decision days), booking channels (locked to all
  while the waiver is on), terms, and a live *What guests see* preview from `buildOptions`.
  `policyErrors(policy, { longStay, guestPaid })` lists what is missing in plain sentences and
  blocks the save; it asks for a guest price unless every listing using the policy is host-paid.
  ⚠️ The sheet's `guestPaid` prop defaults to **true** via `withDefaults`: an absent boolean prop
  is `false` in Vue, which silently stopped asking a new policy for a guest price.
  ⚠️ **The terms version bumps itself** (`bumpTermsVersion`) when the terms wording changed, so
  there is no version field to forget. `newPolicyDraft` is the standard short-term template.

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
the service in a 3-step wizard (`TernActivationWizard.vue`, opened from `TernActivationCard.vue` at
the top of `/settings/damage-protection`): **Terms** (`TERN_ACTIVATION_TERMS`, the tier table, the
deductible) → **Bank account** (where Tern pays claims) → **Review**, then **Activate** registers the
tenant as an organization on Tern (mock API, 1.5s, returns a `tern_org_` id; a "simulate Tern
refusing" switch makes it fail).
- ⚠️ **There is no card step** (owner's decision, 2026-09-25). The per-stay fees go on the card the
  tenant already saved at onboarding for its Elev8 subscription:
  `useOnboarding().subscription.stripePaymentMethodId` is copied onto the activation as
  `billingPaymentMethodId` at Activate. Without one, `activate` refuses (`no_subscription_card`)
  and the Review step says so with Activate disabled. Onboarding stores no brand or last four, so
  the screens say "the card on your Elev8 subscription". Do not add a second card form.
- ⚠️ **Nothing that uses the waiver works until `status === 'active'`.** `pausedUntilActivation`
  pauses a policy offering the waiver WHOLE (its deposit too, rather than quietly becoming
  deposit-only on channels nobody picked), `setListingMode('host_paid')` is refused
  (`waiver_not_activated`), `syncHostCover` writes nothing, and no claim can be filed with Tern.
  Deposit-only policies are not Tern's and keep working. The settings page marks paused policies
  and listings and disables "Host pays".
- ⚠️ **The waiver cannot be switched ON in a policy before activation.** `savePolicy` refuses a
  save that turns it on (`turnsWaiverOn`: a new policy offering it, or an existing one that did
  not) with `waiver_not_activated`, and now returns a `ProtectionWriteResult`. The policy sheet says
  the same thing first: a new policy starts from the *Deposit only* template, the two waiver
  templates are disabled ("Needs the damage waiver activated"), and the waiver switch is disabled
  with a note pointing at activation. A policy that **already** offers the waiver can still be
  edited, and is marked "Paused until the damage waiver is activated".
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
  card `pm_demo`, `tern_org_demo_0001`) so the seeded waivers and insurance claims keep working; **Replay
  activation (demo)** resets it to show the flow. Persisted to `elev8-tern-activation-v1`;
  `useDamageProtection().hydrate()` hydrates it first.
- **Not implemented:** a real Tern API call or webhook, charging the per-stay fees to the
  subscription card (no billing run), deactivating the service, per-listing bank accounts, and
  verifying the account (no micro-deposit or name match). A later change of the subscription card
  is not copied onto the activation.

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
- ⚠️ **The partner API is mocked.** `submitToPartner` is a 1.5s timer returning a `PC-` reference
  (or a rejected submission with the switch on); the partner's replies arrive through
  `receivePartnerEvent`, the path a real webhook would take, and `simulatePartner` plays the
  partner for the demo ("Simulate partner response" on each filed claim, offering only the
  replies that can follow the current status).
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
worklist, `/settings/damage-protection`, and in the guide app
`sections/DamageProtectionSection.vue` + `forms/DamageProtectionForm.vue` behind
`POST /api/guest-guides/by-token/[token]/protection-choice`.

⚠️ **That endpoint's body never accepts a `reservationId`** — the token identifies the
reservation. Same access model as `saveForCurrentOwner` in `useOwnerPayoutDetails`.
⚠️ **`ProtectionOptionCards` names its prop `selectable`, not `readonly`**: `readonly`
resolves to Vue's auto-imported `readonly()` inside a template, never to the prop.
⚠️ A policy assigned to a listing is a **silent no-op** unless that listing's guest guide has
an enabled `damage_protection` section. `listingsMissingGuideSection()` surfaces the mismatch
in settings.

**Seeds:** `damage-protection-seed.ts` (three USD policies against the Stripe account that
covers lst-1/lst-2/lst-18; lst-18 carries only the long-stay band) and `damage-protection-demo.ts`
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
`tests/lib/damage-protection-settings.spec.ts` (15),
`tests/components/settings/DamageProtectionSettings.spec.ts` (26),
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
no longer on file, nothing calls Stripe); a deposit on any non-Stripe gateway; a real insurance partner API
(submission and webhooks are mocked: no signature check, retry queue, or premium and bordereau
reporting to the partner); appealing a partner's rejection; a partner claim on a deposit; a
claims workflow beyond a recorded claim (no adjuster, appeal or guest dispute); any accounting push (a damage charge's posting rules are a finance
decision); owner payout impact; booking-widget collection (`BookingWidgetConfig.depositPct`
keeps its unrelated meaning); per-room protection on a multi-room booking; early check-out (the
decision deadline keys off the booked check-out); and any background job (alerts come from
`emitProtectionAlerts()`). ⚠️ The guest-guide app has no `vue-tsc`, so
`guide-app/app/components/forms/DamageProtectionForm.vue` is not typechecked by anything.
