// Staff side of a statement dispute: the worklist and the drawer that closes
// one. The rule under test throughout is that 'adjusted' is never just a
// label — resolving that way must leave a real adjustment behind, linked from
// the resolution, and only where there is a published statement to correct.

import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import StatementIssueDrawer from '~/components/owners/StatementIssueDrawer.vue'
import StatementIssuesPanel from '~/components/owners/StatementIssuesPanel.vue'
import { useOwnerStatements } from '~/composables/useOwnerStatements'

const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
}))

vi.mock('vue-sonner', () => ({ toast: toastMock }))

const IconStub = { props: ['name'], template: '<span :data-icon="name" aria-hidden="true" />' }

const globalOptions = {
  stubs: {
    Icon: IconStub,
    // Rendered inline so assertions can stay on the wrapper instead of
    // chasing the teleported overlay.
    Sheet: { props: ['open'], template: '<div v-if="open"><slot /></div>' },
    SheetContent: { template: '<div><slot /></div>' },
    SheetHeader: { template: '<header><slot /></header>' },
    SheetTitle: { template: '<h2><slot /></h2>' },
    SheetDescription: { template: '<p><slot /></p>' },
    Label: { template: '<label><slot /></label>' },
    // No `emits: ['click']` on purpose: the parent's own handler falls
    // through onto the stub root, so re-emitting would fire it twice.
    Button: {
      props: ['variant', 'size', 'disabled'],
      template: '<button :disabled="disabled"><slot /></button>',
    },
    Textarea: {
      props: ['modelValue'],
      emits: ['update:modelValue'],
      template: '<textarea :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
    },
    // Mirrors Vue's own `type="number"` cast, which the real shadcn Input
    // gets from the native v-model.
    Input: {
      props: ['modelValue'],
      emits: ['update:modelValue'],
      template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', Number($event.target.value))" />',
    },
  },
}

function raise(statementId: string, lineId: string, description: string, amount: number) {
  const { raiseIssue } = useOwnerStatements()
  const result = raiseIssue({ statementId, lineId, description, amount })
  if (!result.ok)
    throw new Error('raiseIssue returned an error envelope')
  return result.issue.id
}

function mountDrawer(issueId: string) {
  return mount(StatementIssueDrawer, {
    props: { issueId, open: true },
    global: globalOptions,
  })
}

async function type(wrapper: ReturnType<typeof mountDrawer>, testId: string, value: string) {
  const field = wrapper.get(`[data-testid="${testId}"]`)
  await field.setValue(value)
}

