<!-- app/components/owners/OwnerDetailSheet.vue -->
<!--
  Read-mostly sheet for an individual owner — Overview, Properties &
  Commission, Permissions, and Statements tabs. Uses the same Sheet +
  Tabs pattern as RoleDetailSheet.
-->
<script setup lang="ts">
import type { CommissionRule } from '~/components/owners/data/commission-rules'
import type { OwnerBookingMode, OwnerSeasonalQuota } from '~/components/owners/data/owner-quotas'
import type { Owner, OwnerStatus } from '~/components/owners/data/owners'
import { CalendarDate, getLocalTimeZone } from '@internationalized/date'
import { computed } from 'vue'
import { toast } from 'vue-sonner'
import { listings } from '~/components/listings/data/listings'
import StatementPublishDialog from '~/components/owner-statements/StatementPublishDialog.vue'
import { OWNER_BOOKING_MODE_LABELS } from '~/components/owners/data/owner-quotas'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import { Separator } from '~/components/ui/separator'
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '~/components/ui/sheet'
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

/** Format an ISO date (YYYY-MM-DD) as DD-MMM-YYYY, e.g. "01 Jan 2026". */
function formatQuotaDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(date.getTime()))
    return iso
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

/** Capitalize the first letter of a label (e.g. "link used" → "Link used"). */
function capitalizeLabel(label: string): string {
  if (!label)
    return label
  return label.charAt(0).toUpperCase() + label.slice(1)
}

const {
  byId,
  mappings,
  commissionRules,
  inviteOwner,
  activateOwner,
  deactivateOwner,
  reactivateOwner,
  updatePermissions,
  updateOwner,
  findPermissions,
} = useOwners()
const { statements } = useOwnerStatements()
const { applyTemplate } = useOwnerPermissions()
const { revokeAccess, regenerateAccess, getAccessLog } = useOwnerAuth()

const owner = computed<Owner | undefined>(() => props.ownerId ? byId(props.ownerId) : undefined)

// Tab scroll fade indicators — show a gradient on the side that still has
// hidden tabs, hide it once that edge is reached.
const tabsScrollRef = ref<HTMLElement | null>(null)
const canScrollLeft = ref(false)
const canScrollRight = ref(false)

function updateTabFades() {
  const el = tabsScrollRef.value
  if (!el)
    return
  canScrollLeft.value = el.scrollLeft > 4
  canScrollRight.value = el.scrollLeft + el.clientWidth < el.scrollWidth - 4
}

onMounted(() => {
  nextTick(updateTabFades)
  const el = tabsScrollRef.value
  if (el) {
    el.addEventListener('scroll', updateTabFades, { passive: true })
    window.addEventListener('resize', updateTabFades)
  }
})

watch(() => props.open, (value) => {
  if (value)
    nextTick(updateTabFades)
})

onBeforeUnmount(() => {
  const el = tabsScrollRef.value
  if (el) {
    el.removeEventListener('scroll', updateTabFades)
    window.removeEventListener('resize', updateTabFades)
  }
})

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
const quotaInput = ref<{ id?: string, ownerId: string, listingId: string, startDate: string, endDate: string, maxNights: number } | null>(null)

// Date range picker for the seasonal quota window
const quotaDateRange = ref<any>({ start: undefined, end: undefined })
const quotaDatePopoverOpen = ref(false)

function quotaCalendarDate(iso: string): any {
  if (!iso)
    return undefined
  const parts = iso.split('-').map(Number)
  if (parts.length !== 3 || parts.some(p => !Number.isFinite(p)))
    return undefined
  const [year, month, day] = parts as [number, number, number]
  return new CalendarDate(year, month, day)
}

function quotaDateToString(date: any): string {
  if (!date)
    return ''
  return date.toDate(getLocalTimeZone()).toISOString().split('T')[0]
}

function formatQuotaDateLabel(iso: string): string {
  return iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : ''
}

watch(quotaDateRange, (val) => {
  if (quotaInput.value) {
    quotaInput.value.startDate = quotaDateToString(val.start)
    quotaInput.value.endDate = quotaDateToString(val.end)
  }
}, { deep: true })

