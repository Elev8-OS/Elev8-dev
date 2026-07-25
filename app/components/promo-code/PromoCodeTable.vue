<script setup lang="ts">
import type { PromoCode } from './data/promo-codes'
import { computed } from 'vue'
import { usePromoCodes } from '~/composables/usePromoCodes'
import { formatPromoDiscount, formatPromoWindowCompact, getPromoCodeTypeLabel } from './data/promo-codes'

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
    return 'text-green-600'
  if (s === 'expired')
    return 'text-gray-500'
  return 'text-gray-500'
}

const decoratedCodes = computed(() => codes.map((code) => {
  const isFreeUpsell = code.discountType === 'free_upsell'
  const freeUpsellCount = code.freeUpsellServiceIds?.length ?? 0
  const listingCount = code.listingIds?.length ?? 0
  const scopeLabel = listingCount === 0 ? 'All listings' : `${listingCount} listing${listingCount === 1 ? '' : 's'}`
  return {
    ...code,
    isFreeUpsell,
    freeUpsellCount,
    listingCount,
    scopeLabel,
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
              <Icon name="lucide:sparkles" class="size-3.5 text-primary" />
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
                {{ code.freeUpsellCount }} service{{ code.freeUpsellCount === 1 ? '' : 's' }}
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
              <Icon name="lucide:circle" class="size-2" :class="statusColor(code)" />
              {{ statusLabel(code) }}
            </Badge>
          </TableCell>
          <TableCell>
            <button
              type="button"
              class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              :class="code.active ? 'bg-primary' : 'bg-input'"
              @click="emit('toggleActive', code.id)"
            >
              <span
                class="pointer-events-none block size-4 rounded-full bg-background shadow-lg ring-0 transition-transform"
                :class="code.active ? 'translate-x-4' : 'translate-x-0'"
              />
            </button>
          </TableCell>
          <TableCell>
            <DropdownMenu>
              <DropdownMenuTrigger as-child>
                <Button variant="ghost" size="icon-sm" class="size-8">
                  <Icon name="lucide:more-horizontal" class="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem @click="emit('view', code)">
                  <Icon name="lucide:eye" class="mr-2 size-4" />
                  View details
                </DropdownMenuItem>
                <DropdownMenuItem @click="emit('edit', code)">
                  <Icon name="lucide:pencil" class="mr-2 size-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem @click="emit('duplicate', code.id)">
                  <Icon name="lucide:copy-plus" class="mr-2 size-4" />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  class="text-destructive focus:text-destructive"
                  @click="emit('delete', code.id)"
                >
                  <Icon name="lucide:trash-2" class="mr-2 size-4" />
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
