<script setup lang="ts">
import type { DamageProtection } from '~/components/reservations/data/reservations'
import { claimCoverage, formatProtectionAmount, isClaimValid } from '~/components/reservations/data/damage-protection'

const props = defineProps<{ protection: DamageProtection }>()
const emit = defineEmits<{ submit: [{ label: string, amount: number, reason: string, evidenceUrls: string[] }] }>()

const open = defineModel<boolean>('open', { required: true })

const label = ref('')
const amount = ref<number | undefined>(undefined)
const reason = ref('')
const evidenceUrls = ref<string[]>([])
const error = ref('')

const draft = computed(() => ({
  label: label.value,
  amount: amount.value ?? 0,
  reason: reason.value,
  evidenceUrls: evidenceUrls.value,
}))

/**
 * The split is shown live: what the protection absorbs, and what becomes an
 * excess that staff post to the folio by hand.
 */
const coverage = computed(() => claimCoverage(props.protection, amount.value ?? 0))
const valid = computed(() => isClaimValid(draft.value))

function onFiles(event: Event) {
  const files = Array.from((event.target as HTMLInputElement).files ?? [])
  evidenceUrls.value = [...evidenceUrls.value, ...files.map(f => `/mock/evidence/${f.name}`)]
}

function reset() {
  label.value = ''
  amount.value = undefined
  reason.value = ''
  evidenceUrls.value = []
  error.value = ''
}

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
  if (evidenceUrls.value.length === 0) {
    error.value = 'Attach at least one photo or document.'
    return
  }
  emit('submit', draft.value)
  open.value = false
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Record a damage claim</DialogTitle>
        <DialogDescription>
          The guest is shown the reason and the evidence before any money is kept.
        </DialogDescription>
      </DialogHeader>

      <div class="flex flex-col gap-4">
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
          <Label for="claim-evidence">Evidence</Label>
          <input
            id="claim-evidence"
            type="file"
            multiple
            accept="image/*,application/pdf"
            class="text-sm file:mr-3 file:rounded-md file:border file:bg-muted file:px-3 file:py-1.5 file:text-sm"
            @change="onFiles"
          >
          <ul v-if="evidenceUrls.length" class="flex flex-col gap-1 text-xs text-muted-foreground">
            <li v-for="url in evidenceUrls" :key="url">
              {{ url.split('/').pop() }}
            </li>
          </ul>
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
</template>
