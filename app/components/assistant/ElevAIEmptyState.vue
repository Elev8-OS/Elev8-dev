<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { useAssistant } from '~/composables/useAssistant'
import { useAssistantFindings } from '~/composables/useAssistantFindings'
import { useTaskStore } from '~/composables/useTaskStore'
import type { Task } from '@/components/tasks/data/schema'

// v1 findings are derived from /api/assistant mock data; in v2 this
// would be a real endpoint streaming findings from the production
// database. Each finding has a pre-built follow-up prompt so clicking
// "Ask" kicks off the conversation naturally. `taskTitle` is the
// title used when the user converts the finding into a Task.
interface Finding {
  id: string
  type: 'unverified_guest' | 'impossible_rate' | 'double_booking'
  severity: 'warning' | 'critical'
  title: string
  description: string
  prompt: string
  /** Listing name for the spawned task (links to /tasks filter). */
  listingName: string
  /** Pre-built title for the spawned task. */
  taskTitle: string
}

const FINDINGS: Finding[] = [
  {
    id: 'finding-unverified-res-101',
    type: 'unverified_guest',
    severity: 'warning',
    title: "Anna Schmidt isn't verified yet",
    description: 'Check-in today at Villa Sunset, 4 guests',
    prompt: "Which guests arriving today haven't been verified?",
    listingName: 'Villa Sunset',
    taskTitle: 'Verify Anna Schmidt for Villa Sunset',
  },
  {
    id: 'finding-unverified-res-103',
    type: 'unverified_guest',
    severity: 'warning',
    title: "Marc Weber isn't verified yet",
    description: 'Check-in today at Villa Oasis, 6 guests',
    prompt: "Which guests arriving today haven't been verified?",
    listingName: 'Villa Oasis',
    taskTitle: 'Verify Marc Weber for Villa Oasis',
  },
  {
    id: 'finding-rate-res-104',
    type: 'impossible_rate',
    severity: 'critical',
    title: 'Unusual rate for Sophie Laurent',
    description: '60 CHF / 3 nights at Villa Sunset (base 490 CHF/night)',
    prompt: 'Show revenue by listing',
    listingName: 'Villa Sunset',
    taskTitle: 'Review rate for Sophie Laurent at Villa Sunset',
  },
  {
    id: 'finding-double-res-101-res-105',
    type: 'double_booking',
    severity: 'critical',
    title: 'Overlapping bookings at Villa Sunset',
    description: 'Anna Schmidt (until 2026-07-15) and Klaus Mueller (from 2026-07-10)',
    prompt: "Show today's check-ins",
    listingName: 'Villa Sunset',
    taskTitle: 'Resolve overlapping bookings at Villa Sunset',
  },
]

const FALLBACK_SUGGESTIONS = [
  { label: "📅 Today's check-ins", prompt: "What are today's check-ins?" },
  { label: '🧹 Cleaning today', prompt: 'What is the cleaning schedule today?' },
  { label: '💰 Revenue this month', prompt: 'How is revenue this month?' },
  { label: '📊 Occupancy this month', prompt: 'What is the occupancy this month?' },
]

// Priority + due-date mapping per finding type. Kept here (not in
// useAssistantFindings) because it's pure presentation — the engine
// stays focused on state, the UI owns the workflow shape.
const TASK_PRIORITY: Record<Finding['type'], 'low' | 'medium' | 'high'> = {
  unverified_guest: 'medium',
  impossible_rate: 'high',
  double_booking: 'high',
}

const { submit } = useAssistant()
const {
  isChecked,
  toggle,
  setChecked,
  getTaskId,
  linkTaskToFinding,
  resetAll,
  checkedCount,
} = useAssistantFindings()
const { tasks, addTask } = useTaskStore()

const showResolved = ref(false)

const findings = computed(() => FINDINGS)
const totalCount = computed(() => findings.value.length)

const openFindings = computed(() => findings.value.filter(f => !isChecked(f.id)))

const allResolved = computed(() => openFindings.value.length === 0 && totalCount.value > 0)
const hasAnyResolved = computed(() => checkedCount.value > 0)

const visibleFindings = computed(() =>
  showResolved.value ? findings.value : openFindings.value,
)

const taskById = computed(() => {
  const map = new Map<string, Task>()
  for (const t of tasks.value) map.set(t.id, t)
  return map
})

function linkedTask(findingId: string): Task | undefined {
  const id = getTaskId(findingId)
  return id ? taskById.value.get(id) : undefined
}

