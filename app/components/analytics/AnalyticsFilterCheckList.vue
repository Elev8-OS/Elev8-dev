<script setup lang="ts">
import type { FilterOption } from '~/composables/useAnalytics'

// Inline checkbox list for the filter sidebar: custom checkbox rows (never a
// reka Checkbox inside a label), with a search box once the list is long.
const props = defineProps<{
  options: FilterOption[]
  selected: string[]
  /** Used for the search placeholder and the test ids. */
  name: string
}>()

const emit = defineEmits<{ toggle: [value: string] }>()

const SEARCH_FROM = 7

const search = ref('')
const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q)
    return props.options
  return props.options.filter(o => o.label.toLowerCase().includes(q) || o.hint?.toLowerCase().includes(q))
})
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <Input
      v-if="options.length >= SEARCH_FROM"
      v-model="search"
      :placeholder="`Search ${name.toLowerCase()}...`"
      class="h-8 text-xs"
    />
    <div class="flex flex-col gap-0.5" :class="options.length >= SEARCH_FROM ? 'max-h-52 overflow-y-auto pr-1' : ''">
      <div
        v-for="option in filtered"
        :key="option.value"
        class="flex cursor-pointer items-center gap-2 rounded-sm px-1.5 py-1 text-sm hover:bg-accent"
        :data-testid="`analytics-filter-${name.toLowerCase().replace(/\s+/g, '-')}-option`"
        @click="emit('toggle', option.value)"
      >
        <div
          class="flex size-4 shrink-0 items-center justify-center rounded-[4px] border"
          :class="selected.includes(option.value) ? 'border-primary bg-primary text-primary-foreground' : 'border-input'"
        >
          <Icon v-if="selected.includes(option.value)" name="lucide:check" class="size-3" />
        </div>
        <Icon v-if="option.icon" :name="option.icon" class="size-3.5 shrink-0 text-muted-foreground" />
        <div class="flex min-w-0 flex-1 flex-col">
          <span class="truncate">{{ option.label }}</span>
          <span v-if="option.hint" class="truncate text-[11px] text-muted-foreground">{{ option.hint }}</span>
        </div>
      </div>
      <p v-if="filtered.length === 0" class="px-1.5 py-1 text-xs text-muted-foreground">
        No matches.
      </p>
    </div>
  </div>
</template>
