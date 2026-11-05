<script setup lang="ts">
import { onBeforeUnmount } from 'vue'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '~/components/ui/empty'
import { Tabs, TabsList, TabsTrigger } from '~/components/ui/tabs'
import { bannerKind, lastActivityAt, maintenancePhase } from '~/components/platform-console/data/banners'
import { useBannerViewer } from '~/composables/useBannerViewer'
import { usePlatformBanners } from '~/composables/usePlatformBanners'
import { useViewerTimezone } from '~/composables/useViewerTimezone'
import { formatCountdown, formatInstant, formatWindowForViewer } from '~/lib/platform-banner-time'

const { tenantId, role } = useBannerViewer()
const { announcementsForTenant, dismiss } = usePlatformBanners()
const viewerZone = useViewerTimezone()

const tab = ref<'active' | 'earlier'>('active')
const all = computed(() => announcementsForTenant(tenantId, role))
const active = computed(() => all.value.filter(a => a.state !== 'ended'))
const earlier = computed(() => all.value.filter(a => a.state === 'ended'))
const shown = computed(() => tab.value === 'active' ? active.value : earlier.value)

// Maintenance that has not finished, soonest first. Countdowns start empty so server and client agree.
const now = ref(0)
let tick: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  now.value = Date.now()
  tick = setInterval(() => { now.value = Date.now() }, 30_000)
})
onBeforeUnmount(() => clearInterval(tick))

const planned = computed(() => active.value
  .map(a => a.banner)
  .filter(b => bannerKind(b) === 'maintenance' && b.maintenance && !b.resolvedAt)
  .sort((a, b) => a.maintenance!.startAt.localeCompare(b.maintenance!.startAt)))

function countdown(b: (typeof planned.value)[number]): string {
  const w = b.maintenance
  if (!w || !now.value) return ''
  const phase = maintenancePhase(b, now.value)
  if (phase === 'upcoming') return `Starts in ${formatCountdown(new Date(w.startAt).getTime(), now.value)}`
  if (phase === 'in_progress') return `Ends in ${formatCountdown(new Date(w.endAt).getTime(), now.value)}`
  return 'Wrapping up'
}
</script>

<template>
  <div class="space-y-4">
    <div>
      <h2 class="text-2xl font-semibold tracking-tight">
        Announcements
      </h2>
      <p class="text-sm text-muted-foreground">
        Maintenance notices and product news from the Elev8 team.
      </p>
    </div>

    <div class="grid gap-4 xl:grid-cols-4">
      <div class="space-y-3 xl:col-span-3">
        <Tabs v-model="tab">
          <TabsList>
            <TabsTrigger value="active">
              Active <span class="ml-1.5 text-xs text-muted-foreground tabular-nums">{{ active.length }}</span>
            </TabsTrigger>
            <TabsTrigger value="earlier">
              Earlier <span class="ml-1.5 text-xs text-muted-foreground tabular-nums">{{ earlier.length }}</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <Empty v-if="!shown.length" class="border" data-testid="announcements-empty">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Icon name="lucide:megaphone" />
            </EmptyMedia>
            <EmptyTitle>{{ tab === 'active' ? 'Nothing active' : 'Nothing earlier' }}</EmptyTitle>
            <EmptyDescription>
              {{ tab === 'active' ? 'Notices from Elev8 show up here, including ones you dismissed.' : 'Ended notices are kept here.' }}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>

        <ul v-else-if="tab === 'active'" class="space-y-3" data-testid="announcements-active">
          <li v-for="a in shown" :key="a.banner.id" class="space-y-1.5">
            <PlatformConsoleBannerCard :banner="a.banner" :max-updates="10" />
            <div class="flex items-center gap-2 px-1 text-xs text-muted-foreground">
              <template v-if="a.dismissed">
                <Icon name="lucide:eye-off" class="size-3.5" />
                Dismissed from your dashboard
              </template>
              <Button
                v-else-if="a.banner.dismissible"
                variant="ghost"
                size="sm"
                class="h-auto px-1.5 py-1 text-xs text-muted-foreground"
                @click="dismiss(a.banner.id, tenantId)"
              >
                <Icon name="lucide:eye-off" class="mr-1 size-3.5" />
                Hide from dashboard
              </Button>
            </div>
          </li>
        </ul>

        <ul v-else class="space-y-2" data-testid="announcements-earlier">
          <li v-for="a in shown" :key="a.banner.id">
            <Card class="py-0">
              <CardContent class="space-y-1.5 p-4">
                <div class="flex items-start justify-between gap-2">
                  <span class="text-sm font-medium">{{ a.banner.title }}</span>
                  <Badge variant="outline" class="shrink-0 text-[11px]">
                    {{ a.banner.resolvedAt ? 'Resolved' : 'Ended' }}
                  </Badge>
                </div>
                <p class="text-sm text-muted-foreground">
                  {{ a.banner.body }}
                </p>
                <ul v-if="a.banner.updates?.length" class="space-y-1 border-t pt-2 text-sm">
                  <li v-for="u in a.banner.updates" :key="u.id" class="flex items-start gap-2">
                    <Icon :name="u.kind === 'resolved' ? 'lucide:circle-check' : 'lucide:message-square-text'" class="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                    {{ u.message }}
                  </li>
                </ul>
                <div class="text-xs text-muted-foreground">
                  {{ formatInstant(lastActivityAt(a.banner), viewerZone) }}
                </div>
              </CardContent>
            </Card>
          </li>
        </ul>
      </div>

      <div class="xl:col-span-1">
        <Card data-testid="planned-maintenance">
          <CardHeader class="pb-0">
            <CardTitle class="flex items-center gap-2 text-sm">
              <Icon name="lucide:wrench" class="size-4 text-muted-foreground" />
              Planned maintenance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p v-if="!planned.length" class="text-sm text-muted-foreground">
              Nothing planned. We tell you here before any downtime.
            </p>
            <ul v-else class="divide-y">
              <li v-for="b in planned" :key="b.id" class="space-y-1.5 py-3 first:pt-0 last:pb-0">
                <div class="text-sm font-medium">
                  {{ b.title }}
                </div>
                <div class="text-xs">
                  {{ formatWindowForViewer(b.maintenance!.startAt, b.maintenance!.endAt, viewerZone).local }}
                </div>
                <div v-if="countdown(b)" class="text-xs font-medium text-muted-foreground">
                  {{ countdown(b) }}
                </div>
                <div class="flex flex-wrap gap-1">
                  <Badge v-for="m in b.maintenance!.affected" :key="m" variant="secondary" class="text-[11px]">
                    {{ m }}
                  </Badge>
                </div>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  </div>
</template>
