<script setup lang="ts">
import type { FolioItem } from '~/components/reservations/data/folio'
import { folioLineTotal } from '~/components/reservations/data/folio'

const props = defineProps<{
  open: boolean
  item: FolioItem | null
  currency: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'confirm': [reason: string]
}>()

const reason = ref('')

const canConfirm = computed(() => reason.value.trim().length > 0)

const amount = computed(() => {
  if (!props.item)
    return ''
  return `${folioLineTotal(props.item).toLocaleString('en-US', { maximumFractionDigits: 2 })} ${props.currency}`
})

function confirm() {
  if (!canConfirm.value)
    return
  emit('confirm', reason.value.trim())
  reason.value = ''
  emit('update:open', false)
}

watch(() => props.open, (open) => {
  if (open)
    reason.value = ''
})
</script>

<template>
  <Dialog :open="open" @update:open="(v) => emit('update:open', v)">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Void this item</DialogTitle>
        <DialogDescription>
          The guest already paid for this line, so it cannot be deleted. Voiding reverses the charge
          and leaves it on the folio with your reason.
        </DialogDescription>
      </DialogHeader>

      <div v-if="item" class="rounded-md border bg-muted/40 px-3 py-2 text-sm">
        <p class="font-medium">
          {{ item.label }}
        </p>
        <p class="text-xs text-muted-foreground">
          {{ item.quantity }} × {{ item.unitPrice }} = {{ amount }}
        </p>
      </div>

      <div class="space-y-1.5">
        <Label for="folio-void-reason">Reason</Label>
        <Textarea
          id="folio-void-reason"
          v-model="reason"
          data-testid="folio-void-reason"
          rows="3"
          placeholder="Charged twice at the desk."
        />
      </div>

      <DialogFooter>
        <Button variant="outline" @click="emit('update:open', false)">
          Cancel
        </Button>
        <Button variant="destructive" :disabled="!canConfirm" @click="confirm">
          Void item
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
