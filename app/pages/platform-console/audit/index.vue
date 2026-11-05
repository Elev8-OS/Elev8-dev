<script setup lang="ts">
definePageMeta({ layout: 'platform-console' })
const { can } = useStaffAuth()
const { auditLog } = usePlatformAudit()

const emailQueue = computed(() => auditLog.value.filter(e => e.action === 'banner_email_sent'))
const reversed = computed(() => auditLog.value.slice().reverse())
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between px-6 pt-6">
      <div>
        <h2 class="text-2xl font-semibold tracking-tight">Audit log</h2>
        <p class="text-sm text-muted-foreground">Every staff action and tenant detail view</p>
      </div>
    </div>

    <div v-if="!can('view_audit')" class="m-6 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
      You don't have permission to view the audit log. Switch to Platform Finance or above.
    </div>

    <template v-else>
      <div v-if="emailQueue.length" class="mx-6 rounded-md border bg-card p-4">
        <h3 class="mb-2 flex items-center gap-1.5 text-sm font-semibold">
          <Icon name="lucide:mail" class="size-4" />
          Outbound email queue ({{ emailQueue.length }})
        </h3>
        <div class="space-y-1.5 text-xs">
          <div v-for="e in emailQueue" :key="e.id" class="flex items-center justify-between text-muted-foreground">
            <code>banner_email_sent → tenant {{ e.metadata?.tenantId ?? '—' }}</code>
            <span>{{ e.createdAt.slice(0, 19).replace('T', ' ') }}</span>
          </div>
        </div>
      </div>
      <PlatformConsoleAuditLogTable :entries="reversed" />
    </template>
  </div>
</template>