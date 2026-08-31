<script setup lang="ts">
import { computed } from 'vue'

interface DerivedRule {
  type: 'increase_by_amount' | 'increase_by_percent' | 'decrease_by_amount' | 'decrease_by_percent'
  value: string
}

interface Props {
  modelValue: Record<string, Array<[string, string]>> | null | undefined
  baseRate: number
  currencySymbol: string
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: null,
})

const emit = defineEmits<{
  'update:modelValue': [value: Record<string, Array<[string, string]>> | null]
}>()

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
  <div class="space-y-3">
    <div class="flex items-center justify-between">
      <Label>Modification Rules</Label>
      <span class="text-[10px] text-muted-foreground">{{ rules.length }} rule{{ rules.length !== 1 ? 's' : '' }}</span>
    </div>

    <div v-if="rules.length === 0" class="rounded-lg border border-dashed bg-muted/30 p-4 text-center">
      <p class="text-sm text-muted-foreground mb-3">No modification rules. Base rate will be used as-is.</p>
      <Button size="sm" variant="outline" @click="addRule">
        <Icon name="lucide:plus" class="mr-1.5 size-3.5" />
        Add Rule
      </Button>
    </div>

    <div v-else class="space-y-2">
      <div v-for="(rule, idx) in rules" :key="idx" class="flex items-end gap-2">
        <div class="flex-1 flex flex-col gap-1.5">
          <Label class="text-xs text-muted-foreground">Rule {{ idx + 1 }}</Label>
          <Select :model-value="rule.type" @update:model-value="(v) => updateRule(idx, 'type', v)">
            <SelectTrigger class="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="opt in ruleOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="w-24 flex flex-col gap-1.5">
          <Label class="text-xs text-muted-foreground">Value</Label>
          <Input
            type="number"
            :model-value="rule.value"
            class="h-8"
            step="0.01"
            @update:model-value="(v) => updateRule(idx, 'value', v)"
          />
        </div>
        <Button variant="ghost" size="icon" class="h-8 w-8 text-destructive" @click="removeRule(idx)">
          <Icon name="lucide:trash-2" class="size-3.5" />
        </Button>
      </div>

      <Button size="sm" variant="outline" class="w-full" @click="addRule">
        <Icon name="lucide:plus" class="mr-1.5 size-3.5" />
        Add Rule
      </Button>
    </div>

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
