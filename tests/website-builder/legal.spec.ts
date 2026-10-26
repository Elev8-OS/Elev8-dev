import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, ref } from 'vue'
import { newRuleSet } from '~/components/channels/data/website-channel'
import { COOKIE_POLICY_DRAFT, DEFAULT_CANCELLATION_POLICY, emptyWebsiteLegal, generateImpressumDraft, generateTermsDraft, legalFromWizard, preferredLanguage } from '~/components/website-builder/data/legal'
import { createDefaultReviewConfig } from '~/components/website-builder/data/review-config'
import { websites } from '~/components/website-builder/data/websites'
import WebsiteLegal from '~/components/website-builder/WebsiteLegal.vue'
import { useWebsiteSave } from '~/composables/useWebsiteSave'

const rules = {
  ...newRuleSet('site'),
  minNights: 3,
  maxNights: 14,
  minDaysBeforeArrival: 2,
  arrivalDays: [1, 5],
  departureDays: [0],
  prepaymentPct: 30,
  lengthOfStayDiscounts: [{ id: 'los-1', minNights: 7, pct: 10 }],
}

const legal = { operator: 'PT Villa Sunset', terms: {} }

describe('terms generator', () => {
  it('writes the site, operator, policy and contact into the document', () => {
    const html = generateTermsDraft({ siteName: 'Villa Sunset', legal, rules })
    expect(html).toContain('<strong>Villa Sunset</strong>')
    expect(html).toContain('PT Villa Sunset')
    expect(html).toContain(DEFAULT_CANCELLATION_POLICY)
  })

  it('writes the full company details into the Impressum', () => {
    const html = generateTermsDraft({
      siteName: 'Villa Sunset',
      legal: {
        ...legal,
        operator: 'Elevate',
        vatNumber: 'CHE-123.456.789',
        street: 'Im Füler 7',
        postalCode: '4616',
        city: 'Kappel',
        country: 'Switzerland',
      },
      rules,
    })
    expect(html).toContain('is operated by Elevate, Im Füler 7, 4616 Kappel, Switzerland.')
    expect(html).toContain('VAT / registration number: CHE-123.456.789.')
  })

  it('turns the booking rules into readable clauses', () => {
    const html = generateTermsDraft({ siteName: 'Villa Sunset', legal, rules })
    expect(html).toContain('30%')
    expect(html).toContain('minimum of 3 nights')
    expect(html).toContain('maximum of 14 nights')
    expect(html).toContain('2 days before arrival')
    expect(html).toContain('Monday')
    expect(html).toContain('Friday')
    expect(html).toContain('Sunday')
    expect(html).toContain('7+ nights')
    expect(html).toContain('10%')
  })

  it('omits booking clauses when the site has no rule set', () => {
    const html = generateTermsDraft({ siteName: 'Villa Sunset', legal })
    expect(html).not.toContain('Prepayment')
    expect(html).not.toContain('minimum of')
    expect(html).not.toContain('undefined')
    expect(html).not.toContain('0%')
  })

  it('leaks no empty list items and only allowlisted tags', () => {
    const html = generateTermsDraft({ siteName: 'Villa Sunset', legal, rules })
    expect(html).not.toContain('<li></li>')
    expect(html.match(/<\/?(p|strong|ul|li)\b/g)?.length).toBeGreaterThan(0)
    expect(html).not.toMatch(/<\/?(h[1-6]|div|span|script)\b/i)
  })

  it('escapes user text instead of injecting markup', () => {
    const html = generateTermsDraft({ siteName: 'Villa <Sunset>', legal: { ...legal, operator: 'A & B' }, rules })
    expect(html).toContain('Villa &lt;Sunset&gt;')
    expect(html).toContain('A &amp; B')
    expect(html).not.toContain('<Sunset>')
  })

  it('is deterministic', () => {
    expect(generateTermsDraft({ siteName: 'Villa Sunset', legal, rules }))
      .toBe(generateTermsDraft({ siteName: 'Villa Sunset', legal, rules }))
  })
})

