<script setup lang="ts">
import type { Task } from '@/components/tasks/data/schema'
import { toast } from 'vue-sonner'
import { assigneeOptions, priorities, statuses } from '@/components/tasks/data/data'
import { useTaskOwnerApproval } from '@/composables/useTaskOwnerApproval'
import { useTaskStore } from '@/composables/useTaskStore'

const props = defineProps<{
  task: Task | null
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const { addStatusUpdate, addImage } = useTaskStore()
const { isBlockedOnOwner, startBlockedReason, completeWithReceipt } = useTaskOwnerApproval()

// --- Owner cost approval gate ----------------------------------------------

const blockedOnOwner = computed(() => props.task ? isBlockedOnOwner(props.task) : false)
const blockedReason = computed(() => props.task ? startBlockedReason(props.task) : null)

// --- Complete with receipt --------------------------------------------------

const completeOpen = ref(false)
const receiptFile = ref<{ name: string, size: number, type: string } | null>(null)
const receiptAmount = ref<number>(0)
const receiptError = ref('')
const receiptInputRef = ref<HTMLInputElement | null>(null)

/** A task that went through owner approval must produce a receipt. */
const receiptRequired = computed(() => props.task?.ownerApprovalRequired === true)

const completeBlockedReason = computed<string | null>(() => {
  if (receiptRequired.value && !receiptFile.value)
    return 'Upload the receipt to record the actual cost.'
  if (receiptFile.value && !(receiptAmount.value > 0))
    return 'Enter the amount shown on the receipt.'
  return null
})

function onReceiptPicked(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file)
    return
  const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
  if (!['.pdf', '.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
    receiptError.value = 'Receipts must be a PDF or an image (PNG, JPG, WebP).'
    receiptFile.value = null
    input.value = ''
    return
  }
  if (file.size > 10 * 1024 * 1024) {
    receiptError.value = 'That file is over the 10 MB limit.'
    receiptFile.value = null
    input.value = ''
    return
  }
  receiptError.value = ''
  receiptFile.value = { name: file.name, size: file.size, type: file.type || 'application/octet-stream' }
}

function clearReceipt() {
  receiptFile.value = null
  receiptError.value = ''
  if (receiptInputRef.value)
    receiptInputRef.value.value = ''
}

function openComplete() {
  receiptFile.value = null
  receiptAmount.value = props.task?.estimatedCost ?? 0
  receiptError.value = ''
  completeOpen.value = true
}

function submitComplete() {
  if (!props.task)
    return
  const result = completeWithReceipt(props.task.id, receiptFile.value
    ? {
        fileName: receiptFile.value.name,
        fileSize: receiptFile.value.size,
        mimeType: receiptFile.value.type,
        amount: receiptAmount.value,
      }
    : null)
  if (!result.ok) {
    const messages: Record<string, string> = {
      not_found: 'This task no longer exists.',
      blocked_on_owner: 'The owner has not approved this cost yet.',
      receipt_required: 'Upload the receipt to record the actual cost.',
      invalid_amount: 'Enter the amount shown on the receipt.',
    }
    toast.error(messages[result.reason] ?? 'Could not complete this task.')
    return
  }
  toast.success('Task completed — receipt and actual cost recorded.')
  completeOpen.value = false
}

/**
 * Receipts are metadata only in this mock — there is no blob storage behind
 * them, so say that plainly rather than faking a download.
 */
function viewReceipt(cost: { receipt?: { fileName: string } } | undefined) {
  if (!cost?.receipt)
    return
  toast.info(`${cost.receipt.fileName} — receipt files are not stored in this demo.`)
}

function fmtSize(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const progressValue = ref(0)
const progressNote = ref('')
const isUpdatingProgress = ref(false)
const imagePreviewIndex = ref<number | null>(null)
const previewImageUrl = ref<string | null>(null)
const imageInputRef = ref<HTMLInputElement | null>(null)
const newImages = ref<string[]>([])
const previewOpen = computed({
  get: () => imagePreviewIndex.value !== null || previewImageUrl.value !== null,
  set: (val) => {
    if (!val) {
      imagePreviewIndex.value = null
      previewImageUrl.value = null
    }
  },
})

watch(() => props.task, (task) => {
  if (task) {
    progressValue.value = task.progress ?? 0
    progressNote.value = ''
  }
})

function onOpenChange(val: boolean) {
  if (!val) {
    imagePreviewIndex.value = null
    previewImageUrl.value = null
    progressNote.value = ''
  }
  emit('update:open', val)
}

function handleProgressUpdate() {
  if (!props.task)
    return
  const now = new Date().toISOString()
  const notes: string[] = []
  if (progressNote.value.trim())
    notes.push(progressNote.value.trim())

  // Save uploaded images and add timeline entry
  const savedImages: string[] = []
  if (newImages.value.length > 0) {
    newImages.value.forEach((img) => {
      addImage(props.task!.id, img)
      savedImages.push(img)
    })
    notes.push(`Uploaded ${newImages.value.length} image${newImages.value.length > 1 ? 's' : ''}`)
    newImages.value = []
  }

  addStatusUpdate(props.task.id, {
    date: now,
    note: notes.join(' — ') || undefined,
    progress: progressValue.value,
    images: savedImages.length > 0 ? savedImages : undefined,
  })

  progressNote.value = ''
  isUpdatingProgress.value = false
  toast.success(`Progress updated to ${progressValue.value}%`)
}

function handleProgressImageUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const files = input.files
  if (!files)
    return
  Array.from(files).forEach((file) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string
      newImages.value = [...newImages.value, dataUrl]
    }
    reader.readAsDataURL(file)
  })
  input.value = ''
}

