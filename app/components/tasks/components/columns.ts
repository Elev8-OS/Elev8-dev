import type { ColumnDef } from '@tanstack/vue-table'
import type { Task } from '../data/schema'
import { Icon } from '#components'
import { h } from 'vue'
import { toLocalDateKey } from '@/components/activities/data/activities'
import { listings } from '@/components/listings/data/listings'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { selectedTaskRef } from '~/composables/useTaskDetail'
import { assigneeOptions, priorities, statuses } from '../data/data'
import { taskCompletedAt } from '../data/timeline'
import DataTableColumnHeader from './DataTableColumnHeader.vue'
import DataTableRowActions from './DataTableRowActions.vue'

export function shortListingName(name: string): string {
  if (!name)
    return '—'
  if (name.startsWith('BRATAN'))
    return 'BRATAN'
  if (name.startsWith('TAMBORA'))
    return 'TAMBORA'
  return name.replace('The R Villa ', 'Villa ')
}

const createdAtFormat = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
const dueDateFormat = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' })

/** Parses the local `YYYY-MM-DD` by hand: `new Date('YYYY-MM-DD')` is UTC and can show the day before. */
function formatDueDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return y && m && d ? dueDateFormat.format(new Date(y, m - 1, d)) : date
}

function getAssigneeLabel(value: string | undefined): { label: string, type?: 'role' | 'person' } | null {
  if (!value)
    return null
  const opt = assigneeOptions.find(a => a.value === value)
  if (opt)
    return { label: opt.label, type: opt.type }
  return { label: value }
}

