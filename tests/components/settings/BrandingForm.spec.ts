import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import BrandingForm from '~/components/settings/BrandingForm.vue'
import { useTenantBranding } from '~/composables/useTenantBranding'

const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
}))
vi.mock('vue-sonner', () => ({ toast: toastMock }))

const ButtonStub = { props: ['disabled', 'type'], template: '<button :type="type" :disabled="disabled"><slot /></button>' }
const InputStub = {
  props: ['modelValue', 'type'],
  emits: ['update:modelValue'],
  template: '<input :type="type" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)">',
}

const globalOptions = {
  stubs: {
    Button: ButtonStub,
    Input: InputStub,
    Label: { template: '<label><slot /></label>' },
    Separator: { template: '<hr>' },
    Icon: true,
    BrandingAssetField: {
      props: ['kind'],
      emits: ['validationChange'],
      template: '<button type="button" data-testid="asset-validation" :data-kind="kind" @click="$emit(\'validationChange\', true)" />',
    },
  },
}

beforeEach(() => {
  vi.stubGlobal('localStorage', { getItem: vi.fn().mockReturnValue(null), setItem: vi.fn() })
  vi.stubGlobal('useRuntimeConfig', () => ({ app: { baseURL: '/dashboard/' } }))
  vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({}))
  toastMock.success.mockClear()
  toastMock.error.mockClear()
  toastMock.info.mockClear()
})

describe('BrandingForm', () => {
  it('saves normalized color changes and updates shared branding', async () => {
    const wrapper = mount(BrandingForm, { global: globalOptions })
    const primary = wrapper.get('[data-testid="primary-hex-input"]')
    await primary.setValue('#123abc')
    await wrapper.get('[data-testid="save-branding"]').trigger('click')
    await flushPromises()

    expect(useTenantBranding().branding.value.guestGuideColors.primary).toBe('#123ABC')
    expect(toastMock.success).toHaveBeenCalledWith('Branding saved')
  })

  it('shows a blocking error for invalid hex', async () => {
    const wrapper = mount(BrandingForm, { global: globalOptions })
    await wrapper.get('[data-testid="text-hex-input"]').setValue('black')
    expect(wrapper.text()).toContain('Use a six-digit hex value such as #18181B.')
    expect(wrapper.get('[data-testid="save-branding"]').attributes('disabled')).toBeDefined()
  })

  it('blocks saving while an asset field has a validation error', async () => {
    const wrapper = mount(BrandingForm, { global: globalOptions })
    await wrapper.get('[data-testid="primary-hex-input"]').setValue('#123456')
    await wrapper.get('[data-kind="primaryLogo"]').trigger('click')

    expect(wrapper.get('[data-testid="save-branding"]').attributes('disabled')).toBeDefined()
  })

  it('warns but still allows a low-contrast combination', async () => {
    const wrapper = mount(BrandingForm, { global: globalOptions })
    await wrapper.get('[data-testid="background-hex-input"]').setValue('#FFFFFF')
    await wrapper.get('[data-testid="text-hex-input"]').setValue('#EEEEEE')
    expect(wrapper.text()).toContain('Text and background contrast is below WCAG AA')
    expect(wrapper.get('[data-testid="save-branding"]').attributes('disabled')).toBeUndefined()
  })

  it('resets only the draft until Save changes is clicked', async () => {
    const { branding } = useTenantBranding()
    branding.value = { ...branding.value, guestGuideColors: { ...branding.value.guestGuideColors, primary: '#123456' } }
    const wrapper = mount(BrandingForm, { global: globalOptions })

    await wrapper.get('[data-testid="reset-branding"]').trigger('click')

    expect((wrapper.get('[data-testid="primary-hex-input"]').element as HTMLInputElement).value).toBe('#F6BB12')
    expect(branding.value.guestGuideColors.primary).toBe('#123456')
  })
})