<script setup lang="ts">
import type { PromoCodeFormDraft, PromoCodeFormErrors } from './data/promo-code-form'
import type { PromoCodeWindow } from './data/promo-codes'
import { Switch } from '~/components/ui/switch'

/**
 * Step 4 fields — how long the code runs and how often it can be redeemed.
 * Booking windows govern *when a reservation may be made*, stay windows govern
 * which check-in dates* the code covers; the two are independent, which is
 * why they are two lists rather than one date range.
 */
const props = defineProps<{
  errors: PromoCodeFormErrors
  idPrefix: string
}>()

const draft = defineModel<PromoCodeFormDraft>({ required: true })

type WindowKey = 'bookingWindows' | 'stayWindows'

function addWindow(key: WindowKey) {
  draft.value = {
    ...draft.value,
    [key]: [...draft.value[key], { type: 'fixed', from: null, until: null, days: null }],
  }
}

function removeWindow(key: WindowKey, index: number) {
  draft.value = { ...draft.value, [key]: draft.value[key].filter((_, i) => i !== index) }
}

function updateWindow(key: WindowKey, index: number, field: keyof PromoCodeWindow, value: any) {
  draft.value = {
    ...draft.value,
    [key]: draft.value[key].map((w, i) => (i === index ? { ...w, [field]: value } : w)),
  }
}

function setWindowType(key: WindowKey, index: number, type: 'fixed' | 'dynamic') {
  draft.value = {
    ...draft.value,
    [key]: draft.value[key].map((w, i) => {
      if (i !== index)
        return w
      if (type === 'dynamic') {
        return {
          ...w,
          type: 'dynamic',
          days: w.days ?? 7,
          from: null,
          until: null,
        }
      }
      return {
        ...w,
        type: 'fixed',
        days: null,
      }
    }),
  }
}

function onMinStayInput(event: Event) {
  const raw = (event.target as HTMLInputElement).value
  draft.value = { ...draft.value, minStay: raw === '' ? null : Number(raw) }
}

function onUsageLimitInput(event: Event) {
  const raw = (event.target as HTMLInputElement).value
  draft.value = { ...draft.value, usageLimit: raw === '' ? null : Number(raw) }
}

