import { describe, expect, it } from 'vitest'
import { isRichText, isRichTextEmpty, plainTextToHtml, richTextToPlainText } from '~/lib/rich-text'
import { toSafeHtml } from '~/lib/rich-text-sanitize.client'
import { sanitizeRichTextForGuests } from '~/server/utils/rich-text-sanitize'

const ATTACK = '<p onclick="steal()">Hi <script>alert(1)</script><a href="javascript:alert(1)">x</a><img src=x onerror=alert(1)><a href="https://ok.example">ok</a></p>'

describe('rich text helpers', () => {
  it('tells markup from plain text', () => {
    expect(isRichText('<p>Pool</p>')).toBe(true)
    expect(isRichText('Pool 08:00 < 09:00')).toBe(false)
  })

  it('turns plain text into escaped paragraphs and breaks', () => {
    expect(plainTextToHtml('Pool <open>\n08:00\n\nRubbish')).toBe('<p>Pool &lt;open&gt;<br>08:00</p><p>Rubbish</p>')
  })

  it('reads rich text back as plain lines, lists as dashes', () => {
    expect(richTextToPlainText('<p>Cafés &amp; bars</p><ul><li><p>Suzana</p></li><li><p>Centre Court</p></li></ul>'))
      .toBe('Cafés & bars\n- Suzana\n- Centre Court')
  })

  it('treats an editor holding only empty paragraphs as empty', () => {
    expect(isRichTextEmpty('<p></p>')).toBe(true)
    expect(isRichTextEmpty('<p> </p><p></p>')).toBe(true)
    expect(isRichTextEmpty('<p>x</p>')).toBe(false)
    expect(isRichTextEmpty(undefined)).toBe(true)
  })
})

describe.each([
  ['in the browser (DOMPurify)', toSafeHtml],
  ['on the server, for guests (sanitize-html)', sanitizeRichTextForGuests],
])('sanitizing %s', (_, sanitize) => {
  it('drops scripts, event handlers, images and javascript: links', () => {
    const out = sanitize(ATTACK)
    expect(out).not.toMatch(/script|onclick|onerror|javascript:|<img/i)
    expect(out).toContain('href="https://ok.example"')
  })

  it('keeps the formatting the editor makes, and opens links in a new tab safely', () => {
    const out = sanitize('<p><strong>B</strong> <em>I</em> <u>U</u></p><ol><li>one</li></ol><p><a href="tel:+41449554040">call</a></p>')
    expect(out).toContain('<strong>B</strong>')
    expect(out).toContain('<u>U</u>')
    expect(out).toContain('<ol><li>one</li></ol>')
    expect(out).toMatch(/<a href="tel:\+41449554040"[^>]*target="_blank"[^>]*>|<a [^>]*target="_blank"[^>]*href="tel:/)
    expect(out).toContain('noopener')
  })

  it('renders plain text safely as paragraphs', () => {
    expect(sanitize('Pool <b>open</b>?')).toContain('<b>open</b>')
    expect(sanitize('Tap water\nnot drinkable')).toContain('<br')
  })
})
