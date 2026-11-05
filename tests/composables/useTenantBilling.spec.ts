import { beforeEach, describe, expect, it } from 'vitest'
import { addDays, addMonths, defaultChargeAmount, deriveTenantBilling, dunningSteps, formatMoney, isCriticalDunning, ymd } from '~/components/platform-console/data/tenant-billing'
import { usePlatformAudit } from '~/composables/usePlatformAudit'
import { useTenantBilling } from '~/composables/useTenantBilling'
import { useTenants } from '~/composables/useTenants'

;(globalThis as any).usePlatformAudit = usePlatformAudit

describe('tenant billing data', () => {
  it('formats money as code then amount, no symbol', () => {
    expect(formatMoney(1299)).toBe('USD 1,299.00')
    expect(formatMoney(0.5, 'USD')).toBe('USD 0.50')
  })

  it('adds months clamped to the last day', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonths('2026-11-05', 1)).toBe('2026-12-05')
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02')
  })

  it('uses the annual total as default for a yearly plan', () => {
    expect(defaultChargeAmount({ mrrUsd: 2499 }, 'yearly')).toBe(29988)
    expect(defaultChargeAmount({ mrrUsd: 899 }, 'monthly')).toBe(899)
  })

  it('derives billing states from the seeded tenants', () => {
    const t = (id: string) => useTenants().byId(id)!
    const now = new Date(2026, 10, 5)
    expect(deriveTenantBilling(t('t-1'), now).health).toBe('paid')
    expect(deriveTenantBilling(t('t-1'), now).nextChargeAt).toBe('2026-12-01')
    expect(deriveTenantBilling(t('t-2'), now).cycle).toBe('yearly')
    expect(deriveTenantBilling(t('t-4'), now).hasPaymentMethod).toBe(false)
    expect(deriveTenantBilling(t('t-3'), now).dunning?.kind).toBe('booking')
    expect(deriveTenantBilling(t('t-3'), now).nextChargeAt).toBeNull()
    expect(deriveTenantBilling(t('t-5'), now).nextChargeAt).toBeNull()
    expect(deriveTenantBilling(t('t-8'), now).invoices).toEqual([])
    expect(deriveTenantBilling(t('t-10'), now).override?.amount).toBe(449)
  })

  it('builds the retry ladder and closes it with the suspension', () => {
    const d = deriveTenantBilling(useTenants().byId('t-6')!, new Date(2026, 10, 5)).dunning!
    const steps = dunningSteps(d)
    expect(steps.map(s => s.state)).toEqual(['done', 'current', 'upcoming', 'suspend'])
    expect(steps[0]!.date).toBe(ymd(new Date(2026, 10, 2)))
    expect(steps[1]!.date).toBe(ymd(new Date(2026, 10, 5)))
    expect(steps.at(-1)!.date).toBe(d.suspendOn)
    expect(isCriticalDunning(d)).toBe(true)
  })
})

describe('useTenantBilling', () => {
  beforeEach(() => {
    useTenantBilling().records.value = {}
  })

  it('falls back to a derived record for a tenant without one', () => {
    const tenant = useTenants().byId('t-1')!
    expect(useTenantBilling().byTenant(tenant).tenantId).toBe('t-1')
  })

  it('saves a custom next charge, logs it, and reverts without moving the date', () => {
    const tenant = useTenants().byId('t-1')!
    const { adjustNextCharge, revertNextCharge, byTenant } = useTenantBilling()
    const { auditLog } = usePlatformAudit()
    const before = auditLog.value.length

    adjustNextCharge(tenant, { date: '2027-01-15', mode: 'custom', amount: 700, recurring: false, note: ' Loyalty discount ' })
    expect(byTenant(tenant).nextChargeAt).toBe('2027-01-15')
    expect(byTenant(tenant).override).toMatchObject({ amount: 700, recurring: false, note: 'Loyalty discount' })
    expect(auditLog.value.at(-1)).toMatchObject({ action: 'next_charge_adjusted', targetId: 't-1' })

    revertNextCharge(tenant)
    expect(byTenant(tenant).override).toBeNull()
    expect(byTenant(tenant).nextChargeAt).toBe('2027-01-15')
    expect(auditLog.value.at(-1)).toMatchObject({ action: 'next_charge_reverted' })
    expect(auditLog.value.length).toBe(before + 2)
  })

  it('refuses a missing reason, date or negative amount', () => {
    const tenant = useTenants().byId('t-1')!
    const { adjustNextCharge } = useTenantBilling()
    expect(() => adjustNextCharge(tenant, { date: '2027-01-15', mode: 'default', amount: 0, recurring: false, note: '  ' })).toThrow('reason')
    expect(() => adjustNextCharge(tenant, { date: '', mode: 'default', amount: 0, recurring: false, note: 'x' })).toThrow('date')
    expect(() => adjustNextCharge(tenant, { date: '2027-01-15', mode: 'custom', amount: -1, recurring: false, note: 'x' })).toThrow('amount')
  })

  it('a default-mode save clears an existing override', () => {
    const tenant = useTenants().byId('t-10')!
    const { adjustNextCharge, byTenant, records } = useTenantBilling()
    records.value = { [tenant.id]: deriveTenantBilling(tenant) }
    expect(byTenant(tenant).override).not.toBeNull()
    adjustNextCharge(tenant, { date: '2027-02-05', mode: 'default', amount: 0, recurring: false, note: 'Back to normal' })
    expect(byTenant(tenant).override).toBeNull()
  })
})
