<script setup lang="ts">
import type { UpsellEntry } from '@/components/finance/data/upsells'
import { useActiveIntegration } from '@/composables/useActiveIntegration'
import { useListingMappings } from '@/composables/useListingMappings'

const props = defineProps<{
  upsell: UpsellEntry | null
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

function onOpenChange(val: boolean) {
  emit('update:open', val)
}

const { getMappingFor } = useListingMappings()
const { getAccountingAmount } = useActiveIntegration()

const integrationMeta: Record<string, { label: string, badgeClass: string }> = {
  jurnal: { label: 'Mekari Jurnal', badgeClass: 'text-blue-700 bg-blue-50' },
  bexio: { label: 'Bexio', badgeClass: 'text-violet-700 bg-violet-50' },
}

const typeBadgeClass: Record<string, string> = {
  'Early Check-in': 'text-sky-700 bg-sky-50 border-sky-200',
  'Late Check-out': 'text-indigo-700 bg-indigo-50 border-indigo-200',
  'Airport Transfer': 'text-violet-700 bg-violet-50 border-violet-200',
  'Breakfast Package': 'text-amber-700 bg-amber-50 border-amber-200',
  'Welcome Package': 'text-pink-700 bg-pink-50 border-pink-200',
  'Extra Cleaning': 'text-teal-700 bg-teal-50 border-teal-200',
  'BBQ Setup': 'text-orange-700 bg-orange-50 border-orange-200',
}

const channelIcon: Record<string, string> = {
  'Booking.com': 'i-lucide-globe',
  'Airbnb': 'i-lucide-home',
  'Direct': 'i-lucide-link',
}

function formatCHF(amount: number) {
  return `CHF ${amount.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatSyncedAt(isoString: string) {
  return new Date(isoString).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}
</script>

<template>
  <Sheet :open="props.open" @update:open="onOpenChange">
    <SheetContent class="flex w-full flex-col gap-0 p-0 sm:max-w-lg" side="right">
      <SheetHeader class="border-b px-6 py-4">
        <SheetTitle>Upsell Detail</SheetTitle>
        <SheetDescription>
          View the details for this upsell entry.
        </SheetDescription>
      </SheetHeader>

      <ScrollArea class="flex-1">
        <div v-if="props.upsell" class="flex flex-col gap-6 p-6">
          <!-- Guest + listing + type badge -->
          <div class="flex items-start gap-3">
            <Avatar class="h-10 w-10 shrink-0">
              <AvatarFallback class="text-sm">
                {{ props.upsell.guest.split(' ').map(n => n[0]).join('').slice(0, 2) }}
              </AvatarFallback>
            </Avatar>
            <div class="flex-1 min-w-0">
              <p class="font-medium leading-tight">
                {{ props.upsell.guest }}
              </p>
              <p class="truncate text-sm text-muted-foreground">
                {{ props.upsell.listing }}
              </p>
            </div>
            <div class="ml-auto shrink-0">
              <span
                class="rounded-full border px-2.5 py-0.5 text-xs font-medium"
                :class="typeBadgeClass[props.upsell.type]"
              >
                {{ props.upsell.type }}
              </span>
            </div>
          </div>

          <Separator />

          <!-- Details -->
          <dl class="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <dt class="text-muted-foreground">
                Date
              </dt>
              <dd class="font-medium">
                {{ props.upsell.date }}
              </dd>
            </div>
            <div>
              <dt class="text-muted-foreground">
                Amount
              </dt>
              <dd class="font-medium">
                {{ formatCHF(props.upsell.amount) }}
              </dd>
            </div>
            <div v-if="props.upsell.synced && getAccountingAmount(props.upsell.listing, props.upsell.amount)">
              <dt class="text-muted-foreground">
                Acctg. Amount
              </dt>
              <dd class="font-medium">
                {{ getAccountingAmount(props.upsell.listing, props.upsell.amount) }}
              </dd>
            </div>
            <div>
              <dt class="text-muted-foreground">
                Channel
              </dt>
              <dd class="flex items-center gap-1.5 font-medium">
                <Icon :name="channelIcon[props.upsell.channel] ?? 'i-lucide-link'" class="h-3.5 w-3.5 text-muted-foreground" />
                {{ props.upsell.channel }}
              </dd>
            </div>
            <div>
              <dt class="text-muted-foreground">
                Reservation ID
              </dt>
              <dd class="font-mono text-xs font-medium">
                {{ props.upsell.reservationId }}
              </dd>
            </div>
          </dl>

          <!-- Sync status -->
          <div
            class="flex items-center gap-3 rounded-md border px-3 py-2.5"
            :class="props.upsell.synced ? 'border-green-200 bg-green-50' : 'border-muted bg-muted/40'"
          >
            <Icon
              :name="props.upsell.synced ? 'i-lucide-cloud-check' : 'i-lucide-cloud-off'"
              class="h-4 w-4 shrink-0"
              :class="props.upsell.synced ? 'text-green-600' : 'text-muted-foreground'"
            />
            <div class="flex-1">
              <div class="flex items-center gap-2">
                <p class="text-sm font-medium" :class="props.upsell.synced ? 'text-green-700' : 'text-muted-foreground'">
                  {{ props.upsell.synced ? 'Synced' : 'Not yet synced' }}
                </p>
                <span
                  v-if="props.upsell.synced && getMappingFor(props.upsell.listing)"
                  class="rounded-full px-2 py-0.5 text-xs font-medium"
                  :class="integrationMeta[getMappingFor(props.upsell.listing)!.integration]?.badgeClass"
                >
                  {{ integrationMeta[getMappingFor(props.upsell.listing)!.integration]?.label }}
                </span>
              </div>
              <p v-if="props.upsell.syncedAt" class="text-xs text-green-600">
                {{ formatSyncedAt(props.upsell.syncedAt) }}
              </p>
            </div>
          </div>

          <!-- Note -->
          <div v-if="props.upsell.note">
            <p class="mb-1 text-xs text-muted-foreground">
              Note
            </p>
            <p class="rounded-md bg-muted px-3 py-2 text-sm">
              {{ props.upsell.note }}
            </p>
          </div>

          <!-- Invoice -->
          <div>
            <p class="mb-2 text-xs text-muted-foreground">
              Invoice
            </p>
            <div class="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2.5">
              <Icon name="i-lucide-file-text" class="h-4 w-4 text-muted-foreground" />
              <span class="flex-1 truncate text-sm">{{ props.upsell.invoice }}</span>
              <Button variant="ghost" size="sm" class="h-7 px-2 text-xs">
                <Icon name="i-lucide-download" class="mr-1 h-3 w-3" />
                Download
              </Button>
            </div>
          </div>
        </div>
      </ScrollArea>

      <div class="border-t px-6 py-4">
        <Button variant="outline" class="w-full" @click="onOpenChange(false)">
          Close
        </Button>
      </div>
    </SheetContent>
  </Sheet>
</template>
