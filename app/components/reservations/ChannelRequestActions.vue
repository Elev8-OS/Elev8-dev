<script setup lang="ts">
import type { ReservationEntry } from './data/reservations'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import { useChannelRequests } from '~/composables/useChannelRequests'
import { declineReasonsFor } from './data/channel-requests'

/**
 * Accept / Decline for a request to book or an Airbnb alteration. Declining a
 * request asks for the reason the channel requires; declining a change does
 * not. Shared by the reservation sheet, the Reservations list and the Inbox.
 */
const props = defineProps<{ reservation: ReservationEntry, size?: 'sm' | 'default' }>()

const { acceptRequest, declineRequest, acceptAlteration, declineAlteration } = useChannelRequests()

const isRequest = computed(() => props.reservation.status === 'request')
const busy = ref<'accept' | 'decline' | null>(null)
const reasonOpen = ref(false)
const reason = ref('')
const reasons = computed(() => declineReasonsFor(props.reservation.channel))

async function run(kind: 'accept' | 'decline', action: () => Promise<{ ok: boolean, error?: string }>, done: string) {
  busy.value = kind
  const result = await action()
  busy.value = null
  if (!result.ok) {
    toast.error(result.error ?? 'Could not send the answer')
    return
  }
  toast.success(done, { description: `${props.reservation.guestName}, ${props.reservation.listingName}` })
}

function accept() {
  const r = props.reservation
  run('accept', () => isRequest.value ? acceptRequest(r.id) : acceptAlteration(r.id), isRequest.value ? 'Request accepted' : 'Change accepted')
}

function decline() {
  if (isRequest.value) {
    reason.value = ''
    reasonOpen.value = true
    return
  }
  run('decline', () => declineAlteration(props.reservation.id), 'Change declined')
}

function confirmDecline() {
  reasonOpen.value = false
  run('decline', () => declineRequest(props.reservation.id, reason.value), 'Request declined')
}
</script>

<template>
  <div class="flex items-center gap-2">
    <Button :size="size ?? 'sm'" :disabled="!!busy" data-testid="request-accept" @click.stop="accept">
      <Icon v-if="busy === 'accept'" name="lucide:loader-circle" class="mr-1.5 size-4 animate-spin" aria-hidden="true" />
      Accept
    </Button>
    <Button :size="size ?? 'sm'" variant="outline" :disabled="!!busy" data-testid="request-decline" @click.stop="decline">
      <Icon v-if="busy === 'decline'" name="lucide:loader-circle" class="mr-1.5 size-4 animate-spin" aria-hidden="true" />
      Decline
    </Button>

    <Dialog v-model:open="reasonOpen">
      <DialogContent class="sm:max-w-md" @click.stop>
        <DialogHeader>
          <DialogTitle>Decline {{ reservation.guestName }}'s request?</DialogTitle>
          <DialogDescription>
            {{ reservation.channel }} asks why and may show it to the guest. The dates open up again.
          </DialogDescription>
        </DialogHeader>
        <div class="flex flex-col gap-2" role="radiogroup" aria-label="Reason">
          <button
            v-for="r in reasons"
            :key="r.value"
            type="button"
            role="radio"
            :aria-checked="reason === r.value"
            class="flex items-center gap-3 rounded-lg border p-3 text-left text-sm transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            :class="reason === r.value ? 'border-primary ring-1 ring-primary' : ''"
            @click="reason = r.value"
          >
            <span class="flex size-4 shrink-0 items-center justify-center rounded-full border" :class="reason === r.value ? 'border-primary' : 'border-input'">
              <span v-if="reason === r.value" class="size-2 rounded-full bg-primary" />
            </span>
            {{ r.label }}
          </button>
        </div>
        <DialogFooter>
          <Button variant="ghost" @click="reasonOpen = false">
            Cancel
          </Button>
          <Button variant="destructive" :disabled="!reason" data-testid="request-decline-confirm" @click="confirmDecline">
            Decline request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
