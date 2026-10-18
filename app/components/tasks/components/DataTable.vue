<script setup lang="ts">
import type {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
} from '@tanstack/vue-table'

import type { Task } from '../data/schema'
import {
  FlexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useVueTable,
} from '@tanstack/vue-table'
import { toast } from 'vue-sonner'
import { selectedTaskRef } from '@/composables/useTaskDetail'
import { useTaskStore } from '@/composables/useTaskStore'
import { downloadTasksXlsx } from '@/lib/task-export'
import { valueUpdater } from '@/lib/utils'
import DataTablePagination from './DataTablePagination.vue'
import DataTableToolbar from './DataTableToolbar.vue'

interface DataTableProps {
  columns: ColumnDef<Task, any>[]
  data: Task[]
}
const props = defineProps<DataTableProps>()
defineEmits<{ toggleFilters: [] }>()

/** Owned by the page: the filter side panel edits the same state the table reads. */
const columnFilters = defineModel<ColumnFiltersState>('columnFilters', { default: () => [] })

const panelFilterCount = computed(() => columnFilters.value.filter(f => f.id !== 'title').length)

/** A click on a control inside the row (checkbox, menu, title button) keeps its own action. */
function openRow(event: MouseEvent, task: Task) {
  if ((event.target as HTMLElement).closest('button, a, input, [role="checkbox"], [role="menuitem"]'))
    return
  selectedTaskRef.value = task
}

/** Every column's name in the column menu, in sentence case. */
const COLUMN_LABELS: Record<string, string> = {
  status: 'Status',
  title: 'Title',
  assignee: 'Assignee',
  listing: 'Listing',
  inventoryLink: 'Inventory item',
  dueDate: 'Due date',
  createdAt: 'Created at',
  completedAt: 'Completed at',
  priority: 'Priority',
  ownerVisible: 'Owner maintenance',
}

const sorting = ref<SortingState>([])
const columnVisibility = ref<VisibilityState>({ scheduled: false, listingTags: false, createdAt: false, completedAt: false })
const rowSelection = ref({})

const table = useVueTable({
  get data() { return props.data },
  get columns() { return props.columns },
  state: {
    get sorting() { return sorting.value },
    get columnFilters() { return columnFilters.value },
    get columnVisibility() { return columnVisibility.value },
    get rowSelection() { return rowSelection.value },
  },
  // Keyed by task id: an index key would select the wrong rows once a task is deleted.
  getRowId: row => row.id,
  enableRowSelection: true,
  onSortingChange: updaterOrValue => valueUpdater(updaterOrValue, sorting),
  onColumnFiltersChange: updaterOrValue => valueUpdater(updaterOrValue, columnFilters),
  onColumnVisibilityChange: updaterOrValue => valueUpdater(updaterOrValue, columnVisibility),
  onRowSelectionChange: updaterOrValue => valueUpdater(updaterOrValue, rowSelection),
  getCoreRowModel: getCoreRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  getPaginationRowModel: getPaginationRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getFacetedRowModel: getFacetedRowModel(),
  getFacetedUniqueValues: getFacetedUniqueValues(),
})

const toggleableColumns = computed(() =>
  table.getAllColumns().filter(column => typeof column.accessorFn !== 'undefined' && column.getCanHide()),
)

const { deleteTask } = useTaskStore()
const selectedRows = computed(() => table.getFilteredSelectedRowModel().rows)
const confirmBulkDeleteOpen = ref(false)

function deleteSelected() {
  const ids = selectedRows.value.map(r => r.original.id)
  ids.forEach(deleteTask)
  rowSelection.value = {}
  toast.success(`${ids.length} ${ids.length === 1 ? 'task' : 'tasks'} deleted`)
}

/**
 * Exports the ticked rows, or every row the filters, search and sorting show
 * (not only this page). The button lives in the page header, so the page calls this.
 */
const exporting = ref(false)

