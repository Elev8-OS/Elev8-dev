<script setup lang="ts">
import { toast } from 'vue-sonner'
import { Icon } from '#components'
import { cn } from '@/lib/utils'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Card, CardContent } from '~/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import { Progress } from '~/components/ui/progress'
import { Switch } from '~/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '~/components/ui/table'
import { Textarea } from '~/components/ui/textarea'
import type { Tenant } from './data/tenants'
import type { InvoiceStatus } from './data/tenant-billing'
import {
  addDays, addMonths, defaultChargeAmount, dunningSteps, formatMoney, HEALTH_LABEL,
  HEALTH_BADGE_CLASS, INVOICE_STATUS_LABEL, isCriticalDunning, planTitle, typeLabel, ymd,
} from './data/tenant-billing'
import { usePlatformAudit } from '~/composables/usePlatformAudit'
import { useStaffAuth } from '~/composables/useStaffAuth'
import { useTenantBilling } from '~/composables/useTenantBilling'

const props = defineProps<{ tenant: Tenant }>()

const { log } = usePlatformAudit()
const { can } = useStaffAuth()
const { byTenant, adjustNextCharge, revertNextCharge } = useTenantBilling()

onMounted(() => {
  log('view_billing', 'tenant', props.tenant.id)
})

const billing = computed(() => byTenant(props.tenant))
const isProperty = computed(() => props.tenant.plan === 'per_property')
const cur = computed(() => billing.value.currency)
const defaultAmount = computed(() => defaultChargeAmount(props.tenant, billing.value.cycle))
const canAdjust = computed(() => isProperty.value && can('adjust_next_charge'))
const steps = computed(() => billing.value.dunning?.kind === 'property' ? dunningSteps(billing.value.dunning) : [])

const INVOICE_CLASS: Record<InvoiceStatus, string> = {
  paid: 'border-transparent bg-primary/10 text-primary',
  pending: 'border-transparent bg-muted text-muted-foreground',
}

const stats = computed(() => [
  { label: 'Plan', value: planTitle(props.tenant) },
  isProperty.value
    ? { label: 'Recurring', value: `${formatMoney(props.tenant.mrrUsd ?? 0, cur.value)}/mo` }
    : { label: 'Billing model', value: 'Per booking' },
  { label: 'Units', value: isProperty.value ? String(props.tenant.activeUnits) : '-' },
  { label: 'Invoices', value: String(billing.value.invoices.length) },
])

// Adjust next charge
const adjustOpen = ref(false)
const adj = reactive({ date: '' as string | null, mode: 'default' as 'default' | 'custom', amount: '', recurring: false, note: '' })

const amountNum = computed(() => {
  const v = Number.parseFloat(adj.amount.replace(/[^0-9.]/g, ''))
  return Number.isNaN(v) ? 0 : v
})
const previewAmount = computed(() => adj.mode === 'custom' ? amountNum.value : defaultAmount.value)
const delta = computed(() => previewAmount.value - defaultAmount.value)
const deltaLabel = computed(() => {
  const d = delta.value
  if (Math.abs(d) < 0.005) return { cls: 'text-muted-foreground', text: 'Same as default' }
  if (d < 0) return { cls: 'text-primary', text: `${formatMoney(-d, cur.value)} less than default (discount)` }
  return { cls: 'text-warning-foreground', text: `${formatMoney(d, cur.value)} more than default (surcharge)` }
})
const valid = computed(() => !!adj.date && adj.note.trim().length > 0 && (adj.mode !== 'custom' || amountNum.value >= 0))

function openAdjust() {
  const b = billing.value
  adj.date = b.nextChargeAt ?? ymd(new Date())
  if (b.override) {
    adj.mode = 'custom'
    adj.amount = String(b.override.amount)
    adj.recurring = b.override.recurring
    adj.note = b.override.note
  }
  else {
    adj.mode = 'default'
    adj.amount = defaultAmount.value.toFixed(2)
    adj.recurring = false
    adj.note = ''
  }
  adjustOpen.value = true
}

