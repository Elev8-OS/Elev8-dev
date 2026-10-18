<script setup lang="ts">
import type {
  BillingCycle,
  PerUnitPlan,
  PricingModel,
} from '~/components/onboarding/data/onboarding'
import {
  billableUnits,
  hasChannelManager,
  PER_BOOKING_PLANS,
  PER_BOOKING_REFILL_THRESHOLD,
  PER_BOOKING_WARNING_THRESHOLD,
  PER_UNIT_CONTRACT_MONTHS,
  PER_UNIT_PLANS,
  perBookingAmount,
  perBookingRate,
  perUnitAmount,
  perUnitPlanForUnits,
  perUnitRate,
  REVENUE_MANAGEMENT_ADDON,
  revenueManagementAmount,
} from '~/components/onboarding/data/onboarding'

const emit = defineEmits<{ (e: 'next'): void, (e: 'back'): void }>()

const { state, selectPlan } = useOnboarding()

const model = computed(() => state.value.pmsModel!)
const pricingModel = ref<PricingModel>(state.value.subscription.pricingModel ?? 'per_unit')
const billingCycle = ref<BillingCycle>(state.value.subscription.billingCycle ?? 'monthly')
const unitCount = ref(state.value.subscription.unitCount || 1)
const perBookingCode = ref(
  state.value.subscription.pricingModel === 'per_booking' && state.value.subscription.planCode
    ? state.value.subscription.planCode
    : PER_BOOKING_PLANS[0]?.code ?? null,
)

/** The tier follows the unit count, so a tenant cannot pick a plan they do not fit. */
const perUnitPlan = computed(() => perUnitPlanForUnits(Math.max(1, unitCount.value)))
const perUnitBillable = computed(() => billableUnits(Math.max(1, unitCount.value), perUnitPlan.value))
const perUnitTotal = computed(() => perUnitAmount(Math.max(1, unitCount.value), perUnitPlan.value, billingCycle.value))

const revenueManagement = ref(state.value.subscription.revenueManagement ?? false)
/** Per booking has no billing cycle, so the add-on bills monthly there. */
const addOnCycle = computed<BillingCycle>(() => pricingModel.value === 'per_unit' ? billingCycle.value : 'monthly')
const addOnAmount = computed(() => revenueManagementAmount(unitCount.value, addOnCycle.value))

function toggleRevenueManagement(): void {
  revenueManagement.value = !revenueManagement.value
}

const selectedPerBooking = computed(() =>
  PER_BOOKING_PLANS.find(p => p.code === perBookingCode.value) ?? null)

const planLabel = computed(() => pricingModel.value === 'per_unit'
  ? `${perUnitPlan.value.name}, ${perUnitBillable.value} ${perUnitBillable.value === 1 ? 'unit' : 'units'} billed ${billingCycle.value}`
  : selectedPerBooking.value
    ? `${selectedPerBooking.value.name}, ${selectedPerBooking.value.quota.toLocaleString('en-US')} bookings`
    : '')
const planTotal = computed(() => pricingModel.value === 'per_unit'
  ? perUnitTotal.value
  : selectedPerBooking.value ? perBookingAmount(selectedPerBooking.value, model.value) : 0)
const grandTotal = computed(() => planTotal.value + (revenueManagement.value ? addOnAmount.value : 0))

const canContinue = computed(() =>
  pricingModel.value === 'per_unit' ? unitCount.value >= 1 : Boolean(perBookingCode.value))

const percent = (n: number) => `${Math.round(n * 100)}%`

/** Formats amounts with currency code (e.g. "USD 69" or "USD 63.25") instead of symbol. */
function formatPrice(value: number): string {
  const isWhole = Number.isInteger(value)
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: isWhole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value)
  return `USD ${formatted}`
}

function toggleBillingCycle(): void {
  billingCycle.value = billingCycle.value === 'yearly' ? 'monthly' : 'yearly'
}

function choosePerUnit(plan: PerUnitPlan): void {
  if (unitCount.value < plan.minUnits) {
    unitCount.value = plan.minUnits
  }
  else if (plan.maxUnits !== null && unitCount.value > plan.maxUnits) {
    unitCount.value = plan.minUnits
  }
}

function submit(): void {
  if (!canContinue.value)
    return
  selectPlan({
    pricingModel: pricingModel.value,
    planCode: pricingModel.value === 'per_unit' ? perUnitPlan.value.code : perBookingCode.value!,
    billingCycle: billingCycle.value,
    unitCount: Math.max(1, unitCount.value),
    revenueManagement: revenueManagement.value,
  })
  emit('next')
}
</script>

