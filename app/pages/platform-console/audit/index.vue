<script setup lang="ts">
definePageMeta({ layout: 'platform-console' })
const { can } = useStaffAuth()
const { auditLog } = usePlatformAudit()

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
      <PlatformConsoleAuditLogTable :entries="reversed" />
    </template>
  </div>
</template>