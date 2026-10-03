<script setup lang="ts">
import type { GuideContentItem, GuideContentKind } from '~/components/listings/data/guest-guide-content'
import type { GuideContentTemplate } from '~/components/listings/data/guide-content-templates'
import { toast } from 'vue-sonner'
import { cleanGuideItems, GUIDE_CONTENT_META } from '~/components/listings/data/guest-guide-content'
import GuideItemsEditor from '~/components/listings/guest-guide/GuideItemsEditor.vue'
import { useGuideContentTemplates } from '~/composables/useGuideContentTemplates'

/** Creates (`template` null) or edits one guest guide content template of `kind`. */
const props = defineProps<{ kind: GuideContentKind, template: GuideContentTemplate | null }>()
const open = defineModel<boolean>('open', { default: false })

const { createTemplate, updateTemplate } = useGuideContentTemplates()
const meta = computed(() => GUIDE_CONTENT_META[props.kind])

const name = ref('')
const draft = ref<GuideContentItem[]>([])

watch(open, (isOpen) => {
  if (!isOpen)
    return
  name.value = props.template?.name ?? ''
  draft.value = JSON.parse(JSON.stringify(props.template?.items ?? []))
}, { immediate: true })

const itemCount = computed(() => cleanGuideItems(draft.value).length)
const canSave = computed(() => name.value.trim().length > 0 && itemCount.value > 0)

function save() {
  const items = cleanGuideItems(draft.value)
  if (props.template) {
    updateTemplate(props.template.id, { name: name.value, items })
    toast.success('Template saved')
  }
  else {
    createTemplate({ kind: props.kind, name: name.value, items })
    toast.success('Template created')
  }
  open.value = false
}
</script>

<template>
  <Sheet v-model:open="open">
    <SheetContent class="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
      <SheetHeader class="border-b p-5">
        <SheetTitle>{{ template ? 'Edit template' : 'New template' }}: {{ meta.label }}</SheetTitle>
        <SheetDescription>
          Listings that used this template keep their own copy, so editing it later does not change them.
        </SheetDescription>
      </SheetHeader>
      <div class="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-5">
        <div class="grid gap-1.5">
          <Label for="gct-name">Name <span class="text-destructive">*</span></Label>
          <Input id="gct-name" v-model="name" placeholder="e.g. Self check-in with smart lock" data-testid="guide-template-name" />
        </div>
        <GuideItemsEditor v-model="draft" :kind="kind" />
      </div>
      <SheetFooter class="flex-row items-center justify-between gap-2 border-t p-4">
        <span class="text-xs text-muted-foreground">
          {{ itemCount }} {{ itemCount === 1 ? meta.noun : `${meta.noun}s` }}
        </span>
        <div class="flex gap-2">
          <Button variant="outline" @click="open = false">
            Cancel
          </Button>
          <Button :disabled="!canSave" data-testid="guide-template-save" @click="save">
            {{ template ? 'Save template' : 'Create template' }}
          </Button>
        </div>
      </SheetFooter>
    </SheetContent>
  </Sheet>
</template>
