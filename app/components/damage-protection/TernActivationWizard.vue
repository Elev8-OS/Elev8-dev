<script setup lang="ts">
import type { ActivationDraft, ActivationStepId, TernBankDraft } from '~/components/reservations/data/tern-activation'
import { toast } from 'vue-sonner'
import { formatProtectionAmount } from '~/components/reservations/data/damage-protection'
import { elev8CoverPartner } from '~/components/reservations/data/damage-protection-seed'
import {
  ACTIVATION_STEPS,
  bankAccountLabel,
  bankDraftFromInvoiceTemplate,
  bankDraftToAccount,
  createActivationDraft,
  firstInvalidActivationStep,
  invoiceTemplateHasBank,
  TERN_ACTIVATION_TERMS,
  validateActivationStep,
} from '~/components/reservations/data/tern-activation'
import { TERN_PRODUCTS, ternSizeLabel } from '~/components/reservations/data/tern-products'
import { useInvoiceTemplates } from '~/composables/useInvoiceTemplates'
import { useOnboarding } from '~/composables/useOnboarding'
import { useTernActivation } from '~/composables/useTernActivation'

/**
 * Activating the damage waiver: accept the Tern terms and give Tern a bank
 * account for claim payouts, then register the organization on Tern. There is
 * no card step: the per-stay fees go on the card saved at onboarding. Works
 * on a DRAFT: nothing is stored before Activate, and a failed registration
 * keeps what was typed.
 *
 * `mode: 'bank'` is the same bank step on its own, for changing the account
 * once the service is active.
 */
const props = withDefaults(defineProps<{
  mode?: 'activate' | 'bank'
}>(), { mode: 'activate' })

const open = defineModel<boolean>('open', { required: true })

const tern = useTernActivation()
const { templates } = useInvoiceTemplates()
const onboarding = useOnboarding()

const draft = ref<ActivationDraft>(createActivationDraft())
const stepIndex = ref(0)
const errors = ref<Record<string, string>>({})
const simulateFailure = ref(false)
const done = ref(false)

const steps = computed(() => props.mode === 'bank'
  ? ACTIVATION_STEPS.filter(s => s.id === 'bank')
  : ACTIVATION_STEPS)
const step = computed(() => steps.value[stepIndex.value]!)
const isLast = computed(() => stepIndex.value === steps.value.length - 1)

watch(open, (isOpen) => {
  if (!isOpen)
    return
  // The bank carries over from the record (a retry, or a bank change); the
  // terms are always accepted afresh.
  draft.value = createActivationDraft(tern.activation.value)
  stepIndex.value = 0
  errors.value = {}
  done.value = false
})

/** Invoice templates that already print a bank account: the one-click prefill. */
const bankSources = computed(() => templates.value.filter(invoiceTemplateHasBank))

function copyFromTemplate(id: unknown) {
  const template = bankSources.value.find(t => t.id === id)
  if (!template)
    return
  draft.value = {
    ...draft.value,
    bank: bankDraftFromInvoiceTemplate(template, draft.value.bank.country),
    bankCopiedFromTemplateId: template.id,
  }
  errors.value = {}
}

function setBank(field: keyof TernBankDraft, value: string | number) {
  draft.value = { ...draft.value, bank: { ...draft.value.bank, [field]: String(value) } }
}

function toggleTerms() {
  draft.value = { ...draft.value, termsAccepted: !draft.value.termsAccepted }
}

function next() {
  errors.value = validateActivationStep(draft.value, step.value.id)
  if (Object.keys(errors.value).length)
    return
  stepIndex.value += 1
}

function back() {
  errors.value = {}
  stepIndex.value = Math.max(0, stepIndex.value - 1)
}

function goTo(id: ActivationStepId) {
  const index = steps.value.findIndex(s => s.id === id)
  if (index >= 0)
    stepIndex.value = index
}

/** The per-stay fees go on the subscription card; without one there is nothing to activate against. */
const hasSubscriptionCard = computed(() => Boolean(tern.subscriptionPaymentMethodId.value))

const organizationName = computed(() =>
  onboarding.state.value.profile?.companyName?.trim() || draft.value.bank.accountHolder.trim())

