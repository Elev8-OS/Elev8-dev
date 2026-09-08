<script setup lang="ts">
import type { OnboardingWizardStepId } from '~/components/onboarding/data/onboarding'

const props = withDefaults(
  defineProps<{
    current?: OnboardingWizardStepId | string | null
    stepIndex?: number
    totalSteps?: number
  }>(),
  {
    current: 'profile',
    stepIndex: undefined,
    totalSteps: 5,
  },
)

const activeIndex = computed(() => {
  if (typeof props.stepIndex === 'number') {
    return props.stepIndex
  }
  switch (props.current) {
    case 'profile': return 0
    case 'branding': return 1
    case 'select_model':
    case 'select_plan':
    case 'plan': return 2
    case 'payment': return 3
    case 'channels':
    case 'pms':
    case 'import':
    case 'reconnect':
    case 'done':
    case 'completed': return 4
    default: return 0
  }
})
</script>

<template>
  <div class="flex items-center gap-1.5" aria-label="Setup progress">
    <span
      v-for="index in totalSteps"
      :key="index"
      class="h-1.5 rounded-full transition-all duration-300"
      :class="(index - 1) === activeIndex
        ? 'w-6 bg-foreground'
        : 'w-1.5 bg-muted-foreground/30'"
    />
  </div>
</template>
