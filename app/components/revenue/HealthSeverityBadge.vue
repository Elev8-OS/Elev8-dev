<script setup lang="ts">
import type { HealthSeverity } from '~/components/revenue/data/health'
import { computed } from 'vue'
import { severityLabels } from '~/components/revenue/data/health'

const props = withDefaults(defineProps<{
  severity: HealthSeverity
  count?: number
  /** Compact drops the icon — used inside dense table cells. */
  compact?: boolean
}>(), { compact: false })

/**
 * Severity is never carried by colour alone: every badge ships an icon and a
 * word. `high` uses the warning token, which is also the brand gold — the one
 * place the theme has no dedicated severity step. See the PR note.
 */
const styles = computed(() => {
  switch (props.severity) {
    case 'critical':
      return { cls: 'text-destructive bg-destructive/10 border-destructive/30', icon: 'lucide:alert-triangle' }
    case 'high':
      return { cls: 'text-warning-foreground bg-warning/25 border-warning/60', icon: 'lucide:alert-circle' }
    case 'medium':
      return { cls: 'text-foreground bg-muted border-border', icon: 'lucide:circle-dot' }
    default:
      return { cls: 'text-muted-foreground bg-muted border-border', icon: 'lucide:circle' }
  }
})

const label = computed(() =>
  props.count === undefined ? severityLabels[props.severity] : `${props.count} ${severityLabels[props.severity].toLowerCase()}`,
)
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-semibold whitespace-nowrap"
    :class="styles.cls"
  >
    <Icon v-if="!compact" :name="styles.icon" class="size-3" />
    {{ label }}
  </span>
</template>
