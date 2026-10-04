import type { Listing } from './listings'
import { conversations, messages } from '~/components/inbox/data/conversations'

/**
 * "Create with AI" for an SOP: draft its text from this listing's past guest
 * conversations, or from a short guided brief. Demo only: drafting is local
 * text composition (the dialog animates it), not a model call.
 * Conversations are read from the inbox seed (`inbox/data/conversations.ts`).
 */

export interface SopAiQuestion {
  id: string
  label: string
  placeholder: string
}

export interface SopAiTopic {
  title: string
  /** Words that mark a guest message as being about this SOP. */
  keywords: string[]
  questions: SopAiQuestion[]
}

const q = (id: string, label: string, placeholder: string): SopAiQuestion => ({ id, label, placeholder })

/** Per default SOP question (field key without the `sop:` prefix). */
const TOPICS: Record<string, Omit<SopAiTopic, 'title'>> = {
  checkInProcedure: {
    keywords: ['check-in', 'check in', 'checkin', 'arrive', 'arrival', 'key', 'gate', 'lockbox', 'code'],
    questions: [
      q('who', 'Who meets the guest, or is it self check-in?', 'e.g. Wayan meets guests at the gate'),
      q('access', 'How do guests get in?', 'e.g. Lockbox by the gate, code sent on the morning of arrival'),
      q('show', 'What is shown or explained on arrival?', 'e.g. Wi-Fi, pool rules, AC remotes'),
    ],
  },
  checkOutProcedure: {
    keywords: ['check-out', 'check out', 'checkout', 'leaving', 'depart', 'luggage'],
    questions: [
      q('keys', 'What do guests do with the keys?', 'e.g. Leave them in the lockbox'),
      q('expect', 'What should guests do before leaving?', 'e.g. Close windows, put towels in the bathroom'),
      q('after', 'What does the team do after check-out?', 'e.g. Inspect the villa within an hour'),
    ],
  },
  requestsHandled: {
    keywords: ['towel', 'extra', 'pickup', 'airport', 'transfer', 'book', 'restaurant', 'driver', 'can you', 'could you'],
    questions: [
      q('list', 'Which requests can the team just do?', 'e.g. Extra towels, airport pickup, restaurant bookings'),
      q('how', 'How fast, and who does it?', 'e.g. Within an hour, by the housekeeper on duty'),
    ],
  },
  requestsApproval: {
    keywords: ['extra guest', 'party', 'event', 'discount', 'visitor', 'friends', 'pet', 'dog', 'cat'],
    questions: [
      q('list', 'Which requests need the host to approve?', 'e.g. Extra guests, events, discounts'),
      q('who', 'Who approves, and how quickly?', 'e.g. The owner, within 4 hours'),
    ],
  },
  ruleBreaks: {
    keywords: ['noise', 'loud', 'party', 'smok', 'rule', 'complain', 'neighbour', 'neighbor'],
    questions: [
      q('first', 'What is the first step?', 'e.g. A friendly reminder message'),
      q('repeat', 'What if it happens again?', 'e.g. The manager calls the guest'),
      q('serious', 'When is it serious enough to end the stay?', 'e.g. Damage or a second noise complaint after 22:00'),
    ],
  },
  maintenanceIssues: {
    keywords: ['broken', 'not working', 'leak', 'ac', 'air con', 'hot water', 'power', 'electric', 'fix', 'repair'],
    questions: [
      q('who', 'Who fixes things, and how fast?', 'e.g. The on-call technician within 2 hours'),
      q('guest', 'What does the guest hear in the meantime?', 'e.g. An update every 30 minutes'),
      q('fallback', 'What if it cannot be fixed quickly?', 'e.g. A fan or a partial refund for the night'),
    ],
  },
  complaints: {
    keywords: ['refund', 'complain', 'disappoint', 'dirty', 'not clean', 'unhappy', 'money back', 'compensat'],
    questions: [
      q('first', 'How should the first reply sound?', 'e.g. Apologise and ask for photos'),
      q('refund', 'Who decides on refunds or compensation?', 'e.g. The manager, up to USD 100.00 without the owner'),
    ],
  },
  emergencyProcedure: {
    keywords: ['emergency', 'hospital', 'doctor', 'injur', 'hurt', 'fire', 'police', 'ambulance', 'sick'],
    questions: [
      q('numbers', 'Which numbers should guests call?', 'e.g. Ambulance 118, police 110, the villa manager'),
      q('hospital', 'Where is the nearest hospital or clinic?', 'e.g. BIMC Kuta, 25 minutes'),
      q('team', 'Who on the team is told first?', 'e.g. The villa manager, then the owner'),
    ],
  },
  sops: {
    keywords: [],
    questions: [
      q('what', 'What should the team know in general?', 'e.g. Quiet hours, who to call, where supplies are'),
    ],
  },
}

