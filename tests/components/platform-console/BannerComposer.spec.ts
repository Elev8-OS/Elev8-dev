import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import BannerComposer from '~/components/platform-console/BannerComposer.vue'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Switch } from '~/components/ui/switch'
import { Textarea } from '~/components/ui/textarea'
import { useStaffAuth } from '~/composables/useStaffAuth'
import { usePlatformBanners } from '~/composables/usePlatformBanners'

// The composer reads these as Nuxt auto-imports.
;(globalThis as any).useStaffAuth = useStaffAuth
;(globalThis as any).createError = (e: any) => new Error(e.statusMessage)

const passthrough = { template: '<div><slot /></div>' }
const RadioGroup = {
  name: 'RadioGroup',
  props: ['modelValue'],
  emits: ['update:modelValue'],
  template: '<div><slot /></div>',
}
const DateStub = {
  props: ['modelValue'],
  emits: ['update:modelValue'],
  template: '<input class="date" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)">',
}
const TimeStub = {
  props: ['modelValue'],
  emits: ['update:modelValue'],
  template: '<input class="time" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)">',
}

function mountComposer() {
  return mount(BannerComposer, {
    global: {
      components: {
        Button,
        Input,
        Label,
        Switch,
        Textarea,
        RadioGroup,
        RadioGroupItem: { template: '<span />' },
        Select: passthrough,
        SelectTrigger: passthrough,
        SelectValue: passthrough,
        SelectContent: passthrough,
        SelectItem: passthrough,
        BaseDatePicker: DateStub,
        BaseTimePicker: TimeStub,
        PlatformConsoleBannerTargetingControl: { template: '<div />' },
        PlatformConsoleBannerCard: { props: ['banner'], template: '<div data-testid="preview-card">{{ banner.title }}|{{ banner.body }}</div>' },
      },
      stubs: { Icon: true },
    },
  })
}

type Wrapper = ReturnType<typeof mountComposer>

async function clickButton(w: Wrapper, label: string) {
  await w.findAll('button').find(b => b.text().includes(label))!.trigger('click')
}

async function fillStep1(w: Wrapper, kind: 'announcement' | 'maintenance') {
  await w.get(`[data-testid="kind-${kind}"]`).trigger('click')
  await w.get('input').setValue('Planned maintenance')
  await w.get('textarea').setValue('Inbox is offline for a short while.')
}

async function toStep3(w: Wrapper, kind: 'announcement' | 'maintenance') {
  await fillStep1(w, kind)
  await clickButton(w, 'Next')
  await clickButton(w, 'Next')
}

async function setWindow(w: Wrapper, startDate: string) {
  const dates = w.findAll('[data-testid="maintenance-fields"] input.date')
  await dates[0]!.setValue(startDate)
  await flushPromises()
}

