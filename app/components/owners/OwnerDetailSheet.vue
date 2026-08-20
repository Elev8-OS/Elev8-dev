<!-- app/components/owners/OwnerDetailSheet.vue -->
<!--
  Read-mostly sheet for an individual owner — Overview, Properties &
  Commission, Permissions, and Statements tabs. Uses the same Sheet +
  Tabs pattern as RoleDetailSheet.
-->
<script setup lang="ts">
import type { CommissionRule } from '~/components/owners/data/commission-rules'
import type { OwnerBookingMode } from '~/components/owners/data/owner-quotas'
import type { Owner, OwnerStatus } from '~/components/owners/data/owners'
import { computed } from 'vue'
import { toast } from 'vue-sonner'
import { listings } from '~/components/listings/data/listings'
import { OWNER_BOOKING_MODE_LABELS } from '~/components/owners/data/owner-quotas'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import { Separator } from '~/components/ui/separator'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '~/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'
import { useOwnerAuth } from '~/composables/useOwnerAuth'
import { useOwnerContracts } from '~/composables/useOwnerContracts'
import { useOwnerOperationalFees } from '~/composables/useOwnerOperationalFees'
import { useOwnerPermissions } from '~/composables/useOwnerPermissions'
import { useOwnerQuotas } from '~/composables/useOwnerQuotas'
import { useOwners } from '~/composables/useOwners'
import { useOwnerStatements } from '~/composables/useOwnerStatements'
import { buildOwnerContractPdf } from '~/lib/owner-contract-pdf'
import OwnerPermissionMatrix from './OwnerPermissionMatrix.vue'

