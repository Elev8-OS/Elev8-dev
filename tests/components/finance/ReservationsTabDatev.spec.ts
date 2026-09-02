// The Reservations row selection can be exported as a DATEV batch. The button
// counts only rows that survive the EUR gate, so the number on it always
// matches what lands in the file.

import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { exampleDatevSettings } from '~/components/finance/data/datev'
import DatevPreview from '~/components/finance/DatevPreview.vue'
import ReservationsTab from '~/components/finance/ReservationsTab.vue'
import { Button } from '~/components/ui/button'
import { useDatev } from '~/composables/useDatev'
import { useReservations } from '~/composables/useReservations'

const global = {
  components: { Button, FinanceDatevPreview: DatevPreview },
  config: { warnHandler: () => {} },
}

function mountTab() {
  // Auto-imported in Nuxt, absent in Vitest.
  vi.stubGlobal('useActiveIntegration', () => ({
    showConvertedColumn: { value: false },
    getAccountingAmount: () => null,
  }))
  vi.stubGlobal('useRoute', () => ({ query: {} }))
  vi.stubGlobal('useRouter', () => ({ replace: vi.fn() }))
  return mount(ReservationsTab, { global })
}

function datevButton(wrapper: ReturnType<typeof mount>) {
  return wrapper.findAll('button').find(b => /to DATEV/.test(b.text()))
}

/** Drives the component's own selection state the way a row checkbox would. */
async function select(wrapper: ReturnType<typeof mount>, ids: string[]) {
  const { reservations } = useReservations()
  for (const id of ids) {
    const row = reservations.value.find(r => r.id === id)!
    ;(wrapper.vm as any).toggleRow(row.id, row.checkIn)
  }
  await nextTick()
}

/** The selection export is gated on setup, so tests have to finish it first. */
function configure() {
  useDatev().saveSettings({
    ...exampleDatevSettings,
    channelAccounts: { ...exampleDatevSettings.channelAccounts },
  })
}

describe('reservationsTab — DATEV export', () => {
  beforeEach(() => {
    localStorage.clear()
    configure()
  })

  it('stays hidden while DATEV has not been set up', async () => {
    useDatev().resetSettings()
    const wrapper = mountTab()
    await select(wrapper, ['de-res-121', 'de-res-124'])

    expect(wrapper.text()).toContain('2 rows selected')
    expect(datevButton(wrapper)).toBeUndefined()
  })

  it('offers no DATEV action with nothing selected', () => {
    const wrapper = mountTab()
    expect(datevButton(wrapper)).toBeUndefined()
  })

  it('counts only EUR-eligible rows, not the raw selection', async () => {
    const wrapper = mountTab()
    // Two EUR bookings plus one CHF Bali booking.
    await select(wrapper, ['de-res-121', 'de-res-124', '86109494'])

    expect(wrapper.text()).toContain('3 rows selected')
    expect(datevButton(wrapper)!.text()).toContain('Export 2 to DATEV')
  })

  it('stays hidden when the selection holds no EUR bookings', async () => {
    const wrapper = mountTab()
    await select(wrapper, ['86109494'])

    expect(datevButton(wrapper)).toBeUndefined()
  })

  it('opens a reviewable file and reports what was left out', async () => {
    const wrapper = mountTab()
    await select(wrapper, ['de-res-121', '86109494'])
    await datevButton(wrapper)!.trigger('click')
    // generateFromSelection carries a mock latency before the dialog opens.
    await new Promise(r => setTimeout(r, 1000))
    await nextTick()

    const text = wrapper.text()
    expect(text).toContain('DATEV export — selected reservations')
    expect(text).toContain('Not a EUR-tagged listing (CHF)')
    expect(text).toContain('Buchungssätze')
  })

  // Regression: DialogContent defaults to the RESPONSIVE `sm:max-w-lg`, so an
  // unprefixed `max-w-5xl` loses to it above 640px and the preview overflows a
  // 512px dialog. The override has to carry the same `sm:` modifier.
  it('widens the review dialog with a responsive-matched class', () => {
    const wrapper = mountTab()
    const content = wrapper.find('dialogcontent')
    expect(content.exists()).toBe(true)

    const classes = content.attributes('class') ?? ''
    expect(classes).toContain('sm:max-w-5xl')
    expect(classes).not.toMatch(/(^|\s)max-w-5xl(\s|$)/)
  })
})
