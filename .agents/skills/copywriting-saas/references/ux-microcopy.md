# SaaS UX Microcopy & In-Product Messaging

Microcopy refers to the small words with big impact: button labels, empty states, tooltip explanations, error notifications, and onboarding step instructions. Good microcopy prevents user frustration, reduces churn, and guides users to their first "Aha!" moment.

---

## 1. Empty States (Zero Data States)

An empty screen is not a blank canvas—it's an opportunity to educate and activate.

### The 4-Part Empty State Formula:
1. **Friendly Visual / Icon**: Visual cue depicting the intended object (calendar, keybox, message bubble).
2. **Clear Explanation**: Why is this empty? What belongs here?
3. **Value Reiteration**: Why should the user create one now?
4. **Single Primary Action Button**: One clear CTA to create the first item.

### Example:
- **Title**: *"No promo codes yet"*
- **Body**: *"Boost direct bookings during low seasons by offering targeted percentage discounts, free airport transfers, or minimum stay perks."*
- **Button**: `+ Create Your First Promo Code`

---

## 2. Error Messages & Recovery Guidance

Never blame the user or use confusing technical stack traces.

### The Human Error Message Formula:
`What happened in plain English` + `Why it happened` + `Actionable next step to fix it`.

| Bad / Robotic Error | High-Converting Microcopy |
| :--- | :--- |
| `Error 422: Unprocessable Entity` | "We couldn't connect your WhatsApp account. Your QR code expired—please scan the fresh code below." |
| `Invalid Date Range` | "The checkout date must be at least 1 day after check-in." |
| `Card declined: Insufficient funds` | "Your bank declined the payment. Please verify your card balance or try a different payment method." |
| `Field required` | "Enter a promo code title (e.g. 'SUMMER2026') to continue." |

---

## 3. High-Conversion CTA Button Copy

Generic labels kill momentum. Swap vague nouns for actionable, benefit-driven phrases.

### The First-Person Test:
Complete this sentence: *"I want to..."*
- Generic: *"Submit"* → Action-oriented: *"Start My Free Trial"*
- Generic: *"Download"* → Action-oriented: *"Get the 2026 Hospitality Report"*
- Generic: *"Next"* → Action-oriented: *"Continue to Pricing Settings →"*
- Generic: *"Save"* → Action-oriented: *"Publish Changes Live"*

### Microcopy Trust Anchors Under CTAs:
Place a 10-12px reassurance line right below critical buttons:
- Under signup button: `🔒 14-day free trial · No credit card required · Instant setup`
- Under credit card checkout: `🔒 256-bit encrypted · Cancel anytime in 1 click`
- Under bulk import: `⚡ Safe & non-destructive · Your existing data won't be overwritten`

---

## 4. In-App Upgrade Prompts & Paywalls

When a user hits a plan limit (e.g., maximum properties reached, advanced AI features locked):

### Principles:
1. **Acknowledge Achievement First**: Don't treat hitting a limit as a violation—it's a sign of growth!
   - *"Congratulations! You've connected all 5 villas on the Starter plan."*
2. **Present the Upgrade as the Logical Next Level**:
   - *"Ready to manage up to 25 villas with automated AI dispatch and 3CX VoIP integration?"*
3. **Transparent Price & Frictionless Switch**:
   - *"Upgrade to Professional for $49/month. Your existing billing will be prorated automatically."*
4. **Clear Action Buttons**:
   - Primary: `Upgrade to Professional`
   - Secondary: `Compare All Plans` or `Talk to Support`

---

## 5. Form Fields, Placeholders & Helper Text

- **Labels**: Always visible above the input, concise and direct (`Nightly base rate`, `Minimum stay (nights)`).
- **Placeholders**: Show a realistic example, not a duplicate label!
  - *Bad*: `Placeholder="Enter Code"`
  - *Good*: `Placeholder="e.g. BALISUMMER25"`
- **Helper Text**: Place below the input to clarify edge cases before errors occur:
  - *"Applies only to bookings made via your direct website widget."*
  - *"Rolling duration: the code remains valid for X days from today."*

---

## 6. Destructive Actions & Confirmation Dialogs

When deleting or deactivating critical data (e.g. deleting a property listing or cancelling a payment request):

- **Spell Out the Consequences**: Don't just say *"Are you sure?"*
  - *"Deleting this promo code will immediately deactivate it across all connected booking widgets. Existing reservations made with this code will not be affected."*
- **Label the Action Button with the Specific Verb**:
  - *Bad*: `[ Cancel ]  [ OK ]`
  - *Good*: `[ Keep Code ]  [ Delete Promo Code ]` (in destructive red variant)
