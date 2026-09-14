<script lang="ts" setup>
import type { AiReasoning } from '~/components/inbox/data/conversations'
import { toast } from 'vue-sonner'
import { listings } from '~/components/listings/data/listings'
import { aiKnowledgeFieldSpec, applyAiKnowledge, readAiKnowledge } from '~/lib/ai-knowledge'

interface AiReasoningDialogProps {
  reasoning: AiReasoning
}

const props = defineProps<AiReasoningDialogProps>()

const open = defineModel<boolean>('open', { default: false })

const source = computed(() => props.reasoning.source ?? null)

const listing = computed(() => {
  const id = source.value?.listingId
  if (!id)
    return null
  return listings.value.find(l => l.id === id) ?? null
})

const spec = computed(() => (source.value ? aiKnowledgeFieldSpec(source.value.field) : null))

const isEditing = ref(false)
const draft = ref('')
const saved = ref(false)

function startEditing() {
  if (!listing.value || !source.value)
    return
  draft.value = readAiKnowledge(listing.value, source.value.field)
  saved.value = false
  isEditing.value = true
}

function cancelEditing() {
  isEditing.value = false
  draft.value = ''
}

function save() {
  const src = source.value
  if (!src || !listing.value)
    return

  listings.value = applyAiKnowledge(listings.value, src, draft.value)
  isEditing.value = false
  saved.value = true
  toast.success(`${spec.value?.label} updated on ${listing.value.name}`)
}

// A reopened dialog should start from the listing as it stands now, not from a
// half-finished edit left behind last time.
watch(open, (isOpen) => {
  if (!isOpen) {
    isEditing.value = false
    draft.value = ''
    saved.value = false
  }
})
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2 text-base">
          <Icon name="lucide:sparkles" class="size-4 text-[#C8A84B]" />
          Where did this response come from?
        </DialogTitle>
        <DialogDescription class="sr-only">
          ElevAI's explanation of how it wrote this reply.
        </DialogDescription>
      </DialogHeader>

      <p class="text-sm leading-relaxed">
        {{ reasoning.explanation }}
      </p>

      <template v-if="source">
        <div v-if="!listing" class="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
          This reply used a listing that is no longer in your portfolio, so there is nothing left to correct here.
        </div>

        <template v-else-if="isEditing">
          <div class="space-y-2 rounded-lg border p-3">
            <Label :for="`ai-knowledge-${source.field}`" class="text-xs font-medium">
              {{ spec?.label }} — {{ listing.name }}
            </Label>
            <Input
              v-if="spec?.input === 'text'"
              :id="`ai-knowledge-${source.field}`"
              v-model="draft"
              :placeholder="spec?.placeholder"
            />
            <Textarea
              v-else
              :id="`ai-knowledge-${source.field}`"
              v-model="draft"
              :placeholder="spec?.placeholder"
              rows="5"
            />
            <p class="text-[11px] text-muted-foreground">
              <template v-if="spec?.input === 'list'">
                Separate each one with a comma.
              </template>
              ElevAI answers from this field, so the correction applies to every future conversation about {{ listing.name }}.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" @click="cancelEditing">
              Cancel
            </Button>
            <Button size="sm" @click="save">
              Save to listing
            </Button>
          </DialogFooter>
        </template>

        <template v-else>
          <div class="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/40 p-3">
            <div class="min-w-0">
              <p class="text-xs font-medium">
                {{ saved ? 'Updated' : 'Not right?' }}
              </p>
              <p class="text-[11px] text-muted-foreground">
                <template v-if="saved">
                  {{ spec?.label }} on {{ listing.name }} has been updated. ElevAI will answer from it from now on.
                </template>
                <template v-else>
                  This came from {{ spec?.label }} on {{ listing.name }}. Correct it and ElevAI stops repeating it.
                </template>
              </p>
            </div>
            <Button variant="outline" size="sm" @click="startEditing">
              {{ saved ? 'Edit again' : 'Change information' }}
            </Button>
          </div>

          <NuxtLink
            :to="`/listings/${listing.id}`"
            class="text-[11px] text-muted-foreground underline-offset-2 hover:underline"
            @click="open = false"
          >
            Open {{ spec?.section }}
          </NuxtLink>
        </template>
      </template>
    </DialogContent>
  </Dialog>
</template>
