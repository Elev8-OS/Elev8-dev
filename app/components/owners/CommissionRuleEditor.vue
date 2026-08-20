<!-- app/components/owners/CommissionRuleEditor.vue -->
<!--
  Editor for a single CommissionRule draft. Emits a *copy* of the draft on
  every change so the parent can store the latest version without us
  aliasing its state.

  Supports all three commission rule shapes from data/commission-rules:
    - flat:    one rate%
    - tiered:  progressive bands (rate% per band, upTo null = open top)
    - hybrid:  fixed amount + rate%
-->
<script setup lang="ts">
import type { CommissionRuleDraft, CommissionTier } from '~/components/owners/data/commission-rules'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'

interface Props {
  draft: CommissionRuleDraft
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:draft': [value: CommissionRuleDraft]
}>()

function patch(partial: Partial<CommissionRuleDraft>) {
  // Spread to break aliasing — the parent must never see in-place mutation.
  emit('update:draft', { ...props.draft, ...partial } as CommissionRuleDraft)
}

function setType(type: 'flat' | 'tiered' | 'hybrid') {
  if (type === 'flat') {
    emit('update:draft', {
      ...props.draft,
      type: 'flat',
      rate: (props.draft as { rate?: number }).rate ?? 20,
    } as CommissionRuleDraft)
  }
  else if (type === 'hybrid') {
    const flat = (props.draft as { rate?: number }).rate ?? 15
    const fixedAmount = (props.draft as { fixedAmount?: number }).fixedAmount ?? 0
    emit('update:draft', {
      ...props.draft,
      type: 'hybrid',
      rate: flat,
      fixedAmount,
    } as CommissionRuleDraft)
  }
  else {
    emit('update:draft', {
      ...props.draft,
      type: 'tiered',
      tiers: (props.draft as { tiers?: CommissionTier[] }).tiers ?? [
        { upTo: 50_000_000, rate: 18 },
        { upTo: null, rate: 22 },
      ],
    } as CommissionRuleDraft)
  }
}

function updateTier(index: number, partial: Partial<CommissionTier>) {
  const tiers = [...((props.draft as { tiers?: CommissionTier[] }).tiers ?? [])]
  const current = tiers[index]
  if (!current)
    return
  tiers[index] = { ...current, ...partial }
  emit('update:draft', { ...props.draft, type: 'tiered', tiers } as CommissionRuleDraft)
}

function addTier() {
  const tiers = [...((props.draft as { tiers?: CommissionTier[] }).tiers ?? [])]
  tiers.push({ upTo: null, rate: 20 })
  emit('update:draft', { ...props.draft, type: 'tiered', tiers } as CommissionRuleDraft)
}

function removeTier(index: number) {
  const tiers = [...((props.draft as { tiers?: CommissionTier[] }).tiers ?? [])]
  tiers.splice(index, 1)
  emit('update:draft', { ...props.draft, type: 'tiered', tiers } as CommissionRuleDraft)
}
</script>

