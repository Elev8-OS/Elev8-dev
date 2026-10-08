<script setup lang="ts">
import { Icon } from '#components'
import { computed, nextTick, ref } from 'vue'
import DeleteViewDialog from '~/components/listings/DeleteViewDialog.vue'
import UnsavedChangesDialog from '~/components/listings/UnsavedChangesDialog.vue'
import { Button } from '~/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '~/components/ui/dropdown-menu'
import { Input } from '~/components/ui/input'
import { ScrollArea } from '~/components/ui/scroll-area'

/**
 * Only what the menu reads, so any page's view shape fits (Listings, Review
 * Hub analytics, Analytics) without a cast.
 */
interface ViewLike {
  id: string
  name: string
  /** The immutable Default View: no rename, delete or update. */
  isDefault?: boolean
}

const props = defineProps<{
  savedViews: ViewLike[]
  activeView: ViewLike | null
  isDirty: boolean
  isLoading: boolean
  canUpdateActiveView: boolean
  pendingViewId?: string | null
}>()

const emit = defineEmits<{
  'load-view': [viewId: string]
  'save-as': [name: string]
  'update': []
  'delete': [viewId: string]
  'rename': [viewId: string, newName: string]
  'reset': []
  'confirm-load': []
  /** The unsaved-changes prompt was dismissed; the parent clears its pending view. */
  'cancelLoad': []
}>()

const viewSearch = ref('')
const deleteTarget = ref<ViewLike | null>(null)
const renameTarget = ref<ViewLike | null>(null)
const saveMode = ref(false)
const newViewName = ref('')
// Template refs on the shadcn `Input` hold the component, not the element;
// `focusAndSelect` reaches the `<input>` through `$el` either way.
const saveInputRef = ref<HTMLInputElement | { $el: HTMLInputElement } | null>(null)
const renameInputRef = ref<HTMLInputElement | { $el: HTMLInputElement } | null>(null)

function focusAndSelect(target: HTMLInputElement | { $el: HTMLInputElement } | null) {
  const el = target && '$el' in target ? target.$el : target
  el?.focus()
  el?.select()
}

const pendingTarget = computed(() => {
  return props.pendingViewId ? props.savedViews.find(v => v.id === props.pendingViewId) || null : null
})

function getNextViewNumber(): number {
  const existingNumbers = props.savedViews
    .filter(v => !v.isDefault && v.name.match(/^New View (\d+)$/))
    .map(v => Number.parseInt(v.name.replace(/^New View (\d+)$/, '$1'), 10))

  if (existingNumbers.length === 0)
    return 1

  return Math.max(...existingNumbers) + 1
}

function startSaveMode() {
  saveMode.value = true
  newViewName.value = `New View ${getNextViewNumber()}`

  nextTick(() => {
    focusAndSelect(saveInputRef.value)
  })
}

function confirmSave() {
  if (newViewName.value.trim().length === 0 || newViewName.value.trim().length > 50) {
    saveMode.value = false
    return
  }

  emit('save-as', newViewName.value.trim())
  saveMode.value = false
  newViewName.value = ''
}

function cancelSave() {
  saveMode.value = false
  newViewName.value = ''
}

function startRename(view: ViewLike) {
  renameTarget.value = { ...view, name: view.name }

  nextTick(() => {
    focusAndSelect(renameInputRef.value)
  })
}

function confirmRename() {
  if (!renameTarget.value || renameTarget.value.name.trim().length === 0 || renameTarget.value.name.trim().length > 50) {
    cancelRename()
    return
  }

  emit('rename', renameTarget.value.id, renameTarget.value.name.trim())
  renameTarget.value = null
}

function cancelRename() {
  renameTarget.value = null
}

function handleSaveKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter')
    confirmSave()
  else if (e.key === 'Escape')
    cancelSave()
}

function handleRenameKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter')
    confirmRename()
  else if (e.key === 'Escape')
    cancelRename()
}

const filteredViews = computed(() => {
  if (!viewSearch.value)
    return props.savedViews
  const q = viewSearch.value.toLowerCase()
  return props.savedViews.filter(v => v.name.toLowerCase().includes(q))
})

function handleLoadView(viewId: string) {
  emit('load-view', viewId)
}
</script>

