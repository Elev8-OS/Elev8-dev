> Split out of CLAUDE.md to keep the always-loaded context small. Read this file before working on this area; keep it updated when the code changes.

# Platform Console

Internal Elev8 staff surface at `/platform-console` (tenant directory, custom pricing overrides, approvals, audit log, broadcasts). Fully mocked: nothing calls a real API, email or Stripe. This doc covers **Broadcasts**, the way staff tell tenants about maintenance or news. Tenants and staff roles are in `components/platform-console/data/{tenants,staff}.ts`.

## Broadcasts

Files: `data/banners.ts` (model, labels, pure helpers), `composables/usePlatformBanners.ts` (state + actions), `lib/platform-banner-time.ts` (timezones), `BannerComposer.vue`, `BannerCard.vue`, `BannerSlot.vue`, `BannerUpdateDialog.vue`, pages `platform-console/broadcasts/{index,new}.vue` (staff) and `announcements.vue` (tenant), plus a link in the header bell (`NotificationCenter.vue`).

### Broadcasts page (`/platform-console/broadcasts`)

One 4-column grid with one gap: a stats row of four cards (Live now, Scheduled, Maintenance planned, Tenants reached), then the body, where the list takes 3 columns and a side column takes the fourth.

- **List.** Tabs All / Live / Scheduled / Ended (Ended = expired + retracted) with counts, a title search (`base/SearchInput`) and a severity select. Rows sort live, then scheduled (soonest first), then ended (newest first). A row shows the severity tile, title, phase or resolved badge, the body, then audience, schedule, "Emailed" and update count. The whole row opens the detail sheet. Clicks on the actions area do not bubble to the row.
- **Row actions.** Live maintenance that has started (`canResolve`) gets an inline **Resolve** button. The menu has View, Duplicate, Post update, Mark resolved, Retract, each behind its permission. The detail sheet repeats Post update, Mark resolved, Duplicate and Retract at the bottom.
- **Side column.** *Maintenance schedule* lists live or scheduled maintenance that is not resolved, soonest window first, with a countdown ("Starts in 2d 4h", "Ends in 20m"). *Recent activity* shows the last six `banner_*` audit entries.
- ⚠️ **Countdowns start empty.** `now` is `0` until mounted, then ticks every 30 s, so server and client render the same first paint. Do not read `Date.now()` in the template.
- ⚠️ **The retract dialog's open state is separate from its target.** `AlertDialogAction` closes the dialog before the click handler runs, so clearing the target on close made Retract do nothing. The same trap was in `TenantPricingTab`'s revoke dialog.
- Staff-side times use `formatUtc()`. Tenants get their own timezone on the card.

### Composer (`/platform-console/broadcasts/new`)

A stepper (Message, Audience, Schedule, Review) above a 3-column grid: the step card takes 2 columns, a sticky **live preview** takes the third and updates as staff type, from step 1 (it shows placeholder text until then). Finished steps are clickable to go back; later steps are not. The Review step is a summary list plus the email warning; the preview is the same card tenants get.

- Validation is unchanged: step 1 needs title and body, step 2 needs at least one matching tenant, step 3 needs a valid schedule. `publish()` re-checks the schedule against a fresh clock and returns to step 3 if a chosen time has passed.
- There is no "preview as tenant" picker any more. The card only differs per reader by timezone, and the preview uses the staff member's own.

### Tenant card and announcements

