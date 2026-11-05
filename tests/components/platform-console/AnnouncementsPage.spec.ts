import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import BannerCard from '~/components/platform-console/BannerCard.vue'
import AnnouncementsPage from '~/pages/announcements.vue'
import { Tabs } from '~/components/ui/tabs'
import { usePlatformBanners } from '~/composables/usePlatformBanners'

let wrapper: ReturnType<typeof mountPage> | null = null

function mountPage() {
  return mount(AnnouncementsPage, {
    attachTo: document.body,
    global: {
      components: { PlatformConsoleBannerCard: BannerCard },
      stubs: { Icon: true },
    },
  })
}

async function setTab(value: string) {
  wrapper!.findComponent(Tabs).vm.$emit('update:modelValue', value)
  await flushPromises()
}

describe('announcements page', () => {
  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
  })

  it('splits active from earlier with counts', async () => {
    wrapper = mountPage()
    const trigger = wrapper.text()
    expect(trigger).toMatch(/Active\s*\d/)
    expect(trigger).toMatch(/Earlier\s*1/)
    expect(wrapper.find('[data-testid="announcements-active"]').exists()).toBe(true)
    await setTab('earlier')
    expect(wrapper.get('[data-testid="announcements-earlier"]').text()).toContain('Resolved: Stripe webhook latency')
  })

  it('lists the upcoming maintenance window in the side panel', () => {
    wrapper = mountPage()
    const panel = wrapper.get('[data-testid="planned-maintenance"]').text()
    expect(panel).toContain('Planned maintenance: Inbox and Reviews')
    expect(panel).toContain('Inbox')
  })

  it('hides a banner from the dashboard and then flags it as dismissed', async () => {
    wrapper = mountPage()
    const hide = wrapper.findAll('button').find(b => b.text().includes('Hide from dashboard'))!
    expect(hide).toBeTruthy()
    await hide.trigger('click')
    expect(wrapper.text()).toContain('Dismissed from your dashboard')
  })

  it('shows an empty state when there is nothing active', async () => {
    const { banners } = usePlatformBanners()
    banners.value = banners.value.filter(b => b.status === 'expired')
    wrapper = mountPage()
    expect(wrapper.get('[data-testid="announcements-empty"]').text()).toContain('Nothing active')
  })
})
