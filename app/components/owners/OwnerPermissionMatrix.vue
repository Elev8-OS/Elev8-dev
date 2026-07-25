<!-- app/components/owners/OwnerPermissionMatrix.vue -->
<!--
  Renders the dashboard + statement field toggles for the owner portal.
  Two display modes:
    - readonly: shows the current field map as greyed-out badges (used by
      the detail sheet and the customize-disabled state).
    - interactive: shows clickable toggle buttons that emit `update:config`
      with a fresh copy of the config object (no aliasing).
-->
<script setup lang="ts">
import type { OwnerDashboardField, OwnerPermissionConfig, OwnerStatementField } from '~/components/owners/data/owner-permissions'
import { ownerDashboardFieldLabels, ownerStatementFieldLabels } from '~/components/owners/data/owner-permissions'

interface Props {
  config: OwnerPermissionConfig
  readonly?: boolean
}

const props = withDefaults(defineProps<Props>(), { readonly: false })

const emit = defineEmits<{
  'update:config': [value: OwnerPermissionConfig]
}>()

function toggleDashboard(field: OwnerDashboardField) {
  if (props.readonly)
    return
  const next: OwnerPermissionConfig = {
    ...props.config,
    templateId: 'custom',
    dashboard: { ...props.config.dashboard, [field]: !props.config.dashboard[field] },
  }
  emit('update:config', next)
}

function toggleStatement(field: OwnerStatementField) {
  if (props.readonly)
    return
  const next: OwnerPermissionConfig = {
    ...props.config,
    templateId: 'custom',
    statement: { ...props.config.statement, [field]: !props.config.statement[field] },
  }
  emit('update:config', next)
}

const dashboardFields = Object.keys(ownerDashboardFieldLabels) as OwnerDashboardField[]
const statementFields = Object.keys(ownerStatementFieldLabels) as OwnerStatementField[]
</script>

<template>
  <div class="space-y-5" data-testid="owner-permission-matrix">
    <div class="space-y-2">
      <h4 class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Dashboard
      </h4>
      <div class="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        <div
          v-for="field in dashboardFields"
          :key="field"
          class="flex items-center justify-between rounded-md border px-3 py-2"
        >
          <span class="text-sm">{{ ownerDashboardFieldLabels[field] }}</span>
          <button
            type="button"
            class="flex size-5 items-center justify-center rounded border transition-colors"
            :class="[
              props.config.dashboard[field]
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-input bg-background hover:bg-muted',
              props.readonly ? 'cursor-default' : 'cursor-pointer',
            ]"
            :aria-label="`Toggle ${ownerDashboardFieldLabels[field]}`"
            :aria-pressed="props.config.dashboard[field]"
            :disabled="props.readonly"
            @click="toggleDashboard(field)"
          >
            <Icon v-if="props.config.dashboard[field]" name="lucide:check" class="size-3" />
          </button>
        </div>
      </div>
    </div>

    <div class="space-y-2">
      <h4 class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Statement
      </h4>
      <div class="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        <div
          v-for="field in statementFields"
          :key="field"
          class="flex items-center justify-between rounded-md border px-3 py-2"
        >
          <span class="text-sm">{{ ownerStatementFieldLabels[field] }}</span>
          <button
            type="button"
            class="flex size-5 items-center justify-center rounded border transition-colors"
            :class="[
              props.config.statement[field]
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-input bg-background hover:bg-muted',
              props.readonly ? 'cursor-default' : 'cursor-pointer',
            ]"
            :aria-label="`Toggle ${ownerStatementFieldLabels[field]}`"
            :aria-pressed="props.config.statement[field]"
            :disabled="props.readonly"
            @click="toggleStatement(field)"
          >
            <Icon v-if="props.config.statement[field]" name="lucide:check" class="size-3" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
