<script setup lang="ts">
import type { CockpitCreateRequest } from '~/components/cockpit/data/cockpit'
import { Button } from '~/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'

/**
 * After a click or drag across free nights: book a guest there (opens the
 * New reservation sheet, prefilled) or block the nights with a reason.
 */
const props = defineProps<{ request: CockpitCreateRequest | null }>()
const emit = defineEmits<{ reserve: [request: CockpitCreateRequest], block: [request: CockpitCreateRequest, reason: string] }>()
const open = defineModel<boolean>('open', { default: false })

const reason = ref('')
watch(open, (isOpen) => {
  if (isOpen)
    reason.value = ''
})

function formatDay(key: string) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y!, m! - 1, d!).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

const nights = computed(() => {
  if (!props.request)
    return 0
  const [a, b] = [props.request.checkIn, props.request.checkOut].map((k) => {
    const [y, m, d] = k.split('-').map(Number)
    return Date.UTC(y!, m! - 1, d!)
  })
  return Math.round((b! - a!) / 86_400_000)
})

function reserve() {
  if (props.request)
    emit('reserve', props.request)
  open.value = false
}

function block() {
  if (props.request)
    emit('block', props.request, reason.value.trim() || 'Blocked')
  open.value = false
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{{ request?.rowName }}</DialogTitle>
        <DialogDescription v-if="request">
          {{ formatDay(request.checkIn) }} to {{ formatDay(request.checkOut) }}, {{ nights }} {{ nights === 1 ? 'night' : 'nights' }}
        </DialogDescription>
      </DialogHeader>
      <div class="grid gap-2">
        <Label for="cockpit-block-reason">Block reason (only for Block nights)</Label>
        <Input id="cockpit-block-reason" v-model="reason" placeholder="Maintenance, deep clean, owner use" @keydown.enter="block" />
      </div>
      <DialogFooter class="gap-2 sm:gap-2">
        <Button variant="outline" @click="block">
          <Icon name="lucide:ban" class="mr-2 size-4" />
          Block nights
        </Button>
        <Button @click="reserve">
          <Icon name="lucide:calendar-plus" class="mr-2 size-4" />
          New reservation
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