const CUSTOM_QUESTIONS: SopAiQuestion[] = [
  q('when', 'When does this come up?', 'e.g. When a guest asks for the pool to be cleaned'),
  q('steps', 'What should the team do, step by step?', 'e.g. Check the schedule, send the pool cleaner, tell the guest'),
  q('who', 'Who is responsible, or who should be told?', 'e.g. The housekeeper; tell the manager if it costs extra'),
]

/** Words of a custom SOP title long enough to search conversations with. */
function titleKeywords(title: string): string[] {
  return title.toLowerCase().split(/[^a-z0-9-]+/).filter(w => w.length > 3)
}

/** The topic for a default question (`sop:<key>` or `sops`) or a custom SOP (by its title). */
export function sopAiTopic(fieldKey: string | null, title: string): SopAiTopic {
  const base = fieldKey ? TOPICS[fieldKey.replace(/^sop:/, '')] : undefined
  if (base)
    return { title, ...base, keywords: base.keywords.length ? base.keywords : titleKeywords(title) }
  return { title, keywords: titleKeywords(title), questions: CUSTOM_QUESTIONS }
}

export interface SopConversationMatch {
  conversationId: string
  guestName: string
  checkIn: string
  /** The guest message that matched, trimmed. */
  snippet: string
}

/** This listing's guest conversations with a message about the topic, newest stays first. */
export function findSopConversations(listing: Listing, topic: SopAiTopic, limit = 5): SopConversationMatch[] {
  if (!topic.keywords.length)
    return []
  const patterns = topic.keywords.map(keywordPattern)
  return conversations
    .filter(c => c.listingName === listing.name)
    .map((c) => {
      const hit = (messages[c.id] ?? []).find(m => m.sender === 'guest' && patterns.some(re => re.test(m.content)))
      return hit ? { conversationId: c.id, guestName: c.guestName, checkIn: c.checkIn, snippet: trimSnippet(hit.content) } : null
    })
    .filter((m): m is SopConversationMatch => !!m)
    .sort((a, b) => b.checkIn.localeCompare(a.checkIn))
    .slice(0, limit)
}

/**
 * A keyword matches at the start of a word ("smok" finds "smoking"); short
 * ones (3 letters or fewer, e.g. "ac", "cat") must be the whole word, so
 * "location" does not match "cat".
 */
function keywordPattern(keyword: string): RegExp {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`\\b${escaped}${keyword.length <= 3 ? '\\b' : ''}`, 'i')
}

function trimSnippet(text: string, max = 140): string {
  const t = text.replace(/\s+/g, ' ').trim()
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t
}

/** Draft from the picked conversations: what guests asked, then the steps to follow. */
export function draftFromConversations(topic: SopAiTopic, matches: SopConversationMatch[]): string {
  const quotes = matches.slice(0, 3).map(m => `- ${m.guestName}: "${m.snippet}"`)
  return [
    `${topic.title}`,
    '',
    `Based on ${matches.length} past ${matches.length === 1 ? 'conversation' : 'conversations'}, guests asked about this like so:`,
    ...quotes,
    '',
    'Steps:',
    '1. Reply within 15 minutes and confirm you are on it.',
    '2. Handle it the same way as in these conversations, and keep the guest updated.',
    '3. Tell the villa manager if it needs approval or costs extra.',
    '4. Close the loop: confirm with the guest once it is done.',
  ].join('\n')
}