interface Props {
  open: boolean
  ownerId?: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const {
  byId,
  mappings,
  commissionRules,
  inviteOwner,
  activateOwner,
  deactivateOwner,
  reactivateOwner,
  updatePermissions,
  findPermissions,
} = useOwners()
const { statements } = useOwnerStatements()
const { applyTemplate } = useOwnerPermissions()
const { revokeAccess, regenerateAccess, getAccessLog } = useOwnerAuth()

const owner = computed<Owner | undefined>(() => props.ownerId ? byId(props.ownerId) : undefined)

const ownerMappings = computed(() => owner.value ? mappings.value.filter(m => m.ownerId === owner.value!.id) : [])
const ownerRules = computed<CommissionRule[]>(() => owner.value ? commissionRules.value.filter(r => r.ownerId === owner.value!.id) : [])
const ownerStatements = computed(() => owner.value ? statements.value.filter(s => s.ownerId === owner.value!.id) : [])
const ownerPermissions = computed(() => owner.value ? findPermissions(owner.value!.id) : undefined)

const listingById = computed(() => new Map(listings.value.map(l => [l.id, l])))

const statusBadgeClass: Record<OwnerStatus, string> = {
  active: 'border-transparent bg-green-500/10 text-green-700 dark:text-green-300',
  invited: 'border-transparent bg-amber-500/10 text-amber-700 dark:text-amber-300',
  draft: 'border-transparent bg-muted text-muted-foreground',
  inactive: 'border-transparent bg-zinc-500/10 text-zinc-700 dark:text-zinc-300',
}

const statusLabel: Record<OwnerStatus, string> = {
  active: 'Active',
  invited: 'Invited',
  draft: 'Draft',
  inactive: 'Inactive',
}

function handleAction(action: () => { success: boolean, error?: string }, successMessage: string) {
  const r = action()
  if (r.success)
    toast.success(successMessage)
  else toast.error(r.error ?? 'Action failed.')
}

function handleApplyTemplate(id: 'full_transparency' | 'financial_summary') {
  if (!owner.value)
    return
  try {
    applyTemplate(owner.value.id, id)
    toast.success('Permission template applied.')
  }
  catch (err) {
    toast.error((err as Error).message ?? 'Failed to apply template.')
  }
}

function handleMatrixUpdate(config: typeof ownerPermissions.value) {
  if (!owner.value || !config)
    return
  updatePermissions(owner.value.id, {
    dashboard: config.dashboard,
    statement: config.statement,
  })
  toast.success('Permissions updated.')
}

const totalOwnership = computed(() =>
  ownerMappings.value.reduce((sum, m) => sum + m.ownershipPercentage, 0),
)

// --- Portal access (Flow 8) ---

const revokeOpen = ref(false)
const accessLogEntries = computed(() => owner.value ? getAccessLog(owner.value.id) : [])

const magicLinkStatusLabel: Record<string, string> = {
  active: 'Active',
  revoked: 'Revoked',
  regenerated: 'Regenerated',
}

function handleRevoke() {
  if (!owner.value)
    return
  const result = revokeAccess(owner.value.id, 'staff-1')
  if (result.ok) {
    revokeOpen.value = false
    toast.warning('Owner access revoked. Any active session was invalidated.')
  }
  else {
    toast.error(result.error ?? 'Failed to revoke access.')
  }
}

function handleRegenerate() {
  if (!owner.value)
    return
  const result = regenerateAccess(owner.value.id, 'staff-1', 'Regenerated from owner detail sheet')
  if (result.ok)
    toast.success('New magic link generated.')
  else
    toast.error(result.error ?? 'Failed to regenerate link.')
}

// --- Self-booking mode + seasonal quotas (PRD 5.2) ---

const { getBookingMode, setBookingMode, quotasForOwnerListing, upsertQuota, removeQuota } = useOwnerQuotas()
const { getContractForOwner, generateContract, sendContract } = useOwnerContracts()

const modeDrafts = ref<Record<string, OwnerBookingMode>>({})
const quotaInput = ref<{ ownerId: string, listingId: string, startDate: string, endDate: string, maxNights: number } | null>(null)

const ownerContract = computed(() => owner.value ? getContractForOwner(owner.value.id) : undefined)

function currentMode(listingId: string): OwnerBookingMode {
  if (!owner.value)
    return 'direct'
  return modeDrafts.value[listingId] ?? getBookingMode(owner.value.id, listingId)
}

function applyMode(listingId: string, mode: OwnerBookingMode) {
  if (!owner.value)
    return
  setBookingMode(owner.value.id, listingId, mode)
  modeDrafts.value[listingId] = mode
  toast.success(`${OWNER_BOOKING_MODE_LABELS[mode]} enabled for this property.`)
}

function openAddQuota() {
  if (!owner.value || ownerMappings.value.length === 0)
    return
  quotaInput.value = {
    ownerId: owner.value.id,
    listingId: ownerMappings.value[0]!.listingId,
    startDate: '',
    endDate: '',
    maxNights: 0,
  }
}

function saveQuota() {
  if (!quotaInput.value)
    return
  const result = upsertQuota(quotaInput.value)
  if (result.success) {
    toast.success('Seasonal quota saved.')
    quotaInput.value = null
  }
  else {
    toast.error(result.error ?? 'Failed to save quota.')
  }
}

function deleteQuota(quotaId: string) {
  removeQuota(quotaId)
  toast.info('Seasonal quota removed.')
}

// --- Contract (PRD 5.3) ---

const { getFeeFor } = useOwnerOperationalFees()

function handleGenerateContract() {
  if (!owner.value || ownerMappings.value.length === 0)
    return
  const rule = ownerRules.value[0]
  // Use the FIRST listing's configured operational cost share for the
  // contract (contracts are owner-level; multi-listing shares default to
  // the first listing's percentage).
  const firstListing = ownerMappings.value[0]!.listingId
  const fee = getFeeFor(owner.value.id, firstListing)
  const operationalFee = fee?.percentage ?? 100
  const result = generateContract({
    ownerId: owner.value.id,
    listingIds: ownerMappings.value.map(m => m.listingId),
    terms: {
      commissionType: rule?.basis === 'net' ? 'fixed_net' : 'gross',
      rate: rule && 'rate' in rule ? rule.rate : 20,
      fixedAmount: rule && 'fixedAmount' in rule ? rule.fixedAmount : undefined,
      basis: rule?.basis ?? 'gross',
      includedServices: ['Channel management', 'Guest communication'],
      operationalFee,
    },
  })
  if (result.ok)
    toast.success('Contract generated from commission terms.')
  else
    toast.error(result.error ?? 'Failed to generate contract.')
}

function handleSendContract() {
  if (!ownerContract.value)
    return
  const result = sendContract(ownerContract.value.id)
  if (result.ok)
    toast.success('Contract sent — owner can now sign via the magic link.')
  else
    toast.error('Could not send the contract.')
}

function handleDownloadContractPdf() {
  if (!ownerContract.value || !owner.value)
    return
  buildOwnerContractPdf(ownerContract.value, owner.value, { download: true })
  toast.success('Contract PDF downloaded.')
}
</script>

<template>
  <Sheet :open="open" @update:open="(v) => emit('update:open', v)">
    <SheetContent side="right" class="flex w-full flex-col p-0 sm:max-w-3xl">
      <SheetHeader class="border-b px-6 pb-4 pt-6">
        <SheetTitle>
          {{ owner?.name ?? 'Owner' }}
        </SheetTitle>
        <SheetDescription>
          <span v-if="owner">{{ owner.email }} · {{ owner.statementCurrency }}</span>
          <span v-else>No owner selected.</span>
        </SheetDescription>
      </SheetHeader>

