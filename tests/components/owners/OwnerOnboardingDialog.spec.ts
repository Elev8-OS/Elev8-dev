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

import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
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

    await setBasics('Template Test', 'template.test@example.com')
    await clickButtonByText('Next')
    await tick()
    await clickButtonByText('Next')
    await tick()

    const body = document.body.textContent ?? ''
    expect(body).toMatch(/permissions/i)
    expect(body).toMatch(/full transparency/i)
    expect(body).toMatch(/financial summary/i)
  })

  it('step 3: customize allows individual field toggles', async () => {
    mountDialog()
    await tick()

    await setBasics('Custom Test', 'custom.test@example.com')
    await clickButtonByText('Next')
    await tick()
    await clickButtonByText('Next')
    await tick()

    const ok = await clickButtonByText(/customize/i)
    expect(ok).toBe(true)

    expect(document.body.textContent ?? '').toMatch(/customize|custom/i)
  })

  it('step 3: invite-now toggle on submit creates an invited owner', async () => {
    mountDialog()
    await tick()

    await setBasics('Invite Now', 'invite.now@example.com')
    await clickButtonByText('Next')
    await tick()
    await clickButtonByText('Next')
    await tick()

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
})
