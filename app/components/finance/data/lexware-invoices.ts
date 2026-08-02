export type LexwareInvoiceStatus
  = | 'draft_created' // Elev8 created the draft in Lexware
    | 'open_in_lexware' // Host finalized in Lexware (invoice.changed webhook)
    | 'paid' // invoice.changed webhook: paid
    | 'credit_note_created' // Booking cancelled; credit note auto-issued
    | 'sync_failed' // Connection dropped mid-request; queued for retry
    | 'needs_mapping' // Tax rate not in Lexware's 0/7/19 bands

export interface LexwareInvoiceLineItem {
  category: 'Accommodation' | 'CleaningFee' | 'Upsell' | 'PlatformFee' | 'CityTax'
  description: string
  quantity: number
  unitPrice: number // EUR
  vatRate: number // Lexware accepts 0/7/19; any other value triggers a "needs mapping" hold
  postingAccountId: string // Lexware account id (e.g. 'la-8200')
}

export interface LexwareInvoice {
  id: string // Elev8-side invoice id
  lexwareInvoiceId: string | null // Lexware-side id once created (NB: German style "LS-...")
  reservationId: string
  listingId: string
  listingName: string
  guestName: string
  guestEmail: string
  currency: 'EUR'
  totalAmount: number // EUR
  status: LexwareInvoiceStatus
  lineItems: LexwareInvoiceLineItem[]
  createdAt: string // ISO timestamp when Elev8 created the draft
  finalizedAt: string | null // ISO timestamp when host finalized in Lexware
  paidAt: string | null
  cancelledAt: string | null
  creditNoteId: string | null
  failureReason?: string // sync_failed status reason
  needsMappingReason?: string // needs_mapping status reason
}

export const EUR_LISTING_IDS = [
  'lst-villa-luwa',
  'lst-villa-sehnsucht',
  'lst-villa-bergfried',
  'lst-villa-zeitreise',
  'lst-villa-kunstpause',
]

export const NON_EUR_LISTING_NAMES = [
  'Villa Cendana',
  'Villa Sari',
  'Villa Kayu',
  'TAMBORA - The R Tambora: Stylish 3BR Tropical Escape',
]

export const eurListingsForMock = [
  { id: 'lst-villa-luwa', name: 'Villa Luwa – Hügellage Brandenburg', city: 'Potsdam' },
  { id: 'lst-villa-sehnsucht', name: 'Villa Sehnsucht – Seegrundstück Mecklenburg', city: 'Waren (Müritz)' },
  { id: 'lst-villa-bergfried', name: 'Villa Bergfried – Schwarzwald', city: 'Freiburg' },
  { id: 'lst-villa-zeitreise', name: 'Villa Zeitreise – Weinregion Pfalz', city: 'Neustadt' },
  { id: 'lst-villa-kunstpause', name: 'Villa Kunstpause – Kulturhaupstadt Weimar', city: 'Weimar' },
]

