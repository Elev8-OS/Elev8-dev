<script setup lang="ts">
import type { PromoCodeFormDraft, PromoCodeFormErrors } from './data/promo-code-form'
import type { PromoCodeDiscountType } from './data/promo-codes'
import { computed, ref } from 'vue'
import { listings as allListings } from '~/components/listings/data/listings'
import { mockUpsellServices } from '~/components/upsells/data/upsell-services'
import { PROMO_CODE_CURRENCIES, upsellServiceCoverage } from './data/promo-code-form'

/**
 * Step 2 fields — what the code gives away.
 *
 * The three discount types are cards rather than a select, because the choice
 * changes which fields appear underneath and a select hides that consequence.
 * The upsell picker is inline rather than behind a Popover: the wizard split
 * the form up precisely to make room, and a popover inside a modal put the
 * list in a 420px box the host had to open before they could see anything.
 *
 * This step runs AFTER the listing scope, because a service is only offered
 * at the properties it is assigned to. Services none of the covered listings
 * offer are unpickable, and services only some of them offer carry their
 * coverage on the row — a code cannot promise a free spa at a villa that has no spa.
 */
const props = defineProps<{
  errors: PromoCodeFormErrors
  idPrefix: string
}>()

const draft = defineModel<PromoCodeFormDraft>({ required: true })

const isFreeUpsell = computed(() => draft.value.discountType === 'free_upsell')

const typeOptions: { value: PromoCodeDiscountType, label: string, hint: string, icon: string }[] = [
  { value: '%', label: 'Percentage', hint: 'Take a share off the total', icon: 'lucide:percent' },
  { value: 'fixed', label: 'Fixed amount', hint: 'Take a set amount off', icon: 'lucide:banknote' },
  { value: 'free_upsell', label: 'Free upsell', hint: 'Include a service for free', icon: 'lucide:sparkles' },
]

function selectType(next: PromoCodeDiscountType) {
  draft.value = {
    ...draft.value,
    discountType: next,
    // A free-upsell code carries no numeric value; restore a sane default when
    // the host switches back to a value-based type.
    value: next === 'free_upsell' ? 0 : (draft.value.value || 10),
  }
}

// ─── Free upsell items ──────────────────────────────────────────────────────
// Selection is by UpsellItem (the unit the guest redeems), grouped under its
// parent service so the host sees the context and the price they are giving up.
const search = ref('')
const collapsedServiceIds = ref<string[]>([])

function formatPrice(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount)
  }
  catch {
    // An unknown currency code should show the number, not blow up the step.
    return `${currency} ${amount}`
  }
}

/** Price span across a service's items — the value at stake before expanding. */
function priceRange(service: typeof mockUpsellServices[number]): string {
  const prices = service.items.map(i => i.price)
  if (prices.length === 0)
    return '—'
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  return min === max
    ? formatPrice(min, service.currency)
    : `${formatPrice(min, service.currency)} – ${formatPrice(max, service.currency)}`
}

const filteredServices = computed(() => {
  const query = search.value.trim().toLowerCase()
  if (!query)
    return mockUpsellServices
  return mockUpsellServices.filter((s) => {
    if (`${s.name} ${s.category}`.toLowerCase().includes(query))
      return true
    return s.items.some(item => `${item.name} ${item.description ?? ''}`.toLowerCase().includes(query))
  })
})

/**
 * Groups are open by default and while searching — the old picker started
 * fully collapsed, so the host could not see what any service contained
 * without clicking it open first.
 */
function isExpanded(serviceId: string): boolean {
  if (search.value.trim())
    return true
  return !collapsedServiceIds.value.includes(serviceId)
}

function toggleExpand(serviceId: string) {
  collapsedServiceIds.value = collapsedServiceIds.value.includes(serviceId)
    ? collapsedServiceIds.value.filter(x => x !== serviceId)
    : [...collapsedServiceIds.value, serviceId]
}

function setItemIds(ids: string[]) {
  draft.value = { ...draft.value, freeUpsellItemIds: ids }
}

function toggleItem(id: string) {
  const ids = draft.value.freeUpsellItemIds
  setItemIds(ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id])
}

function isServiceFullySelected(service: typeof mockUpsellServices[number]) {
  return service.items.length > 0 && service.items.every(item => draft.value.freeUpsellItemIds.includes(item.id))
}

