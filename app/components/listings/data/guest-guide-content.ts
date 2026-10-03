/**
 * A listing's guest guide content: check-in steps, check-out steps, house
 * rules and Good to Know. ⚠️ THE LISTING OWNS IT: the guest guide only decides
 * which sections show and in what order, and reads the content from the
 * listing of the stay. ElevAI and the house-rules agreement PDF read the same
 * content. Edited in the listing's Guest Guide tab; reusable starting points
 * live in Settings > Guest Guide > Content Templates.
 *
 * Every kind is the same item shape (title, text, optional photo, optional
 * icon), so one editor and one template store serve all four.
 *
 * Kept free of imports from the listings data so `listings.ts` can type and
 * seed from it without an import cycle.
 */

import { isRichTextEmpty, richTextToPlainText } from '../../../lib/rich-text'

export type GuideContentKind = 'checkin' | 'checkout' | 'house_rules' | 'good_to_know'

export const GUIDE_CONTENT_KINDS: GuideContentKind[] = ['checkin', 'checkout', 'house_rules', 'good_to_know']

export interface GuideContentItem {
  id: string
  title: string
  text?: string
  /** Steps and Good to Know: a photo of the gate, the key box, the pool... (data URL). */
  photoUrl?: string
  /** Good to Know: a lucide icon name, e.g. `lucide:wifi`. */
  icon?: string
}

export type ListingGuideContent = Partial<Record<GuideContentKind, GuideContentItem[]>>

export interface GuideContentKindMeta {
  label: string
  /** One item, e.g. "step", "rule". */
  noun: string
  icon: string
  description: string
  numbered: boolean
  photo: boolean
  iconPicker: boolean
  titlePlaceholder: string
  textPlaceholder: string
}

export const GUIDE_CONTENT_META: Record<GuideContentKind, GuideContentKindMeta> = {
  checkin: {
    label: 'Check-in steps',
    noun: 'step',
    icon: 'lucide:log-in',
    description: 'How the guest gets in, in order.',
    numbered: true,
    photo: true,
    iconPicker: false,
    titlePlaceholder: 'e.g. Park at the north gate',
    textPlaceholder: 'What to do, what to look for.',
  },
  checkout: {
    label: 'Check-out steps',
    noun: 'step',
    icon: 'lucide:log-out',
    description: 'What the guest does before leaving.',
    numbered: true,
    photo: true,
    iconPicker: false,
    titlePlaceholder: 'e.g. Leave the keys on the kitchen counter',
    textPlaceholder: 'Details, if any.',
  },
  house_rules: {
    label: 'House rules',
    noun: 'rule',
    icon: 'lucide:scroll',
    description: 'What the guest agrees to. Also printed on the house-rules agreement.',
    numbered: false,
    photo: false,
    iconPicker: false,
    titlePlaceholder: 'e.g. No smoking inside',
    textPlaceholder: 'Why, or what happens if not.',
  },
  good_to_know: {
    label: 'Good to know',
    noun: 'item',
    icon: 'lucide:info',
    description: 'Practical tips for the stay.',
    numbered: false,
    photo: true,
    iconPicker: true,
    titlePlaceholder: 'e.g. Pool hours',
    textPlaceholder: 'The details the guest needs.',
  },
}

/** Icons offered for Good to Know items. */
export const GOOD_TO_KNOW_ICONS = [
  'lucide:info',
  'lucide:wifi',
  'lucide:waves',
  'lucide:trash-2',
  'lucide:car',
  'lucide:utensils',
  'lucide:shopping-bag',
  'lucide:sun',
  'lucide:key-round',
  'lucide:zap',
  'lucide:droplets',
  'lucide:phone',
  'lucide:map-pin',
  'lucide:shield-check',
  'lucide:volume-x',
  'lucide:baby',
  'lucide:dog',
  'lucide:cigarette-off',
] as const

/** Largest step photo accepted, as for other uploads stored in the browser. */
export const GUIDE_PHOTO_MAX_BYTES = 2 * 1024 * 1024
export const GUIDE_PHOTO_TYPES = ['image/png', 'image/jpeg', 'image/webp']

/**
 * Item text is rich text (HTML from the WYSIWYG editor, or older plain text).
 * The plain-text helpers live in `app/lib/rich-text.ts`; imported relatively so
 * the server, which imports this file, resolves them too.
 */
