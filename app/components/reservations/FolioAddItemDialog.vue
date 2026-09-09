<script setup lang="ts">
import type { FolioCatalogRow, FolioItemDraft } from '~/components/reservations/data/folio'
import type { ReservationEntry } from '~/components/reservations/data/reservations'
import { nextTick, onMounted } from 'vue'
import {
  createDefaultFolioItemDraft,
  filterFolioCatalogRows,
  folioCatalogRows,
  folioDraftFromCatalog,
  folioLineTotal,
  validateFolioItemDraft,
} from '~/components/reservations/data/folio'

const props = defineProps<{
  open: boolean
  reservation: ReservationEntry
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'submit': [draft: FolioItemDraft]
}>()

const { services } = useUpsellServices()

const draft = ref<FolioItemDraft>(createDefaultFolioItemDraft())
const search = ref('')
const pickedItemId = ref<string | null>(null)

const unitPriceInputRef = ref<unknown>(null)
const labelInputRef = ref<unknown>(null)

const rows = computed(() => folioCatalogRows(services.value, props.reservation.listingName, props.reservation.currency))
const visibleRows = computed(() => filterFolioCatalogRows(rows.value, search.value))
const pickedRow = computed(() => rows.value.find(row => row.itemId === pickedItemId.value) ?? null)

const errors = computed(() => validateFolioItemDraft(draft.value))
const canSubmit = computed(() => Object.keys(errors.value).length === 0)
const lineTotal = computed(() => folioLineTotal(draft.value))

function fmt(amount: number, currency: string): string {
  return `${amount.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${currency}`
}

/**
 * A template ref on a shadcn `Input` yields the component instance, not the
 * element — reach through `$el` before focusing. Same pattern as
 * `PromoCodeFieldsBasics.vue` (see `focusElement` there).
 */
function focusElement(target: unknown): void {
  const el = (target as { $el?: unknown } | null)?.$el ?? target
  if (el instanceof HTMLElement)
    el.focus()
}

function pick(row: FolioCatalogRow) {
  const service = services.value.find(entry => entry.id === row.serviceId)
  const item = service?.items.find(entry => entry.id === row.itemId)
  if (!service || !item)
    return

  pickedItemId.value = row.itemId
  draft.value = folioDraftFromCatalog(service, item, props.reservation.currency)

  // The price is left blank precisely so staff can type it immediately.
  if (row.needsPrice) {
    nextTick(() => {
      focusElement(unitPriceInputRef.value)
    })
  }
}

function reset() {
  draft.value = createDefaultFolioItemDraft()
  search.value = ''
  pickedItemId.value = null
}

/** With no catalog rows, the dialog "opens straight on the custom form" — put focus there. */
function focusForCurrentProperty() {
  if (rows.value.length)
    return
  nextTick(() => {
    focusElement(labelInputRef.value)
  })
}

function submit() {
  if (!canSubmit.value)
    return
  emit('submit', { ...draft.value })
  reset()
  emit('update:open', false)
}

watch(() => props.open, (open) => {
  if (open) {
    reset()
    focusForCurrentProperty()
  }
})

onMounted(() => {
  if (props.open)
    focusForCurrentProperty()
})
</script>

