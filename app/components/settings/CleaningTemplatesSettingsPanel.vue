<script setup lang="ts">
import type { CleaningStepTemplate, CleaningTemplateType } from '~/components/cleaning/data/cleaning-step-templates'
import { toast } from 'vue-sonner'
import { CLEANING_SOURCE_ICONS, CLEANING_SOURCE_LABELS } from '~/components/cleaning/data/cleaning-jobs'
import { CLEANING_TEMPLATE_TYPES } from '~/components/cleaning/data/cleaning-step-templates'
import { countCleaningSteps } from '~/components/cleaning/data/cleaning-steps'
import CleaningTemplateAssignDialog from '~/components/settings/CleaningTemplateAssignDialog.vue'
import CompanyCleaningScheduleCard from '~/components/settings/CompanyCleaningScheduleCard.vue'
import CleaningTemplateSheet from '~/components/settings/CleaningTemplateSheet.vue'
import { useCleaningStepTemplates } from '~/composables/useCleaningStepTemplates'

/**
 * Settings > Cleaning: the company cleaning schedule (`CompanyCleaningScheduleCard`),
 * the tenant's library of cleaning checklists
 * and the company default per cleaning type, which every listing follows
 * unless it overrides a type on its Maintenance tab (`cleaning-step-templates.ts`).
 * "Assign to listings" overrides one type on many listings at once. A template
 * in use (a default, or a listing override) is deleted only onto a replacement.
 */
const {
  sortedTemplates,
  templates,
  typeDefaults,
  getTemplate,
  setTypeDefault,
  defaultTypesOf,
  listingUsageOf,
  isTemplateInUse,
  duplicateTemplate,
  deleteTemplate,
} = useCleaningStepTemplates()

const sheetOpen = ref(false)
const editing = ref<CleaningStepTemplate | null>(null)
const assigning = ref<CleaningStepTemplate | null>(null)
const assignOpen = ref(false)
const pendingDelete = ref<CleaningStepTemplate | null>(null)
const replacementId = ref('')

const defaultRows = computed(() => CLEANING_TEMPLATE_TYPES.map((type) => {
  const template = getTemplate(typeDefaults.value[type] ?? '')
  return {
    type,
    label: CLEANING_SOURCE_LABELS[type],
    icon: CLEANING_SOURCE_ICONS[type],
    value: template?.id ?? '',
    stepCount: template ? countCleaningSteps(template.sections) : 0,
  }
}))

function changeDefault(type: CleaningTemplateType, id: string) {
  setTypeDefault(type, id)
  toast.success(`${CLEANING_SOURCE_LABELS[type]} now defaults to ${getTemplate(id)?.name}`)
}

function openCreate() {
  editing.value = null
  sheetOpen.value = true
}

function openEdit(template: CleaningStepTemplate) {
  editing.value = template
  sheetOpen.value = true
}

function openAssign(template: CleaningStepTemplate) {
  assigning.value = template
  assignOpen.value = true
}

function duplicate(template: CleaningStepTemplate) {
  const copy = duplicateTemplate(template.id)
  if (copy)
    toast.success(`Created ${copy.name}`)
}

const pendingDeleteInUse = computed(() => pendingDelete.value ? isTemplateInUse(pendingDelete.value.id) : false)
const pendingDeleteDefaults = computed(() => pendingDelete.value ? defaultTypesOf(pendingDelete.value.id) : [])
const pendingDeleteUsage = computed(() => pendingDelete.value ? listingUsageOf(pendingDelete.value.id) : 0)
const replacementOptions = computed(() => sortedTemplates.value.filter(t => t.id !== pendingDelete.value?.id))

function askDelete(template: CleaningStepTemplate) {
  pendingDelete.value = template
  replacementId.value = ''
}

