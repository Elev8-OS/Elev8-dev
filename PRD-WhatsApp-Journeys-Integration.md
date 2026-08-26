# PRD: WhatsApp × Journeys Integration

**Status:** Draft (Requirements)
**Owner:** Juli (Product)
**Module:** Journeys (Smart Flow), Settings → Integrations → WhatsApp
**Last Updated:** 2026-08-26

---

## TL;DR (Developer Quickstart)

Journeys can send WhatsApp messages as automation steps. A message step chooses a **channel** (`OTA Inbox` / `WhatsApp`); when the channel is WhatsApp, the step is locked to **Template mode** and the builder picks one **approved WhatsApp template** from the WhatsApp Template Studio.

The three pieces that must work together:

| Surface | What it owns |
|---|---|
| **Settings → Integrations → WhatsApp** | Connection state + per-listing assignment + Routing Rules + the **Template Studio** (build/submit/manage Meta-approved templates). |
| **Journeys editor → Message step** | Channel selector → WhatsApp locks to Template → template picker limited to `approvedTemplates`. |
| **`useWhatsAppTemplates`** | Single source of truth for templates; emits the Meta Cloud API send payload when a journey fires a WhatsApp step. |

**Hard rule:** A Journey may only send a WhatsApp message through a Meta-**approved** template. Free-form AI directives are not allowed on WhatsApp (Meta's 24h window / template-only requirement). Selecting WhatsApp channel must force `messageMode: 'template'` and clear `aiPersonalization`.

---

## 1. Problem Statement

Journeys can already trigger on reservation, conversation, calendar, and integration events — but its outbound `message` step was originally built for OTA channel with free-form AI directives. WhatsApp is different: Meta's Business API requires that proactive (business-initiated) messages be sent through **pre-approved templates** with **positional variables** (`{{1}}`, `{{2}}`…), not arbitrary AI-generated text.

So the WhatsApp ↔ Journey loop has three gaps today:

1. **Template selection is disconnected** — templates live in the WhatsApp Template Studio, but the Journey step needs to reference a specific approved template and fail safely if none is approved.
2. **Variable mapping is not surfaced to the Journey author** — a template author writes `{{guest_name}}`, Meta requires `{{1}}`, and the Journey step must not silently produce a broken message.
3. **Connection gating is inconsistent** — the editor shows WhatsApp as a channel even when WhatsApp isn't connected, and the step card warns but doesn't prevent a broken configuration.

**WhatsApp × Journeys closes this loop:** a WhatsApp message step that (a) is gated on a connected WhatsApp Business Account, (b) is limited to approved templates, (c) maps friendly variables to Meta positional parameters, and (d) produces a correct Meta send payload at run time.

---

## 2. Feature Summary

| Sub-feature | What it does |
|---|---|
| **WhatsApp channel on Message step** | A message step's `channel` can be `whatsapp` (alongside `ota`). |
| **Template-only lock** | Selecting WhatsApp forces `messageMode: 'template'` and clears `aiPersonalization` (free-form directives are disallowed). |
| **Approved-template picker** | The Journey step picks from `approvedTemplates` only; drafts/pending/rejected/paused/disabled templates are not selectable. |
| **Template reference** | `MessageStep.whatsappTemplateId` points to a specific `WhatsAppTemplate` id; the step card renders the template name. |
| **Meta payload generation** | `buildMetaSendPayload()` maps friendly variables → positional params and returns a Meta Cloud API `template` message payload. |
| **Connection gating** | WhatsApp message steps and template actions are gated on `useWhatsApp().isConnected`. When WhatsApp is not connected, selecting the WhatsApp channel replaces the message editor with a "Connect WhatsApp" prompt (button → `/settings/integrations`); no misleading editor fields are shown. |
| **No warnings when connected** | When WhatsApp is connected, no "Requires WhatsApp Business API" notice (sidebar) and no "WhatsApp not configured" triangle (step card) is shown. |
| **Disconnect auto-pause** | When WhatsApp disconnects, any active Journey containing a WhatsApp `message` step is auto-deactivated (status → `inactive`) with a toast; the Journeys list shows an amber warning triangle (tooltip) on affected journeys until WhatsApp reconnects. |
| **Partial-coverage editor banner** | When the journey has a WhatsApp step but its scope includes listings with no connected WhatsApp account, the editor shows a banner: "WhatsApp messages will only send to X of Y selected listings" with a "Review listing assignment" action. |
| **Template Studio** | Build, validate, submit, and manage WhatsApp templates (Meta-compliant) from Settings → Integrations → WhatsApp → Templates. |
| **Routing rules (adjacent)** | Inbound WhatsApp message routing (keywords / AI confidence / time / language / status) — separate from outbound Journeys but shares the same connection. |

---

## 3. Scope

### In scope (V1)

- WhatsApp as a second `ChannelType` on the Journey `message` step (alongside `ota`).
- Template-only constraint when `channel === 'whatsapp'`.
- Approved-template selector in the Journey step sidebar and in If/Else branch message configs.
- `whatsappTemplateId` reference field on `MessageStep`.
- Meta variable normalization (`{{guest_name}}` → `{{1}}`) and send-payload building.
- WhatsApp connection gating for WhatsApp message steps.
- Auto-deactivation of active WhatsApp-dependent journeys on disconnect, with a warning indicator in the Journeys list.
- WhatsApp Template Studio (create/edit/submit/duplicate/delete, status lifecycle, Meta-compliant validation).
- Per-listing assignment of a WhatsApp account (used to route a journey's send to the right business number).

### Out of scope (V1 — see Known Gaps)

- Real Meta Cloud API send/receive calls (see Known Gaps #1).
- Real Meta Embedded Signup / OAuth handshake (see Known Gaps #2).
- Real Meta template review webhook (see Known Gaps #3).
- Template variable value resolution at send time (the Journey fires the payload with placeholders; actual guest-data substitution into the payload is not yet wired — see Known Gaps #4).
- Inbound-triggered journeys on WhatsApp messages (a WhatsApp reply does not yet fire a `conversation_content` / `new_message_received` journey — see Known Gaps #5).
- Free-form WhatsApp replies outside the 24h window in the Unified Inbox (existing `WhatsAppSendModal` path, not Journeys).

---

## 4. Current Wiring (as-built baseline)

| Concern | Implementation |
|---|---|
| Connection state | `useWhatsApp()` → `whatsappAccounts` (`useState`, persisted to `elev8-whatsapp-accounts`), `isConnected`, `assignListings`, `bulkAssign`, `disconnect`, `getConnectedAccountForListing`, `hasConnectedAccountForListing`, `resolveWhatsAppCoverage`. |
| Templates | `useWhatsAppTemplates()` → `templates`, `approvedTemplates`, CRUD, `submitTemplate`, `buildMetaSendPayload`, `renderTemplate`. |
| Template types | `app/components/journeys/data/whatsapp-templates.ts` → `WhatsAppTemplate`, `TemplateStatus`, `HeaderType`, `ButtonKind`, `validateTemplate`, `mapVariablesToPositional`, `insertableVariables`. |
| Journey message step | `MessageStep` in `app/components/journeys/data/journeys.ts` has `channel: ChannelType`, `messageMode`, `whatsappTemplateId`. |
| Editor surface | `JourneyStepSidebar.vue` renders the channel selector, template lock, and approved-template picker; `JourneyStepCard.vue` renders the WhatsApp summary + "not configured" warning. |
| Template Studio | Hosted in `WhatsAppIntegration.vue` (Settings → Integrations → WhatsApp → Templates tab) using `WhatsAppTemplatesList.vue` + `WhatsAppTemplateBuilder.vue` + `WhatsAppTemplatePreview.vue`. |
| Routing rules | `useWhatsAppRules()` (inbound only, first-match-wins). |

---

## 5. Feature Deep-Dive A — WhatsApp Message Step

### Recommended User Flow

1. PM opens a Journey in the editor and adds a **Send Message** step.
2. In the step sidebar, PM changes **Channel** from `OTA Inbox` to `WhatsApp`.
3. The step locks **Message Mode** to **Template** (the "AI Directive" option is disabled and a note reads "WhatsApp only supports Template mode").
4. PM picks an **approved template** from the dropdown (drafts/pending/rejected are hidden).
5. When WhatsApp is connected, no "Requires WhatsApp Business API" notice appears, and the step card shows no "WhatsApp not configured" triangle.
6. PM saves the Journey; at run time the step emits a Meta template message for the guest.

### Not-connected behavior

When WhatsApp is **not connected**, selecting the `WhatsApp` channel replaces the entire message editor (mode toggle, template picker, directive/static text, variables, context check, personalization) with a single prompt:

- "WhatsApp isn't connected" + explanatory copy + a **Connect WhatsApp** button that navigates to `/settings/integrations`.
- The step card shows a warning triangle with tooltip "WhatsApp not configured" (only in this disconnected state).

### System Logic

- `channel` on `MessageStep` must be one of `ota | whatsapp`.
- When `channel` changes to `whatsapp`, the editor must set `messageMode: 'template'` and `aiPersonalization: false` (a `watch` on `channel` enforces this).
- The template picker reads `approvedTemplates` from `useWhatsAppTemplates()`; `whatsappTemplateId` stores the selection.
- If `approvedTemplates` is empty, the picker shows an empty state: "No approved templates yet. Create one from Settings → Integrations → WhatsApp → Templates."
- If WhatsApp is not connected, the message editor is hidden and replaced by the "Connect WhatsApp" prompt (the step is configured but non-runnable).

### Edge Cases

- WhatsApp selected but no template picked → step is incomplete; card shows `Template · WhatsApp` with no name; save is allowed but run time skips with a warning.
- Template deleted after being referenced → `getTemplateById()` returns `undefined`; card shows `Unknown template`.
- Template `paused`/`disabled`/`rejected` after being referenced → the step still stores the id, but the run-time resolver must re-check `status === 'approved'` before sending.

---

## 6. Feature Deep-Dive B — Meta Template & Variable Mapping

### Recommended User Flow

1. PM opens the Template Studio and builds a template, inserting fields like **Guest First Name** (`{{guest_name}}`) into the body.
2. The builder shows a **Meta Parameter Mapping** panel translating each friendly key to positional `{{1}}`, `{{2}}`… in order of first appearance.
3. PM submits for review; the template moves `draft → pending → approved/rejected` with a simulated review outcome.
4. Once `approved`, the template becomes available in Journey message steps.

### System Logic

- `mapVariablesToPositional(body)` returns `{ normalizedBody, mapping }`; `{{guest_name}}` → `{{1}}`, etc.
- `validateTemplate()` enforces Meta rules: lowercase `a-z0-9_` name, no variable at start/end, no adjacent variables, sequential numbering from `{{1}}`, quick-reply vs CTA button mutual exclusivity, HTTPS CTA URLs, no `wa.me`/shorteners, header/footer length caps.
- `buildMetaSendPayload(template, to, vars)` returns `MetaSendPayload` with `messaging_product: 'whatsapp'`, `type: 'template'`, `template.name`, `template.language.code`, and `components` (header / body / button parameters).
- `TemplateStatus` lifecycle: `draft → pending → approved | rejected`, with `paused` and `disabled` as Meta-side degraded states.

### Business Rules

- A Journey may reference only `status === 'approved'` templates.
- Template name must be lowercase alphanumeric + underscores (Meta requirement).
- Template category must match content (`utility` vs `marketing` vs `authentication`) — a mismatch is a common Meta rejection.
- Variables map to positional params strictly by order of first appearance; the Journey author does not manually renumber.

---

## 7. Feature Deep-Dive C — Connection & Listing Mapping

### Recommended User Flow

1. PM connects a WhatsApp Business Account in Settings → Integrations → WhatsApp.
2. PM assigns listings to the account (`assignListings` / `bulkAssign`); each listing maps to at most one account.
3. Journeys targeting a listing resolve the owning account's `phoneNumberId` / `wabaId` at send time.

### System Logic

- `WhatsAppAccount` carries `businessName`, `displayPhoneNumber`, `phoneNumberId`, `wabaId`, `accessToken`, `webhookToken`, `status`, `listingIds`.
- `assignListings(accountId, listingIds)` removes those listings from any other account (exclusive ownership).
- `disconnect()` clears accounts but preserves template and conversation history (consistent with the WhatsApp/3CX disconnect pattern).
- The Journey engine must resolve a guest's listing → WhatsApp account → `phoneNumberId` to build the `to`/sender context.

### Partial Listing Coverage (WhatsApp connected on some listings only)

A Journey's `properties` scope (e.g. `All Properties`) can span listings that have a connected WhatsApp account **and** listings that do not. This is a first-class scenario, not an error state.

**Behavior when a WhatsApp step runs:**

- The Journey engine resolves the guest's listing → WhatsApp account at send time.
- **Listing has a connected account** → the WhatsApp step fires normally.
- **Listing has no connected account** → the WhatsApp step is **skipped for that guest only**; the Journey continues to the next step (do not stop, do not fail the whole run).
- A skip is recorded as a non-blocking warning (surfaced in the Journey run log / activity), never as a hard error.

**Behavior at configuration time (editor):**

- If `isConnected` is false (no accounts at all), every WhatsApp step is flagged non-runnable (message editor replaced with "Connect WhatsApp").
- If accounts exist but coverage is partial, the editor shows a banner: **"WhatsApp messages will only send to {coveredCount} of {total} selected listings"** with secondary copy ("{uncovered} listing(s) don't have a WhatsApp account assigned and will be skipped at runtime") and a **Review listing assignment** action → `/settings/integrations`. It does **not** block saving.

### Canonical listing resolution

The Journey property picker and WhatsApp listing assignment must share the **same listing universe** (`app/components/listings/data/listings.ts`), so coverage is computed on the same IDs.

- `SharedPropertyPicker` emits a stable `id` when options provide one (falls back to `name` for legacy name-only consumers).
- `JourneyEditor.vue` passes `listings.ts` options (id + name + city + derived region) into the picker.
- `whatsappCoverage` computes `coveredCount` / `total` / `uncovered` by intersecting the journey scope (resolved to listing ids; `All Properties` → all ids) against the union of `listingIds` across `connected` WhatsApp accounts.
- The banner shows only when the journey has a WhatsApp `message` step and `coveredCount < total`.

### Disconnect behavior

When WhatsApp disconnects (single account removed, or all accounts cleared):

- Every active Journey containing a WhatsApp `message` step is auto-deactivated (`status → inactive`), with a toast: `"N journeys paused because WhatsApp disconnected."`
- The Journeys list shows an amber warning triangle (tooltip: `"WhatsApp not connected — this journey won't send WhatsApp messages"`) on each affected journey while WhatsApp remains disconnected.
- The message editor in an affected journey's sidebar reverts to the "WhatsApp isn't connected / Connect WhatsApp" prompt; the step card shows the "WhatsApp not configured" triangle.
- Templates (`elev8-whatsapp-templates`) and journey step template references are **preserved**; only the account + per-listing assignment is lost.
- The auto-pause fires only on the **transition** to disconnected — it does not override a PM who deliberately re-activates a journey afterward. The warning triangle stays visible until WhatsApp reconnects.
- Reconnect restores the editor surface and step-card state, but the PM must re-assign listings on the new account (surfaced in the disconnect confirmation dialog).

### Edge Cases

- Listing not assigned to any account → the journey's WhatsApp step is skipped for that guest with a warning (see partial-coverage rule above).
- Multiple accounts connected → each listing belongs to exactly one; unassigned listings fall back to a tenant default (open question — see Known Gaps #6).
- Journey scope is a specific listing that has no account → all WhatsApp steps in that journey are effectively inert; the editor surfaces a prominent "WhatsApp not connected for this listing" notice.

---

## 8. Data Model

```
ChannelType        = 'ota' | 'whatsapp'

MessageStep {
  type: 'message'
  messageMode: 'template' | 'directive'   // forced to 'template' for whatsapp
  channel: ChannelType
  templateText: string                     // used for non-whatsapp template text
  directive: string                        // AI directive (non-whatsapp only)
  contextCheckEnabled: boolean
  contextCheckInstruction: string
  fallback: 'skip' | 'static'
  fallbackText: string
  aiPersonalization?: boolean              // cleared when channel === 'whatsapp'
  whatsappTemplateId?: string              // references WhatsAppTemplate.id
}

WhatsAppTemplate {
  id, name, category ('utility'|'marketing'|'authentication'), language,
  status ('draft'|'pending'|'approved'|'rejected'|'paused'|'disabled'),
  statusReason?, qualityRating?,
  header { type ('none'|'text'|'image'|'video'|'document'), text?, mediaUrl?, mediaFilename? },
  body, footer?,
  buttons [{ id, kind ('quick_reply'|'cta_url'|'cta_phone'), text, url?, phoneNumber? }],
  createdAt, submittedAt?, approvedAt?, lastModified
}

WhatsAppAccount {
  id, businessName, displayPhoneNumber, phoneNumberId, wabaId,
  accessToken, webhookToken, status ('connected'|'disconnected'|'pending'),
  connectedAt, listingIds: string[]
}
```

**Persistence:** `elev8-whatsapp-accounts` and `elev8-whatsapp-templates` (localStorage). Journey steps persist inside the existing `useJourneys`/editor state; they reference template ids, not full template objects.

**Coverage helpers (`useWhatsApp`):**

```
getConnectedAccountForListing(listingId): WhatsAppAccount | undefined
hasConnectedAccountForListing(listingId): boolean
resolveWhatsAppCoverage(listingIds): { covered: string[], uncovered: string[] }
```

**Journey resolution (`useJourneys`):**

```
resolveWhatsAppStep(step: MessageStep, listingId): { fire, reason?, accountId? }
// fire:false + reason:'uncovered'  → skip this guest, continue journey
// fire:false + reason:'not_whatsapp' → non-WhatsApp step, not applicable
```

---

## 9. Acceptance Criteria

1. A Journey message step exposes `WhatsApp` as a channel option alongside `OTA Inbox`.
2. Selecting `WhatsApp` locks Message Mode to `Template`, disables `AI Directive`, and clears `aiPersonalization`.
3. The template picker shows only `approvedTemplates`; the selected template's name appears on the step card.
4. A WhatsApp step with no approved templates shows a clear empty state pointing to the Template Studio.
5. When WhatsApp is **connected**, the sidebar shows **no** "Requires WhatsApp Business API" notice and the step card shows **no** "WhatsApp not configured" triangle.
6. When WhatsApp is **not connected**, selecting the WhatsApp channel hides the message editor and shows a "WhatsApp isn't connected" prompt with a Connect WhatsApp button → `/settings/integrations`; the step card shows the warning triangle only in this state.
7. `mapVariablesToPositional` correctly maps friendly keys to sequential `{{1}}…{{N}}` and `buildMetaSendPayload` emits a valid Meta `template` payload (header/body/button components).
8. `validateTemplate` blocks submissions that violate Meta rules (name format, variable placement/sequencing, button mutual exclusivity, URL/`wa.me` restrictions).
9. Template status transitions `draft → pending → approved|rejected`; only `approved` templates are selectable in Journeys.
10. If/Else branch message configs enforce the same WhatsApp template-only constraint and the same connected/not-connected behavior.
11. WhatsApp connection gating prevents a Journey from running a WhatsApp step when no connected account exists.
12. When a Journey's scope includes both covered and uncovered listings, the WhatsApp step fires only for listings assigned to a connected account and is skipped (non-blocking warning) for uncovered listings.
13. The Journey editor shows a partial-coverage banner ("only send to X of Y selected listings") with a Review listing assignment action when the journey has a WhatsApp step and `coveredCount < total`.
14. Journey scope and WhatsApp assignment resolve against the same `listings.ts` ids (via `SharedPropertyPicker` emitting stable ids).
15. Disconnecting WhatsApp preserves template and conversation history, but clears accounts and their listing assignments.
16. Disconnecting WhatsApp auto-deactivates every active journey with a WhatsApp step and shows a toast ("N journeys paused because WhatsApp disconnected.").
17. While WhatsApp is disconnected, the Journeys list shows an amber warning triangle (tooltip) on every journey with a WhatsApp step.
18. Unit tests cover channel lock, approved-only filtering, variable mapping, payload building, template validation, connection gating, and partial-listing-coverage skip behavior.

---

## 10. Known Gaps

1. **Real Meta Cloud API** — `buildMetaSendPayload` produces the correct shape, but there is no server-side sender that actually posts to Meta's `messages` endpoint. A real sender must reuse this payload and resolve `accessToken`/`phoneNumberId` server-side. *Blocked on provider credentials + server deployment.*
2. **Real Embedded Signup / OAuth** — `validateAndConnect` simulates a successful connection; a real Meta Embedded Signup or OAuth flow must replace it (per product rule: WhatsApp connection must use OAuth, not manual form fields).
3. **Real template review webhook** — `submitTemplate` simulates approval; a real Meta template-status webhook must drive `status` transitions (`pending → approved/rejected/paused/disabled`).
4. **Send-time variable resolution** — the Journey fires a template reference, but substituting actual guest data (`guest_name`, `door_code`, `guide_link`) into `vars` before `buildMetaSendPayload` is not yet wired end-to-end.
5. **Inbound-triggered Journeys on WhatsApp** — WhatsApp replies do not yet fire `conversation_content` / `new_message_received` / `sentiment_change` triggers; the inbound pipeline (Unified Inbox) and the Journey trigger engine are not connected.
6. **Multi-account sender resolution** — with multiple connected accounts, the fallback sender for a listing not assigned to any account is undefined; a tenant-default sender needs a decision. Partial-coverage skip is specified and the editor banner surfaces it (listings without an account are skipped), but whether a tenant-wide default number should cover them is still open.
7. **Unmatched WhatsApp senders** — inbound routing to Journeys for unmatched numbers is not defined (only the Inbox unmatched flow exists).

---

## 11. Dependencies & Open Questions

1. **Meta provider contract** — the exact Meta Cloud API endpoint path, auth model (permanent token vs. system-user token), and template/webhook schemas are not in this codebase. Per the repo convention, do not invent these; engineering must confirm the exact endpoint, auth, and webhook contract. *Deferred to dev.*
2. **24h window enforcement** — should the Journey engine ever send a free-form (non-template) WhatsApp message inside the 24h customer-service window, or always template-only? V1 assumes always template-only.
3. **Template categories** — should the Template Studio auto-suggest a category from content, or leave it fully manual? V1 is manual with validation.
4. **Variable value source** — which reservation/listing fields map to each insertable variable at send time (single source of truth for `guest_name`, `door_code`, `guide_link`, etc.)?
5. **Tenant-default sender** — when a listing has no assigned account, is there a fallback business number, or is the send skipped?

---

## 12. Related Modules

- **Journeys editor** — `JourneyStepSidebar.vue`, `JourneyStepCard.vue`, `JourneyEditor.vue` (message-step channel/template config, connected/not-connected prompt, partial-coverage banner).
- **Shared property picker** — `app/components/shared/PropertyPicker.vue` (emits stable `id` when options provide one; legacy name-only fallback).
- **Journeys data** — `app/components/journeys/data/journeys.ts` (`MessageStep`, `ChannelType`).
- **Template Studio** — `WhatsAppTemplatesList.vue`, `WhatsAppTemplateBuilder.vue`, `WhatsAppTemplatePreview.vue`, `app/components/journeys/data/whatsapp-templates.ts`.
- **Composables** — `useWhatsApp.ts` (connection + coverage resolvers), `useWhatsAppTemplates.ts`, `useWhatsAppRules.ts`, `useJourneys.ts` (`resolveWhatsAppStep`).
- **Listings data** — `app/components/listings/data/listings.ts` (canonical listing universe shared by journey scope + WhatsApp assignment).
- **Settings** — `WhatsAppIntegration.vue`, `SettingsIntegrationsOverview.vue` (WhatsApp card).
- **Unified Inbox** — `WhatsAppSendModal.vue`, `ReplyBox.vue`, `Thread.vue` (out-of-scope but shares templates/connection).
