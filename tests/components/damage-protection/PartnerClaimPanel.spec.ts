import type { DamageProtection, PartnerClaim, ProtectionClaim, ReservationEntry } from '~/components/reservations/data/reservations'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PartnerClaimPanel from '~/components/damage-protection/PartnerClaimPanel.vue'
import { elev8CoverPartner } from '~/components/reservations/data/damage-protection-seed'
import { newPartnerClaim } from '~/components/reservations/data/partner-claims'
import { payoutAccounts } from '~/components/settings/data/payouts'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Textarea } from '~/components/ui/textarea'
import { useReservationsModule } from '~/composables/useReservationsModule'

vi.mock('vue-sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))

const PROTECTION: DamageProtection = {
  policyId: 'dp-standard',
  option: 'waiver',
  state: 'waiver_active',
  amount: 39,
  coverageCap: 2000,
  currency: 'USD',
  termsVersion: 'v1',
  termsText: 'Terms',
  acceptedAt: '2026-09-01T00:00:00.000Z',
  acceptedVia: 'guest_guide',
  claims: [],
}

function claim(patch: Partial<ProtectionClaim> = {}): ProtectionClaim {
  return {
    id: 'clm-1',
    label: 'Scorched worktop',
    amount: 320,
    coveredAmount: 320,
    excessAmount: 0,
    reason: 'Found',
    evidenceUrls: [],
    recordedBy: 'Komang',
    recordedAt: '2026-09-01T00:00:00.000Z',
    guestNotifiedAt: '2026-09-01T00:00:00.000Z',
    ...patch,
  }
}

function filed(patch: Partial<PartnerClaim>): PartnerClaim {
  return {
    ...newPartnerClaim(elev8CoverPartner, 220, { id: 'pay-1', accountName: 'Stripe Bali Main' }),
    status: 'submitted',
    partnerClaimRef: 'PC-1',
    events: [],
    ...patch,
  }
}

/** The panel writes through the store, so the claim it shows must live there too. */
function mountPanel(c: ProtectionClaim) {
  const protection = { ...PROTECTION, claims: [c] }
  useReservationsModule().reservations.value = [{ id: 'res-1', activity: [], damageProtection: protection } as unknown as ReservationEntry]
  return mount(PartnerClaimPanel, {
    props: { reservationId: 'res-1', listingId: 'lst-1', protection, claim: c, canEdit: true },
    global: {
      components: { Button, Input, Label, Textarea },
      stubs: { Icon: true, Switch: { template: '<button />' } },
    },
  })
}

beforeEach(() => {
  useReservationsModule().reset()
})

describe('partnerClaimPanel', () => {
  it('says how much can be claimed, where it will be paid, and offers to submit', () => {
    const wrapper = mountPanel(claim())
    expect(wrapper.find('[data-testid="partner-claim-eligible"]').text()).toContain('less the USD 100.00 deductible')
    expect(wrapper.find('[data-testid="partner-claim-eligible"]').text()).toContain('USD 220.00 can be claimed')
    expect(wrapper.find('[data-testid="partner-claim-destination"]').text()).toBe('Paid into your Stripe payout account Stripe Bali Main.')
    expect(wrapper.findAll('button').some(b => b.text() === 'Submit to partner')).toBe(true)
  })

  it('leaves a claim below the deductible with the pot, with nothing to submit', () => {
    const wrapper = mountPanel(claim({ coveredAmount: 60, amount: 60 }))
    expect(wrapper.find('[data-testid="partner-claim-below"]').text()).toContain('the waiver pot carries it')
    expect(wrapper.findAll('button').some(b => b.text() === 'Submit to partner')).toBe(false)
  })

  it('disables submitting when the tenant has no Stripe payout account, and says where to fix it', () => {
    const saved = payoutAccounts.value
    payoutAccounts.value = saved.filter(a => a.provider !== 'stripe')
    try {
      const wrapper = mountPanel(claim())
      const submit = wrapper.findAll('button').find(b => b.text() === 'Submit to partner')!
      expect(submit.attributes('disabled')).toBeDefined()
      expect(wrapper.find('[data-testid="partner-claim-no-account"]').text()).toContain('Settings, Payouts')
    }
    finally {
      payoutAccounts.value = saved
    }
  })

  it('shows a filed claim\'s status, amounts, reference and timeline', () => {
    const wrapper = mountPanel(claim({ partnerClaim: filed({
      status: 'approved',
      approvedAmount: 200,
      events: [{ id: 'e1', at: '2026-09-02T00:00:00.000Z', status: 'submitted', source: 'api' }],
    }) }))
    expect(wrapper.find('[data-testid="partner-claim-status"]').text()).toBe('Approved')
    const amounts = wrapper.find('[data-testid="partner-claim-amounts"]').text()
    expect(amounts).toContain('USD 220.00')
    expect(amounts).toContain('USD 200.00')
    expect(wrapper.text()).toContain('Partner ref PC-1')
    expect(wrapper.find('[data-testid="partner-claim-timeline"]').text()).toContain('partner API')
  })

  it('shows the partner\'s question and a way to answer it', () => {
    const wrapper = mountPanel(claim({ partnerClaim: filed({ status: 'info_requested', infoRequest: 'Send the invoice' }) }))
    const box = wrapper.find('[data-testid="partner-claim-info-request"]')
    expect(box.text()).toContain('Send the invoice')
    expect(box.find('textarea').exists()).toBe(true)
  })

  it('asks staff to confirm a payment landed, prefilled with what the partner sent', () => {
    const wrapper = mountPanel(claim({ partnerClaim: filed({ status: 'paid', approvedAmount: 220, paidAmount: 220, payoutReference: 'TRF-1' }) }))
    const box = wrapper.find('[data-testid="partner-claim-confirm"]')
    expect(box.text()).toContain('TRF-1')
    expect(box.text()).toContain('Stripe payout account Stripe Bali Main')
    expect((box.find('input').element as HTMLInputElement).value).toBe('220')
  })

  it('flags money that arrived short of the approval', () => {
    const wrapper = mountPanel(claim({ partnerClaim: filed({ status: 'received', approvedAmount: 600, paidAmount: 600, receivedAmount: 585 }) }))
    expect(wrapper.find('[data-testid="partner-claim-shortfall"]').text()).toContain('USD 15.00 less than approved')
  })

  it('offers only the partner responses that can follow the current status', async () => {
    const wrapper = mountPanel(claim({ partnerClaim: filed({ status: 'approved', approvedAmount: 220 }) }))
    await wrapper.findAll('button').find(b => b.text().includes('Simulate partner response'))!.trigger('click')
    const labels = wrapper.find('[data-testid="partner-claim-simulator"]').findAll('button').map(b => b.text())
    expect(labels).toEqual(['Schedule payout', 'Send payment'])
  })

  it('offers nothing further once the money is received', () => {
    const wrapper = mountPanel(claim({ partnerClaim: filed({ status: 'received', approvedAmount: 220, paidAmount: 220, receivedAmount: 220 }) }))
    expect(wrapper.text()).not.toContain('Simulate partner response')
    expect(wrapper.text()).not.toContain('Withdraw claim')
  })
})
