import { describe, expect, it } from 'vitest'
import { listingGuideContent } from '~/components/listings/data/guest-guide-content'
import { listings } from '~/components/listings/data/listings'
import handler from '~/server/api/guest-guides/by-token/[token].get'

function invoke(token: string) {
  return handler({
    context: { params: { token } },
    node: { req: { url: `/api/guest-guides/by-token/${token}` }, res: {} },
  } as any)
}

describe('gET /api/guest-guides/by-token/:token guide content', () => {
  it('sends the stay\'s listing content, which the guide sections render', async () => {
    const result = await invoke('abc123def456') as any
    const listing = listings.value.find(l => l.id === result.listing?.id)
    const expected = listingGuideContent(listing)
    expect(result.guideContent.checkin.map((i: { title: string }) => i.title)).toEqual(expected.checkin.map(i => i.title))
    // Item text goes out as sanitized HTML: plain text becomes paragraphs.
    const withText = result.guideContent.checkin.find((i: { text?: string }) => i.text)
    if (withText)
      expect(withText.text).toMatch(/^<p>/)
    expect(Object.keys(result.guideContent)).toEqual(['checkin', 'checkout', 'house_rules', 'good_to_know'])
  })
})

describe('gET /api/guest-guides/by-token/:token rich text', () => {
  it('sanitizes the host\'s rich text before it reaches guests', async () => {
    const first = await invoke('abc123def456') as any
    const index = listings.value.findIndex(l => l.id === first.listing?.id)
    const original = listings.value[index]!
    listings.value[index] = { ...original, guestGuide: { ...original.guestGuide, good_to_know: [{ id: 'x', title: 'Pool', text: '<p>Open <script>alert(1)</script><strong>08:00</strong></p>' }] } }
    try {
      const result = await invoke('abc123def456') as any
      const text = result.guideContent.good_to_know[0].text as string
      expect(text).not.toContain('script')
      expect(text).toContain('<strong>08:00</strong>')
    }
    finally {
      listings.value[index] = original
    }
  })
})
