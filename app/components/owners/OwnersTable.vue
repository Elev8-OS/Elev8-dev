<!-- app/components/owners/OwnersTable.vue -->
<!--
  Directory table for tenant owners. Uses the same TanStack-style plain
  HTML <table> as the users table for consistency.
-->
<script setup lang="ts">
import type { CommissionRule } from '~/components/owners/data/commission-rules'
import type { Owner, OwnerStatus } from '~/components/owners/data/owners'
import { computed } from 'vue'
import { toast } from 'vue-sonner'
import { listings } from '~/components/listings/data/listings'
import { Avatar, AvatarFallback } from '~/components/ui/avatar'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '~/components/ui/dropdown-menu'
import { useOwnerPermissions } from '~/composables/useOwnerPermissions'
import { useOwners } from '~/composables/useOwners'
import { useOwnerStatements } from '~/composables/useOwnerStatements'

const emit = defineEmits<{
  selectOwner: [owner: Owner]
}>()

const { owners, filteredOwners, mappings, commissionRules, inviteOwner, activateOwner, deactivateOwner, reactivateOwner } = useOwners()
const { statements } = useOwnerStatements()
const { findPermission } = useOwnerPermissions()

const listingById = computed(() => new Map(listings.value.map(l => [l.id, l])))

// Deterministic per-name avatar color — each owner gets a stable color from
// their name so avatars stay recognisable without manual assignment.
const AVATAR_COLORS = [
  'bg-sky-500/10 text-sky-700 dark:text-sky-300',
  'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  'bg-violet-500/10 text-violet-700 dark:text-violet-300',
  'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  'bg-rose-500/10 text-rose-700 dark:text-rose-300',
  'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300',
  'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300',
  'bg-lime-500/10 text-lime-700 dark:text-lime-300',
]

function avatarColorFor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]!
}

// Per-owner mapping rows + commission types — used to populate the
// "Properties" and "Commission" columns.
const rows = computed(() => {
  return filteredOwners.value.map((owner) => {
    const ownerMappings = mappings.value.filter(m => m.ownerId === owner.id)
    const properties = ownerMappings.map((m) => {
      const listing = listingById.value.get(m.listingId)
      return {
        listingId: m.listingId,
        listingName: listing?.name ?? m.listingId,
        unitId: m.unitId,
        ownershipPercentage: m.ownershipPercentage,
      }
    })
    const totalOwnership = ownerMappings.reduce((sum, m) => sum + m.ownershipPercentage, 0)
    const rules = commissionRules.value.filter((r): r is CommissionRule => r.ownerId === owner.id)
    const commissionTypes = Array.from(new Set(rules.map(r => r.type)))
    const ownerStatements = statements.value.filter(s => s.ownerId === owner.id)
    const permissions = findPermission(owner.id)
    return {
      owner,
      properties,
      totalOwnership,
      commissionTypes,
      statementCount: ownerStatements.length,
      permissions,
    }
  })
})

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

const commissionLabel: Record<CommissionRule['type'], string> = {
  flat: 'Flat',
  tiered: 'Tiered',
  hybrid: 'Hybrid',
}

function handleInvite(owner: Owner) {
  const result = inviteOwner(owner.id)
  if (result.success)
    toast.success(`Invitation queued for ${owner.name}.`)
  else toast.error(result.error ?? 'Failed to invite owner.')
}

function handleActivate(owner: Owner) {
  const result = activateOwner(owner.id)
  if (result.success)
    toast.success(`${owner.name} is now active.`)
  else toast.error(result.error ?? 'Failed to activate owner.')
}

function handleDeactivate(owner: Owner) {
  const result = deactivateOwner(owner.id)
  if (result.success)
    toast.info(`${owner.name} deactivated.`)
  else toast.error(result.error ?? 'Failed to deactivate owner.')
}

function handleReactivate(owner: Owner) {
  const result = reactivateOwner(owner.id)
  if (result.success)
    toast.success(`${owner.name} reactivated.`)
  else toast.error(result.error ?? 'Failed to reactivate owner.')
}
</script>

