import DOMPurify from 'dompurify'
import { isRichText, plainTextToHtml, RICH_TEXT_ATTRIBUTES, RICH_TEXT_TAGS, RICH_TEXT_URL_SCHEMES } from '~/lib/rich-text'

const ALLOWED_URI = new RegExp(`^(?:${RICH_TEXT_URL_SCHEMES.join('|')}):`, 'i')

// DOMPurify needs a DOM. Components that import this are also rendered on the
// server, where DOMPurify has no `addHook` / `sanitize`, so the hook is added
// on first use in the browser rather than when the module loads.
let hookAdded = false
function purifier() {
  if (!DOMPurify.isSupported)
    return null
  if (!hookAdded) {
    DOMPurify.addHook('afterSanitizeAttributes', (node) => {
      if (node.tagName === 'A') {
        node.setAttribute('target', '_blank')
        node.setAttribute('rel', 'noopener noreferrer')
      }
    })
    hookAdded = true
  }
  return DOMPurify
}

/**
 * Browser-side: the stored text as HTML that is safe to put in v-html (see
 * `rich-text.ts`). On the server it returns '' (never unsanitized HTML); the
 * browser fills it in on hydration.
 */
export function toSafeHtml(text: string): string {
  const purify = purifier()
  if (!purify)
    return ''
  const html = isRichText(text) ? text : plainTextToHtml(text)
  return purify.sanitize(html, {
    ALLOWED_TAGS: [...RICH_TEXT_TAGS],
    ALLOWED_ATTR: [...new Set(Object.values(RICH_TEXT_ATTRIBUTES).flat())],
    ALLOWED_URI_REGEXP: ALLOWED_URI,
  })
}
