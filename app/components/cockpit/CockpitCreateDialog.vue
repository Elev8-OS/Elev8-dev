<script setup lang="ts">
import type { CockpitCreateRequest } from '~/components/cockpit/data/cockpit'
import type { OverrideField, OverrideValues } from '~/components/cockpit/data/cockpit-overrides'
import { toast } from 'vue-sonner'
import { listingCurrency, nightlyRateOn, roomTypeRate } from '~/components/cockpit/data/cockpit'
import { describeOverrides, OVERRIDE_FIELDS, overridesIn, validateOverride } from '~/components/cockpit/data/cockpit-overrides'
import { addIsoDays } from '~/components/gm/data/gm-dashboard'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Separator } from '~/components/ui/separator'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '~/components/ui/sheet'
import { Switch } from '~/components/ui/switch'
import { useCockpitLog } from '~/composables/useCockpitLog'
import { useCockpitOverrides } from '~/composables/useCockpitOverrides'

/**
 * After a click or drag across free nights, a side sheet (not a modal, so it
 * reads like the other Cockpit sheets): book a guest there (opens the New
 * reservation sheet, prefilled) or block the nights with a reason.
 *
 * The gear in the header switches to **override settings** for those nights
 * (`cockpit-overrides.ts`): tick the settings to change (Only Availability,
 * Closed To Arrival / Departure, Max Availability, Max / Min Stay, Rate, Stop
 * Sell), set each, save. They apply to the row's room type (every room of it),
 * or the whole property for a single-unit listing. Overrides already on those
 * nights are listed and can be removed.
 */
const props = defineProps<{ request: CockpitCreateRequest | null }>()
const emit = defineEmits<{ reserve: [request: CockpitCreateRequest], block: [request: CockpitCreateRequest, reason: string] }>()
const open = defineModel<boolean>('open', { default: false })

const { overrides, addOverride, removeOverride } = useCockpitOverrides()
const { logChange } = useCockpitLog()

const view = ref<'actions' | 'settings'>('actions')
const reason = ref('')

function formatDay(key: string) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y!, m! - 1, d!).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

const nights = computed(() => {
  if (!props.request)
    return 0
  const [a, b] = [props.request.checkIn, props.request.checkOut].map((k) => {
    const [y, m, d] = k.split('-').map(Number)
    return Date.UTC(y!, m! - 1, d!)
  })
  return Math.round((b! - a!) / 86_400_000)
})

function reserve() {
  if (props.request)
    emit('reserve', props.request)
  open.value = false
}

function block() {
  if (props.request)
    emit('block', props.request, reason.value.trim() || 'Blocked')
  open.value = false
}

/* ------------------------------------------------------------ override settings */

/** The room type of the row (multi-unit), else null: the whole property. */
const unitType = computed(() => {
  const r = props.request
  if (!r?.unitId)
    return null
  return r.listing.unitTypes?.find(t => t.units.some(u => u.id === r.unitId)) ?? null
})
const scopeUnits = computed(() => unitType.value ? unitType.value.units.filter(u => u.status !== 'inactive').length : 1)
const currency = computed(() => unitType.value?.pricing.currency || (props.request ? listingCurrency(props.request.listing) : 'USD'))
const currentRate = computed(() => {
  const r = props.request
  if (!r)
    return 0
  return unitType.value ? roomTypeRate(unitType.value, r.listing) : nightlyRateOn(r.listing, r.checkIn)
})
const scopeLabel = computed(() => unitType.value
  ? `${unitType.value.name}, all ${scopeUnits.value} ${scopeUnits.value === 1 ? 'room' : 'rooms'} of this type`
  : 'The whole property')
/** The last night covered: the night before check-out. */
const lastNight = computed(() => props.request ? addIsoDays(props.request.checkOut, -1) : '')

const enabled = ref<OverrideField[]>([])
const draft = ref<OverrideValues>(defaultDraft())
const error = ref('')

function defaultDraft(): OverrideValues {
  return {
    availability: scopeUnits.value,
    closedToArrival: true,
    closedToDeparture: true,
    maxAvailability: scopeUnits.value,
    maxStay: 30,
    minStay: 2,
    rate: currentRate.value,
    stopSell: true,
  }
}

watch(open, (isOpen) => {
  if (!isOpen)
    return
  reason.value = ''
  view.value = 'actions'
  enabled.value = []
  draft.value = defaultDraft()
  error.value = ''
})

function toggleField(key: OverrideField) {
  enabled.value = enabled.value.includes(key) ? enabled.value.filter(k => k !== key) : [...enabled.value, key]
  error.value = ''
}

function setNumber(key: OverrideField, value: string | number) {
  draft.value = { ...draft.value, [key]: Number(value) }
}