describe('legal data helpers', () => {
  it('starts empty with no terms', () => {
    expect(emptyWebsiteLegal()).toEqual({ terms: {} })
  })

  it('builds the Impressum from the company details, line per detail', () => {
    const html = generateImpressumDraft({
      operator: 'Elevate',
      vatNumber: 'CHE-123.456.789',
      street: 'Im Füler 7',
      postalCode: '4616',
      city: 'Kappel',
      country: 'Switzerland',
      terms: {},
    })
    expect(html).toContain('<strong>Elevate</strong>')
    expect(html).toContain('Im Füler 7, 4616 Kappel, Switzerland')
    expect(html).toContain('CHE-123.456.789')
    expect(html).not.toContain('hello@elevater.ch')
  })

  it('leaves the Impressum empty when no company detail is set', () => {
    expect(generateImpressumDraft(undefined)).toBe('')
    expect(generateImpressumDraft({ terms: {} })).toBe('')
  })

  it('has a fixed auto-generated cookie policy', () => {
    expect(COOKIE_POLICY_DRAFT).toContain('cookies')
  })

  it('picks the default language when it is offered', () => {
    expect(preferredLanguage(['en', 'de'], 'de')).toBe('de')
    expect(preferredLanguage(['en', 'de'], 'fr')).toBe('en')
    expect(preferredLanguage(undefined, undefined)).toBe('en')
  })

  it('carries the wizard legal answers into the site', () => {
    const full = {
      legalCompany: 'Elevate',
      legalVatNumber: 'CHE-123.456.789',
      legalStreet: 'Im Füler 7',
      legalPostalCode: '4616',
      legalCity: 'Kappel',
      legalCountry: 'Switzerland',
    }
    expect(legalFromWizard(full)).toEqual({
      operator: full.legalCompany,
      vatNumber: full.legalVatNumber,
      street: full.legalStreet,
      postalCode: full.legalPostalCode,
      city: full.legalCity,
      country: full.legalCountry,
      terms: {},
    })
    expect(legalFromWizard({ ...full, legalCompany: '  PT Villa  ', legalStreet: '' })).toEqual({
      operator: 'PT Villa',
      vatNumber: full.legalVatNumber,
      postalCode: full.legalPostalCode,
      city: full.legalCity,
      country: full.legalCountry,
      terms: {},
    })
    expect(legalFromWizard({ ...full, legalCompany: '', legalVatNumber: '', legalStreet: '', legalPostalCode: '', legalCity: '', legalCountry: '' })).toEqual({ terms: {} })
  })
})

describe('saving legal', () => {
  const original = JSON.parse(JSON.stringify(websites.value))
  afterEach(() => { websites.value = original })

  it('stores the terms and stamps updatedAt', () => {
    const { saveWebsite } = useWebsiteSave()
    const id = saveWebsite({
      template: null,
      settings: {
        name: 'Villa Legal',
        domain: 'villa-legal.com',
        description: '',
        brandColor: '#000',
        fontFamily: 'Inter',
        logoFile: null,
        faviconFile: null,
        useDefaultFavicon: false,
        legal: { operator: 'PT Villa', terms: { en: '<p>My terms</p>' } },
      },
      property: { propertyIds: ['prop-1'], roomIds: [] },
      reviews: { selectedReviewIds: [], featuredReviewIds: [], manualReviews: [], featuredManualReviewIds: [], config: createDefaultReviewConfig() },
    }, 'draft')!
    const saved = websites.value.find(w => w.id === id)!
    expect(saved.legal?.terms.en).toBe('<p>My terms</p>')
    expect(saved.legal?.operator).toBe('PT Villa')
    expect(saved.legal?.updatedAt).toBeTruthy()
  })

  it('leaves legal untouched when the draft has none', () => {
    const { saveWebsite } = useWebsiteSave()
    const id = saveWebsite({
      template: null,
      settings: {
        name: 'Villa No Legal',
        domain: 'villa-no-legal.com',
        description: '',
        brandColor: '#000',
        fontFamily: 'Inter',
        logoFile: null,
        faviconFile: null,
        useDefaultFavicon: false,
      },
      property: { propertyIds: ['prop-1'], roomIds: [] },
      reviews: { selectedReviewIds: [], featuredReviewIds: [], manualReviews: [], featuredManualReviewIds: [], config: createDefaultReviewConfig() },
    }, 'draft')!
    expect(websites.value.find(w => w.id === id)!.legal).toBeUndefined()
  })
})

