import type { ColumnDef } from '@tanstack/vue-table'
import type { Task } from '../data/schema'
import { Icon } from '#components'
import { h } from 'vue'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { selectedTaskRef } from '~/composables/useTaskDetail'
import { assigneeOptions, priorities, statuses } from '../data/data'
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
      'checked': table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && 'indeterminate'),
      'onUpdate:checked': value => table.toggleAllPageRowsSelected(!!value),
      'ariaLabel': 'Select all',
      'class': 'translate-y-0.5',
    }),
    cell: ({ row }) => h(Checkbox, {
      'checked': row.getIsSelected(),
      'onUpdate:checked': value => row.toggleSelected(!!value),
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
        status.icon && h(status.icon, { class: 'mr-1.5 h-4 w-4 text-muted-foreground' }),
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
      const assignee = getAssigneeLabel(task.assignee)
      return h('button', {
        class: 'flex items-center gap-2 text-left hover:underline underline-offset-2',
        onClick: () => { selectedTaskRef.value = task },
      }, [
        assignee
          ? h(Badge, {
              variant: task.assigneeType === 'role' ? 'secondary' : 'outline',
              class: 'shrink-0 text-xs font-normal',
            }, () => assignee.label)
          : null,
        h('span', { class: 'max-w-[300px] truncate font-medium' }, row.getValue('title')),
      ])
    },
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
          ? h(Icon, { name: 'lucide:sparkles', class: 'h-3 w-3 shrink-0 text-[#C8A84B]' })
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
      const today = new Date().toISOString().slice(0, 10)
      const isOverdue = date < today && row.original.status !== 'done' && row.original.status !== 'canceled'
      return h('span', {
        class: isOverdue ? 'text-destructive text-sm font-medium' : 'text-sm',
      }, date)
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
        priority.icon && h(priority.icon, { class: 'mr-2 h-4 w-4 text-muted-foreground' }),
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
  {
    id: 'actions',
    cell: ({ row }) => h(DataTableRowActions, { row }),
  },
]
