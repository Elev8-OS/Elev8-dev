<script setup lang="ts">
import type { MarketplaceTemplate } from './data/journeys'
import { marketplaceTemplates } from './data/journeys'

const emit = defineEmits<{
  'generate': [prompt: string]
  'use-template': [template: MarketplaceTemplate]
  'back': []
}>()

const prompt = ref('')

const examplePrompts = [
  'Complete guided stay with upsells',
  'Verification flow for new guests',
  'Revenue: gap night & late checkout',
]

function applyExample(text: string) {
  prompt.value = text
}

const categoryBadgeClass: Record<string, string> = {
  'Guided Stays': 'text-blue-700 bg-blue-50',
  'Revenue': 'text-green-700 bg-green-50',
  'Verification': 'text-amber-700 bg-amber-50',
  'Community': 'text-violet-700 bg-violet-50',
}
</script>

<template>
  <div class="flex flex-col h-full overflow-y-auto">
    <div class="flex items-center gap-2 border-b px-6 py-4">
      <Button variant="ghost" size="icon" aria-label="Back" @click="emit('back')">
        <Icon name="i-lucide-arrow-left" class="h-4 w-4" />
      </Button>
      <span class="text-sm text-muted-foreground">Back to Journeys</span>
    </div>

    <div class="flex flex-1 flex-col items-center justify-start py-12 px-4">
      <div class="w-full max-w-2xl">
        <div class="mb-8 text-center">
          <div
            class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
            :style="{ backgroundColor: '#C8A84B22' }"
          >
            <Icon name="elev8:elevai" class="h-7 w-7" />
          </div>
          <h2 class="text-2xl font-bold tracking-tight">
            AI Journey Builder
          </h2>
          <p class="mt-1.5 text-muted-foreground">
            Describe your guest communication goal and AI will generate a complete Journey for you.
          </p>
        </div>

        <div class="rounded-xl border bg-card p-6 shadow-sm">
          <Label for="journey-prompt" class="text-sm font-medium">Describe your Journey</Label>
          <Textarea
            id="journey-prompt"
            v-model="prompt"
            class="mt-2 min-h-32 resize-none text-sm"
            placeholder="e.g. Send a welcome when booking is confirmed, share check-in details 2 days before arrival, then request a review after checkout"
          />
          <div class="mt-3 flex flex-wrap gap-2">
            <button
              v-for="example in examplePrompts"
              :key="example"
              class="rounded-full border px-3 py-1 text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors"
              @click="applyExample(example)"
            >
              {{ example }}
            </button>
          </div>
          <div class="mt-4 flex justify-end">
            <Button :disabled="!prompt.trim()" @click="emit('generate', prompt.trim())">
              <Icon name="elev8:elevai" class="mr-2 h-4 w-4" />
              Generate Journey
            </Button>
          </div>
        </div>

        <div class="my-8 flex items-center gap-4">
          <Separator class="flex-1" />
          <span class="text-xs text-muted-foreground">or start from a template</span>
          <Separator class="flex-1" />
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div
            v-for="template in marketplaceTemplates"
            :key="template.id"
            class="group cursor-pointer rounded-lg border bg-card p-4 transition-all hover:border-primary/50 hover:shadow-sm"
            @click="emit('use-template', template)"
          >
            <div class="flex items-start justify-between gap-2 mb-2">
              <span class="font-medium text-sm leading-tight">{{ template.name }}</span>
              <span class="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium" :class="[categoryBadgeClass[template.category]]">
                {{ template.category }}
              </span>
            </div>
            <p class="text-xs text-muted-foreground line-clamp-2">
              {{ template.description }}
            </p>
            <p class="mt-2 text-xs text-muted-foreground">
              {{ template.stepCount }} steps
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
