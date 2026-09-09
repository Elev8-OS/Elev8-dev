import type {
  OrderStatus,
  UpsellOrder,
} from '@/components/upsells/data/upsell-orders'
import { computed } from 'vue'
import { calculateRefund, getPolicyForService } from '@/components/upsells/data/cancellation-policies'
import { getOrderStatus, mockUpsellOrders } from '@/components/upsells/data/upsell-orders'
import { useUpsellLockAccess } from './useUpsellLockAccess'

export function useUpsellOrders() {
  const orders = useState<UpsellOrder[]>('upsell-orders', () =>
    mockUpsellOrders.map(o => ({ ...o })))

  const filterStatus = ref<OrderStatus | 'all'>('all')
  const filterService = ref<string>('all')
  const filterDateFrom = ref('')
  const filterDateTo = ref('')
  const searchValue = ref('')

  function matchesSearch(order: UpsellOrder, query: string) {
    const q = query.toLowerCase()
    return (
      order.guestName.toLowerCase().includes(q)
      || order.serviceName.toLowerCase().includes(q)
      || order.reservationId.includes(q)
      || order.listing.toLowerCase().includes(q)
    )
  }

  const filteredOrders = computed(() => {
    return orders.value.filter((o) => {
      const status = getOrderStatus(o)
      if (filterStatus.value !== 'all' && status !== filterStatus.value)
        return false
      if (filterService.value !== 'all' && o.serviceId !== filterService.value)
        return false
      if (filterDateFrom.value && o.orderDate < filterDateFrom.value)
        return false
      if (filterDateTo.value && o.orderDate > filterDateTo.value)
        return false
      if (searchValue.value && !matchesSearch(o, searchValue.value))
        return false
      return true
    })
  })

  const statusCounts = computed(() => {
    const counts = {
      all: orders.value.length,
      requested: 0,
      awaiting_payment: 0,
      paid_in_progress: 0,
      completed: 0,
      declined: 0,
    }

    for (const order of orders.value) {
      counts[getOrderStatus(order)] += 1
    }

    return counts
  })

  const totalRevenue = computed(() => {
    return orders.value
      .filter(o => getOrderStatus(o) !== 'declined')
      .reduce((sum, o) => sum + o.grandTotal, 0)
  })

  function patchOrder(id: string, updater: (order: UpsellOrder) => UpsellOrder) {
    orders.value = orders.value.map(o => (o.id === id ? updater(o) : o))
  }

  function updateLifecycle(
    id: string,
    updates: Partial<Pick<UpsellOrder, 'approvalStatus' | 'paymentStatus' | 'fulfillmentStatus' | 'decisionReason' | 'cancellationReason' | 'cancellationBy' | 'paymentMethod' | 'approvalRequestedAt' | 'approvedAt' | 'declinedAt' | 'paymentLinkSentAt' | 'paidAt' | 'fulfillmentStartedAt' | 'completedAt' | 'updatedAt'>>,
  ) {
    patchOrder(id, order => ({
      ...order,
      ...updates,
      updatedAt: new Date().toISOString(),
    }))
  }

  function approveOrder(id: string) {
    patchOrder(id, (order) => {
      const now = new Date().toISOString()
      return {
        ...order,
        approvalStatus: 'approved',
        paymentStatus: 'awaiting_payment',
        fulfillmentStatus: 'not_started',
        approvedAt: now,
        paymentLinkSentAt: now,
        approvalRequestedAt: order.approvalRequestedAt ?? now,
        updatedAt: now,
      }
    })
  }

  function declineOrder(id: string, reason: string, declinedBy: 'guest' | 'staff' = 'staff') {
    // A refunded order must not leave a working code behind. `cancelOrder` routes through
    // here, so this covers both the decline and the cancellation path.
    const existing = orders.value.find(o => o.id === id)
    if (existing?.issuedAccessCodeIds?.length)
      useUpsellLockAccess().revokeAccessForOrder(existing)

    patchOrder(id, (order) => {
      const now = new Date().toISOString()
      return {
        ...order,
        approvalStatus: 'declined',
        paymentStatus: 'unpaid',
        fulfillmentStatus: 'not_started',
        decisionReason: reason,
        cancellationReason: reason,
        cancellationBy: declinedBy,
        declinedAt: now,
        updatedAt: now,
      }
    })
  }

  function reopenDeclinedOrder(id: string) {
    patchOrder(id, (order) => {
      const now = new Date().toISOString()
      return {
        ...order,
        approvalStatus: 'requested',
        paymentStatus: 'unpaid',
        fulfillmentStatus: 'not_started',
        decisionReason: undefined,
        cancellationReason: undefined,
        cancellationBy: undefined,
        declinedAt: undefined,
        approvalRequestedAt: order.approvalRequestedAt ?? now,
        updatedAt: now,
      }
    })
  }

  function markPaymentAwaiting(id: string) {
    updateLifecycle(id, {
      paymentStatus: 'awaiting_payment',
    })
  }

  /**
   * Hand the guest their smart-lock code, if the purchased service grants one.
   *
   * Fire-and-forget: `generateAccessCode` is a 700ms mock and `markPaid` is synchronous,
   * so the drawer renders its spinner off `useUpsellLockAccess().isIssuing`. The issued
   * ids are written back here rather than inside `useUpsellLockAccess`, so that composable
   * never has to import this one.
   */
  function issueLockAccess(id: string) {
    const order = orders.value.find(o => o.id === id)
    if (!order)
      return
    void useUpsellLockAccess().issueAccessForOrder(order).then((result) => {
      if (result.codeIds.length === 0)
        return
      patchOrder(id, current => ({
        ...current,
        issuedAccessCodeIds: [...(current.issuedAccessCodeIds ?? []), ...result.codeIds],
        updatedAt: new Date().toISOString(),
      }))
    })
  }

  function markPaid(id: string, paymentMethod: 'link' | 'manual' | 'cash' | 'card' = 'manual') {
    patchOrder(id, (order) => {
      const now = new Date().toISOString()
      return {
        ...order,
        approvalStatus: order.approvalStatus === 'requested' ? 'approved' : order.approvalStatus,
        paymentStatus: 'paid',
        fulfillmentStatus: 'in_progress',
        paymentMethod,
        paidAt: now,
        fulfillmentStartedAt: order.fulfillmentStartedAt ?? now,
        approvedAt: order.approvedAt ?? now,
        paymentLinkSentAt: order.paymentLinkSentAt ?? now,
        updatedAt: now,
      }
    })
    issueLockAccess(id)
  }

  function startFulfillment(id: string) {
    patchOrder(id, (order) => {
      const now = new Date().toISOString()
      return {
        ...order,
        fulfillmentStatus: 'in_progress',
        fulfillmentStartedAt: now,
        updatedAt: now,
      }
    })
  }

  function completeFulfillment(id: string) {
    patchOrder(id, (order) => {
      const now = new Date().toISOString()
      return {
        ...order,
        fulfillmentStatus: 'completed',
        completedAt: now,
        updatedAt: now,
      }
    })
  }

  function updateStatus(id: string, status: OrderStatus) {
    switch (status) {
      case 'requested':
        reopenDeclinedOrder(id)
        break
      case 'awaiting_payment':
        markPaymentAwaiting(id)
        break
      case 'paid_in_progress':
        startFulfillment(id)
        break
      case 'completed':
        completeFulfillment(id)
        break
      case 'declined':
        declineOrder(id, 'Declined by staff', 'staff')
        break
    }
  }

  function addOrder(data: Omit<UpsellOrder, 'id' | 'createdAt' | 'updatedAt'>) {
    const now = new Date().toISOString()
    const id = `ord-${String(orders.value.length + 1).padStart(3, '0')}`
    orders.value = [...orders.value, {
      ...data,
      id,
      createdAt: now,
      updatedAt: now,
    }]
  }

  function cancelOrder(id: string, reason: string, cancelledBy: 'guest' | 'staff') {
    const order = orders.value.find(o => o.id === id)
    if (!order)
      return null

    const policy = getPolicyForService(order.serviceId)
    const refund = policy
      ? calculateRefund(order.grandTotal, order.serviceDate, new Date().toISOString(), policy, cancelledBy)
      : { refundAmount: order.grandTotal, refundPercent: 100, lateFee: 0, reason: 'No policy — full refund' }

    declineOrder(id, reason, cancelledBy)

    return refund
  }

  function clearFilters() {
    filterStatus.value = 'all'
    filterService.value = 'all'
    filterDateFrom.value = ''
    filterDateTo.value = ''
    searchValue.value = ''
  }

  return {
    orders,
    filteredOrders,
    statusCounts,
    totalRevenue,
    filterStatus,
    filterService,
    filterDateFrom,
    filterDateTo,
    searchValue,
    updateLifecycle,
    approveOrder,
    declineOrder,
    reopenDeclinedOrder,
    markPaymentAwaiting,
    markPaid,
    startFulfillment,
    completeFulfillment,
    updateStatus,
    issueLockAccess,
    addOrder,
    cancelOrder,
    clearFilters,
  }
}
