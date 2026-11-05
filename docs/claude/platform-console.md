> Split out of CLAUDE.md to keep the always-loaded context small. Read this file before working on this area; keep it updated when the code changes.

# Platform Console

Internal Elev8 staff surface at `/platform-console` (tenant directory, custom pricing overrides, approvals, audit log, broadcasts). Fully mocked: nothing calls a real API, email or Stripe. This doc covers the **Tenants page**, the tenant detail **Billing tab** and **Broadcasts**, the way staff tell tenants about maintenance or news. Tenants and staff roles are in `components/platform-console/data/{tenants,staff}.ts`.

## Tenants page (`/platform-console/tenants`)

The same master-detail layout as the *By tenant* view of Billing & Subscriptions in the real dashboard. `pages/platform-console/tenants/index.vue` is a thin shell around `TenantDirectory.vue` (it replaced `TenantDirectoryTable.vue`).

- **One 6-column grid** (`xl`): six stat cards (Active tenants, MRR, In dunning, Suspended, No payment method, Active units), then the body, where the tenant list takes 2 columns and the detail takes 4.
- **Controls:** `base/SearchInput` (name, contact, email), selects for plan, status and sort, Tier and Region popovers (AND logic), Clear, and a Hide internal switch. The status select also has *In dunning* and *No payment method*, which read billing health, not tenant status.
- **List row:** logo tile, name, Internal and No card badges, region and units, status badge (only when not active), billing health badge, and MRR (or quota left for per-booking).
- **Detail:** header (logo, name, status, contact, last login, plan badge, override and banner counts, **Open tenant** link to `/platform-console/tenants/[id]`), then the full `TenantBillingTab`, keyed by tenant id so it remounts and logs `view_billing` on each pick. Roles without `view_billing` get a one-line note instead.
- ⚠️ **Stats follow Hide internal, not the other filters.** Internal tenants are left out of every rollup while the switch is on. Search and the dropdowns only narrow the list.
- ⚠️ **Selection is kept valid by a watcher on the filtered list:** a filtered-out selection moves to the first match, and an empty list clears it.
- The billing health and card flag come from `useTenantBilling().byTenant()`, so the list and the Billing tab never disagree. `HEALTH_BADGE_CLASS` in `data/tenant-billing.ts` is the shared badge colour map.

Tests: `tests/components/platform-console/TenantDirectory.spec.ts`.

## Tenant detail: Billing tab

Mirrors the tenant detail panel of *Billing & Subscriptions* in the real dashboard (`pages/admin/billing.vue` in `~/Desktop/dashboard-v2-development-merged`). Files: `TenantBillingTab.vue`, `data/tenant-billing.ts` (types, pure helpers, seed), `composables/useTenantBilling.ts` (state + actions). Everything is mock; nothing calls Stripe.

Top to bottom: a hero card (billing email, type / health / "No payment method" badges, **Next charge** with the Adjust button, then a 4-cell stats strip Plan / Recurring or Billing model / Units / Invoices, plus the booking quota bar for per-booking tenants), the **Next charge adjusted** banner when an override exists (Edit, Revert to default), the **dunning** panel, the **Invoice history** table, and the **Adjust next charge** dialog. The name and plan already sit in `TenantDetailHeader`, so the hero does not repeat them.

- **Health** is `paid | dunning | pending | suspended`. Dunning has two shapes: a property tenant gets a retry ladder (`PROPERTY_RETRY_LIMIT` = 3 attempts, 3 days apart, then a Suspend step); a per-booking tenant gets strikes (`BOOKING_STRIKE_LIMIT` = 7 failed auto top-ups). The ladder turns destructive once one failure is left (`isCriticalDunning`).
- **Default next charge** is `mrrUsd`, or `mrrUsd * 12` for a yearly cycle (`defaultChargeAmount`). Per-booking tenants have no next charge and no Adjust button.
- **Adjust dialog.** Date (`base/DatePicker`) with Keep / +7 / +14 / +1 month chips, then Use plan default or Custom amount (with a discount / surcharge delta and a "keep for future charges" switch), then a required Reason. The footer previews the resulting charge. Save writes `nextChargeAt` and `override` through `adjustNextCharge`, which also throws on a blank reason or date.
- **Revert** drops the override and keeps the date.
- Needs the `adjust_next_charge` permission (approver, admin). Finance can read the tab but not change it. Both actions write `next_charge_adjusted` / `next_charge_reverted` audit rows (with from/to date, amount and note).
- Money is `USD 1,299.00` (`formatMoney`), never converted. The mock tenant data is USD only, so the reference page's per-tenant currency and currency symbol are not carried over.
- Seeds are hand picked per tenant id in `SEEDS` so the demo shows each state: `t-2` yearly, `t-3` booking strikes, `t-4` no card + pending, `t-5` suspended, `t-6` property ladder, `t-8` no invoices, `t-10` an override.
- "View in Stripe" only toasts that Stripe is not connected.
- ⚠️ **Not carried over** from the reference: the cross-tenant list, the All transactions ledger, the KPI row, search and Excel export. They live on a page of their own there, this repo only has the per-tenant view.
- ⚠️ Dates are local `YYYY-MM-DD` strings (`ymd`), never `toISOString()`.

