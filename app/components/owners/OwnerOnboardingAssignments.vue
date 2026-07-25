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
import { listings } from '~/components/listings/data/listings'
import { Alert, AlertDescription, AlertTitle } from '~/components/ui/alert'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { ScrollArea } from '~/components/ui/scroll-area'
import { Separator } from '~/components/ui/separator'
import CommissionRuleEditor from './CommissionRuleEditor.vue'

export interface OwnerMappingDraft {
  mapping: Omit<OwnerPropertyMapping, 'id' | 'ownerId' | 'commissionRuleId'>
  commissionRule: CommissionRuleDraft
}

interface Props {
  mappings: OwnerMappingDraft[]
  errors: Partial<Record<string, string>>
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:mappings': [value: OwnerMappingDraft[]]
}>()

// Cached `listings.value` array — used to populate the listing selector.
const listingOptions = computed(() =>
  listings.value.map(l => ({ id: l.id, name: l.name, location: l.location })),
)

function makeDefaultRule(listingId: string): CommissionRuleDraft {
  return {
    type: 'flat',
    rate: 20,
    listingId,
    name: 'Standard 20% management',
    effectiveFrom: new Date().toISOString().slice(0, 10),
  }
}

function addMapping() {
  const firstListing = listingOptions.value[0]?.id ?? ''
  if (!firstListing)
    return
  emit('update:mappings', [
    ...props.mappings,
    {
      mapping: {
        listingId: firstListing,
        ownershipPercentage: 100,
        effectiveFrom: new Date().toISOString().slice(0, 10),
      },
      commissionRule: makeDefaultRule(firstListing),
    },
  ])
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
  const merged: OwnerMappingDraft = {
    mapping: { ...cur.mapping, ...partial },
    // Commission rule follows the listing so the editor stays in sync.
    commissionRule: partial.listingId !== undefined
      ? { ...cur.commissionRule, listingId: partial.listingId }
      : cur.commissionRule,
  }
  next[index] = merged
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
  }
  emit('update:mappings', next)
}

// Aggregate ownership per (listingId, unitId) scope across the local draft.
// Returns null when no scope exceeds 100%.
const cumulativeOverflow = computed<{ scope: string, total: number } | null>(() => {
  const totals = new Map<string, number>()
  for (const m of props.mappings) {
    const key = `${m.mapping.listingId}::${m.mapping.unitId ?? ''}`
    totals.set(key, (totals.get(key) ?? 0) + (m.mapping.ownershipPercentage ?? 0))
  }
  for (const [key, total] of totals) {
    if (total > 100) {
      const [listingId, unitId] = key.split('::')
      return {
        scope: unitId ? `listing ${listingId} unit ${unitId}` : `listing ${listingId}`,
        total,
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
          {{ cumulativeOverflow.scope }} would total {{ cumulativeOverflow.total }}% across the
          current draft. Reduce one or more ownership percentages to continue.
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
                  <select
                    :id="`listing-${index}`"
                    class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    :value="draft.mapping.listingId"
                    @change="patchMapping(index, { listingId: ($event.target as HTMLSelectElement).value })"
                  >
                    <option v-for="opt in listingOptions" :key="opt.id" :value="opt.id">
                      {{ opt.name }} — {{ opt.location }}
                    </option>
                  </select>
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
