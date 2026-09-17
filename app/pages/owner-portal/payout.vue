<script setup lang="ts">
// Owner portal — Bank Details. The owner's own payout account and the postal
// address that belongs on their statement.
//
// This is the only surface that writes these fields: staff can read them on
// the Owners page but never edit them, so a wrong account number is always
// the owner's own entry and not a transcription error made on their behalf.

import type { OwnerPayoutErrors } from '~/components/owners/data/owner-payout-details'
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import {
  payoutDetailsToDraft,
} from '~/components/owners/data/owner-payout-details'
import { Alert, AlertDescription, AlertTitle } from '~/components/ui/alert'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { useOwnerPayoutDetails } from '~/composables/useOwnerPayoutDetails'
import { useOwnerPortal } from '~/composables/useOwnerPortal'

definePageMeta({ layout: 'owner-portal' })

const { currentOwner } = useOwnerPortal()
const { currentDetails, saveForCurrentOwner, hasPayoutAccount } = useOwnerPayoutDetails()

const draft = ref(payoutDetailsToDraft(currentDetails.value))
const errors = ref<OwnerPayoutErrors>({})
const saving = ref(false)

// The session resolves after mount, so the form has to re-hydrate when the
// owner's stored details arrive.
watch(currentDetails, (details) => {
  draft.value = payoutDetailsToDraft(details)
  errors.value = {}
})

const hasAccount = computed(() =>
  currentOwner.value ? hasPayoutAccount(currentOwner.value.id) : false)

const updatedAt = computed(() => {
  const iso = currentDetails.value?.updatedAt
  return iso ? new Date(iso).toLocaleDateString('en-GB', { dateStyle: 'medium' }) : null
})

function save() {
  if (saving.value)
    return
  saving.value = true
  const result = saveForCurrentOwner(draft.value)
  saving.value = false

  if (result.ok) {
    errors.value = {}
    toast.success('Payout details saved. Your next statement will use this account.')
    return
  }
  if (result.reason === 'no_session') {
    toast.error('Your session expired. Request a new secure link.')
    return
  }
  errors.value = result.errors
  toast.error('Check the highlighted fields.')
}

function reset() {
  draft.value = payoutDetailsToDraft(currentDetails.value)
  errors.value = {}
}

const isDirty = computed(() => {
  const saved = payoutDetailsToDraft(currentDetails.value)
  return (Object.keys(saved) as Array<keyof typeof saved>).some(key => saved[key] !== draft.value[key])
})
</script>

