import type { Template } from '~/components/website-builder/steps/TemplateStep.vue'
import { websites } from '~/components/website-builder/data/websites'

// Answers of the create wizard that the Website itself does not store. The site
// name, address, brand color, font, rules, listings and reviews live in the
// existing WebsiteSettings / PropertySelection / ReviewSelection models.
export interface WizardAnswers {
  guestType: string
  tone: string
  languages: string[]
  defaultLanguage: string
  autoDetectLanguage: boolean
  /** '' lets the AI choose per language. */
  formality: '' | 'formal' | 'informal'
  stylePreset: StylePresetId
  fontPairing: FontPairingId
  /** Subdomain on `SITE_DOMAIN`; ignored when `hasCustomDomain`. */
  subdomain: string
  hasCustomDomain: boolean
  customDomain: string
  phone: string
  email: string
  seoTitle: string
  metaDescription: string
  legalCompany: string
  legalVatNumber: string
  legalStreet: string
  legalPostalCode: string
  legalCity: string
  legalCountry: string
}

export type StylePresetId = 'minimal' | 'warm' | 'bold' | 'airy'
export type FontPairingId = 'playfair' | 'poppins' | 'inter' | 'cormorant'

export const SITE_DOMAIN = '.elev8-stays.com'
export const SEO_TITLE_MAX = 60
export const META_DESCRIPTION_MAX = 160

export function newWizardAnswers(): WizardAnswers {
  return {
    guestType: '',
    tone: '',
    languages: ['en'],
    defaultLanguage: 'en',
    autoDetectLanguage: false,
    formality: '',
    stylePreset: 'minimal',
    fontPairing: 'inter',
    subdomain: '',
    hasCustomDomain: false,
    customDomain: '',
    phone: '',
    email: '',
    seoTitle: '',
    metaDescription: '',
    legalCompany: '',
    legalVatNumber: '',
    legalStreet: '',
    legalPostalCode: '',
    legalCity: '',
    legalCountry: '',
  }
}

export const GUEST_OPTIONS = [
  { value: 'couples', label: 'Couples', icon: 'lucide:heart' },
  { value: 'families', label: 'Families', icon: 'lucide:users' },
  { value: 'business', label: 'Business', icon: 'lucide:briefcase' },
  { value: 'groups', label: 'Groups', icon: 'lucide:users-round' },
  { value: 'lifestyle', label: 'Lifestyle', icon: 'lucide:palmtree' },
  { value: 'mixed', label: 'Mixed', icon: 'lucide:shuffle' },
] as const

export const TONE_OPTIONS = [
  { value: 'luxury', label: 'Luxury', icon: 'lucide:gem' },
  { value: 'warm', label: 'Warm', icon: 'lucide:sun' },
  { value: 'friendly', label: 'Friendly', icon: 'lucide:smile' },
  { value: 'minimal', label: 'Minimal', icon: 'lucide:minus' },
] as const

export const LANGUAGE_OPTIONS = [
  { code: 'en', label: 'English' },
  { code: 'de', label: 'German' },
  { code: 'fr', label: 'French' },
  { code: 'it', label: 'Italian' },
  { code: 'es', label: 'Spanish' },
  { code: 'nl', label: 'Dutch' },
  { code: 'id', label: 'Indonesian' },
  { code: 'zh', label: 'Chinese' },
] as const

// Languages with a formal and an informal "you". English, Indonesian and
// Chinese have no such split, so the choice is hidden for them.
export const FORMALITY_PRONOUNS: Record<string, { formal: string, informal: string }> = {
  de: { formal: 'Sie', informal: 'Du' },
  fr: { formal: 'vous', informal: 'tu' },
  es: { formal: 'usted', informal: 'tú' },
  it: { formal: 'Lei', informal: 'tu' },
  nl: { formal: 'u', informal: 'je' },
}

