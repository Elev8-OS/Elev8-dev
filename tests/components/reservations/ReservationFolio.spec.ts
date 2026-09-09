import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import FolioAddItemDialog from '~/components/reservations/FolioAddItemDialog.vue'
import FolioVoidDialog from '~/components/reservations/FolioVoidDialog.vue'
import ReservationFolioSection from '~/components/reservations/ReservationFolioSection.vue'
import { initialReservations } from '~/components/reservations/data/reservations'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '~/components/ui/accordion'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '~/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '~/components/ui/dropdown-menu'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { ScrollArea } from '~/components/ui/scroll-area'
import { Separator } from '~/components/ui/separator'
import { Textarea } from '~/components/ui/textarea'

/**
 * The shadcn primitives must be registered or an unresolved `Input` renders as a
 * bare element whose model-value never becomes the DOM value, and every value
 * assertion passes vacuously. The Dialog parts matter just as much: the dialog
 * components have `<Dialog>` as their root, so without it they render nothing.
 */
const components = {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  ScrollArea,
  Separator,
  Textarea,
  Icon: { template: '<i />' },
}

/**
 * `DialogContent` renders through reka-ui's `DialogPortal`, which is a real
 * Vue `Teleport` — not something `stubs: { Teleport: true }` can keep in
 * place, since that stub replaces the teleported subtree with an empty
 * `<teleport-stub>` rather than rendering the slot content inline. So the
 * whole dialog body (header, catalog, form, footer) actually lands as a
 * sibling of the test root in `document.body`, the same way the portalled
 * `Select` does in `AddCleaningAssignee.spec.ts`. Every assertion below reads
 * off `document.body` through a `DOMWrapper` rather than off `wrapper`
 * directly, and each mount awaits `flushPromises()` once so the portal has
 * actually landed before the first assertion runs.
 */
function body() {
  return new DOMWrapper(document.body)
}

