<script setup lang="ts">
import { Icon } from '#components'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Textarea } from '~/components/ui/textarea'

const props = defineProps<{ modelValue: Record<string, any> }>()
const emit = defineEmits<{ 'update:modelValue': [v: Record<string, any>] }>()

function update(patch: Record<string, any>) {
  emit('update:modelValue', { ...props.modelValue, ...patch })
}

interface Tip { title: string, body: string, icon?: string }

const tips = computed({
  get: () => (props.modelValue.tips ?? []) as Tip[],
  set: (v: Tip[]) => update({ tips: v }),
})

function add() {
  tips.value = [...tips.value, { title: '', body: '', icon: '' }]
}

function remove(idx: number) {
  tips.value = tips.value.filter((_, i) => i !== idx)
}

function updateTip(idx: number, patch: Partial<Tip>) {
  tips.value = tips.value.map((t, i) => (i === idx ? { ...t, ...patch } : t))
}
</script>

<template>
  <div class="space-y-3">
    <div
      v-for="(_tip, idx) in tips"
      :key="idx"
      class="space-y-2 rounded-md border p-3"
    >
      <div class="flex items-center justify-between">
        <span class="text-sm font-medium">Tip {{ idx + 1 }}</span>
        <Button variant="ghost" size="sm" @click="remove(idx)">
          <Icon name="lucide:trash-2" class="size-4" />
        </Button>
      </div>
      <Input
        :model-value="tips[idx]?.title ?? ''"
        placeholder="Title (e.g. Warung Bu Mi)"
        @update:model-value="updateTip(idx, { title: String($event) })"
      />
      <Input
        :model-value="tips[idx]?.icon ?? ''"
        placeholder="Icon (e.g. utensils, sun, map-pin)"
        @update:model-value="updateTip(idx, { icon: String($event) })"
      />
      <Textarea
        :model-value="tips[idx]?.body ?? ''"
        rows="2"
        placeholder="Short description"
        @update:model-value="updateTip(idx, { body: String($event) })"
      />
    </div>
    <Button variant="outline" size="sm" @click="add">
      + Add tip
    </Button>
  </div>
</template>
