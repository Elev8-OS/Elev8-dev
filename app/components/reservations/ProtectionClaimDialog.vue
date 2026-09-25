<script setup lang="ts">
import type { CleaningFinding, CleaningReportGroup } from '~/components/reservations/data/claim-cleaning'
import type { ClaimDraft } from '~/components/reservations/data/damage-protection'
import type { ClaimCleaningReport, DamageProtection } from '~/components/reservations/data/reservations'
import { onBeforeUnmount } from 'vue'
import ImageViewer from '~/components/inbox/ImageViewer.vue'
import ClaimPhotoThumb from '~/components/reservations/ClaimPhotoThumb.vue'
import { claimedFindingIds, claimFromFinding } from '~/components/reservations/data/claim-cleaning'
import { claimCoverage, formatProtectionAmount, isClaimValid } from '~/components/reservations/data/damage-protection'

const props = withDefaults(defineProps<{
  protection: DamageProtection
  /** The stay's finished cleaning reports, newest first. Empty when none is linked. */
  reports?: CleaningReportGroup[]
}>(), { reports: () => [] })
const emit = defineEmits<{ submit: [ClaimDraft] }>()

const open = defineModel<boolean>('open', { required: true })

const label = ref('')
const amount = ref<number | undefined>(undefined)
const reason = ref('')
const evidenceUrls = ref<string[]>([])
const cleaningReport = ref<ClaimCleaningReport | null>(null)
const evidenceInputEl = ref<HTMLInputElement | null>(null)
/**
 * Local previews of uploaded images, keyed by their evidence path. The stored
 * path stays a mock path (the same shape as `GuestDocument.url`); the object
 * URL exists only so staff can see what they attached before recording it.
 */
const previews = ref<Record<string, string>>({})

/** The dialog's own viewer instance: a photo opens full size on top of the dialog. */
const VIEWER_SCOPE = 'damage-claim'
const viewer = useImageViewer(VIEWER_SCOPE)

function viewPhoto(url: string, caption: string, senderName?: string, timestamp?: string) {
  viewer.openImage({ url, caption, senderName, timestamp })
}
const error = ref('')

const draft = computed<ClaimDraft>(() => ({
  label: label.value,
  amount: amount.value ?? 0,
  reason: reason.value,
  evidenceUrls: evidenceUrls.value,
  ...(cleaningReport.value ? { cleaningReport: cleaningReport.value } : {}),
}))

/**
 * The split is shown live: what the protection absorbs, and what becomes an
 * excess that staff post to the folio by hand.
 */
const coverage = computed(() => claimCoverage(props.protection, amount.value ?? 0))
const valid = computed(() => isClaimValid(draft.value))

/** Findings an earlier claim on this stay already carries cannot be claimed again. */
const claimed = computed(() => claimedFindingIds(props.protection.claims ?? []))

