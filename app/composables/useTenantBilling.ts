import type { Tenant } from '~/components/platform-console/data/tenants'
import { mockTenants } from '~/components/platform-console/data/tenants'
import type { TenantBilling } from '~/components/platform-console/data/tenant-billing'
import { defaultChargeAmount, deriveTenantBilling, seedTenantBilling, ymd } from '~/components/platform-console/data/tenant-billing'
import { STAFF_USERS } from '~/components/platform-console/data/staff'
import { usePlatformAudit } from '~/composables/usePlatformAudit'

export interface NextChargeAdjustment {
  /** Local YYYY-MM-DD of the next automatic charge. */
  date: string
  mode: 'default' | 'custom'
  /** Only read when `mode` is `custom`. */
  amount: number
  /** Custom only: keep the amount for later charges, not just the next one. */
  recurring: boolean
  note: string
}

/**
 * Mock subscription billing per tenant on the Platform Console Billing tab: health, next charge,
 * the next charge override, dunning and invoice history. Nothing here talks to Stripe.
 * The one thing staff can change is the next charge (date and amount).
 */
export function useTenantBilling() {
  const records = useState<Record<string, TenantBilling>>(
    'platform-tenant-billing',
    () => seedTenantBilling(JSON.parse(JSON.stringify(mockTenants))),
  )

  /** A tenant created after the seed still gets a record, derived on read and not stored. */
  function byTenant(tenant: Tenant): TenantBilling {
    return records.value[tenant.id] ?? deriveTenantBilling(tenant)
  }

  function save(tenantId: string, next: TenantBilling) {
    records.value = { ...records.value, [tenantId]: next }
  }

  function adjustNextCharge(tenant: Tenant, adj: NextChargeAdjustment): TenantBilling {
    const note = adj.note.trim()
    if (!adj.date) throw new Error('Pick the next charge date.')
    if (!note) throw new Error('Add a reason for the audit log.')
    if (adj.mode === 'custom' && !(adj.amount >= 0)) throw new Error('Enter a valid amount.')

    const current = byTenant(tenant)
    const custom = adj.mode === 'custom'
    const by = STAFF_USERS.find(s => s.id === 'staff-1')?.name ?? 'Elev8 staff'
    const next: TenantBilling = {
      ...current,
      nextChargeAt: adj.date,
      override: custom
        ? { amount: adj.amount, recurring: adj.recurring, note, by, at: ymd(new Date()) }
        : null,
    }
    save(tenant.id, next)

    const { log } = usePlatformAudit()
    log('next_charge_adjusted', 'tenant', tenant.id, {
      from: current.nextChargeAt,
      to: adj.date,
      mode: adj.mode,
      defaultAmount: defaultChargeAmount(tenant, current.cycle),
      amount: custom ? adj.amount : null,
      recurring: custom ? adj.recurring : false,
      note,
    })
    return next
  }

  /** Drops the override and keeps the date. */
  function revertNextCharge(tenant: Tenant): TenantBilling {
    const current = byTenant(tenant)
    const next: TenantBilling = { ...current, override: null }
    save(tenant.id, next)

    const { log } = usePlatformAudit()
    log('next_charge_reverted', 'tenant', tenant.id, {
      date: current.nextChargeAt,
      revertedAmount: current.override?.amount ?? null,
    })
    return next
  }

  return { records, byTenant, adjustNextCharge, revertNextCharge }
}
