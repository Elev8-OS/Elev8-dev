import type { LockAccessConfig } from '~/components/upsells/data/lock-access'
import type { UpsellOrder } from '~/components/upsells/data/upsell-orders'
import type { AccessCode, SmartLock } from '~/composables/useSmartLock'
import { computed } from 'vue'
import { listings as allListings } from '~/components/listings/data/listings'
import {
  accessPurposeLabel,
  buildAccessWindow,
  formatGuestAccessMessage,
  resolveLockTargets,
} from '~/components/upsells/data/lock-access'
import { useNotifications } from './useNotifications'
import { useSmartLock } from './useSmartLock'
import { useUpsellServices } from './useUpsellServices'

export type LockAccessSkipReason
  = | 'already_issued'
    | 'no_access_configured'
    | 'not_connected'
    | 'listing_not_found'
    | 'no_lock_matched'

export interface LockAccessResult {
  /** Codes actually created by this call. Empty whenever `skipped` is set. */
  issued: AccessCode[]
  codeIds: string[]
  skipped?: LockAccessSkipReason
  /** Lock names the service asks for that this property has no lock for. */
  unmatchedNames: string[]
}

/**
 * Bridges a paid upsell order to the smart-lock store: resolves which locks the purchased
 * service unlocks at that property, issues a code per lock, tells the guest, and tells staff.
 *
 * Revocation is the mirror image, so a declined or refunded order never leaves a working
 * code behind.
 */