export const STYLE_PRESETS: { id: StylePresetId, label: string, description: string, gradient: string, template: Template }[] = [
  {
    id: 'minimal',
    label: 'Minimal',
    description: 'Clean and precise',
    gradient: 'from-stone-400/20 to-stone-600/20',
    template: { id: 'minimal-bali', name: 'Minimal Bali', description: 'Minimalist zen aesthetic with earthy tones and focused content for serene Bali retreats.', gradient: 'from-stone-400/20 to-stone-600/20', icon: 'i-lucide-flower-2' },
  },
  {
    id: 'warm',
    label: 'Warm',
    description: 'Inviting and soft',
    gradient: 'from-sky-500/20 to-blue-600/20',
    template: { id: 'beach-house', name: 'Beach House', description: 'Coastal vibes with ocean palettes, photo galleries, and weather widget for seaside stays.', gradient: 'from-sky-500/20 to-blue-600/20', icon: 'i-lucide-waves' },
  },
  {
    id: 'bold',
    label: 'Bold',
    description: 'High contrast',
    gradient: 'from-amber-500/20 to-orange-600/20',
    template: { id: 'luxury-villa', name: 'Luxury Villa', description: 'Elegant design with full-screen hero, amenity showcases, and booking integration for premium properties.', gradient: 'from-amber-500/20 to-orange-600/20', icon: 'i-lucide-crown' },
  },
  {
    id: 'airy',
    label: 'Airy',
    description: 'Light and spacious',
    gradient: 'from-emerald-500/20 to-teal-600/20',
    template: { id: 'modern-tropical', name: 'Modern Tropical', description: 'Clean, airy layout with lush imagery and nature-inspired accents for tropical getaways.', gradient: 'from-emerald-500/20 to-teal-600/20', icon: 'i-lucide-palmtree' },
  },
]

export const FONT_PAIRINGS: { id: FontPairingId, heading: string, family: string, subheading: string }[] = [
  { id: 'playfair', heading: 'Playfair', family: 'Playfair Display', subheading: 'Classic and luxury' },
  { id: 'poppins', heading: 'Poppins', family: 'Poppins', subheading: 'Friendly and modern' },
  { id: 'inter', heading: 'Inter', family: 'Inter', subheading: 'Clean and neutral' },
  { id: 'cormorant', heading: 'Cormorant', family: 'Cormorant Garamond', subheading: 'Editorial' },
]

export const BRAND_COLORS = ['#1a1a2e', '#22C55E', '#3B82F6', '#A855F7', '#000000']

export function templateForPreset(id: StylePresetId): Template {
  return STYLE_PRESETS.find(p => p.id === id)!.template
}

export function fontFamilyFor(id: FontPairingId): string {
  return FONT_PAIRINGS.find(f => f.id === id)!.family
}

// Addresses that are not free: the seeded demo sites plus whatever was created.
function takenSubdomains(): string[] {
  return ['villa-sunset-bali', 'ubud-jungle-retreat', 'admin', 'www', 'app']
    .concat(websites.value.map(w => w.url.replace(SITE_DOMAIN, '').replace(/\.[a-z]+$/, '')))
}

export type AddressCheck = { available: true } | { available: false, reason: 'format' | 'taken' }

export function checkSubdomain(value: string): AddressCheck {
  const slug = value.trim().toLowerCase()
  if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(slug))
    return { available: false, reason: 'format' }
  return takenSubdomains().includes(slug) ? { available: false, reason: 'taken' } : { available: true }
}

export function checkCustomDomain(value: string): AddressCheck {
  const domain = value.trim().toLowerCase()
  if (!/^(?:[a-z0-9-]+\.)+[a-z]{2,}$/.test(domain))
    return { available: false, reason: 'format' }
  return websites.value.some(w => w.url === domain) ? { available: false, reason: 'taken' } : { available: true }
}

export function slugify(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 63)
}

export const GENERATION_STAGES = [
  'Reading your listings and photos',
  'Writing the site copy',
  'Translating into your languages',
  'Applying your style and fonts',
  'Building pages and booking widget',
  'Optimising for search',
]
