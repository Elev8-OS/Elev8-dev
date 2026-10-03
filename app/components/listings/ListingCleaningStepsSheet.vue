<script setup lang="ts">
import type { CleaningStepSection } from '~/components/cleaning/data/cleaning-steps'
import type { PropertyPickerOption } from '~/components/shared/PropertyPicker.vue'
import { toast } from 'vue-sonner'
import CleaningStepsEditor from '~/components/cleaning/CleaningStepsEditor.vue'
import { cleanCleaningSteps, cloneCleaningSteps, countCleaningSteps, parseCleaningStepsFile } from '~/components/cleaning/data/cleaning-steps'
import { listings } from '~/components/listings/data/listings'
import PropertyPicker from '~/components/shared/PropertyPicker.vue'
import { useCleaningSteps } from '~/composables/useCleaningSteps'
import { useCleaningStepTemplates } from '~/composables/useCleaningStepTemplates'

/**
 * Edits a listing's cleaning steps on a draft copy; nothing is written until
 * Save. Blank steps and empty sections are dropped on save (`cleanCleaningSteps`).
 * The editing itself is `CleaningStepsEditor`, shared with Settings > Cleaning
 * Templates.
 *
 * Import (a template, another listing, or a CSV/text file) fills the draft
 * only, always as a copy with fresh ids. Copy to listings writes the other
 * listings straight away, from the draft as it stands, replacing their steps
 * (`useCleaningSteps().copyStepsToListings`).
 */
const props = defineProps<{ steps: CleaningStepSection[] | undefined, listingId: string, listingName: string }>()
const emit = defineEmits<{ save: [steps: CleaningStepSection[]] }>()
const open = defineModel<boolean>('open', { default: false })

const draft = ref<CleaningStepSection[]>([])

watch(open, (isOpen) => {
  if (isOpen)
    draft.value = JSON.parse(JSON.stringify(props.steps ?? []))
}, { immediate: true })

const stepCount = computed(() => countCleaningSteps(draft.value))

// --- Templates -----------------------------------------------------------------

const { sortedTemplates, defaultTemplate, getTemplate } = useCleaningStepTemplates()

function useDefaultTemplate() {
  if (defaultTemplate.value)
    draft.value = cloneCleaningSteps(defaultTemplate.value.sections)
}

// --- Import ------------------------------------------------------------------

const { listingsWithSteps, copyStepsToListings } = useCleaningSteps()

type ImportSource = 'template' | 'listing' | 'file'
const IMPORT_SOURCES: Array<{ value: ImportSource, label: string }> = [
  { value: 'template', label: 'Template' },
  { value: 'listing', label: 'Another listing' },
  { value: 'file', label: 'File' },
]

const importOpen = ref(false)
const importSource = ref<ImportSource>('template')
const importMode = ref<'replace' | 'append'>('replace')
const importTemplateId = ref('')
const importListingId = ref('')
const importFile = ref<{ name: string, sections: CleaningStepSection[] } | null>(null)
const importError = ref('')

const importListings = computed(() => listingsWithSteps.value.filter(l => l.id !== props.listingId))

const importSections = computed<CleaningStepSection[]>(() => {
  if (importSource.value === 'file')
    return importFile.value?.sections ?? []
  if (importSource.value === 'template')
    return getTemplate(importTemplateId.value)?.sections ?? []
  return listings.value.find(l => l.id === importListingId.value)?.maintenance.cleaningSteps ?? []
})
const importCount = computed(() => countCleaningSteps(importSections.value))

function openImport(source: ImportSource = 'template') {
  importSource.value = source
  importMode.value = countCleaningSteps(draft.value) ? 'append' : 'replace'
  importTemplateId.value = defaultTemplate.value?.id ?? ''
  importListingId.value = ''
  importFile.value = null
  importError.value = ''
  importOpen.value = true
}

async function readImportFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file)
    return
  const result = parseCleaningStepsFile(await file.text(), file.name)
  if ('error' in result) {
    importFile.value = null
    importError.value = result.error
    return
  }
  importError.value = ''
  importFile.value = { name: file.name, sections: result.sections }
}

function applyImport() {
  const imported = cloneCleaningSteps(importSections.value)
  draft.value = importMode.value === 'replace' ? imported : [...draft.value, ...imported]
  importOpen.value = false
  toast.success(`Imported ${importCount.value} ${importCount.value === 1 ? 'step' : 'steps'}. Save to keep them.`)
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
  const count = copyStepsToListings(cleanCleaningSteps(draft.value), copyTargets.value)
  copyOpen.value = false
  toast.success(`Cleaning steps copied to ${count} ${count === 1 ? 'listing' : 'listings'}`)
}

function save() {
  emit('save', cleanCleaningSteps(draft.value))
  open.value = false
}
</script>

