<script setup lang="ts">
import type { PromoCode } from './data/promo-codes'
import { computed } from 'vue'
import { Switch } from '~/components/ui/switch'
import { usePromoCodes } from '~/composables/usePromoCodes'
import { formatPromoDiscount, formatPromoWindowCompact, getChannelRestriction, getPromoCodeTypeLabel } from './data/promo-codes'

const { codes } = defineProps<{
  codes: PromoCode[]
}>()

const emit = defineEmits<{
  view: [code: PromoCode]
  edit: [code: PromoCode]
  duplicate: [id: string]
  toggleActive: [id: string]
  delete: [id: string]
}>()

const { getPromoCodeStatus: status } = usePromoCodes()

function statusBadgeVariant(code: PromoCode) {
  const s = status(code)
  if (s === 'active')
    return 'default'
  if (s === 'expired')
    return 'secondary'
  return 'outline'
}

function statusLabel(code: PromoCode) {
  const s = status(code)
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function bookingWindowRows(windows: { from: string | null, until: string | null }[]) {
  return windows
    .map(w => formatPromoWindowCompact(w))
    .filter((label): label is string => label !== null)
}

function stayWindowRows(windows: { from: string | null, until: string | null }[]) {
  return windows
    .map(w => formatPromoWindowCompact(w))
    .filter((label): label is string => label !== null)
}

function statusColor(code: PromoCode) {
  const s = status(code)
  if (s === 'active')
    return 'text-green-700'
  if (s === 'expired')
    return 'text-gray-500'
  return 'text-gray-500'
}

const decoratedCodes = computed(() => codes.map((code) => {
  const isFreeUpsell = code.discountType === 'free_upsell'
  const freeUpsellItemCount = code.freeUpsellItemIds?.length ?? 0
  const listingCount = code.listingIds?.length ?? 0
  const scopeLabel = listingCount === 0 ? 'All listings' : `${listingCount} listing${listingCount === 1 ? '' : 's'}`
  const channel = getChannelRestriction(code)
  return {
    ...code,
    isFreeUpsell,
    freeUpsellItemCount,
    listingCount,
    scopeLabel,
    channelChannel: channel.channel,
    channelWebsiteCount: channel.websiteIds.length,
    bookingWindows: code.bookingWindows ?? [],
    stayWindows: code.stayWindows ?? [],
  }
}))
</script>

<template>
  <div class="rounded-lg border">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Code</TableHead>
          <TableHead>Discount</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Scope</TableHead>
          <TableHead>Validity</TableHead>
          <TableHead>Redemptions</TableHead>
          <TableHead>Status</TableHead>
          <TableHead class="w-[80px]">
            Active
          </TableHead>
          <TableHead class="w-[60px]" />
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow v-for="code in decoratedCodes" :key="code.id">
          <TableCell>
            <div class="min-w-0">
              <p class="font-mono font-semibold">
                {{ code.code }}
              </p>
              <p v-if="code.description" class="text-xs text-muted-foreground truncate max-w-[280px]">
                {{ code.description }}
              </p>
            </div>
          </TableCell>
          <TableCell>
            <span v-if="code.isFreeUpsell" class="inline-flex items-center gap-1 text-sm font-medium">
              <Icon name="lucide:sparkles" class="size-3.5 text-primary-foreground" />
              {{ formatPromoDiscount(code) }}
            </span>
            <template v-else>
              <span class="text-sm font-medium">{{ formatPromoDiscount(code) }}</span>
              <span v-if="code.discountType === 'fixed' && code.currency" class="text-xs text-muted-foreground ml-1">{{ code.currency }}</span>
            </template>
          </TableCell>
          <TableCell>
            <div class="flex flex-col gap-0.5">
              <Badge variant="outline" class="capitalize w-fit">
                {{ getPromoCodeTypeLabel(code) }}
              </Badge>
              <span v-if="code.isFreeUpsell" class="text-xs text-muted-foreground">
                {{ code.freeUpsellItemCount }} item{{ code.freeUpsellItemCount === 1 ? '' : 's' }}
              </span>
            </div>
          </TableCell>
          <TableCell>
            <div class="flex items-center gap-1.5 text-sm">
              <Icon name="lucide:home" class="size-3.5 text-muted-foreground" />
              <span :class="code.listingCount === 0 ? 'text-muted-foreground' : 'font-medium'">
                {{ code.scopeLabel }}
              </span>
            </div>
            <div class="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
              <template v-if="code.channelChannel === 'widget'">
                <Icon name="lucide:code-2" class="size-3" aria-hidden="true" />
                <span>Widget only</span>
              </template>
              <template v-else>
                <Icon name="lucide:globe" class="size-3" aria-hidden="true" />
                <span>
                  Website only
                  <template v-if="code.channelWebsiteCount > 0">
                    · {{ code.channelWebsiteCount }} site{{ code.channelWebsiteCount === 1 ? '' : 's' }}
                  </template>
                </span>
              </template>
            </div>
          </TableCell>
          <TableCell class="text-muted-foreground text-xs space-y-0.5">
            <template v-if="code.bookingWindows.length === 0 && code.stayWindows.length === 0">
              <div>Always</div>
            </template>
            <template v-else>
              <div v-if="code.bookingWindows.length > 0" class="flex items-start gap-1">
                <Icon name="lucide:calendar-clock" class="size-3 shrink-0 mt-0.5" />
                <span class="min-w-0">
                  <template v-if="code.bookingWindows.length === 1">
                    Book {{ bookingWindowRows(code.bookingWindows)[0] }}
                  </template>
                  <template v-else>
                    Book {{ bookingWindowRows(code.bookingWindows)[0] }}
                    <span class="text-muted-foreground/70">· +{{ code.bookingWindows.length - 1 }} more</span>
                  </template>
                </span>
              </div>
              <div v-if="code.stayWindows.length > 0" class="flex items-start gap-1">
                <Icon name="lucide:bed" class="size-3 shrink-0 mt-0.5" />
                <span class="min-w-0">
                  <template v-if="code.stayWindows.length === 1">
                    Stay {{ stayWindowRows(code.stayWindows)[0] }}
                  </template>
                  <template v-else>
                    Stay {{ stayWindowRows(code.stayWindows)[0] }}
                    <span class="text-muted-foreground/70">· +{{ code.stayWindows.length - 1 }} more</span>
                  </template>
                </span>
              </div>
            </template>
          </TableCell>
          <TableCell>
            <span class="font-medium">{{ code.redemptionCount }}</span>
            <span v-if="code.usageLimit" class="text-xs text-muted-foreground"> / {{ code.usageLimit }}</span>
          </TableCell>
          <TableCell>
            <Badge :variant="statusBadgeVariant(code)" class="gap-1 capitalize">
              <Icon name="lucide:circle" class="size-2" :class="statusColor(code)" aria-hidden="true" />
              {{ statusLabel(code) }}
            </Badge>
          </TableCell>
          <TableCell>
            <Switch
              :model-value="code.active"
              :aria-label="`Activate ${code.code}`"
              @update:model-value="() => emit('toggleActive', code.id)"
            />
          </TableCell>
          <TableCell>
            <DropdownMenu>
              <DropdownMenuTrigger as-child>
                <Button variant="ghost" size="icon-sm" class="size-8" :aria-label="`Row actions for ${code.code}`">
                  <Icon name="lucide:more-horizontal" class="size-4" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem @click="emit('view', code)">
                  <Icon name="lucide:eye" class="mr-2 size-4" aria-hidden="true" />
                  View details
                </DropdownMenuItem>
                <DropdownMenuItem @click="emit('edit', code)">
                  <Icon name="lucide:pencil" class="mr-2 size-4" aria-hidden="true" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem @click="emit('duplicate', code.id)">
                  <Icon name="lucide:copy-plus" class="mr-2 size-4" aria-hidden="true" />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  class="text-destructive focus:text-destructive"
                  @click="emit('delete', code.id)"
                >
                  <Icon name="lucide:trash-2" class="mr-2 size-4" aria-hidden="true" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </TableCell>
        </TableRow>
        <TableRow v-if="!codes.length">
          <TableCell colspan="9" class="h-32 text-center text-muted-foreground">
            No promo codes found.
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>
</template>
