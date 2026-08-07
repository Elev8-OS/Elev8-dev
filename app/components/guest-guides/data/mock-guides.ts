// app/components/guest-guides/data/mock-guides.ts
import type { GuestGuide, GuestGuideLink } from './types'

const now = new Date().toISOString()

export const mockGuestGuides: GuestGuide[] = [
  {
    id: 'gg-mock-001',
    title: 'Bali Villa Welcome Guide',
    description: 'Standard welcome pack for Bali villas',
    assignedListingIds: ['lst-1', 'lst-2'],
    templateId: 'tpl-bali-villa',
    status: 'active',
    sections: [
      {
        id: 'gs-mock-001',
        type: 'hero',
        order: 0,
        enabled: true,
        data: { photoUrl: 'https://images.unsplash.com/photo-1540541338287-41700207dee6', title: 'Welcome to Villa Serenity', subtitle: 'Your home in Bali' },
      },
      {
        id: 'gs-mock-002',
        type: 'welcome',
        order: 1,
        enabled: true,
        data: { message: 'We are thrilled to welcome you to Villa Serenity. This guide will help you make the most of your stay.' },
      },
    ],
    defaultLanguage: 'en',
    createdBy: 'staff-1',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'gg-mock-002',
    title: 'Mountain Retreat Guide',
    description: 'Cozy guide for mountain properties',
    assignedListingIds: ['lst-3'],
    templateId: 'tpl-mountain-retreat',
    status: 'draft',
    sections: [],
    defaultLanguage: 'en',
    createdBy: 'staff-1',
    createdAt: now,
    updatedAt: now,
  },
]

export const mockGuestGuideLinks: GuestGuideLink[] = [
  {
    id: 'ggl-mock-001',
    token: 'abc123def456',
    guideId: 'gg-mock-001',
    reservationId: 'res-mock-001',
    listingId: 'lst-1',
    guestName: 'Anna Schmidt',
    guestEmail: 'anna@example.com',
    guestPhone: '+4912345678',
    guestLanguage: 'de',
    sentAt: now,
    openedAt: now,
    submittedAt: now,
    expiresAt: new Date(Date.now() + 86400000 * 3).toISOString(),
    status: 'submitted',
    channel: 'whatsapp',
  },
  {
    id: 'ggl-mock-002',
    token: 'emilychen2026xyz',
    guideId: 'gg-mock-001',
    reservationId: 'res-3',
    listingId: 'lst-2',
    guestName: 'Emily Chen',
    guestEmail: 'emily.chen@email.com',
    guestPhone: '+65 8123 4567',
    guestLanguage: 'en',
    sentAt: '2026-08-01T08:15:00Z',
    openedAt: '2026-08-01T09:00:00Z',
    submittedAt: '2026-08-01T09:10:00Z',
    expiresAt: '2026-09-01T00:00:00Z',
    status: 'submitted',
    channel: 'whatsapp',
  },
]
