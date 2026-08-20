<script setup lang="ts">
import type { Table } from '@tanstack/vue-table'
import type { Task } from '../data/schema'
import { computed } from 'vue'
import { BALI_LISTINGS } from '@/components/upsells/data/upsell-services'
import { priorities, statuses } from '../data/data'
import { shortListingName } from './columns'
import DataTableFacetedFilter from './DataTableFacetedFilter.vue'
import DataTableViewOptions from './DataTableViewOptions.vue'

interface DataTableToolbarProps {
  table: Table<Task>
}

const props = defineProps<DataTableToolbarProps>()

const isFiltered = computed(() => props.table.getState().columnFilters.length > 0)

const listingOptions = BALI_LISTINGS.map(l => ({ value: l, label: shortListingName(l) }))
</script>

<template>
  <div class="flex items-center justify-between">
    <div class="flex flex-1 flex-wrap items-center gap-2">
      <Input
        placeholder="Filter tasks..."
        :model-value="(table.getColumn('title')?.getFilterValue() as string) ?? ''"
        class="h-8 w-[150px] lg:w-[250px]"
        @input="table.getColumn('title')?.setFilterValue(($event.target as HTMLInputElement).value)"
      />
      <DataTableFacetedFilter
        v-if="table.getColumn('listing')"
        :column="table.getColumn('listing')"
        title="Listing"
        :options="listingOptions"
      />
      <DataTableFacetedFilter
        v-if="table.getColumn('status')"
        :column="table.getColumn('status')"
        title="Status"
        :options="statuses"
      />
      <DataTableFacetedFilter
        v-if="table.getColumn('priority')"
        :column="table.getColumn('priority')"
        title="Priority"
        :options="priorities"
      />
      <DataTableFacetedFilter
        v-if="table.getColumn('ownerVisible')"
        :column="table.getColumn('ownerVisible')"
        title="Owner"
        :options="[{ value: 'true', label: 'Owner maintenance' }]"
      />
      <Button
        v-if="isFiltered"
        variant="ghost"
        class="h-8 px-2 lg:px-3"
        @click="table.resetColumnFilters()"
      >
        Reset
        <Icon name="i-radix-icons-cross-2" class="ml-2 h-4 w-4" />
      </Button>
    </div>
    <DataTableViewOptions :table="table" />
  </div>
</template>
