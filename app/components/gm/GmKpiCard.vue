<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    label: string
    value: string
    icon: string
    /** Signed change, already formatted (`+12.5%`, `-2.0 pts`). */
    delta?: string
    /** Whether the change is good or bad news, not merely its sign. */
    trend?: 'up' | 'down' | 'flat'
    /** One line under the value: what the number is measured against. */
    hint?: string
    compact?: boolean
  }>(),
  {
    compact: false,
  },
)

const trendIcon = computed(() => {
  if (props.trend === 'up')
    return 'lucide:trending-up'
  if (props.trend === 'down')
    return 'lucide:trending-down'
  return 'lucide:minus'
})

const trendClass = computed(() => {
  if (props.trend === 'up')
    return 'border-green-500/30 text-green-700 dark:text-green-400'
  if (props.trend === 'down')
    return 'border-red-500/30 text-red-700 dark:text-red-400'
  return 'text-muted-foreground'
})
</script>

<template>
  <Card
    class="@container/card"
    :class="[
      props.compact ? 'py-3 gap-1.5 px-0 shadow-xs' : '',
    ]"
  >
    <CardHeader :class="props.compact ? 'px-4 gap-1' : ''">
      <CardDescription class="flex items-center gap-1.5" :class="props.compact ? 'text-xs' : ''">
        <Icon :name="icon" class="size-3.5" />
        {{ label }}
      </CardDescription>
      <CardTitle
        class="font-semibold tabular-nums"
        :class="props.compact ? 'text-xl @[250px]/card:text-2xl' : 'text-2xl font-semibold tabular-nums @[250px]/card:text-3xl'"
      >
        {{ value }}
      </CardTitle>
      <CardAction v-if="delta">
        <Badge variant="outline" :class="[trendClass, props.compact ? 'text-[10px] px-1.5 py-0' : '']">
          <Icon :name="trendIcon" class="size-3.5" />
          {{ delta }}
        </Badge>
      </CardAction>
    </CardHeader>
    <CardFooter
      v-if="hint"
      class="text-muted-foreground"
      :class="props.compact ? 'px-4 text-[11px]' : 'text-sm'"
    >
      <span class="line-clamp-1">{{ hint }}</span>
    </CardFooter>
  </Card>
</template>
