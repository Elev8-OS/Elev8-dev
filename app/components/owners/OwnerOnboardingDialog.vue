<!-- app/components/owners/OwnerOnboardingDialog.vue -->
<!--
  Three-step onboarding sheet for adding a new tenant owner.

  The parent owns the open state via `modelValue`. Steps:
    1. Basics — name/email/phone/language/statement currency.
    2. Assignments — one or more property mappings with cumulative
       ownership <= 100% per (listingId, unitId) scope, plus a commission
       rule per mapping.
    3. Permissions — pick a built-in template or customize the field map;
       toggle invite-now.

  On submit, `createOwner` from useOwners is called with the assembled
  draft. Cancel discards the in-flight draft and emits `update:modelValue`
  false.
-->
<script setup lang="ts">
import type { OwnerMappingDraft } from './OwnerOnboardingAssignments.vue'
import type { OwnerBasicsDraft } from './OwnerOnboardingBasics.vue'
import type { CommissionRuleDraft } from '~/components/owners/data/commission-rules'
import type { OwnerPermissionConfig, OwnerPermissionTemplateId } from '~/components/owners/data/owner-permissions'
import type { OwnerPropertyMapping } from '~/components/owners/data/owners'
import { toast } from 'vue-sonner'
import { ownerPermissionTemplates } from '~/components/owners/data/owner-permissions'
import { Button } from '~/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '~/components/ui/sheet'
import { useOwnerOperationalFees } from '~/composables/useOwnerOperationalFees'
import { useOwners } from '~/composables/useOwners'
import OwnerOnboardingAssignments from './OwnerOnboardingAssignments.vue'
import OwnerOnboardingBasics from './OwnerOnboardingBasics.vue'
import OwnerOnboardingPermissions from './OwnerOnboardingPermissions.vue'

export interface OwnerOnboardingDraft {
  basics: OwnerBasicsDraft
  mappings: OwnerMappingDraft[]
  permissionTemplateId: OwnerPermissionTemplateId
  permissionOverrides: OwnerPermissionConfig
  inviteNow: boolean
}

interface Props {
  modelValue: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'created': [ownerId: string]
}>()

const { owners, mappings: existingMappings, createOwner } = useOwners()

const DRAFT_TEMPLATE_ID = `draft-${Math.random().toString(36).slice(2, 10)}`

function makeEmptyDraft(): OwnerOnboardingDraft {
  const today = new Date().toISOString().slice(0, 10)
  // Seed the permission config with a financial_summary template so the
  // matrix renders something sensible before the user picks a template.
  const seed = ownerPermissionTemplates.find(t => t.id === 'financial_summary')!
  return {
    basics: {
      name: '',
      email: '',
      phone: '',
      language: 'en',
      statementCurrency: 'IDR',
    },
    mappings: [
      {
        mapping: {
          listingId: '',
          ownershipPercentage: 100,
          effectiveFrom: today,
        },
        commissionRule: {
          type: 'flat',
          rate: 20,
          listingId: '',
          name: 'Standard 20% management',
          effectiveFrom: today,
        },
        operationalFeePercentage: 100,
      },
    ],
    permissionTemplateId: 'financial_summary',
    permissionOverrides: {
      ownerId: DRAFT_TEMPLATE_ID,
      templateId: 'financial_summary',
      dashboard: { ...seed.dashboard },
      statement: { ...seed.statement },
      updatedAt: new Date().toISOString(),
    },
    inviteNow: false,
  }
}

const draft = ref<OwnerOnboardingDraft>(makeEmptyDraft())
const step = ref<1 | 2 | 3>(1)
const errors = ref<Record<string, string>>({})
const submitting = ref(false)

function isEmailTaken(email: string): boolean {
  if (!email)
    return false
  const normalized = email.trim().toLowerCase()
  return owners.value.some(o => o.email.trim().toLowerCase() === normalized)
}

const basicsErrors = computed<Partial<Record<keyof OwnerBasicsDraft, string>>>(() => ({
  email: errors.value.email,
  name: errors.value.name,
}))

function validateStep1(): boolean {
  const e: Record<string, string> = {}
  if (!draft.value.basics.email.trim()) {
    e.email = 'Email is required.'
  }
  else if (isEmailTaken(draft.value.basics.email)) {
    e.email = 'duplicate'
  }
  if (!draft.value.basics.name.trim()) {
    e.name = 'Name is required.'
  }
  errors.value = e
  return Object.keys(e).length === 0
}

