<script setup lang="ts">
import { columns } from '@/components/tasks/components/columns'
import DataTable from '@/components/tasks/components/DataTable.vue'
import { useTaskDetail } from '@/composables/useTaskDetail'
import { useTaskStore } from '@/composables/useTaskStore'

const { tasks } = useTaskStore()

const { selectedTask, closeTaskDetail } = useTaskDetail()
const detailSheetOpen = computed({
  get: () => selectedTask.value !== null,
  set: (val) => {
    if (!val)
      closeTaskDetail()
  },
})

const newTaskOpen = ref(false)
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
      <Button variant="outline" @click="newTaskOpen = true">
        <Icon name="lucide:plus" class="mr-2 h-4 w-4" />
        New Task
      </Button>
    </div>

    <div class="grid gap-4">
      <DataTable :data="tasks" :columns="columns" />
    </div>

    <TasksNewTaskDialog v-model:open="newTaskOpen" />

    <TasksTaskDetailSheet
      :task="selectedTask"
      :open="detailSheetOpen"
      @update:open="detailSheetOpen = $event"
    />
  </div>
</template>
