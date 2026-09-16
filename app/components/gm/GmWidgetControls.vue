<script setup lang="ts">
import type { GmWidgetId, GmWidgetSpan } from '~/composables/useGmDashboardWidgets'
import { toast } from 'vue-sonner'
import { Button } from '~/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import {
  GM_WIDGET_HEIGHT_PRESETS,
  useGmDashboardWidgets,
} from '~/composables/useGmDashboardWidgets'

const props = withDefaults(
  defineProps<{
    widgetId: GmWidgetId
    colSpan: GmWidgetSpan
    height?: number
    isFirst?: boolean
    isLast?: boolean
    isEditMode: boolean
  }>(),
  {
    height: 360,
    isFirst: false,
    isLast: false,
  },
)

const {
  getWidgetMeta,
  setWidgetSpan,
  setWidgetHeight,
  removeWidget,
  addWidget,
} = useGmDashboardWidgets()

const meta = computed(() => getWidgetMeta(props.widgetId))

const spanLabels: Record<GmWidgetSpan, string> = {
  1: '1 col (1/12)',
  2: '2 cols (2/12)',
  3: '3 cols (1/4)',
  4: '4 cols (1/3)',
  5: '5 cols (5/12)',
  6: '6 cols (1/2)',
  7: '7 cols (7/12)',
  8: '8 cols (2/3)',
  9: '9 cols (3/4)',
  10: '10 cols (10/12)',
  11: '11 cols (11/12)',
  12: '12 cols (Full)',
}

const spanShortLabels: Record<GmWidgetSpan, string> = {
  1: '1/12',
  2: '2/12',
  3: '1/4',
  4: '1/3',
  5: '5/12',
  6: '1/2',
  7: '7/12',
  8: '2/3',
  9: '3/4',
  10: '10/12',
  11: '11/12',
  12: 'Full',
}

const heightLabels: Record<number, string> = {
  280: '1 Row Block',
  360: '2 Row Blocks',
  460: '3 Row Blocks',
  560: '4 Row Blocks',
}

const rowShortLabels: Record<number, string> = {
  280: '1 Row',
  360: '2 Rows',
  460: '3 Rows',
  560: '4 Rows',
}

const currentRowLabel = computed(() => {
  if (props.widgetId === 'kpis') {
    if (props.colSpan >= 7) {
      return '1 Row'
    }
    if (props.colSpan === 6) {
      return '2 Rows'
    }
    const h = props.height ?? 460
    if (h <= 300)
      return '2 Rows'
    if (h <= 500)
      return '3 Rows'
    return '4 Rows'
  }
  const h = props.height ?? 360
  if (h <= 300)
    return '1 Row'
  if (h <= 400)
    return '2 Rows'
  if (h <= 500)
    return '3 Rows'
  return '4 Rows'
})

function handleHeightChange(h: number) {
  setWidgetHeight(props.widgetId, h)
  toast.success(`Block height set to ${rowShortLabels[h] ?? `${h}px`}`)
}

function handleRemove() {
  const currentSpan = props.colSpan
  const currentHeight = props.height
  const title = meta.value?.title ?? props.widgetId
  removeWidget(props.widgetId)
  toast.info(`Removed "${title}"`, {
    action: {
      label: 'Undo',
      onClick: () => {
        addWidget(props.widgetId)
        setWidgetSpan(props.widgetId, currentSpan)
        if (currentHeight) {
          setWidgetHeight(props.widgetId, currentHeight)
        }
      },
    },
  })
}
</script>