<template>
  <div class="mx-auto w-full max-w-3xl space-y-4 p-4 sm:p-6">
    <div class="space-y-1">
      <div class="flex flex-wrap items-center gap-2">
        <h1 class="text-2xl font-semibold tracking-tight">
          Bank Details
        </h1>
        <Badge v-if="hasAccount" variant="secondary" data-testid="payout-status">
          Account on file
        </Badge>
        <Badge v-else variant="destructive" data-testid="payout-status">
          No account yet
        </Badge>
      </div>
      <p class="text-sm text-muted-foreground">
        Your payouts are transferred to the account below, and this address is
        printed on your statements.
        <template v-if="updatedAt">
          Last updated {{ updatedAt }}.
        </template>
      </p>
    </div>

    <Alert v-if="!hasAccount" data-testid="payout-empty">
      <Icon name="lucide:info" class="size-4" aria-hidden="true" />
      <AlertTitle>We cannot pay you out yet</AlertTitle>
      <AlertDescription>
        Until this is filled in, your statements will say that no payout account
        is on file and your property manager has nowhere to send the money.
      </AlertDescription>
    </Alert>

    <Card>
      <CardHeader>
        <CardTitle class="text-base">
          Your address
        </CardTitle>
        <CardDescription>
          Appears on every statement, under your name.
        </CardDescription>
      </CardHeader>
      <CardContent class="grid gap-4 sm:grid-cols-2">
        <div class="space-y-1.5 sm:col-span-2">
          <Label for="payout-line1">Street address</Label>
          <Input id="payout-line1" v-model="draft.line1" data-testid="payout-line1" :aria-invalid="Boolean(errors.line1)" />
          <p v-if="errors.line1" class="text-sm text-destructive" role="alert">
            {{ errors.line1 }}
          </p>
        </div>
        <div class="space-y-1.5 sm:col-span-2">
          <Label for="payout-line2">Address line 2 <span class="text-muted-foreground">(optional)</span></Label>
          <Input id="payout-line2" v-model="draft.line2" data-testid="payout-line2" />
        </div>
        <div class="space-y-1.5">
          <Label for="payout-postal">Postal code <span class="text-muted-foreground">(optional)</span></Label>
          <Input id="payout-postal" v-model="draft.postalCode" data-testid="payout-postal" />
        </div>
        <div class="space-y-1.5">
          <Label for="payout-city">City</Label>
          <Input id="payout-city" v-model="draft.city" data-testid="payout-city" :aria-invalid="Boolean(errors.city)" />
          <p v-if="errors.city" class="text-sm text-destructive" role="alert">
            {{ errors.city }}
          </p>
        </div>
        <div class="space-y-1.5 sm:col-span-2">
          <Label for="payout-country">Country</Label>
          <Input id="payout-country" v-model="draft.country" data-testid="payout-country" :aria-invalid="Boolean(errors.country)" />
          <p v-if="errors.country" class="text-sm text-destructive" role="alert">
            {{ errors.country }}
          </p>
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle class="text-base">
          Bank account
        </CardTitle>
        <CardDescription>
          The account your payouts are transferred to. Enter an IBAN, or an
          account number if your bank does not use IBANs.
        </CardDescription>
      </CardHeader>
      <CardContent class="grid gap-4 sm:grid-cols-2">
        <div class="space-y-1.5">
          <Label for="payout-holder">Account holder</Label>
          <Input id="payout-holder" v-model="draft.accountHolder" data-testid="payout-holder" :aria-invalid="Boolean(errors.accountHolder)" />
          <p v-if="errors.accountHolder" class="text-sm text-destructive" role="alert">
            {{ errors.accountHolder }}
          </p>
        </div>
        <div class="space-y-1.5">
          <Label for="payout-bank">Bank name</Label>
          <Input id="payout-bank" v-model="draft.bankName" data-testid="payout-bank" :aria-invalid="Boolean(errors.bankName)" />
          <p v-if="errors.bankName" class="text-sm text-destructive" role="alert">
            {{ errors.bankName }}
          </p>
        </div>
        <div class="space-y-1.5">
          <Label for="payout-iban">IBAN</Label>
          <Input id="payout-iban" v-model="draft.iban" data-testid="payout-iban" :aria-invalid="Boolean(errors.iban)" />
          <p v-if="errors.iban" class="text-sm text-destructive" role="alert">
            {{ errors.iban }}
          </p>
        </div>
        <div class="space-y-1.5">
          <Label for="payout-account-no">Account number</Label>
          <Input id="payout-account-no" v-model="draft.accountNumber" data-testid="payout-account-no" />
        </div>
        <div class="space-y-1.5 sm:col-span-2">
          <Label for="payout-bic">BIC / SWIFT <span class="text-muted-foreground">(optional)</span></Label>
          <Input id="payout-bic" v-model="draft.bicSwift" data-testid="payout-bic" :aria-invalid="Boolean(errors.bicSwift)" />
          <p v-if="errors.bicSwift" class="text-sm text-destructive" role="alert">
            {{ errors.bicSwift }}
          </p>
        </div>
      </CardContent>
    </Card>

    <div class="flex flex-wrap items-center justify-end gap-2">
      <Button variant="outline" :disabled="!isDirty || saving" data-testid="payout-reset" @click="reset">
        Discard changes
      </Button>
      <Button :disabled="saving" data-testid="payout-save" @click="save">
        <Icon name="lucide:save" class="mr-2 size-4" aria-hidden="true" />
        {{ saving ? 'Saving…' : 'Save details' }}
      </Button>
    </div>
  </div>
</template>
