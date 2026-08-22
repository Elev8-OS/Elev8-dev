<!-- app/components/owners/OwnerOnboardingSelfBooking.vue -->
<!--
  Step 4 of the owner onboarding flow: self-booking settings —
  the annual owner-use night cap plus seasonal quota windows per
  property. Mirrors the "Self-booking" tab on the owner detail sheet
  so a new owner can be configured while being created.
-->
<script setup lang="ts">
import type { OwnerMappingDraft } from './OwnerOnboardingAssignments.vue'
import { listings } from '~/components/listings/data/listings'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Separator } from '~/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '~/components/ui/tooltip'

export interface OwnerQuotaWindowDraft {
  ownerId: string
  listingId: string
  startDate: string
  endDate: string
  maxNights: number
}

interface Props {
  mappings: OwnerMappingDraft[]
  /** Annual owner-use night cap; 0 / absent = no cap. */
  annualCap?: number
  windows: OwnerQuotaWindowDraft[]
  errors: Partial<Record<string, string>>
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:annualCap': [value: number | undefined]
  'update:windows': [value: OwnerQuotaWindowDraft[]]
}>()

const listingById = computed(() => new Map(listings.value.map(l => [l.id, l])))

/** The listings assigned in step 2 — quotas only make sense on these. */
const assignedListings = computed(() =>
  props.mappings
    .map(m => m.mapping.listingId)
    .filter((id): id is string => Boolean(id)),
)

function listingName(id: string): string {
  return listingById.value.get(id)?.name ?? id
}

function patchAnnualCap(value: number | undefined) {
  emit('update:annualCap', value && value > 0 ? value : undefined)
}

function addWindow() {
  const listingId = assignedListings.value[0]
  if (!listingId)
    return
  const window: OwnerQuotaWindowDraft = {
    ownerId: '',
    listingId,
    startDate: '',
    endDate: '',
    maxNights: 0,
  }
  emit('update:windows', [...props.windows, window])
}

function patchWindow(index: number, partial: Partial<OwnerQuotaWindowDraft>) {
  const next = [...props.windows]
  const current = next[index]
  if (!current)
    return
  next[index] = { ...current, ...partial }
  emit('update:windows', next)
}

function removeWindow(index: number) {
  const next = [...props.windows]
  next.splice(index, 1)
  emit('update:windows', next)
}
</script>

<template>
  <div class="space-y-4" data-testid="owner-onboarding-self-booking">
    <div class="rounded-md border p-4">
      <div class="space-y-1">
        <div class="flex items-center gap-1.5">
          <Label class="text-sm font-medium">Annual owner-use night cap</Label>
          <TooltipProvider :delay-duration="0">
            <Tooltip>
              <TooltipTrigger as-child>
                <Button type="button" variant="ghost" size="icon-sm" class="size-5">
                  <Icon name="lucide:info" class="size-3.5 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent class="max-w-64">
                The most nights this owner can reserve at their own properties in a calendar year. Set to 0 for no limit.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <p class="text-xs text-muted-foreground">
          The total free nights the owner can book across all their properties each year.
        </p>
      </div>
      <div class="mt-3 flex max-w-xs items-end gap-2">
        <div class="space-y-1">
          <Label for="onboard-annual-cap" class="text-xs">Nights / year</Label>
          <Input
            id="onboard-annual-cap"
            type="number"
            min="0"
            class="w-28"
            placeholder="No limit"
            :model-value="annualCap?.toString() ?? ''"
            @update:model-value="(v: string | number) => patchAnnualCap(Number(v))"
          />
        </div>
      </div>
      <p v-if="errors.annualCap" class="mt-1 text-xs text-destructive">
        {{ errors.annualCap }}
      </p>
    </div>

    <Separator class="my-1" />

    <div class="flex items-center justify-between">
      <div class="text-xs font-medium text-muted-foreground">
        Seasonal quotas per property
      </div>
      <Button
        size="sm"
        variant="outline"
        :disabled="assignedListings.length === 0"
        @click="addWindow"
      >
        <Icon name="lucide:plus" class="mr-1.5 size-3.5" />
        Add window
      </Button>
    </div>
    <p class="-mt-2 text-xs text-muted-foreground">
      Limit nights in peak season, or block the owner from certain dates (0 = blocked).
    </p>

    <div
      v-if="!assignedListings.length"
      class="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground"
    >
      Assign a property in step 2 to configure seasonal quotas.
    </div>

    <div v-else-if="windows.length === 0" class="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
      No quota windows yet. Add one to limit the owner's stays at specific times of year.
    </div>

    <div v-else class="space-y-2">
      <div
        v-for="(q, index) in windows"
        :key="index"
        class="rounded-md border p-3"
      >
        <div class="mb-2 flex items-center justify-between gap-2">
          <div class="text-sm font-medium">
            {{ listingName(q.listingId) }}
          </div>
          <Button variant="ghost" size="icon-sm" :aria-label="`Remove window ${index + 1}`" @click="removeWindow(index)">
            <Icon name="lucide:trash-2" class="size-3.5" />
          </Button>
        </div>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div class="space-y-1 sm:col-span-1">
            <Label class="text-xs">Listing</Label>
            <select
              class="h-9 w-full rounded-md border bg-transparent px-2 text-sm"
              :value="q.listingId"
              @change="patchWindow(index, { listingId: ($event.target as HTMLSelectElement).value })"
            >
              <option v-for="id in assignedListings" :key="id" :value="id">
                {{ listingName(id) }}
              </option>
            </select>
          </div>
          <div class="space-y-1">
            <Label class="text-xs">Start date</Label>
            <Input
              type="date"
              :model-value="q.startDate"
              @update:model-value="(v: string | number) => patchWindow(index, { startDate: String(v) })"
            />
          </div>
          <div class="space-y-1">
            <Label class="text-xs">End date</Label>
            <Input
              type="date"
              :model-value="q.endDate"
              @update:model-value="(v: string | number) => patchWindow(index, { endDate: String(v) })"
            />
          </div>
          <div class="space-y-1">
            <Label class="text-xs">Max nights (0 = blocked)</Label>
            <Input
              type="number"
              min="0"
              :model-value="q.maxNights.toString()"
              @update:model-value="(v: string | number) => patchWindow(index, { maxNights: Number(v) })"
            />
          </div>
        </div>
      </div>
    </div>
    <p v-if="errors.windows" class="text-xs text-destructive">
      {{ errors.windows }}
    </p>
  </div>
</template>
