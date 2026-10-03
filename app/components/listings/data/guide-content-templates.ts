import type { GuideContentItem, GuideContentKind } from '~/components/listings/data/guest-guide-content'

/**
 * Reusable guest guide content (Settings > Guest Guide > Content Templates):
 * a named set of check-in steps, check-out steps, house rules or Good to Know
 * items. Each kind has exactly one default, offered first when a listing has
 * none of that kind. A listing takes a COPY; editing a template later never
 * changes a listing.
 */
export interface GuideContentTemplate {
  id: string
  kind: GuideContentKind
  name: string
  isDefault: boolean
  items: GuideContentItem[]
  createdAt: string
  updatedAt: string
}

export const GUIDE_CONTENT_TEMPLATES_STORAGE_KEY = 'elev8-guide-content-templates-v1'

const seededAt = '2026-09-01T00:00:00.000Z'

function template(id: string, kind: GuideContentKind, name: string, isDefault: boolean, items: Array<Omit<GuideContentItem, 'id'>>): GuideContentTemplate {
  return { id, kind, name, isDefault, items: items.map((item, i) => ({ id: `${id}-${i + 1}`, ...item })), createdAt: seededAt, updatedAt: seededAt }
}

export const SEED_GUIDE_CONTENT_TEMPLATES: GuideContentTemplate[] = [
  template('gct-ci-staff', 'checkin', 'Staff welcome', true, [
    { title: 'Arrive at the main gate', text: 'Our staff meet you at the gate. Let us know your arrival time the day before.' },
    { title: 'Walk-through with the host', text: 'We show you the pool, the AC remotes and the safe, and hand over the keys.' },
    { title: 'Connect to the Wi-Fi', text: 'Network and password are on the card in the living room.' },
  ]),
  template('gct-ci-self', 'checkin', 'Self check-in with smart lock', false, [
    { title: 'Find the villa entrance', text: 'Look for the wooden gate with the villa name.' },
    { title: 'Open the door with your code', text: 'Your personal door code arrives on the day of arrival. Press the keypad, then enter the code and #.' },
    { title: 'Message us when you are in', text: 'Reply in the chat so we know you arrived safely.' },
  ]),
  template('gct-co-standard', 'checkout', 'Standard check-out', true, [
    { title: 'Check out by 11:00', text: 'Need longer? Ask the day before; it depends on the next booking.' },
    { title: 'Leave the keys on the kitchen counter' },
    { title: 'Close the windows and switch off the AC' },
  ]),
  template('gct-hr-villa', 'house_rules', 'Villa house rules', true, [
    { title: 'No smoking inside', text: 'Smoking is fine on the terrace. A cleaning fee applies for smoke inside.' },
    { title: 'No parties or events' },
    { title: 'Quiet hours after 22:00', text: 'Please keep music and pool noise down for the neighbours.' },
    { title: 'Registered guests only', text: 'Only the guests on the booking may stay overnight.' },
  ]),
  template('gct-gk-bali', 'good_to_know', 'Bali villa basics', true, [
    { icon: 'lucide:droplets', title: 'Drinking water', text: 'Tap water is not drinkable. Use the water dispenser.' },
    { icon: 'lucide:waves', title: 'Pool', text: 'Cleaned every morning. No glass by the pool.' },
    { icon: 'lucide:zap', title: 'Power', text: 'Sockets are type C/F, 230 V. Adapters are in the drawer by the TV.' },
    { icon: 'lucide:trash-2', title: 'Rubbish', text: 'Bins by the side gate; staff collect them daily.' },
  ]),
]
