<script setup lang="ts">
import { toast } from 'vue-sonner'

const props = defineProps<{ notes: string }>()
const emit = defineEmits<{ save: [notes: string] }>()

const draft = ref(props.notes)
watch(() => props.notes, (val) => { draft.value = val })

function save() {
  emit('save', draft.value)
  toast.success('Notes saved')
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="text-base">
        Notes
      </CardTitle>
    </CardHeader>
    <CardContent>
      <Textarea v-model="draft" placeholder="Add notes about this guest..." class="min-h-[100px]" />
      <div class="mt-2 flex justify-end">
        <Button variant="outline" size="sm" @click="save">
          Save notes
        </Button>
      </div>
    </CardContent>
  </Card>
</template>
