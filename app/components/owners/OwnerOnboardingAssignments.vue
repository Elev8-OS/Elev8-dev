<!-- app/components/owners/OwnerOnboardingAssignments.vue -->
<!--
  Step 2 of the owner onboarding flow: assign one or more property mappings
  with a cumulative ownership cap of 100% per (listingId, unitId) scope,
  and a commission rule per mapping.

  The parent passes one mapping draft at a time and a callback to mutate the
  parent draft list. We never mutate prop arrays directly — every change is
  emitted as a copy.
-->
<script setup lang="ts">
import type { CommissionRuleDraft } from '~/components/owners/data/commission-rules'
import type { OwnerPropertyMapping } from '~/components/owners/data/owners'
import { toast } from 'vue-sonner'
import { listings } from '~/components/listings/data/listings'
import SharedPropertyPicker from '~/components/shared/PropertyPicker.vue'
import { Alert, AlertDescription, AlertTitle } from '~/components/ui/alert'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { ScrollArea } from '~/components/ui/scroll-area'
import { Separator } from '~/components/ui/separator'
import { useOwners } from '~/composables/useOwners'
import CommissionRuleEditor from './CommissionRuleEditor.vue'
import { rebalanceSiblings, remainingShare } from './lib/ownership-rebalance'

export interface OwnerMappingDraft {
  mapping: Omit<OwnerPropertyMapping, 'id' | 'ownerId' | 'commissionRuleId'>
  commissionRule: CommissionRuleDraft
  /** 0–100 — share of operational costs borne by the owner (PRD 5.1.3). */
  operationalFeePercentage: number
}

interface Props {
  mappings: OwnerMappingDraft[]
  errors: Partial<Record<string, string>>
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:mappings': [value: OwnerMappingDraft[]]
}>()

const { mappings: existingMappings } = useOwners()

// Cached `listings.value` array — used to populate the property picker.
// Picker options are keyed by listing name, so we keep an id↔name index.
const listingOptions = computed(() =>
  listings.value.map(l => ({
    id: l.id,
    name: l.name,
    location: l.location,
    city: l.location.split(',')[0]?.trim() ?? l.location,
    region: l.tags?.[0] ?? 'All',
  })),
)

const listingIdByName = computed(() => {
  const map = new Map<string, string>()
  for (const l of listingOptions.value)
    map.set(l.name, l.id)
  return map
})

function listingNameById(id: string): string | undefined {
  return listingOptions.value.find(l => l.id === id)?.name
}

/**
 * An unconfigured commission rule for a newly added property row. "Add
 * another" only adds the property — the owner's commission for that
 * listing stays blank until explicitly filled in, instead of silently
 * defaulting to the standard rule.
 */
function makeEmptyRule(listingId: string): CommissionRuleDraft {
  return {
    type: 'flat',
    rate: 0,
    listingId,
    name: '',
    effectiveFrom: new Date().toISOString().slice(0, 10),
  }
}

function addMapping() {
  // Pick the first listing that is not already in the draft, so a new row
  // is always visibly different from the existing ones (and never silently
  // duplicates the first listing with a 0% share).
  const usedListingIds = new Set(props.mappings.map(m => m.mapping.listingId))
  const nextListing = listingOptions.value.find(l => !usedListingIds.has(l.id))
  if (!nextListing) {
    toast.info('All properties are already added.')
    return
  }
  const share = remainingShare(existingMappings.value, props.mappings, nextListing.id, undefined)
  emit('update:mappings', [
    ...props.mappings,
    {
      mapping: {
        listingId: nextListing.id,
        // Auto-fill the remaining share so a fresh row never trips the
        // 100% guard on a listing that already has owners. A fully
        // allocated scope falls back to 0 (not 100) so the row is
        // immediately visible as having no share left.
        ownershipPercentage: share ?? 0,
        effectiveFrom: new Date().toISOString().slice(0, 10),
      },
      commissionRule: makeEmptyRule(nextListing.id),
      operationalFeePercentage: 100,
    },
  ])
  toast.success(`${nextListing.name} added.`)
}

