import DOMPurify from 'dompurify'
import { isRichText, plainTextToHtml, RICH_TEXT_ATTRIBUTES, RICH_TEXT_TAGS, RICH_TEXT_URL_SCHEMES } from '~/lib/rich-text'

const ALLOWED_URI = new RegExp(`^(?:${RICH_TEXT_URL_SCHEMES.join('|')}):`, 'i')

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank')
    node.setAttribute('rel', 'noopener noreferrer')
  }
})

/** Browser-side: the stored text as HTML that is safe to put in v-html (see `rich-text.ts`). */
export function toSafeHtml(text: string): string {
  const html = isRichText(text) ? text : plainTextToHtml(text)
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [...RICH_TEXT_TAGS],
    ALLOWED_ATTR: [...new Set(Object.values(RICH_TEXT_ATTRIBUTES).flat())],
    ALLOWED_URI_REGEXP: ALLOWED_URI,
  })
}
