<script setup lang="ts">
import type { ColumnFiltersState } from '@tanstack/vue-table'
import type { TaskSchedule } from '@/components/tasks/data/schedule'
import { columns } from '@/components/tasks/components/columns'
import DataTable from '@/components/tasks/components/DataTable.vue'
import ScheduleList from '@/components/tasks/ScheduleList.vue'
import TaskFilterPanel from '@/components/tasks/TaskFilterPanel.vue'
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

const columnFilters = ref<ColumnFiltersState>([])
const tableRef = ref<InstanceType<typeof DataTable> | null>(null)

/*
 * Filters live in a right-hand sidebar: pinned beside the table on wide
 * screens (and collapsible there), a Sheet below that. Same pattern as Analytics.
 */
const panelOpen = useState('tasks-filter-panel-open', () => false)
const sheetOpen = ref(false)
const isWide = useMediaQuery('(min-width: 1280px)')
function toggleFilters() {
  if (isWide.value)
    panelOpen.value = !panelOpen.value
  else sheetOpen.value = true
}
watch(isWide, (wide) => {
  if (wide)
    sheetOpen.value = false
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
  <div class="flex w-full items-start gap-4">
    <div class="flex min-w-0 flex-1 flex-col gap-4">
      <div class="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 class="text-2xl font-bold tracking-tight">
            Tasks
          </h2>
          <p class="text-muted-foreground">
            Operational task management.
          </p>
        </div>
        <div class="flex items-center gap-2">
          <Button
            v-if="tab === 'tasks'"
            variant="outline"
            data-testid="tasks-export"
            :disabled="tableRef?.exporting"
            @click="tableRef?.exportTasks()"
          >
            <Icon :name="tableRef?.exporting ? 'lucide:loader-2' : 'lucide:file-spreadsheet'" class="mr-2 h-4 w-4" :class="tableRef?.exporting && 'animate-spin'" />
            Export to Excel
          </Button>
          <Button @click="openNewTask">
            <Icon name="lucide:plus" class="mr-2 h-4 w-4" />
            New Task
          </Button>
        </div>
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
          <DataTable ref="tableRef" v-model:column-filters="columnFilters" :data="tasks" :columns="columns" @toggle-filters="toggleFilters" />
        </TabsContent>
        <TabsContent value="scheduled" class="mt-4">
          <ScheduleList @edit="editSchedule" />
        </TabsContent>
      </Tabs>
    </div>

    <!-- Wide screens: pinned beside the table, scrolling on its own. -->
    <aside
      v-if="panelOpen && tab === 'tasks'"
      class="sticky top-0 hidden max-h-[calc(100svh-7rem)] w-72 shrink-0 flex-col overflow-hidden rounded-xl border bg-card xl:flex"
      data-testid="tasks-filter-sidebar"
    >
      <TaskFilterPanel v-model="columnFilters" @close="panelOpen = false" />
    </aside>

    <!-- Narrower screens: the same panel, sliding in from the right. -->
    <Sheet v-model:open="sheetOpen">
      <SheetContent side="right" class="w-80 gap-0 p-0 sm:max-w-80 [&>button:last-child]:hidden">
        <SheetHeader class="sr-only">
          <SheetTitle>Filters</SheetTitle>
          <SheetDescription>Narrow the tasks by assignee, listing, status and priority.</SheetDescription>
        </SheetHeader>
        <TaskFilterPanel v-model="columnFilters" @close="sheetOpen = false" />
      </SheetContent>
    </Sheet>

    <TasksNewTaskDialog v-model:open="newTaskOpen" :schedule="editingSchedule" />

    <TasksTaskDetailSheet
      :task="selectedTask"
      :open="detailSheetOpen"
      @update:open="detailSheetOpen = $event"
    />
  </div>
</template>