async function exportTasks() {
  const selected = table.getFilteredSelectedRowModel().rows
  const rows = (selected.length ? selected : table.getSortedRowModel().rows).map(r => r.original)
  if (!rows.length) {
    toast.info('No tasks to export with the current filters.')
    return
  }
  exporting.value = true
  try {
    await downloadTasksXlsx(rows)
    toast.success(`${rows.length} ${rows.length === 1 ? 'task' : 'tasks'} exported to Excel.`)
  }
  catch {
    toast.error('Could not create the Excel file. Please try again.')
  }
  finally {
    exporting.value = false
  }
}

defineExpose({ exportTasks, exporting })
</script>

<template>
  <div class="space-y-4">
    <DataTableToolbar :table="table" :filter-count="panelFilterCount" @toggle-filters="$emit('toggleFilters')" />
    <div
      v-if="selectedRows.length"
      class="flex min-h-10 flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-3 py-1.5"
      data-testid="tasks-bulk-bar"
    >
      <span class="flex-1 text-sm text-muted-foreground">
        {{ selectedRows.length }} {{ selectedRows.length === 1 ? 'task' : 'tasks' }} selected
      </span>
      <Button variant="outline" size="sm" class="h-8 gap-1.5 text-destructive hover:text-destructive" data-testid="tasks-bulk-delete" @click="confirmBulkDeleteOpen = true">
        <Icon name="lucide:trash-2" class="size-3.5" />
        Delete
      </Button>
      <Button variant="ghost" size="sm" class="h-8" data-testid="tasks-bulk-clear" @click="rowSelection = {}">
        Clear
      </Button>
    </div>

    <AlertDialog v-model:open="confirmBulkDeleteOpen">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {{ selectedRows.length }} {{ selectedRows.length === 1 ? 'task' : 'tasks' }}?</AlertDialogTitle>
          <AlertDialogDescription>
            The selected tasks will be removed. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction class="bg-destructive text-white hover:bg-destructive/90" @click="deleteSelected">
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <div class="border rounded-md">
      <Table>
        <TableHeader class="bg-muted/50">
          <TableRow v-for="headerGroup in table.getHeaderGroups()" :key="headerGroup.id">
            <TableHead v-for="header in headerGroup.headers" :key="header.id" class="px-4 text-xs font-medium uppercase text-muted-foreground">
              <!-- Column toggles sit in the table header, like the Listings page. -->
              <DropdownMenu v-if="header.column.id === 'actions'">
                <DropdownMenuTrigger as-child>
                  <Button variant="ghost" size="sm" class="size-8 p-0" aria-label="Show or hide columns">
                    <Icon name="lucide:sliders-horizontal" class="size-4 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" class="w-56">
                  <DropdownMenuLabel>Show columns</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    v-for="column in toggleableColumns"
                    :key="column.id"
                    class="flex items-center gap-2"
                    @select.prevent
                    @click="column.toggleVisibility()"
                  >
                    <Icon v-if="column.getIsVisible()" name="lucide:check" class="size-4" />
                    <span v-else class="size-4" />
                    {{ COLUMN_LABELS[column.id] ?? column.id }}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <FlexRender v-else-if="!header.isPlaceholder" :render="header.column.columnDef.header" :props="header.getContext()" />
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <template v-if="table.getRowModel().rows?.length">
            <TableRow
              v-for="row in table.getRowModel().rows"
              :key="row.id"
              :data-state="row.getIsSelected() && 'selected'"
              class="cursor-pointer"
              @click="openRow($event, row.original)"
            >
              <TableCell v-for="cell in row.getVisibleCells()" :key="cell.id" class="px-4">
                <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
              </TableCell>
            </TableRow>
          </template>

          <TableRow v-else>
            <TableCell
              :colspan="table.getVisibleLeafColumns().length"
              class="h-24 text-center"
            >
              No results.
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <DataTablePagination :table="table" />
  </div>
</template>
