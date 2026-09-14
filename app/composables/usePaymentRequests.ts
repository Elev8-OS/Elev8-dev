import type { PaymentRequest, PaymentRequestDraft, PaymentStatus } from '~/components/payment-request/data/payment-requests'
import { calculateFee, calculateTotal, generateId, generatePaymentLink, getExpiryDate, paymentRequests } from '~/components/payment-request/data/payment-requests'
import { payoutAccounts } from '~/components/settings/data/payouts'

export interface PaymentRequestFilters {
  status: PaymentStatus | 'all'
  listings: string[]
  dateFrom: string
  dateTo: string
  search: string
}

export function usePaymentRequests() {
  const requests = useState<PaymentRequest[]>('payment-requests', () => paymentRequests.value)
  const filters = ref<PaymentRequestFilters>({
    status: 'all',
    listings: [],
    dateFrom: '',
    dateTo: '',
    search: '',
  })

  const filteredRequests = computed(() => {
    return requests.value.filter((request) => {
      if (filters.value.status !== 'all' && request.status !== filters.value.status)
        return false
      if (filters.value.listings.length > 0 && !filters.value.listings.includes(request.listingId))
        return false
      if (filters.value.dateFrom && request.createdAt < filters.value.dateFrom)
        return false
      if (filters.value.dateTo && request.createdAt > filters.value.dateTo)
        return false
      if (filters.value.search) {
        const query = filters.value.search.toLowerCase()
        const haystack = `${request.guestName} ${request.guestEmail} ${request.title}`.toLowerCase()
        if (!haystack.includes(query))
          return false
      }
      return true
    })
  })

  const pendingCount = computed(() => requests.value.filter(r => r.status === 'pending').length)
  const paidCount = computed(() => requests.value.filter(r => r.status === 'paid').length)
  const totalRevenue = computed(() => {
    return requests.value
      .filter(r => r.status === 'paid')
      .reduce((sum, r) => sum + r.totalAmount, 0)
  })

  function createRequest(draft: PaymentRequestDraft): PaymentRequest {
    const id = generateId()
    const feeAmount = calculateFee(draft.amount, draft.feeMode, draft.customFeePercentage)
    const totalAmount = calculateTotal(draft.amount, feeAmount)
    const account = payoutAccounts.value.find(a => a.id === getAccountForListing(draft.listingId))
    const currency = draft.currency || account?.currency || 'USD'

    const request: PaymentRequest = {
      id,
      ...draft,
      currency,
      feeAmount,
      totalAmount,
      status: 'pending',
      payoutAccountId: account?.id ?? '',
      paymentLink: generatePaymentLink(id),
      expiresAt: getExpiryDate(draft.expiresInHours),
      createdAt: new Date().toISOString(),
      createdBy: 'staff-2',
    }

    requests.value = [request, ...requests.value]
    return request
  }

  function cancelRequest(id: string, reason?: string) {
    const index = requests.value.findIndex(r => r.id === id)
    if (index === -1)
      return
    requests.value = requests.value.map((r, i) =>
      i === index
        ? { ...r, status: 'cancelled' as PaymentStatus, cancelledAt: new Date().toISOString(), cancelledBy: 'staff-2', notes: reason }
        : r,
    )
  }

  function duplicateRequest(id: string): PaymentRequest | null {
    const original = requests.value.find(r => r.id === id)
    if (!original)
      return null
    const draft: PaymentRequestDraft = {
      guestName: original.guestName,
      guestEmail: original.guestEmail,
      guestPhone: original.guestPhone,
      listingId: original.listingId,
      title: `${original.title} (Copy)`,
      description: original.description,
      amount: original.amount,
      currency: original.currency,
      feeMode: original.feeMode,
      expiresInHours: 24,
    }
    return createRequest(draft)
  }

  function checkDuplicate(guestName: string, amount: number): boolean {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    return requests.value.some(r =>
      r.guestName.toLowerCase() === guestName.toLowerCase()
      && r.amount === amount
      && r.status === 'pending'
      && r.createdAt > oneHourAgo,
    )
  }

  function expireOldRequests() {
    const now = new Date().toISOString()
    requests.value = requests.value.map((r) => {
      if (r.status === 'pending' && r.expiresAt < now) {
        return { ...r, status: 'expired' as PaymentStatus }
      }
      return r
    })
  }

  function getAccountForListing(listingId: string): string {
    const account = payoutAccounts.value.find(a => a.listingIds.includes(listingId))
    return account?.id ?? ''
  }

  function isListingAssigned(listingId: string): boolean {
    return payoutAccounts.value.some(a => a.listingIds.includes(listingId))
  }

  return {
    requests,
    filters,
    filteredRequests,
    pendingCount,
    paidCount,
    totalRevenue,
    createRequest,
    cancelRequest,
    duplicateRequest,
    checkDuplicate,
    expireOldRequests,
    getAccountForListing,
    isListingAssigned,
  }
}
