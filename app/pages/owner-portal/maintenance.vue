<script setup lang="ts">
// Owner portal — Maintenance Records (Flow 10B). Owners track cost-bearing
// repairs in real time and approve/reject cost requests above the tenant
// threshold before the vendor starts.

import type { MaintenanceRecord } from '~/components/owners/data/owner-maintenance'
import { toast } from 'vue-sonner'
import { ownerMaintenanceApprovalLabels, ownerMaintenanceStatusLabels } from '~/components/owners/data/owner-maintenance'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Card, CardContent } from '~/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '~/components/ui/dialog'
import { Label } from '~/components/ui/label'
import { Textarea } from '~/components/ui/textarea'
import { useOwnerMaintenance } from '~/composables/useOwnerMaintenance'
import { useOwnerPortal } from '~/composables/useOwnerPortal'

definePageMeta({ layout: 'owner-portal' })

const { currentOwner } = useOwnerPortal()
const { recordsForOwner, ownerRespond } = useOwnerMaintenance()

const approveTarget = ref<MaintenanceRecord | null>(null)
const rejectTarget = ref<MaintenanceRecord | null>(null)
const responseNote = ref('')

const records = computed<MaintenanceRecord[]>(() =>
  currentOwner.value ? recordsForOwner(currentOwner.value.id) : [])

const pendingApprovals = computed(() => records.value.filter(r => r.status === 'awaiting_owner_approval'))

const statusBadge: Record<string, string> = {
  reported: 'border-transparent bg-muted text-muted-foreground',
  in_progress: 'border-transparent bg-blue-500/10 text-blue-700 dark:text-blue-300',
  vendor_assigned: 'border-transparent bg-amber-500/10 text-amber-700 dark:text-amber-300',
  awaiting_owner_approval: 'border-transparent bg-orange-500/10 text-orange-700 dark:text-orange-300',
  completed: 'border-transparent bg-green-500/10 text-green-700 dark:text-green-300',
  cancelled: 'border-transparent bg-zinc-500/10 text-zinc-700 dark:text-zinc-300',
}

function formatCost(amount: number | undefined): string {
  return amount === undefined ? '—' : `IDR ${amount.toLocaleString()}`
}

function doApprove() {
  if (!approveTarget.value)
    return
  const result = ownerRespond(approveTarget.value.id, true, responseNote.value || undefined)
  if (result.ok) {
    toast.success('Cost approved — vendor can start.')
    approveTarget.value = null
    responseNote.value = ''
  }
  else {
    toast.error('Could not approve this record.')
  }
}

function doReject() {
  if (!rejectTarget.value)
    return
  const result = ownerRespond(rejectTarget.value.id, false, responseNote.value || undefined)
  if (result.ok) {
    toast.info('Cost request rejected. The property manager has been notified.')
    rejectTarget.value = null
    responseNote.value = ''
  }
  else {
    toast.error('Could not reject this record.')
  }
}
</script>

<template>
  <div class="flex h-[calc(100vh-9rem)] min-h-0 flex-col gap-4 p-4 sm:p-6 lg:p-8">
    <header class="space-y-1">
      <h1 class="text-2xl font-semibold tracking-tight">
        Maintenance
      </h1>
      <p class="text-sm text-muted-foreground">
        Track repairs and work orders on your properties, and approve costs before work begins.
      </p>
    </header>

    <div class="flex flex-wrap gap-2">
      <Badge v-if="pendingApprovals.length" variant="destructive">
        {{ pendingApprovals.length }} awaiting your approval
      </Badge>
    </div>

    <div class="min-h-0 flex-1 overflow-auto">
      <div v-if="!records.length" class="text-sm text-muted-foreground">
        No maintenance records for your properties.
      </div>

      <div class="space-y-3">
        <Card v-for="record in records" :key="record.id">
          <CardContent class="space-y-3 p-4">
            <div class="flex items-start justify-between gap-4">
              <div>
                <p class="font-medium">
                  {{ record.title }}
                </p>
                <p class="text-xs text-muted-foreground">
                  Reported {{ new Date(record.reportedAt).toLocaleDateString('en-GB') }} · {{ record.vendorName ?? 'No vendor yet' }}
                </p>
              </div>
              <Badge :class="statusBadge[record.status]">
                {{ ownerMaintenanceStatusLabels[record.status] }}
              </Badge>
            </div>

            <p class="text-sm text-muted-foreground">
              {{ record.description }}
            </p>

            <div class="flex flex-wrap gap-2 text-sm">
              <Badge variant="outline">
                Est. {{ formatCost(record.estimatedCost) }}
              </Badge>
              <Badge v-if="record.actualCost !== undefined" variant="outline">
                Actual {{ formatCost(record.actualCost) }}
              </Badge>
              <Badge variant="outline">
                {{ ownerMaintenanceApprovalLabels[record.ownerApproval.status] }}
              </Badge>
              <Badge v-if="record.syncedToStatementPeriod" variant="outline">
                In statement {{ record.syncedToStatementPeriod }}
              </Badge>
            </div>

            <div v-if="record.status === 'awaiting_owner_approval'" class="flex gap-2">
              <Button size="sm" @click="approveTarget = record; responseNote = ''">
                <Icon name="lucide:check" class="mr-1 size-3.5" />
                Approve cost
              </Button>
              <Button size="sm" variant="outline" @click="rejectTarget = record; responseNote = ''">
                Reject
              </Button>
            </div>

            <div v-if="record.photosBefore?.length || record.photosAfter?.length" class="flex flex-wrap gap-2">
              <Badge v-for="photo in record.photosBefore" :key="photo" variant="outline" class="text-xs">
                Before
              </Badge>
              <Badge v-for="photo in record.photosAfter" :key="photo" variant="outline" class="text-xs">
                After
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>

    <Dialog :open="!!approveTarget" @update:open="(v: boolean) => { if (!v) approveTarget = null }">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Approve repair cost?</DialogTitle>
          <DialogDescription>
            {{ approveTarget?.title }} — estimated {{ formatCost(approveTarget?.estimatedCost) }}. Approving lets the vendor start work.
          </DialogDescription>
        </DialogHeader>
        <div class="space-y-1.5">
          <Label for="approve-note">Note (optional)</Label>
          <Textarea id="approve-note" v-model="responseNote" placeholder="Any conditions or instructions…" />
        </div>
        <DialogFooter>
          <Button variant="outline" @click="approveTarget = null">
            Cancel
          </Button>
          <Button @click="doApprove">
            Approve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog :open="!!rejectTarget" @update:open="(v: boolean) => { if (!v) rejectTarget = null }">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reject cost request?</DialogTitle>
          <DialogDescription>
            {{ rejectTarget?.title }} will not proceed. Add a note for the property manager.
          </DialogDescription>
        </DialogHeader>
        <div class="space-y-1.5">
          <Label for="reject-note">Reason</Label>
          <Textarea id="reject-note" v-model="responseNote" placeholder="Why are you rejecting this?" />
        </div>
        <DialogFooter>
          <Button variant="outline" @click="rejectTarget = null">
            Cancel
          </Button>
          <Button variant="destructive" @click="doReject">
            Reject
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
