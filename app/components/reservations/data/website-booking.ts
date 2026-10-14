/**
 * Which website a direct booking came from and which Website channel rule set
 * priced it. A SNAPSHOT frozen at booking time: renaming the site, editing or
 * deleting the rule set later never changes it. The ids are provenance only.
 *
 * Read only for display. It never feeds `priceDetails` or the folio: the
 * reservation total is computed the way it always was.
 */

export interface WebsiteBookingDiscount {
  label: string
  /** In the reservation currency. No conversion, ever. */
  amount: number
}

export interface WebsiteBookingSource {
  websiteId: string
  websiteName: string
  websiteUrl: string
  /** null = the site was in no rule set (or the channel was not added). */
  ruleSetId: string | null
  ruleSetName: string | null
  discounts: WebsiteBookingDiscount[]
}

/**
 * Builds the snapshot. Pure: the caller resolves the rule set (only while the
 * Website channel is added) and the quote. Discounts are kept only when the
 * quote is in the reservation currency, since amounts are never converted.
 */
export function buildWebsiteBookingSource(args: {
  website: { id: string, name: string, url: string }
  ruleSet: { id: string, name: string } | null | undefined
  quote: { currency: string, discounts: { label: string, amount: number }[] } | null | undefined
  currency: string
}): WebsiteBookingSource {
  const { website, ruleSet, quote, currency } = args
  const discounts = quote && quote.currency === currency
    ? quote.discounts.filter(d => d.amount > 0).map(d => ({ label: d.label, amount: d.amount }))
    : []
  return {
    websiteId: website.id,
    websiteName: website.name,
    websiteUrl: website.url,
    ruleSetId: ruleSet?.id ?? null,
    ruleSetName: ruleSet?.name ?? null,
    discounts,
  }
}
