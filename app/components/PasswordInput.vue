<script setup lang="ts">
import type { ComponentFieldBindingObject } from 'vee-validate'
import type { HTMLAttributes } from 'vue'
import { cn } from '~/lib/utils'

// The root element is a positioning wrapper, so `id` / `aria-*` must land on
// the inner Input instead. Otherwise a `<Label for>` or `<FormControl>` points
// at a div and clicking the label never focuses the field.
defineOptions({ inheritAttrs: false })

const props = defineProps<{
  class?: HTMLAttributes['class']
  disabled?: boolean
  componentField?: ComponentFieldBindingObject<any>
  autocomplete?: string
  modelValue?: string
  placeholder?: string
}>()

const attrs = useAttrs()
const forwardedAttrs = computed(() => {
  const { class: _class, style: _style, ...rest } = attrs
  return rest
})

const showModal = useModel(props, 'modelValue')

const showPassword = ref(false)
</script>

<template>
  <div class="relative">
    <Input
      v-model="showModal"
      :type="showPassword ? 'text' : 'password'"
      :class="cn('pr-10', props?.class)"
      :placeholder="props?.placeholder ? props.placeholder : 'Enter your password'"
      :disabled="props?.disabled"
      :autocomplete="props?.autocomplete"
      v-bind="{ ...forwardedAttrs, ...props?.componentField }"
    />
    <Button
      type="button"
      variant="ghost"
      size="icon"
      class="absolute right-0 top-0 h-full px-2 py-2 hover:bg-transparent"
      :disabled="props?.disabled"
      @click="showPassword = !showPassword"
    >
      <Icon
        v-if="showPassword"
        name="i-lucide-eye"
        class="size-4"
        aria-hidden="true"
      />
      <Icon v-else name="i-lucide-eye-off" class="size-4" aria-hidden="true" />
      <span class="sr-only">
        {{ showPassword ? "Hide password" : "Show password" }}
      </span>
    </Button>
  </div>
</template>