async function mountDialog(reservationId = 'res-3') {
  const reservation = initialReservations.find(r => r.id === reservationId)!
  const wrapper = mount(FolioAddItemDialog, {
    props: { open: true, reservation },
    global: { components },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('FolioAddItemDialog', () => {
  it('lists catalog rows for the reservation property', async () => {
    await mountDialog()

    expect(body().text()).toContain('Airport Transfer')
    expect(body().text()).toContain('Standard Sedan')
  })

  it('marks a cross-currency row and does not copy its price', async () => {
    await mountDialog()

    // res-3 is USD; the seeded services are IDR.
    expect(body().text()).toContain('Priced in IDR')

    await body().findAll('[data-testid="folio-catalog-row"]')[0]!.trigger('click')
    await nextTick()

    const price = body().find('[data-testid="folio-unit-price"]')
    expect((price.element as HTMLInputElement).value).toBe('')
    expect(body().text()).toContain('Enter the amount in USD')
  })

  it('focuses the unit price input after picking a cross-currency catalog row', async () => {
    await mountDialog()

    ;(document.activeElement as HTMLElement | null)?.blur()

    await body().findAll('[data-testid="folio-catalog-row"]')[0]!.trigger('click')
    await nextTick()

    expect(document.activeElement).toBe(body().find('[data-testid="folio-unit-price"]').element)
  })

  it('carries the label and both percentages over from a catalog pick', async () => {
    await mountDialog()

    await body().findAll('[data-testid="folio-catalog-row"]')[0]!.trigger('click')
    await nextTick()

    expect((body().find('[data-testid="folio-label"]').element as HTMLInputElement).value).toContain('Standard Sedan')
    expect((body().find('[data-testid="folio-tax"]').element as HTMLInputElement).value).toBe('11')
    expect((body().find('[data-testid="folio-service"]').element as HTMLInputElement).value).toBe('5')
  })

  it('filters the catalog by the search query', async () => {
    await mountDialog()

    await body().find('[data-testid="folio-catalog-search"]').setValue('sedan')
    await nextTick()

    expect(body().findAll('[data-testid="folio-catalog-row"]')).toHaveLength(1)
  })

  it('keeps Add disabled until the line is valid, and shows the running total', async () => {
    await mountDialog()
    const addButton = () => body().findAll('button').find(b => b.text() === 'Add item')!

    expect(addButton().attributes('disabled')).toBeDefined()

    await body().find('[data-testid="folio-label"]').setValue('Minibar - Beer')
    await body().find('[data-testid="folio-quantity"]').setValue('2')
    await body().find('[data-testid="folio-unit-price"]').setValue('6')
    await nextTick()

    expect(addButton().attributes('disabled')).toBeUndefined()
    expect(body().find('[data-testid="folio-line-total"]').text()).toContain('12')
  })

  it('emits the draft it built rather than writing to the store itself', async () => {
    const wrapper = await mountDialog()

    await body().find('[data-testid="folio-label"]').setValue('Laundry')
    await body().find('[data-testid="folio-unit-price"]').setValue('4')
    await nextTick()
    await body().findAll('button').find(b => b.text() === 'Add item')!.trigger('click')

    const submitted = wrapper.emitted('submit')
    expect(submitted).toHaveLength(1)
    expect((submitted![0]![0] as { label: string }).label).toBe('Laundry')
  })

  it('opens on the custom form when no service is offered at the property', async () => {
    const orphan = { ...initialReservations.find(r => r.id === 'res-3')!, listingName: 'Villa Nowhere' }
    mount(FolioAddItemDialog, {
      props: { open: true, reservation: orphan },
      global: { components },
      attachTo: document.body,
    })
    await flushPromises()

    expect(body().findAll('[data-testid="folio-catalog-row"]')).toHaveLength(0)
    expect(body().text()).toContain('No catalog items')
    expect(document.activeElement).toBe(body().find('[data-testid="folio-label"]').element)
  })
})

describe('FolioVoidDialog', () => {
  const item = {
    id: 'fol-1',
    label: 'Breakfast - Continental',
    quantity: 1,
    unitPrice: 18,
    taxPercent: 0,
    servicePercent: 0,
    source: 'custom' as const,
    status: 'paid' as const,
    paymentMethod: 'card' as const,
    paidAt: '2026-09-09T09:20:00Z',
    addedBy: 'Komang Juliantara',
    addedAt: '2026-09-09T07:55:00Z',
  }

  async function mountVoid() {
    const wrapper = mount(FolioVoidDialog, {
      props: { open: true, item, currency: 'USD' },
      global: { components },
      attachTo: document.body,
    })
    await flushPromises()
    return wrapper
  }

  it('names the item and the amount being reversed', async () => {
    await mountVoid()

    expect(body().text()).toContain('Breakfast - Continental')
  })

  it('keeps Void disabled until a reason is given', async () => {
    await mountVoid()
    const voidButton = () => body().findAll('button').find(b => b.text() === 'Void item')!

    expect(voidButton().attributes('disabled')).toBeDefined()

    await body().find('[data-testid="folio-void-reason"]').setValue('Charged twice')
    await nextTick()

    expect(voidButton().attributes('disabled')).toBeUndefined()
  })

  it('treats a whitespace reason as no reason', async () => {
    await mountVoid()

    await body().find('[data-testid="folio-void-reason"]').setValue('   ')
    await nextTick()

    expect(body().findAll('button').find(b => b.text() === 'Void item')!.attributes('disabled')).toBeDefined()
  })

  it('emits the reason it collected', async () => {
    const wrapper = await mountVoid()

    await body().find('[data-testid="folio-void-reason"]').setValue('Charged twice')
    await nextTick()
    await body().findAll('button').find(b => b.text() === 'Void item')!.trigger('click')

    expect(wrapper.emitted('confirm')![0]![0]).toBe('Charged twice')
  })
})

describe('ReservationFolioSection', () => {
  const sectionComponents = {
    ...components,
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
  }

  /**
   * The section is a collapsed Accordion, and reka-ui does not mount
   * AccordionContent until it opens. Every assertion below is about the content,
   * so the helper opens it first.
   *
   * The trigger is queried by `[data-slot="accordion-trigger"]` (the stable
   * marker `AccordionTrigger.vue` renders), not "the first button in the
   * wrapper" — the section root also contains the (closed) add/void dialogs,
   * and a plain `find('button')` would silently start matching the wrong
   * element the day either dialog renders a button while closed.
   *
   * No `Teleport` stub here: `DropdownMenuContent` and the dialog content
   * both render through a real reka-ui portal, and `stubs: { Teleport: true }`
   * would replace that subtree with an empty `<teleport-stub>` — exactly the
   * failure mode called out in the comment on `body()` above. Leaving Teleport
   * unstubbed and reading `document.body` (as that same pattern already does)
   * is what lets the portalled content actually land.
   */
  async function mountSection(reservationId = 'res-3') {
    const reservation = initialReservations.find(r => r.id === reservationId)!
    const wrapper = mount(ReservationFolioSection, {
      props: { reservation },
      global: { components: sectionComponents },
      attachTo: document.body,
    })
    await wrapper.find('[data-slot="accordion-trigger"]').trigger('click')
    await nextTick()
    await nextTick()
    return wrapper
  }

  it('renders every seeded item with its state', async () => {
    const text = (await mountSection()).text()

    expect(text).toContain('Minibar - Bintang Beer')
    expect(text).toContain('Laundry - Express same day')
    expect(text).toContain('Breakfast - Continental')
    expect(text).toContain('Unpaid')
    expect(text).toContain('Paid')
    expect(text).toContain('Voided')
  })

  it('shows the void reason on a voided line', async () => {
    expect((await mountSection()).text()).toContain('Charged twice at the desk.')
  })

  it('states the booking total, the extras and the combined total', async () => {
    const text = (await mountSection()).text()

    expect(text).toContain('Booking total')
    expect(text).toContain('Extras')
    expect(text).toContain('Total')
  })

  it('reports a refund due rather than a negative balance', async () => {
    const wrapper = await mountSection()

    // Extras 26.40 posted, 33.00 collected (laundry 13.20 + the voided breakfast 19.80),
    // so the folio owes 6.60 back and never prints a negative balance.
    expect(wrapper.text()).toContain('Refund due')
    expect(wrapper.text()).toContain('6.6')
    expect(wrapper.text()).not.toContain('-6.6')
  })

  it('offers Add item on a live stay', async () => {
    const add = (await mountSection()).find('[data-testid="folio-add"]')

    expect(add.exists()).toBe(true)
    expect(add.attributes('disabled')).toBeUndefined()
  })

  it('disables Add item on a cancelled stay and says why', async () => {
    const cancelled = initialReservations.find(r => r.status === 'cancelled')!
    const wrapper = mount(ReservationFolioSection, {
      props: { reservation: cancelled },
      global: { components: sectionComponents },
      attachTo: document.body,
    })
    await wrapper.find('[data-slot="accordion-trigger"]').trigger('click')
    await nextTick()
    await nextTick()

    expect(wrapper.find('[data-testid="folio-add"]').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('cancelled')
  })

  it('shows an empty state on a stay with nothing posted', async () => {
    const wrapper = await mountSection('res-1')

    expect(wrapper.text()).toContain('Nothing posted yet')
  })

  /**
   * DropdownMenuContent is unmounted until the menu opens and portals out of the
   * wrapper, so it is read off document.body. One menu per mount: two open
   * portals in one document make a negative assertion meaningless, since the
   * other row's items are also on the page.
   */
  async function openRowMenu(rowIndex: number) {
    const wrapper = await mountSection()
    const rows = wrapper.findAll('[data-testid="folio-item-row"]')
    expect(rows).toHaveLength(3)

    await rows[rowIndex]!.find('[aria-label="Item actions"]').trigger('click')
    await nextTick()
    await nextTick()
    return document.body.textContent ?? ''
  }

  it('offers Remove but not Void on the unpaid row', async () => {
    const menu = await openRowMenu(0)

    expect(menu).toContain('Remove')
    expect(menu).not.toContain('Void item')
  })

  it('offers Void but not Remove on the paid row', async () => {
    const menu = await openRowMenu(1)

    expect(menu).toContain('Void item')
    expect(menu).not.toContain('Remove')
  })

  it('offers no actions at all on a voided row', async () => {
    const wrapper = await mountSection()
    const rows = wrapper.findAll('[data-testid="folio-item-row"]')

    expect(rows[2]!.find('[aria-label="Item actions"]').exists()).toBe(false)
  })
})
