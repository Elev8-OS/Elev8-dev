import sanitizeHtml from 'sanitize-html'
import { isRichText, plainTextToHtml, RICH_TEXT_ATTRIBUTES, RICH_TEXT_TAGS, RICH_TEXT_URL_SCHEMES } from '../../app/lib/rich-text'

/**
 * Server-side: rich text as HTML that is safe for guests (see
 * `app/lib/rich-text.ts`). The guest guide endpoint runs every item's text
 * through this before sending it, so guide-app can render it with v-html.
 */
export function sanitizeRichTextForGuests(text: string): string {
  const html = isRichText(text) ? text : plainTextToHtml(text)
  return sanitizeHtml(html, {
    allowedTags: [...RICH_TEXT_TAGS],
    allowedAttributes: Object.fromEntries(Object.entries(RICH_TEXT_ATTRIBUTES).map(([tag, attrs]) => [tag, [...attrs]])),
    allowedSchemes: [...RICH_TEXT_URL_SCHEMES],
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { target: '_blank', rel: 'noopener noreferrer' }),
    },
  })
}