function removeNewImage(index: number) {
  newImages.value = newImages.value.filter((_, i) => i !== index)
}

function getAssigneeLabel(value: string | undefined): string {
  if (!value)
    return 'Unassigned'
  const opt = assigneeOptions.find(a => a.value === value)
  return opt?.label ?? value
}

/**
 * The timeline as an activity feed: newest first, grouped under a day header,
 * one row per entry. Mirrors how the rest of the product renders activity.
 */
const timelineDays = computed(() => {
  const entries = [...(props.task?.statusUpdates ?? [])]
    .sort((a, b) => b.date.localeCompare(a.date))
  const days: Array<{ key: string, label: string, entries: typeof entries }> = []
  for (const entry of entries) {
    const key = entry.date.slice(0, 10)
    const existing = days.find(d => d.key === key)
    if (existing)
      existing.entries.push(entry)
    else
      days.push({ key, label: dayHeading(entry.date), entries: [entry] })
  }
  return days
})

/** "SUNDAY, 06 MARCH" — or Today / Yesterday for the recent ones. */
function dayHeading(iso: string): string {
  const date = new Date(iso)
  const today = new Date()
  const dayKey = (d: Date) => d.toISOString().slice(0, 10)
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (dayKey(date) === dayKey(today))
    return 'Today'
  if (dayKey(date) === dayKey(yesterday))
    return 'Yesterday'
  return date.toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long' })
}

function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true })
}

