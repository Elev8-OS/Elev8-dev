<script setup lang="ts">
import type { OnboardingWizardStepId } from '~/components/onboarding/data/onboarding'

const props = withDefaults(
  defineProps<{
    current?: OnboardingWizardStepId | string | null
    stepIndex?: number
    totalSteps?: number
    progress?: number
  }>(),
  {
    current: 'profile',
    stepIndex: undefined,
    totalSteps: 5,
    progress: undefined,
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

const percentage = computed(() => {
  if (typeof props.progress === 'number') {
    return Math.min(100, Math.max(0, props.progress))
  }
  const step = Math.min(props.totalSteps - 1, Math.max(0, activeIndex.value))
  return Math.round(((step + 1) / props.totalSteps) * 100)
})
</script>

<template>
  <div
    class="fixed inset-x-0 top-0 z-50 h-2.5 w-full bg-muted-foreground/15"
    role="progressbar"
    :aria-valuenow="percentage"
    aria-valuemin="0"
    aria-valuemax="100"
    aria-label="Setup progress"
  >
    <div
      class="h-full bg-[#F6BB12] transition-all duration-500 ease-out"
      :style="{ width: `${percentage}%` }"
    />
  </div>
</template>