<template>
  <div class="flex items-center w-full">
    <!-- Inline quick toolbar when Edit Mode is active -->
    <div
      v-if="props.isEditMode"
      class="widget-block-handle drag-handle flex w-full items-center justify-between gap-2 rounded-lg border border-sky-300/80 bg-background/95 dark:border-sky-600/60 dark:bg-sky-950/90 px-2.5 py-1 shadow-xs backdrop-blur-xs cursor-grab active:cursor-grabbing select-none transition-colors hover:bg-sky-50 dark:hover:bg-sky-900/60"
      title="Drag block to reposition in grid"
    >
      <div class="flex items-center gap-2 min-w-0">
        <!-- Draggable Grip Handle for this individual block -->
        <div
          class="flex size-6 shrink-0 items-center justify-center rounded border border-sky-300/80 bg-background text-sky-700 dark:border-sky-600/60 dark:text-sky-300 shadow-xs"
        >
          <Icon name="lucide:grip-vertical" class="size-3.5" />
        </div>

        <Icon :name="meta?.icon ?? 'lucide:layout'" class="size-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
        <span class="font-semibold text-xs text-sky-950 dark:text-sky-100 truncate">{{ meta?.title }}</span>
        <Badge variant="outline" class="text-[10px] px-1.5 py-0 h-4 border-sky-400/60 text-sky-700 dark:text-sky-300 font-mono shrink-0 bg-background/90">
          {{ props.colSpan }}/12 Columns · {{ currentRowLabel }}
        </Badge>
      </div>

      <div class="flex items-center gap-1.5 shrink-0" @mousedown.stop>
        <!-- Remove button -->
        <Button
          variant="ghost"
          size="icon"
          class="h-6 w-6 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          aria-label="Remove widget"
          @click="handleRemove"
        >
          <Icon name="lucide:trash-2" class="size-3.5" />
        </Button>
      </div>
    </div>

    <!-- Discreet more options dropdown when Edit Mode is inactive -->
    <div
      v-else
      class="opacity-0 transition-opacity duration-150 group-hover/widget:opacity-100 group-focus-within/widget:opacity-100"
    >
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button
            variant="ghost"
            size="icon"
            class="h-7 w-7 rounded-md border border-border/50 bg-background/80 text-muted-foreground shadow-xs backdrop-blur-xs hover:border-border hover:bg-background hover:text-foreground"
            aria-label="Widget options"
          >
            <Icon name="lucide:more-horizontal" class="size-4" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" class="w-48">
          <DropdownMenuLabel class="text-xs text-muted-foreground">
            {{ meta?.title }}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          <!-- Submenu to change width directly -->
          <DropdownMenuSub v-if="(meta?.allowedSpans.length ?? 0) > 1">
            <DropdownMenuSubTrigger class="text-xs gap-2">
              <Icon name="lucide:columns-2" class="size-3.5 text-muted-foreground" />
              Width: {{ spanShortLabels[props.colSpan] }}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent class="w-40">
              <DropdownMenuRadioGroup
                :model-value="String(props.colSpan)"
                @update:model-value="setWidgetSpan(props.widgetId, Number($event) as GmWidgetSpan)"
              >
                <DropdownMenuRadioItem
                  v-for="span in meta?.allowedSpans"
                  :key="span"
                  :value="String(span)"
                  class="text-xs"
                >
                  {{ spanLabels[span] }}
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <!-- Submenu to change height directly -->
          <DropdownMenuSub>
            <DropdownMenuSubTrigger class="text-xs gap-2">
              <Icon name="lucide:chevrons-up-down" class="size-3.5 text-muted-foreground" />
              Height: {{ currentRowLabel }}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent class="w-44">
              <DropdownMenuRadioGroup
                :model-value="String(props.height)"
                @update:model-value="handleHeightChange(Number($event))"
              >
                <DropdownMenuRadioItem
                  v-for="h in GM_WIDGET_HEIGHT_PRESETS"
                  :key="h"
                  :value="String(h)"
                  class="text-xs"
                >
                  {{ heightLabels[h] }}
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSeparator />

          <!-- Remove option -->
          <DropdownMenuItem
            class="text-xs gap-2 text-destructive focus:bg-destructive/10 focus:text-destructive"
            @click="handleRemove"
          >
            <Icon name="lucide:trash-2" class="size-3.5" />
            Remove widget
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </div>
</template>
