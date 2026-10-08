<script setup lang="ts">
import type {
  BookingStatusFilter,
  OtaChannel,
  UpsellService,
  VisibilityConditionKey,
  VisibilityConditions,
  VisibilityMatchMode,
} from '@/components/upsells/data/upsell-services'
import {
  getConditionDefault,
  getConditionEmpty,
} from '@/components/upsells/data/upsell-services'

/**
 * One rule group of the upsell Visibility step: "Show when" or "Hide when".
 * Both groups store the same `VisibilityConditions` shape; the drawer decides
 * what they mean (hide wins over show).
 */
const props = defineProps<{
  mode: 'show' | 'hide'
  /** Other catalog services, for the "Related upsell purchased" rule. */
  otherServices: UpsellService[]
}>()

const conditions = defineModel<VisibilityConditions>({ required: true })
const match = defineModel<VisibilityMatchMode>('match', { required: true })

type RuleKind = 'checkIn' | 'checkOut' | 'guestCount' | 'lengthOfStay' | 'bookingStatus' | 'relatedUpsell' | 'channels'

const RULES: { kind: RuleKind, label: string, icon: string, keys: VisibilityConditionKey[] }[] = [
  { kind: 'checkIn', label: 'Time before check-in', icon: 'lucide:log-in', keys: ['hoursBeforeCheckIn'] },
  { kind: 'checkOut', label: 'Time before check-out', icon: 'lucide:log-out', keys: ['hoursBeforeCheckOut'] },
  { kind: 'guestCount', label: 'Guest count', icon: 'lucide:users', keys: ['guestCountMin', 'guestCountMax'] },
  { kind: 'lengthOfStay', label: 'Length of stay', icon: 'lucide:moon', keys: ['lengthOfStayMin', 'lengthOfStayMax'] },
  { kind: 'bookingStatus', label: 'Booking status', icon: 'lucide:calendar-check', keys: ['bookingStatuses'] },
  { kind: 'relatedUpsell', label: 'Related upsell purchased', icon: 'lucide:shopping-bag', keys: ['excludeIfUpsellPurchased'] },
  { kind: 'channels', label: 'Booking channel', icon: 'lucide:globe', keys: ['channels'] },
]

const BOOKING_STATUS_OPTIONS: { value: BookingStatusFilter, label: string }[] = [
  { value: 'inquiry', label: 'Inquiry' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'checked_in', label: 'Checked-in' },
  { value: 'checked_out', label: 'Checked-out' },
  { value: 'cancelled', label: 'Cancelled' },
]

const CHANNEL_OPTIONS: { value: OtaChannel, label: string }[] = [
  { value: 'airbnb', label: 'Airbnb' },
  { value: 'booking_com', label: 'Booking.com' },
  { value: 'direct', label: 'Direct' },
  { value: 'agoda', label: 'Agoda' },
  { value: 'vrbo', label: 'VRBO' },
  { value: 'expedia', label: 'Expedia' },
]

const copy = computed(() => props.mode === 'show'
  ? {
      title: 'Show when',
      icon: 'lucide:eye',
      description: 'Offer this upsell only to stays that match.',
      empty: 'No rules: shown to every eligible stay.',
    }
  : {
      title: 'Hide when',
      icon: 'lucide:eye-off',
      description: 'Never offer this upsell to stays that match, even if a show rule matches.',
      empty: 'No rules: never hidden.',
    })

function isActive(rule: { keys: VisibilityConditionKey[] }): boolean {
  return rule.keys.some(k => conditions.value[k] !== null)
}

const activeRules = computed(() => RULES.filter(isActive))
const availableRules = computed(() => RULES.filter(r => !isActive(r)))

function addRule(kind: RuleKind) {
  const rule = RULES.find(r => r.kind === kind)!
  const next = { ...conditions.value }
  for (const key of rule.keys)
    (next as Record<VisibilityConditionKey, unknown>)[key] = getConditionDefault(key)
  conditions.value = next
}

function removeRule(kind: RuleKind) {
  const rule = RULES.find(r => r.kind === kind)!
  const next = { ...conditions.value }
  for (const key of rule.keys)
    (next as Record<VisibilityConditionKey, unknown>)[key] = getConditionEmpty(key)
  conditions.value = next
}

