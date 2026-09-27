import type { Task } from '@/components/tasks/data/schema'
import { ref } from 'vue'
import { useTaskStore } from './useTaskStore'

export const selectedTaskRef = ref<Task | null>(null)

export function useTaskDetail() {
  function openTaskDetail(task: Task) {
    selectedTaskRef.value = task
  }

  /**
   * Opens a task by id, for callers that only hold a reference to it (an
   * inbox task card, a room's "opened a task" line). A task that no longer
   * exists opens nothing.
   */
  function openTaskDetailById(id: string) {
    const task = useTaskStore().tasks.value.find(t => t.id === id)
    if (task)
      openTaskDetail(task)
  }

  function closeTaskDetail() {
    selectedTaskRef.value = null
  }

  return {
    selectedTask: selectedTaskRef,
    openTaskDetail,
    openTaskDetailById,
    closeTaskDetail,
  }
}
