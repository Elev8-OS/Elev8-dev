<script setup lang="ts">
import type { GmWidgetItem } from '~/composables/useGmDashboardWidgets'
import { VueDraggable } from 'vue-draggable-plus'
import GmAddWidgetPopover from '~/components/gm/GmAddWidgetPopover.vue'
import GmDashboardConfigureDropdown from '~/components/gm/GmDashboardConfigureDropdown.vue'
import GmWidgetCard from '~/components/gm/GmWidgetCard.vue'
import {
  getWidgetRowSpanClass,
  getWidgetSpanClass,
  useGmDashboardWidgets,
} from '~/composables/useGmDashboardWidgets'

const gm = useGmDashboard()
const { currentUser } = useCurrentDashboardUser()
const widgetsManager = useGmDashboardWidgets()

const activeWidgetsList = ref<GmWidgetItem[]>([])

watch(
  widgetsManager.activeWidgets,
  (val) => {
    activeWidgetsList.value = [...val]
  },
  { immediate: true, deep: true },
)

function onWidgetDragEnd() {
  widgetsManager.reorderActiveWidgets(activeWidgetsList.value.map(w => w.id))
}
</script>

<template>
  <div class="flex w-full flex-col gap-4">
    <!-- Top Dashboard Header Bar -->
    <div class="flex flex-wrap items-start justify-between gap-2">
      <div>
        <h2 class="text-2xl font-bold tracking-tight">
          Portfolio overview
        </h2>
        <p class="text-sm text-muted-foreground">
          {{ currentUser?.name }} · General Manager · {{ gm.unitCount.value }} properties
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <Badge
          v-if="gm.kpis.value.unassignedArrivals"
          variant="outline"
          class="border-amber-500/30 text-amber-700 dark:text-amber-400"
        >
          <Icon name="lucide:shield-alert" class="size-3.5" />
          {{ gm.kpis.value.unassignedArrivals }} unverified arrivals
        </Badge>

        <!-- Region selector -->
        <Select v-model="gm.region.value">
          <SelectTrigger class="w-[140px]" size="sm">
            <SelectValue placeholder="All regions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="option in gm.regionOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </SelectItem>
          </SelectContent>
        </Select>

        <!-- Operations calendar link -->
        <Button variant="outline" size="sm" as-child>
          <NuxtLink to="/operations-calendar">
            <Icon name="lucide:calendar-days" class="size-4" />
            Operations calendar
          </NuxtLink>
        </Button>

        <!-- Unified Dashboard Configure Dropdown (Add Widget, Edit Layout, Saved Views, Reset) -->
        <GmDashboardConfigureDropdown />
      </div>
    </div>

    <!-- Active Banner when in direct layout edit mode -->
    <div
      v-if="widgetsManager.isEditMode.value"
      class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-sky-400/40 bg-sky-500/10 px-3.5 py-2.5 text-sm"
    >
      <div class="flex items-center gap-2 font-medium text-foreground">
        <Icon name="lucide:layout-grid" class="size-4 text-sky-600 dark:text-sky-400" />
        <span>Layout editing active — 2D Block Grid (12 Columns × Rows). Drag the right edge to resize columns, or drag the bottom handle to snap to row blocks.</span>
      </div>
      <div class="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          class="h-7 text-xs"
          :disabled="!widgetsManager.isCustomized.value"
          @click="widgetsManager.resetToDefaults"
        >
          <Icon name="lucide:rotate-ccw" class="size-3 mr-1" />
          Reset layout
        </Button>
        <Button
          size="sm"
          class="h-7 text-xs bg-sky-600 hover:bg-sky-700 text-white"
          @click="widgetsManager.isEditMode.value = false"
        >
          Done editing
        </Button>
      </div>
    </div>

    <!-- Responsive Layout: 12-Column Block Grid Canvas -->
    <main
      class="@container/main relative flex flex-1 flex-col gap-4 transition-all"
      :class="[
        widgetsManager.isEditMode.value
          ? 'rounded-2xl border-2 border-dashed border-sky-400/40 bg-sky-50/20 dark:bg-sky-950/10 p-3.5'
          : '',
      ]"
    >
      <!-- Blueprint 12-Column Grid Guide (Matches 170px row blocks exactly) -->
      <div
        v-if="widgetsManager.isEditMode.value"
        class="pointer-events-none absolute inset-3.5 z-0 hidden @5xl/main:grid grid-cols-12 gap-4 opacity-75 select-none"
        style="grid-auto-rows: 170px;"
        aria-hidden="true"
      >
        <template v-for="row in 6" :key="row">
          <div
            v-for="col in 12"
            :key="`${row}-${col}`"
            class="flex flex-col items-center justify-between p-1.5 rounded-lg border border-sky-300/80 dark:border-sky-500/50 bg-sky-400/[0.02] dark:bg-sky-400/[0.04]"
          >
            <div class="w-full flex items-center justify-between text-[8px] font-mono text-sky-500/70">
              <span v-if="col === 1" class="font-semibold text-sky-700 dark:text-sky-300">Row Block {{ row }}</span>
              <span v-else class="text-sky-400/40">B{{ row }}</span>
              <span class="text-sky-400/60">C{{ col }}</span>
            </div>
            <div class="text-[9px] font-mono text-sky-400/30">
              {{ col }}/12 · R{{ row }}
            </div>
          </div>
        </template>
      </div>

      <!-- Medium screen 6-column guide -->
      <div
        v-if="widgetsManager.isEditMode.value"
        class="pointer-events-none absolute inset-3.5 z-0 grid @5xl/main:hidden grid-cols-1 @3xl/main:grid-cols-6 gap-4 auto-rows-fr opacity-60"
        aria-hidden="true"
      >
        <div
          v-for="i in 24"
          :key="i"
          class="rounded-lg border border-sky-300/80 dark:border-sky-500/50 bg-sky-400/[0.02] dark:bg-sky-400/[0.04] min-h-[140px]"
        />
      </div>

      <!-- 12-Column Header Labels in Edit Mode -->
      <div
        v-if="widgetsManager.isEditMode.value"
        class="relative z-10 hidden @5xl/main:grid grid-cols-12 gap-4 px-0.5 text-center text-[10px] font-mono font-medium text-sky-600 dark:text-sky-400 select-none"
      >
        <div
          v-for="col in 12"
          :key="col"
          class="flex items-center justify-center rounded border border-dashed border-sky-300/70 dark:border-sky-500/50 bg-sky-500/10 py-0.5"
        >
          Column {{ col }}
        </div>
      </div>

      <!-- Draggable Block Grid -->
      <VueDraggable
        v-model="activeWidgetsList"
        handle=".widget-block-handle"
        item-key="id"
        class="relative z-10 grid grid-cols-1 @3xl/main:grid-cols-6 @5xl/main:grid-cols-12 gap-4 grid-flow-dense"
        :style="{ gridAutoRows: '170px' }"
        :animation="250"
        ghost-class="grid-block-ghost"
        chosen-class="grid-block-chosen"
        drag-class="grid-block-dragging"
        :disabled="!widgetsManager.isEditMode.value"
        @end="onWidgetDragEnd"
      >
        <div
          v-for="widget in activeWidgetsList"
          :key="widget.id"
          class="widget-grid-block flex flex-col transition-all h-full"
          :class="[
            getWidgetSpanClass(widget.colSpan),
            getWidgetRowSpanClass(widget.id, widget.height, widget.colSpan),
          ]"
        >
          <GmWidgetCard
            :widget="widget"
            :height="widget.height ?? 356"
            :is-first="activeWidgetsList.indexOf(widget) === 0"
            :is-last="activeWidgetsList.indexOf(widget) === activeWidgetsList.length - 1"
            :is-edit-mode="widgetsManager.isEditMode.value"
            class="h-full"
          />
        </div>
      </VueDraggable>

      <!-- Add Widget card button when in edit mode or when all widgets are hidden -->
      <div
        v-if="widgetsManager.isEditMode.value || widgetsManager.activeWidgets.value.length === 0"
        class="relative z-10 w-full"
      >
        <GmAddWidgetPopover class="w-full">
          <button
            type="button"
            class="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-sky-300/60 dark:border-sky-600/50 bg-sky-50/40 dark:bg-sky-950/20 p-8 text-sm text-sky-800 dark:text-sky-300 transition-colors hover:border-sky-500 hover:bg-sky-100/50 dark:hover:bg-sky-900/40 hover:text-sky-900 dark:hover:text-sky-100"
          >
            <Icon name="lucide:plus-circle" class="size-4 text-sky-600 dark:text-sky-400" />
            Add Widget to Dashboard ({{ widgetsManager.availableWidgets.value.length }} available)
          </button>
        </GmAddWidgetPopover>
      </div>
    </main>
  </div>
</template>

<style scoped>
:deep(.grid-block-ghost) {
  opacity: 0.4 !important;
  border: 2px dashed #0284c7 !important;
  background: rgba(56, 189, 248, 0.15) !important;
  border-radius: 0.75rem !important;
  transform: scale(0.98);
}

:deep(.grid-block-chosen) {
  box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.15), 0 8px 10px -6px rgb(0 0 0 / 0.1) !important;
  border-color: #0284c7 !important;
  transform: scale(1.01);
  z-index: 40;
}

:deep(.grid-block-dragging) {
  opacity: 0.9 !important;
}
</style>