describe('statementIssueDrawer', () => {
  it('shows the disputed line, the owner note, and an open status', async () => {
    const issueId = raise('stmt-2', 'sl-8', 'Cleaning looks double charged.', -2_300_000)
    const wrapper = mountDrawer(issueId)
    await flushPromises()

    expect(wrapper.get('[data-testid="issue-status"]').text()).toBe('Open')
    expect(wrapper.get('[data-testid="issue-description"]').text()).toContain('double charged')
    expect(wrapper.text()).toContain('No replies yet')
  })

  it('posts a staff reply onto the thread', async () => {
    const issueId = raise('stmt-2', 'sl-8', 'Cleaning looks double charged.', -2_300_000)
    const wrapper = mountDrawer(issueId)

    await type(wrapper, 'issue-reply', 'Checking with the housekeeping supplier.')
    await wrapper.get('[data-testid="issue-send-reply"]').trigger('click')
    await flushPromises()

    const { issues } = useOwnerStatements()
    const issue = issues.value.find(i => i.id === issueId)!
    expect(issue.thread).toHaveLength(1)
    expect(issue.thread![0].author).toBe('staff')
    expect(issue.thread![0].message).toContain('housekeeping supplier')
    expect(issue.resolvedAt).toBeUndefined()
    expect(wrapper.findAll('[data-testid="issue-message"]')).toHaveLength(1)
  })

  it('resolves as explained without creating an adjustment, and tells the owner why', async () => {
    const issueId = raise('stmt-2', 'sl-8', 'Cleaning looks double charged.', -2_300_000)
    const wrapper = mountDrawer(issueId)

    await type(wrapper, 'issue-resolve-note', 'Two cleans were booked: a mid-stay and the turnover.')
    await wrapper.get('[data-testid="issue-resolve"]').trigger('click')
    await flushPromises()

    const { issues, adjustments } = useOwnerStatements()
    const issue = issues.value.find(i => i.id === issueId)!
    expect(issue.resolvedAt).toBeTruthy()
    expect(issue.resolution?.type).toBe('explained')
    expect(issue.resolution?.adjustmentId).toBeUndefined()
    expect(adjustments.value).toHaveLength(0)
    // The explanation reaches the owner as a thread message, not only as an
    // audit field they never see.
    expect(issue.thread?.at(-1)?.message).toContain('mid-stay')
  })

  it('resolving as adjusted files the correction and links it to the resolution', async () => {
    const issueId = raise('stmt-2', 'sl-8', 'Cleaning looks double charged.', -2_300_000)
    const wrapper = mountDrawer(issueId)

    await wrapper.get('[data-testid="resolve-mode-adjusted"]').trigger('click')
    await type(wrapper, 'issue-adjust-amount', '-180000')
    await type(wrapper, 'issue-resolve-note', 'Second clean was billed in error.')
    await wrapper.get('[data-testid="issue-resolve"]').trigger('click')
    await flushPromises()

    const { issues, adjustments } = useOwnerStatements()
    const issue = issues.value.find(i => i.id === issueId)!
    expect(adjustments.value).toHaveLength(1)
    const adjustment = adjustments.value[0]
    expect(adjustment.amount).toBe(-180_000)
    expect(adjustment.reason).toContain('billed in error')
    expect(adjustment.ownerStatementId).toBe('stmt-2')
    expect(adjustment.period).toBe('2026-05')
    expect(adjustment.nextPeriod).toBe('2026-06')

    expect(issue.resolution?.type).toBe('adjusted')
    expect(issue.resolution?.adjustmentId).toBe(adjustment.id)
  })

  it('refuses to file a correction against a draft statement', async () => {
    const issueId = raise('stmt-1', 'sl-1', 'Revenue looks low for June.', 38_500_000)
    const wrapper = mountDrawer(issueId)

    await wrapper.get('[data-testid="resolve-mode-adjusted"]').trigger('click')
    expect(wrapper.find('[data-testid="issue-adjust-blocked"]').exists()).toBe(true)

    await type(wrapper, 'issue-adjust-amount', '-180000')
    await type(wrapper, 'issue-resolve-note', 'Trying to correct a draft.')
    await wrapper.get('[data-testid="issue-resolve"]').trigger('click')
    await flushPromises()

    const { issues, adjustments } = useOwnerStatements()
    expect(adjustments.value).toHaveLength(0)
    expect(issues.value.find(i => i.id === issueId)!.resolvedAt).toBeUndefined()
    expect(wrapper.get('[data-testid="issue-error"]').text()).toContain('published')
  })

  it('requires a note before an issue can be closed', async () => {
    const issueId = raise('stmt-2', 'sl-8', 'Cleaning looks double charged.', -2_300_000)
    const wrapper = mountDrawer(issueId)

    await wrapper.get('[data-testid="issue-resolve"]').trigger('click')
    await flushPromises()

    expect(useOwnerStatements().issues.value.find(i => i.id === issueId)!.resolvedAt).toBeUndefined()
  })
})

describe('statementIssuesPanel', () => {
  it('lists open issues and moves them to the resolved list once closed', async () => {
    const issueId = raise('stmt-2', 'sl-8', 'Cleaning looks double charged.', -2_300_000)
    const wrapper = mount(StatementIssuesPanel, { global: globalOptions })
    await flushPromises()

    expect(wrapper.findAll('[data-testid="issue-row"]')).toHaveLength(1)
    expect(wrapper.get('[data-testid="issues-filter-open"]').text()).toContain('(1)')
    expect(wrapper.text()).toContain('Cleaning & laundry')

    const { resolveIssueWithResolution } = useOwnerStatements()
    resolveIssueWithResolution({ issueId, type: 'explained', resolvedBy: 'user-1', note: 'Two cleans.' })
    await flushPromises()

    expect(wrapper.findAll('[data-testid="issue-row"]')).toHaveLength(0)
    expect(wrapper.get('[data-testid="issues-empty"]').text()).toContain('nothing outstanding')

    await wrapper.get('[data-testid="issues-filter-resolved"]').trigger('click')
    await flushPromises()
    // Two: the one just closed plus the seeded resolved issue on stmt-2.
    expect(wrapper.findAll('[data-testid="issue-row"]')).toHaveLength(2)
    expect(wrapper.text()).toContain('Explained')
  })

  it('opens the drawer for the clicked issue', async () => {
    const issueId = raise('stmt-2', 'sl-8', 'Cleaning looks double charged.', -2_300_000)
    const wrapper = mount(StatementIssuesPanel, { global: globalOptions })
    await flushPromises()

    await wrapper.get(`[data-testid="issue-open-${issueId}"]`).trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-testid="issue-description"]').text()).toContain('double charged')
  })
})
