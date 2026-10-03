<script setup lang="ts">
import type { GuideContentItem, GuideContentKind } from '~/components/listings/data/guest-guide-content'
import { VueDraggable } from 'vue-draggable-plus'
import { toast } from 'vue-sonner'
import { GOOD_TO_KNOW_ICONS, GUIDE_CONTENT_META, GUIDE_PHOTO_MAX_BYTES, GUIDE_PHOTO_TYPES, newGuideItemId } from '~/components/listings/data/guest-guide-content'
import RichTextEditor from '~/components/shared/RichTextEditor.vue'

/**
 * Edits one kind of guest guide content in place (`v-model`): check-in or
 * check-out steps, house rules, Good to Know. Items reorder by drag handle (or
 * the arrow keys on it) and expand for their text, plus a photo for steps or
 * an icon for Good to Know. Used by the listing's Guest Guide tab and by
 * Settings > Guest Guide > Content Templates.
 *
 * Slots: `toolbar` (beside Expand/Collapse all) and `empty` (actions shown
 * while the list is empty, beside Add).
 */
const props = defineProps<{ kind: GuideContentKind }>()
const items = defineModel<GuideContentItem[]>({ required: true })

const meta = computed(() => GUIDE_CONTENT_META[props.kind])

const openItems = ref<Set<string>>(new Set())
let knownIds = new Set(items.value.map(i => i.id))

// A new item (added, imported, a template applied) opens on its own.
watch(() => items.value.map(i => i.id), (ids) => {
  const fresh = ids.filter(id => !knownIds.has(id))
  knownIds = new Set(ids)
  if (fresh.length)
    openItems.value = new Set([...openItems.value, ...fresh])
})

const allOpen = computed(() => items.value.length > 0 && items.value.every(i => openItems.value.has(i.id)))

function toggleItem(id: string) {
  const next = new Set(openItems.value)
  if (next.has(id))
    next.delete(id)
  else next.add(id)
  openItems.value = next
}

function toggleAll() {
  openItems.value = allOpen.value ? new Set() : new Set(items.value.map(i => i.id))
}

function addItem() {
  items.value = [...items.value, { id: newGuideItemId(), title: '', ...(props.kind === 'good_to_know' ? { icon: 'lucide:info' } : {}) }]
}

function update(id: string, patch: Partial<GuideContentItem>) {
  items.value = items.value.map(i => i.id === id ? { ...i, ...patch } : i)
}

function remove(id: string) {
  items.value = items.value.filter(i => i.id !== id)
}

function move(index: number, delta: -1 | 1) {
  if (index + delta < 0 || index + delta >= items.value.length)
    return
  const next = [...items.value]
  const [moved] = next.splice(index, 1)
  next.splice(index + delta, 0, moved!)
  items.value = next
}

