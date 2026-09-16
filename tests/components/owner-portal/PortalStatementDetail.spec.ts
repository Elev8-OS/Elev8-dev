import type { OwnerStatement } from '~/components/owners/data/owner-statements'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { toRaw } from 'vue'
import PortalRaiseIssueDialog from '~/components/owner-portal/PortalRaiseIssueDialog.vue'
import PortalStatementDetail from '~/components/owner-portal/PortalStatementDetail.vue'
import PortalStatementsArchive from '~/components/owner-portal/PortalStatementsArchive.vue'
import { useOwnerAuth } from '~/composables/useOwnerAuth'
import { useOwnerStatements } from '~/composables/useOwnerStatements'

const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
}))

vi.mock('vue-sonner', () => ({ toast: toastMock }))

const IconStub = { props: ['name'], template: '<span :data-icon="name" aria-hidden="true" />' }
const NuxtLinkStub = { props: ['to'], template: '<a :href="to"><slot /></a>' }

const globalOptions = {
  stubs: {
    Icon: IconStub,
    NuxtLink: NuxtLinkStub,
    Dialog: { template: '<div><slot /></div>' },
    DialogContent: { template: '<div><slot /></div>' },
    DialogDescription: { template: '<p><slot /></p>' },
    DialogFooter: { template: '<footer><slot /></footer>' },
    DialogHeader: { template: '<header><slot /></header>' },
    DialogTitle: { template: '<h2><slot /></h2>' },
    Label: { template: '<label><slot /></label>' },
    Textarea: {
      props: ['modelValue'],
      emits: ['update:modelValue'],
      template: '<textarea data-testid="issue-note" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
    },
    Button: {
      props: ['variant', 'disabled'],
      emits: ['click'],
      template: '<button :disabled="disabled" @click="$emit(\'click\', $event)"><slot /></button>',
    },
  },
}

function loginAs(ownerId: string) {
  useOwnerAuth().session.value = {
    ownerId,
    authenticatedAt: '2026-07-23T00:00:00.000Z',
  }
}

function clonePublishedStatement(source: OwnerStatement, id: string): OwnerStatement {
  const raw = toRaw(source)
  return {
    ...JSON.parse(JSON.stringify(raw)),
    id,
    ownerId: 'own-2',
    status: 'published',
    publishedAt: '2026-07-03T10:30:00.000Z',
    publishedBy: 'staff-1',
    publishedSnapshot: JSON.parse(JSON.stringify(raw.publishedSnapshot ?? {
      lines: raw.lines,
      totalAmount: raw.totalAmount,
      currency: raw.currency,
    })),
  }
}

