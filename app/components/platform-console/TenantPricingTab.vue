<script setup lang="ts">
import { toast } from 'vue-sonner'
import { Icon } from '#components'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '~/components/ui/sheet'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '~/components/ui/alert-dialog'
import type { Tenant } from './data/tenants'
import { usePricingOverrides } from '~/composables/usePricingOverrides'
import { useStaffAuth } from '~/composables/useStaffAuth'
import { usePlatformAudit } from '~/composables/usePlatformAudit'

const props = defineProps<{ tenant: Tenant }>()

const { activeFor, hasActive, byTenant, revoke } = usePricingOverrides()
const { can } = useStaffAuth()
const { log } = usePlatformAudit()

onMounted(() => log('view_pricing', 'tenant', props.tenant.id))

const applyOpen = ref(false)
const selected = ref<ReturnType<typeof byTenant>[number] | null>(null)
const revokeConfirmId = ref<string | null>(null)
// Kept apart from the id: the dialog's action closes it before doRevoke runs, so clearing the id on close revoked nothing.
const revokeOpen = ref(false)
const history = computed(() => byTenant(props.tenant.id).sort((a, b) => b.proposedAt.localeCompare(a.proposedAt)))
const active = computed(() => activeFor(props.tenant.id))

function statusBadge(status: string): { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string } {
  if (status === 'active') return { variant: 'default', label: 'Active' }
  if (status === 'pending_approval') return { variant: 'secondary', label: 'Pending' }
  if (status === 'rejected') return { variant: 'destructive', label: 'Rejected' }
  if (status === 'expired') return { variant: 'outline', label: 'Expired' }
  if (status === 'revoked') return { variant: 'destructive', label: 'Revoked' }
  return { variant: 'outline', label: status }
}

function doRevoke() {
  if (!revokeConfirmId.value) return
  try {
    revoke(revokeConfirmId.value, 'staff-1')
    toast.success('Override revoked.')
  } catch (e: any) {
    toast.error(e.message ?? 'Failed')
  } finally {
    revokeConfirmId.value = null
    revokeOpen.value = false
  }
}

const sheetOpen = computed({
  get: () => !!selected.value,
  set: (v: boolean) => { if (!v) selected.value = null },
})
</script>

