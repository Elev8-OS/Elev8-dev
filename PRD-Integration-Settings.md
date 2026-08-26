# PRD: Integration Settings — Category Filter Chips & Integration Cards

**Status:** Draft (Requirements)
**Owner:** Juli (Product)
**Module:** Settings → Integrations (`/settings/integrations`)
**Last Updated:** 2026-08-25

---

## TL;DR (Developer Quickstart)

Redesign the Integrations settings page around **category filter chips** and a clean **card grid**. Each integration is a card that shows its provider icon, a live status pill, a one-line description, and a Connect/Manage action.

The page now exposes **exactly six integration cards**, grouped into four categories:

| Category | Cards |
|---|---|
| Messaging & Communication | WhatsApp Business |
| Devices & Sensors | Smart Lock, Minut (Noise & Sensor Monitoring) |
| Payments | Payout Gateways |
| Government Integration | AVS Meldeschein (Germany), Feratel (Austria) |

**What changes vs. current page:** remove the Email (Sending Domain) card, remove the 3CX Telephony card, and remove the APOA (Indonesian Immigration) card. Everything else is kept, but the card grid, chip filter, and status pills are standardized.

---

## 1. Problem Statement

The current Integrations page mixes every connected system into a single long list, and its category filter references categories and cards that are no longer in scope. The page needs to be a focused, scannable directory where staff can instantly see **what is connected** and **what still needs setup**, grouped by category.

---

## 2. Feature Summary

| Sub-feature | What it does |
|---|---|
| **Category filter chips** | Horizontal chip row: All / Messaging & Communication / Devices & Sensors / Payments / Government Integration. Selecting a chip filters the visible cards. |
| **Integration cards** | Six cards, each with provider icon, live status pill, description, and Connect/Manage button. |
| **Status pill** | Per-card `Connected` / `Not connected` / `Not configured` pill with a colored dot. |
| **Detail sheet** | Clicking a card's Connect/Manage action opens the existing config sheet (WhatsApp, Smart Lock, Minut, AVS, Feratel) or navigates to `/settings/payouts` (Payout). |
| **Connect / Manage label** | Button label switches based on connection state. |

---

## 3. Scope

### In scope
- Category chip filter (single-select, "All" default).
- Six integration cards in the four categories above.
- Per-card status pill driven by existing composables/state.
- Open the correct config sheet / route from each card.

### Out of scope
- Email (Sending Domain) card and its config sheet.
- 3CX Telephony card and its config sheet.
- APOA (Indonesian Immigration) card and its config sheet.
- New connection flows — reuse existing `*Integration.vue` components and composables unchanged.

---

## 4. Categories & Cards

### Category definitions

| Category | Chip label | Cards |
|---|---|---|
| `all` | All | Everything (no filter) |
| `messaging` | Messaging & Communication | WhatsApp Business |
| `devices` | Devices & Sensors | Smart Lock, Minut |
| `payments` | Payments | Payout Gateways |
| `government` | Government Integration | AVS Meldeschein, Feratel |

### Card spec (shared layout)

Each card, in order of appearance:

| Field | Requirement |
|---|---|
| Icon | Provider icon in a 36px (h-9 w-9) rounded container with a soft brand-tinted background. |
| Status pill | Top-right. Dot + label. See status mapping below. |
| Title | 14px medium (`text-sm font-medium`). |
| Description | 12px muted (`text-xs text-muted-foreground leading-relaxed`), 1–2 lines, flex-grows so buttons bottom-align. |
| Action | `outline` `size="sm"` button, `self-start`, label `Connect` when not connected, `Manage` when connected/configured. |

---

## 5. Card-by-Card

### 5.1 WhatsApp Business — `messaging`
- Icon: `logos:whatsapp-icon` on `bg-[#25D366]/10`.
- Status: from `useWhatsApp().isConnected` and `whatsappAccounts`.
  - Not connected → `Not connected`.
  - Connected → `Connected` (or `N accounts connected` when > 1).
- Description: "Send WhatsApp templates and receive 2-way guest messages in the Inbox."
- Action: opens `SettingsWhatsAppIntegration` sheet. Label `Connect` / `Manage`.

### 5.2 Smart Lock — `devices`
- Icon: `lucide:key-round` on `bg-amber-500/10`.
- Status: from `useSmartLock().isConnected` and `locks`.
  - Not connected → `Not connected`.
  - Connected → `Connected` (or `Connected · N locks` when N > 0).
- Description: "Pair locks to properties or rooms, auto-generate guest access codes, and monitor battery & connectivity."
- Action: opens `SettingsSmartLockIntegration` sheet. Label `Connect` / `Manage`.

