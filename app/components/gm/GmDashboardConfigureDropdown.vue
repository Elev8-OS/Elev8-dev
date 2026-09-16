<script setup lang="ts">
import type { GmSavedView } from '~/composables/useGmSavedViews'
import { ref } from 'vue'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import { Input } from '~/components/ui/input'
import { useGmDashboardWidgets } from '~/composables/useGmDashboardWidgets'
import { useGmSavedViews } from '~/composables/useGmSavedViews'

const widgets = useGmDashboardWidgets()
const views = useGmSavedViews()

// Save Dialog state
const isSaveDialogOpen = ref(false)
const newViewName = ref('')

function openSaveDialog() {
  const nextNum = views.savedViews.value.filter(v => !v.isDefault).length + 1
  newViewName.value = `Custom View ${nextNum}`
  isSaveDialogOpen.value = true
}

function handleConfirmSave() {
  if (newViewName.value.trim()) {
    views.saveCurrentAs(newViewName.value.trim())
    isSaveDialogOpen.value = false
    newViewName.value = ''
  }
}

// Rename Dialog state
const isRenameDialogOpen = ref(false)
const renameTargetId = ref<string | null>(null)
const renameViewName = ref('')

function startRename(view: GmSavedView) {
  renameTargetId.value = view.id
  renameViewName.value = view.name
  isRenameDialogOpen.value = true
}

function handleConfirmRename() {
  if (renameTargetId.value && renameViewName.value.trim()) {
    views.renameView(renameTargetId.value, renameViewName.value.trim())
    isRenameDialogOpen.value = false
    renameTargetId.value = null
    renameViewName.value = ''
  }
}
</script>

