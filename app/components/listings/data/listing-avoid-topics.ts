import type { Listing, ReservationStage } from './listings'
import { listings, RESERVATION_STAGES } from './listings'

/** What ElevAI does when a guest raises a topic to avoid. */
export type AvoidTopicAction = 'defer_team' | 'defer_host' | 'defer_to' | 'embody_host' | 'no_response' | 'share_contact'

export interface AvoidTopic {
  id: string
  topic: string
  description: string
  action: AvoidTopicAction
  /** `defer_to`: who ElevAI says it will check with. */
  deferTo?: string
  /** `share_contact`: the phone, email or WhatsApp ElevAI shares. */
  contact?: string
  /** Which guests the rule applies to. Missing means every stage (topics saved before stages existed). */
  stages?: ReservationStage[]
}

export const ALL_RESERVATION_STAGES: ReservationStage[] = RESERVATION_STAGES.map(s => s.value)

export function avoidTopicStages(topic: AvoidTopic): ReservationStage[] {
  return topic.stages ?? ALL_RESERVATION_STAGES
}

/** "All stages", or the chosen ones in display order, e.g. "Future, Current". */
export function avoidTopicStagesLabel(topic: AvoidTopic): string {
  const stages = avoidTopicStages(topic)
  if (stages.length === RESERVATION_STAGES.length)
    return 'All stages'
  return RESERVATION_STAGES.filter(s => stages.includes(s.value)).map(s => s.label).join(', ')
}

export const AVOID_TOPIC_TEMPLATES: { topic: string, description: string }[] = [
  { topic: 'Early check-in requests', description: 'The guest asks to arrive before the standard check-in time.' },
  { topic: 'Late check-out requests', description: 'The guest asks to leave after the standard check-out time.' },
  { topic: 'Discount requests', description: 'The guest asks for a lower price, a deal or a discount.' },
  { topic: 'Refund requests', description: 'The guest asks for money back for all or part of the stay.' },
  { topic: 'Reservation changes', description: 'The guest asks to change the dates, the number of guests or other booking details.' },
]

export const AVOID_TOPIC_ACTIONS: { value: AvoidTopicAction, label: string, description: string, badge?: string, icon: string }[] = [
  { value: 'defer_team', label: 'Defer to team', description: 'ElevAI checks with your team on the guest\'s behalf.', icon: 'lucide:users' },
  { value: 'defer_host', label: 'Defer to host', description: 'ElevAI tells the guest it will check with the host.', icon: 'lucide:user-round' },
  { value: 'defer_to', label: 'Defer to...', description: 'ElevAI tells the guest it will check with the person you name and get back to them.', badge: 'Personalized', icon: 'lucide:user-round-search' },
  { value: 'embody_host', label: 'Embody host', description: 'ElevAI answers as the host and follows up later.', badge: 'Most used', icon: 'lucide:messages-square' },
  { value: 'no_response', label: 'Do not respond', description: 'ElevAI will not reply, and will notify you right away.', icon: 'lucide:bell-ring' },
  { value: 'share_contact', label: 'Share direct contact', description: 'ElevAI shares your direct contact details with the guest.', icon: 'lucide:phone' },
]

export function avoidTopicActionLabel(topic: AvoidTopic): string {
  if (topic.action === 'defer_to' && topic.deferTo?.trim())
    return `Defer to ${topic.deferTo.trim()}`
  return AVOID_TOPIC_ACTIONS.find(a => a.value === topic.action)?.label ?? ''
}

/** Whether the action's extra detail (a name or contact) is filled in when it needs one. */
export function avoidTopicActionReady(action: AvoidTopicAction | undefined, deferTo = '', contact = ''): boolean {
  if (!action)
    return false
  if (action === 'defer_to')
    return !!deferTo.trim()
  if (action === 'share_contact')
    return !!contact.trim()
  return true
}

/**
 * The listing's topics. Listings not yet re-saved only have the old plain
 * strings (`resources.topicsToAvoid`); they read as topics deferred to the team.
 */
export function listingAvoidTopics(listing: Listing): AvoidTopic[] {
  if (listing.resources.avoidTopics)
    return listing.resources.avoidTopics
  return (listing.resources.topicsToAvoid ?? []).map((topic, i) => ({ id: `legacy-${i}`, topic, description: '', action: 'defer_team' }))
}

export function setAvoidTopics(listing: Listing, avoidTopics: AvoidTopic[]): Listing {
  return { ...listing, resources: { ...listing.resources, avoidTopics } }
}

/** Adds the topic, or replaces the one with the same id. */
export function saveAvoidTopic(listing: Listing, topic: AvoidTopic): Listing {
  const current = listingAvoidTopics(listing)
  const exists = current.some(t => t.id === topic.id)
  return setAvoidTopics(listing, exists ? current.map(t => t.id === topic.id ? topic : t) : [...current, topic])
}

export function removeAvoidTopic(listing: Listing, id: string): Listing {
  return setAvoidTopics(listing, listingAvoidTopics(listing).filter(t => t.id !== id))
}

export function removeAvoidTopics(listing: Listing, ids: string[]): Listing {
  return setAvoidTopics(listing, listingAvoidTopics(listing).filter(t => !ids.includes(t.id)))
}

/** Adds the topics to `target` with fresh ids; a target topic with the same name (any case) is replaced. */
export function applyAvoidTopics(target: Listing, topics: AvoidTopic[]): Listing {
  const key = (t: AvoidTopic) => t.topic.trim().toLowerCase()
  const incoming = new Map(topics.map(t => [key(t), t]))
  const kept = listingAvoidTopics(target).map((t) => {
    const replacement = incoming.get(key(t))
    if (!replacement)
      return t
    incoming.delete(key(t))
    return { ...replacement, id: t.id }
  })
  const added = [...incoming.values()].map((t, i) => ({ ...t, id: `topic-${Date.now()}-${i}` }))
  return setAvoidTopics(target, [...kept, ...added])
}

/** Copies topics to other listings. Returns how many listings were written. */
export function copyAvoidTopicsToListings(sourceId: string, topics: AvoidTopic[], targetIds: string[]): number {
  const targets = new Set(targetIds.filter(id => id !== sourceId))
  listings.value = listings.value.map(l => targets.has(l.id) ? applyAvoidTopics(l, topics) : l)
  return targets.size
}
