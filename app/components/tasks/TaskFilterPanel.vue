<script setup lang="ts">
import type { ColumnFiltersState } from '@tanstack/vue-table'
import type { FilterOption } from '~/composables/useAnalytics'
import AnalyticsFilterCheckList from '@/components/analytics/AnalyticsFilterCheckList.vue'
import { listings } from '@/components/listings/data/listings'
import { assigneeOptions, priorities, statuses } from '@/components/tasks/data/data'
import { BALI_LISTINGS } from '@/components/upsells/data/upsell-services'
import { shortListingName } from './components/columns'

// Every /tasks filter except the title search, stacked like the Analytics
// sidebar. Rendered pinned beside the table on wide screens and in a Sheet
// below that; both edit the same column filters the table reads.

const emit = defineEmits<{ close: [] }>()
const filters = defineModel<ColumnFiltersState>({ required: true })

/** The title search lives in the table toolbar, so Reset all leaves it alone. */
const PANEL_IDS = ['assignee', 'listing', 'listingTags', 'status', 'priority', 'ownerVisible', 'scheduled'] as const
type PanelId = typeof PANEL_IDS[number]

interface Section {
  key: PanelId
  label: string
  icon: string
  options: FilterOption[]
}

const sections: Section[] = [
  { key: 'assignee', label: 'Assignee', icon: 'lucide:user-check', options: assigneeOptions.map(o => ({ value: o.value, label: o.label, hint: o.type === 'role' ? 'Role' : 'Person' })) },
  { key: 'listing', label: 'Listing', icon: 'lucide:building-2', options: BALI_LISTINGS.map(l => ({ value: l, label: shortListingName(l) })) },
  { key: 'listingTags', label: 'Listing tags', icon: 'lucide:tag', options: [...new Set(listings.value.flatMap(l => l.tags))].sort((a, b) => a.localeCompare(b)).map(t => ({ value: t, label: t })) },
  { key: 'status', label: 'Status', icon: 'lucide:circle-dot', options: statuses.map(s => ({ value: s.value, label: s.label, icon: s.iconName, iconClass: s.iconClass })) },
  { key: 'priority', label: 'Priority', icon: 'lucide:flag', options: priorities.map(p => ({ value: p.value, label: p.label, icon: 'lucide:flag', iconClass: p.iconClass })) },
  { key: 'ownerVisible', label: 'Owner', icon: 'lucide:user-round', options: [{ value: 'true', label: 'Owner maintenance' }] },
  { key: 'scheduled', label: 'Scheduled', icon: 'lucide:repeat', options: [{ value: 'true', label: 'From a schedule' }] },
]

function selected(key: PanelId): string[] {
  return (filters.value.find(f => f.id === key)?.value as string[] | undefined) ?? []
}

function setSelected(key: PanelId, values: string[]) {
  const rest = filters.value.filter(f => f.id !== key)
  filters.value = values.length ? [...rest, { id: key, value: values }] : rest
}

function toggle(key: PanelId, value: string) {
  const current = selected(key)
  setSelected(key, current.includes(value) ? current.filter(v => v !== value) : [...current, value])
}

const activeCount = computed(() => PANEL_IDS.filter(id => selected(id).length > 0).length)

function resetAll() {
  filters.value = filters.value.filter(f => !(PANEL_IDS as readonly string[]).includes(f.id))
}

/** Short lists start open; long ones open once something in them is picked. */
const openSections = ref<Record<string, boolean>>(Object.fromEntries(
  sections.map(s => [s.key, s.options.length < 7 || selected(s.key).length > 0]),
))
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <div class="flex items-center justify-between gap-2 border-b px-4 py-3">
      <div class="flex items-center gap-2">
        <Icon name="lucide:sliders-horizontal" class="size-4" />
        <span class="text-sm font-semibold">Filters</span>
        <Badge v-if="activeCount" variant="default" class="h-4 min-w-4 rounded-full px-1 text-[9px]">
          {{ activeCount }}
        </Badge>
      </div>
      <div class="flex items-center gap-1">
        <Button variant="ghost" size="sm" class="h-7 px-2 text-xs text-muted-foreground" data-testid="tasks-filters-reset" @click="resetAll">
          Reset all
        </Button>
        <Button variant="ghost" size="icon" class="size-7" aria-label="Hide filters" @click="emit('close')">
          <Icon name="lucide:panel-right-close" class="size-4" />
        </Button>
      </div>
    </div>

    <div class="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 py-4">
      <Collapsible
        v-for="s in sections"
        :key="s.key"
        v-model:open="openSections[s.key]"
        class="flex flex-col gap-2"
      >
        <div class="flex items-center justify-between gap-2">
          <CollapsibleTrigger class="flex flex-1 items-center gap-2 text-left text-sm font-medium" :data-testid="`tasks-filter-section-${s.key}`">
            <Icon :name="s.icon" class="size-3.5 text-muted-foreground" />
            {{ s.label }}
            <Badge v-if="selected(s.key).length" variant="default" class="h-4 min-w-4 rounded-full px-1 text-[9px]">
              {{ selected(s.key).length }}
            </Badge>
            <Icon
              name="lucide:chevron-down"
              class="ml-auto size-4 text-muted-foreground transition-transform"
              :class="openSections[s.key] ? 'rotate-180' : ''"
            />
          </CollapsibleTrigger>
          <Button
            v-if="selected(s.key).length"
            variant="ghost"
            size="sm"
            class="h-6 px-1.5 text-[11px] text-muted-foreground"
            @click="setSelected(s.key, [])"
          >
            Clear
          </Button>
        </div>
        <CollapsibleContent class="flex flex-col gap-1.5">
          <p v-if="s.key === 'listingTags'" class="text-[11px] text-muted-foreground">
            Listings must have every selected tag.
          </p>
          <AnalyticsFilterCheckList
            :name="s.label"
            :options="s.options"
            :selected="selected(s.key)"
            @toggle="(value) => toggle(s.key, value)"
          />
        </CollapsibleContent>
      </Collapsible>
    </div>
  </div>
</template>