export const mockLexwareInvoices: LexwareInvoice[] = [
  {
    id: 'lex-inv-001',
    lexwareInvoiceId: 'LS-2026-0042',
    reservationId: 'res-eur-001',
    listingId: 'lst-villa-luwa',
    listingName: 'Villa Luwa – Hügellage Brandenburg',
    guestName: 'Erik Hoffmann',
    guestEmail: 'erik.hoffmann@example.de',
    currency: 'EUR',
    totalAmount: 1280.0,
    status: 'open_in_lexware',
    lineItems: [
      { category: 'Accommodation', description: '5 nights accommodation', quantity: 5, unitPrice: 220.0, vatRate: 7, postingAccountId: 'la-8210' },
      { category: 'CleaningFee', description: 'Final cleaning', quantity: 1, unitPrice: 90.0, vatRate: 19, postingAccountId: 'la-8300' },
      { category: 'CityTax', description: 'City tax (Potsdam)', quantity: 5, unitPrice: 5.0, vatRate: 0, postingAccountId: 'la-8220' },
    ],
    createdAt: '2026-07-26T08:14:00Z',
    finalizedAt: '2026-07-27T10:00:00Z',
    paidAt: null,
    cancelledAt: null,
    creditNoteId: null,
  },
  {
    id: 'lex-inv-002',
    lexwareInvoiceId: 'LS-2026-0043',
    reservationId: 'res-eur-002',
    listingId: 'lst-villa-sehnsucht',
    listingName: 'Villa Sehnsucht – Seegrundstück Mecklenburg',
    guestName: 'Anna Brunner',
    guestEmail: 'anna.brunner@example.ch',
    currency: 'EUR',
    totalAmount: 2460.0,
    status: 'draft_created',
    lineItems: [
      { category: 'Accommodation', description: '7 nights accommodation', quantity: 7, unitPrice: 280.0, vatRate: 7, postingAccountId: 'la-8210' },
      { category: 'CleaningFee', description: 'Final cleaning', quantity: 1, unitPrice: 120.0, vatRate: 19, postingAccountId: 'la-8300' },
      { category: 'Upsell', description: 'Late checkout (until 2pm)', quantity: 1, unitPrice: 60.0, vatRate: 19, postingAccountId: 'la-8400' },
    ],
    createdAt: '2026-07-28T11:32:00Z',
    finalizedAt: null,
    paidAt: null,
    cancelledAt: null,
    creditNoteId: null,
  },
  {
    id: 'lex-inv-003',
    lexwareInvoiceId: 'LS-2026-0040',
    reservationId: 'res-eur-003',
    listingId: 'lst-villa-bergfried',
    listingName: 'Villa Bergfried – Schwarzwald',
    guestName: 'Lukas Vogel',
    guestEmail: 'lukas.vogel@example.de',
    currency: 'EUR',
    totalAmount: 980.0,
    status: 'paid',
    lineItems: [
      { category: 'Accommodation', description: '3 nights accommodation', quantity: 3, unitPrice: 260.0, vatRate: 7, postingAccountId: 'la-8210' },
      { category: 'CleaningFee', description: 'Final cleaning', quantity: 1, unitPrice: 90.0, vatRate: 19, postingAccountId: 'la-8300' },
      { category: 'CityTax', description: 'City tax (Freiburg)', quantity: 3, unitPrice: 3.5, vatRate: 0, postingAccountId: 'la-8220' },
    ],
    createdAt: '2026-07-20T09:05:00Z',
    finalizedAt: '2026-07-21T08:30:00Z',
    paidAt: '2026-07-25T14:12:00Z',
    cancelledAt: null,
    creditNoteId: null,
  },
  {
    id: 'lex-inv-004',
    lexwareInvoiceId: 'LS-2026-0038',
    reservationId: 'res-eur-004',
    listingId: 'lst-villa-zeitreise',
    listingName: 'Villa Zeitreise – Weinregion Pfalz',
    guestName: 'Markus Steiner',
    guestEmail: 'markus.steiner@example.de',
    currency: 'EUR',
    totalAmount: 1640.0,
    status: 'credit_note_created',
    lineItems: [
      { category: 'Accommodation', description: '4 nights accommodation', quantity: 4, unitPrice: 320.0, vatRate: 7, postingAccountId: 'la-8210' },
      { category: 'CleaningFee', description: 'Final cleaning', quantity: 1, unitPrice: 120.0, vatRate: 19, postingAccountId: 'la-8300' },
      { category: 'Upsell', description: 'Wine tasting package', quantity: 1, unitPrice: 240.0, vatRate: 19, postingAccountId: 'la-8400' },
    ],
    createdAt: '2026-07-15T07:22:00Z',
    finalizedAt: '2026-07-16T09:45:00Z',
    paidAt: null,
    cancelledAt: '2026-07-29T13:18:00Z',
    creditNoteId: 'LS-2026-0044',
  },
  {
    id: 'lex-inv-005',
    lexwareInvoiceId: null,
    reservationId: 'res-eur-005',
    listingId: 'lst-villa-kunstpause',
    listingName: 'Villa Kunstpause – Kulturhaupstadt Weimar',
    guestName: 'Sophia Maier',
    guestEmail: 'sophia.maier@example.at',
    currency: 'EUR',
    totalAmount: 720.0,
    status: 'needs_mapping',
    lineItems: [
      { category: 'Accommodation', description: '2 nights accommodation', quantity: 2, unitPrice: 300.0, vatRate: 16, postingAccountId: 'la-8210' },
      { category: 'CleaningFee', description: 'Final cleaning', quantity: 1, unitPrice: 120.0, vatRate: 19, postingAccountId: 'la-8300' },
    ],
    createdAt: '2026-07-29T16:00:00Z',
    finalizedAt: null,
    paidAt: null,
    cancelledAt: null,
    creditNoteId: null,
    needsMappingReason: 'Line item tax rate 16% does not match Lexware-allowed bands (0%, 7%, 19%).',
  },
  {
    id: 'lex-inv-006',
    lexwareInvoiceId: null,
    reservationId: 'res-eur-006',
    listingId: 'lst-villa-luwa',
    listingName: 'Villa Luwa – Hügellage Brandenburg',
    guestName: 'Christina Wolf',
    guestEmail: 'c.wolf@example.de',
    currency: 'EUR',
    totalAmount: 1450.0,
    status: 'sync_failed',
    lineItems: [
      { category: 'Accommodation', description: '5 nights accommodation', quantity: 5, unitPrice: 250.0, vatRate: 7, postingAccountId: 'la-8210' },
      { category: 'CleaningFee', description: 'Final cleaning', quantity: 1, unitPrice: 100.0, vatRate: 19, postingAccountId: 'la-8300' },
      { category: 'Upsell', description: 'Airport pickup', quantity: 1, unitPrice: 100.0, vatRate: 19, postingAccountId: 'la-8400' },
    ],
    createdAt: '2026-07-30T12:00:00Z',
    finalizedAt: null,
    paidAt: null,
    cancelledAt: null,
    creditNoteId: null,
    failureReason: 'API request failed mid-flight (502 from Lexware). Retry queued.',
  },
]

export const nonEligibleReservationsForDigest = [
  { listingName: 'Villa Cendana', checkIn: '2026-07-26', currency: 'IDR', reason: 'Listing currency is IDR — not eligible for Lexware export.' },
  { listingName: 'Villa Sari', checkIn: '2026-07-27', currency: 'IDR', reason: 'Listing currency is IDR — not eligible for Lexware export.' },
  { listingName: 'Villa Kayu', checkIn: '2026-07-28', currency: 'USD', reason: 'Listing currency is USD — not eligible for Lexware export.' },
  { listingName: 'TAMBORA - The R Tambora: Stylish 3BR Tropical Escape', checkIn: '2026-07-29', currency: 'IDR', reason: 'Listing currency is IDR — not eligible for Lexware export.' },
  { listingName: 'Villa Cendana', checkIn: '2026-07-30', currency: 'IDR', reason: 'Listing currency is IDR — not eligible for Lexware export.' },
]
