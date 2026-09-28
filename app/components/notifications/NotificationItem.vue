<script setup lang="ts">
import type { Alert } from '~/components/notifications/data/alerts'
import { formatDistanceToNow } from 'date-fns'
import { alertDisplayLabels, alertIcons, getDescription as getAlertDescription } from '~/components/notifications/data/alerts'

const props = defineProps<{
  alert: Alert
  kind?: string
}>()

const emit = defineEmits<{
  click: [alert: Alert]
}>()

const severityClasses = computed(() => {
  if (props.alert.status === 'RESOLVED') {
    return { bg: 'bg-white hover:bg-muted/30', border: 'border-l-4 border-muted' }
  }
  return props.alert.severity === 'CRITICAL'
    ? { bg: 'bg-red-50/50 hover:bg-red-50', border: 'border-l-4 border-red-500' }
    : props.alert.severity === 'WARNING'
      ? { bg: 'bg-amber-50/50 hover:bg-amber-50', border: 'border-l-4 border-amber-500' }
      : { bg: 'bg-muted/30 hover:bg-muted/50', border: 'border-l-4 border-primary/40' }
})

const alertIcon = computed(() => alertIcons[props.alert.type] || 'i-lucide-bell')

function handleClick() {
  emit('click', props.alert)
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    emit('click', props.alert)
  }
}

const displayLabel = computed(() => alertDisplayLabels[props.alert.type])
const description = computed(() => getAlertDescription(props.alert.type, props.alert.context))
const hasAiSummary = computed(() => props.alert.type === 'CALL_COMPLETED' && props.alert.context.aiSummary)

function getTimeAgo(isoString: string): string {
  return formatDistanceToNow(new Date(isoString), { addSuffix: true })
}
</script>

<template>
  <div
    role="button"
    tabindex="0"
    class="flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors border-b border-border/50 last:border-b-0"
    :class="[severityClasses.bg, severityClasses.border]"
    @click="handleClick"
    @keydown="handleKeydown"
  >
    <Icon
      :name="alertIcon"
      class="mt-0.5 size-4 shrink-0 text-foreground/50"
    />
    <div class="flex-1 min-w-0">
      <p class="text-sm font-medium truncate">
        {{ displayLabel }}
      </p>
      <p class="text-xs text-muted-foreground truncate mt-0.5">
        {{ description }}
      </p>
      <p v-if="hasAiSummary" class="inline-flex items-center gap-1 text-xs text-[#C8A84B] mt-1">
        <Icon name="elev8:elevai" class="size-3" />
        <span class="truncate">AI Summary</span>
      </p>
      <p class="text-xs text-muted-foreground/70 mt-0.5">
        {{ getTimeAgo(props.alert.triggered_at) }}
      </p>
    </div>
  </div>
</template>