async function activate() {
  // Every step again: a tenant can walk back and break an earlier one.
  const invalid = firstInvalidActivationStep(draft.value)
  if (invalid) {
    goTo(invalid)
    errors.value = validateActivationStep(draft.value, invalid)
    return
  }
  const result = await tern.activate(draft.value, organizationName.value, simulateFailure.value)
  if (result.ok) {
    done.value = true
    toast.success('Damage waiver activated')
  }
}

function saveBank() {
  errors.value = validateActivationStep(draft.value, 'bank')
  if (Object.keys(errors.value).length)
    return
  const result = tern.updatePayoutBank(draft.value.bank, draft.value.bankCopiedFromTemplateId)
  if (result.ok) {
    toast.success('Bank account updated. Claims filed from now on are paid here.')
    open.value = false
  }
}

const bankPreview = computed(() => bankDraftToAccount(draft.value.bank))
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="flex max-h-[90vh] flex-col gap-0 p-0 sm:max-w-2xl" data-testid="tern-activation">
      <DialogHeader class="border-b px-6 py-4">
        <DialogTitle>{{ mode === 'bank' ? 'Change the payout bank account' : 'Activate the damage waiver' }}</DialogTitle>
        <DialogDescription>
          {{ mode === 'bank'
            ? 'Where Tern pays your approved claims by bank transfer.'
            : 'Accept the terms, add the bank account Tern pays into, and Elev8 registers you with Tern.' }}
        </DialogDescription>
      </DialogHeader>

      <!-- Done: the service is live -->
      <div v-if="done" class="flex flex-col items-center gap-3 px-6 py-10 text-center" data-testid="tern-activation-done">
        <Icon name="lucide:shield-check" class="size-10 text-primary" />
        <p class="text-lg font-semibold">
          Damage waiver active
        </p>
        <p class="max-w-md text-sm text-muted-foreground">
          You are registered with Tern as {{ organizationName }}
          ({{ tern.activation.value.ternOrganizationId }}). Now choose which properties are protected, and who pays, in the
          Listings tab.
        </p>
        <Button class="mt-2" @click="open = false">
          Done
        </Button>
      </div>

      <template v-else>
        <!-- Steps -->
        <ol v-if="steps.length > 1" class="flex gap-2 border-b px-6 py-3 text-xs" data-testid="tern-activation-steps">
          <li
            v-for="(s, index) in steps"
            :key="s.id"
            class="flex flex-1 items-center gap-1.5"
            :class="index === stepIndex ? 'font-medium text-foreground' : 'text-muted-foreground'"
            :aria-current="index === stepIndex ? 'step' : undefined"
          >
            <span
              class="flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px]"
              :class="index < stepIndex ? 'border-primary bg-primary text-primary-foreground' : index === stepIndex ? 'border-primary' : ''"
            >
              <Icon v-if="index < stepIndex" name="lucide:check" class="size-3" />
              <template v-else>{{ index + 1 }}</template>
            </span>
            {{ s.title }}
          </li>
        </ol>

        <div class="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <!-- 1. Terms -->
          <section v-if="step.id === 'terms'" class="flex flex-col gap-4" data-testid="tern-step-terms">
            <ul class="flex flex-col gap-2 text-sm">
              <li v-for="term in TERN_ACTIVATION_TERMS" :key="term" class="flex items-start gap-2">
                <Icon name="lucide:check" class="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                {{ term }}
              </li>
            </ul>

            <div class="rounded-lg border">
              <table class="w-full text-sm">
                <thead class="bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th class="px-3 py-2 text-left font-medium">
                      Tier
                    </th>
                    <th class="px-3 py-2 text-left font-medium">
                      Sized for
                    </th>
                    <th class="px-3 py-2 text-right font-medium">
                      Covers up to
                    </th>
                    <th class="px-3 py-2 text-right font-medium">
                      Elev8 charges per stay
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="product in TERN_PRODUCTS" :key="product.tier" class="border-t">
                    <td class="px-3 py-2 font-medium">
                      {{ product.name }}
                    </td>
                    <td class="px-3 py-2 text-muted-foreground">
                      {{ ternSizeLabel(product) }}
                    </td>
                    <td class="px-3 py-2 text-right tabular-nums">
                      {{ product.prices.USD ? formatProtectionAmount(product.prices.USD.coverageCap, 'USD') : 'Not priced' }}
                    </td>
                    <td class="px-3 py-2 text-right tabular-nums">
                      {{ product.prices.USD ? formatProtectionAmount(product.prices.USD.perStayFee, 'USD') : 'Not priced' }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p class="text-xs text-muted-foreground">
              Claims up to {{ formatProtectionAmount(elev8CoverPartner.deductiblePerClaim, elev8CoverPartner.currency) }}
              are carried by the waiver fees; Tern pays the part above that.
            </p>

            <!-- A custom box, not reka-ui's Checkbox inside a label: that double-toggles. -->
            <button
              type="button"
              role="checkbox"
              :aria-checked="draft.termsAccepted"
              class="flex items-start gap-2 rounded-lg border p-3 text-left text-sm"
              :class="errors.termsAccepted ? 'border-destructive' : ''"
              data-testid="tern-accept-terms"
              @click="toggleTerms"
            >
              <span
                class="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-[4px] border"
                :class="draft.termsAccepted ? 'border-primary bg-primary text-primary-foreground' : 'border-input'"
              >
                <Icon v-if="draft.termsAccepted" name="lucide:check" class="size-3" />
              </span>
              I accept the damage waiver terms with Tern on behalf of my company.
            </button>
            <p v-if="errors.termsAccepted" class="text-xs text-destructive">
              {{ errors.termsAccepted }}
            </p>
          </section>

          <!-- 2. Bank account -->
          <section v-else-if="step.id === 'bank'" class="flex flex-col gap-4" data-testid="tern-step-bank">
            <p class="text-sm text-muted-foreground">
              Tern pays your approved claims by bank transfer, in {{ elev8CoverPartner.currency }}, into this account. One
              account covers all your listings for now.
            </p>

            <div v-if="bankSources.length" class="flex flex-col gap-1.5">
              <Label>Copy from your invoice settings</Label>
              <Select :model-value="draft.bankCopiedFromTemplateId ?? ''" @update:model-value="copyFromTemplate">
                <SelectTrigger data-testid="tern-bank-source">
                  <SelectValue placeholder="Choose an invoice template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="template in bankSources" :key="template.id" :value="template.id">
                    {{ template.name }} · {{ template.bank.bankName }}
                  </SelectItem>
                </SelectContent>
              </Select>
              <p class="text-xs text-muted-foreground">
                A copy: changing the invoice later does not change where Tern pays.
              </p>
            </div>

            <div class="grid gap-3 sm:grid-cols-2">
              <div class="flex flex-col gap-1.5">
                <Label for="tern-bank-holder">Account holder</Label>
                <Input id="tern-bank-holder" :model-value="draft.bank.accountHolder" @update:model-value="(v) => setBank('accountHolder', v)" />
                <p v-if="errors.accountHolder" class="text-xs text-destructive">
                  {{ errors.accountHolder }}
                </p>
              </div>
              <div class="flex flex-col gap-1.5">
                <Label for="tern-bank-name">Bank</Label>
                <Input id="tern-bank-name" :model-value="draft.bank.bankName" @update:model-value="(v) => setBank('bankName', v)" />
                <p v-if="errors.bankName" class="text-xs text-destructive">
                  {{ errors.bankName }}
                </p>
              </div>
              <div class="flex flex-col gap-1.5">
                <Label for="tern-bank-iban">IBAN</Label>
                <Input id="tern-bank-iban" :model-value="draft.bank.iban" placeholder="CH93 0076 2011 6238 5295 7" @update:model-value="(v) => setBank('iban', v)" />
                <p v-if="errors.iban" class="text-xs text-destructive">
                  {{ errors.iban }}
                </p>
              </div>
              <div class="flex flex-col gap-1.5">
                <Label for="tern-bank-account">Account number <span class="font-normal text-muted-foreground">(if your bank has no IBAN)</span></Label>
                <Input id="tern-bank-account" :model-value="draft.bank.accountNumber" @update:model-value="(v) => setBank('accountNumber', v)" />
              </div>
              <div class="flex flex-col gap-1.5">
                <Label for="tern-bank-bic">BIC / SWIFT</Label>
                <Input id="tern-bank-bic" :model-value="draft.bank.bicSwift" @update:model-value="(v) => setBank('bicSwift', v)" />
                <p v-if="errors.bicSwift" class="text-xs text-destructive">
                  {{ errors.bicSwift }}
                </p>
              </div>
              <div class="flex flex-col gap-1.5">
                <Label for="tern-bank-country">Country (two letters)</Label>
                <Input id="tern-bank-country" :model-value="draft.bank.country" maxlength="2" placeholder="ID" @update:model-value="(v) => setBank('country', v)" />
                <p v-if="errors.country" class="text-xs text-destructive">
                  {{ errors.country }}
                </p>
              </div>
            </div>
          </section>

          <!-- 3. Review -->
          <section v-else class="flex flex-col gap-4" data-testid="tern-step-review">
            <dl class="grid gap-3 text-sm sm:grid-cols-[10rem_1fr]">
              <dt class="text-muted-foreground">
                Registered with Tern as
              </dt>
              <dd class="font-medium">
                {{ organizationName }}
              </dd>
              <dt class="text-muted-foreground">
                Terms
              </dt>
              <dd>
                Accepted
                <Button variant="link" size="sm" class="h-auto p-0 text-xs" @click="goTo('terms')">
                  Review
                </Button>
              </dd>
              <dt class="text-muted-foreground">
                Per-stay fees charged to
              </dt>
              <dd data-testid="tern-review-card">
                {{ hasSubscriptionCard ? 'The card on your Elev8 subscription' : 'No card on your Elev8 subscription' }}
              </dd>
              <dt class="text-muted-foreground">
                Claims paid into
              </dt>
              <dd data-testid="tern-review-bank">
                {{ bankAccountLabel(bankPreview) }}, {{ bankPreview.accountHolder }}
                <template v-if="bankPreview.bicSwift">
                  · {{ bankPreview.bicSwift }}
                </template>
                <Button variant="link" size="sm" class="h-auto p-0 text-xs" @click="goTo('bank')">
                  Change
                </Button>
              </dd>
            </dl>

            <div
              v-if="!hasSubscriptionCard"
              class="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm"
              data-testid="tern-no-subscription-card"
            >
              There is no card on your Elev8 subscription, so the per-stay fees would have nowhere to go. Add one to your
              subscription first.
            </div>

            <div
              v-if="tern.activation.value.status === 'registration_failed'"
              class="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
              data-testid="tern-registration-failed"
            >
              {{ tern.activation.value.lastError }} Your details are kept: try again.
            </div>

            <div class="flex items-center gap-2">
              <Switch id="tern-simulate-failure" :model-value="simulateFailure" @update:model-value="(v) => simulateFailure = v" />
              <Label for="tern-simulate-failure" class="text-xs font-normal text-muted-foreground">Simulate Tern refusing the registration</Label>
            </div>
          </section>
        </div>

        <DialogFooter class="border-t px-6 py-4">
          <Button v-if="stepIndex > 0" variant="outline" @click="back">
            Back
          </Button>
          <Button v-else variant="outline" @click="open = false">
            Cancel
          </Button>
          <Button v-if="mode === 'bank'" data-testid="tern-save-bank" @click="saveBank">
            Save bank account
          </Button>
          <Button v-else-if="!isLast" data-testid="tern-next" @click="next">
            Next
          </Button>
          <Button v-else :disabled="tern.isRegistering.value || !hasSubscriptionCard" data-testid="tern-activate" @click="activate">
            <Icon v-if="tern.isRegistering.value" name="lucide:loader-2" class="mr-1.5 size-3.5 animate-spin" />
            {{ tern.isRegistering.value ? 'Registering with Tern…' : tern.activation.value.status === 'registration_failed' ? 'Try again' : 'Activate' }}
          </Button>
        </DialogFooter>
      </template>
    </DialogContent>
  </Dialog>
</template>
