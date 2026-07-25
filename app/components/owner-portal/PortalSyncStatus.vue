<script setup lang="ts">
import type { OwnerStay, OwnerStaySyncTarget } from '~/components/owners/data/owner-stays'
import { ownerStaySyncTargetLabels } from '~/components/owners/data/owner-stays'

defineProps<{ stay: OwnerStay }>()
const emit = defineEmits<{ retry: [OwnerStaySyncTarget] }>()
const targets: OwnerStaySyncTarget[] = ['cockpit', 'channex', 'notifications']
void ownerStaySyncTargetLabels
</script>

<template>
  <div class="flex flex-wrap gap-2" aria-label="Sync status">
    <span v-for="target in targets" :key="target" class="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs" :class="stay.syncState[target] === 'failed' ? 'border-destructive text-destructive' : 'text-muted-foreground'"><span>{{ ownerStaySyncTargetLabels[target] }}: {{ stay.syncState[target] }}</span><Button v-if="stay.syncState[target] === 'failed'" variant="link" size="sm" class="h-auto p-0" @click="emit('retry', target)">Retry</Button></span>
  </div>
</template>
