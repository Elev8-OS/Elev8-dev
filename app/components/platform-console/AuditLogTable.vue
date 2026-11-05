<script setup lang="ts">
import { Input } from '~/components/ui/input'
import type { PlatformAuditEntry, AuditAction } from '~/composables/usePlatformAudit'

const props = defineProps<{ entries: PlatformAuditEntry[] }>()

const search = ref('')
const actionFilter = ref<AuditAction | ''>('')

const filtered = computed(() => props.entries.filter((e) => {
  if (actionFilter.value && e.action !== actionFilter.value) return false
  if (search.value) {
    const q = search.value.toLowerCase()
    if (!e.targetId.toLowerCase().includes(q) && !e.action.toLowerCase().includes(q)) return false
  }
  return true
}))

const actionOptions: AuditAction[] = [
  'view_billing', 'view_pricing', 'view_users', 'view_activity',
  'next_charge_adjusted', 'next_charge_reverted',
  'override_proposed', 'override_approved', 'override_rejected', 'override_revoked', 'override_expired',
  'banner_scheduled', 'banner_live', 'banner_updated', 'banner_resolved', 'banner_retracted',
]

function formatTime(iso: string) {
  return iso.slice(0, 19).replace('T', ' ')
}
</script>

<template>
  <div class="space-y-4 p-6">
    <div class="flex items-center gap-2">
      <Input v-model="search" placeholder="Search by action or target…" class="w-64" />
      <select v-model="actionFilter" class="rounded-md border bg-background px-3 py-1.5 text-sm">
        <option value="">All actions</option>
        <option v-for="a in actionOptions" :key="a" :value="a">{{ a }}</option>
      </select>
    </div>
    <ClientOnly>
      <div class="rounded-md border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Metadata</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="e in filtered" :key="e.id">
              <TableCell class="text-xs text-muted-foreground font-mono">{{ formatTime(e.createdAt) }}</TableCell>
              <TableCell>
                <div class="text-sm">{{ e.actorStaffId }}</div>
                <div class="text-xs text-muted-foreground">{{ e.actorRole }}</div>
              </TableCell>
              <TableCell><code class="text-xs">{{ e.action }}</code></TableCell>
              <TableCell>
                <div class="text-xs">{{ e.targetType }}</div>
                <code class="text-xs">{{ e.targetId }}</code>
              </TableCell>
              <TableCell>
                <code v-if="e.metadata" class="text-xs">{{ JSON.stringify(e.metadata) }}</code>
                <span v-else class="text-xs text-muted-foreground">—</span>
              </TableCell>
            </TableRow>
            <TableRow v-if="!filtered.length">
              <TableCell :colspan="5" class="text-center text-sm text-muted-foreground py-8">
                No audit entries match your filters
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
      <template #fallback>
        <div class="h-96 rounded-md border bg-muted/20 animate-pulse" />
      </template>
    </ClientOnly>
  </div>
</template>