<template>
  <div class="space-y-3">
    <div class="overflow-hidden rounded-md border">
      <table class="w-full text-sm">
        <thead class="bg-muted/50 text-xs uppercase text-muted-foreground">
          <tr>
            <th class="px-4 py-3 text-left font-medium">
              Owner
            </th>
            <th class="px-4 py-3 text-left font-medium">
              Properties
            </th>
            <th class="px-4 py-3 text-right font-medium">
              Ownership
            </th>
            <th class="px-4 py-3 text-left font-medium">
              Commission
            </th>
            <th class="px-4 py-3 text-left font-medium">
              Currency
            </th>
            <th class="px-4 py-3 text-left font-medium">
              Status
            </th>
            <th class="w-12 px-4 py-3 text-right font-medium">
              <span class="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in rows"
            :key="row.owner.id"
            class="cursor-pointer border-t transition-colors hover:bg-muted/30"
            tabindex="0"
            @click="emit('selectOwner', row.owner)"
            @keydown.enter.prevent="emit('selectOwner', row.owner)"
            @keydown.space.prevent="emit('selectOwner', row.owner)"
          >
            <td class="px-4 py-3">
              <div class="flex items-center gap-3">
                <Avatar class="size-9">
                  <AvatarFallback :class="avatarColorFor(row.owner.name)" class="text-xs">
                    {{ row.owner.name.split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase() }}
                  </AvatarFallback>
                </Avatar>
                <div class="min-w-0">
                  <div class="truncate font-medium">
                    {{ row.owner.name }}
                  </div>
                  <div class="truncate text-xs text-muted-foreground">
                    {{ row.owner.email }}
                  </div>
                </div>
              </div>
            </td>

            <td class="px-4 py-3">
              <div v-if="row.properties.length === 0" class="inline-flex items-center gap-1 text-xs italic text-muted-foreground">
                No properties
              </div>
              <div v-else class="flex flex-wrap gap-1">
                <Badge
                  v-for="(p, i) in row.properties.slice(0, 2)"
                  :key="`${row.owner.id}-${p.listingId}-${i}`"
                  variant="outline"
                  class="text-xs"
                >
                  {{ p.listingName }} <span class="text-muted-foreground">· {{ p.ownershipPercentage }}%</span>
                </Badge>
                <Badge v-if="row.properties.length > 2" variant="outline" class="text-xs">
                  +{{ row.properties.length - 2 }}
                </Badge>
              </div>
            </td>

            <td class="px-4 py-3 text-right">
              <span class="font-medium">{{ row.totalOwnership }}%</span>
              <span class="ml-1 text-xs text-muted-foreground">total</span>
            </td>

            <td class="px-4 py-3">
              <div v-if="row.commissionTypes.length === 0" class="text-xs italic text-muted-foreground">
                —
              </div>
              <div v-else class="flex flex-wrap gap-1">
                <Badge v-for="t in row.commissionTypes" :key="t" variant="secondary" class="text-xs">
                  {{ commissionLabel[t] }}
                </Badge>
              </div>
            </td>

            <td class="px-4 py-3 font-mono text-xs">
              {{ row.owner.statementCurrency }}
            </td>

            <td class="px-4 py-3">
              <Badge variant="outline" :class="statusBadgeClass[row.owner.status]">
                {{ statusLabel[row.owner.status] }}
              </Badge>
            </td>

            <td class="px-4 py-3 text-right" @click.stop>
              <DropdownMenu>
                <DropdownMenuTrigger as-child>
                  <Button variant="ghost" size="icon" class="size-8" :aria-label="`Actions for ${row.owner.name}`">
                    <Icon name="lucide:more-horizontal" class="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem @click="emit('selectOwner', row.owner)">
                    <Icon name="lucide:eye" class="mr-2 size-4" />
                    View detail
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem v-if="row.owner.status === 'draft'" @click="handleInvite(row.owner)">
                    <Icon name="lucide:send" class="mr-2 size-4" />
                    Invite
                  </DropdownMenuItem>
                  <DropdownMenuItem v-if="row.owner.status === 'invited'" @click="handleActivate(row.owner)">
                    <Icon name="lucide:user-check" class="mr-2 size-4" />
                    Activate
                  </DropdownMenuItem>
                  <DropdownMenuItem v-if="row.owner.status === 'active'" @click="handleDeactivate(row.owner)">
                    <Icon name="lucide:user-x" class="mr-2 size-4" />
                    Deactivate
                  </DropdownMenuItem>
                  <DropdownMenuItem v-if="row.owner.status === 'inactive'" @click="handleReactivate(row.owner)">
                    <Icon name="lucide:user-check" class="mr-2 size-4" />
                    Reactivate
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </td>
          </tr>

          <tr v-if="rows.length === 0">
            <td colspan="7" class="px-4 py-12 text-center text-sm text-muted-foreground">
              <div class="flex flex-col items-center gap-2">
                <Icon name="lucide:users" class="size-8 opacity-50" />
                <p v-if="owners.length === 0">
                  No owners yet — add your first owner.
                </p>
                <p v-else>
                  No owners match your filters.
                </p>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="text-xs text-muted-foreground">
      Showing {{ rows.length }} of {{ owners.length }} owners
    </div>
  </div>
</template>
