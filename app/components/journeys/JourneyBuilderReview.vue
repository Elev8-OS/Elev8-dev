<script setup lang="ts">
import type { Journey } from './data/journeys'

const props = defineProps<{
  journey: Journey & { aiReasoning?: string, stats?: { messages: number, contextChecks: number, estimatedTime: string } }
  mode?: 'new' | 'modify'
  sourceJourneyName?: string
}>()

const emit = defineEmits<{
  'use-journey': [journey: Journey]
  'regenerate': []
  'back': []
  'refine': [prompt: string]
}>()

const selectedStepId = ref<string | null>(props.journey.steps[0]?.id ?? null)
const refinePrompt = ref('')
const isRefining = ref(false)

function handleRefine() {
  const p = refinePrompt.value.trim()
  if (!p || isRefining.value)
    return
  isRefining.value = true
  // Brief delay so the spinner is visible, then emit. Parent will swap
  // generatedJourney to the refined result and the textarea is reset.
  setTimeout(() => {
    emit('refine', p)
    refinePrompt.value = ''
    isRefining.value = false
  }, 600)
}

const stepMeta: Record<string, { icon: string, colorClasses: string }> = {
  trigger: { icon: 'i-lucide-zap', colorClasses: 'text-purple-500 bg-purple-50 dark:bg-purple-950' },
  wait: { icon: 'i-lucide-clock', colorClasses: 'text-muted-foreground bg-muted' },
  message: { icon: 'i-lucide-message-square', colorClasses: 'text-green-600 bg-green-50 dark:bg-green-950' },
  context_check: { icon: 'i-lucide-git-branch', colorClasses: 'text-amber-500 bg-amber-50 dark:bg-amber-950' },
  action: { icon: 'i-lucide-bolt', colorClasses: 'text-red-500 bg-red-50 dark:bg-red-950' },
}
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <div class="flex items-center gap-2 border-b px-6 py-4 shrink-0">
      <Button variant="ghost" size="icon" aria-label="Back" @click="emit('back')">
        <Icon name="i-lucide-arrow-left" class="h-4 w-4" />
      </Button>
      <span class="text-sm text-muted-foreground">Back to Prompt</span>
    </div>

    <div class="flex flex-1 overflow-hidden">
      <div class="flex flex-1 flex-col overflow-y-auto p-6">
        <div class="mx-auto w-full max-w-xl">
          <h2 class="mb-5 text-lg font-semibold">
            {{ mode === 'modify' ? `Modified version of “${sourceJourneyName}”` : 'Generated Journey' }}
          </h2>
          <div class="flex flex-col">
            <div
              v-for="(step, index) in journey.steps"
              :key="step.id"
            >
              <div
                class="flex cursor-pointer items-center gap-3 rounded-lg border bg-card p-3 transition-all hover:border-primary/50" :class="[
                  selectedStepId === step.id && 'ring-2 ring-primary bg-primary/5 border-primary/30',
                  (step as any).isNew && 'border-primary/60 bg-primary/5',
                ]"
                @click="selectedStepId = step.id"
              >
                <div
                  class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" :class="[
                    stepMeta[step.type]?.colorClasses,
                  ]"
                >
                  <Icon :name="stepMeta[step.type]?.icon ?? 'i-lucide-circle'" class="h-4 w-4" />
                </div>
                <div class="flex min-w-0 flex-1 flex-col gap-1">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="text-sm font-medium leading-none">{{ step.name }}</span>
                    <span class="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground capitalize">
                      {{ step.type.replace('_', ' ') }}
                    </span>
                    <span
                      v-if="step.type === 'message'"
                      class="rounded px-1.5 py-0.5 text-xs font-medium"
                      :style="{ backgroundColor: '#C8A84B22', color: '#C8A84B' }"
                    >ElevAI</span>
                    <span
                      v-if="(step as any).isNew"
                      class="rounded px-1.5 py-0.5 text-xs font-medium bg-primary/10 text-primary"
                    >
                      New
                    </span>
                  </div>
                  <p v-if="step.type === 'message'" class="truncate text-xs text-muted-foreground">
                    {{ (step as any).directive }}
                  </p>
                  <p v-else-if="step.type === 'wait'" class="truncate text-xs text-muted-foreground">
                    {{ (step as any).waitMode === 'until_condition' ? 'Wait until conditions met' : [
                      (step as any).durationDays ? `${(step as any).durationDays}d` : '',
                      (step as any).durationHours ? `${(step as any).durationHours}h` : '',
                      (step as any).durationMinutes ? `${(step as any).durationMinutes}m` : '',
                    ].filter(Boolean).join(' ') || 'No wait time configured' }}
                  </p>
                  <p v-else-if="step.type === 'context_check'" class="truncate text-xs text-muted-foreground">
                    {{ (step as any).condition }}
                  </p>
                </div>
              </div>

              <div v-if="index < journey.steps.length - 1" class="flex h-6 justify-center">
                <div class="w-[2px] rounded-full bg-border/60" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="w-80 shrink-0 border-l overflow-y-auto p-4 flex flex-col gap-4">
        <div v-if="journey.aiReasoning" class="rounded-lg border bg-card p-4">
          <div class="flex items-center gap-2 mb-2">
            <Icon name="elev8:elevai" class="h-4 w-4" />
            <span class="text-sm font-semibold">AI Reasoning</span>
          </div>
          <p class="text-xs text-muted-foreground leading-relaxed">
            {{ journey.aiReasoning }}
          </p>
        </div>

        <div v-if="journey.stats" class="rounded-lg border bg-card p-4">
          <h4 class="text-sm font-semibold mb-3">
            Journey Stats
          </h4>
          <div class="flex flex-col gap-2">
            <div class="flex justify-between text-sm">
              <span class="text-muted-foreground">Messages</span>
              <span class="font-medium">{{ journey.stats.messages }}</span>
            </div>
            <Separator />
            <div class="flex justify-between text-sm">
              <span class="text-muted-foreground">Context Checks</span>
              <span class="font-medium">{{ journey.stats.contextChecks }}</span>
            </div>
            <Separator />
            <div class="flex justify-between text-sm">
              <span class="text-muted-foreground">Estimated Duration</span>
              <span class="font-medium">{{ journey.stats.estimatedTime }}</span>
            </div>
          </div>
        </div>

        <div class="rounded-lg border bg-card p-4">
          <h4 class="text-sm font-semibold mb-2">
            Refine with AI
          </h4>
          <Textarea
            v-model="refinePrompt"
            class="min-h-20 text-sm resize-none"
            placeholder="e.g. Add a mid-stay check-in message…"
            :disabled="isRefining"
          />
          <Button
            class="mt-2 w-full"
            variant="outline"
            :disabled="!refinePrompt.trim() || isRefining"
            @click="handleRefine"
          >
            <Icon v-if="isRefining" name="i-lucide-loader-2" class="mr-2 h-4 w-4 animate-spin" />
            <Icon v-else name="elev8:elevai" class="mr-2 h-4 w-4" />
            {{ isRefining ? 'Refining…' : 'Refine Journey' }}
          </Button>
        </div>

        <div class="mt-auto flex flex-col gap-2 pt-2">
          <Button variant="ghost" class="w-full" @click="emit('regenerate')">
            <Icon name="i-lucide-refresh-cw" class="mr-2 h-4 w-4" />
            Regenerate
          </Button>
          <Button class="w-full" @click="emit('use-journey', journey)">
            {{ mode === 'modify' ? 'Apply Changes to Journey' : 'Use this Journey' }}
            <Icon name="i-lucide-arrow-right" class="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>
