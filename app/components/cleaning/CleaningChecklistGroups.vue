<script setup lang="ts">
import type { CleaningGuidance } from '~/components/cleaning/data/cleaning-guidance'
import type { CleaningChecklistItem } from '~/components/cleaning/data/cleaning-jobs'
import CleaningGuidanceDialog from '~/components/cleaning/CleaningGuidanceDialog.vue'
import { checklistItemError, CLEANING_CHECKLIST_STATUS_LABELS } from '~/components/cleaning/data/cleaning-jobs'
import { useCleaningGuidance } from '~/composables/useCleaningGuidance'

/**
 * A cleaning checklist as collapsible sections of item cards. One component for
 * both states of the same list, so they look alike:
 * - the report (`CleaningReportPanel`): items answered OK or Problem, with
 *   notes, photos and who checked them;
 * - a job not done yet (`CleaningJobChecklist`): the steps copied from the
 *   listing, no answer yet, shown as "Not checked".
 */
type ChecklistItemView = Pick<CleaningChecklistItem, 'id' | 'label'> & Partial<Omit<CleaningChecklistItem, 'id' | 'label'>> & {
  /** Guidance attached to the step (live, `useCleaningGuidance`); only steps carry it, report items do not. */
  guidanceIds?: string[]
}

const props = withDefaults(defineProps<{
  groups: Array<{ id: string, title: string, items: ChecklistItemView[] }>
  /** The `ImageViewer` scope a problem photo opens in; the caller renders that viewer. */
  viewerScope?: string
}>(), {
  viewerScope: 'cleaning-report',
})

const viewer = useImageViewer(props.viewerScope)

const { resolveGuidance } = useCleaningGuidance()
const guidanceOpen = ref(false)
const shownGuidance = ref<CleaningGuidance | null>(null)

function openGuidance(g: CleaningGuidance) {
  shownGuidance.value = g
  guidanceOpen.value = true
}

/** Photos that failed to load, so each one falls back to a stated placeholder. */
const brokenPhotos = ref<Set<string>>(new Set())
function markBroken(url: string) {
  brokenPhotos.value = new Set([...brokenPhotos.value, url])
}

// Every section starts open, including ones that arrive later.
const openGroups = ref<Set<string>>(new Set(props.groups.map(g => g.id)))
watch(() => props.groups.map(g => g.id).join('|'), () => {
  openGroups.value = new Set(props.groups.map(g => g.id))
})

function toggleGroup(id: string) {
  const next = new Set(openGroups.value)
  if (next.has(id))
    next.delete(id)
  else next.add(id)
  openGroups.value = next
}

function formatTime(value?: string) {
  if (!value)
    return ''
  return new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
}
</script>

<template>
  <div class="space-y-3">
    <div
      v-for="group in groups"
      :key="group.id"
      class="overflow-hidden rounded-lg border bg-muted/20"
      :data-testid="`checklist-group-${group.id}`"
    >
      <button
        type="button"
        class="flex w-full items-center justify-between px-4 py-3 text-left"
        @click="toggleGroup(group.id)"
      >
        <span class="text-sm font-semibold">
          {{ group.title }}
        </span>
        <Icon
          :name="openGroups.has(group.id) ? 'lucide:chevron-up' : 'lucide:chevron-down'"
          class="h-4 w-4 text-muted-foreground"
        />
      </button>
      <div v-if="openGroups.has(group.id)" class="space-y-2 border-t bg-background p-3">
        <div
          v-for="item in group.items"
          :key="item.id"
          class="rounded-md border bg-card p-3"
          :class="item.status === 'problem' ? 'border-destructive/50' : ''"
          :data-testid="`checklist-item-${item.id}`"
          :data-status="item.status ?? 'pending'"
        >
          <p class="text-sm leading-snug">
            {{ item.label }}
          </p>
          <div v-if="resolveGuidance(item.guidanceIds).length" class="mt-1.5 flex flex-wrap gap-1.5" data-testid="checklist-item-guidance">
            <button
              v-for="g in resolveGuidance(item.guidanceIds)"
              :key="g.id"
              type="button"
              class="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary transition-colors hover:bg-primary/20"
              :aria-label="`Open guidance: ${g.title}`"
              @click="openGuidance(g)"
            >
              <Icon :name="g.videos.length ? 'lucide:circle-play' : 'lucide:book-open'" class="size-3" />
              {{ g.title }}
            </button>
          </div>
          <p
            v-if="item.notes"
            class="mt-1 text-xs italic"
            :class="item.status === 'problem' ? 'text-destructive' : 'text-muted-foreground'"
          >
            {{ item.notes }}
          </p>
          <div v-if="item.status === 'problem' && item.photoUrls?.length" class="mt-2 flex flex-wrap gap-2">
            <template v-for="url in item.photoUrls" :key="url">
              <button
                v-if="!brokenPhotos.has(url)"
                type="button"
                class="block cursor-zoom-in overflow-hidden rounded-md border transition-opacity hover:opacity-80"
                :aria-label="`View photo full size: ${item.notes || item.label}`"
                data-testid="checklist-problem-photo-open"
                @click="viewer.openImage({ url, caption: item.notes || item.label, senderName: item.completedBy, timestamp: item.completedAt })"
              >
                <img
                  :src="url"
                  :alt="item.notes || item.label"
                  class="size-20 object-cover"
                  data-testid="checklist-problem-photo"
                  @error="markBroken(url)"
                >
              </button>
              <span
                v-else
                class="flex size-20 items-center justify-center rounded-md border bg-muted text-center text-[10px] text-muted-foreground"
              >
                Photo unavailable
              </span>
            </template>
          </div>
          <p
            v-if="item.status && checklistItemError({ status: item.status, photoUrls: item.photoUrls })"
            class="mt-2 flex items-center gap-1.5 text-xs text-destructive"
            data-testid="checklist-problem-no-photo"
          >
            <Icon name="lucide:camera-off" class="size-3.5 shrink-0" />
            No photo attached. A problem must carry one.
          </p>
          <div class="mt-2 flex items-center gap-2 text-xs">
            <span
              v-if="item.status"
              class="inline-flex h-5 items-center rounded-full px-2 text-[10px] font-bold uppercase"
              :class="item.status === 'problem' ? 'bg-destructive/15 text-destructive' : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'"
            >
              {{ CLEANING_CHECKLIST_STATUS_LABELS[item.status] ?? item.status }}
            </span>
            <span
              v-else
              class="inline-flex h-5 items-center rounded-full bg-muted px-2 text-[10px] font-bold uppercase text-muted-foreground"
              data-testid="checklist-item-pending"
            >
              Not checked
            </span>
            <span v-if="item.completedBy" class="text-muted-foreground italic">
              By <span class="font-medium not-italic text-foreground">{{ item.completedBy }}</span><span v-if="item.completedAt">, {{ formatTime(item.completedAt) }}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
    <CleaningGuidanceDialog v-model:open="guidanceOpen" :guidance="shownGuidance" />
  </div>
</template>
