<script setup lang="ts">
import { Icon } from '#components'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { cn } from '@/lib/utils'
import type { PlatformBanner } from './data/banners'
import { bannerKind, maintenancePhase, MAINTENANCE_IMPACT_LABEL, MAINTENANCE_PHASE_LABEL } from './data/banners'
import { useViewerTimezone } from '~/composables/useViewerTimezone'
import { formatInstant, formatWindowForViewer } from '~/lib/platform-banner-time'

const props = withDefaults(defineProps<{
  banner: PlatformBanner
  onDismiss?: () => void
  /** How many of the newest updates to list under the message. */
  maxUpdates?: number
}>(), { onDismiss: undefined, maxUpdates: 2 })

const viewerZone = useViewerTimezone()

const resolved = computed(() => !!props.banner.resolvedAt)
const isMaintenance = computed(() => bannerKind(props.banner) === 'maintenance' && !!props.banner.maintenance)
const phase = computed(() => maintenancePhase(props.banner))
const windowText = computed(() => {
  const w = props.banner.maintenance
  return w ? formatWindowForViewer(w.startAt, w.endAt, viewerZone.value) : null
})

// A coloured edge and icon carry the severity; the text stays in the normal foreground so it reads in both themes.
const tone = computed(() => {
  if (resolved.value) return { edge: 'border-l-primary', wash: 'bg-card', icon: 'bg-primary/10 text-primary' }
  if (props.banner.severity === 'critical') return { edge: 'border-l-destructive', wash: 'bg-destructive/5', icon: 'bg-destructive/10 text-destructive' }
  if (props.banner.severity === 'warning') return { edge: 'border-l-warning', wash: 'bg-warning/10', icon: 'bg-warning/25 text-warning-foreground' }
  return { edge: 'border-l-primary', wash: 'bg-card', icon: 'bg-primary/10 text-primary' }
})

const iconName = computed(() => {
  if (resolved.value) return 'lucide:circle-check'
  if (isMaintenance.value) return 'lucide:wrench'
  if (props.banner.severity === 'critical') return 'lucide:octagon-alert'
  if (props.banner.severity === 'warning') return 'lucide:triangle-alert'
  return 'lucide:info'
})

const updates = computed(() => (props.banner.updates ?? [])
  .slice()
  .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  .slice(0, props.maxUpdates))

function openCta() {
  if (props.banner.ctaUrl) window.open(props.banner.ctaUrl, '_blank', 'noopener')
}
</script>

<template>
  <div
    :class="cn('flex items-start gap-3 rounded-lg border border-l-4 p-4 shadow-xs', tone.edge, tone.wash)"
    data-testid="banner-card"
  >
    <div :class="cn('flex size-8 shrink-0 items-center justify-center rounded-full', tone.icon)">
      <Icon :name="iconName" class="size-4" />
    </div>

    <div class="min-w-0 flex-1 space-y-2.5">
      <div class="flex items-start justify-between gap-2">
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-sm font-semibold leading-6">{{ banner.title }}</span>
          <Badge v-if="phase" variant="outline" class="text-[11px]" data-testid="banner-phase">
            {{ MAINTENANCE_PHASE_LABEL[phase] }}
          </Badge>
          <Badge v-else-if="resolved" variant="outline" class="text-[11px]" data-testid="banner-phase">
            Resolved
          </Badge>
        </div>
        <button
          v-if="banner.dismissible && onDismiss"
          type="button"
          class="-m-1 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Dismiss banner"
          @click="onDismiss"
        >
          <Icon name="lucide:x" class="size-4" />
        </button>
      </div>

      <p class="text-sm text-muted-foreground">{{ banner.body }}</p>

      <div
        v-if="isMaintenance && banner.maintenance && windowText"
        class="space-y-2 rounded-md border bg-background/70 p-3 text-sm"
        data-testid="banner-window"
      >
        <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <Icon name="lucide:clock" class="size-3.5 shrink-0 text-muted-foreground" />
          <span class="font-medium">{{ windowText.local }}</span>
          <span v-if="windowText.utc" class="text-xs text-muted-foreground">({{ windowText.utc }})</span>
        </div>
        <div class="flex flex-wrap items-center gap-1.5">
          <Badge v-for="m in banner.maintenance.affected" :key="m" variant="secondary" class="text-[11px]">{{ m }}</Badge>
          <span class="text-xs text-muted-foreground">{{ MAINTENANCE_IMPACT_LABEL[banner.maintenance.impact] }}</span>
        </div>
      </div>

      <ul v-if="updates.length" class="space-y-1.5 border-t pt-2.5 text-sm" data-testid="banner-updates">
        <li v-for="u in updates" :key="u.id" class="flex items-start gap-2">
          <Icon :name="u.kind === 'resolved' ? 'lucide:circle-check' : 'lucide:message-square-text'" class="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
          <span>
            <span class="text-xs text-muted-foreground">{{ formatInstant(u.createdAt, viewerZone) }}</span>
            <span class="ml-1.5">{{ u.message }}</span>
          </span>
        </li>
      </ul>

      <Button v-if="banner.ctaLabel" variant="outline" size="sm" @click="openCta">
        {{ banner.ctaLabel }}
        <Icon name="lucide:arrow-up-right" class="ml-1 size-3.5" />
      </Button>
    </div>
  </div>
</template>
