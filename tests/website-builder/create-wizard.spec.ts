// The create flow: Guests, Tone, Languages, Style, Listings, Details, Review.

import { describe, expect, it } from 'vitest'
import { websites } from '~/components/website-builder/data/websites'
import {
  checkCustomDomain,
  checkSubdomain,
  FORMALITY_PRONOUNS,
  newWizardAnswers,
  slugify,
  templateForPreset,
} from '~/components/website-builder/data/wizard'

describe('wizard answers', () => {
  it('starts with English only and the minimal preset', () => {
    const a = newWizardAnswers()
    expect(a.languages).toEqual(['en'])
    expect(a.defaultLanguage).toBe('en')
    expect(a.formality).toBe('')
    expect(templateForPreset(a.stylePreset).name).toBe('Minimal Bali')
  })

  it('maps every preset to a template', () => {
    expect(['minimal', 'warm', 'bold', 'airy'].map(p => templateForPreset(p as never).name))
      .toEqual(['Minimal Bali', 'Beach House', 'Luxury Villa', 'Modern Tropical'])
  })

  it('only languages with a formal "you" ask how to address guests', () => {
    expect(Object.keys(FORMALITY_PRONOUNS)).toEqual(['de', 'fr', 'es', 'it', 'nl'])
    expect(FORMALITY_PRONOUNS.en).toBeUndefined()
  })
})

describe('website address', () => {
  it('slugifies a title into a subdomain', () => {
    expect(slugify('  Villa Sunset Bali! ')).toBe('villa-sunset-bali')
  })

  it('rejects a malformed or taken subdomain and accepts a free one', () => {
    expect(checkSubdomain('a')).toEqual({ available: false, reason: 'format' })
    expect(checkSubdomain('has space')).toEqual({ available: false, reason: 'format' })
    expect(checkSubdomain('villa-sunset-bali')).toEqual({ available: false, reason: 'taken' })
    expect(checkSubdomain('my-new-villa')).toEqual({ available: true })
  })

  it('checks a custom domain against the existing sites', () => {
    expect(checkCustomDomain('nodot')).toEqual({ available: false, reason: 'format' })
    expect(checkCustomDomain(websites.value[0]!.url)).toEqual({ available: false, reason: 'taken' })
    expect(checkCustomDomain('www.mynewvilla.com')).toEqual({ available: true })
  })
})