const existing = computed(() => {
  const r = props.request
  if (!r)
    return []
  return overridesIn(overrides.value, r.listing.id, unitType.value?.id ?? null, r.checkIn, lastNight.value)
    .map(o => ({ ...o, summary: describeOverrides(o.values, currency.value).join(', ') }))
})

function saveOverrides() {
  const r = props.request
  if (!r)
    return
  const values = Object.fromEntries(enabled.value.map(k => [k, draft.value[k]])) as Partial<OverrideValues>
  const problem = validateOverride(values, scopeUnits.value)
  if (problem) {
    error.value = problem
    return
  }
  addOverride({ listingId: r.listing.id, unitTypeId: unitType.value?.id ?? null, from: r.checkIn, to: lastNight.value, values })
  logChange({
    kind: 'override',
    title: 'Override saved',
    detail: `${scopeLabel.value}, ${formatRange(r.checkIn, lastNight.value)}: ${describeOverrides(values, currency.value).join(', ')}.`,
    listingName: r.listing.name,
  })
  toast.success(`Overrides saved for ${nights.value} ${nights.value === 1 ? 'night' : 'nights'}`, {
    description: describeOverrides(values, currency.value).join(', '),
  })
  open.value = false
}

function removeOverrideLogged(o: { id: string, from: string, to: string, summary: string }) {
  removeOverride(o.id)
  logChange({
    kind: 'override',
    title: 'Override removed',
    detail: `${scopeLabel.value}, ${formatRange(o.from, o.to)}: ${o.summary}.`,
    listingName: props.request?.listing.name,
  })
}

function formatRange(from: string, to: string) {
  return from === to ? formatDay(from) : `${formatDay(from)} to ${formatDay(to)}`
}
</script>

