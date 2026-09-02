<script setup lang="ts">
// Maintenance panel — tenant view of maintenance records (Flow 10B).
// Lists all records with owner-approval status; staff report a repair, and can
// emergency-override past a missing owner response, complete a record with
// actual cost + invoice, and sync it to a statement period.
//
// Reporting a repair also mirrors it into the Tasks module (PRD 5.4.3), linked
// by MaintenanceRecord.taskId.

import type { MaintenanceRecord } from '~/components/owners/data/owner-maintenance'
import { toast } from 'vue-sonner'
import { listings } from '~/components/listings/data/listings'
import { ownerMaintenanceApprovalLabels, ownerMaintenanceConfig, ownerMaintenanceStatusLabels } from '~/components/owners/data/owner-maintenance'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '~/components/ui/table'
import { Textarea } from '~/components/ui/textarea'
import { useOwnerMaintenance } from '~/composables/useOwnerMaintenance'
import { useOwners } from '~/composables/useOwners'

const { records, openApprovals, createRecord, emergencyOverride, completeRecord, syncToStatement } = useOwnerMaintenance()
const { byId, owners, mappings } = useOwners()

const listingById = computed(() => new Map(listings.value.map(l => [l.id, l])))

// --- Report a repair -------------------------------------------------------

const reportOpen = ref(false)
const reportOwnerId = ref('')
const reportListingId = ref('')
const reportTitle = ref('')
const reportDescription = ref('')
const reportCost = ref<number>(0)

/** Only listings the chosen owner actually owns can carry their repair. */
const reportListingOptions = computed(() => {
  if (!reportOwnerId.value)
    return []
  const owned = new Set(
    mappings.value.filter(m => m.ownerId === reportOwnerId.value).map(m => m.listingId),
  )
  return listings.value.filter(l => owned.has(l.id))
})

watch(reportOwnerId, () => { reportListingId.value = '' })

const reportBlockedReason = computed<string | null>(() => {
  if (!reportOwnerId.value)
    return 'Pick the owner this repair belongs to.'
  if (!reportListingId.value)
    return 'Pick one of that owner\'s properties.'
  if (!reportTitle.value.trim())
    return 'Add a short title.'
  if (reportCost.value < 0)
    return 'Estimated cost cannot be negative.'
  return null
})

const reportNeedsApproval = computed(() => reportCost.value >= ownerMaintenanceConfig.approvalThreshold)

function resetReport() {
  reportOwnerId.value = ''
  reportListingId.value = ''
  reportTitle.value = ''
  reportDescription.value = ''
  reportCost.value = 0
}

function submitReport() {
  const result = createRecord({
    ownerId: reportOwnerId.value,
    listingId: reportListingId.value,
    title: reportTitle.value,
    description: reportDescription.value,
    estimatedCost: reportCost.value,
    reportedBy: 'staff-1',
  })
  if (!result.ok) {
    toast.error(result.error)
    return
  }
  toast.success(result.requiresApproval
    ? 'Repair reported — waiting on the owner to approve the cost.'
    : 'Repair reported — below the approval threshold, sent straight to the vendor.')
  reportOpen.value = false
  resetReport()
}

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
    // No owner notification channel exists — the record is simply visible in
    // the owner's portal from now on.
    toast.warning('Emergency override recorded — visible in the owner\'s portal.')
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
    <div class="flex flex-wrap items-center justify-between gap-2">
      <Badge v-if="openApprovals.length" variant="destructive">
        {{ openApprovals.length }} awaiting owner cost approval
      </Badge>
      <span v-else class="text-sm text-muted-foreground">
        No repairs are waiting on an owner.
      </span>
      <Button size="sm" @click="reportOpen = true">
        <Icon name="lucide:wrench" class="mr-1.5 size-3.5" />
        Report a repair
      </Button>
    </div>

    <div v-if="!enriched.length" class="rounded-md border p-8 text-center text-sm text-muted-foreground">
      No maintenance records yet. Report a repair to create one.
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
            {{ overrideTarget?.title }} — the owner has not responded. Overriding lets the vendor start immediately; the override and your note become visible in the owner's portal.
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

    <!-- Report a repair — creates the record and its mirrored task. -->
    <Dialog v-model:open="reportOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Report a repair</DialogTitle>
          <DialogDescription>
            Creates a maintenance record and a linked task for the team. Costs at or above
            {{ ownerMaintenanceConfig.currency }} {{ ownerMaintenanceConfig.approvalThreshold.toLocaleString() }}
            wait for the owner to approve before the vendor starts.
          </DialogDescription>
        </DialogHeader>
        <div class="space-y-3">
          <div class="space-y-1.5">
            <Label>Owner <span class="text-destructive">*</span></Label>
            <Select v-model="reportOwnerId">
              <SelectTrigger>
                <SelectValue placeholder="Pick an owner" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="owner in owners" :key="owner.id" :value="owner.id">
                  {{ owner.name }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="space-y-1.5">
            <Label>Property <span class="text-destructive">*</span></Label>
            <Select v-model="reportListingId" :disabled="!reportOwnerId">
              <SelectTrigger>
                <SelectValue :placeholder="reportOwnerId ? 'Pick a property' : 'Pick an owner first'" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="listing in reportListingOptions" :key="listing.id" :value="listing.id">
                  {{ listing.name }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="space-y-1.5">
            <Label for="report-title">Title <span class="text-destructive">*</span></Label>
            <Input id="report-title" v-model="reportTitle" placeholder="e.g. AC unit not cooling — main bedroom" />
          </div>
          <div class="space-y-1.5">
            <Label for="report-desc">Description</Label>
            <Textarea id="report-desc" v-model="reportDescription" placeholder="What is wrong, and what the vendor will do" />
          </div>
          <div class="space-y-1.5">
            <Label for="report-cost">Estimated cost ({{ ownerMaintenanceConfig.currency }})</Label>
            <Input id="report-cost" v-model.number="reportCost" type="number" min="0" step="50000" />
            <p class="text-xs" :class="reportNeedsApproval ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'">
              {{ reportNeedsApproval
                ? 'At or above the threshold — the owner must approve before work starts.'
                : 'Below the threshold — goes straight to the vendor.' }}
            </p>
          </div>
        </div>
        <DialogFooter class="flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end">
          <p v-if="reportBlockedReason" class="mr-auto text-xs text-muted-foreground">
            {{ reportBlockedReason }}
          </p>
          <div class="flex justify-end gap-2">
            <Button variant="outline" @click="reportOpen = false">
              Cancel
            </Button>
            <Button :disabled="!!reportBlockedReason" @click="submitReport">
              Report repair
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
