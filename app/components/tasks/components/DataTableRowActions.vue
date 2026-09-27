<script setup lang="ts">
import type { Row } from '@tanstack/vue-table'
import type { Task, TaskStatus } from '../data/schema'
import { computed } from 'vue'
import { toast } from 'vue-sonner'
import { useTaskStore } from '@/composables/useTaskStore'
import { statuses } from '../data/data'

interface DataTableRowActionsProps {
  row: Row<Task>
}
const props = defineProps<DataTableRowActionsProps>()

const { updateStatus, deleteTask } = useTaskStore()
const task = computed(() => props.row.original)

function handleStatusChange(status: TaskStatus) {
  updateStatus(task.value.id, status)
  if (task.value.linkedInventoryItemName && status === 'completed')
    toast.success(`HostBuddy updated: ${task.value.linkedInventoryItemName} condition → Good`)
}

function handleDelete() {
  deleteTask(task.value.id)
  toast.success(`Task "${task.value.title}" deleted`)
}
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button
        variant="ghost"
        class="h-8 w-8 flex p-0 data-[state=open]:bg-muted"
      >
        <Icon name="i-radix-icons-dots-horizontal" class="h-4 w-4" />
        <span class="sr-only">Open menu</span>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="w-[180px]">
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>Change Status</DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          <DropdownMenuRadioGroup :value="task.status">
            <DropdownMenuRadioItem
              v-for="status in statuses"
              :key="status.value"
              :value="status.value"
              @click="handleStatusChange(status.value as TaskStatus)"
            >
              {{ status.label }}
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuSeparator />
      <DropdownMenuItem class="text-destructive" @click="handleDelete">
        Delete
        <DropdownMenuShortcut>⌘⌫</DropdownMenuShortcut>
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
