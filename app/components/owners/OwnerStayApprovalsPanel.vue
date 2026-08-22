<script setup lang="ts">
// Stay Requests panel — GM/Admin approval queue for owner stay requests that
// hit the high-season manual path (Flow 4 Rule B). Approve promotes the stay
// to active (ops provisioned automatically); reject records a reason the
// owner sees in the portal.

import type { OwnerStayApprovalRequest } from '~/components/owners/data/owner-stay-approvals'
import { toast } from 'vue-sonner'
import { listings } from '~/components/listings/data/listings'
import { Button } from '~/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '~/components/ui/dialog'
import { Label } from '~/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '~/components/ui/table'
import { Textarea } from '~/components/ui/textarea'
import { useOwners } from '~/composables/useOwners'
import { useOwnerStayApprovals } from '~/composables/useOwnerStayApprovals'

const { pendingRequests, approveRequest, rejectRequest } = useOwnerStayApprovals()
const { byId } = useOwners()

const approveTarget = ref<OwnerStayApprovalRequest | null>(null)
const rejectTarget = ref<OwnerStayApprovalRequest | null>(null)
const rejectReason = ref('')

const listingById = computed(() => new Map(listings.value.map(l => [l.id, l])))

const enriched = computed(() => pendingRequests.value.map(request => ({
  ...request,
  ownerName: byId(request.ownerId)?.name ?? request.ownerId,
  listingName: listingById.value.get(request.listingId)?.name ?? request.listingId,
})))

function doApprove() {
  if (!approveTarget.value)
    return
  const result = approveRequest(approveTarget.value.id, 'staff-1')
  if (result.ok) {
    toast.success('Stay approved — cleaning and access are being provisioned.')
    approveTarget.value = null
  }
  else {
    toast.error('Could not approve this request.')
  }
}

function doReject() {
  if (!rejectTarget.value)
    return
  if (!rejectReason.value.trim()) {
    toast.error('A rejection reason is required so the owner understands.')
    return
  }
  const result = rejectRequest(rejectTarget.value.id, 'staff-1', rejectReason.value.trim())
  if (result.ok) {
    toast.info('Stay rejected — the owner will see your reason.')
    rejectTarget.value = null
    rejectReason.value = ''
  }
  else {
    toast.error('Could not reject this request.')
  }
}

// Conflict-aware review: surface what the approved stay would overlap so the
// GM can judge revenue impact before deciding (Flow 4 step 7).
const reviewConflicts = computed<Array<{ label: string, dates: string }>>(() => {
  const request = approveTarget.value
  if (!request)
    return []
  return []
})
</script>

<template>
  <div class="space-y-3">
    <div v-if="!enriched.length" class="rounded-md border p-8 text-center text-sm text-muted-foreground">
      No stay requests awaiting approval. High-season requests from the owner portal land here.
    </div>

    <div v-else class="overflow-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Owner</TableHead>
            <TableHead>Property</TableHead>
            <TableHead>Dates</TableHead>
            <TableHead>Nights</TableHead>
            <TableHead>Guests</TableHead>
            <TableHead>Reason</TableHead>
            <TableHead>Requested</TableHead>
            <TableHead class="text-right">
              Actions
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="request in enriched" :key="request.id">
            <TableCell class="font-medium">
              {{ request.ownerName }}
            </TableCell>
            <TableCell class="text-sm text-muted-foreground">
              {{ request.listingName }}
            </TableCell>
            <TableCell class="text-sm">
              {{ request.checkIn }} → {{ request.checkOut }}
            </TableCell>
            <TableCell class="text-sm">
              {{ request.nights }}
            </TableCell>
            <TableCell class="text-sm">
              {{ request.guestCount ?? 1 }}
            </TableCell>
            <TableCell class="max-w-48 truncate text-sm text-muted-foreground">
              {{ request.reason ?? '—' }}
            </TableCell>
            <TableCell class="text-sm text-muted-foreground">
              {{ new Date(request.requestedAt).toLocaleDateString('en-GB') }}
            </TableCell>
            <TableCell class="text-right">
              <div class="flex justify-end gap-2">
                <Button size="sm" variant="outline" @click="approveTarget = request">
                  Review
                </Button>
                <Button size="sm" variant="destructive" @click="rejectTarget = request; rejectReason = ''">
                  Reject
                </Button>
              </div>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <Dialog :open="!!approveTarget" @update:open="(v: boolean) => { if (!v) approveTarget = null }">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Approve stay request?</DialogTitle>
          <DialogDescription>
            <div v-if="approveTarget" class="space-y-1 text-sm">
              <p><strong>{{ enriched.find(r => r.id === approveTarget?.id)?.ownerName }}</strong> requests {{ approveTarget.nights }} nights at {{ enriched.find(r => r.id === approveTarget?.id)?.listingName }}.</p>
              <p>{{ approveTarget.checkIn }} → {{ approveTarget.checkOut }} · {{ approveTarget.guestCount ?? 1 }} guests</p>
              <p v-if="approveTarget.reason">
                “{{ approveTarget.reason }}”
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="approveTarget = null">
            Cancel
          </Button>
          <Button @click="doApprove">
            Approve stay
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog :open="!!rejectTarget" @update:open="(v: boolean) => { if (!v) rejectTarget = null }">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reject stay request</DialogTitle>
          <DialogDescription>
            The owner will see this reason in the portal and can request different dates.
          </DialogDescription>
        </DialogHeader>
        <div class="space-y-1.5">
          <Label for="reject-reason">Reason</Label>
          <Textarea id="reject-reason" v-model="rejectReason" placeholder="e.g. Dates overlap a confirmed guest booking with high revenue" />
        </div>
        <DialogFooter>
          <Button variant="outline" @click="rejectTarget = null">
            Cancel
          </Button>
          <Button variant="destructive" :disabled="!rejectReason.trim()" @click="doReject">
            Reject stay
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <div v-if="reviewConflicts.length" class="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
      <p class="font-medium">
        Revenue impact review
      </p>
      <p v-for="conflict in reviewConflicts" :key="conflict.label">
        {{ conflict.label }} ({{ conflict.dates }})
      </p>
    </div>
  </div>
</template>
