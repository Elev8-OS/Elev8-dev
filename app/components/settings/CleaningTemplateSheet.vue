<script setup lang="ts">
import type { CleaningStepTemplate, CleaningTemplateType } from '~/components/cleaning/data/cleaning-step-templates'
import type { CleaningStepSection } from '~/components/cleaning/data/cleaning-steps'
import { toast } from 'vue-sonner'
import CleaningStepsEditor from '~/components/cleaning/CleaningStepsEditor.vue'
import { CLEANING_SOURCE_ICONS, CLEANING_SOURCE_LABELS } from '~/components/cleaning/data/cleaning-jobs'
import { CLEANING_TEMPLATE_TYPES } from '~/components/cleaning/data/cleaning-step-templates'
import { cleanCleaningSteps, countCleaningSteps, parseCleaningStepsFile } from '~/components/cleaning/data/cleaning-steps'
import { useCleaningStepTemplates } from '~/composables/useCleaningStepTemplates'

/**
 * Creates or edits one cleaning step template (`template` null = new). The
 * steps use the same `CleaningStepsEditor` as a listing's steps. Saving a
 * template never changes listings that were set up from it: they hold copies.
 * Cleaning type: which cleanings the template is for, one or more.
 */
const props = defineProps<{ template: CleaningStepTemplate | null }>()
const open = defineModel<boolean>('open', { default: false })

const { createTemplate, updateTemplate } = useCleaningStepTemplates()

const name = ref('')
const description = ref('')
const cleaningTypes = ref<CleaningTemplateType[]>([])
const draft = ref<CleaningStepSection[]>([])
const importError = ref('')

watch(open, (isOpen) => {
  if (!isOpen)
    return
  name.value = props.template?.name ?? ''
  description.value = props.template?.description ?? ''
  cleaningTypes.value = [...(props.template?.cleaningTypes ?? ['check_out'])]
  draft.value = JSON.parse(JSON.stringify(props.template?.sections ?? []))
  importError.value = ''
}, { immediate: true })

const stepCount = computed(() => countCleaningSteps(draft.value))
const canSave = computed(() => name.value.trim().length > 0 && stepCount.value > 0 && cleaningTypes.value.length > 0)

function toggleType(type: CleaningTemplateType) {
  cleaningTypes.value = cleaningTypes.value.includes(type)
    ? cleaningTypes.value.filter(t => t !== type)
    : CLEANING_TEMPLATE_TYPES.filter(t => t === type || cleaningTypes.value.includes(t))
}

const fileInput = ref<HTMLInputElement | null>(null)

async function readFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file)
    return
  const result = parseCleaningStepsFile(await file.text(), file.name)
  if ('error' in result) {
    importError.value = result.error
    return
  }
  importError.value = ''
  draft.value = [...draft.value, ...result.sections]
  toast.success(`Added ${countCleaningSteps(result.sections)} steps from ${file.name}`)
}

function save() {
  const sections = cleanCleaningSteps(draft.value)
  if (props.template) {
    updateTemplate(props.template.id, { name: name.value, description: description.value, cleaningTypes: cleaningTypes.value, sections })
    toast.success('Template saved')
  }
  else {
    createTemplate({ name: name.value, description: description.value, cleaningTypes: cleaningTypes.value, sections })
    toast.success('Template created')
  }
  open.value = false
}
</script>

<template>
  <Sheet v-model:open="open">
    <SheetContent class="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
      <SheetHeader class="border-b p-5">
        <SheetTitle>{{ template ? 'Edit template' : 'New template' }}</SheetTitle>
        <SheetDescription>
          Listings set up from this template keep their own copy, so editing it later does not change them.
        </SheetDescription>
      </SheetHeader>

      <div class="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-5">
        <div class="grid gap-3">
          <div class="grid gap-1.5">
            <Label for="cst-name">Name <span class="text-destructive">*</span></Label>
            <Input id="cst-name" v-model="name" placeholder="e.g. Villa standard" data-testid="template-name" />
          </div>
          <div class="grid gap-1.5">
            <Label for="cst-description">Description</Label>
            <Input id="cst-description" v-model="description" placeholder="When to use it" />
          </div>
          <div class="grid gap-1.5">
            <Label>Cleaning type <span class="text-destructive">*</span></Label>
            <div class="grid grid-cols-1 gap-2 sm:grid-cols-2" role="group" aria-label="Cleaning type">
              <div
                v-for="type in CLEANING_TEMPLATE_TYPES"
                :key="type"
                role="checkbox"
                tabindex="0"
                :aria-checked="cleaningTypes.includes(type)"
                class="flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2 text-sm transition-colors"
                :class="cleaningTypes.includes(type) ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'"
                :data-testid="`template-type-${type}`"
                @click="toggleType(type)"
                @keydown.space.prevent="toggleType(type)"
                @keydown.enter.prevent="toggleType(type)"
              >
                <div
                  class="flex size-4 shrink-0 items-center justify-center rounded-[4px] border"
                  :class="cleaningTypes.includes(type) ? 'border-primary bg-primary text-primary-foreground' : 'border-input'"
                >
                  <Icon v-if="cleaningTypes.includes(type)" name="lucide:check" class="size-3" />
                </div>
                <Icon :name="CLEANING_SOURCE_ICONS[type]" class="size-4 text-muted-foreground" />
                <span>{{ CLEANING_SOURCE_LABELS[type] }}</span>
              </div>
            </div>
            <p class="text-xs" :class="cleaningTypes.length ? 'text-muted-foreground' : 'text-destructive'">
              {{ cleaningTypes.length ? 'Pick every cleaning this template is written for.' : 'Pick at least one cleaning type.' }}
            </p>
          </div>
        </div>

        <CleaningStepsEditor v-model="draft">
          <template #toolbar>
            <Button variant="outline" size="sm" class="h-8 gap-1.5 text-xs" @click="fileInput?.click()">
              <Icon name="lucide:import" class="size-3.5" />
              Import file
            </Button>
            <input
              ref="fileInput"
              type="file"
              accept=".csv,.txt,text/csv,text/plain"
              class="hidden"
              data-testid="template-import-file"
              @change="readFile"
            >
          </template>
        </CleaningStepsEditor>
        <p v-if="importError" class="-mt-3 text-xs text-destructive">
          {{ importError }}
        </p>
      </div>

      <SheetFooter class="flex-row items-center justify-between gap-2 border-t p-4">
        <span class="text-xs text-muted-foreground">
          {{ stepCount }} {{ stepCount === 1 ? 'step' : 'steps' }}
        </span>
        <div class="flex gap-2">
          <Button variant="outline" @click="open = false">
            Cancel
          </Button>
          <Button :disabled="!canSave" data-testid="template-save" @click="save">
            {{ template ? 'Save template' : 'Create template' }}
          </Button>
        </div>
      </SheetFooter>
    </SheetContent>
  </Sheet>
</template>