beforeEach(() => {
  toastMock.success.mockReset()
  toastMock.error.mockReset()
  toastMock.info.mockReset()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('owner portal statements', () => {
  it('renders only the current owner\'s published statements in the archive', async () => {
    loginAs('own-1')

    const wrapper = mount(PortalStatementsArchive, { global: globalOptions })
    await flushPromises()

    expect(wrapper.get('[data-testid="statement-stmt-2"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="statement-stmt-1"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="statement-stmt-3"]').exists()).toBe(false)
  })

  it('omits hidden statement field groups for a financial-summary owner', async () => {
    loginAs('own-2')
    const { statements } = useOwnerStatements()
    const source = statements.value.find(statement => statement.id === 'stmt-3')!
    statements.value = [...statements.value, clonePublishedStatement(source, 'stmt-own-2-published')]

    const wrapper = mount(PortalStatementDetail, {
      props: { statementId: 'stmt-own-2-published' },
      global: globalOptions,
    })
    await flushPromises()

    expect(wrapper.get('[data-testid="statement-section-commissionDetails"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="statement-section-netPayout"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="statement-section-revenueLines"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="statement-section-expenseDetails"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="statement-section-taxesAndFees"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="statement-section-adjustments"]').exists()).toBe(false)
  })

  it('renders published values as read-only', async () => {
    loginAs('own-1')

    const wrapper = mount(PortalStatementDetail, {
      props: { statementId: 'stmt-2' },
      global: globalOptions,
    })
    await flushPromises()

    expect(wrapper.text()).toContain('25.180.000')
    expect(wrapper.text()).toContain('Gross booking revenue')
    expect(wrapper.findAll('input, textarea, select').length).toBe(0)
  })

  it('opens the browser print dialog for PDF (no mock export)', async () => {
    loginAs('own-1')

    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {})

    const wrapper = mount(PortalStatementDetail, {
      props: { statementId: 'stmt-2' },
      global: globalOptions,
    })
    await flushPromises()

    await wrapper.get('[data-testid="export-pdf"]').trigger('click')
    expect(printSpy).toHaveBeenCalled()
    // PDF button never shows "Exporting" — it just opens the print dialog
    expect(wrapper.get('[data-testid="export-pdf"]').text()).not.toContain('Exporting')
    // And it never calls mockExport for the PDF format
    expect(toastMock.success).not.toHaveBeenCalled()
  })

  it('shows loading and success feedback for XLSX mock export', async () => {
    loginAs('own-1')

    const wrapper = mount(PortalStatementDetail, {
      props: { statementId: 'stmt-2' },
      global: globalOptions,
    })
    await flushPromises()

    await wrapper.get('[data-testid="export-xlsx"]').trigger('click')
    expect(wrapper.get('[data-testid="export-xlsx"]').text()).toContain('Exporting')
    await vi.runAllTimersAsync()
    await flushPromises()
    expect(toastMock.success).toHaveBeenCalledWith(expect.stringMatching(/XLSX/i))
  })

  it('raises one open issue for a selected line and shows the existing issue on duplicate submit', async () => {
    loginAs('own-1')
    const { issues } = useOwnerStatements()
    const wrapper = mount(PortalStatementDetail, {
      attachTo: document.body,
      props: { statementId: 'stmt-2' },
      global: globalOptions,
    })
    await flushPromises()

    await wrapper.get('[data-testid="raise-issue-sl-7"]').trigger('click')
    const dialog = wrapper.getComponent(PortalRaiseIssueDialog)
    expect(dialog.exists()).toBe(true)
    const note = document.body.querySelector<HTMLTextAreaElement>('[data-testid="issue-note"]')
    expect(note).not.toBeNull()
    note!.value = 'Please review this revenue line.'
    note!.dispatchEvent(new Event('input', { bubbles: true }))
    await flushPromises()
    const submit = document.body.querySelector<HTMLButtonElement>('[data-testid="submit-issue"]')
    expect(submit).not.toBeNull()
    submit!.click()
    await flushPromises()

    const firstOpen = issues.value.filter(issue => issue.statementId === 'stmt-2' && issue.lineId === 'sl-7' && !issue.resolvedAt)
    expect(firstOpen).toHaveLength(1)

    await wrapper.get('[data-testid="raise-issue-sl-7"]').trigger('click')
    expect(document.body.querySelector('[data-testid="existing-issue"]')).not.toBeNull()
    expect(document.body.textContent).toContain('already open')
    expect(issues.value.filter(issue => issue.statementId === 'stmt-2' && issue.lineId === 'sl-7' && !issue.resolvedAt)).toHaveLength(1)
  })
  it('discloses a pending correction on the statement it corrects, and the money on the one that carried it', async () => {
    loginAs('own-1')
    const { recordAdjustment, adjustments } = useOwnerStatements()
    const recorded = recordAdjustment({
      ownerStatementId: 'stmt-2',
      amount: -180_000,
      reason: 'Airbnb host fee understated in May.',
    })
    expect(recorded.ok).toBe(true)

    // May: a promise, kept out of the statement's own total.
    const may = mount(PortalStatementDetail, {
      props: { statementId: 'stmt-2' },
      global: globalOptions,
    })
    await flushPromises()
    expect(may.findAll('[data-testid="adjustment-related"]')).toHaveLength(1)
    expect(may.text()).toContain('Will appear in the 2026-06 statement')
    expect(may.findAll('[data-testid="adjustment-applied"]')).toHaveLength(0)

    // Once folded in, the money shows on June and May reads as settled.
    adjustments.value = adjustments.value.map(a => a.id === (recorded as { adjustment: { id: string } }).adjustment.id
      ? { ...a, appliedToStatementId: 'stmt-6', appliedInPeriod: '2026-06' }
      : a)

    const june = mount(PortalStatementDetail, {
      props: { statementId: 'stmt-6' },
      global: globalOptions,
    })
    await flushPromises()
    expect(june.findAll('[data-testid="adjustment-applied"]')).toHaveLength(1)
    expect(june.text()).toContain('Correction for 2026-05')
    expect(june.text()).toContain('Total adjustment impact')

    const mayAgain = mount(PortalStatementDetail, {
      props: { statementId: 'stmt-2' },
      global: globalOptions,
    })
    await flushPromises()
    expect(mayAgain.text()).toContain('Paid out in the 2026-06 statement')
  })
})
