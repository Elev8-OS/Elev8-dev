<script setup lang="ts">
import type { GuideContentItem, GuideContentKind } from '~/components/listings/data/guest-guide-content'
import type { PropertyPickerOption } from '~/components/shared/PropertyPicker.vue'
import { toast } from 'vue-sonner'
import { cleanGuideItems, cloneGuideItems, GUIDE_CONTENT_META, listingGuideItems } from '~/components/listings/data/guest-guide-content'
import { listings } from '~/components/listings/data/listings'
import GuideItemsEditor from '~/components/listings/guest-guide/GuideItemsEditor.vue'
import PropertyPicker from '~/components/shared/PropertyPicker.vue'
import { useGuideContentTemplates } from '~/composables/useGuideContentTemplates'
import { useListingGuideContent } from '~/composables/useListingGuideContent'

/**
 * Edits one kind of a listing's guest guide content on a draft; nothing is
 * written until Save. Import (a template or another listing) fills the draft
 * as a copy. Copy to listings writes the other listings straight away, from
 * the draft as it stands, replacing that kind on them.
 */
const props = defineProps<{ kind: GuideContentKind, items: GuideContentItem[], listingId: string, listingName: string }>()
const emit = defineEmits<{ save: [items: GuideContentItem[]] }>()
const open = defineModel<boolean>('open', { default: false })

const meta = computed(() => GUIDE_CONTENT_META[props.kind])

const draft = ref<GuideContentItem[]>([])

watch(open, (isOpen) => {
  if (isOpen)
    draft.value = JSON.parse(JSON.stringify(props.items))
}, { immediate: true })

const itemCount = computed(() => cleanGuideItems(draft.value).length)

const { templatesOf, defaultTemplateOf, getTemplate } = useGuideContentTemplates()
const { listingsWith, copyToListings } = useListingGuideContent()

const templates = computed(() => templatesOf(props.kind))
const defaultTemplate = computed(() => defaultTemplateOf(props.kind))

function useDefaultTemplate() {
  if (defaultTemplate.value)
    draft.value = cloneGuideItems(defaultTemplate.value.items)
}

// --- Import ------------------------------------------------------------------

type ImportSource = 'template' | 'listing'
const importOpen = ref(false)
const importSource = ref<ImportSource>('template')
const importMode = ref<'replace' | 'append'>('replace')
const importTemplateId = ref('')
const importListingId = ref('')

const importListings = computed(() => listingsWith(props.kind).filter(l => l.id !== props.listingId))

const importItems = computed<GuideContentItem[]>(() => {
  if (importSource.value === 'template')
    return getTemplate(importTemplateId.value)?.items ?? []
  return listingGuideItems(listings.value.find(l => l.id === importListingId.value), props.kind)
})

function openImport() {
  importSource.value = 'template'
  importMode.value = itemCount.value ? 'append' : 'replace'
  importTemplateId.value = defaultTemplate.value?.id ?? ''
  importListingId.value = ''
  importOpen.value = true
}

function applyImport() {
  const imported = cloneGuideItems(importItems.value)
  draft.value = importMode.value === 'replace' ? imported : [...draft.value, ...imported]
  importOpen.value = false
  toast.success(`Imported ${imported.length} ${imported.length === 1 ? meta.value.noun : `${meta.value.noun}s`}. Save to keep them.`)
}

// --- Copy to other listings ---------------------------------------------------

const copyOpen = ref(false)
const copyTargets = ref<string[]>([])

const copyOptions = computed<PropertyPickerOption[]>(() =>
  listings.value
    .filter(l => l.id !== props.listingId)
    .map(l => ({ id: l.id, name: l.name, city: l.location, region: '' })),
)

function openCopy() {
  copyTargets.value = []
  copyOpen.value = true
}

function applyCopy() {
  const count = copyToListings(props.kind, cleanGuideItems(draft.value), copyTargets.value)
  copyOpen.value = false
  toast.success(`${meta.value.label} copied to ${count} ${count === 1 ? 'listing' : 'listings'}`)
}

function save() {
  emit('save', cleanGuideItems(draft.value))
  open.value = false
}
</script>

