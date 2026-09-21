import type { DamageProtection, ReservationEntry } from '~/components/reservations/data/reservations'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ReservationDamageProtectionSection from '~/components/reservations/ReservationDamageProtectionSection.vue'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Label } from '~/components/ui/label'
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
    state: 'deposit_held',
    amount: 500,
    currency: 'USD',
    termsVersion: 'v1',
    termsText: 'Terms',
    acceptedAt: new Date().toISOString(),
    acceptedVia: 'guest_guide',
    claims: [],
    ...patch,
  }
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

  it('renders nothing on a channel the policy skips', () => {
    const wrapper = mountSection(reservation({ channel: 'Airbnb' }))
    expect(wrapper.text()).toBe('')
  })

  it('offers to record the choice when the guest has not answered', () => {
    const wrapper = mountSection(reservation())
    expect(wrapper.text()).toContain('The guest has not chosen yet')
    expect(buttonLabels(wrapper)).toContain('Record choice for guest')
  })

  it('offers Charge now while a deposit is pending', () => {
    const wrapper = mountSection(reservation({
      damageProtection: protection({ state: 'deposit_pending', chargeDueAt: new Date().toISOString() }),
    }))
    expect(buttonLabels(wrapper)).toContain('Charge now')
  })

  it('offers both a retry and a switch to the waiver after a declined charge', () => {
    const wrapper = mountSection(reservation({
      damageProtection: protection({ state: 'deposit_failed', failureReason: 'Card declined by issuer', failedAttempts: 1 }),
    }))
    const labels = buttonLabels(wrapper)
    expect(labels).toContain('Retry charge')
    expect(labels).toContain('Switch to waiver')
    expect(wrapper.text()).toContain('Card declined by issuer')
  })

  it('offers a retry after a rejected refund, and does not read as settled', () => {
    const wrapper = mountSection(reservation({
      damageProtection: protection({ state: 'refund_failed', refundFailureReason: 'Refund rejected by the payment provider' }),
    }))
    expect(buttonLabels(wrapper)).toContain('Retry refund')
    expect(wrapper.text()).toContain('Refund rejected by the payment provider')
    expect(wrapper.text()).not.toContain('Refunded on cancellation')
  })

  it('offers Record claim on a waiver and no release action', () => {
    const wrapper = mountSection(reservation({
      damageProtection: protection({ option: 'waiver', state: 'waiver_active', amount: 39, coverageCap: 2000 }),
    }))
    const labels = buttonLabels(wrapper)
    expect(labels).toContain('Record claim')
    expect(labels).not.toContain('Release deposit')
  })

  it('blocks release while a claim is unnotified and says why', () => {
    const wrapper = mountSection(reservation({
      damageProtection: protection({
        claims: [{
          id: 'clm-1',
          label: 'Broken lamp',
          amount: 80,
          coveredAmount: 80,
          excessAmount: 0,
          reason: 'Found at checkout',
          evidenceUrls: ['/mock/lamp.jpg'],
          recordedBy: 'Komang Juliantara',
          recordedAt: new Date().toISOString(),
        }],
      }),
    }))
    expect(wrapper.text()).toContain('Guest not notified')
    expect(buttonLabels(wrapper)).toContain('Notify guest')
    const release = wrapper.findAll('button').find(b => b.text().trim() === 'Release deposit')
    expect(release?.attributes('disabled')).toBeDefined()
  })

  it('enables release once every claim is notified', () => {
    const wrapper = mountSection(reservation({
      damageProtection: protection({
        claims: [{
          id: 'clm-1',
          label: 'Broken lamp',
          amount: 80,
          coveredAmount: 80,
          excessAmount: 0,
          reason: 'Found at checkout',
          evidenceUrls: ['/mock/lamp.jpg'],
          recordedBy: 'Komang Juliantara',
          recordedAt: new Date().toISOString(),
          guestNotifiedAt: new Date().toISOString(),
        }],
      }),
    }))
    expect(wrapper.text()).toContain('Guest notified')
    const release = wrapper.findAll('button').find(b => b.text().trim() === 'Release deposit')
    expect(release?.attributes('disabled')).toBeUndefined()
  })

  it('spells out the release arithmetic once settled', () => {
    const wrapper = mountSection(reservation({
      damageProtection: protection({
        state: 'deposit_partial',
        refundedAt: new Date().toISOString(),
        refundedAmount: 420,
        claims: [{
          id: 'clm-1',
          label: 'Broken lamp',
          amount: 80,
          coveredAmount: 80,
          excessAmount: 0,
          reason: 'Found at checkout',
          evidenceUrls: ['/mock/lamp.jpg'],
          recordedBy: 'Komang Juliantara',
          recordedAt: new Date().toISOString(),
          guestNotifiedAt: new Date().toISOString(),
        }],
      }),
    }))
    const text = wrapper.text()
    expect(text).toContain('USD 500.00')
    expect(text).toContain('Broken lamp')
    expect(text).toContain('USD 420.00')
    expect(buttonLabels(wrapper)).toContain('Undo')
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
})
