// Owner portal — Bank Details. The page an owner uses to say where their
// money goes, and the guard that keeps it to their own record.

import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyPayoutDraft } from '~/components/owners/data/owner-payout-details'
import { useOwnerAuth } from '~/composables/useOwnerAuth'
import { useOwnerPayoutDetails } from '~/composables/useOwnerPayoutDetails'
import PayoutPage from '~/pages/owner-portal/payout.vue'

const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
}))

vi.mock('vue-sonner', () => ({ toast: toastMock }))

const IconStub = { props: ['name'], template: '<span :data-icon="name" aria-hidden="true" />' }

const globalOptions = {
  stubs: {
    Icon: IconStub,
    Label: { template: '<label><slot /></label>' },
    // No `emits: ['click']`: the parent handler already falls through onto
    // the stub root, so re-emitting would fire it twice.
    Button: {
      props: ['variant', 'disabled'],
      template: '<button :disabled="disabled"><slot /></button>',
    },
    Input: {
      props: ['modelValue'],
      emits: ['update:modelValue'],
      template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
    },
  },
}

function loginAs(ownerId: string) {
  useOwnerAuth().session.value = { ownerId, authenticatedAt: '2026-09-17T00:00:00.000Z' }
}

beforeEach(() => {
  toastMock.success.mockClear()
  toastMock.error.mockClear()
  vi.stubGlobal('definePageMeta', () => {})
  vi.stubGlobal('navigateTo', vi.fn())
})

async function typeInto(wrapper: ReturnType<typeof mount>, testId: string, value: string) {
  await wrapper.get(`[data-testid="${testId}"]`).setValue(value)
}

describe('owner portal bank details', () => {
  it('hydrates the form from what the owner already saved', async () => {
    loginAs('own-1')
    const wrapper = mount(PayoutPage, { global: globalOptions })
    await flushPromises()

    expect((wrapper.get('[data-testid="payout-holder"]').element as HTMLInputElement).value).toBe('Wayan Sari')
    expect((wrapper.get('[data-testid="payout-line1"]').element as HTMLInputElement).value)
      .toBe('Jl. Pantai Berawa No. 88')
    expect(wrapper.get('[data-testid="payout-status"]').text()).toMatch(/on file/i)
    expect(wrapper.find('[data-testid="payout-empty"]').exists()).toBe(false)
  })

  it('tells an owner with nothing on file that they cannot be paid yet', async () => {
    loginAs('own-2')
    const wrapper = mount(PayoutPage, { global: globalOptions })
    await flushPromises()

    expect(wrapper.get('[data-testid="payout-status"]').text()).toMatch(/no account/i)
    expect(wrapper.get('[data-testid="payout-empty"]').text()).toMatch(/cannot pay you out/i)
    expect((wrapper.get('[data-testid="payout-holder"]').element as HTMLInputElement).value).toBe('')
  })

  it('saves a complete account against the signed-in owner', async () => {
    loginAs('own-2')
    const { detailsFor, hasPayoutAccount } = useOwnerPayoutDetails()
    const wrapper = mount(PayoutPage, { global: globalOptions })
    await flushPromises()

    await typeInto(wrapper, 'payout-line1', 'Jl. Raya Ubud 12')
    await typeInto(wrapper, 'payout-city', 'Ubud')
    await typeInto(wrapper, 'payout-country', 'Indonesia')
    await typeInto(wrapper, 'payout-holder', 'I Putu Antara')
    await typeInto(wrapper, 'payout-bank', 'Bank Mandiri')
    await typeInto(wrapper, 'payout-account-no', '1450099887')
    await wrapper.get('[data-testid="payout-save"]').trigger('click')
    await flushPromises()

    const saved = detailsFor('own-2')
    expect(saved?.bankAccount?.accountHolder).toBe('I Putu Antara')
    expect(saved?.address?.city).toBe('Ubud')
    expect(hasPayoutAccount('own-2')).toBe(true)
    expect(toastMock.success).toHaveBeenCalled()
    // And it never touched the other owner's record.
    expect(detailsFor('own-1')?.bankAccount?.accountHolder).toBe('Wayan Sari')
  })

  it('refuses a mistyped IBAN and saves nothing', async () => {
    loginAs('own-3')
    const { detailsFor } = useOwnerPayoutDetails()
    const wrapper = mount(PayoutPage, { global: globalOptions })
    await flushPromises()

    await typeInto(wrapper, 'payout-line1', 'Jl. Melasti 4')
    await typeInto(wrapper, 'payout-city', 'Kuta')
    await typeInto(wrapper, 'payout-country', 'Indonesia')
    await typeInto(wrapper, 'payout-holder', 'Ni Kadek Deviani')
    await typeInto(wrapper, 'payout-bank', 'Credit Suisse')
    // A transposed pair: right length, right country, wrong checksum.
    await typeInto(wrapper, 'payout-iban', 'CH69 0076 1648 8692 1020 2')
    await wrapper.get('[data-testid="payout-save"]').trigger('click')
    await flushPromises()

    expect(detailsFor('own-3')).toBeUndefined()
    expect(wrapper.text()).toMatch(/IBAN is not valid/i)
    expect(toastMock.error).toHaveBeenCalled()
  })

  it('will not write anything without a portal session', () => {
    useOwnerAuth().logout()
    const { saveForCurrentOwner, payoutDetails } = useOwnerPayoutDetails()
    const before = payoutDetails.value.length

    const result = saveForCurrentOwner({
      ...createEmptyPayoutDraft(),
      line1: 'x',
      city: 'y',
      country: 'z',
      accountHolder: 'a',
      bankName: 'b',
      accountNumber: '1',
    })

    expect(result.ok).toBe(false)
    expect(result.ok === false && result.reason).toBe('no_session')
    expect(payoutDetails.value).toHaveLength(before)
  })
})
