<script setup lang="ts">
import { Button } from '~/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '~/components/ui/dialog'
import { Label } from '~/components/ui/label'
import { Textarea } from '~/components/ui/textarea'

const props = defineProps<{
  open: boolean
  mode: 'update' | 'resolve'
  bannerTitle: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'submit': [message: string]
}>()

const MAX = 200
const message = ref('')

watch(() => props.open, (o) => {
  if (o) message.value = ''
})

const isResolve = computed(() => props.mode === 'resolve')
// An update needs words; resolving has a default note.
const valid = computed(() => message.value.length <= MAX && (isResolve.value || message.value.trim().length > 0))
</script>

<template>
  <Dialog :open="open" @update:open="(v: boolean) => emit('update:open', v)">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{{ isResolve ? 'Mark as resolved' : 'Post an update' }}</DialogTitle>
        <DialogDescription>
          {{ isResolve
            ? `Ends "${bannerTitle}" right away. Tenants stop seeing it and its slot is free. The note is kept for staff.`
            : `Adds a note under "${bannerTitle}". Tenants who dismissed it see it again.` }}
        </DialogDescription>
      </DialogHeader>
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <Label for="banner-update-message">{{ isResolve ? 'Note (optional)' : 'Message' }}</Label>
          <span class="text-xs" :class="message.length > MAX ? 'text-destructive' : 'text-muted-foreground'">{{ message.length }} / {{ MAX }}</span>
        </div>
        <Textarea
          id="banner-update-message"
          v-model="message"
          :rows="3"
          :maxlength="MAX"
          :placeholder="isResolve ? 'Maintenance is complete. Everything is back to normal.' : 'The work is taking a little longer than planned.'"
        />
      </div>
      <DialogFooter>
        <Button variant="outline" @click="emit('update:open', false)">Cancel</Button>
        <Button :disabled="!valid" @click="emit('submit', message.trim())">
          {{ isResolve ? 'Mark resolved' : 'Post update' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
