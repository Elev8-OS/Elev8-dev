<script setup lang="ts">
import type { UpsellOrder } from '@/components/upsells/data/upsell-orders'
import { toast } from 'vue-sonner'
import { useUpsellLockAccess } from '@/composables/useUpsellLockAccess'
import { useUpsellOrders } from '@/composables/useUpsellOrders'

const props = defineProps<{
  order: UpsellOrder
}>()

const smartLock = useSmartLock()
const lockAccess = useUpsellLockAccess()
const { issueLockAccess } = useUpsellOrders()

const config = computed(() => lockAccess.lockAccessConfigFor(props.order.serviceId))
const grantsAccess = computed(() => Boolean(config.value?.enabled && config.value.lockNames.length > 0))

const issuedCodes = computed(() =>
  lockAccess.issuedCodesFor(props.order).sort((a, b) => Number(b.status === 'active') - Number(a.status === 'active')),
)

/** The card is only relevant for a service that grants access, or an order that already did. */
const visible = computed(() => grantsAccess.value || issuedCodes.value.length > 0)

const isIssuing = computed(() => lockAccess.isIssuing(props.order.id))
const isPaid = computed(() => props.order.paymentStatus === 'paid')
const listingFound = computed(() => Boolean(lockAccess.listingIdForOrder(props.order)))
const targets = computed(() => lockAccess.resolveTargetsForOrder(props.order))

function lockNameFor(lockId: string) {
  return smartLock.locks.value.find(l => l.id === lockId)?.name ?? 'Lock'
}

function providerFor(lockId: string) {
  const lock = smartLock.locks.value.find(l => l.id === lockId)
  if (!lock)
    return null
  return smartLock.allDevices.value.find(d => d.deviceId === lock.providerDeviceId)?.provider ?? null
}

function formatUntil(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

async function copyCode(code: string) {
  try {
    await navigator.clipboard.writeText(code)
    toast.success('Code copied.')
  }
  catch {
    toast.error('Could not copy the code.')
  }
}

function revoke(codeId: string) {
  smartLock.revokeAccessCode(codeId)
  toast.success('Access code revoked.')
}

function retry() {
  issueLockAccess(props.order.id)
}
</script>

<template>
  <div v-if="visible" class="flex flex-col gap-2">
    <Label class="flex items-center gap-2 text-xs text-muted-foreground">
      <Icon name="lucide:key-round" class="h-3.5 w-3.5 text-amber-600" />
      Smart Lock Access
    </Label>

    <!-- Issued codes -->
    <div v-if="issuedCodes.length > 0" class="flex flex-col gap-2">
      <div
        v-for="code in issuedCodes"
        :key="code.id"
        class="rounded-md border p-3"
        :class="code.status === 'active' ? '' : 'opacity-60'"
      >
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <span class="text-sm font-medium">{{ lockNameFor(code.lockId) }}</span>
            <Badge v-if="providerFor(code.lockId)" variant="secondary" class="h-5 px-1.5 text-[10px] capitalize">
              {{ providerFor(code.lockId) }}
            </Badge>
          </div>
          <Badge
            variant="secondary"
            class="h-5 px-1.5 text-[10px]"
            :class="code.status === 'active' ? 'border-green-500/30 bg-green-500/10 text-green-700' : 'bg-muted text-muted-foreground'"
          >
            {{ code.status === 'active' ? 'Active' : code.status === 'revoked' ? 'Revoked' : 'Expired' }}
          </Badge>
        </div>

        <p class="mt-2 font-mono text-lg tracking-[0.3em]">
          {{ code.code }}
        </p>

        <div class="mt-2 flex items-center justify-between gap-2">
          <span class="text-xs text-muted-foreground">
            Valid until {{ formatUntil(code.endsAt) }}
          </span>
          <div class="flex items-center gap-1">
            <Button variant="ghost" size="sm" class="h-7 gap-1 text-xs" @click="copyCode(code.code)">
              <Icon name="lucide:copy" class="h-3.5 w-3.5" />
              Copy
            </Button>
            <Button
              v-if="code.status === 'active'"
              variant="ghost"
              size="sm"
              class="h-7 gap-1 text-xs text-destructive"
              @click="revoke(code.id)"
            >
              <Icon name="lucide:ban" class="h-3.5 w-3.5" />
              Revoke
            </Button>
          </div>
        </div>
      </div>
    </div>

    <!-- Issuing -->
    <div v-else-if="isIssuing" class="flex items-center gap-2 rounded-md border p-3 text-xs text-muted-foreground">
      <Icon name="lucide:loader-2" class="h-3.5 w-3.5 animate-spin" />
      Issuing access code…
    </div>

    <!-- Nothing issued yet: say why -->
    <template v-else>
      <div v-if="!smartLock.isConnected.value" class="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
        Smart Lock is not connected, so no code can be issued.
        <NuxtLink to="/settings/integrations" class="text-primary underline">
          Connect it in Integrations
        </NuxtLink>.
      </div>

      <div v-else-if="!listingFound" class="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
        No listing matches "{{ order.listing }}", so the locks for this order cannot be resolved.
      </div>

      <div
        v-else-if="targets.matched.length === 0"
        class="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs"
      >
        <Icon name="lucide:triangle-alert" class="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
        <span>
          This service unlocks {{ targets.unmatchedNames.join(', ') }}, but no lock with that name
          is paired at {{ order.listing }}. Pair one, then issue the code.
        </span>
      </div>

      <div v-else-if="!isPaid" class="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
        A code for {{ targets.matched.map(l => l.name).join(', ') }} is issued automatically once
        this order is paid.
      </div>

      <div v-else class="flex items-center justify-between gap-2 rounded-md border p-3 text-xs">
        <span class="text-muted-foreground">Paid, but no code was issued.</span>
        <Button variant="outline" size="sm" class="h-7 gap-1 text-xs" @click="retry">
          <Icon name="lucide:refresh-cw" class="h-3.5 w-3.5" />
          Issue now
        </Button>
      </div>
    </template>

    <p v-if="issuedCodes.length > 0 && targets.unmatchedNames.length > 0" class="text-xs text-amber-700">
      No lock named {{ targets.unmatchedNames.join(', ') }} is paired here, so that part of the
      service was not granted.
    </p>
  </div>
</template>
