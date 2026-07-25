<!-- app/components/owners/OwnerOnboardingPermissions.vue -->
<!--
  Step 3 of the owner onboarding flow: pick a built-in permission template
  or customize the dashboard/statement field map; toggle invite-now.

  Emits copied patches so the parent never sees alias mutations.
-->
<script setup lang="ts">
import type { OwnerPermissionConfig, OwnerPermissionTemplateId } from '~/components/owners/data/owner-permissions'
import { cn } from '@/lib/utils'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Label } from '~/components/ui/label'
import { Switch } from '~/components/ui/switch'
import OwnerPermissionMatrix from './OwnerPermissionMatrix.vue'

interface Props {
  config: OwnerPermissionConfig
  inviteNow: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:config': [value: OwnerPermissionConfig]
  'update:inviteNow': [value: boolean]
}>()

const templateOptions: { id: Exclude<OwnerPermissionTemplateId, 'custom'>, label: string, description: string }[] = [
  {
    id: 'full_transparency',
    label: 'Full transparency',
    description: 'Owner sees every dashboard metric and every statement line.',
  },
  {
    id: 'financial_summary',
    label: 'Financial summary',
    description: 'Only key financial metrics (revenue, commission, payout).',
  },
]

const customizing = ref(false)

const isCustomMode = computed(() => props.config.templateId === 'custom' || customizing.value)

function applyTemplate(id: Exclude<OwnerPermissionTemplateId, 'custom'>) {
  // Reuse the canonical builder from the data layer so the dialog never
  // diverges from the rest of the app's permission model.
  const updated: OwnerPermissionConfig = {
    ownerId: props.config.ownerId,
    templateId: id,
    dashboard: { ...props.config.dashboard },
    statement: { ...props.config.statement },
    updatedAt: new Date().toISOString(),
  }
  // Re-derive from the canonical template instead of carrying the previous
  // (possibly customised) field map forward.
  emit('update:config', buildConfigFromTemplate(id, props.config.ownerId))
  customizing.value = false
  // updated intentionally unused (buildConfigFromTemplate is the source)
  void updated
}

function buildConfigFromTemplate(id: Exclude<OwnerPermissionTemplateId, 'custom'>, ownerId: string): OwnerPermissionConfig {
  // Inline mirror of buildOwnerPermissionConfig so we don't need to import
  // it for this isolated component. Same shape, same fields.
  if (id === 'full_transparency') {
    return {
      ownerId,
      templateId: 'full_transparency',
      dashboard: {
        grossRevenue: true,
        netRevenue: true,
        occupancy: true,
        adr: true,
        bookingSources: true,
        upcomingReservations: true,
        guestRatings: true,
      },
      statement: {
        revenueLines: true,
        expenseDetails: true,
        commissionDetails: true,
        taxesAndFees: true,
        adjustments: true,
        netPayout: true,
      },
      updatedAt: new Date().toISOString(),
    }
  }
  return {
    ownerId,
    templateId: 'financial_summary',
    dashboard: {
      grossRevenue: false,
      netRevenue: true,
      occupancy: true,
      adr: true,
      bookingSources: false,
      upcomingReservations: false,
      guestRatings: false,
    },
    statement: {
      revenueLines: false,
      expenseDetails: false,
      commissionDetails: true,
      taxesAndFees: false,
      adjustments: false,
      netPayout: true,
    },
    updatedAt: new Date().toISOString(),
  }
}

function startCustomize() {
  customizing.value = true
  if (props.config.templateId !== 'custom') {
    emit('update:config', { ...props.config, templateId: 'custom' })
  }
}

function onMatrixUpdate(next: OwnerPermissionConfig) {
  emit('update:config', next)
}
</script>

<template>
  <div class="space-y-5" data-testid="owner-onboarding-permissions">
    <div class="space-y-2">
      <h4 class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Template
      </h4>
      <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button
          v-for="opt in templateOptions"
          :key="opt.id"
          type="button"
          class="rounded-md border p-3 text-left transition-colors"
          :class="[
            !isCustomMode && props.config.templateId === opt.id
              ? 'border-primary bg-primary/5'
              : 'hover:bg-muted',
          ]"
          @click="applyTemplate(opt.id)"
        >
          <div class="flex items-center gap-2">
            <Icon name="lucide:layout-template" class="size-4 text-primary" />
            <span class="font-medium">{{ opt.label }}</span>
          </div>
          <p class="mt-1 text-xs text-muted-foreground">
            {{ opt.description }}
          </p>
        </button>
      </div>

      <div class="flex items-center justify-between rounded-md border p-3">
        <div class="space-y-0.5">
          <Label class="text-sm">Customize fields</Label>
          <p class="text-xs text-muted-foreground">
            Toggle individual dashboard and statement fields. Switching to
            customize sets the template to <Badge variant="outline" class="ml-1">
              Custom
            </Badge>.
          </p>
        </div>
        <Button
          type="button"
          :variant="customizing ? 'default' : 'outline'"
          size="sm"
          @click="startCustomize"
        >
          {{ customizing ? 'Customizing' : 'Customize' }}
        </Button>
      </div>
    </div>

    <div v-if="isCustomMode" class="rounded-md border p-3">
      <OwnerPermissionMatrix
        :config="props.config"
        @update:config="onMatrixUpdate"
      />
    </div>

    <div class="flex items-center justify-between rounded-md border p-3">
      <div class="space-y-0.5">
        <Label class="text-sm">Invite now</Label>
        <p class="text-xs text-muted-foreground">
          When on, the owner is created in <Badge variant="outline">
            Invited
          </Badge> status and
          the portal invite goes out immediately. When off, they are saved as
          <Badge variant="outline">
            Draft
          </Badge> for later review.
        </p>
      </div>
      <Switch
        :model-value="props.inviteNow"
        @update:model-value="(v) => emit('update:inviteNow', Boolean(v))"
      />
    </div>

    <div class="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
      <p>
        Current template:
        <span
          class="font-medium"
          :class="cn(
            isCustomMode ? 'text-amber-600' : 'text-foreground',
          )"
        >{{ isCustomMode ? 'Custom' : templateOptions.find(t => t.id === props.config.templateId)?.label ?? 'Custom' }}</span>
      </p>
    </div>
  </div>
</template>
