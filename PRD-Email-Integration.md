# PRD: Email Integration — Branded Sending Domain & Inbound Guest Replies

**Status:** Draft v1
**Owner:** Juli (Product)
**Module:** Integrations (Settings), Unified Inbox, Notification Center
**AI Engine:** N/A (no AI in V1 — pure channel plumbing)

---

## 1. Problem Statement

Guest email is scattered across personal inboxes nobody else on the team can see:

1. Hosts answer guest email from a personal Gmail/Outlook address — replies live outside Elev8, so there's no team-wide record, no handover trail, and no data feeding the rest of the platform.
2. Outbound email (check-in info, receipts, guest guides) is sent from an inconsistent or unbranded address, hurting trust and deliverability.
3. There is no inbound path at all — when a guest replies by email, that reply never reaches the Unified Inbox, so a guest conversation can silently die outside the platform.

**Email Integration closes this loop:** one tenant-wide sending domain (branded or free default) that every outbound surface uses, plus an inbound pipeline that routes guest replies into the Unified Inbox — matched to the right conversation/reservation, or surfaced as a new unmatched conversation when unknown.

---

## 2. Feature Summary

| Sub-feature | What it does |
|---|---|
| **Sending Domain (Default)** | Zero-setup tenant address (`acme-inc@mail.elev8-suite.com`) — verified instantly, no DNS required. |
| **Sending Domain (Custom)** | Connect your own domain (`stay@villacanggu.com`) — generates SPF/DKIM/TXT/MX records, verifies via DNS, default stays active while pending (no downtime). |
| **Single active sender** | One config point (`getActiveEmailAddress()`) that every outbound surface follows — currently wired to Unified Inbox email replies. |
| **Inbound replies (V1, simulated)** | Guest email replies land in the Unified Inbox automatically: matched to conversation/reservation by sender address, or surfaced as a new unmatched Email conversation. |
| **Inbound notifications** | Pop-up toast (like 3CX screen-pop) + Notification Center alert (`EMAIL_REPLY_RECEIVED`) + unread badge. |
| **Simulate inbound (demo)** | Trigger a demo inbound email from the thread or the Email Integration page — no real webhook needed for V1. |

---

## 3. Scope

**In scope (V1):**
- Connect default or custom sending domain
- DNS record generation + mock verification flow (SPF, DKIM, TXT, optional MX)
- Single active sender used by Unified Inbox email replies
- Inbound pipeline: match-by-email → append to conversation / create unmatched conversation
- Pop-up + Notification Center alert + unread badge on inbound reply
- "Simulate inbound" trigger from Email Integration page and email thread
- Email Integration card in the Inbox → Integrations sheet

**Out of scope (V1, flag for roadmap):**
- Real email webhook/IMAP/SMTP ingestion (inbound is simulated; a real provider hook can attach to `simulateInboundEmail` later)
- Fan-out of the active sender to Guest Guide, Dynamic Templates, and receipts (UI copy currently claims this; code only wires the Inbox today)
- Auto-reply / AI drafting for email
- Per-unit (per-listing) email routing

---

## 4. Roles & Access

| Role | Access |
|---|---|
| **Admin** | Full: connect/disconnect domain, DNS verify, simulate inbound, reply from Inbox |
| **Guest Experience Manager** | Full: reply to email conversations, simulate inbound (primary daily user) |
| **Listing Manager** | Reply to email conversations assigned to them |
| **Owner** | No access to email domain settings or inbound email threads (consistent with existing owner read-only pattern) |

---

## 5. Feature Deep-Dive A — Sending Domain

### Recommended User Flow
1. PM opens **Settings → Integrations → Email (Sending Domain)**.
2. Chooses one of two options:
   - **Use default address** — one click, verified instantly, no DNS.
   - **Connect my own domain** — enters domain (`villacanggu.com`) + prefix (`stay`); preview shows `stay@villacanggu.com`.
