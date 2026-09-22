<script setup lang="ts">
import { computed } from 'vue'
import { toast } from 'vue-sonner'
import { useAssistantFindingsCadence } from '~/composables/useAssistantFindings'

const open = defineModel<boolean>('open', { default: false })

const { lastScanAt, markScannedNow } = useAssistantFindingsCadence()

const lastScanLabel = computed(() => {
  if (!lastScanAt.value) return 'Never'
  const d = new Date(lastScanAt.value)
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
})

function handleScanNow() {
  markScannedNow()
  toast.success('Findings scan started.')
}
</script>

<template>
  <Sheet v-model:open="open">
    <SheetContent class="w-[420px] sm:max-w-[420px] flex flex-col p-0 gap-0 items-stretch">
      <SheetHeader class="px-6 pt-5 pb-4 border-b shrink-0 text-left">
        <SheetTitle>AI Findings</SheetTitle>
        <SheetDescription>Run a fresh scan for anomalies across your portfolio.</SheetDescription>
      </SheetHeader>

      <div class="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        <!-- How it works -->
        <div class="space-y-2">
          <p class="text-sm font-medium">
            How it works
          </p>
          <p class="text-xs text-muted-foreground leading-relaxed">
            Elev8 AI scans your reservations, cleanings, and operations whenever you open this panel. Findings appear as cards you can convert into tasks or ask the AI about.
          </p>
        </div>

        <Separator />

        <!-- Scan status -->
        <div class="space-y-2">
          <p class="text-sm font-medium">
            Last scan
          </p>
          <p class="text-base font-medium tabular-nums" :class="!lastScanAt && 'text-muted-foreground'">
            {{ lastScanLabel }}
          </p>
        </div>
      </div>

      <SheetFooter class="px-6 py-4 border-t shrink-0">
        <Button variant="outline" class="flex-1" @click="open = false">
          Close
        </Button>
        <Button class="flex-1" @click="handleScanNow">
          <Icon name="lucide:refresh-cw" class="size-3.5" />
          Run scan now
        </Button>
      </SheetFooter>
    </SheetContent>
  </Sheet>
</template>
