# CLAUDE.md — Elev8 Dashboard

> **Stack**: Nuxt 3 + Vue 3 + shadcn-vue + Tailwind CSS v4. Font Inter (`app/assets/css/tailwind.css`, loaded by `@nuxt/fonts`).
> **Project**: elev8-dashboard, property management for Bali vacation rentals. Mock/demo only: integrations and gateways are timers, not real APIs.

## 👤 Current User

The logged-in user is **Komang Juliantara** (Guest Relations), NOT "You" (Admin). `staff-1` / "You" in mock data is the property owner. This affects how users are referenced in mock data vs. UI.

---

## 📚 Module Docs (read before touching a module)

Detailed architecture, rules and the ⚠️ gotchas for each module live in `docs/claude/`. **Read the matching file before changing that area, and update it (not this file) when the module changes.** Add a row here for a new module.

| Area | Doc | Covers |
|---|---|---|
| Listings | `docs/claude/listings.md` | 6-tab detail page, AI schedule, Listing Setup overlay, rooms/unit types/rate plans, status + AI aggregation, listings table |
| Inbox | `docs/claude/inbox.md` | Conversations, filters, phone calls, notes, auto-translate, image sending, `ensureConversationForReservation`, inbox settings / AI settings |
| Internal staff messaging | `docs/claude/internal-inbox.md` | Derived listing+role rooms, forward/create-task context menu, delivery state, image viewer |
| WhatsApp | `docs/claude/whatsapp.md` | Multi-account settings, test send, 24h window, unmatched queue |
| Reservation folio | `docs/claude/reservation-folio.md` | Staff-posted charges, tax/service rounding, voids/refunds, `priceDetails.extras` ownership |
| City tax | `docs/claude/city-tax.md` | Collector policy, guest-category rates, age bands, alerts, `/city-tax` worklist |
| Damage protection | `docs/claude/damage-protection.md` | Waiver vs saved-card deposit, Tern tiers + activation, host-paid cover, claims from cleaning reports, insurance partner claims, evidence PDF |
| Owner statements | `docs/claude/owner-statements.md` | Corrections/adjustments, disputes, owner-portal PDF export |
| Owner payout details | `docs/claude/owner-payout-details.md` | Owner bank/address store, IBAN mod-97 |
| Smart locks | `docs/claude/smart-lock.md` | Connection, per-listing/room pairing, access codes, brand sharing, inbox Smart Lock tab |
| Upsell → smart lock access | `docs/claude/upsell-lock-access.md` | Paid order issues a door code |
| Minut | `docs/claude/minut.md` | Sensor connection, events into Journeys |
| Finance | `docs/claude/finance.md` | Overview/Revenue/Costs, Jurnal/Bexio mapping, DATEV export, checkbox `clearKey` pattern |
| Upsells | `docs/claude/upsells.md` | Catalog, orders lifecycle, cancellation, inbox offer flow |
| Journeys | `docs/claude/journeys.md` | AI journey builder, editor, marketplace |
| Airbnb reviews | `docs/claude/airbnb-reviews.md` | Review automation queue + settings |
| Review Hub | `docs/claude/review-hub.md` | Channex-aligned review aggregator, double-blind, host review, tags |
| Website builder reviews | `docs/claude/website-builder-reviews.md` | Auto/manual review rules, picker UI, publish state |
| Payment requests | `docs/claude/payment-requests.md` | Payment links, fee modes, payout integration |
| Operations calendar | `docs/claude/operations-calendar.md` | Week/day board, merged stay sources, half-day bars, lanes |
| Promo codes | `docs/claude/promo-codes.md` | Code library, create wizard, scope chain, booking widget links |
| Branding | `docs/claude/branding.md` | Tenant logo/favicon/Guest Guide colors, server + guide-app wiring |
| Tenant onboarding | `docs/claude/onboarding.md` | PMS models, pricing, server-validated promos, import, banners |
| GM dashboard | `docs/claude/gm-dashboard.md` | Role-gated portfolio dashboard, generated stays, sentiment panel |
| App shell | `docs/claude/app-shell.md` | Notification Center, layout/header, Tasks, Kanban, Auth, Mail |
| Composables | `docs/claude/composables.md` | Table of every composable and its key exports |
| File structure | `docs/claude/file-structure.md` | Directory tree reference |
| shadcn-vue snippets | `docs/claude/shadcn-patterns.md` | Button/Dialog/Form/Sheet/DataTable boilerplate |

Other modules without a doc yet: AI Assistant (header slide-over, ai-elements primitives, mock pattern matcher; spec `docs/superpowers/specs/2026-07-10-elev8-ai-assistant-design.md`), Owner Portal Phase 1 (`/owners`, `/owner-statements`, `/owner-portal`), Settings, Changelog, Components gallery.

Specs and plans: `docs/superpowers/{specs,plans,changelogs}/`, PRDs in `docs/prd-*.md`.

---

## ⚠️ Cross-Cutting Rules

