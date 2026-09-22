<!-- app/components/inbox/ReservationGuestGuide.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import { toast } from 'vue-sonner'
import SendLinkDialog from '~/components/guest-guides/SendLinkDialog.vue'

const props = defineProps<{ reservationId: string }>()

const { guides } = useGuestGuides()
const { revokeLink, findByReservation } = useGuestGuideLinks()
const { getSubmissionForLink } = useGuestGuideSubmissions()

const link = computed(() => findByReservation(props.reservationId))
const guide = computed(() => link.value ? guides.value.find(g => g.id === link.value!.guideId) : null)
const submission = computed(() => link.value ? getSubmissionForLink(link.value.id) : null)
const sendDialogOpen = ref(false)

function handleRevoke() {
  if (!link.value) return
  revokeLink(link.value.id)
  toast.success('Guide link revoked')
}
</script>

<template>
  <div class="space-y-4">
    <div v-if="link && guide">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="font-medium">{{ guide.title }}</h3>
          <Badge class="mt-1">{{ link.status }}</Badge>
        </div>
        <Button v-if="link.status !== 'revoked'" variant="outline" size="sm" @click="handleRevoke">
          Revoke
        </Button>
      </div>
      <div class="mt-3 rounded-md bg-muted p-2 font-mono text-xs break-all">
        https://guide.elev8-suite.com/{{ link.token }}
      </div>
      <div v-if="submission" class="mt-4 space-y-2 text-sm">
        <h4 class="font-medium">Submitted</h4>
        <div v-if="submission.arrivalTime">Arrival: {{ new Date(submission.arrivalTime).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', hour12: false }) }}</div>
        <div v-if="submission.guests">Guests: {{ submission.guests }}</div>
        <div v-if="submission.requests">Requests: {{ submission.requests }}</div>
      </div>
    </div>
    <div v-else>
      <Button @click="sendDialogOpen = true">Send Guide Link</Button>
    </div>

    <SendLinkDialog
      v-if="sendDialogOpen"
      v-model:open="sendDialogOpen"
      :guide-id="guides[0]?.id ?? ''"
    />
  </div>
</template>