function severityIcon(type: Finding['type']) {
  switch (type) {
    case 'unverified_guest': return 'lucide:user-check'
    case 'impossible_rate': return 'lucide:badge-dollar-sign'
    case 'double_booking': return 'lucide:calendar-x-2'
  }
}

function severityClasses(severity: Finding['severity']) {
  return severity === 'critical'
    ? 'bg-destructive/10 text-destructive'
    : 'bg-warning/10 text-warning'
}

function handleAsk(prompt: string) {
  submit(prompt)
}

function handleCreateTask(f: Finding) {
  if (getTaskId(f.id)) return
  const today = new Date().toISOString().slice(0, 10)
  const task = addTask({
    title: f.taskTitle,
    status: 'not started',
    priority: TASK_PRIORITY[f.type],
    listing: f.listingName,
    assignee: 'komang-juliantara',
    assigneeType: 'person',
    dueDate: today,
    progress: 0,
    description: `Auto-created from AI finding: ${f.title}\n\n${f.description}`,
    source: 'from_finding',
    sourceRef: f.id,
  })
  linkTaskToFinding(f.id, task.id)
  toast.success(`Task ${task.id} created.`)
}

function handleReset() {
  resetAll()
  showResolved.value = false
}

/** Watch linked tasks — when a task is Completed, auto-resolve the
 * finding. (A task nobody will do is deleted, not cancelled.) One-way sync:
 * the task is the source of truth for status, the finding just
 * mirrors it. */
watch(tasks, (current) => {
  for (const f of findings.value) {
    const task = linkedTask(f.id)
    if (!task) continue
    if (task.status === 'completed') {
      if (!isChecked(f.id)) setChecked(f.id, true)
    }
  }
}, { deep: true })

const TASK_STATUS_LABELS: Record<string, { label: string, classes: string }> = {
  'not started': { label: 'Not started', classes: 'bg-muted text-muted-foreground' },
  'in progress': { label: 'In progress', classes: 'bg-amber-500/10 text-amber-700' },
  'completed': { label: 'Completed', classes: 'bg-emerald-500/10 text-emerald-700' },
}

function taskStatusDisplay(status: string | undefined) {
  const key = status ?? 'not started'
  return TASK_STATUS_LABELS[key] ?? TASK_STATUS_LABELS['not started']
}
</script>