<template>
  <Dialog :open="open" @update:open="(v) => emit('update:open', v)">
    <DialogContent class="sm:max-w-3xl">
      <DialogHeader>
        <DialogTitle>Add item to folio</DialogTitle>
        <DialogDescription>
          Posted on {{ reservation.guestName }}'s stay at {{ reservation.listingName }}.
        </DialogDescription>
      </DialogHeader>

      <div class="grid gap-4 sm:grid-cols-2">
        <!-- Catalog -->
        <div class="flex min-h-0 flex-col gap-2">
          <Label for="folio-catalog-search" class="text-xs text-muted-foreground">
            Catalog
          </Label>
          <Input
            id="folio-catalog-search"
            v-model="search"
            data-testid="folio-catalog-search"
            placeholder="Search the catalog"
          />

          <ScrollArea class="h-64 min-h-0 rounded-md border">
            <div v-if="!visibleRows.length" class="p-4 text-xs text-muted-foreground">
              <template v-if="!rows.length">
                No catalog items are offered at this property. Add a custom item instead, or assign an
                upsell service to it.
              </template>
              <template v-else>
                Nothing matches "{{ search }}".
              </template>
            </div>

            <button
              v-for="row in visibleRows"
              :key="row.itemId"
              type="button"
              data-testid="folio-catalog-row"
              class="flex w-full items-start justify-between gap-2 border-b px-3 py-2 text-left last:border-b-0 hover:bg-muted/50"
              :class="pickedItemId === row.itemId ? 'bg-muted' : ''"
              @click="pick(row)"
            >
              <span class="min-w-0">
                <span class="block truncate text-sm font-medium">{{ row.itemName }}</span>
                <span class="block truncate text-xs text-muted-foreground">{{ row.serviceName }}</span>
              </span>
              <span class="shrink-0 text-right">
                <span class="block text-sm">{{ fmt(row.price, row.currency) }}</span>
                <Badge v-if="row.needsPrice" variant="outline" class="mt-0.5 text-[10px]">
                  Priced in {{ row.currency }}
                </Badge>
              </span>
            </button>
          </ScrollArea>
        </div>

        <!-- The line being posted -->
        <div class="space-y-3">
          <div class="space-y-1.5">
            <Label for="folio-label">Item</Label>
            <Input
              id="folio-label"
              ref="labelInputRef"
              v-model="draft.label"
              data-testid="folio-label"
              placeholder="Minibar - Beer"
            />
            <p v-if="errors.label" class="text-xs text-destructive">
              {{ errors.label }}
            </p>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div class="space-y-1.5">
              <Label for="folio-quantity">Qty</Label>
              <Input
                id="folio-quantity"
                :model-value="draft.quantity"
                data-testid="folio-quantity"
                type="number"
                inputmode="numeric"
                min="1"
                @update:model-value="(v) => draft.quantity = Number(v)"
              />
            </div>
            <div class="space-y-1.5">
              <Label for="folio-unit-price">Unit price ({{ reservation.currency }})</Label>
              <Input
                id="folio-unit-price"
                ref="unitPriceInputRef"
                :model-value="draft.unitPrice || ''"
                data-testid="folio-unit-price"
                type="number"
                inputmode="decimal"
                min="0"
                @update:model-value="(v) => draft.unitPrice = Number(v)"
              />
            </div>
          </div>

          <p v-if="pickedRow?.needsPrice" class="text-xs text-muted-foreground">
            This item is priced in {{ pickedRow.currency }}. Enter the amount in {{ reservation.currency }}.
          </p>
          <p v-if="errors.unitPrice" class="text-xs text-destructive">
            {{ errors.unitPrice }}
          </p>

          <div class="grid grid-cols-2 gap-2">
            <div class="space-y-1.5">
              <Label for="folio-tax">Tax %</Label>
              <Input
                id="folio-tax"
                :model-value="draft.taxPercent"
                data-testid="folio-tax"
                type="number"
                min="0"
                max="100"
                @update:model-value="(v) => draft.taxPercent = Number(v)"
              />
            </div>
            <div class="space-y-1.5">
              <Label for="folio-service">Service %</Label>
              <Input
                id="folio-service"
                :model-value="draft.servicePercent"
                data-testid="folio-service"
                type="number"
                min="0"
                max="100"
                @update:model-value="(v) => draft.servicePercent = Number(v)"
              />
            </div>
          </div>

          <div class="space-y-1.5">
            <Label for="folio-note">Note</Label>
            <Textarea id="folio-note" v-model="draft.note" data-testid="folio-note" rows="2" />
          </div>

          <Separator />

          <div class="flex items-center justify-between text-sm">
            <span class="text-muted-foreground">Line total</span>
            <span data-testid="folio-line-total" class="font-semibold">
              {{ fmt(lineTotal, reservation.currency) }}
            </span>
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="emit('update:open', false)">
          Cancel
        </Button>
        <Button :disabled="!canSubmit" @click="submit">
          Add item
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
