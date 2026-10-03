/**
 * Rich text for guest guide content (steps, rules, Good to Know): HTML from
 * the WYSIWYG editor (`shared/RichTextEditor.vue`), or plain text from before
 * the editor existed and from ElevAI corrections. One allowlist, applied by two
 * sanitizers: DOMPurify in the browser (`rich-text-sanitize.client.ts`) and
 * sanitize-html on the server, which cleans what the guest guide endpoint sends
 * to guests (`server/utils/rich-text-sanitize.ts`).
 *
 * ⚠️ Never render stored text with v-html directly: go through `toSafeHtml`
 * (browser) or the server sanitizer. Guests see this content.
 */

export const RICH_TEXT_TAGS = ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'ul', 'ol', 'li', 'a', 'blockquote'] as const
export const RICH_TEXT_ATTRIBUTES = { a: ['href', 'target', 'rel'] } as const
export const RICH_TEXT_URL_SCHEMES = ['http', 'https', 'mailto', 'tel'] as const

/** True when the text carries markup (anything that looks like a tag). */
export function isRichText(text: string): boolean {
  return /<\/?[a-z][^>]*>/i.test(text)
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Plain text as HTML: blank lines make paragraphs, single line breaks stay breaks. */
export function plainTextToHtml(text: string): string {
  return text
    .trim()
    .split(/\n{2,}/)
    .map(block => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`)
    .join('')
}

const ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': '\'', '&nbsp;': ' ' }

/**
 * Rich text as plain text: list items become "- " lines, blocks become lines.
 * For ElevAI and for deciding how long a text is; the result is never rendered
 * as HTML, so a simple tag strip is enough.
 */
export function richTextToPlainText(text: string): string {
  if (!isRichText(text))
    return text
  return text
    .replace(/<\/p>\s*<\/li>/gi, '</li>')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|li|blockquote|ul|ol)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&(?:amp|lt|gt|quot|#39|nbsp);/g, m => ENTITIES[m] ?? m)
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** True when the editor holds nothing but empty paragraphs. */
export function isRichTextEmpty(text: string | undefined): boolean {
  return !text || !richTextToPlainText(text).trim()
}
