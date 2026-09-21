<script setup lang="ts">
import type { ProtectionChoiceDraft, ProtectionOptionView, ProtectionRail } from '~/components/reservations/data/damage-protection'
import type { ProtectionOption, ProtectionRefundDestination } from '~/components/reservations/data/reservations'
import ProtectionOptionCards from '~/components/damage-protection/ProtectionOptionCards.vue'
import { choiceRequiresBankDetails } from '~/components/reservations/data/damage-protection'

const props = defineProps<{
  options: ProtectionOptionView[]
  rail: ProtectionRail
  termsText: string
  longStay?: boolean
}>()
const emit = defineEmits<{ submit: [ProtectionChoiceDraft] }>()

const open = defineModel<boolean>('open', { required: true })

const selected = ref<ProtectionOption | null>(null)
const termsAccepted = ref(false)
const accountName = ref('')
const accountNumber = ref('')
const bankName = ref('')
const error = ref('')

watch(open, (isOpen) => {
  if (!isOpen)
    return
  selected.value = props.options.find(o => o.isDefault)?.option ?? props.options[0]?.option ?? null
  termsAccepted.value = false
  accountName.value = ''
  accountNumber.value = ''
  bankName.value = ''
  error.value = ''
})

const needsBank = computed(() =>
  selected.value ? choiceRequiresBankDetails({ option: selected.value }, props.rail) : false)

function submit() {
  if (!selected.value) {
    error.value = 'Pick an option.'
    return
  }
  if (!termsAccepted.value) {
    error.value = 'The guest has to accept the terms.'
    return
  }
  let refundDestination: ProtectionRefundDestination | undefined
  if (needsBank.value) {
    if (!accountName.value.trim() || !accountNumber.value.trim() || !bankName.value.trim()) {
      error.value = 'This payment method cannot be refunded to source, so bank details are required.'
      return
    }
    refundDestination = {
      method: 'bank_transfer',
      accountName: accountName.value.trim(),
      accountNumber: accountNumber.value.trim(),
      bankName: bankName.value.trim(),
    }
  }
  emit('submit', { option: selected.value, termsAccepted: true, refundDestination })
  open.value = false
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>Record the guest's choice</DialogTitle>
        <DialogDescription>
          Use this when the guest answers at the desk or on the phone instead of in the guest guide.
        </DialogDescription>
      </DialogHeader>

      <div class="flex flex-col gap-4">
        <ProtectionOptionCards v-model="selected" :options="options" :long-stay="longStay" />

        <div v-if="needsBank" class="flex flex-col gap-3 rounded-lg border p-3">
          <p class="text-sm font-medium">
            Refund destination
          </p>
          <p class="text-xs text-muted-foreground">
            This listing settles on a rail that cannot be reversed to source, so the refund needs a bank account.
          </p>
          <div class="grid gap-3 sm:grid-cols-3">
            <div class="flex flex-col gap-1.5">
              <Label for="choice-account-name">Account name</Label>
              <Input id="choice-account-name" v-model="accountName" />
            </div>
            <div class="flex flex-col gap-1.5">
              <Label for="choice-account-number">Account number</Label>
              <Input id="choice-account-number" v-model="accountNumber" />
            </div>
            <div class="flex flex-col gap-1.5">
              <Label for="choice-bank-name">Bank</Label>
              <Input id="choice-bank-name" v-model="bankName" />
            </div>
          </div>
        </div>

        <div class="flex flex-col gap-2">
          <p class="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Terms
          </p>
          <div class="max-h-32 overflow-y-auto rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
            {{ termsText }}
          </div>
          <div class="flex items-center gap-2">
            <Checkbox id="choice-terms" :model-value="termsAccepted" @update:model-value="(v) => termsAccepted = v === true" />
            <Label for="choice-terms" class="text-sm font-normal">The guest accepted these terms</Label>
          </div>
        </div>

        <p v-if="error" class="text-sm text-destructive">
          {{ error }}
        </p>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="open = false">
          Cancel
        </Button>
        <Button @click="submit">
          Record choice
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