<template>
  <div class="space-y-4">
    <Card v-if="active">
      <CardHeader>
        <div class="flex items-center justify-between">
          <CardTitle>Active override</CardTitle>
          <Badge :variant="statusBadge(active.status).variant">{{ statusBadge(active.status).label }}</Badge>
        </div>
      </CardHeader>
      <CardContent class="space-y-3">
        <div class="grid grid-cols-2 gap-3 text-sm">
          <div><span class="text-muted-foreground">Value:</span> <strong>{{ active.discountType === 'percent' ? `${active.value}%` : `$${active.value}/mo` }}</strong></div>
          <div><span class="text-muted-foreground">Effective:</span> {{ active.effectiveDate.slice(0, 10) }}</div>
          <div><span class="text-muted-foreground">Expires:</span> {{ active.expiryDate?.slice(0, 10) ?? '—' }}</div>
          <div><span class="text-muted-foreground">Stripe coupon:</span> <code class="text-xs">{{ active.stripeCouponId }}</code></div>
        </div>
        <div class="text-sm">
          <span class="text-muted-foreground">Reason:</span> {{ active.reason }}
        </div>
        <div class="flex items-center justify-between pt-2">
          <div class="text-xs text-muted-foreground">
            Proposed by {{ active.proposedByStaffId }}
            <template v-if="active.approvedByStaffId"> · Approved by {{ active.approvedByStaffId }}</template>
          </div>
          <PlatformConsoleRoleGate action="revoke_override">
            <Button variant="destructive" size="sm" @click="revokeConfirmId = active!.id; revokeOpen = true">
              <Icon name="lucide:ban" class="mr-1.5 size-3.5" />
              Revoke
            </Button>
          </PlatformConsoleRoleGate>
          <span v-if="!can('revoke_override')" class="text-xs text-muted-foreground">
            Admin can revoke this override.
          </span>
        </div>
      </CardContent>
    </Card>

    <div class="flex items-center justify-between">
      <h3 class="text-sm font-semibold">History</h3>
      <PlatformConsoleRoleGate action="propose_override">
        <Button
          v-if="!hasActive(tenant.id) && tenant.status === 'active'"
          @click="applyOpen = true"
        >
          <Icon name="lucide:plus" class="mr-1.5 size-4" />
          Apply Custom Pricing
        </Button>
        <Button
          v-else-if="tenant.status === 'suspended'"
          variant="outline"
          disabled
          title="Tenant is suspended — override blocked"
        >
          Apply Custom Pricing
        </Button>
        <Button
          v-else-if="hasActive(tenant.id)"
          variant="outline"
          disabled
          title="An active override already exists — revoke it first"
        >
          Apply Custom Pricing
        </Button>
      </PlatformConsoleRoleGate>
    </div>

    <Card>
      <CardContent class="p-0">
        <div class="divide-y">
          <div
            v-for="o in history.filter(x => x.id !== active?.id)"
            :key="o.id"
            class="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50"
            @click="selected = o"
          >
            <div>
              <div class="text-sm font-medium">{{ o.discountType === 'percent' ? `${o.value}%` : `$${o.value}/mo` }}</div>
              <div class="text-xs text-muted-foreground">{{ o.proposedAt.slice(0, 10) }} · {{ o.reason.slice(0, 50) }}{{ o.reason.length > 50 ? '…' : '' }}</div>
            </div>
            <Badge :variant="statusBadge(o.status).variant">{{ statusBadge(o.status).label }}</Badge>
          </div>
          <div v-if="!history.length || (history.length === 1 && history[0]?.id === active?.id)" class="p-8 text-center text-sm text-muted-foreground">
            No prior override history for this tenant.
          </div>
        </div>
      </CardContent>
    </Card>

    <PlatformConsoleApplyOverrideDialog v-if="applyOpen" :tenant="tenant" v-model:open="applyOpen" />

    <Sheet v-model:open="sheetOpen">
      <SheetContent v-if="selected" class="w-[480px]">
        <SheetHeader>
          <SheetTitle>Override detail</SheetTitle>
        </SheetHeader>
        <div class="space-y-3 p-4 text-sm">
          <div class="flex justify-between"><span class="text-muted-foreground">Status</span><Badge :variant="statusBadge(selected.status).variant">{{ statusBadge(selected.status).label }}</Badge></div>
          <div class="flex justify-between"><span class="text-muted-foreground">Value</span><strong>{{ selected.discountType === 'percent' ? `${selected.value}%` : `$${selected.value}/mo` }}</strong></div>
          <div class="flex justify-between"><span class="text-muted-foreground">Effective</span>{{ selected.effectiveDate.slice(0, 10) }}</div>
          <div class="flex justify-between"><span class="text-muted-foreground">Expires</span>{{ selected.expiryDate?.slice(0, 10) ?? '—' }}</div>
          <div class="flex justify-between"><span class="text-muted-foreground">Promo code</span><code class="text-xs">{{ selected.promoCodeId }}</code></div>
          <div v-if="selected.stripeCouponId" class="flex justify-between"><span class="text-muted-foreground">Stripe coupon</span><code class="text-xs">{{ selected.stripeCouponId }}</code></div>
          <div><span class="text-muted-foreground">Reason:</span> {{ selected.reason }}</div>
          <div v-if="selected.rejectionNote" class="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">{{ selected.rejectionNote }}</div>
        </div>
      </SheetContent>
    </Sheet>

    <AlertDialog v-model:open="revokeOpen">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Revoke this override?</AlertDialogTitle>
          <AlertDialogDescription>The tenant reverts to standard pricing on the next invoice. This cannot be undone.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction @click="doRevoke">Revoke</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>