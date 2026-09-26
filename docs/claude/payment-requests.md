> Split out of CLAUDE.md to keep the always-loaded context small. Read this file before working on this area; keep it updated when the code changes.

### Payment Request Module (`app/components/payment-request/`)

**Full UI spec** → `docs/superpowers/specs/2026-06-18-payment-request-design.md`

Page for creating payment links, tracking status, and managing receipts. Integrated with Payouts module.

**New files:**
```
app/
├── pages/payment-requests/index.vue
├── components/payment-request/
│   ├── PaymentRequestCreateDialog.vue   # Create payment link wizard
│   ├── PaymentRequestTable.vue          # History table with filters
│   ├── PaymentRequestDetailDialog.vue   # Detail view (status, receipt, timeline)
│   ├── PaymentRequestShareDialog.vue    # Copy link, QR code, WhatsApp/Email
│   └── data/payment-requests.ts         # Types, mock data, helpers
└── composables/usePaymentRequests.ts    # State + CRUD + filters
```

**Data Model:**
```ts
interface PaymentRequest {
  id: string
  guestName: string
  guestEmail: string
  listingId: string
  title: string
  description?: string
  amount: number
  currency: 'USD' | 'IDR'
  feeMode: 'card' | 'manual'        // card = +3%, manual = no fee
  feeAmount: number
  totalAmount: number
  status: 'pending' | 'paid' | 'expired' | 'cancelled'
  payoutAccountId: string
  paymentLink: string
  qrCodeUrl?: string
  expiresAt: string
  paidAt?: string
  receiptUrl?: string
  createdAt: string
  createdBy: string
  notes?: string
}
```

**Create Flow (2-step Dialog):**
1. **Payment Details**: Guest name (searchable autocomplete from existing guests/inbox), Select Listing (with unassigned warning), Payment title, Description, Email, Amount, Currency, Fee mode (Card +3% / Manual no fee)
2. **Share & Confirm**: Generated link, QR code, WhatsApp/Email share, expiry selector, summary

**Guest Search:**
- Combobox with search — sources from `conversations` (inbox guests) + existing payment requests
- Selecting existing guest auto-fills email
- "New guest" option if not found
- Shows guest avatar + last stay if from inbox

**Payout Integration:**
- Auto-detect currency from assigned payout account
- Unassigned listing → warning banner + [Assign now] link (disabled until fixed)
- Minimum amount validation per provider (Stripe $0.50, Doku IDR 10k)

**Status Lifecycle:** `pending` → `paid` / `expired` (auto) / `cancelled` (staff)

**List View:** TanStack Table with columns: Guest, Title, Listing, Amount (with fee breakdown), Status badge, Created, Expires, Actions (View/Copy/Cancel)

**Filters:** Status, Listing multi-select, Date range, Search (guest/title)

**Empty States:**
- No payout accounts → CTA to Settings → Payouts
- No requests → "Create your first payment request"

**Edge Cases:**
- Duplicate detection (same guest + amount within 1h → confirm dialog)
- Expired link accessed → "Link expired" page
- Already paid → "Payment completed" with receipt
- Account disconnected → badge on old requests
- Currency mismatch → auto-switch or warning
- Network error → retry + toast

**Sidebar:** Added under Finance section (`i-lucide-link` icon)