      <div v-if="owner" class="flex-1 min-h-0 overflow-y-auto px-6 py-4">
        <!-- Status strip -->
        <div class="flex items-center gap-2">
          <Badge variant="outline" :class="statusBadgeClass[owner.status]">
            {{ statusLabel[owner.status] }}
          </Badge>
          <Badge variant="outline">
            {{ ownerMappings.length }} properties
          </Badge>
          <Badge variant="outline">
            {{ totalOwnership }}% total
          </Badge>
        </div>

        <Separator class="my-4" />

        <Tabs default-value="overview" class="w-full">
          <TabsList class="w-full">
            <TabsTrigger value="overview" class="flex-1">
              <Icon name="lucide:user" class="mr-1.5 size-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="properties" class="flex-1">
              <Icon name="lucide:building-2" class="mr-1.5 size-4" />
              Properties & Commission
            </TabsTrigger>
            <TabsTrigger value="permissions" class="flex-1">
              <Icon name="lucide:shield-check" class="mr-1.5 size-4" />
              Permissions
            </TabsTrigger>
            <TabsTrigger value="statements" class="flex-1">
              <Icon name="lucide:file-text" class="mr-1.5 size-4" />
              Statements
            </TabsTrigger>
            <TabsTrigger value="booking" class="flex-1">
              <Icon name="lucide:calendar-check-2" class="mr-1.5 size-4" />
              Self-booking
            </TabsTrigger>
            <TabsTrigger value="contract" class="flex-1">
              <Icon name="lucide:file-signature" class="mr-1.5 size-4" />
              Contract
            </TabsTrigger>
            <TabsTrigger value="access" class="flex-1">
              <Icon name="lucide:key-round" class="mr-1.5 size-4" />
              Portal Access
            </TabsTrigger>
          </TabsList>

          <!-- Overview -->
          <TabsContent value="overview" class="space-y-3 pt-3">
            <dl class="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt class="text-xs uppercase tracking-wide text-muted-foreground">
                  Phone
                </dt>
                <dd class="font-medium">
                  {{ owner.phone || '—' }}
                </dd>
              </div>
              <div>
                <dt class="text-xs uppercase tracking-wide text-muted-foreground">
                  Language
                </dt>
                <dd class="font-medium">
                  {{ owner.language === 'en' ? 'English' : 'Bahasa Indonesia' }}
                </dd>
              </div>
              <div>
                <dt class="text-xs uppercase tracking-wide text-muted-foreground">
                  Statement currency
                </dt>
                <dd class="font-mono">
                  {{ owner.statementCurrency }}
                </dd>
              </div>
              <div>
                <dt class="text-xs uppercase tracking-wide text-muted-foreground">
                  Owner-use night cap
                </dt>
                <dd class="font-medium">
                  {{ owner.annualOwnerUseNightCap ?? '—' }} {{ owner.annualOwnerUseNightCap ? 'nights / year' : '' }}
                </dd>
              </div>
              <div>
                <dt class="text-xs uppercase tracking-wide text-muted-foreground">
                  Created
                </dt>
                <dd class="font-medium">
                  {{ new Date(owner.createdAt).toLocaleDateString() }}
                </dd>
              </div>
              <div>
                <dt class="text-xs uppercase tracking-wide text-muted-foreground">
                  Invited
                </dt>
                <dd class="font-medium">
                  {{ owner.invitedAt ? new Date(owner.invitedAt).toLocaleDateString() : '—' }}
                </dd>
              </div>
            </dl>
          </TabsContent>

