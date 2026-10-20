<script setup lang="ts">
// One-question screen: picking an answer moves on, as in the mobile onboarding.
defineProps<{
  title: string
  options: readonly { value: string, label: string, icon: string }[]
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'next': []
}>()

function pick(value: string) {
  emit('update:modelValue', value)
  emit('next')
}
</script>

<template>
  <div class="flex w-full flex-col items-center py-8">
    <h2 class="text-center text-3xl font-semibold tracking-tight">
      {{ title }}
    </h2>

    <div class="mt-8 flex max-w-xl flex-wrap justify-center gap-3" role="radiogroup" :aria-label="title">
      <button
        v-for="option in options"
        :key="option.value"
        type="button"
        role="radio"
        :aria-checked="modelValue === option.value"
        class="flex items-center gap-2 rounded-full border-2 bg-background px-6 py-3 text-sm font-medium transition-colors"
        :class="modelValue === option.value ? 'border-primary' : 'border-border hover:border-muted-foreground/50'"
        :data-testid="`wz-option-${option.value}`"
        @click="pick(option.value)"
      >
        <Icon :name="option.icon" class="size-4" aria-hidden="true" />
        {{ option.label }}
      </button>
    </div>

    <button
      type="button"
      class="mt-12 text-sm text-muted-foreground transition-colors hover:text-foreground"
      data-testid="wz-skip"
      @click="emit('next')"
    >
      Skip, I'll set this later.
    </button>
  </div>
</template>