describe('bannerComposer', () => {
  beforeEach(() => {
    const { banners } = usePlatformBanners()
    banners.value = []
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('blocks step 3 until a maintenance window and an affected area are set', async () => {
    const w = mountComposer()
    await toStep3(w, 'maintenance')
    expect(w.get('[data-testid="schedule-error"]').text()).toContain('window starts and ends')
    const next = w.findAll('button').find(b => b.text().includes('Next'))!
    expect(next.attributes('disabled')).toBeDefined()

    await setWindow(w, '2099-01-10')
    expect(w.get('[data-testid="schedule-error"]').text()).toContain('affected area')

    await clickButton(w, 'Inbox')
    expect(w.find('[data-testid="schedule-error"]').exists()).toBe(false)
  })

  it('refuses a window that has already started', async () => {
    const w = mountComposer()
    await toStep3(w, 'maintenance')
    await setWindow(w, '2000-01-10')
    await clickButton(w, 'Inbox')
    expect(w.get('[data-testid="schedule-error"]').text()).toContain('start in the future')
  })

  it('publishes a maintenance notice with the window converted to UTC', async () => {
    const w = mountComposer()
    await toStep3(w, 'maintenance')
    await setWindow(w, '2099-01-10')
    await clickButton(w, 'Inbox')
    await clickButton(w, 'Next')
    expect(w.get('[data-testid="preview-card"]').exists()).toBe(true)
    await clickButton(w, 'Publish now')

    const { banners } = usePlatformBanners()
    expect(banners.value).toHaveLength(1)
    const b = banners.value[0]!
    expect(b.kind).toBe('maintenance')
    expect(b.status).toBe('live')
    expect(b.severity).toBe('warning')
    expect(b.maintenance).toMatchObject({
      startAt: '2099-01-10T02:00:00.000Z',
      endAt: '2099-01-10T02:30:00.000Z',
      affected: ['Inbox'],
      impact: 'offline',
    })
    // Stays up an hour past the window.
    expect(b.endAt).toBe('2099-01-10T03:30:00.000Z')
    expect(w.emitted('published')).toHaveLength(1)
  })

  it('re-checks the window at publish and returns to the schedule step if it has passed', async () => {
    const w = mountComposer()
    await toStep3(w, 'maintenance')
    await setWindow(w, '2099-01-10')
    await clickButton(w, 'Inbox')
    await clickButton(w, 'Next')
    // Staff leave the preview open until the window start is behind them.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2099-01-10T03:00:00.000Z'))
    await clickButton(w, 'Publish now')
    expect(usePlatformBanners().banners.value).toHaveLength(0)
    expect(w.emitted('published')).toBeUndefined()
    expect(w.get('[data-testid="schedule-error"]').text()).toContain('start in the future')
  })

  it('schedules the banner for later and says so on the button', async () => {
    const w = mountComposer()
    await toStep3(w, 'maintenance')
    await setWindow(w, '2099-01-10')
    await clickButton(w, 'Inbox')

    w.findComponent({ name: 'RadioGroup' }).vm.$emit('update:modelValue', 'later')
    await flushPromises()
    expect(w.get('[data-testid="schedule-error"]').text()).toContain('date and time the banner should appear')

    await w.get('[data-testid="show-later-fields"] input.date').setValue('2099-01-08')
    await clickButton(w, 'Next')
    expect(w.findAll('button').some(b => b.text() === 'Schedule banner')).toBe(true)
    await clickButton(w, 'Schedule banner')

    const b = usePlatformBanners().banners.value[0]!
    expect(b.status).toBe('scheduled')
    expect(b.startAt).toBe('2099-01-08T09:00:00.000Z')
  })

  it('rejects a banner that appears after its maintenance window starts', async () => {
    const w = mountComposer()
    await toStep3(w, 'maintenance')
    await setWindow(w, '2099-01-10')
    await clickButton(w, 'Inbox')
    w.findComponent({ name: 'RadioGroup' }).vm.$emit('update:modelValue', 'later')
    await flushPromises()
    await w.get('[data-testid="show-later-fields"] input.date').setValue('2099-01-11')
    expect(w.get('[data-testid="schedule-error"]').text()).toContain('before the window starts')
  })

  it('publishes a plain announcement with no expiry when auto-expire has no date', async () => {
    const w = mountComposer()
    await toStep3(w, 'announcement')
    expect(w.get('[data-testid="schedule-error"]').text()).toContain('expires')
    // Turning auto-expire off clears the error.
    const sw = w.findAllComponents(Switch).at(-1)!
    sw.vm.$emit('update:modelValue', false)
    await flushPromises()
    expect(w.find('[data-testid="schedule-error"]').exists()).toBe(false)
    await clickButton(w, 'Next')
    await clickButton(w, 'Publish now')
    const b = usePlatformBanners().banners.value[0]!
    expect(b.kind).toBe('announcement')
    expect(b.endAt).toBeUndefined()
    expect(b.maintenance).toBeUndefined()
  })

  it('follows severity for the email switch and warns on the preview', async () => {
    const w = mountComposer()
    await fillStep1(w, 'announcement')
    await clickButton(w, 'critical')
    expect(w.findAllComponents(Switch).at(-1)!.props('modelValue')).toBe(true)
    await clickButton(w, 'Next')
    await clickButton(w, 'Next')
    await w.findAllComponents(Switch).at(-1)!.vm.$emit('update:modelValue', false)
    await flushPromises()
    await clickButton(w, 'Next')
    expect(w.find('[data-testid="email-warning"]').exists()).toBe(true)
  })

  it('shows a live preview from the first step, with placeholders until staff type', async () => {
    const w = mountComposer()
    expect(w.get('[data-testid="preview-card"]').text()).toContain('Your title appears here')
    await w.get('input').setValue('Heads up')
    await w.get('textarea').setValue('Short notice.')
    expect(w.get('[data-testid="preview-card"]').text()).toBe('Heads up|Short notice.')
  })

  it('lets staff go back by clicking a finished step, but not jump ahead', async () => {
    const w = mountComposer()
    await fillStep1(w, 'announcement')
    expect(w.get('[data-testid="step-2"]').attributes('disabled')).toBeDefined()
    await clickButton(w, 'Next')
    expect(w.get('[data-testid="step-1"]').attributes('disabled')).toBeUndefined()
    expect(w.get('[data-testid="step-2"]').attributes('aria-current')).toBe('step')
    await w.get('[data-testid="step-1"]').trigger('click')
    expect(w.get('[data-testid="step-1"]').attributes('aria-current')).toBe('step')
    expect(w.find('[data-testid="kind-announcement"]').exists()).toBe(true)
  })

  it('summarises the broadcast on the review step', async () => {
    const w = mountComposer()
    await toStep3(w, 'maintenance')
    await setWindow(w, '2099-01-10')
    await clickButton(w, 'Inbox')
    await clickButton(w, 'Next')
    const summary = w.get('[data-testid="review-summary"]').text()
    expect(summary).toContain('Maintenance')
    expect(summary).toContain('Inbox')
    expect(summary).toContain('Immediately')
    expect(summary).toMatch(/Tenants\s*9/)
  })
})
