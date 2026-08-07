<script setup lang="ts">
import { Card, CardContent } from '~/components/ui/card'

withDefaults(defineProps<{
  label: string
  value: string
  sublabel?: string
  icon?: string
}>(), {
  sublabel: '',
  icon: '',
})
</script>

<template>
  <Card>
    <CardContent class="space-y-2 p-4">
      <div class="flex items-center justify-between gap-2">
        <p class="text-xs font-medium text-muted-foreground">
          {{ label }}
        </p>
        <Icon v-if="icon" :name="icon" class="size-4 text-muted-foreground" />
      </div>
      <p class="text-2xl font-bold tracking-tight">
        {{ value }}
      </p>
      <p v-if="sublabel" class="text-xs text-muted-foreground">
        {{ sublabel }}
      </p>
      <slot />
    </CardContent>
  </Card>
</template>
