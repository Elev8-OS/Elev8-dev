// The assignee Select in the reservation sheet's "Add cleaning" dialog used to
// carry `<SelectItem value="">` for the Unassigned option. reka-ui throws on
// that, and because the item renders inside the Select's portal the throw
// escapes asynchronously rather than surfacing as an error — so the dialog
// subtree simply died: the assignee could not be picked, Schedule did nothing,
// and the modal could not be closed. These tests pin the constraint.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { cleanerOptions } from '~/components/cleaning/data/cleaning-jobs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'

/** The dialog's assignee Select, forced open so its items actually render. */
function assigneeSelect(unassignedValue: string) {
  return defineComponent({
    setup() {
      return () => h(Select, { open: true, modelValue: unassignedValue }, () => [
        h(SelectTrigger, () => h(SelectValue, { placeholder: 'Select assignee' })),
        h(SelectContent, () => [
          h(SelectItem, { value: unassignedValue }, () => 'Unassigned'),
          ...cleanerOptions.map(c => h(SelectItem, { value: c.id }, () => c.name)),
        ]),
      ])
    },
  })
}

/** Mounts and returns whatever Vue reported to the app-level error handler. */
async function mountCapturingErrors(unassignedValue: string) {
  const errorHandler = vi.fn()
  const wrapper = mount(assigneeSelect(unassignedValue), {
    global: { config: { errorHandler, warnHandler: () => {} } },
    attachTo: document.body,
  })
  await nextTick()
  await nextTick()
  const errors = errorHandler.mock.calls.map(call => String(call[0]))
  return { wrapper, errors }
}

describe('add-cleaning assignee select', () => {
  it('renders cleanly with the sentinel value the dialog uses', async () => {
    const { wrapper, errors } = await mountCapturingErrors('unassigned')

    expect(errors).toEqual([])
    expect(document.body.textContent).toContain('Unassigned')
    for (const cleaner of cleanerOptions)
      expect(document.body.textContent).toContain(cleaner.name)

    wrapper.unmount()
  })

  it('reproduces the original crash when the option carries an empty string', async () => {
    const { wrapper, errors } = await mountCapturingErrors('')

    expect(errors.join('\n')).toMatch(/must have a value prop that is not an empty string/)

    wrapper.unmount()
  })

  it('has no cleaner whose id collides with the Unassigned sentinel', () => {
    expect(cleanerOptions.some(c => c.id === 'unassigned')).toBe(false)
  })

  it('leaves no empty-valued SelectItem in the reservation sheet', () => {
    // jsdom serves `import.meta.url` over http, so resolve from the repo root.
    const source = readFileSync(
      join(process.cwd(), 'app/components/reservations/ReservationDetailSheet.vue'),
      'utf8',
    )

    expect(source).not.toMatch(/<SelectItem\s+value=""/)
  })
})
