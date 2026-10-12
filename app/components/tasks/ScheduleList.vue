<script setup lang="ts">
import type { TaskSchedule } from '@/components/tasks/data/schedule'
import { toast } from 'vue-sonner'
import { shortListingName } from '@/components/tasks/components/columns'
import { assigneeOptions } from '@/components/tasks/data/data'
import { describeRecurrence, formatDay, nextOccurrence, todayKey } from '@/components/tasks/data/schedule'
import { useTaskSchedules } from '@/composables/useTaskSchedules'
import { useTaskStore } from '@/composables/useTaskStore'

/**
 * The Scheduled tab of /tasks: every recurring schedule, its rule, its next
 * due date and how many tasks it has made. Pausing stops new tasks; deleting
 * removes the schedule only, the tasks it made stay.
 */
const emit = defineEmits<{
  edit: [schedule: TaskSchedule]
}>()

const { schedules, setScheduleStatus, deleteSchedule } = useTaskSchedules()
const { tasks } = useTaskStore()

const today = todayKey()

const rows = computed(() => schedules.value.map((schedule) => {
  const next = schedule.status === 'active' ? nextOccurrence(schedule, today) : null
  const assignee = assigneeOptions.find(a => a.value === schedule.assignee)
  return {
    schedule,
    rule: describeRecurrence(schedule),
    next: next ? formatDay(next) : null,
    assignee,
    openTasks: tasks.value.filter(t => t.scheduleId === schedule.id && t.status !== 'completed').length,
    madeTasks: tasks.value.filter(t => t.scheduleId === schedule.id).length,
  }
}))

function listingsLabel(listings: string[]): string {
  if (!listings.length)
    return '—'
  if (listings.length === 1)
    return shortListingName(listings[0]!)
  return `${listings.length} listings`
}

function toggleStatus(schedule: TaskSchedule, active: boolean) {
  const created = setScheduleStatus(schedule.id, active ? 'active' : 'paused')
  if (!active)
    toast.info(`"${schedule.title}" paused. No new tasks until you resume it.`)
  else
    toast.success(created.length ? `"${schedule.title}" resumed, ${created.length} ${created.length === 1 ? 'task' : 'tasks'} created.` : `"${schedule.title}" resumed.`)
}

const pendingDelete = ref<TaskSchedule | null>(null)
const deleteOpen = computed({
  get: () => pendingDelete.value !== null,
  set: (value) => {
    if (!value)
      pendingDelete.value = null
  },
})

function confirmDelete() {
  if (!pendingDelete.value)
    return
  deleteSchedule(pendingDelete.value.id)
  toast.success(`Schedule "${pendingDelete.value.title}" deleted`)
  pendingDelete.value = null
}
</script>

<template>
  <div>
    <div v-if="!rows.length" class="flex flex-col items-center gap-2 rounded-md border border-dashed px-6 py-12 text-center">
      <Icon name="lucide:calendar-sync" class="size-8 text-muted-foreground" />
      <p class="font-medium">
        No scheduled tasks yet
      </p>
      <p class="max-w-sm text-sm text-muted-foreground">
        Choose a Repeat option when you create a task, like weekly pool cleaning or an AC service every 3 months.
      </p>
    </div>

    <div v-else class="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Task</TableHead>
            <TableHead>Listing</TableHead>
            <TableHead>Repeats</TableHead>
            <TableHead>Next due</TableHead>
            <TableHead>Open tasks</TableHead>
            <TableHead>Active</TableHead>
            <TableHead class="w-10">
              <span class="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="row in rows" :key="row.schedule.id" :data-testid="`schedule-row-${row.schedule.id}`">
            <TableCell>
              <button
                type="button"
                class="flex items-center gap-2 text-left underline-offset-2 hover:underline"
                @click="emit('edit', row.schedule)"
              >
                <Badge
                  v-if="row.assignee"
                  :variant="row.assignee.type === 'role' ? 'secondary' : 'outline'"
                  class="shrink-0 text-xs font-normal"
                >
                  {{ row.assignee.label }}
                </Badge>
                <span class="max-w-[260px] truncate font-medium">{{ row.schedule.title }}</span>
              </button>
            </TableCell>
            <TableCell>
              <span class="text-sm" :title="row.schedule.listings.join('\n')">{{ listingsLabel(row.schedule.listings) }}</span>
            </TableCell>
            <TableCell>
              <span class="flex items-center gap-1.5 text-sm">
                <Icon name="lucide:repeat" class="size-3.5 shrink-0 text-muted-foreground" />
                {{ row.rule }}
              </span>
            </TableCell>
            <TableCell>
              <span v-if="row.schedule.status === 'paused'" class="text-sm text-muted-foreground">Paused</span>
              <span v-else-if="row.next" class="text-sm">{{ row.next }}</span>
              <span v-else class="text-sm text-muted-foreground">Ended</span>
            </TableCell>
            <TableCell>
              <span class="text-sm" :title="`${row.madeTasks} made in total`">{{ row.openTasks }}</span>
            </TableCell>
            <TableCell>
              <Switch
                :model-value="row.schedule.status === 'active'"
                :aria-label="`${row.schedule.status === 'active' ? 'Pause' : 'Resume'} ${row.schedule.title}`"
                @update:model-value="(value: boolean) => toggleStatus(row.schedule, value)"
              />
            </TableCell>
            <TableCell>
              <DropdownMenu>
                <DropdownMenuTrigger as-child>
                  <Button variant="ghost" class="size-8 p-0 data-[state=open]:bg-muted" :aria-label="`Actions for ${row.schedule.title}`">
                    <Icon name="lucide:ellipsis" class="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" class="w-[160px]">
                  <DropdownMenuItem @click="emit('edit', row.schedule)">
                    <Icon name="lucide:pencil" class="size-4" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem @click="toggleStatus(row.schedule, row.schedule.status !== 'active')">
                    <Icon :name="row.schedule.status === 'active' ? 'lucide:pause' : 'lucide:play'" class="size-4" />
                    {{ row.schedule.status === 'active' ? 'Pause' : 'Resume' }}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem class="text-destructive" @click="pendingDelete = row.schedule">
                    <Icon name="lucide:trash-2" class="size-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <AlertDialog v-model:open="deleteOpen">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this schedule?</AlertDialogTitle>
          <AlertDialogDescription>
            "{{ pendingDelete?.title }}" stops making new tasks. Tasks it already made stay in the task list.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction class="bg-destructive text-white hover:bg-destructive/90" @click="confirmDelete">
            Delete schedule
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
