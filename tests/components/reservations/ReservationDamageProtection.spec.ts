import type { DamageProtection, ProtectionClaim, ReservationEntry } from '~/components/reservations/data/reservations'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ReservationDamageProtectionSection from '~/components/reservations/ReservationDamageProtectionSection.vue'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '~/components/ui/accordion'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Label } from '~/components/ui/label'
import { useCleaningJobs } from '~/composables/useCleaningJobs'
import { useReservationsModule } from '~/composables/useReservationsModule'

const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }))
vi.mock('vue-sonner', () => ({ toast: toastMock }))

function isoDaysFromNow(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function reservation(patch: Partial<ReservationEntry> = {}): ReservationEntry {
  return {
    id: 'res-dpc-1',
    guestId: 'guest-dpc-1',
    guestName: 'Anna Schmidt',
    guestEmail: 'anna@example.com',
    guestPhone: '+62 812 0000 0000',
    guestLanguage: 'en',
    guestNotes: '',
    listingId: 'lst-1',
    listingName: 'The R Villa Merapi',
    channel: 'Direct',
    checkIn: isoDaysFromNow(5),
    checkOut: isoDaysFromNow(10),
    nights: 5,
    guestCount: 2,
    totalPrice: 1300,
    currency: 'USD',
    status: 'verified',
    activity: [],
    priceDetails: { subtotal: 1000, cleaningFee: 300, serviceFee: 0, tax: 0, extras: 0, guestPaid: 1300, commission: 0, payout: 1300 },
    ...patch,
  } as ReservationEntry
}

function protection(patch: Partial<DamageProtection> = {}): DamageProtection {
  return {
    policyId: 'dp-standard',
    option: 'deposit',
    state: 'card_on_file',
    amount: 500,
    currency: 'USD',
    termsVersion: 'v1',
    termsText: 'Terms',
    acceptedAt: new Date().toISOString(),
    acceptedVia: 'guest_guide',
    card: { provider: 'stripe', paymentMethodId: 'pm_mock_4242', brand: 'visa', last4: '4242', expMonth: 12, expYear: 2028, savedAt: new Date().toISOString() },
    settleDueAt: new Date(Date.now() + 7 * 86400000).toISOString(),
    claims: [],
    ...patch,
  }
}

function lamp(patch: Partial<ProtectionClaim> = {}): ProtectionClaim {
  return {
    id: 'clm-1',
    label: 'Broken lamp',
    amount: 80,
    coveredAmount: 80,
    excessAmount: 0,
    reason: 'Found at checkout',
    evidenceUrls: ['/mock/lamp.jpg'],
    recordedBy: 'Komang Juliantara',
    recordedAt: new Date().toISOString(),
    ...patch,
  }
}

function buttonNamed(wrapper: { findAll: (s: string) => { text: () => string, attributes: (n: string) => string | undefined }[] }, label: string) {
  return wrapper.findAll('button').find(b => b.text().trim() === label)
}

function mountSection(entry: ReservationEntry) {
  const { reservations } = useReservationsModule()
  reservations.value = [entry, ...reservations.value.filter(r => r.id !== entry.id)]
  return mount(ReservationDamageProtectionSection, {
    props: { reservation: entry },
    global: {
      // Nuxt auto-imports these. Unregistered they render as unresolved stubs
      // and every text assertion passes vacuously.
      components: {
        Badge,
        Button,
        Label,
        AccordionItem: { template: '<div><slot /></div>' },
        AccordionTrigger: { template: '<button><slot /></button>' },
        AccordionContent: { template: '<div><slot /></div>' },
      },
      stubs: {
        Icon: true,
        Separator: true,
        Switch: { template: '<button />' },
        ProtectionChoiceDialog: { template: '<div />' },
        // Reads the reports prop, so a test can see what reaches the dialog.
        ProtectionClaimDialog: {
          props: ['reports'],
          template: `<div data-testid="claim-dialog-stub" :data-reports="(reports ?? []).map(r => r.jobId + ':' + r.findings.length).join(',')" />`,
        },
      },
    },
  })
}

/**
 * Mounts with the REAL reka-ui accordion instead of the div stubs above.
 *
 * The stubs cannot see a missing `<Accordion>` root: reka-ui resolves that
 * through context injection, and a plain `<div>` injects nothing. The section
 * shipped with `<AccordionItem>` as its template root and every test here still
 * passed, while the live component threw
 * `Injection Symbol(AccordionRootContext) not found` and took the whole
 * reservation detail sheet down with it.
 */
function mountSectionWithRealAccordion(entry: ReservationEntry) {
  const { reservations } = useReservationsModule()
  reservations.value = [entry, ...reservations.value.filter(r => r.id !== entry.id)]
  return mount(ReservationDamageProtectionSection, {
    props: { reservation: entry },
    global: {
      components: { Accordion, AccordionContent, AccordionItem, AccordionTrigger, Badge, Button, Label },
      stubs: {
        Icon: true,
        Separator: true,
        Switch: { template: '<button />' },
        ProtectionChoiceDialog: { template: '<div />' },
        ProtectionClaimDialog: { template: '<div />' },
      },
    },
  })
}

function buttonLabels(wrapper: ReturnType<typeof mountSection>): string[] {
  return wrapper.findAll('button').map(b => b.text().trim()).filter(Boolean)
}

beforeEach(() => {
  const module = useReservationsModule()
  module.reset()
  module.reservations.value = []
  vi.clearAllMocks()
})

describe('reservationDamageProtectionSection', () => {
  it('renders nothing for an owner stay on an offered listing', () => {
    const wrapper = mountSection(reservation({ status: 'owner_request' }))
    expect(wrapper.text()).toBe('')
  })

  it('renders nothing for a maintenance block', () => {
    const wrapper = mountSection(reservation({ status: 'blocked' }))
    expect(wrapper.text()).toBe('')
  })

  it('renders nothing on a channel a deposit-only policy skips', () => {
    // lst-2's short stays are deposit-only, Direct only.
    const wrapper = mountSection(reservation({ listingId: 'lst-2', channel: 'Airbnb' }))
    expect(wrapper.text()).toBe('')
  })

  it('asks an OTA guest too where the waiver is on', () => {
    const wrapper = mountSection(reservation({ channel: 'Airbnb' }))
    expect(wrapper.text()).toContain('The guest has not chosen yet')
  })

  it('shows a host-paid cover as paid by the host, with nothing to choose and nothing to refund', () => {
    const cover = protection({
      option: 'waiver',
      state: 'waiver_active',
      amount: 0,
      paidBy: 'host',
      tier: 'bronze',
      elev8Fee: 9,
      coverageCap: 2000,
      acceptedVia: 'host_cover',
      card: undefined,
      settleDueAt: undefined,
    })
    const wrapper = mountSection(reservation({ damageProtection: cover }))
    expect(wrapper.find('[data-testid="protection-paid-by"]').text()).toBe('The host')
    expect(wrapper.text()).toContain('Elev8 charges USD 9.00')
    expect(wrapper.text()).toContain('the guest is not asked')
    expect(buttonLabels(wrapper)).not.toContain('Record choice for guest')

    const cancelled = mountSection(reservation({ status: 'cancelled', damageProtection: cover }))
    expect(cancelled.find('[data-testid="protection-cancelled-stay"]').text()).toContain('nothing to refund')
    expect(buttonLabels(cancelled)).toContain('Close cover')
  })

  it('offers to record the choice when the guest has not answered', () => {
    const wrapper = mountSection(reservation())
    expect(wrapper.text()).toContain('The guest has not chosen yet')
    expect(buttonLabels(wrapper)).toContain('Record choice for guest')
  })

  it('shows the saved card and that nothing has been charged', () => {
    const wrapper = mountSection(reservation({ damageProtection: protection() }))
    const card = wrapper.find('[data-testid="protection-saved-card"]').text()
    expect(card).toContain('Visa •••• 4242, expires 12/28')
    expect(card).toContain('nothing charged yet')
    expect(wrapper.text()).toContain('Card may be charged up to')
  })

  it('offers to close without charging when there are no claims', () => {
    const wrapper = mountSection(reservation({
      checkIn: isoDaysFromNow(-5),
      checkOut: isoDaysFromNow(-1),
      status: 'checked_out',
      damageProtection: protection(),
    }))
    expect(wrapper.find('[data-testid="protection-settle"]').text()).toContain('No claims. Close the deposit')
    expect(buttonNamed(wrapper, 'Close without charging')?.attributes('disabled')).toBeUndefined()
  })

  it('blocks the charge while a claim is unnotified and says why', () => {
    const wrapper = mountSection(reservation({ damageProtection: protection({ claims: [lamp()] }) }))
    expect(wrapper.text()).toContain('Guest not notified')
    expect(buttonLabels(wrapper)).toContain('Notify guest')
    expect(buttonNamed(wrapper, 'Charge USD 80.00')?.attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('1 claim(s) have not been shown to the guest yet')
  })

  it('offers to charge the covered claims once every claim is notified', () => {
    const wrapper = mountSection(reservation({
      damageProtection: protection({ claims: [lamp({ guestNotifiedAt: new Date().toISOString() })] }),
    }))
    expect(wrapper.text()).toContain('Guest notified')
    expect(wrapper.find('[data-testid="protection-settle"]').text()).toContain('Charge USD 80.00 to the saved card')
    expect(buttonNamed(wrapper, 'Charge USD 80.00')?.attributes('disabled')).toBeUndefined()
  })

  it('offers a retry after a declined charge, and the claims still stand', () => {
    const wrapper = mountSection(reservation({
      damageProtection: protection({
        state: 'charge_failed',
        chargeFailureReason: 'Card declined by issuer',
        chargeAttempts: 1,
        claims: [lamp({ guestNotifiedAt: new Date().toISOString() })],
      }),
    }))
    expect(buttonLabels(wrapper)).toContain('Retry charge')
    expect(wrapper.text()).toContain('Card declined by issuer')
    expect(wrapper.text()).toContain('USD 80.00 is still owed')
    expect(wrapper.text()).toContain('Broken lamp')
    expect(wrapper.find('[data-testid="protection-settled"]').exists()).toBe(false)
  })

  it('offers Record claim on a waiver, and no charge action', () => {
    const wrapper = mountSection(reservation({
      damageProtection: protection({ option: 'waiver', state: 'waiver_active', amount: 39, coverageCap: 2000, card: undefined }),
    }))
    const labels = buttonLabels(wrapper)
    expect(labels).toContain('Record claim')
    expect(wrapper.find('[data-testid="protection-settle"]').exists()).toBe(false)
  })

  it('spells out what was charged once settled, with no undo', () => {
    const wrapper = mountSection(reservation({
      damageProtection: protection({
        state: 'deposit_charged',
        chargedAt: new Date().toISOString(),
        chargedAmount: 80,
        claims: [lamp({ guestNotifiedAt: new Date().toISOString() })],
      }),
    }))
    const settled = wrapper.find('[data-testid="protection-settled"]').text()
    expect(settled).toContain('Broken lamp')
    expect(settled).toContain('Charged to the saved card')
    expect(settled).toContain('USD 80.00')
    expect(buttonLabels(wrapper)).not.toContain('Undo')
  })

  it('lets a deposit closed without a charge be reopened', () => {
    const wrapper = mountSection(reservation({
      damageProtection: protection({ state: 'deposit_released', releasedAt: new Date().toISOString() }),
    }))
    expect(wrapper.find('[data-testid="protection-settled"]').text()).toContain('Closed without a charge')
    expect(buttonLabels(wrapper)).toContain('Undo')
  })

  it('offers to download the evidence for each claim', () => {
    const wrapper = mountSection(reservation({
      damageProtection: protection({ claims: [lamp(), lamp({ id: 'clm-2', label: 'Scratched table' })] }),
    }))
    const buttons = wrapper.findAll('[data-testid="claim-download-evidence"]')
    expect(buttons).toHaveLength(2)
    expect(buttons[0]!.text()).toContain('Download evidence')
  })

  it('asks for a cancelled stay\'s card to be released, and offers no charge', () => {
    const wrapper = mountSection(reservation({ status: 'cancelled', damageProtection: protection() }))
    expect(wrapper.find('[data-testid="protection-cancelled-stay"]').text()).toContain('Release the saved card')
    expect(buttonLabels(wrapper)).toContain('Release card')
    expect(wrapper.find('[data-testid="protection-settle"]').exists()).toBe(false)
  })

  it('flags an excess above the cover as something to post by hand', () => {
    const wrapper = mountSection(reservation({
      damageProtection: protection({
        claims: [{
          id: 'clm-1',
          label: 'Flooded bathroom',
          amount: 800,
          coveredAmount: 500,
          excessAmount: 300,
          reason: 'Burst pipe left running',
          evidenceUrls: ['/mock/flood.jpg'],
          recordedBy: 'Komang Juliantara',
          recordedAt: new Date().toISOString(),
          guestNotifiedAt: new Date().toISOString(),
        }],
      }),
    }))
    expect(wrapper.text()).toContain('above the cover')
  })

  it('says where a claim\'s evidence came from', () => {
    const wrapper = mountSection(reservation({
      damageProtection: protection({
        claims: [{
          id: 'clm-1',
          label: 'Cracked shower screen',
          amount: 180,
          coveredAmount: 180,
          excessAmount: 0,
          reason: 'Reported at check-out cleaning',
          evidenceUrls: ['/mock/screen.jpg'],
          cleaningReport: {
            cleaningJobId: 'cln-a',
            findingId: 'cln-a:problem:b-1',
            finding: 'Cracked shower screen',
            checklistItem: 'Clean shower',
            photoUrls: ['/p/screen.jpg'],
            cleaningLabel: 'Check-out cleaning',
            reportedBy: 'Made Surya',
            reportedAt: new Date().toISOString(),
          },
          recordedBy: 'Komang Juliantara',
          recordedAt: new Date().toISOString(),
        }],
      }),
    }))
    const summary = wrapper.find('[data-testid="claim-evidence-summary"]').text()
    expect(summary).toMatch(/Evidence: check-out cleaning report of .+ with 1 photo, 1 file, by Made Surya/)
  })

  it('hands the stay\'s own finished cleaning reports to the claim dialog, and nobody else\'s', () => {
    const { jobs } = useCleaningJobs()
    const saved = jobs.value
    const report = {
      cleanlinessRating: 3,
      conditionNotes: '',
      damages: [],
      checklist: [{
        id: 'living',
        title: 'Living room',
        items: [{ id: 'l-1', label: 'Check rugs', status: 'problem' as const, notes: 'Wine stain', photoUrls: ['/p/rug.jpg'] }],
      }],
      itemsLeft: [],
      cleaningDurationMinutes: 90,
      housekeeperNotes: '',
    }
    const base = {
      listingId: 'lst-1',
      listingName: 'The R Villa Merapi',
      // After the stay's check-in, so the report follows the guest rather than
      // preparing for them.
      scheduledAt: `${isoDaysFromNow(10)}T11:00:00+08:00`,
      cleanerIds: [],
      cleanerNames: ['Made Surya'],
      teamName: null,
      priority: 'normal' as const,
      durationMinutes: 90,
      notes: '',
      source: 'check_out' as const,
    }
    jobs.value = [
      { ...base, id: 'cln-mine', status: 'done', reservationId: 'res-dpc-1', feedback: report },
      { ...base, id: 'cln-other', status: 'done', reservationId: 'res-other', feedback: report },
      { ...base, id: 'cln-unlinked', status: 'done', reservationId: null, feedback: report },
      { ...base, id: 'cln-pending', status: 'scheduled', reservationId: 'res-dpc-1', feedback: null },
    ]
    try {
      const wrapper = mountSection(reservation({ damageProtection: protection() }))
      expect(wrapper.find('[data-testid="claim-dialog-stub"]').attributes('data-reports')).toBe('cln-mine:1')
    }
    finally {
      jobs.value = saved
    }
  })

  // Regression: the section must carry its own accordion root. The detail sheet
  // mounts it as a sibling of the other sections, not inside a shared one.
  it('mounts inside a real accordion, so it brings its own root', () => {
    const entry = reservation({ damageProtection: protection() })
    expect(() => mountSectionWithRealAccordion(entry)).not.toThrow()

    const wrapper = mountSectionWithRealAccordion(entry)
    expect(wrapper.find('[data-testid="damage-protection-section"]').exists()).toBe(true)
  })
})
