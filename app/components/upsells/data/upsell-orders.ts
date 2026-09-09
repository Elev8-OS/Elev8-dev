export type OrderApprovalStatus = 'requested' | 'approved' | 'declined'
export type OrderPaymentStatus = 'unpaid' | 'awaiting_payment' | 'paid'
export type OrderFulfillmentStatus = 'not_started' | 'in_progress' | 'completed'
export type OrderStatus
  = | 'requested'
    | 'awaiting_payment'
    | 'paid_in_progress'
    | 'completed'
    | 'declined'

export interface UpsellOrderItem {
  id: string
  name: string
  price: number
  quantity: number
}

export interface UpsellOrder {
  id: string
  reservationId: string
  guestName: string
  guestEmail?: string
  serviceId: string
  serviceName: string
  serviceCategory: string
  items: UpsellOrderItem[]
  subtotal: number
  taxAmount: number
  serviceAmount: number
  grandTotal: number
  currency: string
  approvalStatus: OrderApprovalStatus
  paymentStatus: OrderPaymentStatus
  fulfillmentStatus: OrderFulfillmentStatus
  orderDate: string
  serviceDate: string
  serviceEndDate?: string
  checkInDate: string
  checkOutDate: string
  listing: string
  channel: string
  notes: string
  invoice?: string
  decisionReason?: string
  cancellationReason?: string
  cancellationBy?: 'guest' | 'staff'
  paymentMethod?: 'link' | 'manual' | 'cash' | 'card'
  source: 'inbox' | 'manual' | 'web'
  conversationId?: string
  /**
   * Smart-lock codes issued when this order was paid. Doubles as the idempotency guard:
   * `markPaid` fires from both the order drawer and the table dropdown, and a populated
   * array means access was already granted.
   */
  issuedAccessCodeIds?: string[]
  createdByStaffId: string
  approvalRequestedAt?: string
  approvedAt?: string
  declinedAt?: string
  paymentLinkSentAt?: string
  paidAt?: string
  fulfillmentStartedAt?: string
  completedAt?: string
  guestNotifiedAt?: string
  staffNotifiedAt?: string
  staffAssigned?: string
  createdAt: string
  updatedAt: string
}

export interface OrderStatusMeta {
  status: OrderStatus
  label: string
  color: string
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  requested: 'Requested',
  awaiting_payment: 'Awaiting Payment',
  paid_in_progress: 'Paid - In Progress',
  completed: 'Completed',
  declined: 'Declined',
}

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  requested: 'text-amber-700 bg-amber-50',
  awaiting_payment: 'text-indigo-700 bg-indigo-50',
  paid_in_progress: 'text-cyan-700 bg-cyan-50',
  completed: 'text-slate-700 bg-slate-100',
  declined: 'text-destructive bg-destructive/10',
}

export function getOrderStatus(order: Pick<UpsellOrder, 'approvalStatus' | 'paymentStatus' | 'fulfillmentStatus'>): OrderStatus {
  if (order.approvalStatus === 'declined')
    return 'declined'
  if (order.fulfillmentStatus === 'completed')
    return 'completed'
  if (order.fulfillmentStatus === 'in_progress')
    return 'paid_in_progress'
  if (order.paymentStatus === 'awaiting_payment')
    return 'awaiting_payment'
  if (order.paymentStatus === 'paid')
    return 'paid_in_progress'
  return 'requested'
}

export function getOrderStatusMeta(order: Pick<UpsellOrder, 'approvalStatus' | 'paymentStatus' | 'fulfillmentStatus'>): OrderStatusMeta {
  const status = getOrderStatus(order)
  return {
    status,
    label: ORDER_STATUS_LABELS[status],
    color: ORDER_STATUS_COLORS[status],
  }
}

