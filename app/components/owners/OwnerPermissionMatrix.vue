<!-- app/components/owners/OwnerPermissionMatrix.vue -->
<!--
  Renders the dashboard + statement field toggles for the owner portal.
  Two visually distinct modes per section:
    - locked (readonly): compact muted rows with On/Off status badges —
      clearly a read-only summary, no checkboxes.
    - interactive (edit): bordered rows with clickable toggle checkboxes
      that emit `update:config` with a fresh copy of the config object
      (no aliasing).

  Props:
    - section: 'dashboard' | 'statement' | 'both' (default 'both').
      Lets the detail sheet render Dashboard and Statement as separate,
      independently-editable cards.
    - readonlyDashboard / readonlyStatement: lock a single section even when
      the other section is interactive. `readonly` still locks both.
    - showHeading: renders the Dashboard/Statement h4 (default true).
-->
<script setup lang="ts">
import type { OwnerDashboardField, OwnerPermissionConfig, OwnerStatementField } from '~/components/owners/data/owner-permissions'
import { ownerDashboardFieldLabels, ownerStatementFieldLabels } from '~/components/owners/data/owner-permissions'

interface Props {
  config: OwnerPermissionConfig
  readonly?: boolean
  readonlyDashboard?: boolean
  readonlyStatement?: boolean
  section?: 'dashboard' | 'statement' | 'both'
  showHeading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  readonly: false,
  readonlyDashboard: false,
  readonlyStatement: false,
  section: 'both',
  showHeading: true,
})

const emit = defineEmits<{
  'update:config': [value: OwnerPermissionConfig]
}>()

const renderDashboard = computed(() => props.section === 'both' || props.section === 'dashboard')
const renderStatement = computed(() => props.section === 'both' || props.section === 'statement')

const dashboardLocked = computed(() => props.readonly || props.readonlyDashboard)
const statementLocked = computed(() => props.readonly || props.readonlyStatement)

function toggleDashboard(field: OwnerDashboardField) {
  if (dashboardLocked.value)
    return
  const next: OwnerPermissionConfig = {
    ...props.config,
    templateId: 'custom',
    dashboard: { ...props.config.dashboard, [field]: !props.config.dashboard[field] },
  }
  emit('update:config', next)
}

function toggleStatement(field: OwnerStatementField) {
  if (statementLocked.value)
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
    <div v-if="renderDashboard" class="space-y-2">
      <h4 v-if="props.showHeading" class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Dashboard
      </h4>
      <div class="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        <div
          v-for="field in dashboardFields"
          :key="field"
          class="flex items-center justify-between gap-2 rounded-md px-3 py-2"
          :class="dashboardLocked
            ? 'bg-muted/40 text-muted-foreground'
            : 'border transition-colors hover:bg-accent/50'"
        >
          <span class="text-sm">{{ ownerDashboardFieldLabels[field] }}</span>

          <!-- Locked: status badge only -->
          <span
            v-if="dashboardLocked"
            class="rounded-full px-2 py-0.5 text-[11px] font-medium"
            :class="props.config.dashboard[field]
              ? 'bg-green-500/10 text-green-700 dark:text-green-300'
              : 'bg-muted text-muted-foreground'"
          >
            {{ props.config.dashboard[field] ? 'On' : 'Off' }}
          </span>

          <!-- Edit: toggle checkbox -->
          <button
            v-else
            type="button"
            class="flex size-5 items-center justify-center rounded border transition-colors"
            :class="props.config.dashboard[field]
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-input bg-background hover:bg-muted'"
            :aria-label="`Toggle ${ownerDashboardFieldLabels[field]}`"
            :aria-pressed="props.config.dashboard[field]"
            @click="toggleDashboard(field)"
          >
            <Icon v-if="props.config.dashboard[field]" name="lucide:check" class="size-3" />
          </button>
        </div>
      </div>
    </div>

    <div v-if="renderStatement" class="space-y-2">
      <h4 v-if="props.showHeading" class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Statement
      </h4>
      <div class="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        <div
          v-for="field in statementFields"
          :key="field"
          class="flex items-center justify-between gap-2 rounded-md px-3 py-2"
          :class="statementLocked
            ? 'bg-muted/40 text-muted-foreground'
            : 'border transition-colors hover:bg-accent/50'"
        >
          <span class="text-sm">{{ ownerStatementFieldLabels[field] }}</span>

          <!-- Locked: status badge only -->
          <span
            v-if="statementLocked"
            class="rounded-full px-2 py-0.5 text-[11px] font-medium"
            :class="props.config.statement[field]
              ? 'bg-green-500/10 text-green-700 dark:text-green-300'
              : 'bg-muted text-muted-foreground'"
          >
            {{ props.config.statement[field] ? 'On' : 'Off' }}
          </span>

          <!-- Edit: toggle checkbox -->
          <button
            v-else
            type="button"
            class="flex size-5 items-center justify-center rounded border transition-colors"
            :class="props.config.statement[field]
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-input bg-background hover:bg-muted'"
            :aria-label="`Toggle ${ownerStatementFieldLabels[field]}`"
            :aria-pressed="props.config.statement[field]"
            @click="toggleStatement(field)"
          >
            <Icon v-if="props.config.statement[field]" name="lucide:check" class="size-3" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
