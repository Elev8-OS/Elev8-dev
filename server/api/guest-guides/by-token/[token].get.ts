import { createError, defineEventHandler, getRouterParam } from 'h3'
import { conversations } from '../../../../app/components/inbox/data/conversations'
import { listingGuideContent } from '../../../../app/components/listings/data/guest-guide-content'
import { listings } from '../../../../app/components/listings/data/listings'
import { buildGuestGuideCssVariables } from '../../../../app/lib/branding-colors'
import { findGuideByToken, findLinkByToken } from '../../../utils/guest-guide-store'
import { sanitizeRichTextForGuests } from '../../../utils/rich-text-sanitize'
import { getTenantBranding } from '../../../utils/tenant-branding-store'

export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token')
  if (!token) {
    throw createError({ statusCode: 400, statusMessage: 'Token required' })
  }

  const link = findLinkByToken(token)
  if (!link) {
    throw createError({ statusCode: 404, statusMessage: 'Guide not found' })
  }

  if (link.status === 'revoked') {
    throw createError({ statusCode: 410, statusMessage: 'This guide is no longer available' })
  }

  if (new Date(link.expiresAt) < new Date()) {
    throw createError({ statusCode: 410, statusMessage: 'This guide has expired' })
  }

  const guide = findGuideByToken(token)
  if (!guide) {
    throw createError({ statusCode: 404, statusMessage: 'Guide content not found' })
  }

  // Enrich with reservation dates from conversation data for smart section ordering
  const conversation = conversations.find(c => c.reservationId === link.reservationId)
  const checkIn = conversation?.checkIn ?? null
  const checkOut = conversation?.checkOut ?? null

  // Look up the listing for fallback data (Wi-Fi, check-in/out, house rules, amenities).
  // link.listingId is the listing ID (e.g. "lst-1"). If not found, fall back to the first
  // listing referenced by the guide's assignedListingIds.
  let listing = listings.value.find(l => l.id === link.listingId) ?? null
  if (!listing && guide.assignedListingIds.length > 0) {
    listing = listings.value.find(l => l.id === guide.assignedListingIds[0]) ?? null
  }

  const tenantBranding = getTenantBranding()
  const branding = {
    primaryLogo: tenantBranding.primaryLogo,
    favicon: tenantBranding.favicon,
    guestGuideColors: tenantBranding.guestGuideColors,
    cssVariables: buildGuestGuideCssVariables(tenantBranding.guestGuideColors),
  }

  // The listing owns check-in/out steps, house rules and Good to Know; the guide
  // only shows or hides those sections (`guest-guide-content.ts`).
  // Item text is rich text written by the host: sanitized here, so guide-app can render it as HTML.
  const guideContent = Object.fromEntries(Object.entries(listingGuideContent(listing)).map(([kind, items]) => [
    kind,
    items.map(item => item.text ? { ...item, text: sanitizeRichTextForGuests(item.text) } : item),
  ]))

  return { link, guide, listing, guideContent, checkIn, checkOut, branding }
})
