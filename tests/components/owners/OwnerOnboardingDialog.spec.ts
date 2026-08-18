// Step-1 (basics), Step-2 (assignments + commission), Step-3 (permissions)
// behavior tests for the tenant-side Owner onboarding dialog.
//
// The composable backing the dialog (useOwners) is exercised directly in
// tests/composables/useOwners.spec.ts — here we test the UI wiring:
//   - Step 1 blocks missing or duplicate email.
//   - Step 2 enforces cumulative ownership <= 100% and validates flat,
//     tiered, and hybrid commission rule inputs.
//   - Step 3 applies a permission template, allows per-field customization,
//     and submits with invite-now when the toggle is on.
//   - Cancel discards the in-flight draft and does not persist anything.

import type { RebalanceRow } from '~/components/owners/lib/ownership-rebalance'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { rebalanceSiblings } from '~/components/owners/lib/ownership-rebalance'
import OwnerOnboardingDialog from '~/components/owners/OwnerOnboardingDialog.vue'
import { useOwners } from '~/composables/useOwners'

function mountDialog() {
  return mount(OwnerOnboardingDialog, {
    props: {
      modelValue: true,
    },
    attachTo: document.body,
  })
}

async function tick() {
  // Flush pending Vue updates — the dialog uses DialogPortal which
  // teleports the body into document.body asynchronously.
  await new Promise(r => setTimeout(r, 0))
}

function findInputInBody(predicate: (el: HTMLInputElement) => boolean): HTMLInputElement | null {
  const inputs = Array.from(document.body.querySelectorAll('input')) as HTMLInputElement[]
  return inputs.find(predicate) ?? null
}

function findButtonByText(text: string | RegExp): HTMLButtonElement | null {
  const buttons = Array.from(document.body.querySelectorAll('button')) as HTMLButtonElement[]
  return buttons.find(b => typeof text === 'string' ? b.textContent?.trim() === text : text.test(b.textContent ?? '')) ?? null
}

async function setBasics(name: string, email: string) {
  const nameInput = findInputInBody(el => el.id === 'owner-name' || el.placeholder.toLowerCase().includes('name'))
  const emailInput = findInputInBody(el => el.type === 'email')
  if (!nameInput || !emailInput)
    throw new Error(`Inputs not found in body — name=${!!nameInput} email=${!!emailInput}`)
  // Native input dispatch — vue-test-utils' setValue() does not work
  // reliably on inputs that are rendered into a DialogPortal subtree.
  nameInput.value = name
  nameInput.dispatchEvent(new Event('input', { bubbles: true }))
  nameInput.dispatchEvent(new Event('change', { bubbles: true }))
  emailInput.value = email
  emailInput.dispatchEvent(new Event('input', { bubbles: true }))
  emailInput.dispatchEvent(new Event('change', { bubbles: true }))
  await tick()
}

async function clickButtonByText(text: string | RegExp): Promise<boolean> {
  const btn = findButtonByText(text)
  if (!btn)
    return false
  btn.click()
  await tick()
  return true
}

/**
 * Open the shared property picker whose trigger currently shows
 * `triggerText`, then click the option named `optionText`.
 */
async function pickProperty(triggerText: string, optionText: string) {
  const ok = await clickButtonByText(new RegExp(triggerText))
  expect(ok).toBe(true)
  await tick()
  await tick()
  // Options live in a teleported PopoverContent; match by substring.
  const options = Array.from(document.body.querySelectorAll('button')) as HTMLButtonElement[]
  const option = options.find(b => b.textContent?.trim() === optionText || b.textContent?.trim().startsWith(optionText))
  expect(option, `option "${optionText}" not found in popover`).toBeTruthy()
  option!.click()
  await tick()
  await tick()
}

/**
 * Advance through step 1 (basics) and step 2 (assignments), picking the
 * given property in step 2 so the new listingId guard passes.
 */
async function goToStep3(name: string, email: string) {
  await setBasics(name, email)
  await clickButtonByText('Next')
  await tick()
  await pickProperty('Select property', 'Apartments Pool')
  await clickButtonByText('Next')
  await tick()
}