function uploadPhoto(id: string, event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file)
    return
  if (!GUIDE_PHOTO_TYPES.includes(file.type)) {
    toast.error('Use a PNG, JPG or WebP image')
    return
  }
  if (file.size > GUIDE_PHOTO_MAX_BYTES) {
    toast.error('Photo must be less than 2MB')
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    if (typeof reader.result === 'string')
      update(id, { photoUrl: reader.result })
  }
  reader.readAsDataURL(file)
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div
      v-if="items.length === 0"
      class="flex flex-col items-center gap-3 rounded-lg border border-dashed px-4 py-10 text-center"
      data-testid="guide-items-empty"
    >
      <Icon :name="meta.icon" class="size-8 text-muted-foreground" />
      <p class="text-sm text-muted-foreground">
        No {{ meta.label.toLowerCase() }} yet. Start from a template, or add your own.
      </p>
      <div class="flex flex-wrap justify-center gap-2">
        <slot name="empty" />
        <Button size="sm" variant="outline" @click="addItem">
          <Icon name="lucide:plus" class="size-3.5" />
          Add {{ meta.noun }}
        </Button>
      </div>
    </div>

    <div class="flex flex-wrap items-center justify-between gap-2">
      <div class="flex flex-wrap gap-2">
        <slot name="toolbar" />
      </div>
      <Button v-if="items.length" variant="ghost" size="sm" class="h-7 gap-1 px-2 text-xs" @click="toggleAll">
        <Icon :name="allOpen ? 'lucide:chevrons-down-up' : 'lucide:chevrons-up-down'" class="size-3.5" />
        {{ allOpen ? 'Collapse all' : 'Expand all' }}
      </Button>
    </div>

    <VueDraggable v-model="items" handle=".guide-item-handle" :animation="150" ghost-class="opacity-40" class="flex flex-col gap-2">
      <div
        v-for="(item, index) in items"
        :key="item.id"
        class="overflow-hidden rounded-lg border bg-muted/20"
        data-testid="guide-item"
      >
        <div class="flex items-center gap-1 px-2 py-2">
          <button
            type="button"
            class="guide-item-handle flex size-8 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-muted active:cursor-grabbing"
            :aria-label="`Reorder ${meta.noun} ${index + 1}: drag, or use the arrow keys`"
            data-testid="guide-item-handle"
            @keydown.up.prevent="move(index, -1)"
            @keydown.down.prevent="move(index, 1)"
          >
            <Icon name="lucide:grip-vertical" class="size-4" />
          </button>
          <span v-if="meta.numbered" class="w-5 shrink-0 text-center text-xs font-semibold text-muted-foreground">{{ index + 1 }}</span>
          <Icon v-else-if="meta.iconPicker" :name="item.icon || 'lucide:info'" class="size-4 shrink-0 text-muted-foreground" />
          <Input
            :model-value="item.title"
            :placeholder="meta.titlePlaceholder"
            class="h-8 flex-1 bg-background text-sm"
            :aria-label="`${meta.noun} ${index + 1} title`"
            data-testid="guide-item-title"
            @update:model-value="update(item.id, { title: String($event) })"
          />
          <Icon v-if="item.photoUrl && !openItems.has(item.id)" name="lucide:image" class="size-3.5 shrink-0 text-muted-foreground" />
          <Button
            variant="ghost"
            size="icon"
            class="size-8 shrink-0"
            :aria-label="openItems.has(item.id) ? 'Collapse' : 'Expand'"
            :aria-expanded="openItems.has(item.id)"
            data-testid="guide-item-toggle"
            @click="toggleItem(item.id)"
          >
            <Icon :name="openItems.has(item.id) ? 'lucide:chevron-up' : 'lucide:chevron-down'" class="size-4 text-muted-foreground" />
          </Button>
          <Button variant="ghost" size="icon" class="size-8 shrink-0 text-muted-foreground hover:text-destructive" :aria-label="`Delete ${meta.noun}`" @click="remove(item.id)">
            <Icon name="lucide:trash-2" class="size-3.5" />
          </Button>
        </div>

        <div v-if="openItems.has(item.id)" class="flex flex-col gap-3 border-t bg-background p-3" data-testid="guide-item-body">
          <RichTextEditor
            :model-value="item.text ?? ''"
            :placeholder="meta.textPlaceholder"
            :aria-label="`${meta.noun} ${index + 1} details`"
            @update:model-value="update(item.id, { text: $event })"
          />

          <div v-if="meta.photo" class="flex items-center gap-3">
            <div class="flex aspect-video w-28 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
              <img v-if="item.photoUrl" :src="item.photoUrl" alt="" class="size-full object-cover" data-testid="guide-item-photo">
              <Icon v-else name="lucide:image" class="size-5 text-muted-foreground" />
            </div>
            <label class="inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-muted">
              <Icon name="lucide:upload" class="size-3.5" />
              {{ item.photoUrl ? 'Replace photo' : 'Add photo' }}
              <input type="file" accept="image/png,image/jpeg,image/webp" class="hidden" data-testid="guide-item-photo-input" @change="uploadPhoto(item.id, $event)">
            </label>
            <Button v-if="item.photoUrl" variant="ghost" size="sm" class="h-7 text-xs text-muted-foreground" @click="update(item.id, { photoUrl: undefined })">
              Remove
            </Button>
          </div>

          <div v-if="meta.iconPicker" class="flex flex-wrap gap-1" role="radiogroup" aria-label="Icon">
            <button
              v-for="icon in GOOD_TO_KNOW_ICONS"
              :key="icon"
              type="button"
              role="radio"
              :aria-checked="(item.icon || 'lucide:info') === icon"
              :aria-label="icon.replace('lucide:', '')"
              class="flex size-8 items-center justify-center rounded-md border transition-colors"
              :class="(item.icon || 'lucide:info') === icon ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted'"
              data-testid="guide-item-icon"
              @click="update(item.id, { icon })"
            >
              <Icon :name="icon" class="size-4" />
            </button>
          </div>
        </div>
      </div>
    </VueDraggable>

    <Button v-if="items.length" variant="outline" size="sm" class="w-fit gap-1.5" data-testid="guide-item-add" @click="addItem">
      <Icon name="lucide:plus" class="size-3.5" />
      Add {{ meta.noun }}
    </Button>
  </div>
</template>