function actorInitials(name: string): string {
  return name.split(/\s+/).map(part => part[0] ?? '').slice(0, 2).join('').toUpperCase()
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
</script>

<template>
  <Sheet :open="open" @update:open="onOpenChange">
    <SheetContent class="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-xl" side="right">
      <template v-if="task">
        <!-- Header -->
        <SheetHeader class="shrink-0 border-b px-6 py-5">
          <SheetTitle class="text-lg leading-tight">
            {{ task.title }}
          </SheetTitle>
        </SheetHeader>

        <!-- Scrollable body -->
        <ScrollArea class="min-h-0 flex-1 overflow-y-auto">
          <div class="flex flex-col gap-6 px-6 py-5">
            <!-- Info grid -->
            <div class="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <p class="text-xs text-muted-foreground">
                  Listing
                </p>
                <p class="font-medium">
                  {{ task.listing || '—' }}
                </p>
              </div>
              <div>
                <p class="text-xs text-muted-foreground">
                  Due Date
                </p>
                <p class="font-medium" :class="task.dueDate && task.dueDate < new Date().toISOString().slice(0, 10) && task.status !== 'done' && task.status !== 'canceled' ? 'text-destructive' : ''">
                  {{ task.dueDate ? formatDate(task.dueDate) : '—' }}
                </p>
              </div>
              <div>
                <p class="text-xs text-muted-foreground">
                  Status
                </p>
                <p class="font-medium">
                  {{ statuses.find(s => s.value === task.status)?.label || task.status }}
                </p>
              </div>
              <div>
                <p class="text-xs text-muted-foreground">
                  Priority
                </p>
                <p class="font-medium">
                  {{ priorities.find(p => p.value === task.priority)?.label || task.priority }}
                </p>
              </div>
              <div>
                <p class="text-xs text-muted-foreground">
                  Assignee
                </p>
                <p class="font-medium">
                  {{ getAssigneeLabel(task.assignee) }}
                </p>
              </div>
              <div>
                <p class="text-xs text-muted-foreground">
                  Created
                </p>
                <p class="font-medium">
                  {{ task.createdAt ? formatDate(task.createdAt) : '—' }}
                </p>
              </div>
            </div>

            <!-- HostBuddy link -->
            <div v-if="task.linkedInventoryItemName" class="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
              <Icon name="lucide:sparkles" class="h-4 w-4 shrink-0 text-[#C8A84B]" />
              <span>Linked to <strong>{{ task.linkedInventoryItemName }}</strong></span>
            </div>

            <!-- Description -->
            <div v-if="task.description">
              <h4 class="mb-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Description
              </h4>
              <p class="text-sm leading-relaxed whitespace-pre-wrap">
                {{ task.description }}
              </p>
            </div>

            <!-- Progress -->
            <div>
              <h4 class="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Progress
              </h4>
              <div class="flex items-center gap-3">
                <div class="h-2 flex-1 overflow-hidden rounded-full bg-primary/20">
                  <div
                    class="h-full rounded-full transition-all duration-500"
                    :class="progressValue >= 100 ? 'bg-green-500' : progressValue >= 50 ? 'bg-amber-500' : 'bg-primary'"
                    :style="{ width: `${progressValue}%` }"
                  />
                </div>
                <span class="text-sm font-semibold tabular-nums w-10 text-right">{{ progressValue }}%</span>
              </div>
              <div v-if="!isUpdatingProgress" class="mt-2 flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  class="text-xs"
                  :disabled="blockedOnOwner"
                  @click="isUpdatingProgress = true"
                >
                  <Icon name="lucide:refresh-cw" class="mr-1.5 h-3 w-3" />
                  Update Progress
                </Button>
                <Button
                  v-if="task.status !== 'done' && task.status !== 'canceled'"
                  size="sm"
                  class="text-xs"
                  :disabled="blockedOnOwner"
                  @click="openComplete"
                >
                  <Icon name="lucide:check-check" class="mr-1 size-3.5" />
                  Complete
                </Button>
                <!-- Why the controls are disabled. The approval history itself
                     lives in the timeline below, not in a banner. -->
                <span v-if="blockedReason" class="text-xs text-muted-foreground">
                  {{ blockedReason }}
                </span>
              </div>
              <div v-else class="mt-3 space-y-3 rounded-lg border bg-card p-3">
                <div class="flex items-center gap-3">
                  <Slider
                    :model-value="[progressValue]"
                    :min="0"
                    :max="100"
                    :step="5"
                    class="flex-1"
                    @update:model-value="progressValue = $event[0]"
                  />
                  <span class="text-sm font-semibold tabular-nums w-10 text-right">{{ progressValue }}%</span>
                </div>
                <Input v-model="progressNote" placeholder="Add a note (optional)..." class="h-8 text-sm" />
                <div>
                  <div class="flex flex-wrap gap-2">
                    <div v-for="(img, idx) in newImages" :key="idx" class="relative group">
                      <img :src="img" alt="" class="h-12 w-12 rounded-md border object-cover">
                      <button
                        class="absolute -top-1.5 -right-1.5 hidden group-hover:flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground"
                        @click="removeNewImage(idx)"
                      >
                        <Icon name="lucide:x" class="h-2.5 w-2.5" />
                      </button>
                    </div>
                    <button
                      class="flex h-12 w-12 items-center justify-center rounded-md border border-dashed text-muted-foreground hover:bg-muted/50 transition-colors"
                      @click="imageInputRef?.click()"
                    >
                      <Icon name="lucide:camera" class="h-4 w-4" />
                    </button>
                  </div>
                  <input
                    ref="imageInputRef"
                    type="file"
                    accept="image/*"
                    multiple
                    class="hidden"
                    @change="handleProgressImageUpload"
                  >
                </div>
                <div class="flex gap-2">
                  <Button size="sm" @click="handleProgressUpdate">
                    Save
                  </Button>
                  <Button variant="ghost" size="sm" @click="isUpdatingProgress = false; newImages = []">
                    Cancel
                  </Button>
                </div>
              </div>
            </div>

            <!-- Images -->
            <div v-if="task.images && task.images.length">
              <h4 class="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Images
              </h4>
              <div class="grid grid-cols-3 gap-2">
                <div v-for="(img, idx) in task.images" :key="idx" class="relative group">
                  <img
                    :src="img"
                    alt=""
                    class="h-24 w-full cursor-pointer rounded-lg border object-cover"
                    @click="imagePreviewIndex = idx"
                  >
                </div>
              </div>
            </div>

            <!-- Timeline -->
            <div v-if="timelineDays.length">
              <h4 class="mb-3 text-sm font-semibold text-foreground">
                Timeline
              </h4>

              <div class="space-y-5">
                <section v-for="day in timelineDays" :key="day.key" class="space-y-3">
                  <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {{ day.label }}
                  </p>

                  <div
                    v-for="(entry, idx) in day.entries"
                    :key="`${day.key}-${idx}`"
                    class="flex gap-3"
                  >
                    <!-- Avatar for a person, a bordered icon for a thing. -->
                    <div
                      v-if="entry.actor && !entry.icon"
                      class="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-foreground text-[11px] font-semibold text-background"
                      :aria-label="entry.actor.name"
                    >
                      {{ actorInitials(entry.actor.name) }}
                    </div>
                    <div
                      v-else
                      class="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border bg-background text-muted-foreground"
                    >
                      <Icon :name="entry.icon || 'lucide:activity'" class="size-4" />
                    </div>

                    <div class="min-w-0 flex-1 space-y-1.5">
                      <div class="flex items-start justify-between gap-3">
                        <p class="text-sm leading-snug text-muted-foreground">
                          <span v-if="entry.actor" class="font-semibold text-foreground">{{ entry.actor.name }}</span>
                          <span v-if="entry.actor">&nbsp;</span>{{ entry.note }}
                          <Badge
                            v-if="entry.progress === 100"
                            variant="outline"
                            class="ml-1 border-transparent bg-green-500/10 align-middle text-green-700 dark:text-green-300"
                          >
                            Completed
                          </Badge>
                        </p>
                        <span class="shrink-0 pt-0.5 text-xs tabular-nums text-muted-foreground">
                          {{ clockTime(entry.date) }}
                        </span>
                      </div>

                      <!-- Cost card — the actual amount and the receipt behind it. -->
                      <div v-if="entry.cost" class="rounded-lg border bg-muted/40 p-3">
                        <div class="flex items-baseline justify-between gap-3">
                          <span class="text-xs uppercase tracking-wide text-muted-foreground">Actual cost</span>
                          <span class="text-base font-semibold tabular-nums">
                            {{ entry.cost.currency ?? 'IDR' }} {{ entry.cost.amount.toLocaleString('id-ID') }}
                          </span>
                        </div>
                        <div v-if="entry.cost.quoted !== undefined" class="mt-1 flex items-baseline justify-between gap-3 text-xs">
                          <span class="text-muted-foreground">Quoted</span>
                          <span class="tabular-nums text-muted-foreground">
                            {{ entry.cost.currency ?? 'IDR' }} {{ entry.cost.quoted.toLocaleString('id-ID') }}
                            <template v-if="entry.cost.quoted !== entry.cost.amount">
                              <span :class="entry.cost.amount > entry.cost.quoted ? 'text-destructive' : 'text-green-600 dark:text-green-400'">
                                ({{ entry.cost.amount > entry.cost.quoted ? '+' : '−' }}{{ Math.abs(entry.cost.amount - entry.cost.quoted).toLocaleString('id-ID') }})
                              </span>
                            </template>
                          </span>
                        </div>
                        <div v-if="entry.cost.receipt" class="mt-2 flex items-center gap-2 border-t pt-2">
                          <Icon name="lucide:receipt" class="size-4 shrink-0 text-muted-foreground" />
                          <div class="min-w-0 flex-1">
                            <p class="truncate text-xs font-medium">
                              {{ entry.cost.receipt.fileName }}
                            </p>
                            <p class="text-xs text-muted-foreground">
                              {{ fmtSize(entry.cost.receipt.fileSize) }}
                            </p>
                          </div>
                          <Button variant="ghost" size="sm" class="h-7 text-xs" @click="viewReceipt(entry.cost)">
                            View
                          </Button>
                        </div>
                      </div>

                      <div v-if="entry.images && entry.images.length" class="flex flex-wrap gap-1.5">
                        <img
                          v-for="(img, imgIdx) in entry.images"
                          :key="imgIdx"
                          :src="img"
                          alt=""
                          class="size-16 cursor-pointer rounded-md border object-cover transition-opacity hover:opacity-80"
                          @click="previewImageUrl = img"
                        >
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </div>
        </ScrollArea>
      </template>

      <div v-else class="flex flex-1 items-center justify-center">
        <p class="text-sm text-muted-foreground">
          Select a task to view details.
        </p>
      </div>
    </SheetContent>

    <!-- Image preview dialog -->
    <Dialog v-model:open="previewOpen">
      <DialogContent class="sm:max-w-2xl">
        <img
          v-if="previewImageUrl"
          :src="previewImageUrl"
          alt="Task image"
          class="w-full rounded-lg"
        >
        <img
          v-else-if="imagePreviewIndex !== null && task?.images?.[imagePreviewIndex]"
          :src="task.images[imagePreviewIndex]"
          alt="Task image"
          class="w-full rounded-lg"
        >
        <div v-if="!previewImageUrl && task?.images && task.images.length > 1" class="flex items-center justify-center gap-2 mt-2">
          <Button
            variant="outline"
            size="sm"
            :disabled="imagePreviewIndex === 0"
            @click="imagePreviewIndex = (imagePreviewIndex ?? 0) - 1"
          >
            Previous
          </Button>
          <span class="text-xs text-muted-foreground">
            {{ (imagePreviewIndex ?? 0) + 1 }} / {{ task.images.length }}
          </span>
          <Button
            variant="outline"
            size="sm"
            :disabled="imagePreviewIndex === null || imagePreviewIndex >= (task?.images?.length ?? 1) - 1"
            @click="imagePreviewIndex = (imagePreviewIndex ?? 0) + 1"
          >
            Next
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    <!-- Complete with receipt — the receipt is the evidence for the cost. -->
    <Dialog v-model:open="completeOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Complete task</DialogTitle>
          <DialogDescription>
            {{ receiptRequired
              ? 'The owner is charged for this, so a receipt is required. Its amount becomes the actual cost.'
              : 'Attach a receipt if there was a cost, or complete without one.' }}
          </DialogDescription>
        </DialogHeader>
        <div class="space-y-3">
          <div class="space-y-1.5">
            <Label for="task-receipt">
              Receipt <span v-if="receiptRequired" class="text-destructive">*</span>
            </Label>
            <input
              id="task-receipt"
              ref="receiptInputRef"
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp"
              class="hidden"
              @change="onReceiptPicked"
            >
            <div v-if="receiptFile" class="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
              <Icon name="lucide:receipt" class="size-4 shrink-0 text-muted-foreground" />
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm">
                  {{ receiptFile.name }}
                </p>
                <p class="text-xs text-muted-foreground">
                  {{ fmtSize(receiptFile.size) }}
                </p>
              </div>
              <Button variant="ghost" size="sm" aria-label="Remove receipt" @click="clearReceipt">
                <Icon name="lucide:x" class="size-4" />
              </Button>
            </div>
            <Button v-else variant="outline" class="w-full justify-start" @click="receiptInputRef?.click()">
              <Icon name="lucide:upload" class="mr-2 size-4" />
              Upload receipt
            </Button>
            <p v-if="receiptError" class="text-xs text-destructive">
              {{ receiptError }}
            </p>
            <p v-else class="text-xs text-muted-foreground">
              PDF, PNG, JPG, WebP &middot; max 10 MB
            </p>
          </div>
          <div v-if="receiptFile" class="space-y-1.5">
            <Label for="task-actual-cost">Actual cost on the receipt (IDR)</Label>
            <Input id="task-actual-cost" v-model.number="receiptAmount" type="number" min="0" step="10000" />
            <p v-if="task?.estimatedCost" class="text-xs text-muted-foreground">
              Quoted IDR {{ task.estimatedCost.toLocaleString('id-ID') }}.
            </p>
          </div>
        </div>
        <DialogFooter class="flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end">
          <p v-if="completeBlockedReason" class="mr-auto text-xs text-muted-foreground">
            {{ completeBlockedReason }}
          </p>
          <div class="flex justify-end gap-2">
            <Button variant="outline" @click="completeOpen = false">
              Cancel
            </Button>
            <Button :disabled="!!completeBlockedReason" @click="submitComplete">
              Complete task
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </Sheet>
</template>