<template>
  <Sheet v-model:open="open">
    <SheetContent class="flex w-full flex-col gap-0 p-0 sm:max-w-md" side="right" data-testid="cockpit-create-sheet">
      <SheetHeader class="flex-row items-start gap-3 border-b py-4 pr-14 pl-6">
        <div class="min-w-0 flex-1">
          <SheetTitle class="truncate">
            {{ view === 'settings' ? 'Override settings' : request?.rowName }}
          </SheetTitle>
          <SheetDescription v-if="request" class="truncate">
            {{ view === 'settings' ? `${request.listing.name}, ${scopeLabel}` : request.listing.name }}
          </SheetDescription>
        </div>
        <!-- Beside the close button: override settings for these nights. -->
        <Button
          v-if="request"
          variant="ghost"
          size="icon"
          class="size-8 shrink-0"
          :class="view === 'settings' && 'bg-accent'"
          :aria-pressed="view === 'settings'"
          :aria-label="view === 'settings' ? 'Back to booking and blocking' : 'Override settings for these nights'"
          :title="view === 'settings' ? 'Back' : 'Override settings'"
          data-testid="cockpit-create-settings"
          @click="view = view === 'settings' ? 'actions' : 'settings'"
        >
          <Icon name="lucide:settings" class="size-4" />
        </Button>
      </SheetHeader>

      <div v-if="request" class="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 py-5">
        <div class="flex items-center gap-3 rounded-lg border bg-muted/40 px-4 py-3">
          <Icon name="lucide:calendar-range" class="size-5 shrink-0 text-muted-foreground" />
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium">
              {{ formatDay(request.checkIn) }} to {{ formatDay(request.checkOut) }}
            </p>
            <p class="text-xs text-muted-foreground">
              {{ nights }} {{ nights === 1 ? 'night' : 'nights' }}
            </p>
          </div>
        </div>

        <template v-if="view === 'actions'">
          <section class="flex flex-col gap-3">
            <div>
              <h3 class="text-sm font-semibold">
                Book a guest
              </h3>
              <p class="text-xs text-muted-foreground">
                Opens New reservation with this listing and these dates filled in.
              </p>
            </div>
            <Button class="w-full" data-testid="cockpit-create-reserve" @click="reserve">
              <Icon name="lucide:calendar-plus" class="mr-2 size-4" />
              New reservation
            </Button>
          </section>

          <Separator />

          <section class="flex flex-col gap-3">
            <div>
              <h3 class="text-sm font-semibold">
                Block the nights
              </h3>
              <p class="text-xs text-muted-foreground">
                Closes these nights for guests. The reason shows on the bar.
              </p>
            </div>
            <div class="grid gap-2">
              <Label for="cockpit-block-reason">Reason</Label>
              <Input id="cockpit-block-reason" v-model="reason" placeholder="Maintenance, deep clean, owner use" @keydown.enter="block" />
            </div>
            <Button variant="outline" class="w-full" data-testid="cockpit-create-block" @click="block">
              <Icon name="lucide:ban" class="mr-2 size-4" />
              Block nights
            </Button>
          </section>
        </template>

        <template v-else>
          <section class="flex flex-col gap-2" data-testid="cockpit-overrides">
            <p class="text-xs text-muted-foreground">
              Tick what to change on these nights. Everything else keeps its usual setting.
            </p>
            <div v-for="field in OVERRIDE_FIELDS" :key="field.key" class="rounded-lg border" :class="enabled.includes(field.key) && 'border-primary/40 bg-primary/5'">
              <div
                class="flex cursor-pointer items-center gap-3 px-3 py-2.5"
                role="checkbox"
                :aria-checked="enabled.includes(field.key)"
                tabindex="0"
                :data-testid="`cockpit-override-${field.key}`"
                @click="toggleField(field.key)"
                @keydown.space.prevent="toggleField(field.key)"
                @keydown.enter.prevent="toggleField(field.key)"
              >
                <div
                  class="flex size-4 shrink-0 items-center justify-center rounded-[4px] border"
                  :class="enabled.includes(field.key) ? 'border-primary bg-primary text-primary-foreground' : 'border-input'"
                >
                  <Icon v-if="enabled.includes(field.key)" name="lucide:check" class="size-3" />
                </div>
                <Icon :name="field.icon" class="size-4 shrink-0 text-muted-foreground" />
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-medium">
                    {{ field.label }}
                  </p>
                  <p class="text-xs text-muted-foreground">
                    {{ field.hint }}
                  </p>
                </div>
              </div>

              <div v-if="enabled.includes(field.key)" class="flex items-center gap-3 border-t px-3 py-2.5">
                <template v-if="field.kind === 'toggle'">
                  <span class="flex-1 text-sm">{{ draft[field.key] ? 'On' : 'Off' }}</span>
                  <Switch
                    :model-value="draft[field.key] as boolean"
                    :aria-label="field.label"
                    @update:model-value="draft = { ...draft, [field.key]: $event }"
                  />
                </template>
                <div v-else-if="field.kind === 'money'" class="relative flex-1">
                  <span class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">{{ currency }}</span>
                  <Input
                    type="number"
                    min="0"
                    class="pl-14 tabular-nums"
                    :aria-label="`${field.label} in ${currency}`"
                    :model-value="draft.rate"
                    @update:model-value="setNumber('rate', $event)"
                  />
                </div>
                <template v-else>
                  <Input
                    type="number"
                    :min="field.kind === 'nights' ? 1 : 0"
                    :max="field.kind === 'count' ? scopeUnits : undefined"
                    class="w-24 tabular-nums"
                    :aria-label="field.label"
                    :model-value="draft[field.key] as number"
                    @update:model-value="setNumber(field.key, $event)"
                  />
                  <span class="text-sm text-muted-foreground">
                    {{ field.kind === 'nights' ? 'nights' : `of ${scopeUnits} ${scopeUnits === 1 ? 'room' : 'rooms'}` }}
                  </span>
                </template>
              </div>
            </div>
            <p v-if="error" class="text-sm text-destructive" role="alert">
              {{ error }}
            </p>
          </section>

          <section v-if="existing.length" class="flex flex-col gap-2" data-testid="cockpit-overrides-existing">
            <h3 class="text-sm font-semibold">
              Already on these nights
            </h3>
            <p class="text-xs text-muted-foreground">
              A newer override wins where they set the same thing.
            </p>
            <ul class="flex flex-col gap-2">
              <li v-for="o in existing" :key="o.id" class="flex items-start gap-2 rounded-md border px-3 py-2 text-sm">
                <Icon name="lucide:sliders-horizontal" class="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div class="min-w-0 flex-1">
                  <p class="text-xs text-muted-foreground">
                    {{ formatRange(o.from, o.to) }}
                  </p>
                  <p>{{ o.summary }}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  class="size-7 shrink-0"
                  :aria-label="`Remove the override ${o.summary}`"
                  @click="removeOverrideLogged(o)"
                >
                  <Icon name="lucide:trash-2" class="size-4" />
                </Button>
              </li>
            </ul>
          </section>
        </template>
      </div>

      <SheetFooter v-if="request && view === 'settings'" class="flex-row justify-end gap-2 border-t px-6 py-4">
        <Button variant="outline" @click="view = 'actions'">
          Back
        </Button>
        <Button :disabled="!enabled.length" data-testid="cockpit-overrides-save" @click="saveOverrides">
          Save overrides
        </Button>
      </SheetFooter>
    </SheetContent>
  </Sheet>
</template>
