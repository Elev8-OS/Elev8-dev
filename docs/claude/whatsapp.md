> Split out of CLAUDE.md to keep the always-loaded context small. Read this file before working on this area; keep it updated when the code changes.

### WhatsApp Integration (`app/components/settings/` + `app/components/inbox/`)

> **Full UI spec** → `docs/superpowers/specs/2026-06-01-whatsapp-ui-spec.md` (Phase 1–4 wireframes, states, design tokens)

WhatsApp Business is integrated **into the existing inbox** (not a separate page). Mock/demo only — no real Meta API.

#### Settings → Integrations (`app/pages/settings/integrations.vue`)
- Route added to `SettingsSidebarNav.vue` + `constants/menus.ts`
- Shows only `SettingsWhatsAppIntegration`
- **`SettingsWhatsAppIntegration.vue`** — multi-account WhatsApp management: Connected tab (account cards with business name, listing count, Manage/Test Send/Disconnect) + Unassigned tab (bulk assign listings to accounts). **Manual credential form** (not OAuth) — user enters **Account name**, Access Token, WABA ID, Phone Number ID. Phone numbers are NOT displayed anywhere in the UI (no real phone data is available in this mock flow). On success: opens step-by-step flow (Step 1: Webhook → Step 2: Assign Listings). Clicking Manage on existing account opens dialog with 2 tabs: Credentials (edit account name/token/WABA/phone + webhook info) and Listings. Tabs hidden when no accounts connected.
- **Test Send dialog** — clicking Test Send opens a popup with: recipient phone input (`inputmode="numeric"`, country-agnostic `AsYouType` formatter with forced `+` prefix, keydown handler blocks non-digit keystrokes — only digits and clipboard shortcuts allowed), template picker (5 hardcoded templates: Welcome, Check-in, Check-out, House Rules, Custom), auto-generated variable inputs from template placeholders, live WhatsApp-style message preview, and Send button (disabled until phone + body valid).
- **`WhatsAppRoutingRules.vue`** — Routing rules (not currently used in UI)

#### Composables
- **`useWhatsApp.ts`** — `useState('whatsapp-accounts')`; multi-account `WhatsAppAccount[]` with `accessToken`, `wabaId`, `phoneNumberId`, `webhookToken` fields and `listingIds: string[]`. Key exports: `whatsappAccounts`, `isConnected`, `validateAndConnect(token, wabaId, phoneId, accountName)`, `addAccount()`, `removeAccount()`, `updateAccount()`, `assignListings()`, `bulkAssign()`, `disconnect()`. Persisted to localStorage. `validateAndConnect` mocks Graph API call (random mock business for `displayPhoneNumber`, uses user-supplied `accountName` as `businessName`) + auto-generates webhook token.
- **`useWhatsAppRules.ts`** — `useState('whatsapp-rules')`; `RoutingRule` type, `conditionTypeLabels`, `routeToLabels`, `ruleConditionText()`, `saveRule()`, `deleteRule()`, `toggleRule()` (component not currently used in UI)
- **`useWhatsAppTemplates.ts`** — `waTemplates` (booking_confirmation, checkin_instructions, upsell_early_checkin, review_request) + `renderTemplate()`

#### Inbox features (reuse existing channel filter / notes / assignment / AI / send-status)
- **Channel**: WhatsApp appears automatically in the List.vue Filters → Channel (from `otaSource`)
- **`WhatsAppSendModal.vue`** (`InboxWhatsAppSendModal`) — template picker + live preview; used by Thread (window-expired fallback) and reusable for reservation detail
- **Media messages** — `ThreadMessage.vue` renders `mediaUrl` image + dims caption inside bubble
- **24h window** — `Thread.vue` shows "window expired" banner + Send Template button when `otaSource === 'WhatsApp' && waWindowExpired`
- **Not-connected state** — `Thread.vue` shows "WhatsApp not connected" banner (link to `/settings/integrations`) when `otaSource === 'WhatsApp' && !useWhatsApp().isConnected`; takes priority over window-expired
- **Unmatched queue** — unmatched messages are conversations with `stayStatus: 'unmatched'`, filterable via the new "Unmatched" sidebar filter (`Nav.vue`). Thread shows an action bar (Match to Guest / Dismiss). `useInbox`: `matchUnmatched(umConvId, targetConvId)` (moves messages into target conv), `createFromUnmatched(umConvId)`, `dismissUnmatched(id)`
- **Automation channel** — Journeys builder (`JourneyStepSidebar.vue`) already had a `whatsapp` channel option
- **NOT implemented** (descoped per user): Claim/Release buttons, routing-mode badges (HostBuddy/Staff/Review) — `action_needed` status already covers escalation

#### Inbox SSR note
- `app/pages/inbox.vue` wraps `<InboxLayout>` in `<ClientOnly>` to avoid Reka UI `ScrollArea` hydration mismatches. `useInbox` merges fresh seed conversations/messages into `useState` so newly added seed data always appears.

#### Inbox reservation ID fix
- `app/components/inbox/Layout.vue` synthesizes `effectiveReservation` (passed to `ReservationPanel`) with `id: c.reservationId` — the **conversation's reservation ID** (`res-1`, `res-7`, etc.), NOT the conversation's own `id` (`conv-1`).
- This matters because any code that filters by `reservation.id === code.reservationId` (e.g. the Smart Lock tab) needs the synthesized id to match the code's `reservationId`. Using `c.id` here would cause the Smart Lock tab to always show "No active codes".