- **Currency display**: always `${ISO code} ${amount}` (`USD 150.00`, `IDR 500,000`, `CHF 1,200.00`), never symbols or suffixes. Input prefixes use the code with `pl-14`. CHF uses `de-CH` with 2 decimals. Header amounts in CHF (tenant currency).
- **No currency conversion, ever** (folio, city tax, damage protection, owner statements). Totals are kept per currency, never blended.
- **Snapshots, not live joins**: catalog picks, settlements, forwards, claims and published statements freeze what they copied; ids stored alongside are provenance only.
- **State mutations use spread syntax** (`useState` arrays): `list.value = list.value.map(c => c.id === id ? { ...c, x } : c)`. Never `conv.status = null`.
- **One writer per field**: e.g. only the folio writes `priceDetails.extras`; city tax and damage protection never touch `priceDetails` or the folio. Check the module doc before writing a shared field.
- **Composable import cycles**: `useInbox` ↔ upsells/damage protection are reached via a dynamic `import()`. Do not "tidy" these into static imports.
- **New alert types** must be added to their category (e.g. `FINANCE_TYPES` in `notification-settings.ts`) or they are invisible in the bell.
- **Persistence** guards on `typeof localStorage`, not `import.meta.client` (Vitest leaves it `undefined`).
- **No emoji as icons**; return a lucide icon name beside the text.
- **Action Needed status** is only `'action_needed'` or `null`; badge shown only for `action_needed` (destructive variant).
- **AI-written messages** (`aiWritten: true`) show "ElevAI" sender, sparkle avatar, "AI" label.

## 🧪 Testing Gotchas (Vitest)

- Nuxt auto-imported components must be registered in `global.components` **under the auto-import name** (and the shadcn primitives too). An unresolved component renders a bare tag and drops slots, so assertions pass vacuously.
- A `Button` stub must **not** re-emit `click` (the parent handler already falls through, so it fires twice). A `Sheet`/`Dialog` stub must honour `open`.
- For mocked delays, `settle()` fakes timers **before** the call.
- `tests/setup.ts` clears the `useState` store per test, stubs `fetch`, shims `resolveComponent`, and exposes several composables globally. Module-level refs (e.g. `useFeesTaxes`) are not reset: reset them by hand.
- Fixtures that depend on "today" use dates **relative to today** and local `YYYY-MM-DD` strings (`toISOString()` shifts a UTC+8 midnight).
- For PDF builders, the specs use a jsPDF recorder; after geometry changes render a real file and look at it (`pdftoppm -png`).

---

## 🧩 Component Selection

1. **shadcn-vue** in `app/components/ui/` first. Never duplicate; customize via props, slots and `cn()`.
2. **Custom base**: `base/BreadcrumbCustom.vue`, `base/DateRangePicker.vue`, `Search.vue`, `PasswordInput.vue`, `AppSettings.vue`, `DarkToggle.vue`, `ThemeCustomize.vue`.
3. **Module components** alongside their module (`components/<module>/`).
4. Build new only as a last resort, next to the module that uses it.

## 🎨 UI Patterns

- **Toasts**: `vue-sonner` (`toast.success(...)`, `toast.info(...)`), configured in `app.vue`.
- **Unread badges**: `Badge variant="default"` with the count.
- **AI Assistant panel** uses primary color; ElevAI gold is reserved for inline ElevAI brand elements.
- **reka-ui `Switch` / `Checkbox`** bind `model-value` / `@update:model-value`, NOT `checked` / `@update:checked` (silently dead). Never wrap a reka-ui `Checkbox` in a `<label>` (double-toggle); for clickable rows use `div @click` + a custom checkbox visual:
  ```vue
  <div class="flex items-center gap-2 cursor-pointer" @click="toggle(item)">
    <div class="flex size-4 items-center justify-center rounded-[4px] border"
         :class="selected ? 'border-primary bg-primary text-primary-foreground' : 'border-input'">
      <Icon v-if="selected" name="lucide:check" class="size-3" />
    </div>
    <span>{{ item }}</span>
  </div>
  ```
- **Tag/multi-select filters** (match Listings index): Popover + search `Input` + `ScrollArea` of custom-checkbox rows + "Clear all"; AND logic (`every`).
- **Scrollable flex children need `min-h-0`**: `<ScrollArea class="flex-1 min-h-0">` inside `flex flex-col h-full`, otherwise the parent grows instead of scrolling.
- **SSR hydration**: TanStack tables with icon columns and Reka `ScrollArea`-heavy layouts are wrapped in `<ClientOnly>` (see `listings/index.vue`, `inbox.vue`). `nuxt.config.ts` uses `icon.mode: 'svg'`.

## 🎨 Tailwind & Styling

- No arbitrary colors: use tokens (`bg-primary`, `text-muted-foreground`, `bg-muted`, ...). Only exception is ElevAI gold `bg-[#C8A84B]`; `bg-warning` for host chat bubbles and toggle.
- Mobile-first responsive, Tailwind spacing scale, dark mode via `.dark` + `app/assets/css/themes.css`, merge classes with `cn()` from `@/lib/utils`.

## 🖼️ Icons

`lucide:` by default (`<Icon name="lucide:user-check" />`). OTA logos `logos:airbnb`, `simple-icons:bookingdotcom`. Collections bundled: lucide, logos, simple-icons (no `lucide:broom`; use `lucide:brush-cleaning`).

## 🚫 Anti-Patterns

- Clone HTML from an existing component → import and compose
- `<a>` for internal navigation → `<NuxtLink>` / `<NuxtLinkLocale>`
- Hardcoded colors → theme tokens
- shadcn imports from anywhere but `@/components/ui/`
- Direct state mutation → spread syntax
- New component when a shadcn one exists → props/slots
- Icon-only buttons without `aria-label`
- `:checked` on reka-ui Switch/Checkbox, or a Checkbox inside `<label>`

## 🐛 Debugging Tips

- **Reactivity issue?** Check spread syntax in mutations.
- **Icon shows the wrong glyph until an interaction?** SSR hydration reuse in a TanStack table: wrap it in `<ClientOnly>`.
- **Style not applying?** Check `cn()` merge order and the dark mode class.
- **shadcn component broken?** Check `app.config.ts` / `components.json` and the import path.
