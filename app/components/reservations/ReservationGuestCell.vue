<script setup lang="ts">
import BasePersonAvatar from '~/components/base/PersonAvatar.vue'

interface Props {
  name: string
  email: string
}

const props = defineProps<Props>()
</script>

<template>
  <div class="flex items-center gap-3">
    <BasePersonAvatar :name="props.name" class="size-9" />
    <div class="min-w-0">
      <p class="flex items-center gap-1.5 text-sm font-medium">
        <span class="truncate">{{ props.name }}</span>
        <!-- Small markers beside the name (e.g. an extended stay) -->
        <slot name="after-name" />
      </p>
      <p class="text-xs text-muted-foreground truncate">
        {{ props.email }}
      </p>
    </div>
  </div>
</template>