export function useUpsellLockAccess() {
  const smartLock = useSmartLock()
  const { services } = useUpsellServices()
  const notifications = useNotifications()

  /** Orders currently having codes issued, so the drawer can show a spinner. */
  const issuingOrderIds = useState<string[]>('upsell-lock-access-issuing', () => [])

  function isIssuing(orderId: string): boolean {
    return issuingOrderIds.value.includes(orderId)
  }

  function lockAccessConfigFor(serviceId: string): LockAccessConfig | undefined {
    return services.value.find(s => s.id === serviceId)?.lockAccess
  }

  /** Orders carry a listing NAME; locks are keyed by listing id. Same lookup the inbox uses. */
  function listingIdForOrder(order: Pick<UpsellOrder, 'listing'>): string | undefined {
    return allListings.value.find(l => l.name === order.listing)?.id
  }

  function locksForOrder(order: Pick<UpsellOrder, 'listing'>): SmartLock[] {
    const listingId = listingIdForOrder(order)
    if (!listingId)
      return []
    return smartLock.getLocksForListing(listingId)
  }

  /** The locks a paid order would (or did) hand over, with any names this property cannot answer. */
  function resolveTargetsForOrder(order: Pick<UpsellOrder, 'listing' | 'serviceId'>) {
    return resolveLockTargets(lockAccessConfigFor(order.serviceId), locksForOrder(order))
  }

  /** Codes this order issued, newest first. Reads live state, not the snapshot on the order. */
  function issuedCodesFor(order: Pick<UpsellOrder, 'issuedAccessCodeIds'>): AccessCode[] {
    const ids = order.issuedAccessCodeIds ?? []
    if (ids.length === 0)
      return []
    return smartLock.codes.value.filter(c => ids.includes(c.id))
  }

  function hasLiveAccess(order: Pick<UpsellOrder, 'issuedAccessCodeIds'>): boolean {
    return issuedCodesFor(order).some(c => c.status === 'active')
  }

  function providerFor(lock: SmartLock) {
    return smartLock.allDevices.value.find(d => d.deviceId === lock.providerDeviceId)?.provider
  }

  /**
   * Issue the purchased access. Returns the new code ids so the caller can store them on the
   * order. This composable deliberately does not write to `useUpsellOrders`, because
   * `useUpsellOrders` calls into here and the two would import each other.
   */
  async function issueAccessForOrder(order: UpsellOrder): Promise<LockAccessResult> {
    const empty = { issued: [], codeIds: [], unmatchedNames: [] }

    const config = lockAccessConfigFor(order.serviceId)
    if (!config?.enabled || config.lockNames.length === 0)
      return { ...empty, skipped: 'no_access_configured' }

    // A paid order can be marked paid twice (order drawer and table dropdown both call it).
    if (hasLiveAccess(order))
      return { ...empty, skipped: 'already_issued' }

    if (!smartLock.isConnected.value) {
      notifyFailure(order, 'the smart lock integration is not connected')
      return { ...empty, skipped: 'not_connected' }
    }

    const listingId = listingIdForOrder(order)
    if (!listingId) {
      notifyFailure(order, `no listing matches "${order.listing}"`)
      return { ...empty, skipped: 'listing_not_found' }
    }

    const { matched, unmatchedNames } = resolveLockTargets(config, smartLock.getLocksForListing(listingId))
    if (matched.length === 0) {
      notifyFailure(order, `no lock named ${unmatchedNames.map(n => `"${n}"`).join(', ')} is paired here`)
      return { ...empty, skipped: 'no_lock_matched', unmatchedNames }
    }

    issuingOrderIds.value = [...issuingOrderIds.value, order.id]
    try {
      const window = buildAccessWindow(order)
      const purpose = accessPurposeLabel(order)
      const issued: AccessCode[] = []

      for (const lock of matched) {
        // Reuse the guest's existing code value for this brand, so one number opens every
        // lock of that make, the same rule the pairing flow already follows.
        const provider = providerFor(lock)
        const shared = provider ? smartLock.findActiveBrandCode(order.reservationId, provider) : undefined

        const result = await smartLock.generateAccessCode({
          lockId: lock.id,
          reservationId: order.reservationId,
          guestName: order.guestName,
          purpose,
          code: shared,
          startsAt: window.startsAt,
          endsAt: window.endsAt,
          scheduleType: window.scheduleType,
        })
        if (result.success && result.code)
          issued.push(result.code)
      }

      if (issued.length === 0) {
        notifyFailure(order, 'the lock rejected every code request')
        return { ...empty, skipped: 'no_lock_matched', unmatchedNames }
      }

      const entries = issued.map(code => ({
        lockName: matched.find(l => l.id === code.lockId)?.name ?? 'Lock',
        code: code.code,
      }))

      notifications.createAlert('UPSELL_LOCK_ACCESS_ISSUED', 'INFO', {
        orderId: order.id,
        guestName: order.guestName,
        serviceName: order.serviceName,
        serviceDate: order.serviceDate,
        lockNames: entries.map(e => e.lockName).join(', '),
        listing_id: listingId,
        listing_name: order.listing,
      })

      if (unmatchedNames.length > 0)
        notifyFailure(order, `no lock named ${unmatchedNames.map(n => `"${n}"`).join(', ')} is paired here`)

      await messageGuest(order, entries, window.endsAt, config.instructions)

      return { issued, codeIds: issued.map(c => c.id), unmatchedNames }
    }
    finally {
      issuingOrderIds.value = issuingOrderIds.value.filter(id => id !== order.id)
    }
  }

  /** Revoke everything this order handed out. Called when an order is declined or cancelled. */
  function revokeAccessForOrder(order: Pick<UpsellOrder, 'issuedAccessCodeIds'>): number {
    const live = issuedCodesFor(order).filter(c => c.status === 'active')
    live.forEach(c => smartLock.revokeAccessCode(c.id))
    return live.length
  }

  function notifyFailure(order: UpsellOrder, reason: string) {
    notifications.createAlert('UPSELL_LOCK_ACCESS_FAILED', 'WARNING', {
      orderId: order.id,
      guestName: order.guestName,
      serviceName: order.serviceName,
      serviceDate: order.serviceDate,
      reason,
      listing_id: listingIdForOrder(order) ?? null,
      listing_name: order.listing,
    })
  }

  /**
   * Send the code to the guest in the thread the order came from.
   *
   * ⚠️ `useInbox` imports `useUpsellOrders`, which calls into this composable, so a static
   * import here would close a cycle. This is already an async path, so the dynamic import
   * costs nothing. Do not "tidy" it into a top-level import.
   */
  async function messageGuest(
    order: UpsellOrder,
    entries: Array<{ lockName: string, code: string }>,
    endsAt: string,
    instructions?: string,
  ) {
    if (!order.conversationId)
      return
    try {
      const { useInbox } = await import('./useInbox')
      const inbox = useInbox()
      const conversation = inbox.conversations.value.find(c => c.id === order.conversationId)
      inbox.sendMessage(
        order.conversationId,
        formatGuestAccessMessage(order.guestName, entries, endsAt, instructions),
        conversation?.otaSource ?? 'Direct',
      )
    }
    catch {
      // A missing thread must not fail the purchase: the code is already issued and the
      // order drawer still shows it.
    }
  }

  const ordersWithLockAccess = computed(() =>
    services.value.filter(s => s.lockAccess?.enabled && s.lockAccess.lockNames.length > 0).map(s => s.id),
  )

  return {
    issuingOrderIds,
    isIssuing,
    lockAccessConfigFor,
    listingIdForOrder,
    locksForOrder,
    resolveTargetsForOrder,
    issuedCodesFor,
    hasLiveAccess,
    issueAccessForOrder,
    revokeAccessForOrder,
    ordersWithLockAccess,
  }
}