3. Custom mode → 4 DNS records generated (SPF, DKIM, TXT ownership token, optional MX for inbound). PM copies them to their registrar.
4. PM clicks **Verify** → mock DNS check (~1.2s) → status flips to **Verified**, `EMAIL_DOMAIN_VERIFIED` alert fires.
5. Active address (verified custom if present, else default) is used as the `from` for email replies in the Unified Inbox.

### System Logic
- `EmailAccount`: `{ mode: 'default' | 'custom', domain, prefix, address, status: 'pending' | 'verified', dnsRecords[], verificationToken, connectedAt, verifiedAt }`
- Persisted to `localStorage` (`elev8-email-accounts`).
- While a custom domain is **pending**, the default address remains the active sender — no downtime.
- `getActiveEmailAddress()` = verified custom → else default → else `null` (not connected). Single source of truth for outbound.

### Edge Cases
- Domain already has an SPF record (e.g. Google Workspace) → UI warns to append `include:send.elev8suite.com` instead of replacing.
- DNS propagation can take up to 48h → UI shows "verifying" state with pending banner, `Re-check verification` button.
- User disconnects → accounts cleared, existing email threads preserved (matches WhatsApp/3CX disconnect pattern).

### Notification Implications
- `EMAIL_DOMAIN_VERIFIED` (INFO) → routes to `/settings/integrations`.
- `EMAIL_DNS_FAILING` already exists as an alert type for drifted records.

---

## 6. Feature Deep-Dive B — Inbound Replies (V1 simulated)