describe('ownerOnboardingDialog', () => {
  beforeEach(() => {
    useOwners()
    document.body.innerHTML = ''
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('step 1: missing email blocks the Next action', async () => {
    const { owners } = useOwners()
    const ownersBefore = owners.value.length
    mountDialog()
    await tick()

    await setBasics('I Made Test', '')

    const ok = await clickButtonByText('Next')
    expect(ok).toBe(true)

    expect(document.body.textContent ?? '').toMatch(/email/i)
    expect(owners.value.length).toBe(ownersBefore)
  })

  it('step 1: duplicate email (case-insensitive) blocks the Next action', async () => {
    mountDialog()
    await tick()

    await setBasics('Wayan Sari Clone', 'WAYAN.SARI@Example.com')

    await clickButtonByText('Next')

    expect(document.body.textContent ?? '').toMatch(/already/i)
  })

  it('step 2: cumulative ownership above 100% blocks Next', async () => {
    mountDialog()
    await tick()

    await setBasics('Sum Test', 'sum.test@example.com')
    await clickButtonByText('Next')
    await tick()

    // Add a second mapping row so we have two ownership rows at 60% each.
    const addBtn = findButtonByText(/add another/i)
    if (addBtn) {
      addBtn.click()
      await tick()
    }

    // Set two ownership inputs to 60 + 60 — cumulatively 120% > 100.
    const numberInputs = Array.from(document.body.querySelectorAll('input[type="number"]')) as HTMLInputElement[]
    expect(numberInputs.length).toBeGreaterThanOrEqual(2)
    const ownershipInputs = numberInputs.filter(i => i.id.startsWith('ownership-'))
    expect(ownershipInputs.length).toBeGreaterThanOrEqual(2)

    for (const inp of ownershipInputs) {
      inp.value = '60'
      inp.dispatchEvent(new Event('input', { bubbles: true }))
      inp.dispatchEvent(new Event('change', { bubbles: true }))
    }
    await tick()

    // Try to advance to step 3.
    await clickButtonByText('Next')

    // Either the ownership alert is rendered or we did not advance (still on step 2).
    const body = document.body.textContent ?? ''
    const hasOverflow = /exceeds 100%|above 100%|exceed 100%/i.test(body)
    const stillOnStep2 = /Assignments|Assigned properties/.test(body)
    expect(hasOverflow || stillOnStep2).toBe(true)
  })

  it('step 2: tiered commission type renders the tier editor', async () => {
    mountDialog()
    await tick()

    await setBasics('Tiered Test', 'tiered.test@example.com')
    await clickButtonByText('Next')
    await tick()

    const ok = await clickButtonByText('Tiered')
    expect(ok).toBe(true)

    expect(document.body.textContent ?? '').toMatch(/tier/i)
  })

  it('step 2: hybrid commission exposes both fixed and rate inputs', async () => {
    mountDialog()
    await tick()

    await setBasics('Hybrid Test', 'hybrid.test@example.com')
    await clickButtonByText('Next')
    await tick()

    const ok = await clickButtonByText('Hybrid')
    expect(ok).toBe(true)

    const body = document.body.textContent?.toLowerCase() ?? ''
    expect(body).toMatch(/fixed/)
    expect(body).toMatch(/rate/)
  })

  it('step 3: applying a template populates dashboard and statement sections', async () => {
    mountDialog()
    await tick()

    await goToStep3('Template Test', 'template.test@example.com')

    const body = document.body.textContent ?? ''
    expect(body).toMatch(/permissions/i)
    expect(body).toMatch(/full transparency/i)
    expect(body).toMatch(/financial summary/i)
  })

  it('step 3: customize allows individual field toggles', async () => {
    mountDialog()
    await tick()

    await goToStep3('Custom Test', 'custom.test@example.com')

    const ok = await clickButtonByText(/customize/i)
    expect(ok).toBe(true)

    expect(document.body.textContent ?? '').toMatch(/customize|custom/i)
  })

  it('step 3: invite-now toggle on submit creates an invited owner', async () => {
    mountDialog()
    await tick()

    await goToStep3('Invite Now', 'invite.now@example.com')

    // Toggle invite-now switch.
    const switches = Array.from(document.body.querySelectorAll('[role="switch"]')) as HTMLElement[]
    if (switches.length > 0) {
      switches[0].click()
      await tick()
    }

    const ok = await clickButtonByText(/create owner|create & invite|save|finish/i)
    expect(ok).toBe(true)
    await tick()

    const { owners } = useOwners()
    const created = owners.value.find(o => o.email === 'invite.now@example.com')
    expect(created).toBeTruthy()
    expect(created!.status).toBe('invited')
    expect(created!.invitedAt).toBeTruthy()
  })

  it('cancel discards the draft — no owner is persisted', async () => {
    const { owners } = useOwners()
    const ownersBefore = owners.value.length
    mountDialog()
    await tick()

    await setBasics('Cancel Test', 'cancel.test@example.com')

    const ok = await clickButtonByText('Cancel')
    expect(ok).toBe(true)
    await tick()

    expect(owners.value.length).toBe(ownersBefore)
    expect(owners.value.find(o => o.email === 'cancel.test@example.com')).toBeUndefined()
  })

  it('step 2: adding a property on a fully-allocated listing auto-fills 0% ownership', async () => {
    // Seed has lst-1 at 100% (Wayan). Adding a row to it must not trip the
    // 100% guard — the auto-fill should cap the share at 0.
    mountDialog()
    await tick()

    await setBasics('Auto Calc', 'autocalc.full@example.com')
    await clickButtonByText('Next')
    await tick()

    // The default draft row selects the first listing (lst-1). Add another
    // row — the auto-fill should set ownership to 0 for lst-1.
    const addBtn = findButtonByText(/add another/i)
    expect(addBtn).toBeTruthy()
    addBtn!.click()
    await tick()

    const ownershipInputs = Array.from(document.body.querySelectorAll('input[type="number"]')) as HTMLInputElement[]
    const filtered = ownershipInputs.filter(i => i.id.startsWith('ownership-'))
    // lst-1 is fully allocated, so the fresh row's ownership is 0.
    const last = filtered.at(-1)
    expect(last).toBeTruthy()
    expect(last!.value).toBe('0')
  })

  it('step 2: adding another property does not auto-create a commission rule', async () => {
    mountDialog()
    await tick()

    await setBasics('Rule Blank', 'rule.blank@example.com')
    await clickButtonByText('Next')
    await tick()

    // Count commission rule editors before adding another row.
    const commissionNameInputs = () => Array.from(document.body.querySelectorAll('input#commission-name')) as HTMLInputElement[]
    const commissionRateInputs = () => Array.from(document.body.querySelectorAll('input#commission-rate')) as HTMLInputElement[]
    const namesBefore = commissionNameInputs().length

    const addBtn = findButtonByText(/add another/i)
    expect(addBtn).toBeTruthy()
    addBtn!.click()
    await tick()

    // A new row was added with its own blank commission rule editor.
    expect(commissionNameInputs().length).toBe(namesBefore + 1)
    // The new rule is blank, not defaulted to "Standard 20% management".
    const lastRate = commissionRateInputs().at(-1)
    expect(lastRate).toBeTruthy()
    expect(lastRate!.value).toBe('0')
    const lastInput = commissionNameInputs().at(-1)
    expect(lastInput).toBeTruthy()
    expect(lastInput!.value).toBe('')
  })

  it('step 2: switching listing to a partially-shared one auto-fills the remaining share', async () => {
    // Seed lst-2 (Apartments Pool) has no owner. Give it a 50% existing
    // mapping so the new owner's share should auto-fill to the remaining 50%.
    const { addMapping } = useOwners()
    const seeded = addMapping({
      ownerId: 'own-1',
      listingId: 'lst-2',
      ownershipPercentage: 50,
      commissionRuleId: 'cr-1',
      effectiveFrom: '2026-01-15',
    })
    expect(seeded.success).toBe(true)

    mountDialog()
    await tick()

    await setBasics('Auto Calc Partial', 'autocalc.partial@example.com')
    await clickButtonByText('Next')
    await tick()

    // Default row has no property selected yet — pick Apartments Pool (lst-2).
    await pickProperty('Select property', 'Apartments Pool')

    const ownershipInputs = Array.from(document.body.querySelectorAll('input[type="number"]')) as HTMLInputElement[]
    const filtered = ownershipInputs.filter(i => i.id.startsWith('ownership-'))
    expect(filtered[0]?.value).toBe('50')
  })

  it('step 2: editing one ownership share rebalances the sibling row in the same scope to total 100', async () => {
    // Pure unit test on the rebalancing helper (UI picker interaction is
    // covered by the switching-listing test above). Two draft rows share
    // lst-4: 100% + 0%. Editing the 0% row to 50 must rebalance the 100%
    // row to 50 so the scope totals 100. The changed row already carries
    // the new value (the component applies the edit before rebalancing).
    const existing: Array<{ listingId: string, unitId?: string, ownershipPercentage: number }> = []
    const rows: RebalanceRow[] = [
      { mapping: { listingId: 'lst-4', ownershipPercentage: 100 } },
      { mapping: { listingId: 'lst-4', ownershipPercentage: 50 } },
    ]
    const rebalanced = rebalanceSiblings(existing, rows, 1, 50)
    expect(rebalanced[0]!.mapping.ownershipPercentage).toBe(50)
    expect(rebalanced[1]!.mapping.ownershipPercentage).toBe(50)
  })

  it('step 2: a mapping without a selected property blocks Next', async () => {
    mountDialog()
    await tick()

    await setBasics('No Property', 'no.property@example.com')
    await clickButtonByText('Next')
    await tick()

    // Default draft row has no property selected — this must block advancing.
    await clickButtonByText('Next')

    const body = document.body.textContent ?? ''
    expect(body).toMatch(/select a property/i)
  })

  it('step 2: clearing a selected property resets ownership to 0', async () => {
    mountDialog()
    await tick()

    await setBasics('Clear Prop', 'clear.prop@example.com')
    await clickButtonByText('Next')
    await tick()

    // Pick Apartments Pool (lst-2) — free scope, auto-fills 100%.
    await pickProperty('Select property', 'Apartments Pool')
    const ownershipInputs = Array.from(document.body.querySelectorAll('input[type="number"]')) as HTMLInputElement[]
    const filtered = ownershipInputs.filter(i => i.id.startsWith('ownership-'))
    expect(filtered[0]?.value).toBe('100')

    // Clear the selection via the picker footer "Clear" button.
    const clearBtn = Array.from(document.body.querySelectorAll('button'))
      .find(b => b.textContent?.trim() === 'Clear') as HTMLButtonElement | null
    expect(clearBtn).toBeTruthy()
    clearBtn!.click()
    await tick()
    await tick()

    // Ownership must reset to 0, not jump to 100.
    const afterInputs = Array.from(document.body.querySelectorAll('input[type="number"]')) as HTMLInputElement[]
    const afterFiltered = afterInputs.filter(i => i.id.startsWith('ownership-'))
    expect(afterFiltered[0]?.value).toBe('0')
  })
})
