<script setup lang="ts">
import type { TaskSchedule } from '@/components/tasks/data/schedule'
import { columns } from '@/components/tasks/components/columns'
import DataTable from '@/components/tasks/components/DataTable.vue'
import ScheduleList from '@/components/tasks/ScheduleList.vue'
import { useTaskDetail } from '@/composables/useTaskDetail'
import { useTaskSchedules } from '@/composables/useTaskSchedules'
import { useTaskStore } from '@/composables/useTaskStore'

const { tasks } = useTaskStore()
const { schedules, generateDueTasks } = useTaskSchedules()

// Schedules make the tasks that have come due since the last visit.
onMounted(() => generateDueTasks())

const { selectedTask, closeTaskDetail } = useTaskDetail()
const detailSheetOpen = computed({
  get: () => selectedTask.value !== null,
  set: (val) => {
    if (!val)
      closeTaskDetail()
  },
})

const tab = ref<'tasks' | 'scheduled'>('tasks')

const newTaskOpen = ref(false)
const editingSchedule = ref<TaskSchedule | null>(null)

function openNewTask() {
  editingSchedule.value = null
  newTaskOpen.value = true
}

function editSchedule(schedule: TaskSchedule) {
  editingSchedule.value = schedule
  newTaskOpen.value = true
}

watch(newTaskOpen, (isOpen) => {
  if (!isOpen)
    editingSchedule.value = null
})
</script>

<template>
  <div class="w-full flex flex-col gap-4">
    <div class="flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 class="text-2xl font-bold tracking-tight">
          Tasks
        </h2>
        <p class="text-muted-foreground">
          Operational task management.
        </p>
      </div>
      <Button variant="outline" @click="openNewTask">
        <Icon name="lucide:plus" class="mr-2 h-4 w-4" />
        New Task
      </Button>
    </div>

    <Tabs v-model="tab" class="w-full">
      <TabsList>
        <TabsTrigger value="tasks">
          All tasks
        </TabsTrigger>
        <TabsTrigger value="scheduled" data-testid="tasks-tab-scheduled">
          Scheduled
          <Badge variant="secondary" class="ml-1.5 h-5 px-1.5 text-xs">
            {{ schedules.length }}
          </Badge>
        </TabsTrigger>
      </TabsList>
      <TabsContent value="tasks" class="mt-4">
        <DataTable :data="tasks" :columns="columns" />
      </TabsContent>
      <TabsContent value="scheduled" class="mt-4">
        <ScheduleList @edit="editSchedule" />
      </TabsContent>
    </Tabs>

    <TasksNewTaskDialog v-model:open="newTaskOpen" :schedule="editingSchedule" />

    <TasksTaskDetailSheet
      :task="selectedTask"
      :open="detailSheetOpen"
      @update:open="detailSheetOpen = $event"
    />
  </div>
</template>
