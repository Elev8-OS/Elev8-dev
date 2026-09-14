<script setup lang="ts">
import type { PaymentRequest } from './data/payment-requests'
import { getStaffName } from './data/payment-requests'
import { listings } from '~/components/listings/data/listings'
import { payoutAccounts } from '~/components/settings/data/payouts'

const { request } = defineProps<{
  request: PaymentRequest | null
}>()

const emit = defineEmits<{
  copy: [link: string]
  cancel: [id: string]
}>()

function getListingName(id: string) {
  return listings.value.find(l => l.id === id)?.name ?? id
}

function getAccountName(id: string) {
  return payoutAccounts.value.find(a => a.id === id)?.accountName ?? id
}

function formatDate(date: string) {
  return new Date(date).toLocaleString()
}

function statusBannerClass(status: PaymentRequest['status']) {
  switch (status) {
    case 'pending': return 'bg-amber-50 border-amber-200 text-amber-800'
    case 'paid': return 'bg-green-50 border-green-200 text-green-800'
    case 'expired': return 'bg-gray-50 border-gray-200 text-gray-600'
    case 'cancelled': return 'bg-gray-50 border-gray-200 text-gray-600'
    default: return ''
  }
}

function formatAmount(req: PaymentRequest) {
  const code = req.currency || 'USD'
  if (req.currency === 'IDR')
    return `${code} ${req.amount.toLocaleString('id-ID')}`
  return `${code} ${req.amount.toFixed(2)}`
}
</script>

<template>
  <Dialog :open="!!request" @update:open="(v) => { if (!v) $emit('update:open', false) }">
    <DialogContent class="max-w-md">
      <DialogHeader>
        <DialogTitle>Payment Request</DialogTitle>
        <DialogDescription>{{ request?.id }}</DialogDescription>
      </DialogHeader>

      <div v-if="request" class="space-y-4">
        <div class="rounded-lg border p-3" :class="statusBannerClass(request.status)">
          <div class="flex items-center gap-2">
            <Icon
              :name="request.status === 'pending' ? 'lucide:clock' : request.status === 'paid' ? 'lucide:check-circle' : 'lucide:x-circle'"
              class="size-4"
            />
            <span class="font-medium capitalize">{{ request.status }}</span>
          </div>
          <p v-if="request.status === 'pending'" class="mt-1 text-xs">
            Waiting for guest payment. Expires {{ formatDate(request.expiresAt) }}.
          </p>
          <p v-else-if="request.status === 'paid'" class="mt-1 text-xs">
            Paid on {{ formatDate(request.paidAt!) }}.
          </p>
          <p v-else-if="request.status === 'expired'" class="mt-1 text-xs">
            Expired on {{ formatDate(request.expiresAt) }}.
          </p>

        </div>

        <div class="space-y-3">
          <div class="grid grid-cols-2 gap-3">
            <div>
              <Label class="text-xs text-muted-foreground">Guest</Label>
              <p class="text-sm font-medium">
                {{ request.guestName }}
              </p>
              <p class="text-sm text-muted-foreground">
                {{ request.guestEmail }}
              </p>
            </div>
            <div>
              <Label class="text-xs text-muted-foreground">Created by</Label>
              <div class="flex items-center gap-1.5">
                <span class="inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-medium">
                  {{ getStaffName(request.createdBy).split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() }}
                </span>
                <p class="text-sm">
                  {{ getStaffName(request.createdBy) }}
                </p>
              </div>
              <p class="text-xs text-muted-foreground">
                {{ formatDate(request.createdAt) }}
              </p>
            </div>
          </div>

          <Separator />

          <div class="grid grid-cols-2 gap-3">
            <div>
              <Label class="text-xs text-muted-foreground">Listing</Label>
              <p class="text-sm">
                {{ getListingName(request.listingId) }}
              </p>
            </div>
            <div>
              <Label class="text-xs text-muted-foreground">Account</Label>
              <p class="text-sm">
                {{ getAccountName(request.payoutAccountId) }}
              </p>
            </div>
          </div>

          <div>
            <Label class="text-xs text-muted-foreground">Title</Label>
            <p class="text-sm">
              {{ request.title }}
            </p>
          </div>

          <div class="rounded-lg border bg-muted/20 p-3 space-y-1">
            <div class="flex justify-between text-sm">
              <span class="text-muted-foreground">Amount</span>
              <span>{{ formatAmount(request) }}</span>
            </div>
            <div v-if="request.feeAmount > 0" class="flex justify-between text-sm">
              <span class="text-muted-foreground">
                Fee ({{ request.feeMode === 'card' ? '3%' : request.feeMode === 'manual' ? `${request.customFeePercentage ?? 0}%` : '0%' }})
              </span>
              <span>{{ formatAmount({ ...request, amount: request.feeAmount }) }}</span>
            </div>
            <Separator />
            <div class="flex justify-between text-sm font-medium">
              <span>Total</span>
              <span>{{ formatAmount({ ...request, amount: request.totalAmount }) }}</span>
            </div>
          </div>

          <div v-if="request.status === 'cancelled'" class="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
            <Label class="text-xs text-destructive">Cancellation</Label>
            <p class="mt-1 text-sm">
              Cancelled by <span class="font-medium">{{ getStaffName(request.cancelledBy!) }}</span> on {{ formatDate(request.cancelledAt!) }}
            </p>
            <p v-if="request.notes" class="mt-1 text-xs text-muted-foreground">
              Reason: {{ request.notes }}
            </p>
          </div>

          <div v-if="request.status === 'pending'">
            <Label class="text-xs text-muted-foreground">Payment Link</Label>
            <div class="mt-1 flex items-center gap-2">
              <Input readonly :model-value="request.paymentLink" class="text-xs" />
              <Button size="sm" variant="outline" @click="emit('copy', request.paymentLink)">
                <Icon name="lucide:copy" class="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <DialogFooter class="gap-2">
        <Button v-if="request?.status === 'pending'" variant="destructive" @click="emit('cancel', request.id)">
          Cancel Request
        </Button>
        <Button v-if="request?.status === 'paid'" variant="outline">
          <Icon name="lucide:file-text" class="mr-2 size-4" />
          View Receipt
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
