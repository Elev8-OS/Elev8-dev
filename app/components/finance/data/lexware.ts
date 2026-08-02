export interface LexwareAccount {
  id: string
  code: string
  name: string
  category: 'asset' | 'liability' | 'revenue' | 'expense'
}

// Lexware uses the German SKR03/04 chart of accounts (DATEV-kompatibel).
// Tax-relevant accounts are pinned to the 0%, 7%, and 19% VAT bands per Lexware's API constraint.
export type LexwareVatRate = 0 | 7 | 19

export const lexwareVATRates: LexwareVatRate[] = [0, 7, 19]

export const lexwareAccounts: LexwareAccount[] = [
  // ── Assets (1-xxx) ─────────────────────────────────────────────────────
  { id: 'la-1200', code: '1200', name: 'Bank (EUR)', category: 'asset' },
  { id: 'la-1210', code: '1210', name: 'Bank – Sparkasse', category: 'asset' },
  { id: 'la-1400', code: '1400', name: 'Forderungen aus Lieferungen und Leistungen', category: 'asset' },
  // ── Liabilities (2-xxx) ────────────────────────────────────────────────
  { id: 'la-1800', code: '1800', name: 'Geleistete Anzahlungen', category: 'liability' },
  { id: 'la-2100', code: '2100', name: 'Verbindlichkeiten aus Lieferungen und Leistungen', category: 'liability' },
  { id: 'la-2200', code: '2200', name: 'Erhaltene Anzahlungen', category: 'liability' },
  { id: 'la-3800', code: '3800', name: 'Umsatzsteuer 19% (Steuerlast)', category: 'liability' },
  { id: 'la-3810', code: '3810', name: 'Umsatzsteuer 7% (Steuerlast)', category: 'liability' },
  { id: 'la-3820', code: '3820', name: 'Umsatzsteuer 0% (Steuerlast)', category: 'liability' },
  // ── Revenue (8-xxx) ───────────────────────────────────────────────────
  { id: 'la-8200', code: '8200', name: 'Erlöse aus Vermietung (19% USt)', category: 'revenue' },
  { id: 'la-8210', code: '8210', name: 'Erlöse aus Vermietung (7% USt)', category: 'revenue' },
  { id: 'la-8220', code: '8220', name: 'Erlöse aus Vermietung (0% USt)', category: 'revenue' },
  { id: 'la-8300', code: '8300', name: 'Erlöse aus Reinigungsleistungen (19% USt)', category: 'revenue' },
  { id: 'la-8400', code: '8400', name: 'Erlöse aus Zusatzleistungen / Upsell (19% USt)', category: 'revenue' },
  { id: 'la-8410', code: '8410', name: 'Erlöse aus Zusatzleistungen / Upsell (7% USt)', category: 'revenue' },
  { id: 'la-8500', code: '8500', name: 'Erlöse aus Stornierungsgebühren', category: 'revenue' },
  // ── Expenses (4-xxx) ──────────────────────────────────────────────────
  { id: 'la-4200', code: '4200', name: 'Reinigungsaufwand', category: 'expense' },
  { id: 'la-4500', code: '4500', name: 'Provisionen OTA (Airbnb / Booking.com)', category: 'expense' },
  { id: 'la-4600', code: '4600', name: 'Verwaltungsaufwand', category: 'expense' },
]

export function getAccountsByCategory(category: LexwareAccount['category']): LexwareAccount[] {
  return lexwareAccounts.filter(a => a.category === category)
}

export function getAccountsByPrefix(prefix: string): LexwareAccount[] {
  return lexwareAccounts.filter(a => a.code.startsWith(prefix))
}

export function getRevenueAccounts(): LexwareAccount[] {
  return lexwareAccounts.filter(a => a.category === 'revenue')
}

export function getExpenseAccounts(): LexwareAccount[] {
  return lexwareAccounts.filter(a => a.category === 'expense')
}

export function getVatAccountForRate(rate: LexwareVatRate): LexwareAccount | undefined {
  const id = rate === 19 ? 'la-3800' : rate === 7 ? 'la-3810' : 'la-3820'
  return lexwareAccounts.find(a => a.id === id)
}

// Map a human-readable category to its default VAT band (Lexware only accepts 0/7/19).
export const categoryDefaultVat: Record<string, LexwareVatRate> = {
  Accommodation: 7,
  CleaningFee: 19,
  Upsell: 19,
  PlatformFee: 0,
  CityTax: 0,
}
