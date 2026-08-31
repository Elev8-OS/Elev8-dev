<script setup lang="ts">
import { computed, ref } from 'vue'
import type { RatePlan } from '~/components/listings/data/listings'

interface DerivedRule {
  type: 'increase_by_amount' | 'increase_by_percent' | 'decrease_by_amount' | 'decrease_by_percent'
  value: string
}

interface Props {
  modelValue: Record<string, Array<[string, string]>> | null | undefined
  ratePlan: RatePlan
  baseRate: number
  currencySymbol: string
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: null,
})

const emit = defineEmits<{
  'update:modelValue': [value: Record<string, Array<[string, string]>> | null]
  'update:inheritRate': [value: boolean]
  'update:inheritMinStayArrival': [value: boolean]
  'update:inheritMinStayThrough': [value: boolean]
  'update:inheritMaxStay': [value: boolean]
  'update:inheritClosedToArrival': [value: boolean]
  'update:inheritClosedToDeparture': [value: boolean]
  'update:inheritStopSell': [value: boolean]
}>()

const showAdvanced = ref(false)

const rules = computed<DerivedRule[]>({
  get() {
    return (props.modelValue?.rate ?? []).map(([type, value]) => ({
      type: type as DerivedRule['type'],
      value,
    }))
  },
  set(newRules: DerivedRule[]) {
    if (newRules.length === 0) {
      emit('update:modelValue', null)
    } else {
      emit('update:modelValue', {
        rate: newRules.map(r => [r.type, r.value] as [string, string]),
      })
    }
  },
})

const ruleOptions = [
  { value: 'increase_by_amount', label: 'Increase by Amount ($)' },
  { value: 'increase_by_percent', label: 'Increase by Percent (%)' },
  { value: 'decrease_by_amount', label: 'Decrease by Amount ($)' },
  { value: 'decrease_by_percent', label: 'Decrease by Percent (%)' },
]

function addRule() {
  rules.value = [...rules.value, { type: 'increase_by_percent', value: '0' }]
}

function removeRule(index: number) {
  rules.value = rules.value.filter((_, i) => i !== index)
}

function updateRule(index: number, field: 'type' | 'value', newValue: string) {
  const updated = [...rules.value]
  if (field === 'type') {
    updated[index].type = newValue as DerivedRule['type']
  } else {
    updated[index].value = newValue
  }
  rules.value = updated
}

const calculatedRate = computed(() => {
  let rate = props.baseRate
  for (const rule of rules.value) {
    const val = parseFloat(rule.value) || 0
    if (rule.type === 'increase_by_amount') rate += val
    else if (rule.type === 'decrease_by_amount') rate -= val
    else if (rule.type === 'increase_by_percent') rate += rate * (val / 100)
    else if (rule.type === 'decrease_by_percent') rate -= rate * (val / 100)
  }
  return rate
})
</script>

<template>
  <div class="space-y-6">
    <!-- Inherit from parent section -->
    <div class="space-y-2">
      <Label>Inherit from parent:</Label>
      <div class="space-y-1.5">
        <div class="flex items-center gap-2">
          <Checkbox :checked="props.ratePlan.inheritRate" @update:checked="(v) => emit('update:inheritRate', v)" />
          <Label class="text-sm font-normal">Rate</Label>
        </div>
        <div class="flex items-center gap-2">
          <Checkbox :checked="props.ratePlan.inheritMinStayArrival" @update:checked="(v) => emit('update:inheritMinStayArrival', v)" />
          <Label class="text-sm font-normal">Min Stay Arrival</Label>
        </div>
        <div class="flex items-center gap-2">
          <Checkbox :checked="props.ratePlan.inheritMinStayThrough" @update:checked="(v) => emit('update:inheritMinStayThrough', v)" />
          <Label class="text-sm font-normal">Min Stay Through</Label>
        </div>
        <div class="flex items-center gap-2">
          <Checkbox :checked="props.ratePlan.inheritMaxStay" @update:checked="(v) => emit('update:inheritMaxStay', v)" />
          <Label class="text-sm font-normal">Max Stay</Label>
        </div>
        <div class="flex items-center gap-2">
          <Checkbox :checked="props.ratePlan.inheritClosedToArrival" @update:checked="(v) => emit('update:inheritClosedToArrival', v)" />
          <Label class="text-sm font-normal">Closed To Arrival</Label>
        </div>
        <div class="flex items-center gap-2">
          <Checkbox :checked="props.ratePlan.inheritClosedToDeparture" @update:checked="(v) => emit('update:inheritClosedToDeparture', v)" />
          <Label class="text-sm font-normal">Closed To Departure</Label>
        </div>
        <div class="flex items-center gap-2">
          <Checkbox :checked="props.ratePlan.inheritStopSell" @update:checked="(v) => emit('update:inheritStopSell', v)" />
          <Label class="text-sm font-normal">Stop Sell</Label>
        </div>
      </div>
      <Button variant="link" size="sm" class="p-0 h-auto" @click="showAdvanced = !showAdvanced">
        {{ showAdvanced ? 'Hide' : 'Show' }} advanced settings
      </Button>
    </div>

    <!-- Rate modifiers section -->
    <div class="space-y-2">
      <Label>Rate Modifiers:</Label>
      <div class="space-y-1.5">
        <div class="flex items-center justify-between">
          <span class="text-sm">Rate Logic</span>
          <Button variant="link" size="sm" class="h-auto p-0 text-blue-600">
            <Icon name="lucide:plus" class="size-4 mr-1" />
            Add modifier
          </Button>
        </div>
        <div v-for="opt in props.ratePlan.options" :key="opt.occupancy" class="flex items-center justify-between text-sm">
          <span v-if="opt.occupancy === props.ratePlan.options.find(o => o.isPrimary)?.occupancy" class="text-muted-foreground">
            Rate Logic for {{ opt.occupancy }} {{ opt.occupancy === 1 ? 'person' : 'person' }}: Primary Occupancy
          </span>
          <span v-else class="text-muted-foreground">
            Rate Logic for {{ opt.occupancy }} {{ opt.occupancy === 1 ? 'person' : 'person' }}:
            <Button variant="link" size="sm" class="h-auto p-0 text-blue-600 ml-2">
              <Icon name="lucide:plus" class="size-4 mr-1" />
              Add modifier
            </Button>
          </span>
        </div>
      </div>
    </div>

    <!-- Calculation preview -->
    <div class="rounded-lg border bg-muted/40 p-3">
      <div class="text-xs font-medium mb-2">Calculation Preview</div>
      <div class="text-sm space-y-1 text-muted-foreground">
        <div>Base rate: {{ currencySymbol }}{{ baseRate.toFixed(2) }}</div>
        <div v-for="(rule, idx) in rules" :key="idx" class="text-xs pl-3">
          → {{ rule.type === 'increase_by_amount' ? '+' : rule.type === 'increase_by_percent' ? '+' : '−' }}
          {{ rule.value }}{{ rule.type.includes('percent') ? '%' : '' }}
        </div>
        <div class="border-t pt-1 font-medium text-foreground">
          Final rate: {{ currencySymbol }}{{ calculatedRate.toFixed(2) }}
        </div>
      </div>
    </div>
  </div>
</template>