// --- Guided brief: typical guest, tone, what it should cover, AI mode ----------

export const TYPICAL_GUESTS = ['General guests', 'Families with kids', 'Business travelers', 'Large groups', 'Long stays', 'Other'] as const

export const SOP_TONES = ['Professional & friendly', 'Warm & empathetic', 'Direct & efficient', 'Luxury concierge', 'Other'] as const

export type SopAiMode = 'strict' | 'creative'

export const SOP_AI_MODES: { value: SopAiMode, label: string, description: string }[] = [
  { value: 'strict', label: 'Strict', description: 'The AI follows your instructions strictly, including only what you explicitly describe' },
  { value: 'creative', label: 'Creative', description: 'The AI goes beyond what you describe, adding scenarios, exceptions and best practices it finds relevant' },
]

export interface SopAiBrief {
  /** One of `TYPICAL_GUESTS`, or the host's own words for Other. Optional. */
  guest?: string
  /** One of `SOP_TONES`, or the host's own words for Other. Optional. */
  tone?: string
  /** What the SOP should cover, in the host's words. */
  cover: string
  mode: SopAiMode
}

/** What Creative mode adds for a typical guest. */
const GUEST_EXTRAS: Record<string, string> = {
  'Families with kids': 'Point out child safety on arrival: the pool, stairs, and where the first aid kit is.',
  'Business travelers': 'Keep it quick and confirm the Wi-Fi works; offer a quiet place to work.',
  'Large groups': 'Confirm the number of guests and remind the group of quiet hours and visitor rules.',
  'Long stays': 'Offer a mid-stay clean and check in with the guest once a week.',
}

/** Creative mode: an example message to the guest in the chosen tone. */
const TONE_SAMPLES: Record<string, string> = {
  'Professional & friendly': 'Hi {guest}, thanks for letting us know. We are on it and will update you shortly.',
  'Warm & empathetic': 'Hi {guest}, we completely understand, and we are so sorry for the trouble. We are taking care of it right now.',
  'Direct & efficient': 'Hi {guest}, noted. Our team is handling it now; we will confirm within 30 minutes.',
  'Luxury concierge': 'Dear {guest}, it is our pleasure to arrange this for you. Your host team will see to every detail.',
}

/** The host's text as steps: one per line, or per sentence when it is one paragraph. */
function coverSteps(cover: string): string[] {
  const lines = cover.split(/\n+/).map(l => l.replace(/^\s*(?:[-*]|\d+[.)])\s*/, '').trim()).filter(Boolean)
  const parts = lines.length > 1 ? lines : cover.split(/(?<=[.!?])\s+/).map(l => l.trim()).filter(Boolean)
  return parts.map(p => p.replace(/[.!?]?$/, '.'))
}

/**
 * Draft from the guided brief. Strict: only the host's own points, as steps.
 * Creative: the same steps, then extras for the typical guest, an exception
 * to plan for, and a best practice.
 */
export function draftFromBrief(topic: SopAiTopic, brief: SopAiBrief): string {
  const guest = brief.guest?.trim()
  const tone = brief.tone?.trim()
  const steps = coverSteps(brief.cover)
  const lines = [topic.title]
  if (guest && guest !== 'General guests')
    lines.push(`For: ${guest}`)
  if (tone)
    lines.push(`Tone with guests: ${tone}`)
  lines.push('', ...steps.map((st, i) => `${i + 1}. ${st}`))
  if (brief.mode === 'creative') {
    const extra = guest ? GUEST_EXTRAS[guest] : undefined
    if (extra)
      lines.push(`${steps.length + 1}. ${extra}`)
    const sample = tone ? TONE_SAMPLES[tone] : undefined
    if (sample)
      lines.push('', 'Example message to the guest:', `"${sample}"`)
    lines.push(
      '',
      'Exceptions:',
      '- If the person responsible is not available, the villa manager takes over and tells the guest who to contact.',
      '- If the guest is unhappy with the outcome, apologise, note it in the reservation and tell the manager.',
      '',
      'Best practice: confirm with the guest in writing, and keep a note in the reservation.',
    )
  }
  return lines.join('\n')
}
