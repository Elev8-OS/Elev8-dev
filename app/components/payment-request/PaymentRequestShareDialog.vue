<script setup lang="ts">
import type { PaymentRequest } from './data/payment-requests'
import { toast } from 'vue-sonner'

const { request } = defineProps<{
  request: PaymentRequest | null
}>()

const emit = defineEmits<{
  close: []
}>()

const copied = ref(false)

function copyLink() {
  if (!request)
    return
  navigator.clipboard.writeText(request.paymentLink)
  copied.value = true
  toast.success('Link copied to clipboard')
  setTimeout(() => copied.value = false, 2000)
}

function shareWhatsApp() {
  if (!request)
    return
  const text = `Hi ${request.guestName}, here's your payment link: ${request.paymentLink}`
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
}

function shareEmail() {
  if (!request)
    return
  const subject = encodeURIComponent(`Payment Request: ${request.title}`)
  const body = encodeURIComponent(`Hi ${request.guestName},\n\nPlease complete your payment using this link:\n${request.paymentLink}\n\nAmount: ${request.currency} ${request.totalAmount}\n\nThank you!`)
  window.open(`mailto:${request.guestEmail}?subject=${subject}&body=${body}`)
}
</script>

<template>
  <Dialog :open="!!request" @update:open="(v) => { if (!v) emit('close') }">
    <DialogContent class="max-w-sm">
      <DialogHeader>
        <DialogTitle>Share Payment Link</DialogTitle>
      </DialogHeader>

      <div v-if="request" class="space-y-4">
        <div class="flex items-center gap-3 rounded-lg border bg-muted/20 p-3">
          <div class="min-w-0 flex-1">
            <p class="text-xs text-muted-foreground truncate">
              {{ request.paymentLink }}
            </p>
          </div>
          <Button size="sm" variant="outline" @click="copyLink">
            <Icon v-if="copied" name="lucide:check" class="size-4 text-green-600" />
            <Icon v-else name="lucide:copy" class="size-4" />
          </Button>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <Button variant="outline" class="flex-col gap-1 h-auto py-3" @click="shareWhatsApp">
            <Icon name="lucide:message-circle" class="size-5" />
            <span class="text-xs">WhatsApp</span>
          </Button>
          <Button variant="outline" class="flex-col gap-1 h-auto py-3" @click="shareEmail">
            <Icon name="lucide:mail" class="size-5" />
            <span class="text-xs">Email</span>
          </Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
