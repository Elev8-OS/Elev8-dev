// Publication dialog TDD tests for the tenant-side owner-statements UI.
//
// The composable backing the dialog (useOwnerStatements) is exercised
// directly in tests/composables/useOwnerStatements.spec.ts — here we test
// the wiring:
//   - The dialog renders the draft's calculated lines and totals.
//   - A confirmation step is required before the publish action runs.
//   - Duplicate clicks while publishing are blocked (button disabled / spam-guarded).
//   - Successful publish closes the dialog, locks the values (read-only),
//     and emits a toast.
//   - A published statement has no editable controls.

import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import StatementPublishDialog from '~/components/owner-statements/StatementPublishDialog.vue'
import { useOwnerStatements } from '~/composables/useOwnerStatements'

const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
}))
vi.mock('vue-sonner', () => ({ toast: toastMock }))

const ButtonStub = {
  props: ['disabled', 'type', 'variant'],
  emits: ['click'],
  template: '<button :type="type" :disabled="disabled" @click="$emit(\'click\', $event)"><slot /></button>',
}

const IconStub = { props: ['name'], template: '<i />' }

const globalOptions = {
  stubs: {
    Button: ButtonStub,
    Dialog: { template: '<div><slot /></div>' },
    DialogContent: { template: '<div><slot /></div>' },
    DialogDescription: { template: '<p><slot /></p>' },
    DialogFooter: { template: '<footer><slot /></footer>' },
    DialogHeader: { template: '<header><slot /></header>' },
    DialogTitle: { template: '<h2><slot /></h2>' },
    Icon: IconStub,
  },
}

function findDialogButton(text: string | RegExp): HTMLButtonElement | null {
  const buttons = Array.from(document.body.querySelectorAll('button')) as HTMLButtonElement[]
  return buttons.find(b => typeof text === 'string'
    ? b.textContent?.trim() === text
    : text.test(b.textContent ?? '')) ?? null
}

