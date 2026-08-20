<script setup lang="ts">
// Maintenance panel — tenant view of maintenance records (Flow 10B).
// Lists all records with owner-approval status; staff can emergency-override
// past a missing owner response, complete a record with actual cost + invoice,
// and sync it to a statement period.

import type { MaintenanceRecord } from '~/components/owners/data/owner-maintenance'
import { toast } from 'vue-sonner'
import { listings } from '~/components/listings/data/listings'
import { ownerMaintenanceApprovalLabels, ownerMaintenanceStatusLabels } from '~/components/owners/data/owner-maintenance'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '~/components/ui/table'
import { Textarea } from '~/components/ui/textarea'
import { useOwnerMaintenance } from '~/composables/useOwnerMaintenance'
import { useOwners } from '~/composables/useOwners'

const { records, openApprovals, emergencyOverride, completeRecord, syncToStatement } = useOwnerMaintenance()
const { byId } = useOwners()

const listingById = computed(() => new Map(listings.value.map(l => [l.id, l])))

const overrideTarget = ref<MaintenanceRecord | null>(null)
const overrideNote = ref('')
const completeTarget = ref<MaintenanceRecord | null>(null)
const actualCost = ref<number>(0)
const invoiceId = ref('')

const enriched = computed(() => records.value
  .slice()
  .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  .map(record => ({
    ...record,
    ownerName: byId(record.ownerId)?.name ?? record.ownerId,
    listingName: listingById.value.get(record.listingId)?.name ?? record.listingId,
  })))

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

function doEmergencyOverride() {
  if (!overrideTarget.value)
    return
  const result = emergencyOverride(overrideTarget.value.id, 'staff-1', overrideNote.value || 'Emergency override — owner did not respond in time.')
  if (result.ok) {
    toast.warning('Emergency override recorded — owner will be notified retroactively.')
    overrideTarget.value = null
    overrideNote.value = ''
  }
  else {
    toast.error('Could not override this record.')
  }
}

function doComplete() {
  if (!completeTarget.value)
    return
  const result = completeRecord(completeTarget.value.id, actualCost.value, {
    invoiceId: invoiceId.value || undefined,
  })
  if (result.ok) {
    toast.success('Record completed — invoice attached.')
    completeTarget.value = null
    actualCost.value = 0
    invoiceId.value = ''
  }
  else {
    toast.error('Could not complete this record.')
  }
}

function doSyncToStatement(record: MaintenanceRecord) {
  const period = new Date().toISOString().slice(0, 7)
  const result = syncToStatement(record.id, period)
  if (result.ok)
    toast.success(`Synced to statement ${period}.`)
  else
    toast.error('Only completed records can be synced.')
}
</script>

<template>
  <div class="space-y-3">
    <div v-if="openApprovals.length" class="flex items-center gap-2">
      <Badge variant="destructive">
        {{ openApprovals.length }} awaiting owner cost approval
      </Badge>
    </div>

    <div v-if="!enriched.length" class="rounded-md border p-8 text-center text-sm text-muted-foreground">
      No maintenance records yet. Records are created from Tasks / Damage & Issue reports.
    </div>

    <div v-else class="overflow-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Record</TableHead>
            <TableHead>Owner</TableHead>
            <TableHead>Property</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Est. cost</TableHead>
            <TableHead>Approval</TableHead>
            <TableHead class="text-right">
              Actions
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="record in enriched" :key="record.id">
            <TableCell>
              <p class="font-medium">
                {{ record.title }}
              </p>
              <p class="text-xs text-muted-foreground">
                {{ record.vendorName ?? 'No vendor' }}
              </p>
            </TableCell>
            <TableCell class="text-sm text-muted-foreground">
              {{ record.ownerName }}
            </TableCell>
            <TableCell class="text-sm text-muted-foreground">
              {{ record.listingName }}
            </TableCell>
            <TableCell>
              <Badge :class="statusBadge[record.status]">
                {{ ownerMaintenanceStatusLabels[record.status] }}
              </Badge>
            </TableCell>
            <TableCell class="text-sm">
              {{ formatCost(record.estimatedCost) }}
            </TableCell>
            <TableCell class="text-sm text-muted-foreground">
              {{ ownerMaintenanceApprovalLabels[record.ownerApproval.status] }}
            </TableCell>
            <TableCell class="text-right">
              <div class="flex justify-end gap-2">
                <Button
                  v-if="record.status === 'awaiting_owner_approval'"
                  size="sm"
                  variant="outline"
                  @click="overrideTarget = record; overrideNote = ''"
                >
                  Emergency override
                </Button>
                <Button
                  v-if="!['completed', 'cancelled'].includes(record.status)"
                  size="sm"
                  variant="outline"
                  @click="completeTarget = record; actualCost = record.estimatedCost; invoiceId = ''"
                >
                  Complete
                </Button>
                <Button
                  v-if="record.status === 'completed' && !record.syncedToStatementPeriod"
                  size="sm"
                  variant="ghost"
                  @click="doSyncToStatement(record)"
                >
                  Sync to statement
                </Button>
              </div>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <Dialog :open="!!overrideTarget" @update:open="(v: boolean) => { if (!v) overrideTarget = null }">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Emergency override</DialogTitle>
          <DialogDescription>
            {{ overrideTarget?.title }} — the owner has not responded. Overriding lets the vendor start immediately; the owner is notified retroactively.
          </DialogDescription>
        </DialogHeader>
        <div class="space-y-1.5">
          <Label for="override-note">Note</Label>
          <Textarea id="override-note" v-model="overrideNote" placeholder="e.g. AC down with guests in house" />
        </div>
        <DialogFooter>
          <Button variant="outline" @click="overrideTarget = null">
            Cancel
          </Button>
          <Button variant="destructive" @click="doEmergencyOverride">
            Override & start
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog :open="!!completeTarget" @update:open="(v: boolean) => { if (!v) completeTarget = null }">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Complete record</DialogTitle>
          <DialogDescription>
            Attach the final invoice and actual cost. This will sync to the owner statement as a deduction.
          </DialogDescription>
        </DialogHeader>
        <div class="space-y-3">
          <div class="space-y-1.5">
            <Label for="actual-cost">Actual cost (IDR)</Label>
            <Input id="actual-cost" v-model.number="actualCost" type="number" min="0" />
          </div>
          <div class="space-y-1.5">
            <Label for="invoice-id">Invoice document id</Label>
            <Input id="invoice-id" v-model="invoiceId" placeholder="e.g. odoc-inv-5" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="completeTarget = null">
            Cancel
          </Button>
          <Button @click="doComplete">
            Complete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