function confirmDelete() {
  const target = pendingDelete.value
  if (!target)
    return
  if (pendingDeleteInUse.value && !replacementId.value)
    return
  const replacement = getTemplate(replacementId.value)
  pendingDelete.value = null
  if (deleteTemplate(target.id, replacementId.value || undefined))
    toast.success(replacement ? `${target.name} deleted, replaced by ${replacement.name}` : `${target.name} deleted`)
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div>
        <h2 class="text-2xl font-bold tracking-tight">
          Cleaning
        </h2>
        <p class="mt-1 text-sm text-muted-foreground">
          When listings are cleaned and the checklists housekeeping works through. Every listing follows these unless it sets its own.
        </p>
      </div>
      <Button class="shrink-0" data-testid="template-create" @click="openCreate">
        <Icon name="lucide:plus" class="mr-1.5 size-4" />
        New template
      </Button>
    </div>

    <CompanyCleaningScheduleCard />

    <Card class="gap-4 p-5" data-testid="type-defaults-card">
      <div>
        <h3 class="text-base font-semibold">
          Default checklist per cleaning type
        </h3>
        <p class="mt-0.5 text-xs text-muted-foreground">
          New cleanings copy the checklist when they are created, so a change here reaches new cleanings only.
        </p>
      </div>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div v-for="row in defaultRows" :key="row.type" class="grid gap-1.5" :data-testid="`type-default-${row.type}`">
          <Label class="flex items-center gap-1.5 text-xs">
            <Icon :name="row.icon" class="size-3.5 text-muted-foreground" />
            {{ row.label }}
          </Label>
          <Select
            :model-value="row.value"
            :data-testid="`type-default-select-${row.type}`"
            @update:model-value="value => changeDefault(row.type, String(value))"
          >
            <SelectTrigger class="w-full" :aria-label="`Default checklist for ${row.label.toLowerCase()}`">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="t in sortedTemplates" :key="t.id" :value="t.id">
                {{ t.name }}
              </SelectItem>
            </SelectContent>
          </Select>
          <p class="text-xs text-muted-foreground">
            {{ row.stepCount }} {{ row.stepCount === 1 ? 'step' : 'steps' }}
          </p>
        </div>
      </div>
    </Card>

    <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      <Card
        v-for="tmpl in sortedTemplates"
        :key="tmpl.id"
        class="flex flex-col gap-3 p-5"
        data-testid="template-card"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <h3 class="truncate text-base font-semibold">
              {{ tmpl.name }}
            </h3>
            <p v-if="tmpl.description" class="mt-0.5 text-xs text-muted-foreground">
              {{ tmpl.description }}
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <Button variant="ghost" size="icon" class="size-8 shrink-0" :aria-label="`More actions for ${tmpl.name}`" data-testid="template-menu">
                <Icon name="lucide:more-horizontal" class="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem data-testid="template-assign" @click="openAssign(tmpl)">
                <Icon name="lucide:home" class="mr-2 size-4" />
                Assign to listings
              </DropdownMenuItem>
              <DropdownMenuItem data-testid="template-duplicate" @click="duplicate(tmpl)">
                <Icon name="lucide:copy" class="mr-2 size-4" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                class="text-destructive focus:text-destructive"
                :disabled="templates.length <= 1"
                data-testid="template-delete"
                @click="askDelete(tmpl)"
              >
                <Icon name="lucide:trash-2" class="mr-2 size-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div class="flex flex-col gap-1 text-xs" data-testid="template-usage">
          <p v-if="defaultTypesOf(tmpl.id).length" class="flex items-center gap-1.5 font-medium text-primary">
            <Icon name="lucide:star" class="size-3 shrink-0" />
            Default for {{ defaultTypesOf(tmpl.id).map(t => CLEANING_SOURCE_LABELS[t].toLowerCase()).join(', ') }}
          </p>
          <p v-if="listingUsageOf(tmpl.id)" class="flex items-center gap-1.5 text-muted-foreground">
            <Icon name="lucide:home" class="size-3 shrink-0" />
            Override on {{ listingUsageOf(tmpl.id) }} {{ listingUsageOf(tmpl.id) === 1 ? 'listing' : 'listings' }}
          </p>
          <p v-if="!defaultTypesOf(tmpl.id).length && !listingUsageOf(tmpl.id)" class="text-muted-foreground">
            Not in use
          </p>
        </div>

        <p class="text-xs text-muted-foreground">
          {{ countCleaningSteps(tmpl.sections) }} steps in {{ tmpl.sections.length }} {{ tmpl.sections.length === 1 ? 'section' : 'sections' }}
        </p>
        <div class="flex flex-wrap gap-1.5">
          <Badge v-for="section in tmpl.sections.slice(0, 5)" :key="section.id" variant="secondary" class="text-[10px] font-normal">
            {{ section.title }}
          </Badge>
          <Badge v-if="tmpl.sections.length > 5" variant="outline" class="text-[10px] font-normal">
            +{{ tmpl.sections.length - 5 }} more
          </Badge>
        </div>

        <Button variant="outline" size="sm" class="mt-auto w-full gap-1.5" data-testid="template-edit" @click="openEdit(tmpl)">
          <Icon name="lucide:pencil" class="size-3.5" />
          Edit steps
        </Button>
      </Card>
    </div>

    <CleaningTemplateSheet v-model:open="sheetOpen" :template="editing" />
    <CleaningTemplateAssignDialog v-model:open="assignOpen" :template="assigning" />

    <AlertDialog :open="!!pendingDelete" @update:open="(v: boolean) => { if (!v) pendingDelete = null }">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {{ pendingDelete?.name }}?</AlertDialogTitle>
          <AlertDialogDescription>
            <template v-if="pendingDeleteInUse">
              It is in use
              <template v-if="pendingDeleteDefaults.length">
                as the default for {{ pendingDeleteDefaults.map(t => CLEANING_SOURCE_LABELS[t].toLowerCase()).join(', ') }}
              </template>
              <template v-if="pendingDeleteDefaults.length && pendingDeleteUsage">
                and
              </template>
              <template v-if="pendingDeleteUsage">
                on {{ pendingDeleteUsage }} {{ pendingDeleteUsage === 1 ? 'listing' : 'listings' }}
              </template>.
              Pick a template to use instead. Existing cleanings keep their checklist.
            </template>
            <template v-else>
              Existing cleanings keep their checklist.
            </template>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div v-if="pendingDeleteInUse" class="grid gap-1.5">
          <Label>Replace with</Label>
          <Select v-model="replacementId" data-testid="template-delete-replacement">
            <SelectTrigger class="w-full" aria-label="Replacement template">
              <SelectValue placeholder="Pick a template" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="t in replacementOptions" :key="t.id" :value="t.id">
                {{ t.name }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            class="bg-destructive text-white hover:bg-destructive/90"
            :disabled="pendingDeleteInUse && !replacementId"
            data-testid="template-delete-confirm"
            @click="confirmDelete"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