watch(() => quotaInput.value, (val) => {
  if (val) {
    quotaDateRange.value = {
      start: quotaCalendarDate(val.startDate),
      end: quotaCalendarDate(val.endDate),
    }
  }
})

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

function openEditQuota(q: OwnerSeasonalQuota) {
  quotaInput.value = {
    id: q.id,
    ownerId: q.ownerId,
    listingId: q.listingId,
    startDate: q.startDate,
    endDate: q.endDate,
    maxNights: q.maxNights,
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

// Statement preview / publish (tab Statements)
const statementPreviewOpen = ref(false)
const statementPreviewId = ref<string | null>(null)

function openStatementPreview(statementId: string) {
  statementPreviewId.value = statementId
  statementPreviewOpen.value = true
}

// Edit owner details (Overview tab)
const isEditingOwner = ref(false)
const editForm = ref({ name: '', email: '', phone: '', language: 'en' as 'en' | 'id', statementCurrency: 'IDR' as 'IDR' | 'USD' | 'AUD' | 'SGD' | 'EUR', annualOwnerUseNightCap: 0 })

function startEditOwner() {
  if (!owner.value)
    return
  editForm.value = {
    name: owner.value.name,
    email: owner.value.email,
    phone: owner.value.phone,
    language: owner.value.language,
    statementCurrency: owner.value.statementCurrency,
    annualOwnerUseNightCap: owner.value.annualOwnerUseNightCap ?? 0,
  }
  isEditingOwner.value = true
}

function cancelEditOwner() {
  isEditingOwner.value = false
}

function saveEditOwner() {
  if (!owner.value)
    return
  const result = updateOwner(owner.value.id, {
    name: editForm.value.name.trim(),
    email: editForm.value.email.trim(),
    phone: editForm.value.phone.trim(),
    language: editForm.value.language,
    statementCurrency: editForm.value.statementCurrency,
    annualOwnerUseNightCap: editForm.value.annualOwnerUseNightCap || undefined,
  })
  if (result.success) {
    toast.success('Owner details updated.')
    isEditingOwner.value = false
  }
  else {
    toast.error(result.error ?? 'Failed to update owner.')
  }
}
</script>

<template>
  <Sheet :open="open" @update:open="(v) => emit('update:open', v)">
    <SheetContent side="right" class="flex w-full flex-col p-0 sm:max-w-3xl">
      <SheetHeader class="border-b px-6 pb-4 pt-6">
        <div class="flex items-start justify-between gap-3">
          <SheetTitle>
            {{ owner?.name ?? 'Owner' }}
          </SheetTitle>
          <Button
            v-if="owner"
            variant="outline"
            size="sm"
            @click="isEditingOwner ? cancelEditOwner() : startEditOwner()"
          >
            <Icon :name="isEditingOwner ? 'lucide:x' : 'lucide:pencil'" class="mr-1.5 size-3.5" />
            {{ isEditingOwner ? 'Cancel' : 'Edit' }}
          </Button>
        </div>
        <div v-if="owner" class="flex items-center gap-2 pt-1">
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
      </SheetHeader>

      <div v-if="owner" class="flex-1 min-h-0 overflow-y-auto px-6 py-4">
        <Tabs default-value="overview" class="w-full">
          <div class="relative">
            <div
              ref="tabsScrollRef"
              class="no-scrollbar w-full overflow-x-auto"
            >
              <TabsList class="w-max min-w-full justify-start">
                <TabsTrigger value="overview" class="shrink-0">
                  <Icon name="lucide:user" class="mr-1.5 size-4" />
                  Overview
                </TabsTrigger>
                <TabsTrigger value="properties" class="shrink-0">
                  <Icon name="lucide:building-2" class="mr-1.5 size-4" />
                  Properties
                </TabsTrigger>
                <TabsTrigger value="permissions" class="shrink-0">
                  <Icon name="lucide:shield-check" class="mr-1.5 size-4" />
                  Permissions
                </TabsTrigger>
                <TabsTrigger value="statements" class="shrink-0">
                  <Icon name="lucide:file-text" class="mr-1.5 size-4" />
                  Statements
                </TabsTrigger>
                <TabsTrigger value="booking" class="shrink-0">
                  <Icon name="lucide:calendar-check-2" class="mr-1.5 size-4" />
                  Self-booking
                </TabsTrigger>
                <TabsTrigger value="contract" class="shrink-0">
                  <Icon name="lucide:file-signature" class="mr-1.5 size-4" />
                  Contract
                </TabsTrigger>
                <TabsTrigger value="access" class="shrink-0">
                  <Icon name="lucide:key-round" class="mr-1.5 size-4" />
                  Access
                </TabsTrigger>
              </TabsList>
            </div>
            <!-- Fade indicators: show only on sides that still have hidden tabs -->
            <div
              v-if="canScrollLeft"
              class="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-background to-transparent"
            />
            <div
              v-if="canScrollRight"
              class="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background to-transparent"
            />
          </div>

          <!-- Overview -->
          <TabsContent value="overview" class="space-y-3 pt-3">
            <!-- Edit form -->
            <form v-if="isEditingOwner" class="space-y-4" @submit.prevent="saveEditOwner">
              <div class="space-y-1.5">
                <Label for="edit-owner-name">Name</Label>
                <Input id="edit-owner-name" v-model="editForm.name" />
              </div>
              <div class="space-y-1.5">
                <Label for="edit-owner-email">Email</Label>
                <Input id="edit-owner-email" v-model="editForm.email" type="email" />
              </div>
              <div class="space-y-1.5">
                <Label for="edit-owner-phone">Phone</Label>
                <Input id="edit-owner-phone" v-model="editForm.phone" />
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div class="space-y-1.5">
                  <Label for="edit-owner-language">Language</Label>
                  <Select v-model="editForm.language">
                    <SelectTrigger id="edit-owner-language">
                      <SelectValue placeholder="Language" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">
                        English
                      </SelectItem>
                      <SelectItem value="id">
                        Bahasa Indonesia
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div class="space-y-1.5">
                  <Label for="edit-owner-currency">Statement currency</Label>
                  <Select v-model="editForm.statementCurrency">
                    <SelectTrigger id="edit-owner-currency">
                      <SelectValue placeholder="Currency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="IDR">
                        IDR
                      </SelectItem>
                      <SelectItem value="USD">
                        USD
                      </SelectItem>
                      <SelectItem value="AUD">
                        AUD
                      </SelectItem>
                      <SelectItem value="SGD">
                        SGD
                      </SelectItem>
                      <SelectItem value="EUR">
                        EUR
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div class="space-y-1.5">
                <Label for="edit-owner-cap">Owner-use night cap (0 = no cap)</Label>
                <Input id="edit-owner-cap" v-model.number="editForm.annualOwnerUseNightCap" type="number" min="0" />
              </div>
              <div class="flex justify-end gap-2">
                <Button type="button" variant="outline" @click="cancelEditOwner">
                  Cancel
                </Button>
                <Button type="submit" :disabled="!editForm.name.trim() || !editForm.email.trim()">
                  Save changes
                </Button>
              </div>
            </form>

            <!-- Read-only view -->
            <dl v-else class="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt class="text-xs font-medium text-muted-foreground">
                  Email
                </dt>
                <dd class="font-medium">
                  <a
                    v-if="owner.email"
                    :href="`mailto:${owner.email}`"
                    class="text-primary underline-offset-2 hover:underline"
                  >
                    {{ owner.email }}
                  </a>
                  <span v-else>—</span>
                </dd>
              </div>
              <div>
                <dt class="text-xs font-medium text-muted-foreground">
                  Phone
                </dt>
                <dd class="font-medium">
                  <a
                    v-if="owner.phone"
                    :href="`tel:${owner.phone}`"
                    class="text-primary underline-offset-2 hover:underline"
                  >
                    {{ owner.phone }}
                  </a>
                  <span v-else>—</span>
                </dd>
              </div>
              <div>
                <dt class="text-xs font-medium text-muted-foreground">
                  Language
                </dt>
                <dd class="font-medium">
                  {{ owner.language === 'en' ? 'English' : 'Bahasa Indonesia' }}
                </dd>
              </div>
              <div>
                <dt class="text-xs font-medium text-muted-foreground">
                  Statement currency
                </dt>
                <dd class="font-mono">
                  {{ owner.statementCurrency }}
                </dd>
              </div>
              <div>
                <dt class="text-xs font-medium text-muted-foreground">
                  Owner-use night cap
                </dt>
                <dd class="font-medium">
                  {{ owner.annualOwnerUseNightCap ?? '—' }} {{ owner.annualOwnerUseNightCap ? 'nights / year' : '' }}
                </dd>
              </div>
              <div>
                <dt class="text-xs font-medium text-muted-foreground">
                  Created
                </dt>
                <dd class="font-medium">
                  {{ new Date(owner.createdAt).toLocaleDateString('en-GB') }}
                </dd>
              </div>
              <div>
                <dt class="text-xs font-medium text-muted-foreground">
                  Invited
                </dt>
                <dd class="font-medium">
                  {{ owner.invitedAt ? new Date(owner.invitedAt).toLocaleDateString('en-GB') : '—' }}
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
                      {{ m.ownershipPercentage }}%{{ m.unitId ? ` · unit ${m.unitId}` : '' }} · from {{ new Date(`${m.effectiveFrom}T00:00:00`).toLocaleDateString('en-GB') }}
                    </div>
                  </div>
                </div>
                <Separator class="my-3" />
                <div v-if="ownerRules.find(r => r.listingId === m.listingId)" class="space-y-1">
                  <div class="text-xs font-medium text-muted-foreground">
                    Commission rule
                  </div>
                  <div class="text-sm">
                    {{ ownerRules.find(r => r.listingId === m.listingId)?.name }} ·
                    <span class="text-muted-foreground">{{ capitalizeLabel(ownerRules.find(r => r.listingId === m.listingId)?.type ?? '') }}</span>
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
                <div class="min-w-0">
                  <div class="font-medium">
                    {{ stmt.period }} · {{ listingById.get(stmt.listingId)?.name ?? stmt.listingId }}
                  </div>
                  <div class="text-xs text-muted-foreground">
                    {{ stmt.currency }} {{ stmt.totalAmount.toLocaleString() }}
                  </div>
                </div>
                <div class="flex shrink-0 items-center gap-2">
                  <Badge :variant="stmt.status === 'published' ? 'default' : 'secondary'">
                    {{ capitalizeLabel(stmt.status) }}
                  </Badge>
                  <Button
                    v-if="stmt.status === 'draft'"
                    variant="outline"
                    size="sm"
                    @click="openStatementPreview(stmt.id)"
                  >
                    Preview & Publish
                  </Button>
                  <Button
                    v-else
                    variant="outline"
                    size="sm"
                    @click="openStatementPreview(stmt.id)"
                  >
                    View
                  </Button>
                </div>
              </div>
            </div>

            <StatementPublishDialog
              v-if="statementPreviewId"
              v-model="statementPreviewOpen"
              :statement-id="statementPreviewId"
              published-by="staff-1"
              @published="(id) => toast.info(`Statement ${id} published.`)"
            />
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
                  class="flex items-center justify-between gap-3 rounded-md border p-3"
                >
                  <div class="min-w-0 flex-1">
                    <div class="text-sm font-medium leading-snug">
                      {{ listingById.get(m.listingId)?.name ?? m.listingId }}
                    </div>
                    <p class="mt-0.5 text-xs text-muted-foreground">
                      {{ currentMode(m.listingId) === 'direct'
                        ? 'Owner dates are blocked immediately.'
                        : 'Owner dates need management approval.' }}
                    </p>
                  </div>
                  <Select
                    :model-value="currentMode(m.listingId)"
                    @update:model-value="(v) => applyMode(m.listingId, String(v) as OwnerBookingMode)"
                  >
                    <SelectTrigger class="w-44 shrink-0">
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
              </div>

              <Separator />

              <div class="flex items-center justify-between">
                <div class="text-xs font-medium text-muted-foreground">
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
                    <span class="font-medium">{{ formatQuotaDate(q.startDate) }} → {{ formatQuotaDate(q.endDate) }}</span>
                    <span class="ml-2 text-muted-foreground">{{ q.maxNights }} nights</span>
                  </div>
                  <div class="flex items-center gap-1">
                    <Button variant="ghost" size="icon-sm" @click="openEditQuota(q)">
                      <Icon name="lucide:pencil" class="size-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" @click="deleteQuota(q.id)">
                      <Icon name="lucide:trash-2" class="size-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </template>

            <Dialog :open="!!quotaInput" @update:open="(v: boolean) => { if (!v) quotaInput = null }">
              <DialogContent class="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>{{ quotaInput?.id ? 'Edit seasonal quota' : 'Add seasonal quota' }}</DialogTitle>
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
                  <div class="space-y-1.5">
                    <Label>Date range</Label>
                    <Popover v-model:open="quotaDatePopoverOpen">
                      <PopoverTrigger as-child>
                        <Button
                          variant="outline"
                          class="w-full justify-start gap-1.5 px-3 font-normal"
                        >
                          <Icon name="lucide:calendar" class="size-4 shrink-0 text-muted-foreground" />
                          <template v-if="quotaInput.startDate && quotaInput.endDate">
                            {{ formatQuotaDateLabel(quotaInput.startDate) }} – {{ formatQuotaDateLabel(quotaInput.endDate) }}
                          </template>
                          <template v-else>
                            <span class="text-muted-foreground">Select date range</span>
                          </template>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent class="w-auto p-0" align="start">
                        <div class="p-3">
                          <RangeCalendar
                            v-model="quotaDateRange"
                            weekday-format="short"
                            :number-of-months="1"
                            initial-focus
                            :placeholder="quotaDateRange.start"
                            @update:start-value="(startDate: any) => quotaDateRange.start = startDate"
                          />
                          <div class="mt-3 flex items-center justify-between border-t pt-3">
                            <p class="text-xs text-muted-foreground">
                              <template v-if="quotaDateRange.start && quotaDateRange.end">
                                {{ quotaDateRange.start.toDate(getLocalTimeZone()).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) }} – {{ quotaDateRange.end.toDate(getLocalTimeZone()).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) }}
                              </template>
                              <template v-else>
                                Pick a start and end date
                              </template>
                            </p>
                            <Button
                              v-if="quotaInput.startDate || quotaInput.endDate"
                              variant="ghost"
                              size="sm"
                              class="h-7 text-xs text-muted-foreground"
                              @click="quotaDateRange = { start: undefined, end: undefined }"
                            >
                              Clear
                            </Button>
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div class="space-y-1.5">
                    <div class="flex items-center gap-1">
                      <Label for="quota-max">Max nights</Label>
                      <Tooltip>
                        <TooltipTrigger as-child>
                          <Button type="button" variant="ghost" size="icon-sm" class="size-4">
                            <Icon name="lucide:info" class="size-3.5 text-muted-foreground" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          0 = blocked
                        </TooltipContent>
                      </Tooltip>
                    </div>
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
              <div class="mb-2 text-xs font-medium text-muted-foreground">
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
                  {{ capitalizeLabel(ownerContract.status) }}
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
                    · revoked {{ new Date(owner.accessRevokedAt).toLocaleDateString('en-GB') }}
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

            <div class="text-xs font-medium text-muted-foreground">
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
                    {{ capitalizeLabel(entry.action.replace(/_/g, ' ')) }}
                  </div>
                  <div class="text-xs text-muted-foreground">
                    {{ entry.actor }} · {{ entry.note ?? '' }}
                  </div>
                </div>
                <div class="text-xs text-muted-foreground">
                  {{ new Date(entry.at).toLocaleDateString('en-GB') }}
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
