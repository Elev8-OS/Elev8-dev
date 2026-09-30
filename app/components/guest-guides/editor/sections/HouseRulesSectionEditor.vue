<script setup lang="ts">
import { inject, computed, type Ref } from 'vue'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Textarea } from '~/components/ui/textarea'
import { Icon } from '#components'
import type { HouseRule } from '~/components/guest-guides/data/house-rules'
import { normalizeHouseRules } from '~/components/guest-guides/data/house-rules'
import { listings } from '~/components/listings/data/listings'

const props = defineProps<{ modelValue: Record<string, any> }>()
const emit = defineEmits<{ 'update:modelValue': [v: Record<string, any>] }>()

function update(patch: Record<string, any>) {
  emit('update:modelValue', { ...props.modelValue, ...patch })
}

// Rows keep blank entries while the host is typing; older one-line rules
// read as a title with no description.
const rules = computed<HouseRule[]>(() =>
  ((props.modelValue.rules ?? []) as unknown[]).map(entry =>
    typeof entry === 'string' ? { title: entry } : { title: '', ...(entry as HouseRule) },
  ),
)

function add() {
  update({ rules: [...rules.value, { title: '', description: '' }] })
}

function remove(idx: number) {
  update({ rules: rules.value.filter((_, i) => i !== idx) })
}

function editRule(idx: number, patch: Partial<HouseRule>) {
  update({ rules: rules.value.map((r, i) => i === idx ? { ...r, ...patch } : r) })
}

const assignedListingIds = inject<Ref<string[]>>('assignedListingIds', ref([]))

const assignedListings = computed(() =>
  listings.value.filter(l => assignedListingIds.value.includes(l.id)),
)

const singleListing = computed(() =>
  assignedListings.value.length === 1 ? assignedListings.value[0] : null,
)

const defaultRules = computed<string[]>(() =>
  normalizeHouseRules(singleListing.value?.resources?.basics?.houseRules?.split('\n')).map(r => r.title),
)
</script>

<template>
  <div class="space-y-3">
    <div
      v-if="assignedListings.length === 0"
      class="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground"
    >
      Assign this guide to a listing first to see default values.
    </div>
    <div
      v-else-if="assignedListings.length === 1 && defaultRules.length > 0"
      class="space-y-1 rounded-md bg-muted/50 p-2 text-xs text-muted-foreground"
    >
      <div>
        Default from listing "<strong>{{ singleListing?.name }}</strong>" — override below if needed.
      </div>
      <div class="text-foreground">
        {{ defaultRules.length }} rule{{ defaultRules.length === 1 ? '' : 's' }}: {{ defaultRules.join(' · ') }}
      </div>
    </div>
    <div
      v-else-if="assignedListings.length > 1"
      class="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground"
    >
      Defaults vary across {{ assignedListings.length }} listings. Use per-listing overrides (coming soon).
    </div>

    <div class="space-y-2">
      <div v-for="(rule, idx) in rules" :key="idx" class="flex gap-2 rounded-md border p-2" data-testid="house-rule-row">
        <div class="min-w-0 flex-1 space-y-2">
          <Input
            :model-value="rule.title"
            placeholder="Title, e.g. No Smoking"
            aria-label="Rule title"
            @update:model-value="(v) => editRule(idx, { title: String(v) })"
          />
          <Textarea
            :model-value="rule.description ?? ''"
            rows="2"
            placeholder="Description, e.g. Smoking is not allowed anywhere inside the villa."
            aria-label="Rule description"
            @update:model-value="(v) => editRule(idx, { description: String(v) })"
          />
        </div>
        <Button variant="ghost" size="sm" aria-label="Remove rule" @click="remove(idx)">
          <Icon name="lucide:trash-2" class="size-4" />
        </Button>
      </div>
      <Button variant="outline" size="sm" @click="add">
        + Add rule
      </Button>
    </div>
  </div>
</template>