<template>
  <form id="ob-plan-form" class="flex flex-col gap-6" @submit.prevent="submit">
    <div>
      <h3 class="text-base font-semibold tracking-tight text-foreground">
        Choose how you pay
      </h3>
      <p class="text-xs text-muted-foreground mt-0.5">
        Every price here is in USD, and that is exactly what your card is charged.
      </p>
    </div>

    <Tabs v-model="pricingModel">
      <TabsList class="grid w-full grid-cols-2 sm:w-[320px]">
        <TabsTrigger value="per_unit">
          Per unit
        </TabsTrigger>
        <TabsTrigger value="per_booking">
          Per booking
        </TabsTrigger>
      </TabsList>

      <!-- ── Per unit ─────────────────────────────────────────────────── -->
      <TabsContent value="per_unit" class="mt-4 flex flex-col gap-5">
        <!-- Top bar: Unit count input + Centered billing cycle switch -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-border/60 bg-muted/20 p-4">
          <div class="flex items-center gap-3">
            <Label for="ob-units" class="text-xs font-semibold text-foreground whitespace-nowrap">
              How many units do you run?
            </Label>
            <Input
              id="ob-units"
              v-model.number="unitCount"
              type="number"
              min="1"
              class="w-24 h-9 text-sm"
              inputmode="numeric"
            />
            <span class="text-xs text-muted-foreground">
              {{ unitCount === 1 ? 'unit' : 'units' }}
            </span>
          </div>

          <!-- Centered Monthly / Yearly Switch with reliable native button -->
          <div class="flex items-center gap-3 self-center sm:self-auto">
            <button
              type="button"
              class="text-sm font-medium transition-colors select-none cursor-pointer bg-transparent border-0 p-0"
              :class="billingCycle === 'monthly' ? 'text-foreground font-semibold' : 'text-muted-foreground hover:text-foreground'"
              @click="billingCycle = 'monthly'"
            >
              Monthly
            </button>
            <button
              id="ob-cycle-switch"
              type="button"
              role="switch"
              :aria-checked="billingCycle === 'yearly'"
              aria-label="Toggle yearly billing"
              class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              :class="billingCycle === 'yearly' ? 'bg-primary' : 'bg-input'"
              @click="toggleBillingCycle"
            >
              <span
                class="pointer-events-none block size-4 rounded-full bg-background shadow-sm ring-0 transition-transform"
                :class="billingCycle === 'yearly' ? 'translate-x-4' : 'translate-x-0'"
              />
            </button>
            <div class="flex items-center gap-2">
              <button
                type="button"
                class="text-sm font-medium transition-colors select-none cursor-pointer bg-transparent border-0 p-0"
                :class="billingCycle === 'yearly' ? 'text-foreground font-semibold' : 'text-muted-foreground hover:text-foreground'"
                @click="billingCycle = 'yearly'"
              >
                Yearly
              </button>
              <span
                class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 cursor-pointer select-none"
                @click="billingCycle = 'yearly'"
              >
                Save ~8%
              </span>
            </div>
          </div>
        </div>

        <!-- Pricing Cards Grid -->
        <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div
            v-for="plan in PER_UNIT_PLANS"
            :key="plan.code"
            class="flex flex-col justify-between rounded-xl border p-4 shadow-xs transition-all cursor-pointer select-none"
            :class="plan.code === perUnitPlan.code
              ? 'border-primary ring-2 ring-primary/20 bg-primary/5'
              : 'border-border/80 bg-card hover:border-primary/50'"
            @click="choosePerUnit(plan)"
          >
            <div>
              <!-- Plan Name & Tier Badge -->
              <div class="flex items-center justify-between gap-2 min-h-6">
                <p class="text-sm font-semibold text-foreground">
                  {{ plan.name }}
                </p>
                <Badge
                  v-if="plan.code === perUnitPlan.code"
                  variant="default"
                  class="text-[10px] font-medium px-1.5 py-0"
                >
                  Your tier
                </Badge>
              </div>
              <p class="mt-0.5 text-xs text-muted-foreground">
                {{ plan.minUnits }}{{ plan.maxUnits ? ` to ${plan.maxUnits}` : ' or more' }} units
              </p>

              <!-- Price Block (Compact 2xl font, no split/wrapping) -->
              <div class="mt-3">
                <div class="flex items-baseline gap-1">
                  <span class="text-2xl font-bold tracking-tight text-foreground tabular-nums whitespace-nowrap">
                    {{ formatPrice(perUnitRate(plan, billingCycle)) }}
                  </span>
                  <span class="text-xs text-muted-foreground whitespace-nowrap">
                    / month
                  </span>
                </div>
                <p class="text-[11px] text-muted-foreground mt-0.5">
                  per unit · billed {{ billingCycle }}
                </p>
              </div>

              <!-- Rates breakdown table -->
              <dl class="mt-3 space-y-1.5 border-t border-border/60 pt-2.5 text-xs text-muted-foreground">
                <div class="flex justify-between gap-2">
                  <dt>Monthly rate</dt>
                  <dd class="tabular-nums font-medium text-foreground whitespace-nowrap">
                    {{ formatPrice(plan.monthly) }}
                  </dd>
                </div>
                <div class="flex justify-between gap-2">
                  <dt>Yearly rate</dt>
                  <dd class="tabular-nums font-medium text-foreground whitespace-nowrap">
                    {{ formatPrice(plan.yearly) }}
                  </dd>
                </div>
                <div class="flex justify-between gap-2">
                  <dt>Package floor</dt>
                  <dd class="tabular-nums font-medium text-foreground">
                    {{ plan.floor }} {{ plan.floor === 1 ? 'unit' : 'units' }}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </TabsContent>

      <!-- ── Per booking ──────────────────────────────────────────────── -->
      <TabsContent value="per_booking" class="mt-4 flex flex-col gap-5">
        <div class="grid gap-4 sm:grid-cols-3">
          <div
            v-for="plan in PER_BOOKING_PLANS"
            :key="plan.code"
            class="flex flex-col justify-between rounded-xl border p-4 shadow-xs transition-all cursor-pointer select-none"
            :class="perBookingCode === plan.code
              ? 'border-primary ring-2 ring-primary/20 bg-primary/5'
              : 'border-border/80 bg-card hover:border-primary/50'"
            @click="perBookingCode = plan.code"
          >
            <div>
              <div class="flex items-center justify-between gap-2 min-h-6">
                <p class="text-sm font-semibold text-foreground">
                  {{ plan.name }}
                </p>
                <span
                  class="flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors"
                  :class="perBookingCode === plan.code ? 'border-primary bg-primary text-primary-foreground' : 'border-input'"
                >
                  <Icon v-if="perBookingCode === plan.code" name="lucide:check" class="size-3" />
                </span>
              </div>
              <p class="mt-0.5 text-xs text-muted-foreground">
                {{ plan.quota.toLocaleString('en-US') }} bookings, prepaid
              </p>

              <!-- Price Block (Compact 2xl font, no split/wrapping) -->
              <div class="mt-3">
                <div class="flex items-baseline gap-1">
                  <span class="text-2xl font-bold tracking-tight text-foreground tabular-nums whitespace-nowrap">
                    {{ formatPrice(perBookingRate(plan, model)) }}
                  </span>
                  <span class="text-xs text-muted-foreground whitespace-nowrap">
                    / booking
                  </span>
                </div>
                <p class="text-[11px] text-muted-foreground mt-0.5">
                  per booking · prepaid
                </p>
              </div>

              <!-- Rates breakdown table -->
              <dl class="mt-3 space-y-1.5 border-t border-border/60 pt-2.5 text-xs text-muted-foreground">
                <div class="flex justify-between gap-2">
                  <dt>Prepaid quota</dt>
                  <dd class="tabular-nums font-medium text-foreground whitespace-nowrap">
                    {{ plan.quota.toLocaleString('en-US') }} bookings
                  </dd>
                </div>
                <div class="flex justify-between gap-2">
                  <dt>Package total</dt>
                  <dd class="tabular-nums font-medium text-foreground whitespace-nowrap">
                    {{ formatPrice(perBookingAmount(plan, model)) }}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </TabsContent>
    </Tabs>

    <!-- ── Add-on: Revenue Management (both plan types) ─────────────── -->
    <section class="flex flex-col gap-3">
      <div>
        <h3 class="text-base font-semibold tracking-tight text-foreground">
          Add-ons
        </h3>
        <p class="text-xs text-muted-foreground mt-0.5">
          Optional. You can add or remove these later in Settings.
        </p>
      </div>

      <div
        class="flex flex-col gap-3 rounded-xl border p-4 shadow-xs transition-all cursor-pointer select-none"
        :class="revenueManagement
          ? 'border-primary ring-2 ring-primary/20 bg-primary/5'
          : 'border-border/80 bg-card hover:border-primary/50'"
        role="checkbox"
        :aria-checked="revenueManagement"
        tabindex="0"
        @click="toggleRevenueManagement"
        @keydown.space.prevent="toggleRevenueManagement"
      >
        <div class="flex items-start gap-3">
          <div
            class="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors"
            :class="revenueManagement ? 'border-primary bg-primary text-primary-foreground' : 'border-input'"
          >
            <Icon v-if="revenueManagement" name="lucide:check" class="size-3" />
          </div>
          <div class="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div class="min-w-0">
              <p class="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Icon name="lucide:trending-up" class="size-4 text-muted-foreground" />
                {{ REVENUE_MANAGEMENT_ADDON.name }}
              </p>
              <p class="mt-0.5 text-xs text-muted-foreground">
                Our revenue team sets and adjusts your nightly prices against demand and your
                comparable set, so you do not have to.
              </p>
            </div>
            <div class="shrink-0 sm:text-right">
              <p class="whitespace-nowrap text-sm font-bold tabular-nums text-foreground">
                {{ formatPrice(REVENUE_MANAGEMENT_ADDON.monthlyPerUnit) }}
                <span class="text-xs font-normal text-muted-foreground">/ unit / month</span>
              </p>
            </div>
          </div>
        </div>

        <!-- Per booking has no unit count above, so ask here. -->
        <div
          v-if="revenueManagement && pricingModel === 'per_booking'"
          class="flex items-center gap-3 border-t border-border/60 pt-3 pl-7"
          @click.stop
        >
          <Label for="ob-rm-units" class="text-xs font-semibold text-foreground whitespace-nowrap">
            Units to manage
          </Label>
          <Input
            id="ob-rm-units"
            v-model.number="unitCount"
            type="number"
            min="1"
            class="w-24 h-9 text-sm"
            inputmode="numeric"
          />
        </div>

        <p v-if="revenueManagement" class="border-t border-border/60 pt-3 pl-7 text-xs text-muted-foreground">
          {{ Math.max(1, unitCount) }} {{ Math.max(1, unitCount) === 1 ? 'unit' : 'units' }} ·
          <span class="font-semibold tabular-nums text-foreground">{{ formatPrice(addOnAmount) }}</span>
          billed {{ addOnCycle }}, on top of your plan.
        </p>
      </div>
    </section>

    <template v-if="pricingModel === 'per_unit'">
      <!-- Contract terms notice -->
      <div class="flex gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5">
        <Icon name="lucide:file-text" class="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-400" />
        <p class="text-xs leading-relaxed text-amber-900 dark:text-amber-200">
          Per unit plans run on a {{ PER_UNIT_CONTRACT_MONTHS }} month contract. Cancelling before the
          term ends means paying out the remaining months. Switch to per booking if you would rather
          not commit.
        </p>
      </div>
    </template>
    <template v-else>
      <div class="flex gap-2.5 rounded-xl border border-border/60 bg-muted/30 p-3.5">
        <Icon name="lucide:refresh-cw" class="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <p class="text-xs leading-relaxed text-muted-foreground">
          Auto refill keeps you running. We email a warning at {{ percent(PER_BOOKING_WARNING_THRESHOLD) }}
          of your quota remaining, and at {{ percent(PER_BOOKING_REFILL_THRESHOLD) }} we buy the same
          package again and charge your saved card.
        </p>
      </div>
    </template>

    <!-- ── Total ──────────────────────────────────────────────────────── -->
    <div class="rounded-xl border border-border/80 bg-muted/30 p-4">
      <dl class="space-y-1.5 text-sm">
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <dt class="font-semibold text-foreground">
            {{ planLabel }}
          </dt>
          <dd class="tabular-nums font-medium text-foreground">
            {{ formatPrice(planTotal) }}
          </dd>
        </div>
        <div v-if="revenueManagement" class="flex flex-wrap items-baseline justify-between gap-2">
          <dt class="text-muted-foreground">
            {{ REVENUE_MANAGEMENT_ADDON.name }}, billed {{ addOnCycle }}
          </dt>
          <dd class="tabular-nums font-medium text-foreground">
            {{ formatPrice(addOnAmount) }}
          </dd>
        </div>
        <div class="flex flex-wrap items-baseline justify-between gap-2 border-t border-border/60 pt-2">
          <dt class="font-semibold text-foreground">
            Total
          </dt>
          <dd class="text-xl font-bold tabular-nums text-foreground">
            {{ formatPrice(grandTotal) }}
          </dd>
        </div>
      </dl>
      <p v-if="pricingModel === 'per_unit' && perUnitBillable > unitCount" class="mt-2 text-xs text-muted-foreground">
        {{ perUnitPlan.name }} bills a minimum of {{ perUnitPlan.floor }} units, so you are charged for
        {{ perUnitBillable }} even though you run {{ unitCount }}.
      </p>
      <p class="mt-2 text-xs text-muted-foreground">
        <template v-if="pricingModel === 'per_unit'">
          Charged every {{ billingCycle === 'yearly' ? 'year' : 'month' }} until you cancel.
        </template>
        <template v-else-if="selectedPerBooking">
          Package paid once. Your quota never expires and there is no contract.
          {{ hasChannelManager(model) ? 'This rate includes channel connections from ELEV8.' : 'This rate is for running ELEV8 alongside your current system.' }}
          <template v-if="revenueManagement">
            Revenue Management is billed monthly.
          </template>
        </template>
      </p>
    </div>
  </form>
</template>