<template>
  <div class="flex flex-1 flex-col items-stretch justify-start gap-5 p-6 text-center">
    <!-- Greeting -->
    <div class="space-y-1 pt-2">
      <div class="text-2xl">
        👋
      </div>
      <h3 class="text-sm font-medium">
        Hi Komang
      </h3>
      <p class="text-xs text-muted-foreground">
        <template v-if="allResolved">
          You're all clear — what can I help with?
        </template>
        <template v-else-if="hasAnyResolved">
          {{ openFindings.length }} open · {{ checkedCount }} resolved.
        </template>
        <template v-else>
          I found a few things worth a look.
        </template>
      </p>
    </div>

    <!-- Findings list -->
    <div v-if="totalCount > 0" class="w-full space-y-2 text-left">
      <!-- Section header with progress + reset -->
      <div class="flex items-center justify-between px-0.5">
        <p class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Findings · {{ checkedCount }}/{{ totalCount }}
        </p>
        <button
          v-if="hasAnyResolved"
          type="button"
          class="text-[10px] font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded"
          data-testid="findings-reset"
          @click="handleReset"
        >
          Reset all
        </button>
      </div>

      <div class="flex flex-col gap-2">
        <div
          v-for="(f, i) in visibleFindings"
          :key="f.id"
          class="group relative rounded-lg border bg-card text-left transition-colors animate-in fade-in slide-in-from-bottom-2 fill-mode-backwards duration-500"
          :class="[
            isChecked(f.id)
              ? 'border-dashed border-muted-foreground/30 bg-muted/40'
              : 'hover:border-primary/50 hover:bg-accent/30',
          ]"
          :style="{ animationDelay: `${i * 80}ms` }"
          :data-testid="`finding-${f.type}`"
          :data-finding-id="f.id"
        >
          <!-- Top row: checkbox + severity icon + title + status indicator -->
          <button
            type="button"
            class="flex w-full items-start gap-3 px-3 pt-2.5 text-left"
            :class="isChecked(f.id) && 'cursor-default'"
            :data-testid="`finding-ask-${f.id}`"
            :data-prompt="f.prompt"
            @click="!isChecked(f.id) && handleAsk(f.prompt)"
          >
            <!-- Checkbox — separate hit target (does not submit) -->
            <span
              role="checkbox"
              tabindex="0"
              class="mt-0.5 flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-[4px] border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              :class="isChecked(f.id)
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-input bg-background hover:border-primary/60'"
              :aria-label="isChecked(f.id) ? `Unresolve finding: ${f.title}` : `Mark finding resolved: ${f.title}`"
              :aria-checked="isChecked(f.id)"
              :data-testid="`finding-checkbox-${f.id}`"
              @click.stop="toggle(f.id)"
              @keydown.enter.stop.prevent="toggle(f.id)"
              @keydown.space.stop.prevent="toggle(f.id)"
            >
              <Icon v-if="isChecked(f.id)" name="lucide:check" class="size-3" />
            </span>

            <span
              class="flex size-7 shrink-0 items-center justify-center rounded-md"
              :class="severityClasses(f.severity)"
              :aria-label="f.severity"
            >
              <Icon :name="severityIcon(f.type)" class="size-4" />
            </span>

            <span class="min-w-0 flex-1 space-y-0.5">
              <span
                class="block text-xs font-medium leading-snug"
                :class="isChecked(f.id) && 'line-through text-muted-foreground'"
              >
                {{ f.title }}
              </span>
              <span
                class="block text-[11px] leading-snug text-muted-foreground"
                :class="isChecked(f.id) && 'line-through'"
              >
                {{ f.description }}
              </span>
            </span>

            <span
              v-if="!isChecked(f.id) && !getTaskId(f.id)"
              class="flex shrink-0 items-center gap-1 self-center text-[11px] font-medium text-muted-foreground transition-colors group-hover:text-primary"
              aria-hidden="true"
            >
              Ask
              <Icon name="lucide:arrow-right" class="size-3 transition-transform group-hover:translate-x-0.5" />
            </span>
            <span
              v-else-if="isChecked(f.id)"
              class="flex shrink-0 items-center gap-1 self-center text-[11px] font-medium text-emerald-700"
            >
              <Icon name="lucide:check" class="size-3" />
              Resolved
            </span>
          </button>

          <!-- Action row: "Create task" when unlinked, task status pill when linked -->
          <div
            v-if="!isChecked(f.id)"
            class="flex items-center justify-between gap-2 border-t border-dashed px-3 py-2"
          >
            <template v-if="!getTaskId(f.id)">
              <span class="text-[11px] text-muted-foreground">Convert to action</span>
              <button
                type="button"
                class="flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                :data-testid="`finding-create-task-${f.id}`"
                @click.stop="handleCreateTask(f)"
              >
                <Icon name="lucide:plus" class="size-3" />
                Create task
              </button>
            </template>
            <template v-else>
              <NuxtLink
                :to="`/tasks`"
                class="flex items-center gap-1.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                :data-testid="`finding-task-link-${f.id}`"
              >
                <Icon name="lucide:clipboard-list" class="size-3" />
                {{ linkedTask(f.id)?.id ?? 'Task' }}
                <Icon name="lucide:external-link" class="size-3" />
              </NuxtLink>
              <span
                class="rounded-full px-2 py-0.5 text-[10px] font-medium"
                :class="taskStatusDisplay(linkedTask(f.id)?.status).classes"
                :data-testid="`finding-task-status-${f.id}`"
              >
                {{ taskStatusDisplay(linkedTask(f.id)?.status).label }}
              </span>
            </template>
          </div>
        </div>
      </div>

      <!-- Show-resolved toggle — only shown when something is resolved. -->
      <button
        v-if="hasAnyResolved"
        type="button"
        class="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        :aria-pressed="showResolved"
        data-testid="findings-toggle-resolved"
        @click="showResolved = !showResolved"
      >
        <Icon
          :name="showResolved ? 'lucide:eye-off' : 'lucide:eye'"
          class="size-3"
        />
        {{ showResolved ? 'Hide resolved' : `Show resolved (${checkedCount})` }}
      </button>
    </div>

    <!-- Fallback suggestions — always visible so users without findings
         (or after clearing) still have an entry point. -->
    <div class="w-full space-y-2 text-left">
      <p class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        Or try asking
      </p>
      <Suggestions class="mx-auto w-fit max-w-full">
        <Suggestion
          v-for="(s, i) in FALLBACK_SUGGESTIONS"
          :key="s.prompt"
          :style="{ animationDelay: `${(findings.length + i) * 80}ms` }"
          class="animate-in fade-in slide-in-from-bottom-2 fill-mode-backwards duration-500"
          :suggestion="s.label"
          @click="handleAsk(s.prompt)"
        />
      </Suggestions>
    </div>
  </div>
</template>