<template>
  <div class="flex items-center gap-2">
    <DropdownMenu>
      <DropdownMenuTrigger as-child>
        <Button variant="outline" size="sm" class="h-9 gap-1.5 text-xs">
          <Icon name="lucide:bookmark" class="size-3.5" />
          {{ activeView ? `Saved Views: ${activeView.name}` : 'Saved Views' }}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent class="w-72" align="end">
        <DropdownMenuItem
          v-if="canUpdateActiveView"
          @click="emit('update')"
        >
          <Icon name="lucide:refresh-cw" class="mr-2 size-3.5" />
          Update current view
        </DropdownMenuItem>

        <DropdownMenuItem
          v-if="isDirty && activeView"
          @click="emit('reset')"
        >
          <Icon name="lucide:rotate-ccw" class="mr-2 size-3.5" />
          Reset View
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <ScrollArea class="h-72">
          <div v-if="filteredViews.length === 0" class="px-2 py-4 text-sm text-muted-foreground text-center">
            {{ savedViews.length === 0 ? 'No saved views yet.' : 'No views found.' }}
          </div>

          <div v-else class="p-1 space-y-0.5">
            <!-- Search -->
            <Input
              v-model="viewSearch"
              placeholder="Search views..."
              class="h-7 text-xs mb-1"
            />

            <!-- Save mode: inline input -->
            <div v-if="saveMode" class="px-2 py-1.5 space-y-1 border-b">
              <Input
                ref="saveInputRef"
                v-model="newViewName"
                placeholder="View name"
                class="h-7 text-sm"
                maxlength="50"
                @keydown="handleSaveKeydown"
              />
              <div class="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  class="h-7 flex-1"
                  @click="cancelSave"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  class="h-7 flex-1"
                  :disabled="newViewName.trim().length === 0"
                  @click="confirmSave"
                >
                  Save
                </Button>
              </div>
            </div>

            <!-- Normal mode: save as option -->
            <div
              v-else
              class="flex items-center gap-2 px-2 py-1.5 text-sm cursor-pointer hover:bg-accent rounded-sm"
              data-testid="save-as-option"
              @click="startSaveMode"
            >
              <Icon name="lucide:plus" class="size-3.5" />
              Save view as...
            </div>

            <DropdownMenuItem
              v-for="view in filteredViews"
              :key="view.id"
              class="group flex items-center justify-between py-2"
              :class="{ 'bg-muted': activeView?.id === view.id }"
              :data-testid="`view-item-${view.id}`"
              @click="handleLoadView(view.id)"
            >
              <div class="flex items-center gap-2 min-w-0 flex-1">
                <Icon
                  v-if="view.isDefault"
                  name="lucide:lock"
                  class="size-3.5 shrink-0 text-muted-foreground"
                  title="Default view (immutable)"
                />
                <Icon
                  v-else-if="activeView?.id === view.id"
                  name="lucide:check"
                  class="size-4 shrink-0 text-primary"
                />
                <Icon
                  v-else
                  name="lucide:bookmark"
                  class="size-3.5 shrink-0 text-muted-foreground"
                />

                <!-- Renaming mode: inline input -->
                <Input
                  v-if="renameTarget?.id === view.id"
                  :ref="el => { if (el && renameTarget?.id === view.id) renameInputRef = el as any }"
                  v-model="renameTarget.name"
                  class="h-6 text-sm max-w-32"
                  maxlength="50"
                  @keydown.stop="handleRenameKeydown"
                  @click.stop
                />

                <!-- Normal mode: view name -->
                <div v-else class="min-w-0 flex-1">
                  <div class="font-medium text-sm truncate">
                    {{ view.name }}
                  </div>
                </div>
              </div>
              <div v-if="!view.isDefault" class="flex items-center gap-0.5">
                <!-- Renaming mode: check/cancel buttons -->
                <Button
                  v-if="renameTarget?.id === view.id"
                  variant="ghost"
                  size="icon"
                  class="size-7"
                  @click.stop="confirmRename"
                >
                  <Icon name="lucide:check" class="size-3.5" />
                </Button>
                <Button
                  v-if="renameTarget?.id === view.id"
                  variant="ghost"
                  size="icon"
                  class="size-7"
                  @click.stop="cancelRename"
                >
                  <Icon name="lucide:x" class="size-3.5" />
                </Button>

                <!-- Normal mode: edit and delete buttons -->
                <Button
                  v-show="!renameTarget || renameTarget?.id !== view.id"
                  variant="ghost"
                  size="icon"
                  class="size-7 opacity-0 group-hover:opacity-100 transition-opacity"
                  @click.stop="startRename(view)"
                >
                  <Icon name="lucide:edit-2" class="size-3.5" />
                </Button>
                <Button
                  v-show="!renameTarget || renameTarget?.id !== view.id"
                  variant="ghost"
                  size="icon"
                  class="size-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                  @click.stop="deleteTarget = view"
                >
                  <Icon name="lucide:trash-2" class="size-3.5" />
                </Button>
              </div>
            </DropdownMenuItem>
          </div>
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>

    <Button
      v-if="canUpdateActiveView"
      variant="outline"
      size="sm"
      class="h-9 gap-1.5 text-xs"
      :disabled="isLoading"
      @click="emit('update')"
    >
      <Icon name="lucide:refresh-cw" class="size-3.5" />
      Update current view
    </Button>

    <Button
      v-if="isDirty && activeView && !activeView.isDefault"
      variant="outline"
      size="sm"
      class="h-9 gap-1.5 text-xs"
      :disabled="isLoading"
      @click="emit('reset')"
    >
      <Icon name="lucide:rotate-ccw" class="size-3.5" />
      Reset View
    </Button>

    <DeleteViewDialog
      v-if="deleteTarget"
      :open="!!deleteTarget"
      :view-name="deleteTarget.name"
      @update:open="deleteTarget = null"
      @delete="emit('delete', deleteTarget.id)"
    />

    <UnsavedChangesDialog
      v-if="pendingTarget"
      :open="!!pendingTarget"
      :target-view-name="pendingTarget.name"
      @update:open="(open: boolean) => !open && emit('cancelLoad')"
      @confirm="emit('confirm-load')"
      @cancel="emit('cancelLoad')"
    />
  </div>
</template>