          <!-- Properties & Commission -->
          <TabsContent value="properties" class="space-y-3 pt-3">
            <div v-if="ownerMappings.length === 0" class="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              No properties assigned.
            </div>
            <div v-else class="space-y-3">
              <div
                v-for="m in ownerMappings"
                :key="m.id"
                class="rounded-md border p-3"
              >
                <div class="flex items-center justify-between">
                  <div>
                    <div class="font-medium">
                      {{ listingById.get(m.listingId)?.name ?? m.listingId }}
                    </div>
                    <div class="text-xs text-muted-foreground">
                      {{ m.ownershipPercentage }}%{{ m.unitId ? ` · unit ${m.unitId}` : '' }} · from {{ m.effectiveFrom }}
                    </div>
                  </div>
                </div>
                <Separator class="my-3" />
                <div v-if="ownerRules.find(r => r.listingId === m.listingId)" class="space-y-1">
                  <div class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Commission rule
                  </div>
                  <div class="text-sm">
                    {{ ownerRules.find(r => r.listingId === m.listingId)?.name }} ·
                    <span class="text-muted-foreground">{{ ownerRules.find(r => r.listingId === m.listingId)?.type }}</span>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <!-- Permissions -->
          <TabsContent value="permissions" class="space-y-3 pt-3">
            <div class="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                @click="handleApplyTemplate('full_transparency')"
              >
                Apply Full transparency
              </Button>
              <Button
                variant="outline"
                size="sm"
                @click="handleApplyTemplate('financial_summary')"
              >
                Apply Financial summary
              </Button>
            </div>
            <Separator />
            <OwnerPermissionMatrix
              v-if="ownerPermissions"
              :config="ownerPermissions"
              @update:config="handleMatrixUpdate"
            />
            <p v-else class="text-sm text-muted-foreground">
              No permission config found.
            </p>
          </TabsContent>

          <!-- Statements -->
          <TabsContent value="statements" class="space-y-3 pt-3">
            <div v-if="ownerStatements.length === 0" class="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              No statements yet.
            </div>
            <div v-else class="space-y-2">
              <div
                v-for="stmt in ownerStatements"
                :key="stmt.id"
                class="flex items-center justify-between rounded-md border p-3"
              >
                <div>
                  <div class="font-medium">
                    {{ stmt.period }} · {{ listingById.get(stmt.listingId)?.name ?? stmt.listingId }}
                  </div>
                  <div class="text-xs text-muted-foreground">
                    {{ stmt.currency }} {{ stmt.totalAmount.toLocaleString() }} ·
                    {{ stmt.status }}
                  </div>
                </div>
                <Badge :variant="stmt.status === 'published' ? 'default' : 'secondary'">
                  {{ stmt.status }}
                </Badge>
              </div>
            </div>
          </TabsContent>

          <!-- Self-booking mode + seasonal quotas (PRD 5.2) -->
          <TabsContent value="booking" class="space-y-3 pt-3">
            <div v-if="ownerMappings.length === 0" class="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              Assign a property first to configure self-booking.
            </div>

            <template v-else>
              <div class="space-y-3">
                <div
                  v-for="m in ownerMappings"
                  :key="m.id"
                  class="rounded-md border p-3"
                >
                  <div class="flex items-center justify-between">
                    <div class="text-sm font-medium">
                      {{ listingById.get(m.listingId)?.name ?? m.listingId }}
                    </div>
                    <Select
                      :model-value="currentMode(m.listingId)"
                      @update:model-value="(v) => applyMode(m.listingId, String(v) as OwnerBookingMode)"
                    >
                      <SelectTrigger class="w-44">
                        <SelectValue placeholder="Booking mode" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="direct">
                          Direct booking
                        </SelectItem>
                        <SelectItem value="request">
                          Request to book
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <p class="mt-1 text-xs text-muted-foreground">
                    {{ currentMode(m.listingId) === 'direct'
                      ? 'Owner dates are blocked immediately.'
                      : 'Owner dates need management approval.' }}
                  </p>
                </div>
              </div>

              <Separator />

              <div class="flex items-center justify-between">
                <div class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Seasonal quotas (non-accumulating)
                </div>
                <Button size="sm" variant="outline" @click="openAddQuota">
                  <Icon name="lucide:plus" class="mr-1.5 size-3.5" />
                  Add window
                </Button>
              </div>