const windowGroups: { key: WindowKey, label: string, icon: string, empty: string, hint: string }[] = [
  {
    key: 'bookingWindows',
    label: 'Booking window',
    icon: 'lucide:calendar-clock',
    empty: 'No booking restrictions — guests can redeem this code anytime.',
    hint: 'Restricts when guests are allowed to make their reservation.',
  },
  {
    key: 'stayWindows',
    label: 'Stay window',
    icon: 'lucide:bed',
    empty: 'No stay restrictions — valid for check-ins on any date.',
    hint: 'Restricts which check-in or stay dates qualify for this discount.',
  },
]
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-col gap-4 rounded-md border p-3">
      <div>
        <p class="text-sm font-medium">
          Validity windows
        </p>
        <p class="text-xs text-muted-foreground">
          Control when guests can redeem this promo code and which stay dates qualify. Leave both empty to allow bookings and stays at any time.
        </p>
      </div>

      <div v-for="group in windowGroups" :key="group.key" class="space-y-2">
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-1.5">
            <Icon :name="group.icon" class="size-3.5 text-muted-foreground" aria-hidden="true" />
            <Label class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {{ group.label }}
            </Label>
          </div>
          <Button type="button" variant="ghost" size="sm" class="h-7 text-xs" @click="addWindow(group.key)">
            <Icon name="lucide:plus" class="mr-1 size-3.5" aria-hidden="true" />
            Add window
          </Button>
        </div>
        <p class="text-xs text-muted-foreground">
          {{ group.hint }}
        </p>

        <div v-if="draft[group.key].length === 0" class="rounded-md border border-dashed py-4 text-center text-xs text-muted-foreground">
          {{ group.empty }}
        </div>
        <div v-else class="space-y-2">
          <div v-for="(window, idx) in draft[group.key]" :key="`${group.key}-${idx}`" class="space-y-1">
            <fieldset
              class="rounded-md border bg-muted/30 p-2.5"
              :class="props.errors[`${group.key}.${idx}`] ? 'border-destructive' : ''"
            >
              <legend class="sr-only">
                {{ group.label }} {{ idx + 1 }}
              </legend>

              <div class="flex items-center justify-between gap-2 border-b border-border/50 pb-2 mb-2">
                <span class="text-[11px] font-medium text-muted-foreground">
                  #{{ idx + 1 }}
                </span>
                <div class="flex items-center gap-1">
                  <div class="flex items-center rounded-md border bg-muted/50 p-0.5 text-xs">
                    <button
                      type="button"
                      class="rounded px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer"
                      :class="(window.type ?? 'fixed') === 'fixed' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'"
                      @click="setWindowType(group.key, idx, 'fixed')"
                    >
                      Fixed dates
                    </button>
                    <button
                      type="button"
                      class="rounded px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer"
                      :class="window.type === 'dynamic' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'"
                      @click="setWindowType(group.key, idx, 'dynamic')"
                    >
                      Rolling window
                    </button>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    class="size-7 text-muted-foreground hover:text-destructive ml-1"
                    :aria-label="`Remove ${group.label} ${idx + 1}`"
                    @click="removeWindow(group.key, idx)"
                  >
                    <Icon name="lucide:trash-2" class="size-3.5" aria-hidden="true" />
                  </Button>
                </div>
              </div>

              <!-- Fixed Dates Mode -->
              <div v-if="(window.type ?? 'fixed') === 'fixed'" class="grid grid-cols-2 gap-2">
                <div class="space-y-1">
                  <Label :for="`${props.idPrefix}-${group.key}-from-${idx}`" class="text-xs">From</Label>
                  <Input
                    :id="`${props.idPrefix}-${group.key}-from-${idx}`"
                    :model-value="window.from ?? ''"
                    type="date"
                    :aria-label="`${group.label} ${idx + 1} start date`"
                    :aria-invalid="props.errors[`${group.key}.${idx}`] ? 'true' : 'false'"
                    @input="(e: Event) => updateWindow(group.key, idx, 'from', (e.target as HTMLInputElement).value || null)"
                  />
                </div>
                <div class="space-y-1">
                  <Label :for="`${props.idPrefix}-${group.key}-until-${idx}`" class="text-xs">Until</Label>
                  <Input
                    :id="`${props.idPrefix}-${group.key}-until-${idx}`"
                    :model-value="window.until ?? ''"
                    type="date"
                    :aria-label="`${group.label} ${idx + 1} end date`"
                    :aria-invalid="props.errors[`${group.key}.${idx}`] ? 'true' : 'false'"
                    @input="(e: Event) => updateWindow(group.key, idx, 'until', (e.target as HTMLInputElement).value || null)"
                  />
                </div>
              </div>

              <!-- Dynamic Mode -->
              <div v-else class="space-y-1">
                <Label :for="`${props.idPrefix}-${group.key}-days-${idx}`" class="text-xs">
                  {{ group.key === 'bookingWindows' ? 'Bookable within' : 'Check-in within' }}
                </Label>
                <div class="relative max-w-xs">
                  <Input
                    :id="`${props.idPrefix}-${group.key}-days-${idx}`"
                    :model-value="window.days == null ? '' : String(window.days)"
                    type="number"
                    min="1"
                    placeholder="e.g. 7"
                    class="pr-14"
                    :aria-label="`${group.label} ${idx + 1} dynamic days`"
                    :aria-invalid="props.errors[`${group.key}.${idx}`] ? 'true' : 'false'"
                    @input="(e: Event) => {
                      const v = (e.target as HTMLInputElement).value
                      updateWindow(group.key, idx, 'days', v === '' ? null : Number(v))
                    }"
                  />
                  <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-xs text-muted-foreground">
                    days
                  </div>
                </div>
                <p class="text-[11px] text-muted-foreground">
                  {{ group.key === 'bookingWindows'
                    ? 'Rolling from today: valid for reservations made within this duration.'
                    : 'Rolling from today: eligible for stays checking in within this duration.'
                  }}
                </p>
              </div>
            </fieldset>
            <p v-if="props.errors[`${group.key}.${idx}`]" role="alert" class="text-xs text-destructive">
              {{ props.errors[`${group.key}.${idx}`] }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <div class="space-y-2">
      <Label :for="`${props.idPrefix}-min-stay`">
        Minimum stay <span class="font-normal text-muted-foreground">(optional)</span>
      </Label>
      <div class="relative">
        <Input
          :id="`${props.idPrefix}-min-stay`"
          :model-value="draft.minStay === null ? '' : String(draft.minStay)"
          type="number"
          min="1"
          placeholder="No minimum"
          class="pr-14"
          :class="props.errors.minStay ? 'border-destructive' : ''"
          :aria-invalid="props.errors.minStay ? 'true' : 'false'"
          :aria-describedby="props.errors.minStay ? `${props.idPrefix}-min-stay-error` : `${props.idPrefix}-min-stay-help`"
          @input="onMinStayInput"
        />
        <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-xs text-muted-foreground">
          nights
        </div>
      </div>
      <p
        v-if="props.errors.minStay"
        :id="`${props.idPrefix}-min-stay-error`"
        role="alert"
        class="text-xs text-destructive"
      >
        {{ props.errors.minStay }}
      </p>
      <p v-else :id="`${props.idPrefix}-min-stay-help`" class="text-xs text-muted-foreground">
        Minimum stay length in nights required to use this code. Leave blank for no minimum.
      </p>
    </div>

    <div class="space-y-2">
      <Label :for="`${props.idPrefix}-usage-limit`">
        Usage limit <span class="font-normal text-muted-foreground">(optional)</span>
      </Label>
      <Input
        :id="`${props.idPrefix}-usage-limit`"
        :model-value="draft.usageLimit === null ? '' : String(draft.usageLimit)"
        type="number"
        min="1"
        placeholder="Unlimited"
        :class="props.errors.usageLimit ? 'border-destructive' : ''"
        :aria-invalid="props.errors.usageLimit ? 'true' : 'false'"
        :aria-describedby="props.errors.usageLimit ? `${props.idPrefix}-usage-limit-error` : `${props.idPrefix}-usage-limit-help`"
        @input="onUsageLimitInput"
      />
      <p
        v-if="props.errors.usageLimit"
        :id="`${props.idPrefix}-usage-limit-error`"
        role="alert"
        class="text-xs text-destructive"
      >
        {{ props.errors.usageLimit }}
      </p>
      <p v-else :id="`${props.idPrefix}-usage-limit-help`" class="text-xs text-muted-foreground">
        Leave blank for unlimited redemptions.
      </p>
    </div>

    <div class="flex items-center justify-between gap-3 rounded-md border p-3">
      <div>
        <Label :for="`${props.idPrefix}-active`" class="text-sm font-medium">Active</Label>
        <p :id="`${props.idPrefix}-active-help`" class="text-xs text-muted-foreground">
          Inactive codes cannot be redeemed.
        </p>
      </div>
      <Switch
        :id="`${props.idPrefix}-active`"
        :model-value="draft.active"
        :aria-describedby="`${props.idPrefix}-active-help`"
        @update:model-value="(v) => draft = { ...draft, active: v }"
      />
    </div>
  </div>
</template>