export const mockUpsellOrders: UpsellOrder[] = [
  {
    id: 'ord-001',
    reservationId: '86109494',
    guestName: 'Thomas Wikes',
    guestEmail: 'thomas.wikes@email.com',
    serviceId: 'svc-001',
    serviceName: 'Airport Transfer (Ngurah Rai)',
    serviceCategory: 'Airport Transport',
    items: [
      { id: 'itm-001b', name: 'SUV (up to 5 pax)', price: 500000, quantity: 1 },
    ],
    subtotal: 500000,
    taxAmount: 55000,
    serviceAmount: 25000,
    grandTotal: 580000,
    currency: 'IDR',
    approvalStatus: 'approved',
    paymentStatus: 'paid',
    fulfillmentStatus: 'completed',
    orderDate: '2026-05-01',
    serviceDate: '2026-06-22',
    checkInDate: '2026-06-22',
    checkOutDate: '2026-06-24',
    listing: 'The R Villa Merapi',
    channel: 'Direct',
    notes: 'Flight arrives 14:30. Pickup with name board.',
    invoice: 'INV-ORD-001',
    staffAssigned: 'Komang Juliantara',
    source: 'manual',
    createdByStaffId: 'staff-2',
    approvalRequestedAt: '2026-04-28T10:00:00Z',
    approvedAt: '2026-04-28T10:15:00Z',
    paymentLinkSentAt: '2026-04-28T10:15:00Z',
    paidAt: '2026-04-28T11:00:00Z',
    fulfillmentStartedAt: '2026-06-22T13:30:00Z',
    completedAt: '2026-06-22T15:00:00Z',
    createdAt: '2026-04-28T10:00:00Z',
    updatedAt: '2026-05-01T15:00:00Z',
  },
  {
    id: 'ord-002',
    reservationId: '83828094',
    guestName: 'Mate Bezdek',
    guestEmail: 'mate.bezdek@email.com',
    serviceId: 'svc-002',
    serviceName: 'Private Chef - Dinner',
    serviceCategory: 'Private Chef',
    items: [
      { id: 'itm-002a', name: 'Balinese Set Menu', price: 1500000, quantity: 1 },
    ],
    subtotal: 1500000,
    taxAmount: 165000,
    serviceAmount: 75000,
    grandTotal: 1740000,
    currency: 'IDR',
    approvalStatus: 'approved',
    paymentStatus: 'awaiting_payment',
    fulfillmentStatus: 'not_started',
    orderDate: '2026-05-01',
    serviceDate: '2026-06-23',
    checkInDate: '2026-06-22',
    checkOutDate: '2026-05-05',
    listing: 'Nomad Mansion Garden',
    channel: 'Direct',
    notes: 'Dietary restriction: no shellfish. 4 guests.',
    invoice: 'INV-ORD-002',
    staffAssigned: 'Komang Juliantara',
    source: 'manual',
    createdByStaffId: 'staff-2',
    approvalRequestedAt: '2026-04-29T08:00:00Z',
    approvedAt: '2026-04-29T08:20:00Z',
    paymentLinkSentAt: '2026-04-29T08:20:00Z',
    createdAt: '2026-04-29T08:00:00Z',
    updatedAt: '2026-05-01T12:00:00Z',
  },
  {
    id: 'ord-003',
    reservationId: '85418022',
    guestName: 'Reto Wyss',
    guestEmail: 'reto.wyss@email.com',
    serviceId: 'svc-001',
    serviceName: 'Airport Transfer (Ngurah Rai)',
    serviceCategory: 'Airport Transport',
    items: [
      { id: 'itm-001a', name: 'Standard Sedan', price: 350000, quantity: 2 },
    ],
    subtotal: 700000,
    taxAmount: 77000,
    serviceAmount: 35000,
    grandTotal: 812000,
    currency: 'IDR',
    approvalStatus: 'approved',
    paymentStatus: 'paid',
    fulfillmentStatus: 'completed',
    orderDate: '2026-05-01',
    serviceDate: '2026-06-23',
    checkInDate: '2026-06-23',
    checkOutDate: '2026-06-27',
    listing: 'The R Pererenan Mezzanine Studio + Plunge Pool',
    channel: 'Direct',
    notes: '2 cars needed for 4 pax with luggage.',
    invoice: 'INV-ORD-003',
    staffAssigned: 'Komang Juliantara',
    source: 'manual',
    createdByStaffId: 'staff-2',
    approvalRequestedAt: '2026-04-30T09:00:00Z',
    approvedAt: '2026-04-30T09:12:00Z',
    paymentLinkSentAt: '2026-04-30T09:12:00Z',
    paidAt: '2026-04-30T09:45:00Z',
    fulfillmentStartedAt: '2026-06-23T07:00:00Z',
    completedAt: '2026-06-23T08:15:00Z',
    createdAt: '2026-04-30T09:00:00Z',
    updatedAt: '2026-05-01T16:00:00Z',
  },
  {
    id: 'ord-004',
    reservationId: '86266805',
    guestName: 'Cameron Skillcorn',
    guestEmail: 'cameron.s@email.com',
    serviceId: 'svc-003',
    serviceName: 'In-Villa Spa Treatment',
    serviceCategory: 'Spa',
    items: [
      { id: 'itm-003c', name: 'Body Scrub + Massage', price: 1100000, quantity: 2 },
    ],
    subtotal: 2200000,
    taxAmount: 242000,
    serviceAmount: 0,
    grandTotal: 2442000,
    currency: 'IDR',
    approvalStatus: 'approved',
    paymentStatus: 'paid',
    fulfillmentStatus: 'completed',
    orderDate: '2026-05-04',
    serviceDate: '2026-06-23',
    checkInDate: '2026-05-01',
    checkOutDate: '2026-05-06',
    listing: 'Villa Sunset Cliff',
    channel: 'Direct',
    notes: 'Couples treatment. Arrive at 15:00.',
    invoice: 'INV-ORD-004',
    staffAssigned: 'Komang Juliantara',
    source: 'manual',
    createdByStaffId: 'staff-2',
    approvalRequestedAt: '2026-06-22T14:00:00Z',
    approvedAt: '2026-06-22T14:40:00Z',
    paymentLinkSentAt: '2026-06-22T14:40:00Z',
    paidAt: '2026-06-22T15:10:00Z',
    fulfillmentStartedAt: '2026-06-23T14:30:00Z',
    completedAt: '2026-06-23T18:00:00Z',
    createdAt: '2026-06-22T14:00:00Z',
    updatedAt: '2026-05-04T18:00:00Z',
  },
  {
    id: 'ord-005',
    reservationId: '86413147',
    guestName: 'James Alizada',
    guestEmail: 'james.a@email.com',
    serviceId: 'svc-008',
    serviceName: 'Vehicle Rental',
    serviceCategory: 'Vehicle Rental',
    items: [
      { id: 'itm-008a', name: 'Scooter (Automatic)', price: 120000, quantity: 2 },
    ],
    subtotal: 240000,
    taxAmount: 26400,
    serviceAmount: 12000,
    grandTotal: 278400,
    currency: 'IDR',
    approvalStatus: 'approved',
    paymentStatus: 'paid',
    fulfillmentStatus: 'in_progress',
    orderDate: '2026-05-06',
    serviceDate: '2026-06-24',
    serviceEndDate: '2026-05-09',
    checkInDate: '2026-05-05',
    checkOutDate: '2026-06-25',
    listing: 'Nomad Mansion Pool',
    channel: 'Booking.com',
    notes: '3-day rental each. International licenses confirmed.',
    invoice: 'INV-ORD-005',
    staffAssigned: 'Komang Juliantara',
    source: 'manual',
    createdByStaffId: 'staff-2',
    approvalRequestedAt: '2026-05-04T10:00:00Z',
    approvedAt: '2026-05-04T10:30:00Z',
    paymentLinkSentAt: '2026-05-04T10:30:00Z',
    paidAt: '2026-05-04T11:05:00Z',
    fulfillmentStartedAt: '2026-06-24T09:00:00Z',
    createdAt: '2026-05-04T10:00:00Z',
    updatedAt: '2026-05-06T08:00:00Z',
  },
  {
    id: 'ord-006',
    reservationId: '86555874',
    guestName: 'Cameron Skillcorn',
    guestEmail: 'cameron.s@email.com',
    serviceId: 'svc-001',
    serviceName: 'Airport Transfer (Ngurah Rai)',
    serviceCategory: 'Airport Transport',
    items: [
      { id: 'itm-001c', name: 'Minivan (up to 8 pax)', price: 650000, quantity: 1 },
    ],
    subtotal: 650000,
    taxAmount: 71500,
    serviceAmount: 32500,
    grandTotal: 754000,
    currency: 'IDR',
    approvalStatus: 'requested',
    paymentStatus: 'unpaid',
    fulfillmentStatus: 'not_started',
    orderDate: '2026-06-27',
    serviceDate: '2026-06-25',
    checkInDate: '2026-06-25',
    checkOutDate: '2026-05-18',
    listing: 'The R Villa Merapi',
    channel: 'Direct',
    notes: 'Flight arrives 23:45. Late night pickup surcharge applies.',
    staffAssigned: 'Komang Juliantara',
    source: 'manual',
    createdByStaffId: 'staff-2',
    approvalRequestedAt: '2026-06-27T09:00:00Z',
    createdAt: '2026-05-08T11:00:00Z',
    updatedAt: '2026-06-27T09:00:00Z',
  },
  {
    id: 'ord-007',
    reservationId: '84721653',
    guestName: 'Amanda Healey',
    guestEmail: 'amanda.h@email.com',
    serviceId: 'svc-003',
    serviceName: 'In-Villa Spa Treatment',
    serviceCategory: 'Spa',
    items: [
      { id: 'itm-003a', name: 'Balinese Massage', price: 800000, quantity: 1 },
    ],
    subtotal: 800000,
    taxAmount: 88000,
    serviceAmount: 0,
    grandTotal: 888000,
    currency: 'IDR',
    approvalStatus: 'requested',
    paymentStatus: 'unpaid',
    fulfillmentStatus: 'not_started',
    orderDate: '2026-05-11',
    serviceDate: '2026-06-25',
    checkInDate: '2026-06-27',
    checkOutDate: '2026-05-15',
    listing: 'Beachfront Bungalow Seminyak',
    channel: 'Booking.com',
    notes: 'Guest prefers female therapist.',
    staffAssigned: 'Komang Juliantara',
    source: 'manual',
    createdByStaffId: 'staff-2',
    approvalRequestedAt: '2026-05-11T10:00:00Z',
    createdAt: '2026-05-09T16:00:00Z',
    updatedAt: '2026-05-11T10:00:00Z',
  },
  {
    id: 'ord-008',
    reservationId: '86596428',
    guestName: 'Khasan Alshalabi',
    guestEmail: 'khasan.a@email.com',
    serviceId: 'svc-005',
    serviceName: 'Surf Lesson at Canggu',
    serviceCategory: 'Activity',
    items: [
      { id: 'itm-005a', name: 'Beginner Lesson', price: 500000, quantity: 1 },
      { id: 'itm-005b', name: 'Intermediate Lesson', price: 600000, quantity: 1 },
    ],
    subtotal: 1100000,
    taxAmount: 121000,
    serviceAmount: 0,
    grandTotal: 1221000,
    currency: 'IDR',
    approvalStatus: 'approved',
    paymentStatus: 'awaiting_payment',
    fulfillmentStatus: 'not_started',
    orderDate: '2026-05-11',
    serviceDate: '2026-06-25',
    checkInDate: '2026-06-27',
    checkOutDate: '2026-05-14',
    listing: 'Villa Sunset Cliff',
    channel: 'Direct',
    notes: '2 guests: 1 beginner, 1 intermediate. Same instructor preferred.',
    invoice: 'INV-ORD-008',
    staffAssigned: 'Komang Juliantara',
    source: 'manual',
    createdByStaffId: 'staff-2',
    approvalRequestedAt: '2026-05-09T10:00:00Z',
    approvedAt: '2026-05-09T10:25:00Z',
    paymentLinkSentAt: '2026-05-09T10:25:00Z',
    createdAt: '2026-05-09T10:00:00Z',
    updatedAt: '2026-05-11T14:00:00Z',
  },
  {
    id: 'ord-009',
    reservationId: '86470236',
    guestName: 'Mikhail Batkovsky',
    guestEmail: 'mikhail.b@email.com',
    serviceId: 'svc-010',
    serviceName: 'Mid-stay Deep Cleaning',
    serviceCategory: 'Mid-stay Cleaning',
    items: [
      { id: 'itm-010b', name: 'Deep Clean + Laundry', price: 600000, quantity: 1 },
    ],
    subtotal: 600000,
    taxAmount: 66000,
    serviceAmount: 0,
    grandTotal: 666000,
    currency: 'IDR',
    approvalStatus: 'requested',
    paymentStatus: 'unpaid',
    fulfillmentStatus: 'not_started',
    orderDate: '2026-06-25',
    serviceDate: '2026-06-26',
    checkInDate: '2026-05-08',
    checkOutDate: '2026-05-15',
    listing: 'Surf Shack Canggu',
    channel: 'Direct',
    notes: 'Schedule for May 13 when guest is on day trip.',
    staffAssigned: 'Made Surya',
    source: 'manual',
    createdByStaffId: 'staff-2',
    approvalRequestedAt: '2026-06-25T11:00:00Z',
    createdAt: '2026-06-27T08:00:00Z',
    updatedAt: '2026-06-25T11:00:00Z',
  },
  {
    id: 'ord-010',
    reservationId: '85418022',
    guestName: 'Reto Wyss',
    guestEmail: 'reto.wyss@email.com',
    serviceId: 'svc-006',
    serviceName: 'Late Check-out (until 2pm)',
    serviceCategory: 'Late Check-out',
    items: [
      { id: 'itm-006a', name: 'Late Check-out', price: 450000, quantity: 1 },
    ],
    subtotal: 450000,
    taxAmount: 49500,
    serviceAmount: 0,
    grandTotal: 499500,
    currency: 'IDR',
    approvalStatus: 'declined',
    paymentStatus: 'unpaid',
    fulfillmentStatus: 'not_started',
    orderDate: '2026-05-08',
    serviceDate: '2026-06-27',
    checkInDate: '2026-06-23',
    checkOutDate: '2026-06-27',
    listing: 'The R Pererenan Mezzanine Studio + Plunge Pool',
    channel: 'Direct',
    notes: 'Next-day booking blocked this request. Refunded.',
    staffAssigned: 'Komang Juliantara',
    source: 'manual',
    createdByStaffId: 'staff-2',
    decisionReason: 'Next-day booking blocked availability.',
    cancellationReason: 'Next-day booking blocked availability.',
    cancellationBy: 'staff',
    declinedAt: '2026-05-08T16:00:00Z',
    createdAt: '2026-06-24T09:00:00Z',
    updatedAt: '2026-05-08T16:00:00Z',
  },
  {
    id: 'ord-011',
    reservationId: 'R-2026-0521',
    guestName: 'Emma Thompson',
    guestEmail: 'emma.thompson@email.com',
    serviceId: 'svc-003',
    serviceName: 'In-Villa Spa Treatment',
    serviceCategory: 'Spa',
    items: [
      { id: 'itm-003a', name: 'Balinese Massage', price: 800000, quantity: 1 },
      { id: 'itm-003b', name: 'Aromatherapy Massage', price: 900000, quantity: 1 },
    ],
    subtotal: 1700000,
    taxAmount: 187000,
    serviceAmount: 0,
    grandTotal: 1887000,
    currency: 'IDR',
    approvalStatus: 'approved',
    paymentStatus: 'awaiting_payment',
    fulfillmentStatus: 'not_started',
    orderDate: '2026-05-20',
    serviceDate: '2026-06-28',
    checkInDate: '2026-05-27',
    checkOutDate: '2026-06-03',
    listing: 'Volcano View Villa Kintamani',
    channel: 'Airbnb',
    notes: 'Guest accepted upsell offer from inbox. Requested afternoon slot.',
    staffAssigned: 'Komang Juliantara',
    source: 'inbox',
    conversationId: 'conv-21',
    createdByStaffId: 'staff-2',
    approvalRequestedAt: '2026-05-20T14:16:00Z',
    approvedAt: '2026-05-20T14:35:00Z',
    paymentLinkSentAt: '2026-05-20T14:35:00Z',
    guestNotifiedAt: '2026-05-20T14:36:00Z',
    createdAt: '2026-05-20T14:16:00Z',
    updatedAt: '2026-05-20T15:30:00Z',
  },
  {
    id: 'ord-012',
    reservationId: 'res-11',
    guestName: 'Marcus Johnson',
    guestEmail: 'marcus.johnson@email.com',
    serviceId: 'svc-011',
    serviceName: 'Pool & Wellness Area Access',
    serviceCategory: 'Activity',
    items: [
      { id: 'itm-011a', name: 'Pool & Wellness Access', price: 350000, quantity: 1 },
    ],
    subtotal: 350000,
    taxAmount: 38500,
    serviceAmount: 0,
    grandTotal: 388500,
    currency: 'IDR',
    approvalStatus: 'approved',
    paymentStatus: 'awaiting_payment',
    fulfillmentStatus: 'not_started',
    orderDate: '2026-09-08',
    serviceDate: '2026-09-10',
    checkInDate: '2026-09-07',
    checkOutDate: '2026-09-14',
    listing: 'The R Villa Merapi',
    channel: 'Airbnb',
    notes: 'Smart lock demo. Mark as paid to auto-issue the Pool Gate code.',
    staffAssigned: 'Komang Juliantara',
    source: 'inbox',
    conversationId: 'conv-11',
    createdByStaffId: 'staff-2',
    approvalRequestedAt: '2026-09-08T09:10:00Z',
    approvedAt: '2026-09-08T09:12:00Z',
    paymentLinkSentAt: '2026-09-08T09:12:00Z',
  },
  {
    id: 'ord-013',
    reservationId: 'res-4',
    guestName: 'Alex Rivera',
    guestEmail: 'alex.rivera@email.com',
    serviceId: 'svc-012',
    serviceName: 'Private Workspace Access',
    serviceCategory: 'Office Equipment',
    items: [
      { id: 'itm-012a', name: 'Workspace Access', price: 500000, quantity: 1 },
    ],
    subtotal: 500000,
    taxAmount: 55000,
    serviceAmount: 25000,
    grandTotal: 580000,
    currency: 'IDR',
    approvalStatus: 'requested',
    paymentStatus: 'unpaid',
    fulfillmentStatus: 'not_started',
    orderDate: '2026-09-09',
    serviceDate: '2026-09-11',
    checkInDate: '2026-09-09',
    checkOutDate: '2026-09-16',
    listing: 'The R Villa Merapi',
    channel: 'Airbnb',
    notes: 'Smart lock demo, by-request path. Approve first, then mark as paid.',
    source: 'inbox',
    conversationId: 'conv-4',
    createdByStaffId: 'staff-2',
    approvalRequestedAt: '2026-09-09T08:05:00Z',
  },
]
