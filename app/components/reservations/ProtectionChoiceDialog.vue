<script setup lang="ts">
import type { CardInput, ProtectionOptionView } from '~/components/reservations/data/damage-protection'
import type { ProtectionOption } from '~/components/reservations/data/reservations'
import ProtectionOptionCards from '~/components/damage-protection/ProtectionOptionCards.vue'
import { cardInputError, chargeMandateText } from '~/components/reservations/data/damage-protection'

/**
 * What the dialog hands back. A deposit carries the card as typed; the caller
 * saves it with the gateway (`useDamageProtection.saveCard`) and records the
 * choice only once that succeeds, so a declined card never leaves a deposit
 * recorded without a card behind it.
 */
export interface ProtectionChoiceSubmission {
  option: ProtectionOption
  termsAccepted: true
  chargeConsent?: true
  cardInput?: CardInput
  simulateDecline?: boolean
}

const props = defineProps<{
  options: ProtectionOptionView[]
  termsText: string
  longStay?: boolean
}>()
const emit = defineEmits<{ submit: [ProtectionChoiceSubmission] }>()

const open = defineModel<boolean>('open', { required: true })

const selected = ref<ProtectionOption | null>(null)
const termsAccepted = ref(false)
const chargeConsent = ref(false)
const cardNumber = ref('')
const cardExpiry = ref('')
const cardCvc = ref('')
const simulateDecline = ref(false)
const error = ref('')

watch(open, (isOpen) => {
  if (!isOpen)
    return
  // The waiver is the default whenever it is offered (`buildOptions`).
  selected.value = props.options.find(o => o.isDefault)?.option ?? props.options[0]?.option ?? null
  termsAccepted.value = false
  chargeConsent.value = false
  cardNumber.value = ''
  cardExpiry.value = ''
  cardCvc.value = ''
  simulateDecline.value = false
  error.value = ''
})

const depositView = computed(() => props.options.find(o => o.option === 'deposit') ?? null)
const isDeposit = computed(() => selected.value === 'deposit')

/** The exact words the guest agrees to, frozen onto the protection when it is recorded. */
const mandate = computed(() => depositView.value
  ? chargeMandateText(depositView.value.amount, depositView.value.currency, depositView.value.settleWithinDays ?? 0)
  : '')

function submit() {
  if (!selected.value) {
    error.value = 'Pick an option.'
    return
  }
  if (!termsAccepted.value) {
    error.value = 'The guest has to accept the terms.'
    return
  }
  if (!isDeposit.value) {
    emit('submit', { option: selected.value, termsAccepted: true })
    open.value = false
    return
  }
  const cardInput: CardInput = { number: cardNumber.value, expiry: cardExpiry.value, cvc: cardCvc.value }
  const cardError = cardInputError(cardInput)
  if (cardError) {
    error.value = cardError
    return
  }
  if (!chargeConsent.value) {
    error.value = 'The guest has to agree to the card being charged after check-out.'
    return
  }
  emit('submit', {
    option: 'deposit',
    termsAccepted: true,
    chargeConsent: true,
    cardInput,
    simulateDecline: simulateDecline.value,
  })
  open.value = false
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>Record the guest's choice</DialogTitle>
        <DialogDescription>
          Use this when the guest answers at the desk or on the phone instead of in the guest guide.
        </DialogDescription>
      </DialogHeader>

      <div class="flex flex-col gap-4">
        <ProtectionOptionCards v-model="selected" :options="options" :long-stay="longStay" />

        <!-- The deposit is a saved card. It asks for more than the waiver does,
             on purpose: a card, and consent to a charge after check-out. -->
        <div v-if="isDeposit" class="flex flex-col gap-3 rounded-lg border p-3" data-testid="choice-card-form">
          <div>
            <p class="text-sm font-medium">
              Card to keep on file
            </p>
            <p class="text-xs text-muted-foreground">
              Mock form. In production the card goes straight to Stripe and only its last four digits come back here.
            </p>
          </div>
          <div class="grid gap-3 sm:grid-cols-[1fr_7rem_6rem]">
            <div class="flex flex-col gap-1.5">
              <Label for="choice-card-number">Card number</Label>
              <Input id="choice-card-number" v-model="cardNumber" inputmode="numeric" autocomplete="off" placeholder="4242 4242 4242 4242" />
            </div>
            <div class="flex flex-col gap-1.5">
              <Label for="choice-card-expiry">Expiry</Label>
              <Input id="choice-card-expiry" v-model="cardExpiry" autocomplete="off" placeholder="MM/YY" />
            </div>
            <div class="flex flex-col gap-1.5">
              <Label for="choice-card-cvc">CVC</Label>
              <Input id="choice-card-cvc" v-model="cardCvc" inputmode="numeric" autocomplete="off" placeholder="123" />
            </div>
          </div>
          <div class="flex items-start gap-2">
            <Checkbox
              id="choice-charge-consent"
              class="mt-0.5"
              :model-value="chargeConsent"
              @update:model-value="(v) => chargeConsent = v === true"
            />
            <Label for="choice-charge-consent" class="text-sm leading-snug font-normal" data-testid="choice-mandate">
              {{ mandate }}
            </Label>
          </div>
          <div class="flex items-center gap-2">
            <Switch
              id="choice-simulate-decline"
              :model-value="simulateDecline"
              @update:model-value="(v) => simulateDecline = v"
            />
            <Label for="choice-simulate-decline" class="text-xs font-normal text-muted-foreground">
              Simulate a declined card
            </Label>
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
          {{ isDeposit ? 'Save card and record' : 'Record choice' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
