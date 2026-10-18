<script setup lang="ts">
import type { Listing } from '~/components/listings/data/listings'
import { toast } from 'vue-sonner'
import { deleteTag, renameTag, tagCreateError, tagRenameError, tagUsage } from '~/components/listings/data/listing-tags'
import { allTags } from '~/components/listings/data/listings'

/**
 * Edit or delete the tags that already exist. A tag is shared by every listing
 * that has it, so a change reaches all of them; the delete asks first. A new
 * tag is added to `listing` (a tag exists only on listings), emitted as `update`.
 */
const props = defineProps<{ listing: Listing }>()
const emit = defineEmits<{ update: [listing: Listing] }>()
const open = defineModel<boolean>('open', { default: false })

const search = ref('')
const newTag = ref('')
const createError = computed(() => newTag.value.trim() ? tagCreateError(newTag.value) : null)

function addTag() {
  const name = newTag.value.trim()
  if (!name || tagCreateError(name))
    return
  emit('update', { ...props.listing, tags: [...props.listing.tags, name] })
  toast.success(`"${name}" added to ${props.listing.name}`)
  newTag.value = ''
}
const shown = computed(() => {
  const q = search.value.trim().toLowerCase()
  return allTags.value.filter(t => !q || t.toLowerCase().includes(q))
})

const editing = ref<string | null>(null)
const draft = ref('')
const error = computed(() => editing.value ? tagRenameError(editing.value, draft.value) : null)
const deleting = ref<string | null>(null)

watch(open, (isOpen) => {
  if (isOpen)
    return
  search.value = ''
  newTag.value = ''
  editing.value = null
  deleting.value = null
})

function startEdit(tag: string) {
  editing.value = tag
  draft.value = tag
}

function saveEdit() {
  const from = editing.value
  if (!from || error.value)
    return
  const to = draft.value.trim()
  if (to !== from) {
    const n = renameTag(from, to)
    toast.success(`"${from}" renamed to "${to}" on ${n} ${n === 1 ? 'listing' : 'listings'}`)
  }
  editing.value = null
}

function confirmDelete() {
  const tag = deleting.value
  if (!tag)
    return
  const n = deleteTag(tag)
  toast.success(`"${tag}" removed from ${n} ${n === 1 ? 'listing' : 'listings'}`)
  deleting.value = null
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Manage tags</DialogTitle>
        <DialogDescription>
          Renaming or deleting a tag changes every listing that has it. Saved views and calendar filters that use the old name are not updated.
        </DialogDescription>
      </DialogHeader>

      <form class="flex flex-col gap-1" @submit.prevent="addTag">
        <div class="flex items-center gap-2">
          <Input v-model="newTag" class="h-9" placeholder="New tag" aria-label="New tag" maxlength="30" :aria-invalid="!!createError" data-testid="tag-new-input" />
          <Button type="submit" size="sm" class="h-9 shrink-0 gap-1.5" :disabled="!newTag.trim() || !!createError" data-testid="tag-new-add">
            <Icon name="lucide:plus" class="size-3.5" />
            Add tag
          </Button>
        </div>
        <p v-if="createError" class="text-xs text-destructive" data-testid="tag-new-error">
          {{ createError }}
        </p>
        <p v-else class="text-xs text-muted-foreground">
          Added to {{ listing.name }}.
        </p>
      </form>

      <BaseSearchInput v-model="search" placeholder="Search tags..." class="sm:max-w-none" />

      <ScrollArea class="h-72 rounded-md border">
        <div class="flex flex-col p-1" data-testid="tag-manager-list">
          <div v-for="tag in shown" :key="tag" class="rounded-sm px-2 py-1.5 hover:bg-muted/50" :data-testid="`tag-row-${tag}`">
            <form v-if="editing === tag" class="flex flex-col gap-1" @submit.prevent="saveEdit">
              <div class="flex items-center gap-2">
                <Input
                  v-model="draft"
                  class="h-8 text-sm"
                  :aria-label="`New name for ${tag}`"
                  :aria-invalid="!!error"
                  maxlength="30"
                  autofocus
                  data-testid="tag-edit-input"
                  @keydown.esc.prevent.stop="editing = null"
                />
                <Button type="submit" size="sm" class="h-8" :disabled="!!error" data-testid="tag-edit-save">
                  Save
                </Button>
                <Button type="button" variant="ghost" size="sm" class="h-8" @click="editing = null">
                  Cancel
                </Button>
              </div>
              <p v-if="error && draft.trim() !== tag" class="text-xs text-destructive" data-testid="tag-edit-error">
                {{ error }}
              </p>
            </form>
            <div v-else class="flex items-center gap-2">
              <span class="min-w-0 flex-1 truncate text-sm">{{ tag }}</span>
              <span class="shrink-0 text-xs text-muted-foreground">{{ tagUsage(tag) }} {{ tagUsage(tag) === 1 ? 'listing' : 'listings' }}</span>
              <Button variant="ghost" size="icon" class="size-7" :aria-label="`Rename ${tag}`" data-testid="tag-edit" @click="startEdit(tag)">
                <Icon name="lucide:pencil" class="size-3.5" />
              </Button>
              <Button variant="ghost" size="icon" class="size-7 text-destructive hover:text-destructive" :aria-label="`Delete ${tag}`" data-testid="tag-delete" @click="deleting = tag">
                <Icon name="lucide:trash-2" class="size-3.5" />
              </Button>
            </div>
          </div>
          <p v-if="!shown.length" class="px-2 py-6 text-center text-sm text-muted-foreground">
            No tags found.
          </p>
        </div>
      </ScrollArea>

      <DialogFooter>
        <Button variant="outline" @click="open = false">
          Done
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <AlertDialog :open="!!deleting" @update:open="(v: boolean) => { if (!v) deleting = null }">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Delete "{{ deleting }}"?</AlertDialogTitle>
        <AlertDialogDescription>
          It is removed from {{ deleting ? tagUsage(deleting) : 0 }} {{ deleting && tagUsage(deleting) === 1 ? 'listing' : 'listings' }}. This cannot be undone.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction class="bg-destructive text-white hover:bg-destructive/90" data-testid="tag-delete-confirm" @click="confirmDelete">
          Delete
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
