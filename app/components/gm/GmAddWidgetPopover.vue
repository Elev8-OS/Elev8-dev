<script setup lang="ts">
import type { GmWidgetId } from '~/composables/useGmDashboardWidgets'
import { toast } from 'vue-sonner'
import { Button } from '~/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover'
import { useGmDashboardWidgets } from '~/composables/useGmDashboardWidgets'

const props = withDefaults(
  defineProps<{
    variant?: 'outline' | 'default' | 'ghost' | 'secondary'
    size?: 'sm' | 'default' | 'lg' | 'icon'
    showLabel?: boolean
  }>(),
  {
    variant: 'outline',
    size: 'sm',
    showLabel: true,
  },
)

const isOpen = ref(false)
const { availableWidgets, addWidget, getWidgetMeta } = useGmDashboardWidgets()

function handleAdd(id: GmWidgetId) {
  const meta = getWidgetMeta(id)
  addWidget(id)
  isOpen.value = false
  toast.success(`Added "${meta?.title ?? id}" to dashboard`)
}
</script>

<template>
  <Popover v-model:open="isOpen">
    <PopoverTrigger as-child>
      <slot>
        <Button
          :variant="props.variant"
          :size="props.size"
          class="gap-1.5"
          :disabled="availableWidgets.length === 0"
        >
          <Icon name="lucide:plus" class="size-4" />
          <span v-if="props.showLabel">Add Widget</span>
          <span
            v-if="availableWidgets.length > 0"
            class="ml-1 rounded-full bg-primary/10 px-1.5 py-0.2 text-[10px] font-semibold text-primary"
          >
            {{ availableWidgets.length }}
          </span>
        </Button>
      </slot>
    </PopoverTrigger>

    <PopoverContent align="end" class="w-80 p-3 shadow-md">
      <div class="mb-2.5 flex items-center justify-between border-b pb-2">
        <div class="font-semibold text-xs text-foreground">
          Available Widgets ({{ availableWidgets.length }})
        </div>
        <span class="text-[11px] text-muted-foreground">Click to add</span>
      </div>

      <div v-if="availableWidgets.length === 0" class="py-6 text-center text-xs text-muted-foreground">
        All available widgets are already on your dashboard.
      </div>

      <div v-else class="flex max-h-72 flex-col gap-1.5 overflow-y-auto pr-0.5">
        <button
          v-for="widget in availableWidgets"
          :key="widget.id"
          type="button"
          class="group flex items-start gap-2.5 rounded-lg border border-transparent p-2 text-left transition-colors hover:border-border hover:bg-accent/60"
          @click="handleAdd(widget.id)"
        >
          <div class="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Icon :name="widget.icon" class="size-3.5" />
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center justify-between">
              <span class="font-medium text-xs text-foreground group-hover:text-primary">
                {{ widget.title }}
              </span>
              <Icon name="lucide:plus" class="size-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
            <p class="mt-0.5 text-[11px] leading-snug text-muted-foreground line-clamp-2">
              {{ widget.description }}
            </p>
          </div>
        </button>
      </div>
    </PopoverContent>
  </Popover>
</template>
