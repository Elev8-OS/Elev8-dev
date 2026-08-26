<script setup lang="ts">
import type { GuestRegistration } from './data/guest-registration'
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { providerLabels, statusLabels } from './data/guest-registration'

const props = defineProps<{
  registration: GuestRegistration | null
}>()

const emit = defineEmits<{
  close: []
  submitted: [reg: GuestRegistration]
}>()

const gr = useGuestRegistration()
const isSubmitting = ref(false)
const submitError = ref('')

// Reset the spinner whenever a new registration is passed in, so a stale
// "Submitting…" state can never survive across dialog opens.
watch(() => props.registration, () => {
  isSubmitting.value = false
  submitError.value = ''
})

const open = computed({
  get: () => props.registration !== null,
  set: (val: boolean) => {
    if (!val)
      emit('close')
  },
})

async function handleSubmit() {
  if (!props.registration || isSubmitting.value)
    return
  isSubmitting.value = true
  submitError.value = ''
  try {
    const result = await gr.submitRegistration(props.registration.id)
    if (!result.success) {
      submitError.value = result.error ?? 'Submission failed.'
      return
    }
    toast.success(`Report submitted for ${props.registration.guestName}.`)
    emit('submitted', props.registration)
    emit('close')
  }
  catch (err) {
    console.error('submitRegistration failed', err)
    submitError.value = 'An unexpected error occurred. Please try again.'
  }
  finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <Dialog :open="open" @update:open="open = $event">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Submit guest registration</DialogTitle>
        <DialogDescription>
          Submit a {{ providerLabels[registration!.provider] }} report for this guest to the government system.
        </DialogDescription>
      </DialogHeader>

      <div v-if="registration" class="space-y-3 rounded-lg border bg-muted/20 p-4 text-sm">
        <div class="flex items-center justify-between">
          <span class="text-muted-foreground">Guest</span>
          <span class="font-medium">{{ registration.guestName }}</span>
        </div>
        <div class="flex items-center justify-between">
          <span class="text-muted-foreground">Listing</span>
          <span class="max-w-[220px] truncate text-right font-medium">{{ registration.listingName }}</span>
        </div>
        <div class="flex items-center justify-between">
          <span class="text-muted-foreground">Stay</span>
          <span class="font-medium">{{ registration.checkIn }} → {{ registration.checkOut }}</span>
        </div>
        <div class="flex items-center justify-between">
          <span class="text-muted-foreground">Status</span>
          <span class="font-medium">{{ statusLabels[registration.status] }}</span>
        </div>
      </div>

      <div v-if="submitError" class="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
        <div class="flex items-start gap-2">
          <Icon name="lucide:alert-circle" class="mt-0.5 size-4 shrink-0" />
          <span>{{ submitError }}</span>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" :disabled="isSubmitting" @click="emit('close')">
          Cancel
        </Button>
        <Button :disabled="isSubmitting" class="gap-2" @click="handleSubmit">
          <Icon v-if="isSubmitting" name="lucide:loader-circle" class="size-4 animate-spin" />
          {{ isSubmitting ? 'Submitting…' : 'Submit report' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