<template>
  <Sheet v-model:open="open">
    <SheetContent class="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
      <SheetHeader class="border-b p-5">
        <SheetTitle>Cleaning steps</SheetTitle>
        <SheetDescription>
          What housekeeping works through on every clean of {{ listingName }}. Cleanings can only be scheduled once there is at least one step.
        </SheetDescription>
      </SheetHeader>

      <div class="flex min-h-0 flex-1 flex-col overflow-y-auto p-5">
        <CleaningStepsEditor v-model="draft">
          <template #empty>
            <Button v-if="defaultTemplate" size="sm" data-testid="steps-use-template" @click="useDefaultTemplate">
              Use {{ defaultTemplate.name }}
            </Button>
            <Button v-if="sortedTemplates.length > 1" size="sm" variant="outline" data-testid="steps-choose-template" @click="openImport('template')">
              Choose template
            </Button>
          </template>
          <template #toolbar>
            <Button variant="outline" size="sm" class="h-8 gap-1.5 text-xs" data-testid="steps-import" @click="openImport()">
              <Icon name="lucide:import" class="size-3.5" />
              Import
            </Button>
            <Button
              variant="outline"
              size="sm"
              class="h-8 gap-1.5 text-xs"
              :disabled="stepCount === 0"
              data-testid="steps-copy"
              @click="openCopy"
            >
              <Icon name="lucide:copy" class="size-3.5" />
              Copy to listings
            </Button>
          </template>
        </CleaningStepsEditor>
      </div>

      <SheetFooter class="flex-row items-center justify-between gap-2 border-t p-4">
        <span class="text-xs text-muted-foreground">
          {{ stepCount }} {{ stepCount === 1 ? 'step' : 'steps' }}
        </span>
        <div class="flex gap-2">
          <Button variant="outline" @click="open = false">
            Cancel
          </Button>
          <Button :disabled="stepCount === 0" data-testid="steps-save" @click="save">
            Save steps
          </Button>
        </div>
      </SheetFooter>
    </SheetContent>

    <!-- Import into the draft -->
    <Dialog v-model:open="importOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import cleaning steps</DialogTitle>
          <DialogDescription>Fills this editor. Nothing is saved until you press Save steps.</DialogDescription>
        </DialogHeader>

        <div class="flex flex-col gap-4 py-1">
          <div class="inline-flex w-fit rounded-lg border bg-muted/40 p-0.5 text-xs">
            <button
              v-for="src in IMPORT_SOURCES"
              :key="src.value"
              type="button"
              class="rounded-md px-3 py-1 font-medium transition-all"
              :class="importSource === src.value ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'"
              :data-testid="`import-source-${src.value}`"
              @click="importSource = src.value"
            >
              {{ src.label }}
            </button>
          </div>

          <div v-if="importSource === 'template'" class="flex flex-col gap-1.5">
            <Label class="text-xs">Template</Label>
            <Select v-model="importTemplateId">
              <SelectTrigger class="w-full" data-testid="import-template">
                <SelectValue placeholder="Choose a template" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="t in sortedTemplates" :key="t.id" :value="t.id">
                  {{ t.name }}{{ t.isDefault ? ' (default)' : '' }}
                </SelectItem>
              </SelectContent>
            </Select>
            <p class="text-xs text-muted-foreground">
              Manage templates in
              <NuxtLink to="/settings/cleaning-templates" class="font-medium underline">
                Settings
              </NuxtLink>.
            </p>
          </div>

          <div v-else-if="importSource === 'listing'" class="flex flex-col gap-1.5">
            <Label class="text-xs">Listing</Label>
            <Select v-model="importListingId">
              <SelectTrigger class="w-full" data-testid="import-listing">
                <SelectValue placeholder="Choose a listing with steps" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="l in importListings" :key="l.id" :value="l.id">
                  {{ l.name }}
                </SelectItem>
              </SelectContent>
            </Select>
            <p v-if="!importListings.length" class="text-xs text-muted-foreground">
              No other listing has cleaning steps yet.
            </p>
          </div>

          <div v-else class="flex flex-col gap-1.5">
            <Label class="text-xs">CSV or text file</Label>
            <Input type="file" accept=".csv,.txt,text/csv,text/plain" class="text-xs" data-testid="import-file" @change="readImportFile" />
            <p class="text-xs text-muted-foreground">
              CSV: one row per step, <code class="rounded bg-muted px-1">Section,Step</code>. Text: a line ending in <code class="rounded bg-muted px-1">:</code> starts a section, each line under it is a step.
            </p>
            <p v-if="importError" class="text-xs text-destructive" data-testid="import-error">
              {{ importError }}
            </p>
            <p v-else-if="importFile" class="text-xs text-muted-foreground">
              {{ importFile.name }}
            </p>
          </div>

          <div v-if="importCount" class="flex flex-col gap-2">
            <p class="text-xs font-medium" data-testid="import-preview">
              {{ importCount }} {{ importCount === 1 ? 'step' : 'steps' }} in {{ importSections.length }} {{ importSections.length === 1 ? 'section' : 'sections' }}
            </p>
            <div class="grid grid-cols-2 gap-2">
              <button
                v-for="mode in (['replace', 'append'] as const)"
                :key="mode"
                type="button"
                class="rounded-lg border p-2 text-left text-xs transition-all"
                :class="importMode === mode ? 'border-primary bg-primary/5 font-semibold' : 'text-muted-foreground hover:text-foreground'"
                :data-testid="`import-mode-${mode}`"
                @click="importMode = mode"
              >
                {{ mode === 'replace' ? 'Replace current steps' : 'Add after current steps' }}
              </button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="importOpen = false">
            Cancel
          </Button>
          <Button :disabled="!importCount" data-testid="import-apply" @click="applyImport">
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Copy the draft to other listings -->
    <Dialog v-model:open="copyOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Copy to other listings</DialogTitle>
          <DialogDescription>
            Copies these {{ stepCount }} steps, as they are in the editor now. The listings you pick lose their current steps.
          </DialogDescription>
        </DialogHeader>
        <div class="py-1">
          <PropertyPicker v-model="copyTargets" :options="copyOptions" />
        </div>
        <DialogFooter>
          <Button variant="outline" @click="copyOpen = false">
            Cancel
          </Button>
          <Button :disabled="!copyTargets.length" data-testid="copy-apply" @click="applyCopy">
            Copy to {{ copyTargets.length }} {{ copyTargets.length === 1 ? 'listing' : 'listings' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </Sheet>
</template>
