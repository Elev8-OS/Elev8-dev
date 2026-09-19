// Owner-facing money formatting.
//
// One formatter for every owner surface: the portal dashboard, the portal
// statement pages, the staff statement tables and the statement PDF. Before
// this existed the same figure rendered three different ways depending on the
// page — the portal hardcoded `toLocaleString('id-ID')` for every currency
// (so CHF was grouped with Indonesian separators), `StatementTable` used
// `'en-US'`, and `OwnerDetailSheet` used whatever locale the browser reported.
//
// Framework-free on purpose, like the rest of `owners/data`.

/**
 * Currencies with no minor unit, where "1.234,00" would be wrong rather than
 * merely unusual. Deliberately a small explicit list: guessing from the
 * currency code is how a real minor unit gets rounded away.
 */
const ZERO_DECIMAL_CURRENCIES = new Set(['IDR', 'JPY', 'KRW', 'VND'])

/** How many decimal places a currency is written with. */
export function currencyDecimals(currency: string): number {
  return ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase()) ? 0 : 2
}

/**
 * Group an amount for display, without the currency code.
 *
 * Always `en-US` grouping (commas), matching the house rule's examples
 * (`IDR 500,000`, `CHF 1,200.00`). The locale is pinned rather than taken
 * from the viewer so the same statement reads identically for everyone who
 * opens it, including the owner and the staff member discussing it.
 */
export function formatOwnerAmount(amount: number, currency: string): string {
  const decimals = currencyDecimals(currency)
  return amount.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

/**
 * The full `CODE 1,234.56` rendering used everywhere an owner sees money.
 *
 * The ISO code always leads and is never replaced by a symbol, per the house
 * rule — `Rp` and `$` are ambiguous across the markets this app serves.
 */
export function formatOwnerMoney(amount: number, currency: string): string {
  return `${currency} ${formatOwnerAmount(amount, currency)}`.trim()
}

/**
 * `CODE 1,234` with no minor unit, for chart axes and KPI tiles.
 *
 * Those surfaces already round before formatting, so printing `.00` after a
 * rounded figure only adds precision that was just thrown away.
 */
export function formatOwnerMoneyRounded(amount: number, currency: string): string {
  return `${currency} ${Math.round(amount).toLocaleString('en-US')}`.trim()
}
