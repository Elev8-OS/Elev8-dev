<script setup lang="ts">
import type { CockpitLogKind } from '~/composables/useCockpitLog'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '~/components/ui/sheet'
import { COCKPIT_LOG_KINDS, useCockpitLog } from '~/composables/useCockpitLog'

/**
 * The Cockpit's change history (`useCockpitLog`): who changed what from the
 * board, newest first, by day, with a filter per kind. An entry about a
 * reservation opens it.
 */
const props = defineProps<{ todayKey: string }>()
const emit = defineEmits<{ openReservation: [id: string] }>()
const open = defineModel<boolean>('open', { default: false })

const { entries } = useCockpitLog()
const kind = ref<CockpitLogKind | null>(null)

const KIND_META = Object.fromEntries(COCKPIT_LOG_KINDS.map(k => [k.key, k])) as Record<CockpitLogKind, typeof COCKPIT_LOG_KINDS[number]>

function keyOf(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** The local day of a change (`toISOString` would shift it to UTC). */
function localKey(iso: string) {
  return keyOf(new Date(iso))
}

function dayLabel(key: string) {
  const [ty, tm, td] = props.todayKey.split('-').map(Number)
  if (key === props.todayKey)
    return 'Today'
  if (key === keyOf(new Date(ty!, tm! - 1, td! - 1)))
    return 'Yesterday'
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y!, m! - 1, d!).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

function time(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

const counts = computed(() => Object.fromEntries(COCKPIT_LOG_KINDS.map(k => [k.key, entries.value.filter(e => e.kind === k.key).length])) as Record<CockpitLogKind, number>)

/** Shown entries, by local day, newest first. */
const days = computed(() => {
  const groups = new Map<string, typeof entries.value>()
  for (const entry of entries.value) {
    if (kind.value && entry.kind !== kind.value)
      continue
    const key = localKey(entry.at)
    groups.set(key, [...(groups.get(key) ?? []), entry])
  }
  return [...groups].map(([key, list]) => ({ key, label: dayLabel(key), list }))
})

function openEntry(id?: string) {
  if (!id)
    return
  open.value = false
  emit('openReservation', id)
}
</script>

<template>
  <Sheet v-model:open="open">
    <SheetContent class="flex w-full flex-col gap-0 p-0 sm:max-w-md" side="right" data-testid="cockpit-history">
      <SheetHeader class="border-b px-6 py-4">
        <SheetTitle>Change history</SheetTitle>
        <SheetDescription>
          What was changed from the Cockpit, by whom and when.
        </SheetDescription>
      </SheetHeader>

      <div class="flex flex-wrap gap-2 border-b px-6 py-3" role="group" aria-label="Show">
        <button
          type="button"
          class="flex h-7 items-center gap-1.5 rounded-full border px-3 text-xs transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          :class="kind === null ? 'border-foreground bg-foreground text-background' : 'bg-card hover:bg-accent'"
          :aria-pressed="kind === null"
          @click="kind = null"
        >
          All
          <span class="font-semibold tabular-nums">{{ entries.length }}</span>
        </button>
        <button
          v-for="k in COCKPIT_LOG_KINDS"
          :key="k.key"
          type="button"
          class="flex h-7 items-center gap-1.5 rounded-full border px-3 text-xs transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          :class="kind === k.key ? 'border-foreground bg-foreground text-background' : 'bg-card hover:bg-accent'"
          :aria-pressed="kind === k.key"
          :data-testid="`cockpit-history-filter-${k.key}`"
          @click="kind = kind === k.key ? null : k.key"
        >
          <Icon :name="k.icon" class="size-3.5" />
          {{ k.label }}
          <span class="font-semibold tabular-nums">{{ counts[k.key] }}</span>
        </button>
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto px-6 py-4">
        <div v-if="!days.length" class="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground" data-testid="cockpit-history-empty">
          <Icon name="lucide:history" class="size-6" />
          <p>{{ entries.length ? 'Nothing of this kind yet.' : 'No changes yet. Bookings, blocks, room moves and overrides made on the board show here.' }}</p>
        </div>

        <section v-for="day in days" :key="day.key" class="mb-5 last:mb-0">
          <h3 class="mb-2 text-xs font-medium text-muted-foreground">
            {{ day.label }}
          </h3>
          <ol class="relative flex flex-col gap-3 border-l pl-5">
            <li v-for="entry in day.list" :key="entry.id" class="relative" data-testid="cockpit-history-entry">
              <span class="absolute top-0.5 -left-[1.95rem] flex size-6 items-center justify-center rounded-full border bg-card text-muted-foreground">
                <Icon :name="KIND_META[entry.kind].icon" class="size-3.5" />
              </span>
              <component
                :is="entry.reservationId ? 'button' : 'div'"
                :type="entry.reservationId ? 'button' : undefined"
                class="block w-full rounded-md text-left"
                :class="entry.reservationId && 'hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none -mx-2 px-2 py-1'"
                :aria-label="entry.reservationId ? `${entry.title}. ${entry.detail} Open the reservation.` : undefined"
                @click="openEntry(entry.reservationId)"
              >
                <p class="text-sm font-medium">
                  {{ entry.title }}
                </p>
                <p class="text-sm text-muted-foreground">
                  {{ entry.detail }}
                </p>
                <p class="mt-0.5 text-xs text-muted-foreground">
                  <span class="font-medium text-foreground">{{ entry.actor }}</span> · {{ time(entry.at) }}<template v-if="entry.listingName">
                    · {{ entry.listingName }}
                  </template>
                </p>
              </component>
            </li>
          </ol>
        </section>
      </div>
    </SheetContent>
  </Sheet>
</template>