describe('legal section', () => {
  const passthrough = { template: '<div><slot /></div>' }
  const RichTextStub = {
    props: ['modelValue'],
    emits: ['update:modelValue'],
    template: `<textarea data-testid="rich-text-stub" :value="modelValue"
      @input="$emit('update:modelValue', $event.target.value)" />`,
  }
  const global = {
    stubs: {
      Icon: true,
      Button: { template: '<button><slot /></button>' },
      Input: { props: ['modelValue'], template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)">' },
      Textarea: { props: ['modelValue'], template: '<textarea :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />' },
      Label: passthrough,
      AlertDialog: { props: ['open'], template: '<div v-if="open"><slot /></div>' },
      AlertDialogContent: passthrough,
      AlertDialogTitle: passthrough,
      AlertDialogDescription: passthrough,
      AlertDialogFooter: passthrough,
      AlertDialogCancel: passthrough,
      AlertDialogAction: { template: '<button><slot /></button>' },
      RichTextEditor: RichTextStub,
    },
    config: { warnHandler: () => {} },
  }

  function baseSettings(extra: Record<string, unknown> = {}) {
    return {
      name: 'Villa Sunset',
      domain: 'villa.com',
      description: '',
      brandColor: '#000',
      fontFamily: 'Inter',
      logoFile: null,
      faviconFile: null,
      useDefaultFavicon: false,
      rules: newRuleSet('site'),
      languages: ['en', 'de'],
      defaultLanguage: 'en',
      ...extra,
    }
  }

  function mountLegal(extra: Record<string, unknown> = {}) {
    const settings = ref(baseSettings(extra))
    const wrapper = mount(defineComponent({
      components: { WebsiteLegal },
      setup: () => ({ settings }),
      template: '<WebsiteLegal v-model:settings="settings" />',
    }), { global })
    return { wrapper, settings, child: wrapper.findComponent(WebsiteLegal) }
  }
  const lastLegal = (settings: { value: { legal?: { terms: Record<string, string>, operator?: string, vatNumber?: string, street?: string, postalCode?: string, city?: string, country?: string, impressum?: string, cookiePolicy?: string, cookieBanner?: boolean } } }) =>
    settings.value.legal!

  it('generates a draft in the default language when the site has none', async () => {
    const { wrapper, settings } = mountLegal()
    await flushPromises()
    const terms = lastLegal(settings).terms
    expect(terms.en).toContain('Villa Sunset')
    expect(wrapper.find('[data-testid="wl-generated-note"]').exists()).toBe(true)
  })

  it('edits the current language without touching the other', async () => {
    const { wrapper, settings } = mountLegal({ legal: { terms: { en: '<p>English</p>', de: '<p>Deutsch</p>' } } })
    await wrapper.get('[data-testid="wl-terms-editor"] [data-testid="rich-text-stub"]').setValue('<p>Edited</p>')
    expect(lastLegal(settings).terms.en).toBe('<p>Edited</p>')
    expect(lastLegal(settings).terms.de).toBe('<p>Deutsch</p>')
  })

  it('generates into a language that has no document yet', async () => {
    const { wrapper, settings } = mountLegal({ legal: { terms: { en: '<p>English</p>' } } })
    await wrapper.get('[data-testid="wl-lang-de"]').trigger('click')
    expect(wrapper.find('[data-testid="wl-generate"]').exists()).toBe(true)
    await wrapper.get('[data-testid="wl-generate"]').trigger('click')
    expect(lastLegal(settings).terms.de).toContain('Villa Sunset')
    expect(lastLegal(settings).terms.en).toBe('<p>English</p>')
  })

  it('asks before replacing edited terms, then replaces them', async () => {
    const { wrapper, settings } = mountLegal({ legal: { terms: { en: '<p>My custom terms</p>' } } })
    await wrapper.get('[data-testid="wl-regenerate"]').trigger('click')
    expect(wrapper.find('[data-testid="wl-regenerate-confirm"]').exists()).toBe(true)
    await wrapper.get('[data-testid="wl-regenerate-confirm"]').trigger('click')
    expect(lastLegal(settings).terms.en).toContain('Villa Sunset')
    expect(lastLegal(settings).terms.en).not.toContain('My custom terms')
  })

  it('does not ask when the document is still the generated draft', async () => {
    const { wrapper } = mountLegal()
    await flushPromises()
    await wrapper.get('[data-testid="wl-regenerate"]').trigger('click')
    expect(wrapper.find('[data-testid="wl-regenerate-confirm"]').exists()).toBe(false)
  })

  it('patches legal details and asks the editor to save', async () => {
    const { wrapper, settings, child } = mountLegal()
    await wrapper.get('[data-testid="wl-operator"]').setValue('Elevate')
    await wrapper.get('[data-testid="wl-vat"]').setValue('CHE-123.456.789')
    await wrapper.get('[data-testid="wl-street"]').setValue('Im Füler 7')
    await wrapper.get('[data-testid="wl-postal"]').setValue('4616')
    await wrapper.get('[data-testid="wl-city"]').setValue('Kappel')
    await wrapper.get('[data-testid="wl-country"]').setValue('Switzerland')
    const legal = lastLegal(settings)
    expect(legal.operator).toBe('Elevate')
    expect(legal.vatNumber).toBe('CHE-123.456.789')
    expect(legal.street).toBe('Im Füler 7')
    expect(legal.postalCode).toBe('4616')
    expect(legal.city).toBe('Kappel')
    expect(legal.country).toBe('Switzerland')
    await wrapper.get('[data-testid="wl-save"]').trigger('click')
    expect(child.emitted('save')![0]).toEqual(['Legal changes saved'])
  })

  it('writes the custom impressum and hides the auto preview', async () => {
    const { wrapper, settings } = mountLegal({ legal: { terms: { en: '<p>T</p>' } } })
    expect(wrapper.find('[data-testid="wl-impressum-preview"]').exists()).toBe(true)
    await wrapper.get('[data-testid="wl-impressum"] [data-testid="rich-text-stub"]').setValue('<p>Elevate GmbH</p>')
    expect(lastLegal(settings).impressum).toBe('<p>Elevate GmbH</p>')
    expect(wrapper.find('[data-testid="wl-impressum-preview"]').exists()).toBe(false)
  })

  it('writes the cookie policy and hides the auto preview', async () => {
    const { wrapper, settings } = mountLegal({ legal: { terms: { en: '<p>T</p>' } } })
    expect(wrapper.find('[data-testid="wl-cookie-policy-preview"]').exists()).toBe(true)
    await wrapper.get('[data-testid="wl-cookie-policy"] [data-testid="rich-text-stub"]').setValue('<p>Only essential cookies.</p>')
    expect(lastLegal(settings).cookiePolicy).toBe('<p>Only essential cookies.</p>')
    expect(wrapper.find('[data-testid="wl-cookie-policy-preview"]').exists()).toBe(false)
  })

  it('toggles the cookie consent banner', async () => {
    const { wrapper, settings } = mountLegal()
    expect(wrapper.get('[data-testid="wl-banner"]').attributes('aria-checked')).toBe('false')
    await wrapper.get('[data-testid="wl-banner"]').trigger('click')
    expect(lastLegal(settings).cookieBanner).toBe(true)
    expect(wrapper.get('[data-testid="wl-banner"]').attributes('aria-checked')).toBe('true')
  })
})