export const columns: ColumnDef<Task>[] = [
  {
    id: 'select',
    header: ({ table }) => h(Checkbox, {
      'modelValue': table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && 'indeterminate'),
      'onUpdate:modelValue': value => table.toggleAllPageRowsSelected(!!value),
      'ariaLabel': 'Select all',
      'class': 'translate-y-0.5',
    }),
    cell: ({ row }) => h(Checkbox, {
      'modelValue': row.getIsSelected(),
      'onUpdate:modelValue': value => row.toggleSelected(!!value),
      'ariaLabel': 'Select row',
      'class': 'translate-y-0.5',
    }),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: 'status',
    header: ({ column }) => h(DataTableColumnHeader, { column, title: 'Status' }),
    cell: ({ row }) => {
      const status = statuses.find(s => s.value === row.getValue('status'))
      if (!status)
        return null
      return h('div', { class: 'flex items-center' }, [
        status.icon && h(status.icon, { class: 'mr-1.5 h-4 w-4' }),
        h('span', { class: 'text-sm' }, status.label),
      ])
    },
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
  },
  {
    accessorKey: 'title',
    header: ({ column }) => h(DataTableColumnHeader, { column, title: 'Title' }),
    cell: ({ row }) => {
      const task = row.original
      return h('button', {
        class: 'flex items-center gap-2 text-left hover:underline underline-offset-2',
        onClick: () => { selectedTaskRef.value = task },
      }, [
        h('span', { class: 'max-w-[300px] truncate font-medium' }, row.getValue('title')),
        task.scheduleId
          ? h('span', { class: 'shrink-0 text-muted-foreground', title: 'Made by a schedule' }, [
              h(Icon, { 'name': 'lucide:repeat', 'class': 'size-3.5', 'aria-hidden': 'true' }),
              h('span', { class: 'sr-only' }, 'Scheduled'),
            ])
          : null,
      ])
    },
  },
  {
    accessorKey: 'assignee',
    header: ({ column }) => h(DataTableColumnHeader, { column, title: 'Assignee' }),
    cell: ({ row }) => {
      const assignee = getAssigneeLabel(row.original.assignee)
      if (!assignee)
        return h('span', { class: 'text-muted-foreground text-sm' }, 'Unassigned')
      return h(Badge, {
        variant: row.original.assigneeType === 'role' ? 'secondary' : 'outline',
        class: 'text-xs font-normal',
      }, () => assignee.label)
    },
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
  },
  {
    accessorKey: 'listing',
    header: ({ column }) => h(DataTableColumnHeader, { column, title: 'Listing' }),
    cell: ({ row }) => {
      const listing = row.getValue('listing') as string | undefined
      if (!listing)
        return h('span', { class: 'text-muted-foreground text-sm' }, '—')
      return h('span', { class: 'text-sm', title: listing }, shortListingName(listing))
    },
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
  },
  {
    id: 'inventoryLink',
    header: 'Inventory',
    cell: ({ row }) => {
      const itemName = row.original.linkedInventoryItemName
      const detected = row.original.detectedByHostBuddy
      if (!itemName)
        return h('span', { class: 'text-muted-foreground text-sm' }, '—')
      return h('div', { class: 'flex items-center gap-1.5' }, [
        detected
          ? h(Icon, { name: 'elev8:elevai', class: 'h-3 w-3 shrink-0' })
          : null,
        h(Badge, { variant: 'outline', class: 'text-xs font-normal' }, () => itemName),
      ])
    },
  },
  {
    accessorKey: 'dueDate',
    header: ({ column }) => h(DataTableColumnHeader, { column, title: 'Due Date' }),
    cell: ({ row }) => {
      const date = row.getValue('dueDate') as string | undefined
      if (!date)
        return h('span', { class: 'text-muted-foreground text-sm' }, '—')
      const today = toLocalDateKey(new Date())
      const isOverdue = date < today && row.original.status !== 'completed'
      return h('span', {
        class: isOverdue ? 'text-destructive text-sm font-medium' : 'text-sm',
      }, formatDueDate(date))
    },
  },
  // Hidden until switched on from the View menu (see `DataTable`).
  {
    accessorKey: 'createdAt',
    header: ({ column }) => h(DataTableColumnHeader, { column, title: 'Created at' }),
    cell: ({ row }) => {
      const created = row.original.createdAt
      if (!created)
        return h('span', { class: 'text-muted-foreground text-sm' }, '—')
      return h('span', { class: 'text-sm' }, createdAtFormat.format(new Date(created)))
    },
  },
  // Hidden until switched on from the column menu (see `DataTable`).
  {
    id: 'completedAt',
    accessorFn: row => taskCompletedAt(row) ?? '',
    header: ({ column }) => h(DataTableColumnHeader, { column, title: 'Completed at' }),
    cell: ({ row }) => {
      const completed = taskCompletedAt(row.original)
      if (!completed)
        return h('span', { class: 'text-muted-foreground text-sm' }, '—')
      return h('span', { class: 'text-sm' }, createdAtFormat.format(new Date(completed)))
    },
  },
  {
    accessorKey: 'priority',
    header: ({ column }) => h(DataTableColumnHeader, { column, title: 'Priority' }),
    cell: ({ row }) => {
      const priority = priorities.find(p => p.value === row.getValue('priority'))
      if (!priority)
        return null
      return h('div', { class: 'flex items-center' }, [
        priority.icon && h(priority.icon, { class: 'mr-2 h-4 w-4' }),
        h('span', {}, priority.label),
      ])
    },
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
  },
  {
    accessorKey: 'ownerVisible',
    header: () => h('span', { class: 'sr-only' }, 'Owner maintenance'),
    cell: ({ row }) => {
      if (!row.original.ownerVisible)
        return null
      return h(Badge, { variant: 'secondary', class: 'text-xs font-normal' }, 'Owner')
    },
    filterFn: (row, _id, value: string[]) => value.includes('true') === !!row.original.ownerVisible,
  },
  // Filter-only (hidden in `DataTable`): the title cell already marks a
  // scheduled task with its repeat icon.
  {
    id: 'scheduled',
    accessorFn: row => (row.scheduleId ? 'true' : 'false'),
    header: () => h('span', { class: 'sr-only' }, 'Scheduled'),
    cell: () => null,
    enableSorting: false,
    enableHiding: false,
    filterFn: (row, _id, value: string[]) => value.includes('true') === !!row.original.scheduleId,
  },
  // Filter-only (hidden in `DataTable`): a task carries its listing's tags,
  // and the filter needs every selected tag, like the Listings page.
  {
    id: 'listingTags',
    accessorFn: row => listings.value.find(l => l.name === row.listing)?.tags ?? [],
    header: () => h('span', { class: 'sr-only' }, 'Listing tags'),
    cell: () => null,
    enableSorting: false,
    enableHiding: false,
    filterFn: (row, id, value: string[]) => {
      const tags = row.getValue<string[]>(id)
      return value.every(t => tags.includes(t))
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => h(DataTableRowActions, { row }),
  },
]