// Ownership validation mirrors useOwners.createOwner — both the batch on its
// own and the batch combined with existing stored mappings must stay <= 100%
// per (listingId, unitId) scope. This keeps the step-2 guard in sync with the
// submit-time check so a fully allocated listing cannot pass the dialog.
const cumulativeOwnershipByScope = computed(() => {
  const totals = new Map<string, number>()
  for (const m of draft.value.mappings) {
    const key = `${m.mapping.listingId}::${m.mapping.unitId ?? ''}`
    totals.set(key, (totals.get(key) ?? 0) + (m.mapping.ownershipPercentage ?? 0))
  }
  // Pass 1 — the batch must not exceed 100% on its own.
  for (const [key, total] of totals) {
    if (total > 100)
      return { valid: false, scope: key, total }
  }
  // Pass 2 — combined with existing mappings on the same scope.
  for (const [key, batchTotal] of totals) {
    const [listingId, unitId] = key.split('::') as [string, string]
    const existingTotal = existingMappings.value
      .filter(item => item.listingId === listingId && (item.unitId ?? '') === unitId)
      .reduce((sum, item) => sum + item.ownershipPercentage, 0)
    if (existingTotal + batchTotal > 100)
      return { valid: false, scope: key, total: existingTotal + batchTotal }
  }
  return { valid: true }
})

function validateStep2(): boolean {
  const e: Record<string, string> = {}
  if (draft.value.mappings.length === 0) {
    e.mappings = 'Add at least one property mapping.'
  }
  else if (draft.value.mappings.some(m => !m.mapping.listingId)) {
    e.mappings = 'Select a property for every mapping.'
  }
  else if (!cumulativeOwnershipByScope.value.valid) {
    e.mappings = 'Cumulative ownership above 100% on a single scope.'
  }
  errors.value = e
  return Object.keys(e).length === 0
}

function validateStep3(): boolean {
  // Permissions are always valid — at minimum the built-in template is set.
  return true
}

function goNext() {
  if (step.value === 1 && !validateStep1())
    return
  if (step.value === 2 && !validateStep2())
    return
  if (step.value === 3 && !validateStep3())
    return
  if (step.value < 3)
    step.value = (step.value + 1) as 1 | 2 | 3
}

function goBack() {
  if (step.value > 1)
    step.value = (step.value - 1) as 1 | 2 | 3
}

function resetDraft() {
  draft.value = makeEmptyDraft()
  step.value = 1
  errors.value = {}
  submitting.value = false
}

function handleCancel() {
  resetDraft()
  emit('update:modelValue', false)
}

async function handleSubmit() {
  if (!validateStep3())
    return
  submitting.value = true
  try {
    const ownerPayload = {
      name: draft.value.basics.name.trim(),
      email: draft.value.basics.email.trim(),
      phone: draft.value.basics.phone.trim(),
      language: draft.value.basics.language,
      statementCurrency: draft.value.basics.statementCurrency,
      annualOwnerUseNightCap: undefined,
    }
    const mappings = draft.value.mappings.map<Omit<OwnerPropertyMapping, 'id' | 'ownerId' | 'commissionRuleId'>>((m) => {
      // Strip empty unitId so it serialises as undefined (matches the
      // domain type) rather than as an empty string.
      const { unitId, ...rest } = m.mapping
      return unitId ? { ...rest, unitId } : rest
    })
    const rules = draft.value.mappings.map<CommissionRuleDraft>((m) => {
      return { ...m.commissionRule, listingId: m.mapping.listingId } as CommissionRuleDraft
    })
    const result = createOwner({
      owner: ownerPayload,
      mappings,
      commissionRules: rules,
      permissions: { ...draft.value.permissionOverrides },
      inviteNow: draft.value.inviteNow,
    })
    if (!result.success) {
      toast.error(result.error ?? 'Failed to create owner.')
      return
    }
    // PRD 5.1.3 — persist the operational cost share per (owner, listing).
    const { saveFee } = useOwnerOperationalFees()
    for (const m of draft.value.mappings) {
      if (!m.mapping.listingId)
        continue
      saveFee({
        ownerId: result.ownerId!,
        listingId: m.mapping.listingId,
        percentage: m.operationalFeePercentage,
      })
    }
    toast.success(`Owner ${ownerPayload.name} ${draft.value.inviteNow ? 'invited' : 'created as draft'}.`)
    emit('created', result.ownerId!)
    resetDraft()
    emit('update:modelValue', false)
  }
  finally {
    submitting.value = false
  }
}

