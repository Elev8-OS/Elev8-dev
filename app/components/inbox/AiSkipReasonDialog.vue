<script lang="ts" setup>
import type { AiSkipReason } from '~/components/inbox/data/conversations'

defineProps<{
  reason: AiSkipReason
  /** The template ElevAI held back. */
  templateLabel: string
  /** The message body it would have sent, shown so the host can judge the call. */
  templateContent?: string
  /** Hidden once the host has sent the template by hand. */
  canSend?: boolean
}>()

const emit = defineEmits<{ send: [] }>()

const open = defineModel<boolean>('open', { default: false })

function handleSend() {
  emit('send')
  open.value = false
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2 text-base">
          <Icon name="lucide:sparkles" class="size-4 text-[#C8A84B]" />
          Why was this message skipped?
        </DialogTitle>
        <DialogDescription class="sr-only">
          ElevAI's explanation of why it held back the {{ templateLabel }} template.
        </DialogDescription>
      </DialogHeader>

      <p class="text-sm leading-relaxed">
        {{ reason.explanation }}
      </p>

      <div v-if="templateContent" class="rounded-lg border bg-muted/40 p-3">
        <p class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {{ templateLabel }} — not sent
        </p>
        <p class="mt-2 text-xs italic leading-relaxed text-muted-foreground">
          {{ templateContent }}
        </p>
      </div>

      <DialogFooter v-if="canSend">
        <Button variant="outline" size="sm" @click="open = false">
          Keep it skipped
        </Button>
        <Button size="sm" @click="handleSend">
          Send it anyway
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
