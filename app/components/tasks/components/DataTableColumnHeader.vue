<script setup lang="ts">
import type { Column } from '@tanstack/vue-table'
import type { Task } from '../data/schema'
import { cn } from '@/lib/utils'

interface DataTableColumnHeaderProps {
  column: Column<Task, any>
  title: string
}

const props = defineProps<DataTableColumnHeaderProps>()

/** Same cycle as the Reservations table: ascending, descending, then back to the default order. */
function toggleSort() {
  const sorted = props.column.getIsSorted()
  if (!sorted)
    props.column.toggleSorting(false)
  else if (sorted === 'asc')
    props.column.toggleSorting(true)
  else
    props.column.clearSorting()
}
</script>

<script lang="ts">
export default {
  inheritAttrs: false,
}
</script>

<template>
  <button
    v-if="column.getCanSort()"
    type="button"
    :class="cn('inline-flex items-center gap-1 font-medium uppercase hover:text-foreground', column.getIsSorted() ? 'text-foreground' : '', $attrs.class ?? '')"
    @click="toggleSort"
  >
    {{ title }}
    <Icon
      v-if="column.getIsSorted()"
      :name="column.getIsSorted() === 'asc' ? 'lucide:chevron-up' : 'lucide:chevron-down'"
      class="size-3.5"
    />
  </button>

  <div v-else :class="$attrs.class">
    {{ title }}
  </div>
</template>
