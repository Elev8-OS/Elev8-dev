<script lang="ts" setup>
import type { NewTaskPrefill } from '~/components/tasks/data/schema'
import { taskSeedFromRefs } from '~/components/inbox/data/internal'

/**
 * Turns one or more messages into a task, through the SAME New Task form the
 * Tasks page uses (`TasksNewTaskDialog`), so a task raised from the inbox gets
 * HostBuddy detection, owner approval and images like any other.
 *
 * The messages are copied into Instructions in full rather than linked:
 * whoever picks the task up was not in the conversation, and a task that says
 * "see the thread" is a task that gets handed back. Photos in the messages go
 * into the task's images.
 *
 * ⚠️ Nothing is posted back into the room: there is no "opened a task" line.
 * The task shows up in the room panel's task list instead.
 */
const { taskRequest, taskOpen } = useMessageActions()

const prefill = computed<NewTaskPrefill | null>(() => {
  const request = taskRequest.value
  if (!request)
    return null
  const seed = taskSeedFromRefs(request.refs)
  return {
    instructions: seed.instructions,
    listing: request.listingName,
    assignee: request.assignee,
    images: request.refs.map(r => r.mediaUrl).filter((url): url is string => !!url),
  }
})

const context = computed(() => {
  const request = taskRequest.value
  if (!request)
    return undefined
  const count = request.refs.length
  return `Built from ${count} message${count === 1 ? '' : 's'}`
})
</script>

<template>
  <TasksNewTaskDialog
    v-model:open="taskOpen"
    :prefill="prefill"
    :context="context"
  />
</template>
