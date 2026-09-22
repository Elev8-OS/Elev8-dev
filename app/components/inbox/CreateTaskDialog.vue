<script lang="ts" setup>
import { toast } from 'vue-sonner'
import { taskSeedFromRefs } from '~/components/inbox/data/internal'
import { listings } from '~/components/listings/data/listings'
import { assigneeOptions, priorities } from '~/components/tasks/data/data'

/**
 * Turns one or more messages into a task. The messages are copied into the
 * description in full rather than linked: whoever picks the task up was not in
 * the conversation, and a task that says "see the thread" is a task that gets
 * handed back.
 */
const { taskRequest, taskOpen, closeTask } = useMessageActions()
const { postTaskNotice } = useInternalInbox()
const { addTask } = useTaskStore()

const title = ref('')
const description = ref('')
const listing = ref('')
const assignee = ref('')
const priority = ref('medium')
const dueDate = ref('')

const refs = computed(() => taskRequest.value?.refs ?? [])

const listingOptions = computed(() =>
  listings.value.map(l => ({ value: l.name, label: l.name })),
)

const assigneeType = computed<'role' | 'person'>(() =>
  assigneeOptions.find(o => o.value === assignee.value)?.type ?? 'role',
)

watch(taskOpen, (open) => {
  if (!open)
    return
  const seed = taskSeedFromRefs(refs.value)
  title.value = seed.title
  description.value = seed.description
  listing.value = taskRequest.value?.listingName ?? ''
  assignee.value = taskRequest.value?.assignee ?? ''
  priority.value = 'medium'
  dueDate.value = ''
})

function handleCreate() {
  if (!title.value.trim())
    return
  const roomId = taskRequest.value?.roomId
  const created = addTask({
    title: title.value.trim(),
    status: 'todo',
    assignee: assignee.value || undefined,
    assigneeType: assignee.value ? assigneeType.value : undefined,
    priority: priority.value,
    listing: listing.value || undefined,
    description: description.value.trim() || undefined,
    dueDate: dueDate.value || undefined,
    source: 'manual',
  })
  // Started from a room, the room is told, otherwise the person who asked
  // for the fix has no way of knowing it became a task.
  if (roomId)
    postTaskNotice(roomId, { id: created.id, title: created.title })
  toast.success(`Task ${created.id} created`)
  closeTask()
}
</script>

<template>
  <Dialog v-model:open="taskOpen">
    <DialogContent class="sm:max-w-[560px] flex flex-col gap-0 p-0 max-h-[85vh]">
      <DialogHeader class="px-6 pt-5 pb-3 border-b shrink-0">
        <DialogTitle>Create task</DialogTitle>
        <DialogDescription>
          Built from {{ refs.length }} message{{ refs.length === 1 ? '' : 's' }}
          <template v-if="taskRequest?.roomId">
            · the room will be told
          </template>
        </DialogDescription>
      </DialogHeader>

      <div class="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-4">
        <div class="space-y-1.5">
          <Label for="task-title" class="text-xs">Title</Label>
          <Input id="task-title" v-model="title" placeholder="What needs doing?" />
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1.5">
            <Label class="text-xs">Listing</Label>
            <Select v-model="listing">
              <SelectTrigger class="w-full">
                <SelectValue placeholder="Select listing" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="opt of listingOptions" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="space-y-1.5">
            <Label class="text-xs">Assignee</Label>
            <Select v-model="assignee">
              <SelectTrigger class="w-full">
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="opt of assigneeOptions" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="space-y-1.5">
            <Label class="text-xs">Priority</Label>
            <Select v-model="priority">
              <SelectTrigger class="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="opt of priorities" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="space-y-1.5">
            <Label for="task-due" class="text-xs">Due date</Label>
            <Input id="task-due" v-model="dueDate" type="date" />
          </div>
        </div>

        <div class="space-y-1.5">
          <Label for="task-desc" class="text-xs">Description</Label>
          <Textarea id="task-desc" v-model="description" class="min-h-[120px] resize-none text-sm" />
        </div>
      </div>

      <DialogFooter class="px-6 py-4 border-t shrink-0">
        <Button variant="outline" @click="closeTask">
          Cancel
        </Button>
        <Button :disabled="!title.trim()" @click="handleCreate">
          Create task
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