<template>
  <div class="space-y-3" data-testid="commission-rule-editor">
    <div class="space-y-1.5">
      <Label for="commission-name">
        Rule name
      </Label>
      <Input
        id="commission-name"
        :model-value="draft.name"
        placeholder="e.g. Standard 20% management"
        @update:model-value="(v: string | number) => patch({ name: String(v) })"
      />
    </div>

    <div class="space-y-1.5">
      <Label>
        Commission type
      </Label>
      <div class="inline-flex rounded-md border p-0.5">
        <button
          type="button"
          class="rounded px-3 py-1 text-xs font-medium transition-colors"
          :class="draft.type === 'flat' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'"
          @click="setType('flat')"
        >
          Flat
        </button>
        <button
          type="button"
          class="rounded px-3 py-1 text-xs font-medium transition-colors"
          :class="draft.type === 'tiered' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'"
          @click="setType('tiered')"
        >
          Tiered
        </button>
        <button
          type="button"
          class="rounded px-3 py-1 text-xs font-medium transition-colors"
          :class="draft.type === 'hybrid' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'"
          @click="setType('hybrid')"
        >
          Hybrid
        </button>
      </div>
    </div>

    <div class="space-y-1.5">
      <Label>
        Commission basis
      </Label>
      <div class="inline-flex rounded-md border p-0.5">
        <button
          type="button"
          class="rounded px-3 py-1 text-xs font-medium transition-colors"
          :class="(draft.basis ?? 'gross') === 'gross' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'"
          @click="patch({ basis: 'gross' } as Partial<CommissionRuleDraft>)"
        >
          % of Gross
        </button>
        <button
          type="button"
          class="rounded px-3 py-1 text-xs font-medium transition-colors"
          :class="(draft.basis ?? 'gross') === 'net' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'"
          @click="patch({ basis: 'net' } as Partial<CommissionRuleDraft>)"
        >
          Fixed + % of Net
        </button>
      </div>
      <p class="text-xs text-muted-foreground">
        Net = gross revenue after operating expenses, taxes, and platform fees.
      </p>
    </div>

    <!-- Flat -->
    <div v-if="draft.type === 'flat'" class="space-y-1.5">
      <Label for="commission-rate">
        Rate (%)
      </Label>
      <Input
        id="commission-rate"
        type="number"
        min="0"
        max="100"
        step="0.5"
        :model-value="draft.rate.toString()"
        @update:model-value="(v: string | number) => patch({ rate: Number(v) } as Partial<CommissionRuleDraft>)"
      />
      <p class="text-xs text-muted-foreground">
        {{ draft.rate }}% of {{ (draft.basis ?? 'gross') === 'net' ? 'net revenue' : 'gross revenue' }}.
      </p>
    </div>

    <!-- Tiered -->
    <div v-else-if="draft.type === 'tiered'" class="space-y-2">
      <Label>Tiers</Label>
      <div class="space-y-2">
        <div
          v-for="(tier, index) in draft.tiers"
          :key="index"
          class="grid grid-cols-[1fr_1fr_auto] items-end gap-2"
        >
          <div class="space-y-1">
            <Label :for="`tier-upto-${index}`" class="text-xs">
              Up to (blank = open)
            </Label>
            <Input
              :id="`tier-upto-${index}`"
              type="number"
              min="0"
              :model-value="tier.upTo === null ? '' : tier.upTo.toString()"
              @update:model-value="(v: string | number) => updateTier(index, { upTo: v === '' ? null : Number(v) })"
            />
          </div>
          <div class="space-y-1">
            <Label :for="`tier-rate-${index}`" class="text-xs">
              Rate (%)
            </Label>
            <Input
              :id="`tier-rate-${index}`"
              type="number"
              min="0"
              max="100"
              step="0.5"
              :model-value="tier.rate.toString()"
              @update:model-value="(v: string | number) => updateTier(index, { rate: Number(v) })"
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            :aria-label="`Remove tier ${index + 1}`"
            @click="removeTier(index)"
          >
            <Icon name="lucide:trash-2" class="size-4" />
          </Button>
        </div>
        <Button type="button" variant="outline" size="sm" @click="addTier">
          <Icon name="lucide:plus" class="mr-1.5 size-3.5" />
          Add tier
        </Button>
      </div>
    </div>

    <!-- Hybrid -->
    <div v-else class="grid grid-cols-2 gap-2">
      <div class="space-y-1.5">
        <Label for="commission-fixed">
          Fixed amount
        </Label>
        <Input
          id="commission-fixed"
          type="number"
          min="0"
          step="0.01"
          :model-value="draft.fixedAmount.toString()"
          @update:model-value="(v: string | number) => patch({ fixedAmount: Number(v) } as Partial<CommissionRuleDraft>)"
        />
      </div>
      <div class="space-y-1.5">
        <Label for="commission-rate-hybrid">
          Rate (%)
        </Label>
        <Input
          id="commission-rate-hybrid"
          type="number"
          min="0"
          max="100"
          step="0.5"
          :model-value="draft.rate.toString()"
          @update:model-value="(v: string | number) => patch({ rate: Number(v) } as Partial<CommissionRuleDraft>)"
        />
      </div>
    </div>
  </div>
</template>
