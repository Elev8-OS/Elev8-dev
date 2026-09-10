// The guest detail page raises a payment request for a guest it already knows,
// so the dialog takes an optional `initialGuest`. Without it the dialog must
// behave exactly as it did before, opening on its own guest search.

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import PaymentRequestCreateDialog from '~/components/payment-request/PaymentRequestCreateDialog.vue'

/**
 * The dialog pulls in a lot of chrome (popovers, a fee calculator, selects), and
 * none of it is what these tests are about. Shallow-mounting with default slots
 * rendered keeps the guest trigger's own text reachable.
 */
async function openDialog(initialGuest?: { name: string, email: string, phone?: string }) {
  const wrapper = mount(PaymentRequestCreateDialog, {
    props: { open: false, initialGuest },
    shallow: true,
    global: { renderStubDefaultSlot: true },
  })

  await wrapper.setProps({ open: true })
  await nextTick()
  return wrapper
}

describe('paymentRequestCreateDialog guest prefill', () => {
  it('shows the guest it was given instead of the search placeholder', async () => {
    const wrapper = await openDialog({ name: 'Emily Chen', email: 'emily.chen@email.com' })

    expect(wrapper.text()).toContain('Emily Chen')
    expect(wrapper.text()).not.toContain('Search guest...')
  })

  it('still opens on its own guest search when given no guest', async () => {
    const wrapper = await openDialog()

    expect(wrapper.text()).toContain('Search guest...')
  })

  it('re-applies the prefill on reopen rather than inheriting the last attempt', async () => {
    const wrapper = await openDialog({ name: 'Emily Chen', email: 'emily.chen@email.com' })

    await wrapper.setProps({ open: false })
    await nextTick()
    await wrapper.setProps({ open: true })
    await nextTick()

    expect(wrapper.text()).toContain('Emily Chen')
  })
})