function setNumber(key: VisibilityConditionKey, value: string | number) {
  conditions.value = { ...conditions.value, [key]: value === '' ? null : Number(value) }
}

function toggleIn<T extends string>(key: 'bookingStatuses' | 'channels' | 'excludeIfUpsellPurchased', value: T) {
  const current = (conditions.value[key] ?? []) as T[]
  conditions.value = {
    ...conditions.value,
    [key]: current.includes(value) ? current.filter(v => v !== value) : [...current, value],
  }
}

function isIn(key: 'bookingStatuses' | 'channels' | 'excludeIfUpsellPurchased', value: string): boolean {
  return (conditions.value[key] as string[] | null)?.includes(value) ?? false
}

const rangeInvalid = computed(() => ({
  guestCount: conditions.value.guestCountMin !== null && conditions.value.guestCountMax !== null
    && conditions.value.guestCountMin > conditions.value.guestCountMax,
  lengthOfStay: conditions.value.lengthOfStayMin !== null && conditions.value.lengthOfStayMax !== null
    && conditions.value.lengthOfStayMin > conditions.value.lengthOfStayMax,
}))
</script>

<template>
  <section class="flex flex-col rounded-lg border" :data-testid="`visibility-group-${mode}`">
    <header class="flex items-start gap-3 border-b px-4 py-3">
      <div
        class="flex size-8 shrink-0 items-center justify-center rounded-md"
        :class="mode === 'show' ? 'bg-primary text-primary-foreground' : 'bg-destructive text-white'"
      >
        <Icon :name="copy.icon" class="size-4" />
      </div>
      <div class="min-w-0 flex-1">
        <h3 class="text-sm font-semibold">
          {{ copy.title }}
        </h3>
        <p class="text-xs text-muted-foreground">
          {{ copy.description }}
        </p>
      </div>
    </header>

    <div class="flex flex-col gap-2 p-3">
      <div
        v-if="activeRules.length > 1"
        class="flex flex-wrap items-center gap-2 px-1 text-xs text-muted-foreground"
      >
        <span>Match</span>
        <div class="inline-flex rounded-md border p-0.5" role="radiogroup" :aria-label="`${copy.title} match mode`">
          <button
            v-for="opt in [{ value: 'all', label: 'All rules' }, { value: 'any', label: 'Any rule' }] as const"
            :key="opt.value"
            type="button"
            role="radio"
            :aria-checked="match === opt.value"
            class="rounded px-2 py-0.5 font-medium transition-colors"
            :class="match === opt.value ? 'bg-muted text-foreground' : 'hover:text-foreground'"
            @click="match = opt.value"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>

      <p v-if="activeRules.length === 0" class="rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
        {{ copy.empty }}
      </p>

      <template v-for="(rule, idx) in activeRules" :key="rule.kind">
        <div
          v-if="idx > 0"
          class="-my-1 self-start rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
        >
          {{ match === 'all' ? 'and' : 'or' }}
        </div>

        <div class="flex flex-col gap-2 rounded-md border bg-muted/20 p-3">
          <div class="flex items-center gap-2">
            <Icon :name="rule.icon" class="size-4 shrink-0 text-muted-foreground" />
            <span class="flex-1 text-sm font-medium">{{ rule.label }}</span>
            <Button
              variant="ghost"
              size="icon"
              class="size-7 text-muted-foreground hover:text-destructive"
              :aria-label="`Remove ${rule.label} rule`"
              @click="removeRule(rule.kind)"
            >
              <Icon name="lucide:x" class="size-3.5" />
            </Button>
          </div>

          <!-- Time before check-in / check-out -->
          <div v-if="rule.kind === 'checkIn' || rule.kind === 'checkOut'" class="flex items-center gap-2 text-sm">
            <span class="text-muted-foreground">Within</span>
            <Input
              :model-value="(rule.kind === 'checkIn' ? conditions.hoursBeforeCheckIn : conditions.hoursBeforeCheckOut) ?? ''"
              type="number"
              min="0"
              class="h-8 w-20"
              :aria-label="`${rule.label} in hours`"
              @update:model-value="(v) => setNumber(rule.kind === 'checkIn' ? 'hoursBeforeCheckIn' : 'hoursBeforeCheckOut', v)"
            />
            <span class="text-muted-foreground">hours before {{ rule.kind === 'checkIn' ? 'check-in' : 'check-out' }}</span>
          </div>

          <!-- Guest count / length of stay ranges -->
          <template v-else-if="rule.kind === 'guestCount' || rule.kind === 'lengthOfStay'">
            <div class="flex flex-wrap items-center gap-2 text-sm">
              <span class="text-muted-foreground">Between</span>
              <Input
                :model-value="(rule.kind === 'guestCount' ? conditions.guestCountMin : conditions.lengthOfStayMin) ?? ''"
                type="number"
                min="1"
                placeholder="Min"
                class="h-8 w-20"
                :aria-label="`${rule.label} minimum`"
                @update:model-value="(v) => setNumber(rule.kind === 'guestCount' ? 'guestCountMin' : 'lengthOfStayMin', v)"
              />
              <span class="text-muted-foreground">and</span>
              <Input
                :model-value="(rule.kind === 'guestCount' ? conditions.guestCountMax : conditions.lengthOfStayMax) ?? ''"
                type="number"
                min="1"
                placeholder="Max"
                class="h-8 w-20"
                :aria-label="`${rule.label} maximum`"
                @update:model-value="(v) => setNumber(rule.kind === 'guestCount' ? 'guestCountMax' : 'lengthOfStayMax', v)"
              />
              <span class="text-muted-foreground">{{ rule.kind === 'guestCount' ? 'guests' : 'nights' }}</span>
            </div>
            <p v-if="rangeInvalid[rule.kind]" class="text-xs text-destructive">
              Min is greater than max.
            </p>
          </template>

          <!-- Booking status -->
          <div v-else-if="rule.kind === 'bookingStatus'" class="flex flex-wrap gap-1.5">
            <button
              v-for="opt in BOOKING_STATUS_OPTIONS"
              :key="opt.value"
              type="button"
              class="rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors"
              :class="isIn('bookingStatuses', opt.value) ? 'border-primary bg-primary text-primary-foreground' : 'bg-background hover:bg-muted/50'"
              :aria-pressed="isIn('bookingStatuses', opt.value)"
              @click="toggleIn('bookingStatuses', opt.value)"
            >
              {{ opt.label }}
            </button>
          </div>

          <!-- Related upsell purchased -->
          <template v-else-if="rule.kind === 'relatedUpsell'">
            <p v-if="otherServices.length === 0" class="text-xs text-muted-foreground">
              No other upsells to relate to.
            </p>
            <div v-else class="flex flex-wrap gap-1.5">
              <button
                v-for="svc in otherServices"
                :key="svc.id"
                type="button"
                class="rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors"
                :class="isIn('excludeIfUpsellPurchased', svc.id) ? 'border-primary bg-primary text-primary-foreground' : 'bg-background hover:bg-muted/50'"
                :aria-pressed="isIn('excludeIfUpsellPurchased', svc.id)"
                @click="toggleIn('excludeIfUpsellPurchased', svc.id)"
              >
                {{ svc.name }}
              </button>
            </div>
            <p class="text-xs text-muted-foreground">
              Matches when the guest already bought any of the selected upsells.
            </p>
          </template>

          <!-- Channels -->
          <div v-else-if="rule.kind === 'channels'" class="flex flex-wrap gap-1.5">
            <button
              v-for="opt in CHANNEL_OPTIONS"
              :key="opt.value"
              type="button"
              class="rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors"
              :class="isIn('channels', opt.value) ? 'border-primary bg-primary text-primary-foreground' : 'bg-background hover:bg-muted/50'"
              :aria-pressed="isIn('channels', opt.value)"
              @click="toggleIn('channels', opt.value)"
            >
              {{ opt.label }}
            </button>
          </div>
        </div>
      </template>

      <DropdownMenu v-if="availableRules.length">
        <DropdownMenuTrigger as-child>
          <Button variant="ghost" size="sm" class="h-8 self-start text-muted-foreground" :data-testid="`visibility-add-${mode}`">
            <Icon name="lucide:plus" class="mr-1 size-4" />
            Add rule
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" class="w-56">
          <DropdownMenuItem v-for="rule in availableRules" :key="rule.kind" @click="addRule(rule.kind)">
            <Icon :name="rule.icon" class="mr-2 size-4 text-muted-foreground" />
            {{ rule.label }}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </section>
</template>
