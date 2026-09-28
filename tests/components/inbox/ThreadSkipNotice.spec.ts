import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AiSkipReasonDialog from '~/components/inbox/AiSkipReasonDialog.vue'
import ThreadSkipNotice from '~/components/inbox/ThreadSkipNotice.vue'

const template = {
  id: 'tpl-skipped-checkin-1',
  label: 'Check-in Instructions',
  icon: 'lucide:key-round',
  scheduledFor: '2026-04-26T09:00:00Z',
  status: 'skipped' as const,
  content: 'Hi Sarah! Check-in is from 15:00.',
  skipReason: {
    summary: 'Sarah already had the check-in details from chat.',
    explanation: 'Sarah asked what time check-in was and was answered in the thread.',
    decidedAt: '2026-04-26T09:00:00Z',
  },
}

function mountNotice() {
  return mount(ThreadSkipNotice, {
    props: { template },
    global: {
      components: { InboxAiSkipReasonDialog: AiSkipReasonDialog },
      stubs: {
        Icon: true,
        // Honours `open`, so a shut dialog renders nothing.
        Dialog: { props: ['open'], template: '<div v-if="open" data-testid="skip-dialog"><slot /></div>' },
        DialogContent: { template: '<div><slot /></div>' },
        DialogHeader: { template: '<div><slot /></div>' },
        DialogTitle: { template: '<div><slot /></div>' },
        DialogDescription: { template: '<div><slot /></div>' },
      },
    },
  })
}

describe('threadSkipNotice', () => {
  it('shows which template was skipped, with the reason behind the Why button only', () => {
    const wrapper = mountNotice()
    expect(wrapper.text()).toContain('ElevAI skipped Check-in Instructions')
    expect(wrapper.text()).toContain('Why was this skipped?')
    expect(wrapper.text()).not.toContain('Sarah already had the check-in details from chat.')
    expect(wrapper.find('[data-testid="skip-dialog"]').exists()).toBe(false)
  })

  it('opens the explanation with the held-back message and no send action', async () => {
    const wrapper = mountNotice()
    await wrapper.find('button').trigger('click')

    const dialog = wrapper.find('[data-testid="skip-dialog"]')
    expect(dialog.exists()).toBe(true)
    expect(dialog.text()).toContain('was answered in the thread')
    expect(dialog.text()).toContain('Hi Sarah! Check-in is from 15:00.')
    expect(dialog.text()).not.toContain('Send it anyway')
  })
})
