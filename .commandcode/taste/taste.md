# Taste (Continuously Learned by [CommandCode][cmd])

[cmd]: https://commandcode.ai/

# communication
- Always respond in English, even when the user writes in Indonesian. Confidence: 0.95
- For UI changes, the user often conveys the desired design by attaching a reference screenshot plus a short sentence in Indonesian (e.g. "untuk cleaning event cardnya kaya di gambar", "buat cleaning card eventnya tambahin handle by extrasauber, ini pngnya") rather than writing detailed written specs. Treat the screenshot as the source of truth and read it via the vision tool before touching code — this includes extracting brand colors, taglines, and logo styling from the image. Confidence: 0.85
- After completing a UI feature, proactively state where the user can see it (exact route/page) and how to reproduce it (e.g. which form field to pick, create vs. edit flow) — the user will otherwise ask "ceknya dimana" ("where do I check it?"). Offering to seed mock/demo data so the change is visible without manual setup is welcomed. Confidence: 0.6

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
- During development, keep third-party API integrations mocked, but mock only the API/network layer — wire the pipeline to real application data (reservations, listings, pricing) rather than isolated hardcoded fixtures ("mock tapi flow asli": mock backend, real flow). Confidence: 0.8

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
See [documentation/taste.md](documentation/taste.md)
# icons
- Use the sparkle AI SVG icon (flaticon #17653301) for AI-related iconography instead of custom brush/pen designs. Confidence: 0.75

# integrations
- Don't mention third-party integration provider brand names (e.g., Seam) anywhere in the UI except within the integration settings/configuration page itself. Confidence: 0.75
- When a mock/demo action exists in an integration UI (e.g. "Simulate finalize"), model it on the real-world event it stands for — the provider's webhook and its state transition (e.g. Lexware `invoice.changed`: `draft_created` → `open_in_lexware`) — not on a generic "test connection" action. Users will question the semantics until they match the real flow. Confidence: 0.6

# notifications
See [notifications/taste.md](notifications/taste.md)
# owner-portal
- Owner portal charts layout: revenue-trend chart spans full width at top; remaining metrics (ADR, occupancy, etc.) split into half-width cards beneath. ADR is always its own standalone KPI card, never bundled into another chart. Confidence: 0.85

# operations-calendar
- When selecting listing in cleaning/task/review forms, surface guest info automatically (name, stay length, has-pet) — don't require a separate lookup. Confidence: 0.80

# cleaning
- Cleaning job assignment (both create and edit flows) must offer external cleaning services (e.g. Extrasauber, "External cleaning service") as assignable options alongside internal staff — assignees are not limited to staff members. Confidence: 0.8