- **`BannerCard`** is one card for everything: a severity-coloured left edge and icon, text in the normal foreground, a maintenance panel (window in the reader's timezone, UTC beside it, affected areas, impact), the newest updates, and an outline CTA button. It uses theme tokens only (`warning`, `destructive`, `primary`), no fixed colours. The timezone comes from `useViewerTimezone()`.
- **`/announcements`** is the same grid: Active / Earlier tabs with counts and a *Planned maintenance* side panel (window in the reader's timezone, countdown, affected areas). Active cards can be hidden from the dashboard; a hidden one is flagged "Dismissed from your dashboard".

### Two kinds

A `PlatformBanner` is an **announcement** (news, incidents) or a **maintenance** notice (`kind: 'maintenance'` plus a `MaintenanceWindow`: start, end, the zone staff composed in, impact `offline | degraded`, affected areas). `kind` is optional on the type: a banner without it is an announcement, so old data keeps working. Read it through `bannerKind()`.

### Lifecycle

`scheduled` → `live` → `expired`, or `retracted`. Status is moved by `createBanner` (live when `startAt` is not in the future, else scheduled) and by `runSchedulingSweep()`, which `plugins/platform-console.client.ts` runs every 60 s.

- **Scheduling.** The composer's Schedule step has "Publish now" or "Schedule for later" (date + time). A scheduled banner is invisible to tenants until the sweep flips it live.
- **Maintenance window.** Staff pick start and end (date + time) and affected areas. `endAt` is **window end + 1 hour** (`MAINTENANCE_WRAP_UP_MS`), not the window end, so a forgotten banner still clears itself. `maintenancePhase()` derives `upcoming → in_progress → wrapping_up`, or `resolved`.
- **Post update** adds a `BannerUpdate` (`kind: 'update'`) to a live banner.
- **Mark resolved** adds a `kind: 'resolved'` update, sets `resolvedAt` and moves `endAt` to now + 1 hour (`RESOLVED_GRACE_MS`), so tenants see the all clear and then it expires. `canResolve()` is false for a maintenance whose window has not started: retract that one instead.
- **Retract** stays as it was and hides the banner from tenants everywhere, history included.

### Rules worth knowing

- ⚠️ **Times are instants.** The composer takes wall-clock date + time in one chosen timezone (`BANNER_TIMEZONES`, default UTC) and stores UTC ISO strings through `zonedToInstant()`. It handles DST with two passes. Never store the picker values.
- ⚠️ **Tenants read the window in their own timezone**, with the UTC reading beside it. `BannerCard` starts on UTC and switches to the browser zone in `onMounted`, so server and client render the same first paint. Staff screens use `formatUtc()` and stay deterministic.
- ⚠️ **A dismissal is not forever.** `isDismissed()` only counts a dismissal made at or after `lastActivityAt(banner)` (go-live, or the newest update). Posting an update or resolving brings the banner back once. The announcements page lists dismissed banners too, flagged "Dismissed".
- ⚠️ **Email is opt-in per banner.** `shouldEmail()` is `sendEmail ?? severity === 'critical'`, so old critical banners still email. The composer's switch follows severity until staff change it. Email is **mock**: it writes `banner_email_sent` audit rows (with `reason: 'live' | 'update' | 'resolved'`) and nothing else. It fires when a banner goes live, and on every update and resolve.
- The tenant strip shows at most 2 banners (`liveBannersForTenant(tenantId, role, limit = 2)`). The rest are a "N more announcements" link to `/announcements`. Pass `Infinity` for the full count.
- `announcementsForTenant()` is the tenant history: live, resolved and ended banners that already started and reach this tenant and role. Scheduled (not shown yet) and retracted (withdrawn) never appear.
- **Time pickers** are `base/DatePicker.vue` + `base/TimePicker.vue` (`:end-hour="24"` means through 23:45), never `<input type="datetime-local">`.
- Composing, posting updates and resolving need the `compose_banner` permission (Platform Admin); retracting needs `retract_banner`.
- Duplicating a maintenance banner moves a past window forward by whole days so the copy does not open as "wrapping up".

### Viewer

`useBannerViewer()` returns the tenant and role that read broadcasts in the dashboard. The prototype has no tenant session, so it is fixed to `t-1` and `Admin`. The strip, the announcements page and the bell link all read it, so a real session only needs to change that one file.

### Not covered here

The mobile app and the guest guide do not show broadcasts. The mobile app is not in this repo, and the guest guide is for guests, not tenant staff. If a mobile surface is wanted, it needs the same three reads: live banners for the viewer, dismissal, and the announcements list.

### Tests

`tests/composables/usePlatformBanners.spec.ts`, `tests/lib/platform-banner-time.spec.ts`, `tests/components/platform-console/{AnnouncementsPage,BannerCard,BannerComposer,BroadcastsPage,BroadcastsRetract,TenantPricingRevoke}.spec.ts`. The composer spec stubs the date and time pickers and the radio group, and exposes `useStaffAuth` and `createError` as globals, as Nuxt would.
