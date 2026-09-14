import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import InboxPaymentCard from '~/components/inbox/InboxPaymentCard.vue'

const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
}))
vi.mock('vue-sonner', () => ({ toast: toastMock }))

const stubs = {
  Badge: { template: '<span><slot /></span>' },
  Button: { template: '<button><slot /></button>' },
  Icon: true,
}

describe('InboxPaymentCard', () => {
  it('renders pending payment request with amount and action buttons', () => {
    const wrapper = mount(InboxPaymentCard, {
      props: {
        paymentRequest: {
          id: 'pr-test-101',
          title: 'Reservation #res-101',
          amount: 500,
          currency: 'USD',
          feeAmount: 15,
          totalAmount: 515,
          status: 'pending',
          paymentLink: 'https://pay.elev8.co/r/pr-test-101',
          expiresAt: '2026-10-15T12:00:00Z',
        },
        conversationId: 'conv-101',
      },
      global: { stubs },
    })

    expect(wrapper.text()).toContain('Reservation #res-101')
    expect(wrapper.text()).toContain('pr-test-101')
    expect(wrapper.text()).toContain('Payment Pending')
    expect(wrapper.text()).toContain('USD 500.00')
    expect(wrapper.text()).toContain('USD 15.00')
    expect(wrapper.text()).toContain('USD 515.00')
    expect(wrapper.text()).toContain('Pay Now')
    expect(wrapper.text()).toContain('Copy Link')
  })

  it('renders confirmed state when status is paid', () => {
    const wrapper = mount(InboxPaymentCard, {
      props: {
        paymentRequest: {
          id: 'pr-test-102',
          title: 'Reservation #res-102',
          amount: 800,
          currency: 'USD',
          totalAmount: 800,
          status: 'paid',
          paymentLink: 'https://pay.elev8.co/r/pr-test-102',
          expiresAt: '2026-10-15T12:00:00Z',
        },
        conversationId: 'conv-102',
      },
      global: { stubs },
    })

    expect(wrapper.text()).toContain('Paid')
    expect(wrapper.text()).toContain('Payment Confirmed')
  })
})
