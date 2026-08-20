<script setup lang="ts">
// Owner portal — contract review & e-sign (PRD 5.3).
//
// Owners who have not signed their contract are routed here after the magic
// link. They review the generated terms and e-sign; only then does portal
// login unlock. The signed contract lives in the owner's Document Center.

import { toast } from 'vue-sonner'
import { listings } from '~/components/listings/data/listings'
import { OWNER_CONTRACT_STATUS_LABELS } from '~/components/owners/data/owner-contracts'
import OwnerSignaturePad from '~/components/OwnerSignaturePad.vue'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { useOwnerAuth } from '~/composables/useOwnerAuth'
import { useOwnerContracts } from '~/composables/useOwnerContracts'
import { useOwners } from '~/composables/useOwners'
import { buildOwnerContractPdf } from '~/lib/owner-contract-pdf'

definePageMeta({ layout: 'owner-portal' })

const { getPendingContract, acceptDemoLink } = useOwnerAuth()
const { getContractForOwner, signContract } = useOwnerContracts()
const { byId } = useOwners()

const signing = ref(false)
const signature = ref('')
const agreed = ref(false)

const pending = computed(() => getPendingContract())

const contract = computed(() => {
  if (!pending.value)
    return undefined
  return getContractForOwner(pending.value.ownerId)
})

const ownerName = computed(() => {
  if (!pending.value)
    return ''
  return byId(pending.value.ownerId)?.name ?? pending.value.ownerName
})

const coveredListings = computed(() =>
  (contract.value?.listingIds ?? [])
    .map(id => listings.value.find(l => l.id === id)?.name ?? id))

const basisText = computed(() => {
  const terms = contract.value?.terms
  if (!terms)
    return ''
  return terms.basis === 'net'
    ? `Fixed ${terms.fixedAmount ?? 0} + ${terms.rate}% of Net revenue`
    : `${terms.rate}% of Gross revenue`
})

function doSign() {
  if (!pending.value || !contract.value || signing.value || !signature.value)
    return
  signing.value = true
  const result = signContract(pending.value.contractId, pending.value.ownerName, signature.value)
  if (!result.ok) {
    signing.value = false
    toast.error('Could not sign the contract. Try again.')
    return
  }
  // Contract signed → the magic-link gate now passes, so mint the session.
  const authResult = acceptDemoLink()
  signing.value = false
  if (authResult.ok) {
    toast.success('Contract signed — welcome to your owner portal.')
    // Hand the owner the signed PDF copy, then open the portal.
    if (result.ok) {
      const owner = byId(pending.value.ownerId)
      buildOwnerContractPdf(result.contract, owner, { download: true })
    }
    navigateTo('/owner-portal')
  }
  else {
    toast.error('Contract signed, but the session could not be created. Request a new link.')
  }
}
</script>

<template>
  <div class="mx-auto flex min-h-[calc(100vh-12rem)] max-w-2xl flex-col justify-center gap-4 p-4 sm:p-8">
    <Card v-if="contract">
      <CardHeader>
        <CardTitle class="text-xl">
          Management agreement
        </CardTitle>
        <CardDescription>
          Review the terms below and sign to activate your owner portal access.
        </CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <div class="space-y-1 text-sm">
          <p class="font-medium">
            {{ ownerName }}
          </p>
          <p class="text-muted-foreground">
            Status: {{ OWNER_CONTRACT_STATUS_LABELS[contract.status] }}
          </p>
        </div>

        <Separator />

        <dl class="space-y-2 text-sm">
          <div class="flex justify-between gap-4">
            <dt class="text-muted-foreground">
              Covered listings
            </dt>
            <dd class="text-right font-medium">
              {{ coveredListings.join(', ') || '—' }}
            </dd>
          </div>
          <div class="flex justify-between gap-4">
            <dt class="text-muted-foreground">
              Commission
            </dt>
            <dd class="text-right font-medium">
              {{ basisText }}
            </dd>
          </div>
          <div class="flex justify-between gap-4">
            <dt class="text-muted-foreground">
              Included services
            </dt>
            <dd class="text-right">
              {{ contract.terms.includedServices.join(', ') || 'None' }}
            </dd>
          </div>
          <div class="flex justify-between gap-4">
            <dt class="text-muted-foreground">
              Operational costs covered by owner
            </dt>
            <dd class="text-right">
              {{ contract.terms.operationalFee }}%
            </dd>
          </div>
        </dl>

        <Separator />

        <p class="text-xs leading-relaxed text-muted-foreground">
          By signing you agree to the management terms above. Operational costs
          (cleaning, utilities, maintenance) are billed separately and are never
          percentage-based. A signed copy is stored in your Document Center.
        </p>

        <Separator />

        <div class="space-y-2">
          <Label for="owner-signature" class="text-sm font-medium">
            Signature
          </Label>
          <OwnerSignaturePad v-model="signature" />
        </div>

        <label class="flex cursor-pointer items-start gap-2 text-sm">
          <Checkbox
            v-model="agreed"
            class="mt-0.5"
          />
          <span>
            I have read and agree to the management terms above.
          </span>
        </label>

        <Button class="w-full" :disabled="signing || !signature || !agreed" @click="doSign">
          <Icon name="lucide:pen-line" class="mr-2 size-4" />
          {{ signing ? 'Signing…' : 'Sign contract' }}
        </Button>
      </CardContent>
    </Card>

    <Card v-else>
      <CardContent class="py-10 text-center text-sm text-muted-foreground">
        No contract is waiting for your signature.
      </CardContent>
    </Card>
  </div>
</template>
