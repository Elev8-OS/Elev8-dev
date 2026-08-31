# Taste (Continuously Learned by [CommandCode][cmd])

[cmd]: https://commandcode.ai/

# communication
See [communication/taste.md](communication/taste.md)
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
- Prefer `pnpm dev` over `pnpm build` during development to avoid browser crash from heavy builds. Confidence: 0.7
- As a dev-server smoke test, don't stop at HTTP status codes — grep the rendered HTML for expected content (guest names, section headings) and scan the dev log for Vue warnings/errors (e.g. `Failed to resolve component`); this catches component-resolution issues that typecheck and 200s miss. Re-used in the Owner Portal spec implementation: grepped `/owner-documents` rendered HTML for seeded doc titles, inspected `/owners` tab markup, and scanned the dev log for Vue warnings before killing the server. Confidence: 0.85
- When verifying a component-resolution fix via the dev log, remember the log RETAINS stale warnings from pre-fix renders — count occurrences / tail the log before and after the HMR apply, and only treat NEW post-fix entries as evidence it's still broken (the `StatementTable` explicit-import fix left 2 old "Failed to resolve component" lines but none after HMR, so the fix was confirmed clean without a server restart). Confidence: 0.7
- When asked to run the dev server, keep it running in the background, wait for the initial build, verify the listening port and HTTP routes with `curl`, and report the local URL plus relevant routes. If the user explicitly asked to run the dev server (e.g. a terse "run dev"), leave it running and say so — they want to click through the feature themselves; only stop the server after verification when the assistant started it solely as a smoke test, so no ports are left occupied. The user may specify the exact port in the directive (e.g. "run dev 3000") — treat that port as a requirement: confirm the server actually listens on the requested port (Nuxt can fall back to the next free port like 3001) and state the port explicitly in the report. Confidence: 0.85

# 3cx
- For mock 3CX integration: skip the OAuth redirect page/callback flow and go directly to "connected" state. Confidence: 0.65
- During development, keep third-party API integrations mocked, but mock only the API/network layer — wire the pipeline to real application data (reservations, listings, pricing) rather than isolated hardcoded fixtures ("mock tapi flow asli": mock backend, real flow). Confidence: 0.8

# payment-requests
- Use "cancel" terminology (not "delete") for cancelling payment links. Confidence: 0.75
- Payment charge on reservations should default to the standard 3% card fee but stay customizable — a selector with Card (+3%, default) / Custom % / No fee options, mapped to the existing `feeMode` enum (`card` / `manual` / `no_fee`) in `usePaymentRequests` rather than introducing new state. Confidence: 0.65

# whatsapp
- WhatsApp connection must use OAuth flow, not manual form fields. Confidence: 0.70
- Phone input formatting: use AsYouType without a default country (country-agnostic auto-detection) for international number support. Confidence: 0.70
- Phone input must auto-prepend "+" and restrict input to digits and "+" only (no text characters allowed). Confidence: 0.65

# data
See [data/taste.md](data/taste.md)
# data
- Within a unit type, guest capacity settings (max adults, max children, max infants) must be uniform across all units — no per-unit capacity overrides. Confidence: 0.65

# review-hub
See [review-hub/taste.md](review-hub/taste.md)
# documentation
See [documentation/taste.md](documentation/taste.md)
# icons
- Use the sparkle AI SVG icon (flaticon #17653301) for AI-related iconography instead of custom brush/pen designs. Confidence: 0.75

# integrations
See [integrations/taste.md](integrations/taste.md)
# notifications
See [notifications/taste.md](notifications/taste.md)
# owner-portal
See [owner-portal/taste.md](owner-portal/taste.md)
# operations-calendar
- When selecting listing in cleaning/task/review forms, surface guest info automatically (name, stay length, has-pet) — don't require a separate lookup. Confidence: 0.80
- Exclude INQUIRY-status bookings from operational views (operations calendar, cleaning lists) entirely — unconfirmed bookings have no cleaning, so they must not appear as calendar entries/strips ("jangan pernah munculin booking yang statusnya INQUIRY, karena belum booking jadinya ga ada cleaning"). Confidence: 0.8

# security
- Security-conscious handling of API keys: when the user pastes a provider API key inline, warn that the key is now exposed in the chat and recommend regenerating/rotating it after it's wired up and verified (the assistant recommended regenerating the Kimi/Moonshot key because it was shared in chat). Also verify key validity with an actual API call (never echoing the key) rather than assuming the config works — an inline key from a reseller can carry a non-standard prefix (e.g. `sk-kimi-`) and be rejected by the provider's real endpoint. Confidence: 0.7

# cleaning
- Cleaning job assignment (both create and edit flows) must offer external cleaning services (e.g. Extrasauber, "External cleaning service") as assignable options alongside internal staff — assignees are not limited to staff members. Confidence: 0.8
- Cleaning job assignment is OPTIONAL: the add-cleaning flow includes an assignee selector with an explicit "Unassigned" option (never a required field), and every scheduled job — plus the "next cleaning" highlight — displays the assigned cleaner's name so it's visible at a glance. The user asked to show who's assigned ("munculin assignnya siapa") and marked it optional ("opsional"). Confidence: 0.6
daily / check-out / custom / mid-stay), a pet indicator, and currently-staying guest details (adults, children, pet count, night stay, stay dates) — surface this info on the calendar card itself, not just in forms. Confidence: 0.65
