<script setup lang="ts">
import type { ChecklistItemStatus } from '~/components/onboarding/data/onboarding'
import { checklistItemMeta } from '~/components/onboarding/data/onboarding'

const { state, progress, showChecklist, skipChecklistItem } = useOnboarding()

const collapsed = ref(false)

/**
 * Items that do not apply to this tenant's model are dropped entirely rather
 * than shown greyed out. Nothing here is ticked by hand: status comes from
 * system events (PRD 7.5).
 */
const items = computed(() =>
  state.value.checklist
    .filter(item => item.status !== 'not_applicable')
    .map(item => ({ ...item, meta: checklistItemMeta(item.code) })))

const percent = computed(() =>
  progress.value.total === 0 ? 0 : Math.round((progress.value.done / progress.value.total) * 100))

const statusStyles: Record<ChecklistItemStatus, string> = {
  done: 'border-green-500/30 bg-green-500/10 text-green-700',
  skipped: 'border-muted-foreground/30 bg-muted text-muted-foreground',
  todo: 'border-input',
  not_applicable: 'border-input',
}
</script>

<template>
  <Card v-if="showChecklist" data-testid="onboarding-checklist">
    <CardHeader>
      <CardTitle class="text-base">
        Finish setting up ELEV8
      </CardTitle>
      <CardDescription>
        {{ progress.done }} of {{ progress.total }} done. These tick themselves off as you go.
      </CardDescription>
      <CardAction>
        <Button variant="ghost" size="sm" @click="collapsed = !collapsed">
          {{ collapsed ? 'Expand' : 'Collapse' }}
          <Icon :name="collapsed ? 'lucide:chevron-down' : 'lucide:chevron-up'" class="ml-1.5 size-4" />
        </Button>
      </CardAction>
    </CardHeader>
    <CardContent class="flex flex-col gap-4">
      <Progress :model-value="percent" class="h-1.5" />

      <ul v-if="!collapsed" class="flex flex-col gap-2">
        <li
          v-for="item in items"
          :key="item.code"
          class="flex items-center justify-between gap-3 rounded-lg border p-3"
          :class="statusStyles[item.status]"
        >
          <div class="flex min-w-0 items-start gap-3">
            <span
              class="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border"
              :class="item.status === 'done'
                ? 'border-green-600 bg-green-600 text-white'
                : item.status === 'skipped'
                  ? 'border-muted-foreground/40 text-muted-foreground'
                  : 'border-input'"
            >
              <Icon v-if="item.status === 'done'" name="lucide:check" class="size-3" />
              <Icon v-else-if="item.status === 'skipped'" name="lucide:minus" class="size-3" />
              <Icon v-else :name="item.meta.icon" class="size-3 text-muted-foreground" />
            </span>
            <div class="min-w-0">
              <p class="text-sm font-medium" :class="item.status === 'done' ? 'text-green-800' : ''">
                {{ item.meta.title }}
                <span v-if="item.meta.optional" class="ml-1 text-xs font-normal text-muted-foreground">optional</span>
              </p>
              <p class="text-xs" :class="item.status === 'done' ? 'text-green-700' : 'text-muted-foreground'">
                {{ item.meta.description }}
              </p>
            </div>
          </div>
          <div v-if="item.status === 'todo'" class="flex shrink-0 items-center gap-1">
            <Button v-if="item.meta.optional" variant="ghost" size="sm" @click="skipChecklistItem(item.code)">
              Skip
            </Button>
            <Button as-child variant="outline" size="sm">
              <NuxtLink :to="item.meta.link">
                {{ item.meta.cta }}
              </NuxtLink>
            </Button>
          </div>
        </li>
      </ul>
    </CardContent>
  </Card>
</template>