function removeMapping(index: number) {
  const next = [...props.mappings]
  next.splice(index, 1)
  emit('update:mappings', next)
}

function patchMapping(index: number, partial: Partial<OwnerMappingDraft['mapping']>) {
  const next = [...props.mappings]
  const cur = next[index]
  if (!cur)
    return
  let mappingPatch = partial
  // When the listing changes, auto-fill the remaining share for the newly
  // selected scope. A fully allocated scope falls back to 0. Clearing the
  // listing (empty string) resets the share to 0.
  const listingChanged = partial.listingId !== undefined && partial.listingId !== cur.mapping.listingId
  if (listingChanged) {
    if (partial.listingId === '') {
      mappingPatch = {
        ...partial,
        ownershipPercentage: 0,
      }
    }
    else {
      const nextListingId = partial.listingId as string
      const share = remainingShare(existingMappings.value, props.mappings, nextListingId, cur.mapping.unitId, index)
      mappingPatch = {
        ...partial,
        ownershipPercentage: share ?? 0,
      }
    }
  }
  const merged: OwnerMappingDraft = {
    mapping: { ...cur.mapping, ...mappingPatch },
    // Commission rule follows the listing so the editor stays in sync.
    commissionRule: partial.listingId !== undefined
      ? { ...cur.commissionRule, listingId: partial.listingId }
      : cur.commissionRule,
    operationalFeePercentage: cur.operationalFeePercentage,
  }
  next[index] = merged
  // Rebalance sibling rows in the same scope so the total stays at 100%.
  // Only when the ownership percentage itself was edited — switching the
  // listing already auto-fills the new scope.
  if (partial.ownershipPercentage !== undefined && partial.listingId === undefined) {
    const rebalanced = rebalanceSiblings(existingMappings.value, next, index, merged.mapping.ownershipPercentage)
    emit('update:mappings', rebalanced)
    return
  }
  emit('update:mappings', next)
}

function patchRule(index: number, rule: CommissionRuleDraft) {
  const next = [...props.mappings]
  const current = next[index]
  if (!current)
    return
  next[index] = {
    mapping: { ...current.mapping },
    commissionRule: rule,
    operationalFeePercentage: current.operationalFeePercentage,
  }
  emit('update:mappings', next)
}

function patchOperationalFee(index: number, percentage: number) {
  const next = [...props.mappings]
  const current = next[index]
  if (!current)
    return
  next[index] = {
    mapping: { ...current.mapping },
    commissionRule: current.commissionRule,
    operationalFeePercentage: percentage,
  }
  emit('update:mappings', next)
}

/**
 * Handle a selection from the shared property picker. The picker is
 * single-select here — it emits an array with the chosen listing name
 * (or an empty array when cleared).
 */
function selectListing(index: number, names: string[]) {
  const name = names[0]
  if (!name) {
    patchMapping(index, { listingId: '' })
    return
  }
  const listingId = listingIdByName.value.get(name)
  if (listingId)
    patchMapping(index, { listingId })
}

// Aggregate ownership per (listingId, unitId) scope across the local draft
// PLUS the ownership already stored by other owners on the same scope.
// Returns null when no scope exceeds 100%.
const cumulativeOverflow = computed<{ scope: string, total: number, existing: number, draft: number } | null>(() => {
  const draftTotals = new Map<string, number>()
  for (const m of props.mappings) {
    const key = `${m.mapping.listingId}::${m.mapping.unitId ?? ''}`
    draftTotals.set(key, (draftTotals.get(key) ?? 0) + (m.mapping.ownershipPercentage ?? 0))
  }
  for (const [key, draftTotal] of draftTotals) {
    const [listingId, unitId] = key.split('::') as [string, string]
    if (!listingId)
      continue
    const existingTotal = existingMappings.value
      .filter(m => m.listingId === listingId && (m.unitId ?? '') === unitId)
      .reduce((sum, m) => sum + m.ownershipPercentage, 0)
    const total = existingTotal + draftTotal
    if (total > 100) {
      const listingName = listingNameById(listingId) ?? listingId
      return {
        scope: unitId ? `listing ${listingName} unit ${unitId}` : `listing ${listingName}`,
        total,
        existing: existingTotal,
        draft: draftTotal,
      }
    }
  }
  return null
})
</script>

