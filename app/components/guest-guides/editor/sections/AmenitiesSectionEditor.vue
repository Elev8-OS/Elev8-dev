<script setup lang="ts">
import type { Ref } from 'vue'
import { Icon } from '#components'
import { computed, inject, ref } from 'vue'
import { listings } from '~/components/listings/data/listings'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'

const props = defineProps<{ modelValue: Record<string, any> }>()
const emit = defineEmits<{ 'update:modelValue': [v: Record<string, any>] }>()

function update(patch: Record<string, any>) {
  emit('update:modelValue', { ...props.modelValue, ...patch })
}

const items = computed({
  get: () => (props.modelValue.items ?? []) as string[],
  set: (v: string[]) => update({ items: v }),
})

const newItem = ref('')

function add() {
  const trimmed = newItem.value.trim()
  if (!trimmed)
    return
  items.value = [...items.value, trimmed]
  newItem.value = ''
}

function remove(idx: number) {
  items.value = items.value.filter((_, i) => i !== idx)
}

const assignedListingIds = inject<Ref<string[]>>('assignedListingIds', ref([]))

const assignedListings = computed(() =>
  listings.value.filter(l => assignedListingIds.value.includes(l.id)),
)

const singleListing = computed(() =>
  assignedListings.value.length === 1 ? assignedListings.value[0] : null,
)

const defaultAmenities = computed<string[]>(() => singleListing.value?.amenities ?? [])
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
      v-else-if="assignedListings.length === 1 && defaultAmenities.length > 0"
      class="space-y-1 rounded-md bg-muted/50 p-2 text-xs text-muted-foreground"
    >
      <div>
        Default from listing "<strong>{{ singleListing?.name }}</strong>" — override below if needed.
      </div>
      <div class="text-foreground">
        {{ defaultAmenities.length }} amenit{{ defaultAmenities.length === 1 ? 'y' : 'ies' }}: {{ defaultAmenities.join(' · ') }}
      </div>
    </div>
    <div
      v-else-if="assignedListings.length > 1"
      class="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground"
    >
      Defaults vary across {{ assignedListings.length }} listings. Use per-listing overrides (coming soon).
    </div>

    <div class="flex gap-2">
      <Input
        v-model="newItem"
        placeholder="e.g. Pool, WiFi, Air conditioning"
        @keyup.enter="add"
      />
      <Button variant="outline" size="sm" @click="add">
        Add
      </Button>
    </div>

    <div v-if="items.length > 0" class="flex flex-wrap gap-2">
      <div
        v-for="(item, idx) in items"
        :key="idx"
        class="inline-flex items-center gap-1 rounded-full border bg-muted px-3 py-1 text-sm"
      >
        <span>{{ item }}</span>
        <button
          type="button"
          class="text-muted-foreground hover:text-destructive"
          @click="remove(idx)"
        >
          <Icon name="lucide:x" class="size-3" />
        </button>
      </div>
    </div>
    <p v-else class="text-xs text-muted-foreground">
      No amenities yet. Add the first one above.
    </p>
  </div>
</template>