              <div v-if="!owner || quotasForOwnerListing(owner.id, ownerMappings[0]?.listingId ?? '').length === 0" class="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                No quota windows for this owner's properties yet.
              </div>
              <div v-else class="space-y-2">
                <div
                  v-for="q in owner ? ownerMappings.flatMap(m => quotasForOwnerListing(owner!.id, m.listingId)) : []"
                  :key="q.id"
                  class="flex items-center justify-between rounded-md border p-2.5 text-sm"
                >
                  <div>
                    <span class="font-medium">{{ q.startDate }} → {{ q.endDate }}</span>
                    <span class="ml-2 text-muted-foreground">{{ q.maxNights }} nights</span>
                  </div>
                  <Button variant="ghost" size="icon-sm" @click="deleteQuota(q.id)">
                    <Icon name="lucide:trash-2" class="size-3.5" />
                  </Button>
                </div>
              </div>
            </template>

            <Dialog :open="!!quotaInput" @update:open="(v: boolean) => { if (!v) quotaInput = null }">
              <DialogContent class="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Add seasonal quota</DialogTitle>
                  <DialogDescription>
                    Max self-booked nights in this window. Unused nights do not roll over.
                  </DialogDescription>
                </DialogHeader>
                <div v-if="quotaInput" class="space-y-3">
                  <div class="space-y-1.5">
                    <Label>Listing</Label>
                    <Select v-model="quotaInput.listingId">
                      <SelectTrigger>
                        <SelectValue placeholder="Pick a listing" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem v-for="m in ownerMappings" :key="m.listingId" :value="m.listingId">
                          {{ listingById.get(m.listingId)?.name ?? m.listingId }}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div class="grid grid-cols-2 gap-3">
                    <div class="space-y-1.5">
                      <Label for="quota-start">Start date</Label>
                      <Input id="quota-start" v-model="quotaInput.startDate" type="date" />
                    </div>
                    <div class="space-y-1.5">
                      <Label for="quota-end">End date</Label>
                      <Input id="quota-end" v-model="quotaInput.endDate" type="date" />
                    </div>
                  </div>
                  <div class="space-y-1.5">
                    <Label for="quota-max">Max nights (0 = blocked)</Label>
                    <Input id="quota-max" v-model.number="quotaInput.maxNights" type="number" min="0" />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" @click="quotaInput = null">
                    Cancel
                  </Button>
                  <Button @click="saveQuota">
                    Save quota
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>

          <!-- Contract (PRD 5.3) -->
          <TabsContent value="contract" class="space-y-3 pt-3">
            <!-- Operational cost share (PRD 5.1.3) — set at owner creation, shown read-only here -->
            <div v-if="ownerMappings.length > 0" class="rounded-md border p-3">
              <div class="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Operational costs covered by owner
              </div>
              <div class="space-y-1.5 text-sm">
                <div
                  v-for="m in ownerMappings"
                  :key="m.listingId"
                  class="flex items-center justify-between"
                >
                  <span class="text-muted-foreground">
                    {{ listingById.get(m.listingId)?.name ?? m.listingId }}
                  </span>
                  <span class="font-medium">
                    {{ getFeeFor(owner!.id, m.listingId)?.percentage ?? 100 }}%
                  </span>
                </div>
              </div>
              <p class="mt-2 text-xs text-muted-foreground">
                Set during owner creation. 100% = owner covers all cleaning &amp; utilities; 0% = management absorbs them.
              </p>
            </div>

            <div v-if="!ownerContract" class="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              No contract yet. Generate one from the owner's commission terms.
            </div>
            <div v-else class="space-y-3">
              <div class="flex items-center justify-between rounded-md border p-3">
                <div>
                  <div class="text-sm font-medium">
                    Management agreement
                  </div>
                  <div class="text-xs text-muted-foreground">
                    {{ ownerContract.terms.basis === 'net'
                      ? `Fixed ${ownerContract.terms.fixedAmount ?? 0} + ${ownerContract.terms.rate}% of Net`
                      : `${ownerContract.terms.rate}% of Gross` }}
                    · {{ ownerContract.listingIds.length }} listing(s)
                  </div>
                </div>
                <Badge :variant="ownerContract.status === 'signed' ? 'default' : ownerContract.status === 'sent' ? 'secondary' : 'outline'">
                  {{ ownerContract.status }}
                </Badge>
              </div>