function isServicePartiallySelected(service: typeof mockUpsellServices[number]) {
  const hits = service.items.filter(item => draft.value.freeUpsellItemIds.includes(item.id)).length
  return hits > 0 && hits < service.items.length
}

function toggleService(service: typeof mockUpsellServices[number]) {
  const ids = service.items.map(item => item.id)
  if (isServiceFullySelected(service)) {
    setItemIds(draft.value.freeUpsellItemIds.filter(id => !ids.includes(id)))
    return
  }
  setItemIds([...new Set([...draft.value.freeUpsellItemIds, ...ids])])
}

function clearItems() {
  setItemIds([])
}

/**
 * Listing NAMES the code covers — the explicit selection when there is one,
 * otherwise every listing. This is what each service's reach is measured
 * against.
 */
const scopedListingNames = computed(() => {
  if (draft.value.listingIds.length === 0)
    return allListings.value.map(l => l.name)
  const ids = new Set(draft.value.listingIds)
  return allListings.value.filter(l => ids.has(l.id)).map(l => l.name)
})

const scopeIsWholePortfolio = computed(() => draft.value.listingIds.length === 0)

function coverageOf(service: typeof mockUpsellServices[number]) {
  return upsellServiceCoverage(service.assignedListings, scopedListingNames.value)
}

/** Offered at none of the covered listings — shown, but not pickable. */
function isUnreachable(service: typeof mockUpsellServices[number]) {
  return coverageOf(service).covered === 0
}

/** Offered at some but not all — pickable, with the gap stated on the row. */
function isPartial(service: typeof mockUpsellServices[number]) {
  const { covered, total } = coverageOf(service)
  return covered > 0 && covered < total
}

const reachableServices = computed(() => filteredServices.value.filter(s => !isUnreachable(s)))
const unreachableServices = computed(() => filteredServices.value.filter(s => isUnreachable(s)))

/** Picked items whose service is only offered at part of the scope. */
const partiallyCoveredSelected = computed(() =>
  mockUpsellServices.filter(s =>
    isPartial(s) && s.items.some(item => draft.value.freeUpsellItemIds.includes(item.id)),
  ),
)

const focusRef = ref<unknown>(null)

/**
 * A template ref on a shadcn component yields the component instance, not the
 * element — reach through `$el` before focusing, or the wizard's
 * "jump back to the bad field" call throws.
 */
function focusElement(target: unknown): void {
  const el = (target as { $el?: unknown } | null)?.$el ?? target
  if (el instanceof HTMLElement)
    el.focus()
}

defineExpose({ focus: () => focusElement(focusRef.value) })
</script>

