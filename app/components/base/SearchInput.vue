<script setup lang="ts">
import { cn } from '@/lib/utils'
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '~/components/ui/input-group'

/**
 * The search field every page uses: the Listings page `InputGroup` (search icon left, clear X right once there is text).
 * Width comes from the caller's `class`; the default fills its container up to `max-w-xs`.
 */
const props = withDefaults(defineProps<{
  placeholder?: string
  ariaLabel?: string
  class?: string
}>(), { placeholder: 'Search...', ariaLabel: undefined, class: undefined })

const model = defineModel<string>({ default: '' })
const label = computed(() => props.ariaLabel ?? props.placeholder.replace(/\.{3}$/, ''))
</script>

<template>
  <InputGroup :class="cn('h-9 w-full min-w-[200px] sm:max-w-xs', props.class)">
    <InputGroupAddon>
      <Icon name="lucide:search" />
    </InputGroupAddon>
    <InputGroupInput v-model="model" :placeholder="placeholder" :aria-label="label" />
    <InputGroupAddon v-if="model" align="inline-end">
      <InputGroupButton size="icon-xs" aria-label="Clear search" @click="model = ''">
        <Icon name="lucide:x" />
      </InputGroupButton>
    </InputGroupAddon>
  </InputGroup>
</template>
