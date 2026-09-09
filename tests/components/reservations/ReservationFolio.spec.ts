import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import FolioAddItemDialog from '~/components/reservations/FolioAddItemDialog.vue'
import { initialReservations } from '~/components/reservations/data/reservations'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '~/components/ui/dialog'
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
