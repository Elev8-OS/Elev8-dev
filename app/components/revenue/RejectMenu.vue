<script setup lang="ts">
/**
 * Rejecting must be as cheap as accepting, and the reason is what makes a "no"
 * useful. Structured, because a free-text box nobody reads is not feedback.
 *
 * These answers adjust thresholds, ceilings and prompt rules. They do not train
 * a model — fine-tuning on rejections would fit one operator's taste and
 * destroy the reproducibility the measurement depends on.
 */
import type { RejectionReason } from '~/components/revenue/data/diagnosis'
import { rejectionEffects, rejectionLabels } from '~/components/revenue/data/diagnosis'
import { Button } from '~/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'

defineProps<{ disabled?: boolean }>()
const emit = defineEmits<{ reject: [reason: RejectionReason] }>()

const reasons = Object.keys(rejectionLabels) as RejectionReason[]
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="outline" size="sm" :disabled="disabled">
        Reject
        <Icon name="lucide:chevron-down" class="size-3.5" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="w-80">
      <DropdownMenuLabel class="text-xs font-normal text-muted-foreground">
        Why? Each answer changes something.
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        v-for="reason in reasons"
        :key="reason"
        class="flex-col items-start gap-0.5 py-2"
        @select="emit('reject', reason)"
      >
        <span class="text-sm font-medium">{{ rejectionLabels[reason] }}</span>
        <span class="text-xs text-muted-foreground">{{ rejectionEffects[reason] }}</span>
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
