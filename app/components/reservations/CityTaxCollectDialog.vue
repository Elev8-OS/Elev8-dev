<script setup lang="ts">
import type { CityTaxPaymentMethod } from '~/components/reservations/data/reservations'
import { CITY_TAX_METHOD_LABELS } from '~/components/reservations/data/city-tax'

const props = defineProps<{
  amountLabel: string
}>()

const emit = defineEmits<{
  confirm: [payload: { method: CityTaxPaymentMethod, note?: string }]
}>()

const open = defineModel<boolean>('open', { required: true })

const method = ref<CityTaxPaymentMethod>('cash')
const note = ref('')

const methods = Object.entries(CITY_TAX_METHOD_LABELS) as [CityTaxPaymentMethod, string][]

watch(open, (isOpen) => {
  if (isOpen) {
    method.value = 'cash'
    note.value = ''
  }
})

function confirm() {
  emit('confirm', { method: method.value, note: note.value.trim() || undefined })
  open.value = false
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Collect city tax</DialogTitle>
        <DialogDescription>Recording {{ props.amountLabel }} as taken from the guest.</DialogDescription>
      </DialogHeader>

      <div class="flex flex-col gap-3">
        <div class="flex flex-col gap-1.5">
          <Label>Method</Label>
          <Select :model-value="method" @update:model-value="(v) => method = v as CityTaxPaymentMethod">
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem v-for="[value, label] in methods" :key="value" :value="value">
                {{ label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div class="flex flex-col gap-1.5">
          <Label>Note</Label>
          <Textarea v-model="note" placeholder="Optional" rows="2" />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="open = false">
          Cancel
        </Button>
        <Button data-testid="city-tax-collect-confirm" @click="confirm">
          Mark collected
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