<template>
  <div>
    <DropdownMenu>
      <DropdownMenuTrigger as-child>
        <Button
          variant="outline"
          size="sm"
          class="gap-1.5 h-8 text-xs font-medium"
          aria-label="Configure dashboard"
        >
          <Icon name="lucide:sliders-horizontal" class="size-3.5 text-muted-foreground" />
          <span>Configure</span>
          <Badge
            v-if="widgets.isEditMode.value"
            variant="default"
            class="h-4 px-1.5 text-[10px] bg-sky-600 text-white"
          >
            Editing
          </Badge>
          <Badge
            v-else-if="views.activeView.value"
            variant="secondary"
            class="h-4 px-1.5 text-[10px] font-normal max-w-[110px] truncate"
          >
            {{ views.activeView.value.name }}
          </Badge>
          <Icon name="lucide:chevron-down" class="size-3 text-muted-foreground/70" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" class="w-72 p-1.5">
        <!-- 1. Edit Layout Toggle -->
        <DropdownMenuItem as-child>
          <button
            type="button"
            class="w-full flex items-center justify-between rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-accent text-left cursor-pointer"
            @click="widgets.isEditMode.value = !widgets.isEditMode.value"
          >
            <div class="flex items-center gap-2">
              <Icon
                :name="widgets.isEditMode.value ? 'lucide:check' : 'lucide:pencil'"
                class="size-3.5"
                :class="widgets.isEditMode.value ? 'text-sky-600 dark:text-sky-400' : 'text-muted-foreground'"
              />
              <div class="flex flex-col">
                <span class="font-semibold text-xs">
                  {{ widgets.isEditMode.value ? 'Done Editing Layout' : 'Edit Layout' }}
                </span>
                <span class="text-[10px] text-muted-foreground">
                  {{ widgets.isEditMode.value ? 'Exit drag and resize mode' : 'Drag & resize block grid' }}
                </span>
              </div>
            </div>
            <Badge
              v-if="widgets.isEditMode.value"
              class="h-4 px-1 text-[9px] bg-sky-600 text-white"
            >
              Active
            </Badge>
          </button>
        </DropdownMenuItem>

        <!-- 2. Add Widget Submenu -->
        <DropdownMenuSub>
          <DropdownMenuSubTrigger class="flex items-center gap-2 cursor-pointer py-1.5 text-xs">
            <Icon name="lucide:plus-circle" class="size-3.5 text-sky-600 dark:text-sky-400" />
            <div class="flex flex-col text-left">
              <span class="font-semibold text-xs">Add Widget</span>
              <span class="text-[10px] text-muted-foreground">
                {{ widgets.availableWidgets.value.length }} available
              </span>
            </div>
          </DropdownMenuSubTrigger>

          <DropdownMenuSubContent class="w-64 p-1">
            <div
              v-if="widgets.availableWidgets.value.length === 0"
              class="p-3 text-center text-xs text-muted-foreground"
            >
              All catalog widgets are already active.
            </div>
            <template v-else>
              <DropdownMenuLabel class="text-[10px] font-mono text-muted-foreground px-2 py-1">
                Available Widgets
              </DropdownMenuLabel>
              <DropdownMenuItem
                v-for="w in widgets.availableWidgets.value"
                :key="w.id"
                class="flex items-center gap-2.5 py-1.5 cursor-pointer"
                @click="widgets.addWidget(w.id)"
              >
                <div class="flex size-6 items-center justify-center rounded border border-border/60 bg-muted/40 shrink-0">
                  <Icon :name="w.icon" class="size-3.5 text-foreground" />
                </div>
                <div class="flex flex-col min-w-0">
                  <span class="text-xs font-medium truncate">{{ w.title }}</span>
                  <span class="text-[10px] text-muted-foreground capitalize">
                    {{ w.category.replace('_', ' ') }}
                  </span>
                </div>
              </DropdownMenuItem>
            </template>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator class="my-1" />

        <!-- 3. Saved Views Section -->
        <div class="px-2 py-1 flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
          <span class="flex items-center gap-1.5">
            <Icon name="lucide:bookmark" class="size-3" />
            Saved Views
          </span>
          <span
            v-if="views.isDirty.value"
            class="text-[10px] text-amber-600 dark:text-amber-400 font-normal"
          >
            Modified
          </span>
        </div>

        <div class="flex flex-col gap-0.5 max-h-48 overflow-y-auto">
          <div
            v-for="view in views.savedViews.value"
            :key="view.id"
            class="group/item flex items-center justify-between rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-accent cursor-pointer"
            :class="views.activeViewId.value === view.id ? 'bg-sky-50 dark:bg-sky-950/40 text-sky-900 dark:text-sky-100 font-medium' : 'text-foreground'"
            @click="views.loadView(view.id)"
          >
            <div class="flex items-center gap-2 min-w-0">
              <Icon
                :name="views.activeViewId.value === view.id ? 'lucide:check' : 'lucide:layout'"
                class="size-3.5 shrink-0"
                :class="views.activeViewId.value === view.id ? 'text-sky-600 dark:text-sky-400' : 'text-muted-foreground/60'"
              />
              <span class="truncate">{{ view.name }}</span>
              <Badge
                v-if="view.isDefault"
                variant="outline"
                class="text-[9px] h-3.5 px-1 text-muted-foreground shrink-0"
              >
                Default
              </Badge>
            </div>

            <!-- Action buttons for custom views (rename, delete) -->
            <div
              v-if="!view.isDefault"
              class="flex items-center gap-0.5 opacity-0 group-hover/item:opacity-100"
              @click.stop
            >
              <Button
                variant="ghost"
                size="icon"
                class="size-5 rounded hover:bg-muted"
                title="Rename view"
                @click="startRename(view)"
              >
                <Icon name="lucide:pencil" class="size-3 text-muted-foreground" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                class="size-5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                title="Delete view"
                @click="views.deleteView(view.id)"
              >
                <Icon name="lucide:trash-2" class="size-3" />
              </Button>
            </div>
          </div>
        </div>

        <!-- Saved Views Actions -->
        <div class="mt-1 flex flex-col gap-0.5 border-t pt-1">
          <!-- Update active custom view if modified -->
          <DropdownMenuItem
            v-if="views.canUpdateActiveView.value"
            class="text-xs cursor-pointer gap-2 text-amber-600 dark:text-amber-400 py-1.5"
            @click="views.updateActiveView()"
          >
            <Icon name="lucide:save" class="size-3.5" />
            Update "{{ views.activeView.value.name }}"
          </DropdownMenuItem>

          <!-- Save Current as New View -->
          <DropdownMenuItem
            class="text-xs cursor-pointer gap-2 py-1.5"
            @click="openSaveDialog()"
          >
            <Icon name="lucide:plus" class="size-3.5 text-muted-foreground" />
            Save current as new view...
          </DropdownMenuItem>
        </div>

        <DropdownMenuSeparator class="my-1" />

        <!-- 4. Reset to Default Layout -->
        <DropdownMenuItem
          class="text-xs cursor-pointer gap-2 text-muted-foreground hover:text-foreground py-1.5"
          :disabled="!widgets.isCustomized.value && views.activeViewId.value === 'default'"
          @click="views.resetToDefaultView()"
        >
          <Icon name="lucide:rotate-ccw" class="size-3.5" />
          Reset to default layout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>

    <!-- Save New View Dialog -->
    <Dialog :open="isSaveDialogOpen" @update:open="isSaveDialogOpen = $event">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Save Dashboard View</DialogTitle>
          <DialogDescription>
            Save the current widgets arrangement, column spans, and row block heights as a reusable view.
          </DialogDescription>
        </DialogHeader>

        <div class="py-2">
          <label for="view-name" class="block text-xs font-medium mb-1.5">View Name</label>
          <Input
            id="view-name"
            v-model="newViewName"
            placeholder="e.g. Operations Focus"
            class="h-9 text-sm"
            @keydown.enter="handleConfirmSave"
          />
        </div>

        <DialogFooter class="gap-2">
          <Button variant="outline" size="sm" @click="isSaveDialogOpen = false">
            Cancel
          </Button>
          <Button size="sm" class="bg-sky-600 hover:bg-sky-700 text-white" @click="handleConfirmSave">
            Save View
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Rename View Dialog -->
    <Dialog :open="isRenameDialogOpen" @update:open="isRenameDialogOpen = $event">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rename View</DialogTitle>
          <DialogDescription>
            Enter a new name for this saved dashboard view.
          </DialogDescription>
        </DialogHeader>

        <div class="py-2">
          <label for="rename-view-name" class="block text-xs font-medium mb-1.5">New View Name</label>
          <Input
            id="rename-view-name"
            v-model="renameViewName"
            placeholder="Enter view name"
            class="h-9 text-sm"
            @keydown.enter="handleConfirmRename"
          />
        </div>

        <DialogFooter class="gap-2">
          <Button variant="outline" size="sm" @click="isRenameDialogOpen = false">
            Cancel
          </Button>
          <Button size="sm" class="bg-sky-600 hover:bg-sky-700 text-white" @click="handleConfirmRename">
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