<template>
  <div class="flex flex-col gap-4">
    <fieldset class="space-y-2">
      <legend class="mb-2 text-sm font-medium">
        Discount type
      </legend>
      <RadioGroup
        :model-value="draft.discountType"
        class="grid grid-cols-1 gap-2 sm:grid-cols-3"
        @update:model-value="(v: string) => selectType(v as PromoCodeDiscountType)"
      >
        <label
          v-for="option in typeOptions"
          :key="option.value"
          class="flex cursor-pointer items-start gap-2 rounded-md border p-3 transition-colors hover:bg-muted/40"
          :class="draft.discountType === option.value ? 'border-primary bg-primary/5' : ''"
        >
          <RadioGroupItem :id="`${props.idPrefix}-type-${option.value}`" :value="option.value" class="mt-0.5" />
          <div class="min-w-0">
            <p class="flex items-center gap-1.5 text-sm font-medium">
              <Icon :name="option.icon" class="size-3.5 text-muted-foreground" aria-hidden="true" />
              {{ option.label }}
            </p>
            <p class="text-xs text-muted-foreground">
              {{ option.hint }}
            </p>
          </div>
        </label>
      </RadioGroup>
    </fieldset>

    <!-- Value-based types -->
    <div v-if="!isFreeUpsell" class="grid gap-3" :class="draft.discountType === 'fixed' ? 'sm:grid-cols-2' : ''">
      <div class="space-y-2">
        <Label :for="`${props.idPrefix}-value`">Value</Label>
        <div class="flex items-center gap-2">
          <span
            aria-hidden="true"
            class="rounded-md border bg-muted px-2 py-1 text-xs font-medium text-foreground"
          >{{ draft.discountType === 'fixed' ? draft.currency : '%' }}</span>
          <Input
            :id="`${props.idPrefix}-value`"
            ref="focusRef"
            :model-value="draft.value"
            type="number"
            min="1"
            :max="draft.discountType === '%' ? 100 : undefined"
            class="flex-1"
            :class="props.errors.value ? 'border-destructive' : ''"
            :aria-invalid="props.errors.value ? 'true' : 'false'"
            :aria-describedby="props.errors.value ? `${props.idPrefix}-value-error` : undefined"
            @update:model-value="(v) => draft = { ...draft, value: Number(v) }"
          />
        </div>
        <p
          v-if="props.errors.value"
          :id="`${props.idPrefix}-value-error`"
          role="alert"
          class="text-xs text-destructive"
        >
          {{ props.errors.value }}
        </p>
      </div>

      <div v-if="draft.discountType === 'fixed'" class="space-y-2">
        <Label :for="`${props.idPrefix}-currency`">Currency</Label>
        <Select
          :model-value="draft.currency"
          @update:model-value="(v) => draft = { ...draft, currency: String(v) }"
        >
          <SelectTrigger :id="`${props.idPrefix}-currency`" aria-label="Currency">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="c in PROMO_CODE_CURRENCIES" :key="c" :value="c">
              {{ c }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>

    <!-- Free upsell items, inline -->
    <div v-else class="space-y-2">
      <div class="flex items-end justify-between gap-2">
        <Label :for="`${props.idPrefix}-upsell-search`">
          Free upsell items <span class="font-normal text-muted-foreground">(required)</span>
        </Label>
        <div class="flex items-center gap-2 text-xs">
          <span :class="draft.freeUpsellItemIds.length > 0 ? 'font-medium' : 'text-muted-foreground'" aria-live="polite">
            {{ draft.freeUpsellItemIds.length }} selected
          </span>
          <Button
            v-if="draft.freeUpsellItemIds.length > 0"
            type="button"
            variant="ghost"
            size="sm"
            class="h-6 text-xs"
            @click="clearItems"
          >
            Clear
          </Button>
        </div>
      </div>

      <div
        class="overflow-hidden rounded-md border"
        :class="props.errors.freeUpsellItemIds ? 'border-destructive' : ''"
      >
        <div class="border-b p-2">
          <div class="relative">
            <Icon name="lucide:search" class="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              :id="`${props.idPrefix}-upsell-search`"
              ref="focusRef"
              v-model="search"
              placeholder="Search services or items..."
              class="h-8 pl-7 text-sm"
              aria-label="Search upsell services or items"
            />
          </div>
        </div>

        <div class="max-h-72 overflow-y-auto">
          <p v-if="reachableServices.length === 0" class="px-3 py-6 text-center text-xs text-muted-foreground">
            {{ search.trim()
              ? `No available upsell services match "${search}".`
              : 'None of the listings this code covers offer an upsell service.' }}
          </p>
          <div v-for="service in reachableServices" :key="service.id" class="border-b last:border-b-0">
            <div class="flex w-full items-center gap-2 px-2 py-2">
              <button
                type="button"
                class="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-[4px] border"
                :class="isServiceFullySelected(service) ? 'border-primary bg-primary text-primary-foreground' : isServicePartiallySelected(service) ? 'border-primary bg-primary/20 text-primary' : 'border-input'"
                role="checkbox"
                :aria-checked="isServiceFullySelected(service) ? 'true' : isServicePartiallySelected(service) ? 'mixed' : 'false'"
                :aria-label="`Select every item in ${service.name}`"
                @click="toggleService(service)"
              >
                <Icon v-if="isServiceFullySelected(service)" name="lucide:check" class="size-3" aria-hidden="true" />
                <span v-else-if="isServicePartiallySelected(service)" class="text-[10px] font-bold leading-none" aria-hidden="true">−</span>
              </button>
              <button
                type="button"
                class="flex flex-1 items-center gap-2 text-left"
                :aria-label="`${isExpanded(service.id) ? 'Collapse' : 'Expand'} ${service.name}`"
                :aria-expanded="isExpanded(service.id) ? 'true' : 'false'"
                @click="toggleExpand(service.id)"
              >
                <div class="min-w-0 flex-1">
                  <p class="flex items-center gap-1.5 truncate text-sm font-medium">
                    {{ service.name }}
                    <Badge v-if="service.status === 'inactive'" variant="outline" class="h-4 px-1 text-[9px] font-normal text-muted-foreground">
                      Inactive
                    </Badge>
                  </p>
                  <p class="truncate text-xs text-muted-foreground">
                    {{ service.category }} · {{ service.items.length }} item{{ service.items.length === 1 ? '' : 's' }} · {{ priceRange(service) }}
                  </p>
                  <p v-if="isPartial(service)" class="flex items-center gap-1 text-xs text-amber-600">
                    <Icon name="lucide:triangle-alert" class="size-3 shrink-0" aria-hidden="true" />
                    Offered at {{ coverageOf(service).covered }} of {{ coverageOf(service).total }} listings
                  </p>
                </div>
                <Icon
                  name="lucide:chevron-right"
                  class="size-3.5 shrink-0 text-muted-foreground transition-transform"
                  :class="isExpanded(service.id) ? 'rotate-90' : ''"
                  aria-hidden="true"
                />
              </button>
            </div>

            <ul v-if="isExpanded(service.id)" class="pb-1">
              <li
                v-for="item in service.items"
                :key="item.id"
                class="flex items-start gap-2 px-2 py-1.5 pl-8 hover:bg-muted/50"
              >
                <button
                  type="button"
                  class="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-[4px] border"
                  :class="draft.freeUpsellItemIds.includes(item.id) ? 'border-primary bg-primary text-primary-foreground' : 'border-input'"
                  role="checkbox"
                  :aria-checked="draft.freeUpsellItemIds.includes(item.id) ? 'true' : 'false'"
                  :aria-label="`${item.name}, ${formatPrice(item.price, service.currency)}`"
                  @click="toggleItem(item.id)"
                >
                  <Icon v-if="draft.freeUpsellItemIds.includes(item.id)" name="lucide:check" class="size-3" aria-hidden="true" />
                </button>
                <button type="button" class="flex min-w-0 flex-1 items-start gap-2 text-left" @click="toggleItem(item.id)">
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-sm">{{ item.name }}</span>
                    <span v-if="item.description" class="line-clamp-1 text-xs text-muted-foreground">{{ item.description }}</span>
                  </span>
                  <span class="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
                    {{ formatPrice(item.price, service.currency) }}
                  </span>
                </button>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <p
        v-if="props.errors.freeUpsellItemIds"
        :id="`${props.idPrefix}-upsell-error`"
        role="alert"
        class="text-xs text-destructive"
      >
        {{ props.errors.freeUpsellItemIds }}
      </p>

      <!-- What the listing scope did to this list -->
      <div v-else class="space-y-2">
        <p
          v-if="partiallyCoveredSelected.length > 0"
          class="flex items-start gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/5 p-2 text-xs"
        >
          <Icon name="lucide:triangle-alert" class="mt-0.5 size-3.5 shrink-0 text-amber-600" aria-hidden="true" />
          <span>
            {{ partiallyCoveredSelected.map(s => s.name).join(', ') }}
            {{ partiallyCoveredSelected.length === 1 ? 'is' : 'are' }} not offered at every listing this code covers.
            Guests at the other properties will not be able to redeem it.
          </span>
        </p>

        <p v-if="unreachableServices.length > 0" class="text-xs text-muted-foreground">
          {{ unreachableServices.length }} service{{ unreachableServices.length === 1 ? '' : 's' }} hidden —
          not offered at {{ scopeIsWholePortfolio ? 'any listing' : 'any listing this code covers' }}:
          {{ unreachableServices.map(s => s.name).join(', ') }}.
        </p>

        <p v-if="draft.freeUpsellItemIds.length === 0" class="text-xs text-muted-foreground">
          Pick a whole service, or expand it and pick individual items. Only services offered at the
          {{ scopedListingNames.length }} listing{{ scopedListingNames.length === 1 ? '' : 's' }}
          this code covers are shown.
        </p>
      </div>
    </div>
  </div>
</template>
