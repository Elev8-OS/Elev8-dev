<script setup lang="ts">
const emit = defineEmits<{
  confirm: [reason: string]
}>()

const open = defineModel<boolean>('open', { required: true })

const reason = ref('')
const touched = ref(false)

const invalid = computed(() => touched.value && reason.value.trim().length === 0)

watch(open, (isOpen) => {
  if (isOpen) {
    reason.value = ''
    touched.value = false
  }
})

function confirm() {
  touched.value = true
  if (reason.value.trim().length === 0)
    return
  emit('confirm', reason.value.trim())
  open.value = false
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Waive city tax</DialogTitle>
        <DialogDescription>
          The stay still owes nothing after this. Say why, so the next person reading the booking knows.
        </DialogDescription>
      </DialogHeader>

      <div class="flex flex-col gap-1.5">
        <Label>Reason</Label>
        <Textarea v-model="reason" placeholder="e.g., Business traveller, exempt under local rule" rows="3" />
        <p v-if="invalid" class="text-xs text-destructive">
          A waive needs a reason.
        </p>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="open = false">
          Cancel
        </Button>
        <Button variant="destructive" data-testid="city-tax-waive-confirm" @click="confirm">
          Waive
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
