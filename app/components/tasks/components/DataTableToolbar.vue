<script setup lang="ts">
import type { Table } from '@tanstack/vue-table'
import type { Task } from '../data/schema'
import { computed } from 'vue'
import BaseSearchInput from '@/components/base/SearchInput.vue'

interface DataTableToolbarProps {
  table: Table<Task>
  /** Filters set in the side panel, for the badge on the Filters button. */
  filterCount: number
}

const props = defineProps<DataTableToolbarProps>()
const emit = defineEmits<{ toggleFilters: [] }>()

const search = computed({
  get: () => (props.table.getColumn('title')?.getFilterValue() as string) ?? '',
  set: v => props.table.getColumn('title')?.setFilterValue(v || undefined),
})
</script>

<template>
  <div class="flex flex-wrap items-center justify-between gap-2">
    <BaseSearchInput v-model="search" placeholder="Search tasks..." />
    <div class="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        class="h-9 shrink-0 gap-1.5"
        :class="filterCount ? 'border-primary' : ''"
        data-testid="tasks-filters-toggle"
        @click="emit('toggleFilters')"
      >
        <Icon name="lucide:sliders-horizontal" class="size-4" />
        Filters
        <Badge v-if="filterCount" variant="default" class="h-4 min-w-4 rounded-full px-1 text-[9px]">
          {{ filterCount }}
        </Badge>
      </Button>
    </div>
  </div>
</template>