// Keep the listingId on the commission rule in sync with the mapping
// listingId. The mapping editor emits the patch, but we also need to keep
// the permission draft ownerId aligned when the user later edits it.
watch(
  () => draft.value.mappings,
  () => {
    // No-op: mapping rule listingId is updated via patchMapping in
    // OwnerOnboardingAssignments. Hook left here for future derivations.
  },
  { deep: true },
)
</script>

<template>
  <Sheet
    :open="props.modelValue"
    @update:open="(v) => emit('update:modelValue', v)"
  >
    <SheetContent class="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
      <SheetHeader class="border-b px-6 py-4">
        <SheetTitle>Add owner</SheetTitle>
        <SheetDescription>
          Onboard a new property owner. Add their basics, assign ownership
          shares and commission rules, and pick the portal permissions.
        </SheetDescription>
      </SheetHeader>

      <div class="flex items-center gap-2 border-b bg-muted/30 px-6 py-3 text-xs font-medium">
        <button
          type="button"
          class="flex items-center gap-1.5 rounded-full px-2 py-0.5 transition-colors"
          :class="step === 1 ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'"
          @click="step = 1"
        >
          <span
            class="flex size-4 items-center justify-center rounded-full text-[10px]"
            :class="step === 1 ? 'bg-primary-foreground text-primary' : 'bg-muted text-muted-foreground'"
          >1</span>
          Basics
        </button>
        <span class="text-muted-foreground">/</span>
        <button
          type="button"
          class="flex items-center gap-1.5 rounded-full px-2 py-0.5 transition-colors"
          :class="step === 2 ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'"
          @click="step = 2"
        >
          <span
            class="flex size-4 items-center justify-center rounded-full text-[10px]"
            :class="step === 2 ? 'bg-primary-foreground text-primary' : 'bg-muted text-muted-foreground'"
          >2</span>
          Assignments
        </button>
        <span class="text-muted-foreground">/</span>
        <button
          type="button"
          class="flex items-center gap-1.5 rounded-full px-2 py-0.5 transition-colors"
          :class="step === 3 ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'"
          @click="step = 3"
        >
          <span
            class="flex size-4 items-center justify-center rounded-full text-[10px]"
            :class="step === 3 ? 'bg-primary-foreground text-primary' : 'bg-muted text-muted-foreground'"
          >3</span>
          Permissions
        </button>
      </div>

      <div class="flex-1 min-h-0 overflow-y-auto px-6 py-5">
        <OwnerOnboardingBasics
          v-if="step === 1"
          :draft="draft.basics"
          :errors="basicsErrors"
          :email-taken="isEmailTaken(draft.basics.email)"
          @update:draft="(v) => draft.basics = v"
        />
        <OwnerOnboardingAssignments
          v-else-if="step === 2"
          :mappings="draft.mappings"
          :errors="{ mappings: errors.mappings }"
          @update:mappings="(v) => draft.mappings = v"
        />
        <OwnerOnboardingPermissions
          v-else
          :config="draft.permissionOverrides"
          :invite-now="draft.inviteNow"
          @update:config="(v) => draft.permissionOverrides = v"
          @update:invite-now="(v) => draft.inviteNow = v"
        />
      </div>

      <SheetFooter class="flex-row items-center justify-between gap-2 border-t px-6 py-4">
        <Button
          variant="ghost"
          @click="handleCancel"
        >
          Cancel
        </Button>
        <div class="flex items-center gap-2">
          <Button
            v-if="step > 1"
            variant="outline"
            @click="goBack"
          >
            Back
          </Button>
          <Button
            v-if="step < 3"
            @click="goNext"
          >
            Next
          </Button>
          <Button
            v-else
            :disabled="submitting"
            @click="handleSubmit"
          >
            {{ draft.inviteNow ? 'Create & invite owner' : 'Create owner' }}
          </Button>
        </div>
      </SheetFooter>
    </SheetContent>
  </Sheet>
</template>
