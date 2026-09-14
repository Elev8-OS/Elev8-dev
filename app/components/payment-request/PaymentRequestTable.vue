<script setup lang="ts">
import type { PaymentRequest } from './data/payment-requests'
import { getStaffName } from './data/payment-requests'
import { listings } from '~/components/listings/data/listings'

const { requests } = defineProps<{
  requests: PaymentRequest[]
}>()

const emit = defineEmits<{
  view: [request: PaymentRequest]
  copy: [link: string]
  cancel: [id: string]
  duplicate: [id: string]
}>()

function getListingName(id: string) {
  return listings.value.find(l => l.id === id)?.name ?? id
}

function formatAmount(req: PaymentRequest) {
  const code = req.currency || 'USD'
  if (req.currency === 'IDR') {
    return `${code} ${req.amount.toLocaleString('id-ID')}`
  }
  return `${code} ${req.amount.toFixed(2)}`
}

function statusBadgeVariant(status: PaymentRequest['status']) {
  switch (status) {
    case 'pending': return 'default'
    case 'paid': return 'default'
    case 'expired': return 'secondary'
    case 'cancelled': return 'outline'
    default: return 'secondary'
  }
}

function statusIcon(status: PaymentRequest['status']) {
  switch (status) {
    case 'pending': return 'lucide:clock'
    case 'paid': return 'lucide:check-circle'
    case 'expired': return 'lucide:x-circle'
    case 'cancelled': return 'lucide:ban'
    default: return 'lucide:help-circle'
  }
}

function statusColor(status: PaymentRequest['status']) {
  switch (status) {
    case 'pending': return 'text-amber-600'
    case 'paid': return 'text-green-600'
    case 'expired': return 'text-gray-500'
    case 'cancelled': return 'text-gray-500'
    default: return ''
  }
}

function timeAgo(date: string) {
  const now = new Date()
  const then = new Date(date)
  const diff = Math.floor((now.getTime() - then.getTime()) / 1000)
  if (diff < 60)
    return 'Just now'
  if (diff < 3600)
    return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400)
    return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}
</script>

<template>
  <div class="rounded-lg border">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Guest</TableHead>
          <TableHead>Title</TableHead>
          <TableHead>Listing</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Created by</TableHead>
          <TableHead>Created</TableHead>
          <TableHead class="w-[60px]" />
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow v-for="req in requests" :key="req.id">
          <TableCell>
            <div class="min-w-0">
              <p class="font-medium">
                {{ req.guestName }}
              </p>
              <p class="text-xs text-muted-foreground">
                {{ req.guestEmail }}
              </p>
            </div>
          </TableCell>
          <TableCell>{{ req.title }}</TableCell>
          <TableCell>{{ getListingName(req.listingId) }}</TableCell>
          <TableCell>
            <div class="text-sm">
              {{ formatAmount(req) }}
              <span v-if="req.feeAmount > 0" class="text-xs text-muted-foreground">
                + fee
              </span>
            </div>
          </TableCell>
          <TableCell>
            <Badge :variant="statusBadgeVariant(req.status)" class="gap-1">
              <Icon :name="statusIcon(req.status)" class="size-3" :class="statusColor(req.status)" />
              {{ req.status }}
            </Badge>
          </TableCell>
          <TableCell class="text-muted-foreground">
            <div class="flex items-center gap-1.5">
              <span class="inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-medium">
                {{ getStaffName(req.createdBy).split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() }}
              </span>
              <span class="text-xs">{{ getStaffName(req.createdBy) }}</span>
            </div>
          </TableCell>
          <TableCell class="text-muted-foreground">
            {{ timeAgo(req.createdAt) }}
          </TableCell>
          <TableCell>
            <DropdownMenu>
              <DropdownMenuTrigger as-child>
                <Button variant="ghost" size="sm">
                  <Icon name="lucide:more-horizontal" class="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem @click="emit('view', req)">
                  <Icon name="lucide:eye" class="mr-2 size-4" />
                  View details
                </DropdownMenuItem>
                <DropdownMenuItem @click="emit('copy', req.paymentLink)">
                  <Icon name="lucide:copy" class="mr-2 size-4" />
                  Copy link
                </DropdownMenuItem>
                <DropdownMenuItem @click="emit('duplicate', req.id)">
                  <Icon name="lucide:copy-plus" class="mr-2 size-4" />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  v-if="req.status === 'pending'"
                  class="text-destructive"
                  @click="emit('cancel', req.id)"
                >
                  <Icon name="lucide:ban" class="mr-2 size-4" />
                  Cancel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </TableCell>
        </TableRow>
        <TableRow v-if="!requests.length">
          <TableCell colspan="8" class="h-32 text-center text-muted-foreground">
            No payment requests found.
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>
</template>