Tests: `tests/composables/useTenantBilling.spec.ts`, `tests/components/platform-console/TenantBillingTab.spec.ts` (the dialog portals to `document.body`, query it there).

## Broadcasts

Files: `data/banners.ts` (model, labels, pure helpers), `composables/usePlatformBanners.ts` (state + actions), `lib/platform-banner-time.ts` (timezones), `BannerComposer.vue`, `BannerCard.vue`, `BannerSlot.vue`, `BannerUpdateDialog.vue`, pages `platform-console/broadcasts/{index,new}.vue` (staff) (staff). Tenants only see the banner strip on the dashboard (`BannerSlot.vue`).

### Broadcasts page (`/platform-console/broadcasts`)

One 4-column grid with one gap: a stats row of four cards (Live now, Scheduled, Maintenance planned, Tenants reached), then the body, where the list takes 3 columns and a side column takes the fourth.

- **List.** Tabs All / Live / Scheduled / Ended (Ended = expired + retracted) with counts, a title search (`base/SearchInput`) and a severity select. Rows sort live, then scheduled (soonest first), then ended (newest first). A row shows the severity tile, title, phase or resolved badge, the body, then audience, schedule and update count. The whole row opens the detail sheet. Clicks on the actions area do not bubble to the row.
- **Row actions.** Live maintenance that has started (`canResolve`) gets an inline **Resolve** button. The menu has View, Duplicate, Post update, Mark resolved, Retract, each behind its permission. The detail sheet repeats Post update, Mark resolved, Duplicate and Retract at the bottom.
- **Side column.** *Maintenance schedule* lists live or scheduled maintenance that is not resolved, soonest window first, with a countdown ("Starts in 2d 4h", "Ends in 20m"). *Recent activity* shows the last six `banner_*` audit entries.
- ⚠️ **Countdowns start empty.** `now` is `0` until mounted, then ticks every 30 s, so server and client render the same first paint. Do not read `Date.now()` in the template.
- ⚠️ **The retract dialog's open state is separate from its target.** `AlertDialogAction` closes the dialog before the click handler runs, so clearing the target on close made Retract do nothing. The same trap was in `TenantPricingTab`'s revoke dialog.
- Staff-side times use `formatUtc()`. Tenants get their own timezone on the card.

### Composer (`/platform-console/broadcasts/new`)

A stepper (Message, Audience, Schedule, Review) above a 3-column grid: the step card takes 2 columns, a sticky **live preview** takes the third and updates as staff type, from step 1 (it shows placeholder text until then). Finished steps are clickable to go back; later steps are not. The Review step is a summary list; the preview is the same card tenants get.

- Validation is unchanged: step 1 needs title and body, step 2 needs at least one matching tenant, step 3 needs a valid schedule. `publish()` re-checks the schedule against a fresh clock and returns to step 3 if a chosen time has passed.
- There is no "preview as tenant" picker any more. The card only differs per reader by timezone, and the preview uses the staff member's own.

### Tenant card