function quick(kind: 'keep' | '7' | '14' | '1m') {
  const orig = billing.value.nextChargeAt ?? ymd(new Date())
  adj.date = kind === 'keep' ? orig : kind === '1m' ? addMonths(orig, 1) : addDays(orig, Number(kind))
}

function save() {
  if (!valid.value || !adj.date) return
  try {
    adjustNextCharge(props.tenant, {
      date: adj.date,
      mode: adj.mode,
      amount: amountNum.value,
      recurring: adj.recurring,
      note: adj.note,
    })
    toast.success('Next charge updated.')
    adjustOpen.value = false
  }
  catch (e: any) {
    toast.error(e.message ?? 'Could not update the next charge.')
  }
}

function revert() {
  revertNextCharge(props.tenant)
  toast.success('Reverted to plan default.')
}

function viewInStripe() {
  toast.info('Stripe is not connected in this prototype.')
}
</script>

<template>
  <div class="space-y-4">
    <!-- Hero -->
    <Card>
      <CardContent class="space-y-4 p-5">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0 space-y-2">
            <div class="font-mono text-xs text-muted-foreground">{{ tenant.contactEmail }}</div>
            <div class="flex flex-wrap gap-1.5">
              <Badge variant="outline" class="uppercase">{{ typeLabel(tenant.plan, billing.cycle) }}</Badge>
              <Badge :class="HEALTH_BADGE_CLASS[billing.health]">{{ HEALTH_LABEL[billing.health] }}</Badge>
              <Badge v-if="!billing.hasPaymentMethod" class="border-transparent bg-destructive/10 text-destructive">
                <Icon name="lucide:credit-card" class="size-3" />No payment method
              </Badge>
            </div>
          </div>
          <div class="flex flex-col items-end gap-2">
            <div class="text-right">
              <div class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Next charge</div>
              <div class="font-semibold tabular-nums">
                {{ billing.nextChargeAt || (tenant.status === 'suspended' ? 'Suspended' : '-') }}
                <Badge v-if="billing.override" class="ml-1 border-transparent bg-warning/25 text-warning-foreground">
                  {{ formatMoney(billing.override.amount, cur) }}
                </Badge>
              </div>
            </div>
            <Button v-if="canAdjust" variant="outline" size="sm" @click="openAdjust">
              <Icon name="lucide:calendar-cog" class="mr-1.5 size-3.5" />Adjust next charge
            </Button>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-px overflow-hidden rounded-md border bg-border sm:grid-cols-4">
          <div v-for="s in stats" :key="s.label" class="bg-card p-3">
            <div class="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{{ s.label }}</div>
            <div class="mt-0.5 truncate text-sm font-bold tabular-nums">{{ s.value }}</div>
          </div>
        </div>

        <div v-if="!isProperty && tenant.quotaTotal" class="space-y-2">
          <div class="flex justify-between text-sm">
            <span class="text-muted-foreground">Booking quota remaining</span>
            <span class="font-medium tabular-nums">{{ tenant.quotaRemaining }} / {{ tenant.quotaTotal }}</span>
          </div>
          <Progress :model-value="((tenant.quotaRemaining ?? 0) / tenant.quotaTotal) * 100" />
          <p class="text-xs text-muted-foreground">Auto-refill at 10% remaining</p>
        </div>
      </CardContent>
    </Card>

    <!-- Next charge override -->
    <div v-if="billing.override" class="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-3">
      <Icon name="lucide:calendar-cog" class="mt-0.5 size-5 shrink-0 text-warning-foreground" />
      <div class="min-w-0 flex-1">
        <div class="text-[13px] font-bold">Next charge adjusted</div>
        <div class="mt-0.5 text-xs text-muted-foreground">
          Set to <b class="tabular-nums text-foreground">{{ formatMoney(billing.override.amount, cur) }}</b>
          on <b class="tabular-nums text-foreground">{{ billing.nextChargeAt }}</b>
          · {{ billing.override.recurring ? 'recurring amount' : 'one-time' }}
          · by {{ billing.override.by }} · {{ billing.override.at }}
        </div>
        <div v-if="billing.override.note" class="mt-1 text-xs italic text-muted-foreground">"{{ billing.override.note }}"</div>
      </div>
      <div v-if="canAdjust" class="flex shrink-0 gap-1.5">
        <Button variant="ghost" size="sm" @click="openAdjust">Edit</Button>
        <Button variant="outline" size="sm" @click="revert">Revert to default</Button>
      </div>
    </div>

    <!-- Dunning: property retry ladder -->
    <div
      v-if="billing.dunning?.kind === 'property'"
      :class="cn('overflow-hidden rounded-lg border', isCriticalDunning(billing.dunning) ? 'border-destructive/40' : 'border-warning/40')"
    >
      <div :class="cn('flex items-center gap-3 px-4 py-3', isCriticalDunning(billing.dunning) ? 'bg-destructive/10' : 'bg-warning/10')">
        <Icon name="lucide:triangle-alert" :class="cn('size-5', isCriticalDunning(billing.dunning) ? 'text-destructive' : 'text-warning-foreground')" />
        <div>
          <div class="text-sm font-bold">Payment failing, attempt {{ billing.dunning.attempt }} / {{ billing.dunning.maxAttempts }}</div>
          <div class="text-xs text-muted-foreground">
            Suspends on {{ billing.dunning.suspendOn || '-' }} · {{ formatMoney(billing.dunning.amount, cur) }} due
          </div>
        </div>
      </div>
      <div class="bg-card p-4">
        <div v-for="(step, i) in steps" :key="i" class="relative flex gap-3 pb-3 last:pb-0">
          <div class="flex flex-col items-center">
            <span
              :class="cn(
                'flex size-5 items-center justify-center rounded-full',
                step.state === 'done' && 'bg-destructive text-destructive-foreground',
                step.state === 'current' && 'bg-warning text-warning-foreground ring-4 ring-warning/25',
                step.state === 'suspend' && 'bg-foreground text-background',
                step.state === 'upcoming' && 'border-2 border-border bg-card',
              )"
            >
              <Icon v-if="step.state === 'done'" name="lucide:x" class="size-3" />
              <Icon v-else-if="step.state === 'current'" name="lucide:clock" class="size-3" />
              <Icon v-else-if="step.state === 'suspend'" name="lucide:ban" class="size-3" />
            </span>
            <span v-if="i < steps.length - 1" class="mt-0.5 w-px flex-1 bg-border" />
          </div>
          <div class="flex-1 pb-1">
            <div class="flex items-center justify-between gap-2">
              <span class="text-[13px] font-semibold">{{ step.label }}</span>
              <span class="font-mono text-[11px] tabular-nums text-muted-foreground">{{ step.date || '-' }}</span>
            </div>
            <div v-if="step.email" class="mt-0.5 flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
              <Icon name="lucide:mail" class="size-3" />{{ step.email }}.html
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Dunning: booking top-up strikes -->
    <div v-else-if="billing.dunning?.kind === 'booking'" class="overflow-hidden rounded-lg border border-destructive/40">
      <div class="flex items-center gap-3 bg-destructive/10 px-4 py-3">
        <Icon name="lucide:triangle-alert" class="size-5 text-destructive" />
        <div>
          <div class="text-sm font-bold">Auto top-up failing, {{ billing.dunning.attempt }} / {{ billing.dunning.maxAttempts }} strikes</div>
          <div class="text-xs text-muted-foreground">Suspends after {{ billing.dunning.maxAttempts }} consecutive failed top-ups.</div>
        </div>
      </div>
      <div class="bg-card p-4">
        <div class="flex gap-1.5">
          <span
            v-for="i in billing.dunning.maxAttempts"
            :key="i"
            :class="cn('h-2 flex-1 rounded', i <= billing.dunning.attempt ? 'bg-destructive' : i === billing.dunning.attempt + 1 ? 'bg-warning' : 'bg-muted')"
          />
        </div>
        <div class="mt-2 text-xs text-muted-foreground">
          Each declined top-up is a strike. After the last one the tenant is set inactive and its listings are deactivated.
        </div>
      </div>
    </div>

    <!-- Invoice history -->
    <Card>
      <CardContent class="p-5">
        <div class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Invoice history</div>
        <div v-if="!billing.invoices.length" class="py-8 text-center text-sm text-muted-foreground">No invoices yet.</div>
        <Table v-else>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Invoice / item</TableHead>
              <TableHead class="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="inv in billing.invoices" :key="inv.id">
              <TableCell class="whitespace-nowrap tabular-nums text-muted-foreground">{{ inv.date }}</TableCell>
              <TableCell>
                <div class="flex items-center gap-2">
                  <Badge variant="outline" class="uppercase">{{ inv.type }}</Badge>
                  <span class="font-medium">{{ inv.description }}</span>
                </div>
                <div class="font-mono text-[11px] text-muted-foreground">{{ inv.invoiceNumber || 'no invoice issued' }}</div>
              </TableCell>
              <TableCell class="whitespace-nowrap text-right font-mono font-bold tabular-nums">{{ formatMoney(inv.amount, cur) }}</TableCell>
              <TableCell><Badge :class="INVOICE_CLASS[inv.status]">{{ INVOICE_STATUS_LABEL[inv.status] }}</Badge></TableCell>
              <TableCell class="text-right">
                <Button v-if="inv.invoiceNumber" variant="link" size="sm" class="h-auto p-0 text-xs" @click="viewInStripe">
                  View in Stripe
                  <Icon name="lucide:external-link" class="ml-1 size-3" />
                </Button>
                <span v-else class="text-xs text-muted-foreground">-</span>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>

    <!-- Adjust next charge -->
    <Dialog v-model:open="adjustOpen">
      <DialogContent class="max-h-[92vh] gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader class="border-b p-5">
          <DialogTitle>Adjust next charge</DialogTitle>
          <DialogDescription>{{ tenant.name }} · {{ typeLabel(tenant.plan, billing.cycle) }}</DialogDescription>
        </DialogHeader>

        <div class="flex max-h-[60vh] flex-col gap-5 overflow-auto p-5">
          <div class="grid grid-cols-2 gap-3 rounded-lg border bg-muted/40 p-3">
            <div>
              <div class="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Plan</div>
              <div class="mt-0.5 text-sm font-semibold">{{ planTitle(tenant) }} · {{ billing.cycle }}</div>
            </div>
            <div>
              <div class="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Default next amount</div>
              <div class="mt-0.5 text-sm font-semibold tabular-nums">{{ formatMoney(defaultAmount, cur) }}</div>
            </div>
          </div>

          <div>
            <div class="mb-2 text-xs font-bold">Next charge date</div>
            <BaseDatePicker v-model="adj.date" class="w-full" />
            <div class="mt-2 flex flex-wrap gap-1.5">
              <Button variant="outline" size="sm" class="h-7 rounded-full text-xs" @click="quick('keep')">Keep</Button>
              <Button variant="outline" size="sm" class="h-7 rounded-full text-xs" @click="quick('7')">+7 days</Button>
              <Button variant="outline" size="sm" class="h-7 rounded-full text-xs" @click="quick('14')">+14 days</Button>
              <Button variant="outline" size="sm" class="h-7 rounded-full text-xs" @click="quick('1m')">+1 month</Button>
            </div>
            <div class="mt-1.5 text-[11px] text-muted-foreground">When the next automatic charge runs. The cycle after this returns to the normal cadence.</div>
          </div>

          <div>
            <div class="mb-2 text-xs font-bold">Charge amount</div>
            <div class="flex flex-col gap-2">
              <div
                :class="cn('flex cursor-pointer items-center gap-3 rounded-lg border p-3', adj.mode === 'default' ? 'border-primary bg-primary/5' : 'border-input')"
                @click="adj.mode = 'default'"
              >
                <span :class="cn('flex size-4 shrink-0 items-center justify-center rounded-full border-2', adj.mode === 'default' ? 'border-primary' : 'border-input')">
                  <span v-if="adj.mode === 'default'" class="size-2 rounded-full bg-primary" />
                </span>
                <span class="flex-1">
                  <span class="block text-sm font-semibold">Use plan default</span>
                  <span class="block text-[11px] text-muted-foreground">Auto-resolved from plan × active units</span>
                </span>
                <span class="font-mono text-sm font-bold tabular-nums">{{ formatMoney(defaultAmount, cur) }}</span>
              </div>
              <div
                :class="cn('flex cursor-pointer items-center gap-3 rounded-lg border p-3', adj.mode === 'custom' ? 'border-primary bg-primary/5' : 'border-input')"
                @click="adj.mode = 'custom'"
              >
                <span :class="cn('flex size-4 shrink-0 items-center justify-center rounded-full border-2', adj.mode === 'custom' ? 'border-primary' : 'border-input')">
                  <span v-if="adj.mode === 'custom'" class="size-2 rounded-full bg-primary" />
                </span>
                <span class="flex-1">
                  <span class="block text-sm font-semibold">Custom amount, next charge only</span>
                  <span class="block text-[11px] text-muted-foreground">Override this one charge, then revert automatically</span>
                </span>
              </div>
            </div>

            <div v-if="adj.mode === 'custom'" class="mt-2.5 space-y-2">
              <div class="relative">
                <span class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-semibold text-muted-foreground">{{ cur }}</span>
                <Input v-model="adj.amount" inputmode="decimal" aria-label="Custom amount" class="pl-14 font-mono font-bold tabular-nums" />
              </div>
              <div :class="cn('text-xs font-bold', deltaLabel.cls)">{{ deltaLabel.text }}</div>
              <div class="flex items-center gap-3 pt-1">
                <Switch :model-value="adj.recurring" aria-label="Keep this amount for future charges" @update:model-value="(v: boolean) => (adj.recurring = v)" />
                <div class="text-xs">
                  <div class="font-semibold">Keep this amount for future charges too</div>
                  <div class="text-muted-foreground">Off is one-time. On makes it the recurring amount until changed.</div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <div class="mb-2 text-xs font-bold">
              Reason <span class="text-destructive">*</span>
              <span class="font-normal text-muted-foreground"> · internal audit note</span>
            </div>
            <Textarea v-model="adj.note" rows="2" placeholder="e.g. Loyalty discount agreed with the account manager, next charge only." />
          </div>
        </div>

        <DialogFooter class="flex-wrap items-center gap-3 border-t p-4 sm:justify-between">
          <div class="flex-1 rounded-lg border border-dashed bg-muted/40 px-3 py-2">
            <div class="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Next charge will be</div>
            <div class="mt-0.5 text-sm font-bold tabular-nums">
              {{ adj.date || '-' }} · {{ formatMoney(previewAmount, cur) }}
              <Badge :class="cn('ml-1 text-[10px] uppercase', adj.mode === 'custom' ? 'border-transparent bg-warning/25 text-warning-foreground' : 'border-transparent bg-muted text-muted-foreground')">
                {{ adj.mode === 'custom' ? (adj.recurring ? 'custom · recurring' : 'custom · one-time') : 'default' }}
              </Badge>
            </div>
          </div>
          <div class="flex gap-2">
            <Button variant="ghost" @click="adjustOpen = false">Cancel</Button>
            <Button :disabled="!valid" @click="save">Save adjustment</Button>
          </div>
          <div v-if="!adj.note.trim()" class="w-full text-[11px] text-warning-foreground">Add a reason to save this adjustment.</div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