<template>
  <div class="space-y-4" data-testid="owner-onboarding-assignments">
    <div v-if="props.mappings.length === 0" class="rounded-md border border-dashed p-6 text-center">
      <p class="text-sm text-muted-foreground">
        No properties assigned yet. Add at least one mapping to continue.
      </p>
      <Button class="mt-3" @click="addMapping">
        <Icon name="lucide:plus" class="mr-1.5 size-4" />
        Add property
      </Button>
    </div>

    <template v-else>
      <div class="flex items-center justify-between">
        <h4 class="text-sm font-medium">
          Assigned properties
        </h4>
        <Button variant="outline" size="sm" @click="addMapping">
          <Icon name="lucide:plus" class="mr-1.5 size-3.5" />
          Add another
        </Button>
      </div>

      <Alert v-if="cumulativeOverflow" variant="destructive" data-testid="ownership-overflow">
        <Icon name="lucide:triangle-alert" class="size-4" />
        <AlertTitle>
          Ownership exceeds 100%
        </AlertTitle>
        <AlertDescription>
          {{ cumulativeOverflow.scope }} would total {{ cumulativeOverflow.total }}%
          ({{ cumulativeOverflow.existing }}% already held by existing owners
          + {{ cumulativeOverflow.draft }}% for this owner).
          Reduce one or more ownership percentages to continue.
        </AlertDescription>
      </Alert>

      <ScrollArea class="max-h-[420px] pr-3">
        <div class="space-y-4">
          <div
            v-for="(draft, index) in props.mappings"
            :key="index"
            class="rounded-md border p-4 space-y-4"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
                <div class="space-y-1.5">
                  <Label :for="`listing-${index}`">
                    Property
                  </Label>
                  <SharedPropertyPicker
                    :id="`listing-${index}`"
                    :model-value="draft.mapping.listingId ? [listingNameById(draft.mapping.listingId) ?? ''] : []"
                    :options="listingOptions"
                    :multi-select="false"
                    @update:model-value="(v) => selectListing(index, v)"
                  />
                </div>

                <div class="space-y-1.5">
                  <Label :for="`ownership-${index}`">
                    Ownership (%)
                  </Label>
                  <Input
                    :id="`ownership-${index}`"
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    :model-value="draft.mapping.ownershipPercentage.toString()"
                    @update:model-value="(v: string | number) => patchMapping(index, { ownershipPercentage: Number(v) })"
                  />
                </div>

                <div class="space-y-1.5">
                  <Label :for="`op-fee-${index}`">
                    Operational costs covered (%)
                  </Label>
                  <Input
                    :id="`op-fee-${index}`"
                    type="number"
                    min="0"
                    max="100"
                    step="5"
                    :model-value="draft.operationalFeePercentage.toString()"
                    @update:model-value="(v: string | number) => patchOperationalFee(index, Number(v))"
                  />
                  <p class="text-xs text-muted-foreground">
                    100% = owner covers all cleaning &amp; utilities
                  </p>
                </div>

                <div class="space-y-1.5 sm:col-span-2">
                  <Label :for="`effective-from-${index}`">
                    Effective from
                  </Label>
                  <Input
                    :id="`effective-from-${index}`"
                    type="date"
                    :model-value="draft.mapping.effectiveFrom"
                    @update:model-value="(v: string | number) => patchMapping(index, { effectiveFrom: String(v) })"
                  />
                </div>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                :aria-label="`Remove property ${index + 1}`"
                @click="removeMapping(index)"
              >
                <Icon name="lucide:trash-2" class="size-4" />
              </Button>
            </div>

            <Separator />

            <div>
              <p class="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Commission rule
              </p>
              <CommissionRuleEditor
                :draft="draft.commissionRule"
                @update:draft="(next) => patchRule(index, next)"
              />
            </div>
          </div>
        </div>
      </ScrollArea>

      <p v-if="errors.mappings" class="text-xs text-destructive">
        {{ errors.mappings }}
      </p>
    </template>
  </div>
</template>
