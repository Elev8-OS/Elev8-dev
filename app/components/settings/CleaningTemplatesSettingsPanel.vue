<script setup lang="ts">
import type { CleaningStepTemplate } from '~/components/cleaning/data/cleaning-step-templates'
import { toast } from 'vue-sonner'
import { countCleaningSteps } from '~/components/cleaning/data/cleaning-steps'
import CleaningTemplateSheet from '~/components/settings/CleaningTemplateSheet.vue'
import { useCleaningStepTemplates } from '~/composables/useCleaningStepTemplates'

/**
 * Settings > Cleaning Templates: the tenant's library of cleaning step sets.
 * The default is what a listing with no steps is offered first ("Use …" in its
 * cleaning steps editor); every template is also available from Import there.
 */
const { sortedTemplates, templates, setDefaultTemplate, duplicateTemplate, deleteTemplate } = useCleaningStepTemplates()

const sheetOpen = ref(false)
const editing = ref<CleaningStepTemplate | null>(null)
const pendingDelete = ref<CleaningStepTemplate | null>(null)

function openCreate() {
  editing.value = null
  sheetOpen.value = true
}

function openEdit(template: CleaningStepTemplate) {
  editing.value = template
  sheetOpen.value = true
}

function makeDefault(template: CleaningStepTemplate) {
  setDefaultTemplate(template.id)
  toast.success(`${template.name} is now the default`)
}

function duplicate(template: CleaningStepTemplate) {
  const copy = duplicateTemplate(template.id)
  if (copy)
    toast.success(`Created ${copy.name}`)
}

function confirmDelete() {
  const target = pendingDelete.value
  pendingDelete.value = null
  if (target && deleteTemplate(target.id))
    toast.success(`${target.name} deleted`)
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div>
        <h2 class="text-2xl font-bold tracking-tight">
          Cleaning Templates
        </h2>
        <p class="mt-1 text-sm text-muted-foreground">
          Reusable cleaning steps. A listing set up from a template gets its own copy; the default is offered first.
        </p>
      </div>
      <Button class="shrink-0" data-testid="template-create" @click="openCreate">
        <Icon name="lucide:plus" class="mr-1.5 size-4" />
        New template
      </Button>
    </div>

    <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      <Card
        v-for="tmpl in sortedTemplates"
        :key="tmpl.id"
        class="flex flex-col gap-3 p-5"
        :class="tmpl.isDefault ? 'border-primary/40' : ''"
        data-testid="template-card"
        :data-default="tmpl.isDefault || undefined"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <h3 class="truncate text-base font-semibold">
                {{ tmpl.name }}
              </h3>
              <Badge v-if="tmpl.isDefault" class="h-5 bg-emerald-600 text-[10px] text-white hover:bg-emerald-600">
                Default
              </Badge>
            </div>
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
              <DropdownMenuItem v-if="!tmpl.isDefault" data-testid="template-set-default" @click="makeDefault(tmpl)">
                <Icon name="lucide:star" class="mr-2 size-4" />
                Set as default
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
                @click="pendingDelete = tmpl"
              >
                <Icon name="lucide:trash-2" class="mr-2 size-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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

    <AlertDialog :open="!!pendingDelete" @update:open="(v: boolean) => { if (!v) pendingDelete = null }">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {{ pendingDelete?.name }}?</AlertDialogTitle>
          <AlertDialogDescription>
            Listings set up from it keep their steps.
            <template v-if="pendingDelete?.isDefault">
              The first remaining template becomes the default.
            </template>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction class="bg-destructive text-white hover:bg-destructive/90" data-testid="template-delete-confirm" @click="confirmDelete">
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
