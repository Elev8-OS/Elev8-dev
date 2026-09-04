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
  draft.value = { ...draft.value, [key]: [...draft.value[key], { from: null, until: null }] }
}

function removeWindow(key: WindowKey, index: number) {
  draft.value = { ...draft.value, [key]: draft.value[key].filter((_, i) => i !== index) }
}

function updateWindow(key: WindowKey, index: number, field: keyof PromoCodeWindow, value: string) {
  draft.value = {
    ...draft.value,
    [key]: draft.value[key].map((w, i) => (i === index ? { ...w, [field]: value || null } : w)),
  }
}

function onUsageLimitInput(event: Event) {
  const raw = (event.target as HTMLInputElement).value
  draft.value = { ...draft.value, usageLimit: raw === '' ? null : Number(raw) }
}

const windowGroups: { key: WindowKey, label: string, icon: string, empty: string, hint: string }[] = [
  {
    key: 'bookingWindows',
    label: 'Booking windows',
    icon: 'lucide:calendar-clock',
    empty: 'No booking window — the code is bookable any time.',
    hint: 'When guests are allowed to make the reservation.',
  },
  {
    key: 'stayWindows',
    label: 'Stay windows',
    icon: 'lucide:bed',
    empty: 'No stay window — the code applies to any check-in date.',
    hint: 'Which check-in dates the code covers.',
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
          Leave both lists empty for an always-valid code. With windows set, a guest can redeem when
          at least one booking window <em>and</em> at least one stay window are open.
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
              class="grid grid-cols-[1fr_1fr_auto] items-end gap-2 rounded-md border bg-muted/30 p-2"
              :class="props.errors[`${group.key}.${idx}`] ? 'border-destructive' : ''"
            >
              <legend class="sr-only">
                {{ group.label }} {{ idx + 1 }}
              </legend>
              <div class="space-y-1">
                <Label :for="`${props.idPrefix}-${group.key}-from-${idx}`" class="text-xs">From</Label>
                <Input
                  :id="`${props.idPrefix}-${group.key}-from-${idx}`"
                  :model-value="window.from ?? ''"
                  type="date"
                  :aria-label="`${group.label} ${idx + 1} start date`"
                  :aria-invalid="props.errors[`${group.key}.${idx}`] ? 'true' : 'false'"
                  @input="(e: Event) => updateWindow(group.key, idx, 'from', (e.target as HTMLInputElement).value)"
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
                  @input="(e: Event) => updateWindow(group.key, idx, 'until', (e.target as HTMLInputElement).value)"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                class="size-8 text-muted-foreground hover:text-destructive"
                :aria-label="`Remove ${group.label} ${idx + 1}`"
                @click="removeWindow(group.key, idx)"
              >
                <Icon name="lucide:trash-2" class="size-3.5" aria-hidden="true" />
              </Button>
            </fieldset>
            <p v-if="props.errors[`${group.key}.${idx}`]" role="alert" class="text-xs text-destructive">
              {{ props.errors[`${group.key}.${idx}`] }}
            </p>
          </div>
        </div>
      </div>
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
