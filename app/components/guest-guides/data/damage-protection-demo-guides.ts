// app/components/guest-guides/data/damage-protection-demo-guides.ts
import type { GuestGuide, GuestGuideLink, GuideSection } from './types'
import type { DamageProtectionPolicy } from '~/components/reservations/data/damage-protection'
import { buildOptions, policyFromTemplate } from '~/components/reservations/data/damage-protection'

/**
 * DEMO ONLY: one guest guide per case of the damage protection section, so the
 * guest view can be opened in the guide app (`http://localhost:3001/<token>`):
 *
 *   dpboth     waiver and deposit (Stripe listing, 5 nights)
 *   dpwaiver   waiver only (a listing that cannot keep a card)
 *   dplong     long stay, 45 nights: two 30-night packages
 *   dpdeposit  deposit only
 *   dphost     host pays: the guide has no protection section at all
 *
 * ⚠️ The options are BAKED here with the dashboard's own `buildOptions`. The
 * guide API returns stored section data as-is and does not compute them per
 * stay yet (see docs/claude/damage-protection.md); until it does, these are
 * the only guides with a working section.
 *
 * The guides assign no listing on purpose, so they never change which listings
 * `listingsMissingGuideSection` flags; the API takes the listing from the link.
 * Drafts, so they do not read as live guides in the Guest Guides list.
 */

const now = new Date().toISOString()

const standard = policyFromTemplate('standard_short', 'USD')
const longStay = policyFromTemplate('standard_long', 'USD')
const depositOnly = policyFromTemplate('deposit_only', 'USD')

function stay(nights: number) {
  return { nights, priceDetails: { subtotal: 200 * nights } }
}

function protectionData(policy: DamageProtectionPolicy, options: ReturnType<typeof buildOptions>, longStayBand = false) {
  return {
    title: 'Damage protection',
    body: 'Accidents happen on holiday. Choose how you would like to cover accidental damage during your stay.',
    options,
    termsText: policy.termsText,
    longStay: longStayBand,
  }
}

function demoGuide(id: string, title: string, protection: Record<string, unknown> | null): GuestGuide {
  const sections: GuideSection[] = [
    {
      id: `${id}-hero`,
      type: 'hero',
      order: 0,
      enabled: true,
      data: { photoUrl: 'https://images.unsplash.com/photo-1540541338287-41700207dee6', title: 'Welcome to Villa Luwa', subtitle: 'Your home near Canggu' },
    },
    {
      id: `${id}-welcome`,
      type: 'welcome',
      order: 1,
      enabled: true,
      data: { message: 'We are thrilled to welcome you. Please take a minute to choose your damage protection before you arrive.' },
    },
  ]
  if (protection)
    sections.push({ id: `${id}-damage-protection`, type: 'damage_protection', order: 2, enabled: true, data: protection })
  return {
    id,
    title: `Demo: ${title}`,
    description: 'Damage protection guest view, demo data',
    assignedListingIds: [],
    status: 'draft',
    sections,
    defaultLanguage: 'en',
    createdBy: 'staff-1',
    createdAt: now,
    updatedAt: now,
  }
}

function demoLink(token: string, guideId: string, guestName: string): GuestGuideLink {
  return {
    id: `ggl-${token}`,
    token,
    guideId,
    reservationId: `res-demo-${token}`,
    listingId: 'lst-1',
    guestName,
    guestEmail: 'guest@example.com',
    guestLanguage: 'en',
    sentAt: now,
    expiresAt: new Date(Date.now() + 86400000 * 365).toISOString(),
    status: 'pending',
    channel: 'email',
  }
}

export const damageProtectionDemoGuides: GuestGuide[] = [
  demoGuide('gg-dp-both', 'Damage protection, waiver and deposit', protectionData(standard, buildOptions(standard, stay(5), 'card'))),
  demoGuide('gg-dp-waiver', 'Damage protection, waiver only', protectionData(standard, buildOptions(standard, stay(5), 'non_card'))),
  demoGuide('gg-dp-long', 'Damage protection, long stay', protectionData(longStay, buildOptions(longStay, stay(45), 'card'), true)),
  demoGuide('gg-dp-deposit', 'Damage protection, deposit only', protectionData(depositOnly, buildOptions(depositOnly, stay(5), 'card'))),
  demoGuide('gg-dp-host', 'Damage protection, host pays', null),
]

export const damageProtectionDemoLinks: GuestGuideLink[] = [
  demoLink('dpboth', 'gg-dp-both', 'Sophie Laurent'),
  demoLink('dpwaiver', 'gg-dp-waiver', 'Ketut Arya'),
  demoLink('dplong', 'gg-dp-long', 'Hannah Brecht'),
  demoLink('dpdeposit', 'gg-dp-deposit', 'Liam O\'Connor'),
  demoLink('dphost', 'gg-dp-host', 'Yuki Sato'),
]
