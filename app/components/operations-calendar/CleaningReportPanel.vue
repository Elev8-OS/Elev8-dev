<script setup lang="ts">
import type { CleaningFeedback } from '~/components/cleaning/data/cleaning-jobs'
import CleaningChecklistGroups from '~/components/cleaning/CleaningChecklistGroups.vue'
import { problemsMissingPhotos } from '~/components/cleaning/data/cleaning-jobs'
import ImageViewer from '~/components/inbox/ImageViewer.vue'

const props = defineProps<{
  feedback: CleaningFeedback | null | undefined
  isCheckoutCleaning: boolean
  listingName?: string
}>()

const activeTab = ref<'cleanings' | 'linen' | 'guest'>(
  props.isCheckoutCleaning ? 'guest' : 'cleanings',
)

watch(() => props.isCheckoutCleaning, (val) => {
  if (val)
    activeTab.value = 'guest'
})

function formatDateTime(value?: string) {
  if (!value)
    return '—'
  return new Date(value).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function durationLabel(feedback: CleaningFeedback) {
  if (feedback.startedAt && feedback.confirmedAt) {
    const ms = new Date(feedback.confirmedAt).getTime() - new Date(feedback.startedAt).getTime()
    const mins = Math.round(ms / 60000)
    if (mins < 60)
      return `${mins} MINUTES`
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return m ? `${h}H ${m}M` : `${h} HOUR${h > 1 ? 'S' : ''}`
  }
  return `${feedback.cleaningDurationMinutes} MINUTES`
}

/** The panel's own viewer scope: a problem photo opens full size, zoomable (`CleaningChecklistGroups`). */
const VIEWER_SCOPE = 'cleaning-report'

const problemCount = computed(() =>
  (props.feedback?.checklist ?? []).flatMap(g => g.items).filter(i => i.status === 'problem').length,
)
const unphotographed = computed(() => problemsMissingPhotos(props.feedback).length)
</script>

<template>
  <template v-if="feedback">
    <!-- Staff info card -->
    <div class="border-b bg-muted/20 py-4" data-testid="cleaning-report-panel">
      <div class="flex items-start gap-3">
        <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-700">
          <Icon name="lucide:user" class="h-4 w-4" />
        </div>
        <div class="flex-1 space-y-0.5 text-sm">
          <p class="font-semibold">
            {{ feedback.supervisorName || 'Cleaning staff' }}
            <span v-if="feedback.supervisorRole" class="text-xs font-normal text-muted-foreground">({{ feedback.supervisorRole }})</span>
          </p>
          <div class="space-y-0.5 text-xs text-muted-foreground">
            <div class="flex gap-1.5">
              <span class="w-24 shrink-0">Started at</span>
              <span>: {{ formatDateTime(feedback.startedAt) }}</span>
            </div>
            <div class="flex gap-1.5">
              <span class="w-24 shrink-0">Confirmed at</span>
              <span>: {{ formatDateTime(feedback.confirmedAt) }}</span>
            </div>
            <div class="flex gap-1.5">
              <span class="w-24 shrink-0 font-semibold text-foreground">TIME TAKEN</span>
              <span class="font-semibold text-foreground">: {{ durationLabel(feedback) }}</span>
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm" class="shrink-0">
          <Icon name="lucide:phone" class="mr-1.5 h-3.5 w-3.5" />
          Contact
        </Button>
      </div>
    </div>

    <!-- Tabs -->
    <Tabs v-model="activeTab" class="w-full">
      <div class="border-b bg-background">
        <TabsList class="h-auto w-full justify-start gap-6 rounded-none bg-transparent p-0">
          <TabsTrigger
            v-for="tab in [
              { value: 'cleanings', label: 'Cleanings' },
              { value: 'linen', label: 'Towels & Linen' },
              { value: 'guest', label: 'Guest Cleanliness' },
            ]"
            :key="tab.value"
            :value="tab.value"
            class="relative rounded-none border-b-2 border-transparent bg-transparent py-3 text-sm font-medium text-muted-foreground shadow-none data-[state=active]:border-amber-500 data-[state=active]:text-foreground data-[state=active]:shadow-none"
          >
            {{ tab.label }}
            <span
              v-if="tab.value === 'guest' && isCheckoutCleaning"
              class="ml-1.5 inline-flex h-4 items-center rounded-full bg-amber-500/15 px-1.5 text-[10px] font-semibold text-amber-700"
            >
              Check-out
            </span>
          </TabsTrigger>
        </TabsList>
      </div>

      <!-- CLEANINGS — custom accordion -->
      <TabsContent value="cleanings" class="m-0 py-4">
        <div v-if="feedback.checklist?.length" class="space-y-3">
          <p v-if="problemCount" class="flex items-center gap-1.5 text-xs font-medium text-destructive" data-testid="checklist-problem-count">
            <Icon name="lucide:alert-triangle" class="size-3.5 shrink-0" />
            {{ problemCount }} {{ problemCount === 1 ? 'problem' : 'problems' }} reported
            <span v-if="unphotographed">, {{ unphotographed }} without the required photo</span>
          </p>
          <CleaningChecklistGroups :groups="feedback.checklist" :viewer-scope="VIEWER_SCOPE" />
        </div>
      </TabsContent>

      <!-- TOWELS & LINEN -->
      <TabsContent value="linen" class="m-0 py-4">
        <div v-if="feedback.itemsLeft.length" class="space-y-2">
          <div
            v-for="(item, idx) in feedback.itemsLeft"
            :key="idx"
            class="flex items-start gap-2 rounded-md border bg-muted/20 p-3 text-sm"
          >
            <Icon name="lucide:package" class="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <span>{{ item }}</span>
          </div>
        </div>
      </TabsContent>

      <!-- GUEST CLEANLINESS -->
      <TabsContent value="guest" class="m-0 py-4">
        <div class="space-y-3">
          <div v-if="feedback.conditionNotes" class="rounded-md border bg-muted/20 p-3">
            <p class="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Condition
            </p>
            <p class="text-sm leading-relaxed">
              {{ feedback.conditionNotes }}
            </p>
          </div>

          <div v-if="feedback.damages.length" class="rounded-md border border-destructive/40 bg-destructive/5 p-3">
            <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-destructive">
              Damages
            </p>
            <ul class="space-y-1.5">
              <li
                v-for="(d, idx) in feedback.damages"
                :key="idx"
                class="flex items-start gap-2 text-sm"
              >
                <Icon name="lucide:alert-triangle" class="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
                <span>{{ d }}</span>
              </li>
            </ul>
          </div>

          <div v-if="feedback.housekeeperNotes" class="rounded-md border bg-muted/20 p-3">
            <p class="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Housekeeper note
            </p>
            <p class="text-sm italic leading-relaxed">
              "{{ feedback.housekeeperNotes }}"
            </p>
          </div>
        </div>
      </TabsContent>
    </Tabs>
    <ImageViewer :scope="VIEWER_SCOPE" />
  </template>
</template>
