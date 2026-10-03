<script setup lang="ts">
import type { CleaningGuidance } from '~/components/cleaning/data/cleaning-guidance'
import type { CleaningStepSection } from '~/components/cleaning/data/cleaning-steps'
import { toast } from 'vue-sonner'
import CleaningGuidanceDialog from '~/components/cleaning/CleaningGuidanceDialog.vue'
import { guidanceCoverUrl } from '~/components/cleaning/data/cleaning-guidance'
import { listings } from '~/components/listings/data/listings'
import GuidanceSheet from '~/components/settings/GuidanceSheet.vue'
import { useCleaningGuidance } from '~/composables/useCleaningGuidance'
import { useCleaningStepTemplates } from '~/composables/useCleaningStepTemplates'

/**
 * Settings > Operations > Guidance: how-to text and YouTube videos for
 * housekeeping, attached to cleaning steps in templates and listings.
 */
const { sortedGuidance, deleteGuidance } = useCleaningGuidance()
const { templates } = useCleaningStepTemplates()

const search = ref('')
const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return sortedGuidance.value.filter(g => !q || g.title.toLowerCase().includes(q) || g.body.toLowerCase().includes(q))
})

function stepsUsing(sections: CleaningStepSection[] | undefined, id: string) {
  return (sections ?? []).reduce((n, s) => n + s.steps.filter(st => st.guidanceIds?.includes(id)).length, 0)
}

/** Steps that point at the guidance, across templates and listings (jobs already scheduled not counted). */
function usage(id: string) {
  return templates.value.reduce((n, t) => n + stepsUsing(t.sections, id), 0)
    + listings.value.reduce((n, l) => n + stepsUsing(l.maintenance.cleaningSteps, id), 0)
}

const sheetOpen = ref(false)
const editing = ref<CleaningGuidance | null>(null)
const previewOpen = ref(false)
const previewing = ref<CleaningGuidance | null>(null)
const pendingDelete = ref<CleaningGuidance | null>(null)

function openCreate() {
  editing.value = null
  sheetOpen.value = true
}

function openEdit(g: CleaningGuidance) {
  editing.value = g
  sheetOpen.value = true
}

function openPreview(g: CleaningGuidance) {
  previewing.value = g
  previewOpen.value = true
}

function confirmDelete() {
  const target = pendingDelete.value
  pendingDelete.value = null
  if (!target)
    return
  deleteGuidance(target.id)
  toast.success(`${target.title} deleted`)
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div>
        <h2 class="text-2xl font-bold tracking-tight">
          Guidance
        </h2>
        <p class="mt-1 text-sm text-muted-foreground">
          How-to text and YouTube videos for housekeeping. Attach them to cleaning steps; cleaners see them on the checklist.
        </p>
      </div>
      <Button class="shrink-0" data-testid="guidance-create" @click="openCreate">
        <Icon name="lucide:plus" class="mr-1.5 size-4" />
        New guidance
      </Button>
    </div>

    <div class="relative max-w-md">
      <Icon name="lucide:search" class="absolute left-3 top-2.5 size-4 text-muted-foreground" />
      <Input v-model="search" placeholder="Search guidance..." class="h-9 pl-9" />
    </div>

    <div v-if="filtered.length" class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      <Card v-for="g in filtered" :key="g.id" class="flex flex-col gap-3 overflow-hidden p-0 pb-5" data-testid="guidance-card">
        <div class="flex aspect-video items-center justify-center overflow-hidden border-b bg-muted">
          <img v-if="guidanceCoverUrl(g)" :src="guidanceCoverUrl(g)!" alt="" class="size-full object-cover" data-testid="guidance-cover">
          <Icon v-else name="lucide:book-open" class="size-8 text-muted-foreground" />
        </div>
        <div class="flex items-start justify-between gap-2 px-5">
          <h3 class="text-base font-semibold">
            {{ g.title }}
          </h3>
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <Button variant="ghost" size="icon" class="size-8 shrink-0" :aria-label="`More actions for ${g.title}`">
                <Icon name="lucide:more-horizontal" class="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem @click="openPreview(g)">
                <Icon name="lucide:eye" class="mr-2 size-4" />
                Preview
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem class="text-destructive focus:text-destructive" data-testid="guidance-delete" @click="pendingDelete = g">
                <Icon name="lucide:trash-2" class="mr-2 size-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <p v-if="g.body" class="line-clamp-3 px-5 text-xs text-muted-foreground">
          {{ g.body }}
        </p>
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 text-xs text-muted-foreground">
          <span class="flex items-center gap-1">
            <Icon name="lucide:video" class="size-3.5" />
            {{ g.videos.length }} {{ g.videos.length === 1 ? 'video' : 'videos' }}
          </span>
          <span class="flex items-center gap-1" data-testid="guidance-usage">
            <Icon name="lucide:list-checks" class="size-3.5" />
            Used in {{ usage(g.id) }} {{ usage(g.id) === 1 ? 'step' : 'steps' }}
          </span>
        </div>
        <Button variant="outline" size="sm" class="mx-5 mt-auto gap-1.5" data-testid="guidance-edit" @click="openEdit(g)">
          <Icon name="lucide:pencil" class="size-3.5" />
          Edit
        </Button>
      </Card>
    </div>
    <p v-else class="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
      {{ search ? 'No guidance matches.' : 'No guidance yet.' }}
    </p>

    <GuidanceSheet v-model:open="sheetOpen" :guidance="editing" />
    <CleaningGuidanceDialog v-model:open="previewOpen" :guidance="previewing" />

    <AlertDialog :open="!!pendingDelete" @update:open="(v: boolean) => { if (!v) pendingDelete = null }">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {{ pendingDelete?.title }}?</AlertDialogTitle>
          <AlertDialogDescription>
            <template v-if="pendingDelete && usage(pendingDelete.id)">
              It is attached to {{ usage(pendingDelete.id) }} {{ usage(pendingDelete.id) === 1 ? 'step' : 'steps' }} and disappears from them, including cleanings already scheduled.
            </template>
            <template v-else>
              It is not attached to any step.
            </template>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction class="bg-destructive text-white hover:bg-destructive/90" data-testid="guidance-delete-confirm" @click="confirmDelete">
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