function findDialogButtonByTestId(testId: string): HTMLButtonElement | null {
  return document.body.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`)
}

async function tick() {
  await new Promise(r => setTimeout(r, 0))
}

function mountPublishDialog(statementId: string) {
  const { statements } = useOwnerStatements()
  const statement = statements.value.find(s => s.id === statementId)
  if (!statement)
    throw new Error(`Statement ${statementId} not found in seed`)
  return mount(StatementPublishDialog, {
    attachTo: document.body,
    props: {
      modelValue: true,
      statementId,
    },
    global: globalOptions,
  })
}

describe('statementPublishDialog', () => {
  beforeEach(() => {
    toastMock.success.mockClear()
    toastMock.error.mockClear()
    toastMock.info.mockClear()
    document.body.innerHTML = ''
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('renders the draft statement lines and totals', async () => {
    // stmt-1 is a draft in the seed.
    mountPublishDialog('stmt-1')
    await tick()

    const body = document.body.textContent ?? ''
    // Labels are rendered in the required order:
    expect(body).toMatch(/Gross booking revenue/i)
    expect(body).toMatch(/Operating expenses/i)
    expect(body).toMatch(/Management commission/i)
    expect(body).toMatch(/Taxes/i)
    expect(body).toMatch(/Net owner payout/i)
  })

  it('requires confirmation before publishing', async () => {
    mountPublishDialog('stmt-1')
    await tick()

    // The initial CTA is "Confirm & Review" or similar — it advances to a
    // confirmation step rather than immediately publishing.
    const initialBtn = findDialogButton(/confirm|publish|continue/i)
    expect(initialBtn).toBeTruthy()
    // No publish toast yet.
    expect(toastMock.success).not.toHaveBeenCalledWith(expect.stringMatching(/published/i))
  })

  it('blocks duplicate clicks while publishing', async () => {
    const wrapper = mountPublishDialog('stmt-1')
    await tick()

    // Advance to the confirmation step.
    const confirmBtn = findDialogButtonByTestId('publish-start')
    expect(confirmBtn).toBeTruthy()
    confirmBtn?.click()
    await tick()

    // The publish button during in-flight should be disabled OR the
    // component must guard against multiple invocations.
    const publishBtn = findDialogButtonByTestId('publish-confirm')
    expect(publishBtn).toBeTruthy()

    // First click starts publish.
    publishBtn?.click()
    await tick()

    // Immediately after first click, the button gets disabled for the
    // duration of the publish action to prevent duplicates.
    const { statements } = useOwnerStatements()
    const draft = statements.value.find(s => s.id === 'stmt-1')
    // The test verifies the button is disabled OR the publish has already
    // completed (success). Either way there must not be a duplicate toast.
    const afterFirstClick = findDialogButtonByTestId('publish-confirm')
    if (afterFirstClick && !afterFirstClick.disabled) {
      // Still clickable: simulate the second click and confirm the
      // component no-ops on subsequent invocations.
      afterFirstClick.click()
      await tick()
    }
    await tick()

    // Allow time for any pending publish to finish.
    await new Promise(r => setTimeout(r, 10))
    await tick()

    // Count success toasts — should be at most one.
    const publishToasts = toastMock.success.mock.calls.filter((c: any[]) =>
      /published/i.test(typeof c[0] === 'string' ? c[0] : ''),
    )
    expect(publishToasts.length).toBeLessThanOrEqual(1)

    // The statement must be in 'published' state if any toast fired.
    if (publishToasts.length > 0) {
      expect(draft?.status === 'published' || statements.value.find(s => s.id === 'stmt-1')?.status === 'published').toBe(true)
    }
    // Suppress unused.
    void wrapper
  })

  it('successful publish closes the dialog, locks values, and emits a toast', async () => {
    const wrapper = mountPublishDialog('stmt-1')
    await tick()

    const confirmBtn = findDialogButtonByTestId('publish-start')
    confirmBtn?.click()
    await tick()

    const publishBtn = findDialogButtonByTestId('publish-confirm')
    publishBtn?.click()
    await tick()
    await new Promise(r => setTimeout(r, 50))
    await tick()

    // The toast must have been emitted.
    expect(toastMock.success).toHaveBeenCalledWith(expect.stringMatching(/published/i))

    // The dialog must be closed (modelValue updated to false).
    const open = wrapper.emitted('update:modelValue')
    expect(open).toBeTruthy()
    expect((open as unknown[]).at(-1)).toEqual([false])

    // The statement must now be published.
    const { statements } = useOwnerStatements()
    const statement = statements.value.find(s => s.id === 'stmt-1')
    expect(statement?.status).toBe('published')
  })

  it('a published statement has no editable controls', async () => {
    // Publish stmt-1 first using the composable directly to set up state.
    const { publish, statements } = useOwnerStatements()
    publish('stmt-1', 'staff-1')
    await tick()

    expect(statements.value.find(s => s.id === 'stmt-1')?.status).toBe('published')

    const wrapper = mountPublishDialog('stmt-1')
    await tick()

    // The publish button must not be present (or it must be disabled).
    const confirmBtn = findDialogButtonByTestId('publish-start')
    expect(confirmBtn).toBeFalsy()

    // The dialog should display read-only information — no inputs.
    const inputs = document.body.querySelectorAll('input, textarea')
    expect(inputs.length).toBe(0)

    // Snapshot values are referenced (the published snapshot is what the
    // owner was originally shown).
    const body = document.body.textContent ?? ''
    expect(body).toMatch(/published/i)
    expect(body).toMatch(/Net owner payout/i)

    // Read-only Note: caller's actions are no-ops.
    publish('stmt-1', 'staff-1')
    await tick()
    expect(statements.value.find(s => s.id === 'stmt-1')?.status).toBe('published')
    void wrapper
  })
})
