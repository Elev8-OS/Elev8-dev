<script setup lang="ts">
import type { CleaningTemplateType } from '~/components/cleaning/data/cleaning-step-templates'
import type { CleaningStepSection } from '~/components/cleaning/data/cleaning-steps'
import type { Listing } from '~/components/listings/data/listings'
import { CLEANING_SOURCE_LABELS } from '~/components/cleaning/data/cleaning-jobs'
import { LISTING_CUSTOM_STEPS, listingChecklistOverrides } from '~/components/cleaning/data/cleaning-step-templates'
import { countCleaningSteps } from '~/components/cleaning/data/cleaning-steps'
import { useCleaningStepTemplates } from '~/composables/useCleaningStepTemplates'

/**
 * One cleaning type's checklist on a listing: follow the company default, use
 * another template, or the listing's own custom steps. Emits the choice; the
 * Maintenance tab writes it (`withListingOverride`). Custom with no steps yet
 * asks the tab to open the steps editor (`edit-custom`), which applies the
 * choice once the steps are saved.
 */
const props = defineProps<{ listing: Listing, type: CleaningTemplateType | null }>()
const emit = defineEmits<{
  save: [type: CleaningTemplateType, value: string | null]
  editCustom: [type: CleaningTemplateType]
}>()
const open = defineModel<boolean>('open', { default: false })

type Choice = 'default' | 'template' | 'custom'

const { sortedTemplates, getTemplate, defaultFor, templates } = useCleaningStepTemplates()

const choice = ref<Choice>('default')
const templateId = ref('')

const typeLabel = computed(() => props.type ? CLEANING_SOURCE_LABELS[props.type] : '')
const companyDefault = computed(() => props.type ? defaultFor(props.type) : null)
const ownSteps = computed(() => props.listing.maintenance.cleaningSteps ?? [])
const ownStepCount = computed(() => countCleaningSteps(ownSteps.value))


watch(open, (isOpen) => {
  if (!isOpen || !props.type)
    return
  const current = listingChecklistOverrides(props.listing.maintenance, templates.value)[props.type]
  if (current === LISTING_CUSTOM_STEPS) {
    choice.value = 'custom'
    templateId.value = ''
  }
  else if (current && getTemplate(current)) {
    choice.value = 'template'
    templateId.value = current
  }
  else {
    choice.value = 'default'
    templateId.value = ''
  }
}, { immediate: true })

const preview = computed<{ name: string, sections: CleaningStepSection[] } | null>(() => {
  if (choice.value === 'default')
    return companyDefault.value ? { name: companyDefault.value.name, sections: companyDefault.value.sections } : null
  if (choice.value === 'template') {
    const t = getTemplate(templateId.value)
    return t ? { name: t.name, sections: t.sections } : null
  }
  return ownStepCount.value ? { name: 'Custom steps', sections: ownSteps.value } : null
})

const canSave = computed(() => {
  if (choice.value === 'template')
    return Boolean(getTemplate(templateId.value))
  if (choice.value === 'custom')
    return ownStepCount.value > 0
  return Boolean(companyDefault.value)
})

const OPTIONS = computed(() => [
  { id: 'default' as const, title: 'Company default', hint: companyDefault.value ? `${companyDefault.value.name}, set in Settings` : 'None set in Settings' },
  { id: 'template' as const, title: 'Another template', hint: 'Only for this listing' },
  { id: 'custom' as const, title: 'Custom for this listing', hint: ownStepCount.value ? `${ownStepCount.value} steps, shared by every type set to custom` : 'Write steps just for this listing' },
])

function save() {
  if (!props.type || !canSave.value)
    return
  const value = choice.value === 'default' ? null : choice.value === 'custom' ? LISTING_CUSTOM_STEPS : templateId.value
  emit('save', props.type, value)
  open.value = false
}

function editCustom() {
  if (!props.type)
    return
  emit('editCustom', props.type)
  open.value = false
}
</script>

<template>
  <Sheet v-model:open="open">
    <SheetContent class="flex w-full flex-col gap-0 p-0 sm:max-w-md">
      <SheetHeader class="border-b p-5">
        <SheetTitle>{{ typeLabel }} checklist</SheetTitle>
        <SheetDescription>
          What housekeeping checks off on a {{ typeLabel.toLowerCase() }} at {{ listing.name }}. New cleanings copy it when they are created.
        </SheetDescription>
      </SheetHeader>

      <div class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5">
        <div class="flex flex-col gap-2" role="radiogroup" :aria-label="`${typeLabel} checklist`">
          <div
            v-for="option in OPTIONS"
            :key="option.id"
            role="radio"
            :aria-checked="choice === option.id"
            tabindex="0"
            class="flex cursor-pointer flex-col gap-2 rounded-lg border p-3 transition-colors"
            :class="choice === option.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/40'"
            :data-testid="`checklist-choice-${option.id}`"
            @click="choice = option.id"
            @keydown.enter.prevent="choice = option.id"
            @keydown.space.prevent="choice = option.id"
          >
            <div class="flex items-start gap-2.5">
              <div
                class="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border"
                :class="choice === option.id ? 'border-primary' : 'border-input'"
              >
                <div v-if="choice === option.id" class="size-2 rounded-full bg-primary" />
              </div>
              <div class="min-w-0">
                <p class="text-sm font-medium">
                  {{ option.title }}
                </p>
                <p class="text-xs text-muted-foreground">
                  {{ option.hint }}
                </p>
              </div>
            </div>

            <div v-if="option.id === 'template' && choice === 'template'" class="pl-6" @click.stop>
              <Select v-model="templateId" data-testid="checklist-template-select">
                <SelectTrigger class="h-8 w-full text-xs" aria-label="Template">
                  <SelectValue placeholder="Pick a template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="t in sortedTemplates" :key="t.id" :value="t.id">
                    {{ t.name }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div v-if="option.id === 'custom' && choice === 'custom'" class="pl-6" @click.stop>
              <Button variant="outline" size="sm" class="h-7 gap-1.5 text-xs" data-testid="checklist-edit-custom" @click="editCustom">
                <Icon :name="ownStepCount ? 'lucide:pencil' : 'lucide:plus'" class="size-3.5" />
                {{ ownStepCount ? 'Edit custom steps' : 'Write custom steps' }}
              </Button>
            </div>
          </div>
        </div>

        <div v-if="preview" class="flex flex-col gap-2" data-testid="checklist-preview">
          <p class="text-xs font-medium text-muted-foreground">
            Preview: {{ preview.name }} ({{ countCleaningSteps(preview.sections) }} steps)
          </p>
          <div class="flex flex-col divide-y rounded-lg border">
            <div v-for="section in preview.sections" :key="section.id" class="px-3 py-2">
              <p class="text-xs font-medium">
                {{ section.title }}
              </p>
              <ul class="mt-1 flex flex-col gap-0.5">
                <li v-for="step in section.steps" :key="step.id" class="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <Icon name="lucide:check" class="mt-0.5 size-3 shrink-0" />
                  {{ step.label }}
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <SheetFooter class="flex-row items-center justify-end gap-2 border-t p-4">
        <Button variant="outline" @click="open = false">
          Cancel
        </Button>
        <Button :disabled="!canSave" data-testid="checklist-save" @click="save">
          Save
        </Button>
      </SheetFooter>
    </SheetContent>
  </Sheet>
</template>
