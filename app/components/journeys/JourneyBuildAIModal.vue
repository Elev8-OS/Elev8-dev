<script setup lang="ts">
const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'build': [prompt: string]
}>()

const prompt = ref('')

const modifySuggestions = [
  'Add a mid-stay upsell for late checkout',
  'Make the welcome message more personal',
  'Add a context check before sending check-in details',
  'Shorten the wait time before the review request',
]

watch(() => props.open, (open) => {
  if (open)
    prompt.value = ''
})

function applySuggestion(text: string) {
  prompt.value = prompt.value.trim() ? `${prompt.value.trim()}\n${text}` : text
}

function handleBuild() {
  if (!prompt.value.trim())
    return
  emit('build', prompt.value.trim())
  emit('update:open', false)
}

function handleClose() {
  emit('update:open', false)
}
</script>

<template>
  <Dialog :open="open" @update:open="handleClose">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <Icon name="elev8:elevai" class="h-4 w-4" />
          Build with AI
        </DialogTitle>
        <DialogDescription>
          Describe what you want this journey to do. ElevAI will generate or modify the steps for you.
        </DialogDescription>
      </DialogHeader>

      <div class="flex flex-col gap-4 py-1">
        <div class="flex flex-col gap-1.5">
          <Label for="ai-prompt">What do you want to build?</Label>
          <Textarea
            id="ai-prompt"
            v-model="prompt"
            class="min-h-28 text-sm"
            placeholder="E.g., 'Create a pre-check-in reminder sent 24 hours before arrival'…"
          />
        </div>

        <div class="rounded-lg border bg-muted/30 p-3">
          <p class="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <Icon name="i-lucide-pencil" class="h-3.5 w-3.5" />
            Modify Existing Journey
          </p>
          <div class="flex flex-col gap-1">
            <button
              v-for="s in modifySuggestions"
              :key="s"
              class="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              @click="applySuggestion(s)"
            >
              <Icon name="i-lucide-plus" class="h-3 w-3 shrink-0" />
              {{ s }}
            </button>
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="handleClose">
          Cancel
        </Button>
        <Button :disabled="!prompt.trim()" @click="handleBuild">
          <Icon name="elev8:elevai" class="mr-2 h-4 w-4" />
          Build
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