let idCounter = 0
export function newGuideItemId(): string {
  idCounter += 1
  return `gci-${Date.now().toString(36)}-${idCounter}`
}

/** The fields a listing carries for its guide content, old and new, for `listingGuideItems`. */
export interface GuideContentSource {
  guestGuide?: ListingGuideContent
  /** @deprecated Free text replaced by `guestGuide.checkin`; read only as a fallback. */
  checkInInstructions?: string
  /** @deprecated Free text replaced by `guestGuide.checkout`; read only as a fallback. */
  checkOutInstructions?: string
  resources?: { basics?: { houseRules?: string } }
}

/**
 * A listing's items of one kind. Structured content wins; a listing that still
 * only has the old free text (`checkInInstructions`, `basics.houseRules`)
 * reads it as items, so nothing disappears before the listing is re-saved.
 */
export function listingGuideItems(listing: GuideContentSource | null | undefined, kind: GuideContentKind): GuideContentItem[] {
  const structured = listing?.guestGuide?.[kind]
  if (structured)
    return structured
  if (!listing)
    return []
  if (kind === 'checkin' && listing.checkInInstructions?.trim())
    return [{ id: 'legacy-checkin', title: 'On arrival', text: listing.checkInInstructions.trim() }]
  if (kind === 'checkout' && listing.checkOutInstructions?.trim())
    return [{ id: 'legacy-checkout', title: 'Before you leave', text: listing.checkOutInstructions.trim() }]
  if (kind === 'house_rules')
    return guideItemsFromText(listing.resources?.basics?.houseRules ?? '', [])
  return []
}

/** Every kind at once, for the guest guide endpoint. */
export function listingGuideContent(listing: GuideContentSource | null | undefined): Record<GuideContentKind, GuideContentItem[]> {
  return {
    checkin: listingGuideItems(listing, 'checkin'),
    checkout: listingGuideItems(listing, 'checkout'),
    house_rules: listingGuideItems(listing, 'house_rules'),
    good_to_know: listingGuideItems(listing, 'good_to_know'),
  }
}

/** Trims, drops untitled items and empty optional fields. */
export function cleanGuideItems(items: GuideContentItem[]): GuideContentItem[] {
  return items
    .map((item) => {
      const out: GuideContentItem = { id: item.id, title: item.title.trim() }
      if (!isRichTextEmpty(item.text))
        out.text = item.text!.trim()
      if (item.photoUrl)
        out.photoUrl = item.photoUrl
      if (item.icon)
        out.icon = item.icon
      return out
    })
    .filter(item => item.title)
}

/** A deep copy with fresh ids, for templates and copies between listings. */
export function cloneGuideItems(items: GuideContentItem[]): GuideContentItem[] {
  return items.map(item => ({ ...item, id: newGuideItemId() }))
}

/**
 * Items as plain text, one per line ("1. Title: text" when numbered), for
 * ElevAI and for the host correcting what ElevAI said.
 */
export function guideItemsAsText(items: GuideContentItem[], numbered: boolean): string {
  return items
    .map((item, i) => {
      const text = item.text ? richTextToPlainText(item.text).replace(/\s*\n\s*/g, ' ') : ''
      return `${numbered ? `${i + 1}. ` : ''}${item.title}${text ? `: ${text}` : ''}`
    })
    .join('\n')
}

/**
 * Reads items back from text, one per line ("Title: text", numbering and
 * bullets dropped). A line whose title matches an existing item keeps that
 * item's id, photo and icon, so correcting a typo does not lose a photo.
 */
export function guideItemsFromText(text: string, previous: GuideContentItem[]): GuideContentItem[] {
  return text.split(/\r?\n/)
    .map(line => line.trim().replace(/^(?:[-*•]|\d+[.)])\s*/, ''))
    .filter(Boolean)
    .map((line) => {
      const split = line.indexOf(': ')
      const title = (split > 0 ? line.slice(0, split) : line).trim()
      const body = split > 0 ? line.slice(split + 2).trim() : ''
      const match = previous.find(p => p.title.toLowerCase() === title.toLowerCase())
      const item: GuideContentItem = { ...(match ?? {}), id: match?.id ?? newGuideItemId(), title }
      if (body)
        item.text = body
      else delete item.text
      return item
    })
}