- **`BannerCard`** is one card for everything: a severity-coloured left edge and icon, text in the normal foreground, a maintenance panel (window in the reader's timezone, UTC beside it, affected areas, impact), the newest updates, and an outline CTA button. It uses theme tokens only (`warning`, `destructive`, `primary`), no fixed colours. The timezone comes from `useViewerTimezone()`.
- ⚠️ **There is no tenant announcements page and no bell link.** The `/announcements` page was removed on purpose until the real dashboard decides where tenants open past broadcasts. A dismissed broadcast is simply gone for that tenant (until an update brings it back), and a tenant has no history view.

### Two kinds

A `PlatformBanner` is an **announcement** (news, incidents) or a **maintenance** notice (`kind: 'maintenance'` plus a `MaintenanceWindow`: start, end, the zone staff composed in, impact `offline | degraded`, affected areas). `kind` is optional on the type: a banner without it is an announcement, so old data keeps working. Read it through `bannerKind()`.

### Lifecycle

`scheduled` → `live` → `expired`, or `retracted`. Status is moved by `createBanner` (live when `startAt` is not in the future, else scheduled) and by `runSchedulingSweep()`, which `plugins/platform-console.client.ts` runs every 60 s.

- **Scheduling.** The composer's Schedule step has "Publish now" or "Schedule for later" (date + time). A scheduled banner is invisible to tenants until the sweep flips it live.
- **Maintenance window.** Staff pick start and end (date + time) and affected areas. `endAt` is **window end + 1 hour** (`MAINTENANCE_WRAP_UP_MS`), not the window end, so a forgotten banner still clears itself. `maintenancePhase()` derives `upcoming → in_progress → wrapping_up`, or `resolved`.
- **Post update** adds a `BannerUpdate` (`kind: 'update'`) to a live banner.
- **Mark resolved** ends the banner at once, like a retract: it adds a `kind: 'resolved'` update (a staff-only closing note), sets `resolvedAt`, `endAt` = now and `status: 'expired'`. Tenants stop seeing it and the active slot is free immediately; staff keep it under Ended with a Resolved badge. There is no all-clear hour any more (`RESOLVED_GRACE_MS` is gone). `canResolve()` is false for a maintenance whose window has not started: retract that one instead.
- **Retract** stays as it was and hides the banner from tenants everywhere, history included.

### Rules worth knowing

- ⚠️ **Times are instants.** The composer takes wall-clock date + time in one chosen timezone (`BANNER_TIMEZONES`, default UTC) and stores UTC ISO strings through `zonedToInstant()`. It handles DST with two passes. Never store the picker values.
- ⚠️ **Tenants read the window in their own timezone**, with the UTC reading beside it. `BannerCard` starts on UTC and switches to the browser zone in `onMounted`, so server and client render the same first paint. Staff screens use `formatUtc()` and stay deterministic.
- ⚠️ **A dismissal is not forever.** `isDismissed()` only counts a dismissal made at or after `lastActivityAt(banner)` (go-live, or the newest update). Posting an update or resolving brings the banner back once.
- **No email.** Broadcasts are in-app only (the dashboard banner only). Email was removed on purpose: it is a non-goal for the real dashboard for now, so do not add a `sendEmail` field or audit rows back without a decision.
- ⚠️ **At most 2 broadcasts are active on the whole platform** (`MAX_ACTIVE_BROADCASTS`, any audience). Live and scheduled ones both count, over the time they would run: `activeLimitError(startAt, endAt)` checks the new run at its start and at the start of every other broadcast inside it, so a long run cannot overlap two later ones. `createBanner` throws with it, the composer shows it as the Schedule step error, and Duplicate toasts it. Retract or resolve one to free a slot. Resolving or retracting frees a slot at once. The seed already has two live, so the demo has to retract one first.
- The tenant strip still caps at 2 (`liveBannersForTenant(tenantId, role, limit = 2)`); with the platform limit it never hides anything. Pass `Infinity` for the full count.
- **Time pickers** are `base/DatePicker.vue` + `base/TimePicker.vue` (`:end-hour="24"` means through 23:45), never `<input type="datetime-local">`.
- Composing, posting updates and resolving need the `compose_banner` permission (Platform Admin); retracting needs `retract_banner`.
- Duplicating a maintenance banner moves a past window forward by whole days so the copy does not open as "wrapping up".

### Viewer

`useBannerViewer()` returns the tenant and role that read broadcasts in the dashboard. The prototype has no tenant session, so it is fixed to `t-1` and `Admin`. The banner strip reads it, so a real session only needs to change that one file.

### Not covered here

The mobile app and the guest guide do not show broadcasts. The mobile app is not in this repo, and the guest guide is for guests, not tenant staff. If a mobile surface is wanted, it needs the same two reads: live banners for the viewer, and dismissal.

### Tests

`tests/composables/usePlatformBanners.spec.ts`, `tests/lib/platform-banner-time.spec.ts`, `tests/components/platform-console/{BannerCard,BannerComposer,BroadcastsPage,BroadcastsRetract,TenantPricingRevoke}.spec.ts`. The composer spec stubs the date and time pickers and the radio group, and exposes `useStaffAuth` and `createError` as globals, as Nuxt would.
