<script setup lang="ts">
import type { Row } from '@tanstack/vue-table'
import type { Task } from '../data/schema'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import { useTaskStore } from '@/composables/useTaskStore'

interface DataTableRowActionsProps {
  row: Row<Task>
}
const props = defineProps<DataTableRowActionsProps>()

const { deleteTask } = useTaskStore()
const task = computed(() => props.row.original)

const confirmDeleteOpen = ref(false)

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
        class="size-9 flex p-0 data-[state=open]:bg-muted"
      >
        <Icon name="lucide:ellipsis" class="size-4" />
        <span class="sr-only">Open menu</span>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="w-[180px]">
      <DropdownMenuItem class="text-destructive" @click="confirmDeleteOpen = true">
        Delete
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>

  <AlertDialog v-model:open="confirmDeleteOpen">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Delete this task?</AlertDialogTitle>
        <AlertDialogDescription>
          "{{ task.title }}" will be removed. This cannot be undone.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction class="bg-destructive text-white hover:bg-destructive/90" @click="handleDelete">
          Delete
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