### 5.3 Minut (Noise & Sensor Monitoring) — `devices`
- Icon: `lucide:audio-waveform` on `bg-sky-500/10`.
- Status: from `useMinut().isConnected` and `devices`.
  - Not connected → `Not connected`.
  - Connected → `Connected` (or `Connected · N devices` when N > 0).
- Description: "Receive noise, smoke, motion, and sensor events from Minut devices and trigger Journeys on them."
- Action: opens `SettingsMinutIntegration` sheet. Label `Connect` / `Manage`.

### 5.4 Payout Gateways — `payments`
- Icon: `lucide:wallet` on `bg-blue-500/10`.
- Status: from `payoutAccounts` count.
  - 0 → `Not configured`.
  - > 0 → `N accounts`.
- Description: "Connect Stripe, Doku, or Xendit for guest payments and settlements."
- Action: `<NuxtLink to="/settings/payouts">`, label `Connect` when 0 accounts, otherwise `Manage`.

### 5.5 AVS Meldeschein (Germany) — `government`
- Icon: `lucide:file-badge` on `bg-indigo-500/10`.
- Status: from `useGuestRegistration().isConnected('avs')` → `Connected` / `Not connected`.
- Description: "Generate municipal Meldeschein guest registrations for German properties."
- Action: opens `SettingsAvsMeldescheinIntegration` sheet. Label `Connect` / `Manage`.

### 5.6 Feratel (Austria) — `government`
- Icon: `lucide:landmark` on `bg-rose-500/10`.
- Status: from `useGuestRegistration().isConnected('feratel')` → `Connected` / `Not connected`.
- Description: "Generate municipal Meldewesen guest registrations for Austrian properties."
- Action: opens `SettingsFeratelIntegration` sheet. Label `Connect` / `Manage`.

---

## 6. Status Pill Mapping

| Tone | Classes (pill) | Classes (dot) | Trigger |
|---|---|---|---|
| `connected` | `bg-green-50 text-green-700` | `bg-green-500` | Any connected/configured state. |
| `idle` | `bg-muted text-muted-foreground` | `bg-muted-foreground/50` | `Not connected` / `Not configured`. |

---

## 7. Category Chip Filter Behavior

- Single-select chips (native `<button>`, not a toggle group).
- Default selection: `all`.
- Clicking a chip sets the active category; cards not in that category are hidden.
- Visual active state: `border-primary bg-primary/10 text-foreground`; inactive: `border-border bg-card text-muted-foreground hover:bg-muted`.
- Chip row: `flex flex-wrap items-center gap-2`.

---

## 8. Detail Sheet Routing

`openSheet(id)` maps to the existing components:

| id | Component | Sheet title |
|---|---|---|
| `whatsapp` | `SettingsWhatsAppIntegration` | WhatsApp Business |
| `smartlock` | `SettingsSmartLockIntegration` | Smart Lock |
| `minut` | `SettingsMinutIntegration` | Minut (Noise & Sensor Monitoring) |
| `avs` | `SettingsAvsMeldescheinIntegration` | AVS Meldeschein (Germany) |
| `feratel` | `SettingsFeratelIntegration` | Feratel (Austria) |

`payout` is not a sheet — it is a `NuxtLink` to `/settings/payouts`.

**Removed from mapping:** `threecx`, `email`, `apoa`.

---

## 9. Acceptance Criteria

1. The page renders exactly six cards in four categories.
2. The category chip row has five chips: All, Messaging & Communication, Devices & Sensors, Payments, Government Integration.
3. `All` shows all six cards; each other chip shows only its category's cards.
4. Email, 3CX, and APOA cards are absent.
5. Each card's status pill reflects the live state from its composable/data source.
6. WhatsApp, Smart Lock, Minut, AVS, and Feratel open their correct config sheet with the correct title.
7. Payout Gateways navigates to `/settings/payouts`.
8. Connect/Manage label switches correctly per connection state.
9. No dead references to removed integrations remain in the overview component.

---

## 10. File Inventory

| File | Change |
|---|---|
| `app/components/settings/SettingsIntegrationsOverview.vue` | Primary change — update category list, card set, status computeds, sheet routing. Remove Email/3CX/APOA cards, imports, computeds, and mapping branches. |
| `app/components/settings/EmailIntegration.vue` | Untouched (component can stay, just no longer surfaced). |
| `app/components/settings/ThreeCxIntegration.vue` | Untouched (component can stay, just no longer surfaced). |
| `app/components/settings/ApoaIntegration.vue` | Untouched (component can stay, just no longer surfaced). |

---

## 11. Known Gaps

- Email and 3CX composables (`useEmailIntegration`, `useThreeCX`) remain available elsewhere in the app; removing their cards from this page does not remove those systems from other surfaces.
- APOA remains available via the Guest Registration module; only its Integrations overview card is removed.
