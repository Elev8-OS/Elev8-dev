<script setup lang="ts">
import type { GuestRegistration } from './data/guest-registration'
import { computed } from 'vue'
import { listings } from '~/components/listings/data/listings'
import { buildApoaPayload, buildAvsPayload, providerLabels, statusLabels } from './data/guest-registration'

const props = defineProps<{
  registration: GuestRegistration | null
}>()

const emit = defineEmits<{
  close: []
  submit: [reg: GuestRegistration]
}>()

const gr = useGuestRegistration()

const open = computed({
  get: () => props.registration !== null,
  set: (val: boolean) => {
    if (!val)
      emit('close')
  },
})

const payload = computed(() => {
  if (!props.registration)
    return null
  const reg = props.registration
  const connection = gr.getAccountForListing(reg.listingId, reg.provider)
  const listing = listings.value.find(l => l.id === reg.listingId)
  return reg.provider === 'apoa'
    ? buildApoaPayload(reg, connection, listing)
    : buildAvsPayload(reg, connection, listing)
})

const payloadRows = computed(() => {
  if (!payload.value)
    return []
  return Object.entries(payload.value).map(([key, value]) => ({
    key,
    value: String(value ?? ''),
  }))
})

function statusBadgeVariant(status: GuestRegistration['status']) {
  switch (status) {
    case 'submitted': return 'default'
    case 'pending': return 'secondary'
    case 'failed': return 'destructive'
    case 'void': return 'outline'
    case 'incomplete': return 'secondary'
  }
}
</script>

<template>
  <Dialog :open="open" @update:open="open = $event">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <Icon name="lucide:file-badge" class="size-4 text-muted-foreground" />
          {{ providerLabels[registration!.provider] }} — {{ registration!.guestName }}
        </DialogTitle>
        <DialogDescription>
          {{ registration!.listingName }} · {{ registration!.checkIn }} → {{ registration!.checkOut }}
        </DialogDescription>
      </DialogHeader>

      <div v-if="registration" class="space-y-4">
        <!-- Status -->
        <div class="flex items-center gap-2">
          <Badge :variant="statusBadgeVariant(registration.status)">
            {{ statusLabels[registration.status] }}
          </Badge>
          <span v-if="registration.status === 'incomplete'" class="text-xs text-muted-foreground">
            Complete the guest profile in Reservations to enable submission.
          </span>
        </div>

        <!-- Submission proof -->
        <div v-if="registration.status === 'submitted'" class="rounded-lg border border-green-600/30 bg-green-50 p-3 text-sm text-green-800">
          <div class="flex items-center gap-2 font-medium">
            <Icon name="lucide:check-circle-2" class="size-4" />
            Submitted
          </div>
          <p class="mt-1 text-xs">
            Reference: <span class="font-mono">{{ registration.submissionId }}</span>
          </p>
          <p v-if="registration.submittedAt" class="text-[11px] text-green-700/70">
            {{ new Date(registration.submittedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) }}
          </p>
        </div>
        <div v-else-if="registration.status === 'failed'" class="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <div class="flex items-center gap-2 font-medium">
            <Icon name="lucide:alert-circle" class="size-4" />
            Submission failed
          </div>
          <p class="mt-1 text-xs">
            {{ registration.error }}
          </p>
        </div>

        <!-- Payload preview -->
        <div class="rounded-lg border bg-card overflow-hidden">
          <div class="border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
            Payload sent to {{ providerLabels[registration.provider] }}
          </div>
          <div class="divide-y">
            <div
              v-for="row in payloadRows"
              :key="row.key"
              class="flex items-start gap-3 px-3 py-1.5 text-xs"
            >
              <span class="w-44 shrink-0 font-mono text-muted-foreground">{{ row.key }}</span>
              <span class="min-w-0 break-words font-mono">{{ row.value || '—' }}</span>
            </div>
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button
          v-if="registration && (registration.status === 'pending' || registration.status === 'failed')"
          variant="outline"
          @click="emit('submit', registration)"
        >
          <Icon name="lucide:send" class="size-4" />
          {{ registration.status === 'failed' ? 'Re-submit' : 'Submit report' }}
        </Button>
        <Button variant="outline" @click="emit('close')">
          Close
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
