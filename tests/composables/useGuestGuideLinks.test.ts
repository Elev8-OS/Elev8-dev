import { beforeEach, describe, expect, it } from 'vitest'
import { useGuestGuideLinks } from '~/composables/useGuestGuideLinks'

describe('useGuestGuideLinks', () => {
  beforeEach(() => {
    const { links } = useGuestGuideLinks()
    links.value = []
  })

  it('starts with empty links array', () => {
    const { links } = useGuestGuideLinks()
    expect(links.value).toEqual([])
  })

  it('issues a link with token and pending status', () => {
    const { issueLink } = useGuestGuideLinks()
    const link = issueLink({
      guideId: 'gg-abc',
      reservationId: 'res-1',
      listingId: 'lst-1',
      guestName: 'Anna Schmidt',
      guestEmail: 'anna@example.com',
      guestPhone: '+4912345678',
      guestLanguage: 'de',
      channel: 'whatsapp',
      expiresAt: new Date(Date.now() + 86400000 * 5).toISOString(),
    })
    expect(link.id).toMatch(/^ggl-/)
    expect(link.token).toMatch(/^[\w-]{12}$/)
    expect(link.status).toBe('pending')
    expect(link.guestName).toBe('Anna Schmidt')
  })

  it('rejects duplicate link for same reservation', () => {
    const { issueLink } = useGuestGuideLinks()
    issueLink({
      guideId: 'gg-abc',
      reservationId: 'res-1',
      listingId: 'lst-1',
      guestName: 'Anna',
      channel: 'whatsapp',
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    })
    expect(() => {
      issueLink({
        guideId: 'gg-abc',
        reservationId: 'res-1',
        listingId: 'lst-1',
        guestName: 'Anna',
        channel: 'whatsapp',
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      })
    }).toThrow()
  })

  it('marks link as opened', () => {
    const { issueLink, markOpened, links } = useGuestGuideLinks()
    const link = issueLink({
      guideId: 'gg-abc',
      reservationId: 'res-2',
      listingId: 'lst-1',
      guestName: 'Bob',
      channel: 'manual',
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    })
    markOpened(link.id)
    expect(links.value[0].openedAt).toBeDefined()
    expect(links.value[0].status).toBe('opened')
  })

  it('revokes link', () => {
    const { issueLink, revokeLink, links } = useGuestGuideLinks()
    const link = issueLink({
      guideId: 'gg-abc',
      reservationId: 'res-3',
      listingId: 'lst-1',
      guestName: 'Carol',
      channel: 'manual',
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    })
    revokeLink(link.id)
    expect(links.value[0].status).toBe('revoked')
  })

  it('finds link by token', () => {
    const { issueLink, findByToken } = useGuestGuideLinks()
    const link = issueLink({
      guideId: 'gg-abc',
      reservationId: 'res-4',
      listingId: 'lst-1',
      guestName: 'Dan',
      channel: 'manual',
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    })
    expect(findByToken(link.token)?.id).toBe(link.id)
  })

  describe('findForRoom', () => {
    const base = { listingId: 'lst-1', guestName: 'Dan', channel: 'manual' as const, expiresAt: new Date(Date.now() + 86400000).toISOString() }

    it('returns the link made for that room', () => {
      const { links, findForRoom } = useGuestGuideLinks()
      links.value = [
        { id: 'a', token: 'ta', guideId: 'gg-a', reservationId: 'res-1', unitIds: ['un-1'], sentAt: '', status: 'pending', ...base },
        { id: 'b', token: 'tb', guideId: 'gg-b', reservationId: 'res-1', unitIds: ['un-3'], sentAt: '', status: 'pending', ...base },
      ]
      expect(findForRoom('res-1', 'un-3')?.guideId).toBe('gg-b')
    })

    it('falls back to the stay link when the room has none', () => {
      const { links, findForRoom } = useGuestGuideLinks()
      links.value = [{ id: 'a', token: 'ta', guideId: 'gg-a', reservationId: 'res-1', sentAt: '', status: 'pending', ...base }]
      expect(findForRoom('res-1', 'un-9')?.guideId).toBe('gg-a')
    })

    it('is undefined for another reservation', () => {
      const { links, findForRoom } = useGuestGuideLinks()
      links.value = [{ id: 'a', token: 'ta', guideId: 'gg-a', reservationId: 'res-1', sentAt: '', status: 'pending', ...base }]
      expect(findForRoom('res-2', 'un-1')).toBeUndefined()
    })
  })
})
