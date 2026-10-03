<script setup lang="ts">
import type { GuideContentKind } from '~/components/listings/data/guest-guide-content'
import type { GuideContentTemplate } from '~/components/listings/data/guide-content-templates'
import { toast } from 'vue-sonner'
import { GUIDE_CONTENT_KINDS, GUIDE_CONTENT_META } from '~/components/listings/data/guest-guide-content'
import GuideContentTemplateSheet from '~/components/settings/GuideContentTemplateSheet.vue'
import { useGuideContentTemplates } from '~/composables/useGuideContentTemplates'

/**
 * Settings > Guest Guide > Content Templates: reusable check-in/out steps,
 * house rules and Good to Know. Each kind has its own default, offered first
 * on a listing that has none of that kind.
 */
const { templatesOf, setDefaultTemplate, duplicateTemplate, deleteTemplate } = useGuideContentTemplates()

const activeKind = ref<GuideContentKind>('checkin')
const sheetOpen = ref(false)
const editing = ref<GuideContentTemplate | null>(null)
const pendingDelete = ref<GuideContentTemplate | null>(null)

function openCreate() {
  editing.value = null
  sheetOpen.value = true
}

function openEdit(t: GuideContentTemplate) {
  editing.value = t
  sheetOpen.value = true
}

function makeDefault(t: GuideContentTemplate) {
  setDefaultTemplate(t.id)
  toast.success(`${t.name} is now the default`)
}

function duplicate(t: GuideContentTemplate) {
  const copy = duplicateTemplate(t.id)
  if (copy)
    toast.success(`Created ${copy.name}`)
}

function confirmDelete() {
  const target = pendingDelete.value
  pendingDelete.value = null
  if (!target)
    return
  deleteTemplate(target.id)
  toast.success(`${target.name} deleted`)
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div>
        <h2 class="text-2xl font-bold tracking-tight">
          Guest Guide Content Templates
        </h2>
        <p class="mt-1 text-sm text-muted-foreground">
          Reusable content for listings' guest guides. A listing gets its own copy; the default is offered first.
        </p>
      </div>
      <Button class="shrink-0" data-testid="guide-template-create" @click="openCreate">
        <Icon name="lucide:plus" class="mr-1.5 size-4" />
        New template
      </Button>
    </div>

    <Tabs v-model="activeKind">
      <TabsList class="flex h-auto flex-wrap justify-start">
        <TabsTrigger v-for="kind in GUIDE_CONTENT_KINDS" :key="kind" :value="kind" :data-testid="`guide-template-kind-${kind}`">
          <Icon :name="GUIDE_CONTENT_META[kind].icon" class="mr-1.5 size-3.5" />
          {{ GUIDE_CONTENT_META[kind].label }}
          <span class="ml-1 text-muted-foreground">{{ templatesOf(kind).length }}</span>
        </TabsTrigger>
      </TabsList>
    </Tabs>

    <div v-if="templatesOf(activeKind).length" class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      <Card
        v-for="t in templatesOf(activeKind)"
        :key="t.id"
        class="flex flex-col gap-3 p-5"
        :class="t.isDefault ? 'border-primary/40' : ''"
        data-testid="guide-template-card"
        :data-default="t.isDefault || undefined"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="flex min-w-0 flex-wrap items-center gap-2">
            <h3 class="truncate text-base font-semibold">
              {{ t.name }}
            </h3>
            <Badge v-if="t.isDefault" class="h-5 bg-emerald-600 text-[10px] text-white hover:bg-emerald-600">
              Default
            </Badge>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <Button variant="ghost" size="icon" class="size-8 shrink-0" :aria-label="`More actions for ${t.name}`">
                <Icon name="lucide:more-horizontal" class="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem v-if="!t.isDefault" data-testid="guide-template-set-default" @click="makeDefault(t)">
                <Icon name="lucide:star" class="mr-2 size-4" />
                Set as default
              </DropdownMenuItem>
              <DropdownMenuItem @click="duplicate(t)">
                <Icon name="lucide:copy" class="mr-2 size-4" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem class="text-destructive focus:text-destructive" data-testid="guide-template-delete" @click="pendingDelete = t">
                <Icon name="lucide:trash-2" class="mr-2 size-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <ol class="flex flex-col gap-1 text-xs text-muted-foreground">
          <li v-for="(item, i) in t.items.slice(0, 4)" :key="item.id" class="flex items-center gap-1.5 truncate">
            <span v-if="GUIDE_CONTENT_META[activeKind].numbered" class="w-3 shrink-0 text-right">{{ i + 1 }}.</span>
            <Icon v-else :name="item.icon || 'lucide:dot'" class="size-3.5 shrink-0" />
            <span class="truncate">{{ item.title }}</span>
          </li>
          <li v-if="t.items.length > 4" class="pl-5">
            +{{ t.items.length - 4 }} more
          </li>
        </ol>
        <Button variant="outline" size="sm" class="mt-auto w-full gap-1.5" data-testid="guide-template-edit" @click="openEdit(t)">
          <Icon name="lucide:pencil" class="size-3.5" />
          Edit
        </Button>
      </Card>
    </div>
    <p v-else class="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
      No {{ GUIDE_CONTENT_META[activeKind].label.toLowerCase() }} templates yet.
    </p>

    <GuideContentTemplateSheet v-model:open="sheetOpen" :kind="activeKind" :template="editing" />

    <AlertDialog :open="!!pendingDelete" @update:open="(v: boolean) => { if (!v) pendingDelete = null }">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {{ pendingDelete?.name }}?</AlertDialogTitle>
          <AlertDialogDescription>
            Listings that used it keep their content.
            <template v-if="pendingDelete?.isDefault">
              Another template of this kind becomes the default.
            </template>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction class="bg-destructive text-white hover:bg-destructive/90" data-testid="guide-template-delete-confirm" @click="confirmDelete">
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