              <div class="flex flex-wrap gap-2">
                <Button v-if="ownerContract.status === 'draft'" size="sm" @click="handleSendContract">
                  Send magic link to sign
                </Button>
                <Button v-if="ownerContract.status !== 'signed'" size="sm" variant="outline" @click="handleGenerateContract">
                  Regenerate from terms
                </Button>
                <Button v-if="ownerContract.status === 'signed'" size="sm" variant="outline" @click="handleDownloadContractPdf">
                  <Icon name="lucide:file-down" class="mr-1.5 size-3.5" />
                  Download PDF
                </Button>
                <Button size="sm" variant="outline" as-child>
                  <NuxtLink to="/owner-documents">
                    View in Document Center
                  </NuxtLink>
                </Button>
              </div>
            </div>
          </TabsContent>

          <!-- Portal Access (Flow 8) -->
          <TabsContent value="access" class="space-y-3 pt-3">
            <div class="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
              <div>
                <div class="text-sm font-medium">
                  Magic link status
                </div>
                <div class="text-xs text-muted-foreground">
                  {{ magicLinkStatusLabel[owner.magicLinkStatus ?? 'active'] ?? 'Active' }}
                  <template v-if="owner.accessRevokedAt">
                    · revoked {{ new Date(owner.accessRevokedAt).toLocaleString() }}
                  </template>
                </div>
              </div>
              <div class="flex gap-2">
                <Button
                  v-if="owner.magicLinkStatus !== 'revoked'"
                  variant="destructive"
                  size="sm"
                  @click="revokeOpen = true"
                >
                  Revoke access
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  :disabled="owner.status === 'inactive'"
                  @click="handleRegenerate"
                >
                  Regenerate link
                </Button>
              </div>
            </div>

            <Separator />

            <div class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Access history
            </div>
            <div v-if="!accessLogEntries.length" class="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
              No access activity yet.
            </div>
            <div v-else class="space-y-2">
              <div
                v-for="entry in accessLogEntries"
                :key="entry.id"
                class="flex items-center justify-between rounded-md border p-2.5 text-sm"
              >
                <div>
                  <div class="font-medium">
                    {{ entry.action.replace(/_/g, ' ') }}
                  </div>
                  <div class="text-xs text-muted-foreground">
                    {{ entry.actor }} · {{ entry.note ?? '' }}
                  </div>
                </div>
                <div class="text-xs text-muted-foreground">
                  {{ new Date(entry.at).toLocaleString() }}
                </div>
              </div>
            </div>

            <Dialog :open="revokeOpen" @update:open="(v: boolean) => { if (!v) revokeOpen = false }">
              <DialogContent class="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Revoke portal access?</DialogTitle>
                  <DialogDescription>
                    {{ owner.name }} will be logged out immediately and can no longer enter the portal until a new link is sent.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" @click="revokeOpen = false">
                    Cancel
                  </Button>
                  <Button variant="destructive" @click="handleRevoke">
                    Revoke access
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>
        </Tabs>
      </div>

      <SheetFooter v-if="owner" class="flex-row items-center justify-between gap-2 border-t px-6 py-4">
        <div class="text-xs text-muted-foreground">
          {{ owner.email }}
        </div>
        <div class="flex items-center gap-2">
          <Button
            v-if="owner.status === 'draft'"
            variant="outline"
            size="sm"
            @click="handleAction(() => inviteOwner(owner!.id), 'Invitation queued.')"
          >
            Invite
          </Button>
          <Button
            v-if="owner.status === 'invited'"
            variant="outline"
            size="sm"
            @click="handleAction(() => activateOwner(owner!.id), `${owner.name} is now active.`)"
          >
            Activate
          </Button>
          <Button
            v-if="owner.status === 'active'"
            variant="outline"
            size="sm"
            @click="handleAction(() => deactivateOwner(owner!.id), `${owner.name} deactivated.`)"
          >
            Deactivate
          </Button>
          <Button
            v-if="owner.status === 'inactive'"
            variant="outline"
            size="sm"
            @click="handleAction(() => reactivateOwner(owner!.id), `${owner.name} reactivated.`)"
          >
            Reactivate
          </Button>
        </div>
      </SheetFooter>
    </SheetContent>
  </Sheet>
</template>