<template>
  <Sheet v-model:open="open">
    <SheetContent class="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
      <SheetHeader class="border-b p-5">
        <SheetTitle>{{ meta.label }}</SheetTitle>
        <SheetDescription>
          {{ meta.description }} Shown in the guest guide of {{ listingName }}.
        </SheetDescription>
      </SheetHeader>

      <div class="flex min-h-0 flex-1 flex-col overflow-y-auto p-5">
        <GuideItemsEditor v-model="draft" :kind="kind">
          <template #empty>
            <Button v-if="defaultTemplate" size="sm" data-testid="guide-use-template" @click="useDefaultTemplate">
              Use {{ defaultTemplate.name }}
            </Button>
          </template>
          <template #toolbar>
            <Button variant="outline" size="sm" class="h-8 gap-1.5 text-xs" data-testid="guide-import" @click="openImport">
              <Icon name="lucide:import" class="size-3.5" />
              Import
            </Button>
            <Button variant="outline" size="sm" class="h-8 gap-1.5 text-xs" :disabled="itemCount === 0" data-testid="guide-copy" @click="openCopy">
              <Icon name="lucide:copy" class="size-3.5" />
              Copy to listings
            </Button>
          </template>
        </GuideItemsEditor>
      </div>

      <SheetFooter class="flex-row items-center justify-between gap-2 border-t p-4">
        <span class="text-xs text-muted-foreground">
          {{ itemCount }} {{ itemCount === 1 ? meta.noun : `${meta.noun}s` }}
        </span>
        <div class="flex gap-2">
          <Button variant="outline" @click="open = false">
            Cancel
          </Button>
          <Button data-testid="guide-save" @click="save">
            Save
          </Button>
        </div>
      </SheetFooter>
    </SheetContent>

    <Dialog v-model:open="importOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import {{ meta.label.toLowerCase() }}</DialogTitle>
          <DialogDescription>Fills this editor. Nothing is saved until you press Save.</DialogDescription>
        </DialogHeader>
        <div class="flex flex-col gap-4 py-1">
          <div class="inline-flex w-fit rounded-lg border bg-muted/40 p-0.5 text-xs">
            <button
              v-for="src in (['template', 'listing'] as const)"
              :key="src"
              type="button"
              class="rounded-md px-3 py-1 font-medium transition-all"
              :class="importSource === src ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'"
              :data-testid="`guide-import-source-${src}`"
              @click="importSource = src"
            >
              {{ src === 'template' ? 'Template' : 'Another listing' }}
            </button>
          </div>

          <div v-if="importSource === 'template'" class="flex flex-col gap-1.5">
            <Label class="text-xs">Template</Label>
            <Select v-model="importTemplateId">
              <SelectTrigger class="w-full">
                <SelectValue placeholder="Choose a template" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="t in templates" :key="t.id" :value="t.id">
                  {{ t.name }}{{ t.isDefault ? ' (default)' : '' }}
                </SelectItem>
              </SelectContent>
            </Select>
            <p class="text-xs text-muted-foreground">
              Manage templates in
              <NuxtLink to="/settings/guide-templates" class="font-medium underline">
                Settings
              </NuxtLink>.
            </p>
          </div>
          <div v-else class="flex flex-col gap-1.5">
            <Label class="text-xs">Listing</Label>
            <Select v-model="importListingId">
              <SelectTrigger class="w-full">
                <SelectValue placeholder="Choose a listing" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="l in importListings" :key="l.id" :value="l.id">
                  {{ l.name }}
                </SelectItem>
              </SelectContent>
            </Select>
            <p v-if="!importListings.length" class="text-xs text-muted-foreground">
              No other listing has {{ meta.label.toLowerCase() }} yet.
            </p>
          </div>

          <div v-if="importItems.length" class="grid grid-cols-2 gap-2">
            <button
              v-for="mode in (['replace', 'append'] as const)"
              :key="mode"
              type="button"
              class="rounded-lg border p-2 text-left text-xs transition-all"
              :class="importMode === mode ? 'border-primary bg-primary/5 font-semibold' : 'text-muted-foreground hover:text-foreground'"
              @click="importMode = mode"
            >
              {{ mode === 'replace' ? 'Replace current' : 'Add after current' }}
            </button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="importOpen = false">
            Cancel
          </Button>
          <Button :disabled="!importItems.length" data-testid="guide-import-apply" @click="applyImport">
            Import {{ importItems.length || '' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="copyOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Copy to other listings</DialogTitle>
          <DialogDescription>
            Copies these {{ itemCount }} {{ itemCount === 1 ? meta.noun : `${meta.noun}s` }}, as they are in the editor now. The listings you pick lose their current {{ meta.label.toLowerCase() }}.
          </DialogDescription>
        </DialogHeader>
        <div class="py-1">
          <PropertyPicker v-model="copyTargets" :options="copyOptions" />
        </div>
        <DialogFooter>
          <Button variant="outline" @click="copyOpen = false">
            Cancel
          </Button>
          <Button :disabled="!copyTargets.length" data-testid="guide-copy-apply" @click="applyCopy">
            Copy to {{ copyTargets.length }} {{ copyTargets.length === 1 ? 'listing' : 'listings' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </Sheet>
</template>
