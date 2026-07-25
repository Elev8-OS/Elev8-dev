<!-- app/components/owners/OwnerDetailSheet.vue -->
<!--
  Read-mostly sheet for an individual owner — Overview, Properties &
  Commission, Permissions, and Statements tabs. Uses the same Sheet +
  Tabs pattern as RoleDetailSheet.
-->
<script setup lang="ts">
import type { CommissionRule } from '~/components/owners/data/commission-rules'
import type { Owner, OwnerStatus } from '~/components/owners/data/owners'
import { computed } from 'vue'
import { toast } from 'vue-sonner'
import { listings } from '~/components/listings/data/listings'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Separator } from '~/components/ui/separator'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '~/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'
import { useOwnerPermissions } from '~/composables/useOwnerPermissions'
import { useOwners } from '~/composables/useOwners'
import { useOwnerStatements } from '~/composables/useOwnerStatements'
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
