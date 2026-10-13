import type { Task } from '@/components/tasks/data/schema'
import { computed, ref } from 'vue'
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

  // The ref holds what was clicked; the sheet reads the live task from the
  // store, so a progress update, an edit or a reassign shows straight away.
  // A task that is not in the store (or was deleted) falls back to the copy.
  const { tasks } = useTaskStore()
  const selectedTask = computed<Task | null>(() => {
    const picked = selectedTaskRef.value
    if (!picked)
      return null
    return tasks.value.find(t => t.id === picked.id) ?? picked
  })

  return {
    selectedTask,
    openTaskDetail,
    openTaskDetailById,
    closeTaskDetail,
  }
}
