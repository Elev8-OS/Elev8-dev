import type { CleaningFeedback } from '~/components/cleaning/data/cleaning-jobs'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import CleaningReportPanel from '~/components/operations-calendar/CleaningReportPanel.vue'
import { Button } from '~/components/ui/button'
import { useImageViewer } from '~/composables/useImageViewer'

function feedback(items: NonNullable<CleaningFeedback['checklist']>[number]['items']): CleaningFeedback {
  return {
    supervisorName: 'Made Surya',
    checklist: [{ id: 'bath', title: 'Bathroom', items }],
    cleanlinessRating: 4,
    conditionNotes: '',
    damages: [],
    itemsLeft: [],
    cleaningDurationMinutes: 90,
    housekeeperNotes: '',
  }
}

async function mountPanel(fb: CleaningFeedback) {
  const wrapper = mount(CleaningReportPanel, {
    props: { feedback: fb, isCheckoutCleaning: false },
    global: {
      components: { Button },
      stubs: {
        Icon: true,
        // Passthrough, so every tab's content renders and can be asserted on.
        Tabs: { template: '<div><slot /></div>' },
        TabsList: { template: '<div><slot /></div>' },
        TabsTrigger: { template: '<button><slot /></button>' },
        TabsContent: { template: '<div><slot /></div>' },
        Dialog: { props: ['open'], template: '<div v-if="open"><slot /></div>' },
        DialogContent: { template: '<div data-testid="image-viewer"><slot /></div>' },
        DialogHeader: { template: '<div><slot /></div>' },
        DialogTitle: { template: '<div><slot /></div>' },
        DialogDescription: { template: '<div><slot /></div>' },
      },
    },
  })
  // The groups open in onMounted, and their items render only once open.
  await nextTick()
  return wrapper
}

describe('cleaningReportPanel checklist', () => {
  it('labels an OK line in green and a Problem in red', async () => {
    const wrapper = await mountPanel(feedback([
      { id: 'ok-1', label: 'Clean basin', status: 'ok' },
      { id: 'pr-1', label: 'Check shower', status: 'problem', notes: 'Screen cracked', photoUrls: ['/p/screen.jpg'] },
    ]))
    const ok = wrapper.find('[data-testid="checklist-item-ok-1"]')
    const problem = wrapper.find('[data-testid="checklist-item-pr-1"]')
    expect(ok.text()).toContain('OK')
    expect(ok.html()).toContain('text-emerald-700')
    expect(problem.text()).toContain('Problem')
    expect(problem.classes()).toContain('border-destructive/50')
    expect(problem.html()).toContain('text-destructive')
  })

  it('shows a problem\'s photos', async () => {
    const wrapper = await mountPanel(feedback([
      { id: 'pr-1', label: 'Check shower', status: 'problem', notes: 'Screen cracked', photoUrls: ['/p/a.jpg', '/p/b.jpg'] },
    ]))
    const photos = wrapper.findAll('[data-testid="checklist-problem-photo"]')
    expect(photos.map(p => p.attributes('src'))).toEqual(['/p/a.jpg', '/p/b.jpg'])
    expect(wrapper.find('[data-testid="checklist-problem-no-photo"]').exists()).toBe(false)
  })

  it('opens a problem photo full size in the panel\'s own viewer', async () => {
    const wrapper = await mountPanel(feedback([
      { id: 'pr-1', label: 'Check shower', status: 'problem', notes: 'Screen cracked', photoUrls: ['/p/screen.jpg'], completedBy: 'Made Surya' },
    ]))
    expect(wrapper.find('a').exists()).toBe(false)
    await wrapper.find('[data-testid="checklist-problem-photo-open"]').trigger('click')
    expect(useImageViewer('cleaning-report').viewedImage.value).toMatchObject({
      url: '/p/screen.jpg',
      caption: 'Screen cracked',
      senderName: 'Made Surya',
    })
    expect(wrapper.find('[data-testid="image-viewer"] img').attributes('src')).toBe('/p/screen.jpg')
  })

  it('flags a problem that arrived without its required photo', async () => {
    const wrapper = await mountPanel(feedback([
      { id: 'pr-1', label: 'Check shower', status: 'problem', notes: 'Screen cracked' },
    ]))
    expect(wrapper.find('[data-testid="checklist-problem-no-photo"]').text()).toContain('A problem must carry one')
    expect(wrapper.find('[data-testid="checklist-problem-count"]').text()).toMatch(/1 problem reported\s*, 1 without the required photo/)
  })

  it('falls back to a stated placeholder when a photo cannot load', async () => {
    const wrapper = await mountPanel(feedback([
      { id: 'pr-1', label: 'Check shower', status: 'problem', photoUrls: ['/p/dead.jpg'] },
    ]))
    await wrapper.find('[data-testid="checklist-problem-photo"]').trigger('error')
    expect(wrapper.find('[data-testid="checklist-problem-photo"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Photo unavailable')
  })

  it('counts nothing when every line is OK', async () => {
    const wrapper = await mountPanel(feedback([{ id: 'ok-1', label: 'Clean basin', status: 'ok' }]))
    expect(wrapper.find('[data-testid="checklist-problem-count"]').exists()).toBe(false)
  })
})
