# Taste (Continuously Learned by [CommandCode][cmd])

[cmd]: https://commandcode.ai/

# communication
- Always respond in English, even when the user writes in Indonesian. Confidence: 0.85

# finance
- For Booking Revenue double-entry tables: each line item must have separate Debit and Credit account columns/selectors, not a single account with a pre-assigned debit/credit indicator. Confidence: 0.65
- No charts or progress bars — use full data tables only. Confidence: 0.90
- Use toast feedback for all user actions (create, rename, delete, toggle, save, move). Confidence: 0.85
- Use confirmation dialogs for destructive actions (delete, duplicate). Confidence: 0.80
- Header currency must dynamically reflect the tenant account's currency setting (currently CHF). Confidence: 0.70

# workflow
See [workflow/taste.md](workflow/taste.md)
# vue-nuxt
See [vue-nuxt/taste.md](vue-nuxt/taste.md)
# finance
See [finance/taste.md](finance/taste.md)
# workflow
- Prefer `pnpm dev` over `pnpm build` during development to avoid browser crash from heavy builds. Confidence: 0.65
- When asked to run the dev server, keep it running in the background, wait for the initial build, verify the listening port and HTTP routes with `curl`, and report the local URL plus relevant routes. Confidence: 0.88

# 3cx
- For mock 3CX integration: skip the OAuth redirect page/callback flow and go directly to "connected" state. Confidence: 0.65
- Use mock data for third-party API integrations during development before switching to real API calls. Confidence: 0.75

# payment-requests
- Use "cancel" terminology (not "delete") for cancelling payment links. Confidence: 0.75

# whatsapp
- WhatsApp connection must use OAuth flow, not manual form fields. Confidence: 0.70
- Phone input formatting: use AsYouType without a default country (country-agnostic auto-detection) for international number support. Confidence: 0.70
- Phone input must auto-prepend "+" and restrict input to digits and "+" only (no text characters allowed). Confidence: 0.65

# data
- Prefer real data from Elev8 Suite OS MCP over mock data when available. Confidence: 0.70
- Property hierarchy must support three levels: Property → Unit Type (e.g., Kingbed, Single Bed) → Unit (room with specific bed). Confidence: 0.75

# data
- Within a unit type, guest capacity settings (max adults, max children, max infants) must be uniform across all units — no per-unit capacity overrides. Confidence: 0.65

# review-hub
See [review-hub/taste.md](review-hub/taste.md)
# documentation
- Include a concise executive summary / quick-reference section at the top of PRD documents so developers can understand the feature at a glance before diving into details. Confidence: 0.70
- Write PRDs and technical specs as implementation-ready documents without labeling anything as "mock" — developers will build from them as real specifications. Confidence: 0.70
# icons
- Use the sparkle AI SVG icon (flaticon #17653301) for AI-related iconography instead of custom brush/pen designs. Confidence: 0.75

# integrations
- Don't mention third-party integration provider brand names (e.g., Seam) anywhere in the UI except within the integration settings/configuration page itself. Confidence: 0.75

# notifications
- Marking a notification as read should NOT remove/dismiss it from the list. Confidence: 0.75
- Cleaning job statuses: 'scheduled' (today/future), 'in_progress' (today only), 'done' (today/past, not future), 'missed' (past only — housekeeping missed it). Confidence: 0.75
- Each notification category should have a unique icon (e.g., cleaning = broom icon) instead of just a dot. Confidence: 0.70
- Use a single dash (hyphen) in place of em dashes in notification text. Confidence: 0.75