### Recommended User Flow
1. Guest replies to an email sent from the connected address.
2. Inbound pipeline matches the sender address:
   - **Matched** (guest email belongs to an Email conversation, or a reservation's guest email) → message appended to that thread, conversation bumped to `action_needed` + `unreadCount`.
   - **Unmatched** → new Email conversation created (stayStatus `unmatched`, label `unmatched`), visible in the Inbox with a match flow.
3. A **pop-up toast** ("Incoming email") appears bottom-right — guest name, listing, subject — with **Open conversation** (jumps to the thread in `/inbox`) and **Dismiss**.
4. A **Notification Center alert** (`EMAIL_REPLY_RECEIVED`, INFO) fires — routes to `/inbox`.
5. PM opens the conversation and replies from the connected sending address via the normal Reply Box.

### System Logic
- Matching helper: `findConversationByEmail` — (1) direct `guestEmail` on an Email conversation, (2) reservation guest email → Email conversation for that reservation.
- `simulateInboundEmail` (in `useEmailIntegration`) wraps the inbox pipeline, then:
  - creates an `EmailInboxPop` (dismissable),
  - creates an `EMAIL_REPLY_RECEIVED` alert with `{ guestName, from, subject, conversationId, matched }`.
- `EmailScreenPop.vue` reads `getActiveEmailPop()`; `Layout.vue` mounts it beside the 3CX screen-pop.
- Real ingestion: a future webhook endpoint would call the same `simulateInboundEmail` with the parsed `{ from, to, subject, content }`.

### Edge Cases
- Sender unknown → unmatched conversation created, never silently dropped.
- Guest email belongs to a reservation but no Email conversation exists → matched via reservation → conversation created on the existing reservation thread pattern.
- Email not connected → thread shows "Email not connected" banner with Connect link (no reply box, no inbound).
- Pop-up for the current user only; dismissing one pop doesn't dismiss future ones.

### Notification Implications
- `EMAIL_REPLY_RECEIVED` (INFO) → routes to `/inbox`, included in `EMAIL_TYPES` notification category so users can toggle it in Notification Settings.

---

## 7. Data Model

```
EmailAccount {
  id, mode ('default'|'custom'), domain, prefix, address,
  status ('pending'|'verified'),
  dnsRecords: [{ type ('SPF'|'DKIM'|'TXT'|'MX'), host, value, purpose, optional? }],
  verificationToken, connectedAt, verifiedAt
}

EmailInboxPop {
  id, conversationId, guestName, listingName, from, subject, timestamp, dismissed
}

Inbound message → standard Message { sender: 'guest', channel: 'Email', fromAddress, toAddress, subject?, content, timestamp }
```

**Persistence:** `elev8-email-accounts` (localStorage). Inbox conversations/messages use the existing `useInbox` state (no separate email inbox store — replies are normal inbox messages).

---

## 8. Notification Center Integration

| Alert type | Severity | Label | Icon | Route |
|---|---|---|---|---|
| `EMAIL_DOMAIN_VERIFIED` | INFO | Email - Domain Verified | `i-lucide-mail-check` | `/settings/integrations` |
| `EMAIL_DNS_FAILING` | WARNING | Email - DNS Verification Failing | `i-lucide-triangle-alert` | `/settings/integrations` |
| `EMAIL_REPLY_RECEIVED` | INFO | Email - Reply Received | `i-lucide-mail-open` | `/inbox` |

- `EMAIL_REPLY_RECEIVED` maps to notification kind `system` (default fallback).
- Included in `EMAIL_TYPES` so it can be toggled per-role in Notification Settings.
- Pop-up (`EmailScreenPop`) is separate from Notification Center — it's the immediate attention-grabber, the alert is the durable record.

---

## 9. Acceptance Criteria

- [ ] PM can connect the default address with one click and it shows as Verified immediately.
- [ ] PM can connect a custom domain, copy the 4 DNS records (SPF, DKIM, TXT, MX-optional), and verify it (mock).
- [ ] While a custom domain is pending, the default address stays active for sending.
- [ ] Email replies in the Unified Inbox are sent `from` the connected address (`getActiveEmailAddress()`).
- [ ] Simulating an inbound email from a known guest appends the message to the matching thread, bumps `action_needed` + unread.
- [ ] Simulating an inbound email from an unknown sender creates an unmatched Email conversation.
- [ ] Every inbound reply shows a pop-up toast with Open conversation / Dismiss, and creates an `EMAIL_REPLY_RECEIVED` alert routing to `/inbox`.
- [ ] The Email Integration card appears in the Inbox → Integrations sheet.
- [ ] Unit tests cover connectDefault, connectCustom validation, verifyDomain, disconnect, matched inbound, unmatched inbound.

---

## 10. Dependencies & Open Questions

1. **Real email provider** — which provider will handle sending + receiving (SendGrid/Postmark/SES + MX routing, or a full IMAP inbox sync)? V1 is mocked; the real webhook should call the existing `simulateInboundEmail` pipeline. *Needs product decision.*
2. **MX requirement** — should receiving be gated on an MX record in a real deployment? V1 keeps it optional (receiving active as soon as domain is verified) so demo and first real use aren't blocked by DNS propagation. Revisit before production.
3. **Fan-out of the sender** — the Email Integration UI copy says the address is "used across Unified Inbox replies, Hostbuddy, Guest Guide, Dynamic Templates, and receipt emails," but only the Inbox currently reads `getActiveEmailAddress()`. Decide whether to wire the other surfaces (or soften the copy) in a follow-up.
4. **Unmatched sender handling** — confirm the match-unmatched flow (merge into an existing conversation vs. create a new one) mirrors what WhatsApp/3CX do, and whether unmatched email needs a reservation-creation shortcut (like `createFromUnmatched`).
5. **Per-listing routing** — larger portfolios may want `stay@<listing>.domain` style addresses; currently one active address per tenant. Flag for V2 if demand appears.

---

## 11. Related Modules

- **Unified Inbox** — outbound `from` address (`ReplyBox`), inbound append/match (`useInbox.simulateInboundEmail`), pop-up (`EmailScreenPop`), thread simulate button (`Thread.vue`).
- **Notification Center** — `EMAIL_REPLY_RECEIVED`, `EMAIL_DOMAIN_VERIFIED`, `EMAIL_DNS_FAILING` alert types + settings toggle.
- **Settings / Integrations** — Email Integration card in `SettingsIntegrationsOverview` + inbox Integrations sheet (`Layout.vue`).
- **Pattern precedent** — mirrors the 3CX inbound-call pipeline (simulate + screen-pop + alert), WhatsApp/3CX disconnect semantics, and the existing `useInbox` unmatched-conversation flow.