function when(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function photoSuffix(count: number): string {
  return count > 0 ? `, ${count} ${count === 1 ? 'photo' : 'photos'}` : ''
}

/**
 * Picking a finding fills in the label and the reason and attaches the report
 * as evidence. Both texts stay editable. Picking it again detaches the report
 * but keeps the wording, since staff may have edited it by then.
 */
function pickFinding(group: CleaningReportGroup, finding: CleaningFinding) {
  if (claimed.value.has(finding.id))
    return
  if (cleaningReport.value?.findingId === finding.id) {
    cleaningReport.value = null
    return
  }
  const filled = claimFromFinding(group, finding)
  label.value = filled.label
  reason.value = filled.reason
  cleaningReport.value = filled.cleaningReport
  error.value = ''
}

function fileName(url: string): string {
  return url.split('/').pop() ?? url
}

function revokePreview(url: string) {
  const preview = previews.value[url]
  if (!preview)
    return
  URL.revokeObjectURL(preview)
  const { [url]: _dropped, ...rest } = previews.value
  previews.value = rest
}

function onFiles(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  const added: string[] = []
  const nextPreviews = { ...previews.value }
  for (const file of files) {
    const url = `/mock/evidence/${file.name}`
    // The same file picked twice is one piece of evidence, not two.
    if (evidenceUrls.value.includes(url) || added.includes(url))
      continue
    added.push(url)
    if (file.type.startsWith('image/') && typeof URL.createObjectURL === 'function')
      nextPreviews[url] = URL.createObjectURL(file)
  }
  previews.value = nextPreviews
  evidenceUrls.value = [...evidenceUrls.value, ...added]
  // Clearing lets the same file be picked again after it was removed.
  input.value = ''
}

function removeEvidence(url: string) {
  revokePreview(url)
  evidenceUrls.value = evidenceUrls.value.filter(u => u !== url)
}

const uploadedPhotos = computed(() => evidenceUrls.value.filter(u => previews.value[u]))
const uploadedDocuments = computed(() => evidenceUrls.value.filter(u => !previews.value[u]))

function reset() {
  label.value = ''
  amount.value = undefined
  reason.value = ''
  Object.keys(previews.value).forEach(revokePreview)
  viewer.closeImage()
  evidenceUrls.value = []
  cleaningReport.value = null
  error.value = ''
}

onBeforeUnmount(() => Object.keys(previews.value).forEach(revokePreview))

watch(open, (isOpen) => {
  if (isOpen)
    reset()
})

function submit() {
  if (!label.value.trim()) {
    error.value = 'Give the claim a short label.'
    return
  }
  if (!(draft.value.amount > 0)) {
    error.value = 'Enter the assessed damage amount.'
    return
  }
  if (!reason.value.trim()) {
    error.value = 'Say what happened. The guest will be shown this.'
    return
  }
  if (evidenceUrls.value.length === 0 && !cleaningReport.value) {
    error.value = 'Attach a photo or document, or pick a finding from a cleaning report.'
    return
  }
  emit('submit', draft.value)
  open.value = false
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Record a damage claim</DialogTitle>
        <DialogDescription>
          The guest is shown the reason and the evidence before any money is kept.
        </DialogDescription>
      </DialogHeader>

      <div class="flex flex-col gap-4">
        <!-- What housekeeping found on this stay. Optional: a claim can always
             be entered by hand below. -->
        <div class="flex flex-col gap-1.5" data-testid="claim-cleaning-reports">
          <Label>From a cleaning report</Label>
          <p v-if="!reports.length" class="text-xs text-muted-foreground">
            No finished cleaning report is linked to this stay. Enter the claim by hand.
          </p>
          <div v-else class="flex max-h-56 flex-col gap-3 overflow-y-auto rounded-md border p-2">
            <div v-for="group in reports" :key="group.jobId" class="flex flex-col gap-1.5">
              <p class="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Icon name="lucide:brush-cleaning" class="size-3.5 shrink-0" />
                {{ group.cleaningLabel }}, {{ when(group.reportedAt) }}, {{ group.reportedBy }}
              </p>
              <p v-if="!group.findings.length" class="pl-5 text-xs text-muted-foreground">
                Flagged nothing.
              </p>
              <div
                v-for="finding in group.findings"
                :key="finding.id"
                data-testid="claim-finding-row"
                class="rounded-md border"
                :class="cleaningReport?.findingId === finding.id ? 'border-primary ring-1 ring-primary' : ''"
              >
                <button
                  type="button"
                  data-testid="claim-finding"
                  :aria-pressed="cleaningReport?.findingId === finding.id"
                  :disabled="claimed.has(finding.id)"
                  class="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors enabled:hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                  @click="pickFinding(group, finding)"
                >
                  <span
                    class="mt-0.5 shrink-0 rounded border border-destructive/40 bg-destructive/10 px-1 py-px text-[10px] font-medium text-destructive"
                  >
                    Problem
                  </span>
                  <span class="min-w-0 flex-1">
                    <span class="block">{{ finding.text }}</span>
                    <span class="block text-xs text-muted-foreground">
                      Checklist: {{ finding.checklistItem }}
                    </span>
                    <span v-if="finding.photoUrls.length" class="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <Icon name="lucide:camera" class="size-3 shrink-0" />
                      {{ finding.photoUrls.length }} {{ finding.photoUrls.length === 1 ? 'photo' : 'photos' }}
                    </span>
                  </span>
                  <span v-if="claimed.has(finding.id)" class="shrink-0 text-xs text-muted-foreground">Claimed</span>
                  <Icon
                    v-else-if="cleaningReport?.findingId === finding.id"
                    name="lucide:check"
                    class="mt-0.5 size-4 shrink-0 text-primary"
                  />
                </button>
                <!-- Outside the row's button: each photo is its own control. -->
                <div v-if="finding.photoUrls.length" class="flex flex-wrap gap-1.5 px-2 pb-2">
                  <ClaimPhotoThumb
                    v-for="url in finding.photoUrls"
                    :key="url"
                    :src="url"
                    :alt="finding.text"
                    size="sm"
                    zoomable
                    @open="viewPhoto(url, finding.text, group.reportedBy, group.reportedAt)"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="flex flex-col gap-1.5">
          <Label for="claim-label">Label</Label>
          <Input id="claim-label" v-model="label" placeholder="Broken bedside lamp" />
        </div>

        <div class="flex flex-col gap-1.5">
          <Label for="claim-amount">Assessed damage ({{ protection.currency }})</Label>
          <Input id="claim-amount" v-model.number="amount" type="number" inputmode="decimal" min="0" placeholder="0.00" />
          <p v-if="(amount ?? 0) > 0" class="text-xs text-muted-foreground">
            {{ formatProtectionAmount(coverage.coveredAmount, protection.currency) }}
            {{ protection.option === 'deposit' ? 'comes off the deposit' : 'is covered by the waiver' }}.
            <span v-if="coverage.excessAmount > 0" class="text-amber-700 dark:text-amber-400">
              {{ formatProtectionAmount(coverage.excessAmount, protection.currency) }} is above the cover and must be
              posted to the folio by hand.
            </span>
          </p>
        </div>

        <div class="flex flex-col gap-1.5">
          <Label for="claim-reason">What happened</Label>
          <Textarea id="claim-reason" v-model="reason" rows="3" placeholder="Found during the check-out inspection." />
        </div>

        <div class="flex flex-col gap-1.5">
          <Label>Evidence</Label>
          <input
            ref="evidenceInputEl"
            type="file"
            multiple
            accept="image/*,application/pdf"
            aria-label="Add evidence"
            class="hidden"
            @change="onFiles"
          >

          <p class="text-xs text-muted-foreground">
            A cleaning report, a photo or a document. Either one is enough. A reported problem brings
            the housekeeper's photos with it.
          </p>
          <ul v-if="evidenceUrls.length || cleaningReport" class="flex flex-col gap-1">
            <li
              v-if="cleaningReport"
              data-testid="claim-evidence-cleaning"
              class="flex flex-col gap-2 rounded-md border px-2 py-1.5 text-xs text-muted-foreground"
            >
              <div class="flex items-center gap-2">
                <Icon name="lucide:brush-cleaning" class="size-3.5 shrink-0" />
                <span class="truncate">
                  {{ cleaningReport.cleaningLabel }} report, {{ when(cleaningReport.reportedAt) }}{{ photoSuffix(cleaningReport.photoUrls.length) }}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  class="ml-auto size-6 shrink-0 hover:text-destructive"
                  aria-label="Remove the cleaning report"
                  @click="cleaningReport = null"
                >
                  <Icon name="lucide:x" class="size-3.5" />
                </Button>
              </div>
              <div v-if="cleaningReport.photoUrls.length" class="flex flex-wrap gap-2" data-testid="claim-evidence-cleaning-photos">
                <ClaimPhotoThumb
                  v-for="url in cleaningReport.photoUrls"
                  :key="url"
                  :src="url"
                  :alt="cleaningReport.finding"
                  zoomable
                  @open="viewPhoto(url, cleaningReport.finding, cleaningReport.reportedBy, cleaningReport.reportedAt)"
                />
              </div>
            </li>
            <li
              v-if="uploadedPhotos.length"
              data-testid="claim-evidence-uploads"
              class="flex flex-wrap gap-2 rounded-md border p-2"
            >
              <div v-for="url in uploadedPhotos" :key="url" class="relative">
                <ClaimPhotoThumb
                  :src="previews[url]!"
                  :alt="fileName(url)"
                  zoomable
                  @open="viewPhoto(previews[url]!, '', fileName(url))"
                />
                <Button
                  variant="secondary"
                  size="icon"
                  class="absolute -top-1.5 -right-1.5 size-5 rounded-full border shadow-sm hover:text-destructive"
                  :aria-label="`Remove ${fileName(url)}`"
                  @click="removeEvidence(url)"
                >
                  <Icon name="lucide:x" class="size-3" />
                </Button>
              </div>
            </li>
            <li
              v-for="url in uploadedDocuments"
              :key="url"
              class="flex items-center gap-2 rounded-md border px-2 py-1 text-xs text-muted-foreground"
            >
              <Icon name="lucide:paperclip" class="size-3.5 shrink-0" />
              <span class="truncate">{{ fileName(url) }}</span>
              <Button
                variant="ghost"
                size="icon"
                class="ml-auto size-6 shrink-0 hover:text-destructive"
                :aria-label="`Remove ${fileName(url)}`"
                @click="removeEvidence(url)"
              >
                <Icon name="lucide:x" class="size-3.5" />
              </Button>
            </li>
          </ul>

          <Button variant="outline" size="sm" class="w-full gap-1.5 border-dashed" @click="evidenceInputEl?.click()">
            <Icon name="lucide:plus" class="size-3.5" />
            Add evidence
          </Button>
        </div>

        <p v-if="error" class="text-sm text-destructive">
          {{ error }}
        </p>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="open = false">
          Cancel
        </Button>
        <Button :disabled="!valid" @click="submit">
          Record claim
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
  <ImageViewer :scope="VIEWER_SCOPE" />
</template>
