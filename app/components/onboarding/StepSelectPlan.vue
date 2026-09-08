<script setup lang="ts">
import type { BillingCycle, PricingModel } from '~/components/onboarding/data/onboarding'
import {
  billableUnits,
  formatUsd,
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
} from '~/components/onboarding/data/onboarding'

const emit = defineEmits<{ (e: 'next'): void, (e: 'back'): void }>()

const { state, selectPlan } = useOnboarding()

const model = computed(() => state.value.pmsModel!)
const pricingModel = ref<PricingModel>(state.value.subscription.pricingModel ?? 'per_unit')
const billingCycle = ref<BillingCycle>(state.value.subscription.billingCycle ?? 'monthly')
const unitCount = ref(state.value.subscription.unitCount || 1)
const perBookingCode = ref(
  state.value.subscription.pricingModel === 'per_booking' ? state.value.subscription.planCode : null,
)

/** The tier follows the unit count, so a tenant cannot pick a plan they do not fit. */
const perUnitPlan = computed(() => perUnitPlanForUnits(Math.max(1, unitCount.value)))
const perUnitBillable = computed(() => billableUnits(Math.max(1, unitCount.value), perUnitPlan.value))
const perUnitTotal = computed(() => perUnitAmount(Math.max(1, unitCount.value), perUnitPlan.value, billingCycle.value))

const selectedPerBooking = computed(() =>
  PER_BOOKING_PLANS.find(p => p.code === perBookingCode.value) ?? null)

const canContinue = computed(() =>
  pricingModel.value === 'per_unit' ? unitCount.value >= 1 : Boolean(perBookingCode.value))

const percent = (n: number) => `${Math.round(n * 100)}%`

function submit(): void {
  if (!canContinue.value)
    return
  selectPlan({
    pricingModel: pricingModel.value,
    planCode: pricingModel.value === 'per_unit' ? perUnitPlan.value.code : perBookingCode.value!,
    billingCycle: billingCycle.value,
    unitCount: Math.max(1, unitCount.value),
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
      <TabsContent value="per_unit" class="mt-4 flex flex-col gap-4">
        <div class="flex flex-wrap items-end gap-4">
          <div class="grid gap-1.5">
            <Label for="ob-units" class="text-xs font-medium">How many units do you run?</Label>
            <Input
              id="ob-units"
              v-model.number="unitCount"
              type="number"
              min="1"
              class="w-32"
              inputmode="numeric"
            />
            <p class="text-[11px] text-muted-foreground">
              One unit is one room or property.
            </p>
          </div>
          <div class="grid gap-1.5">
            <Label for="ob-cycle" class="text-xs font-medium">Billing cycle</Label>
            <Tabs id="ob-cycle" v-model="billingCycle">
              <TabsList>
                <TabsTrigger value="monthly">
                  Monthly
                </TabsTrigger>
                <TabsTrigger value="yearly">
                  Yearly (Save ~8%)
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div
            v-for="plan in PER_UNIT_PLANS"
            :key="plan.code"
            class="flex flex-col rounded-xl border p-4 shadow-xs transition-all"
            :class="plan.code === perUnitPlan.code ? 'border-primary ring-2 ring-primary/20 bg-primary/5' : 'border-border/80 bg-card'"
          >
            <div class="flex items-center justify-between">
              <p class="text-sm font-semibold text-foreground">
                {{ plan.name }}
              </p>
              <Badge v-if="plan.code === perUnitPlan.code" variant="default" class="text-[10px] px-1.5 py-0">
                Your tier
              </Badge>
            </div>
            <p class="mt-0.5 text-xs text-muted-foreground">
              {{ plan.minUnits }}{{ plan.maxUnits ? ` to ${plan.maxUnits}` : ' or more' }} units
            </p>
            <p class="mt-3 text-2xl font-bold tabular-nums text-foreground">
              {{ formatUsd(perUnitRate(plan, billingCycle)) }}
            </p>
            <p class="text-xs text-muted-foreground">
              per unit / month
            </p>
            <dl class="mt-3 space-y-1.5 border-t border-border/60 pt-2.5 text-xs text-muted-foreground">
              <div class="flex justify-between gap-2">
                <dt>Monthly rate</dt>
                <dd class="tabular-nums font-medium text-foreground">
                  {{ formatUsd(plan.monthly) }}
                </dd>
              </div>
              <div class="flex justify-between gap-2">
                <dt>Yearly rate</dt>
                <dd class="tabular-nums font-medium text-foreground">
                  {{ formatUsd(plan.yearly) }}
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

        <div class="rounded-xl border border-border/80 bg-muted/30 p-4">
          <div class="flex flex-wrap items-baseline justify-between gap-2">
            <p class="text-sm font-semibold text-foreground">
              {{ perUnitPlan.name }}, {{ perUnitBillable }} {{ perUnitBillable === 1 ? 'unit' : 'units' }} billed {{ billingCycle }}
            </p>
            <p class="text-xl font-bold tabular-nums text-foreground">
              {{ formatUsd(perUnitTotal) }}
            </p>
          </div>
          <p v-if="perUnitBillable > unitCount" class="mt-1 text-xs text-muted-foreground">
            {{ perUnitPlan.name }} bills a minimum of {{ perUnitPlan.floor }} units, so you are charged for
            {{ perUnitBillable }} even though you run {{ unitCount }}.
          </p>
          <p class="mt-1 text-xs text-muted-foreground">
            Charged every {{ billingCycle === 'yearly' ? 'year' : 'month' }} until you cancel.
          </p>
        </div>

        <!-- Contract terms notice -->
        <div class="flex gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5">
          <Icon name="lucide:file-text" class="mt-0.5 size-4 shrink-0 text-amber-700" />
          <p class="text-xs leading-relaxed text-amber-900">
            Per unit plans run on a {{ PER_UNIT_CONTRACT_MONTHS }} month contract. Cancelling before the
            term ends means paying out the remaining months. Switch to per booking if you would rather
            not commit.
          </p>
        </div>
      </TabsContent>

      <!-- ── Per booking ──────────────────────────────────────────────── -->
      <TabsContent value="per_booking" class="mt-4 flex flex-col gap-4">
        <div class="grid gap-3 sm:grid-cols-3">
          <button
            v-for="plan in PER_BOOKING_PLANS"
            :key="plan.code"
            type="button"
            class="flex flex-col rounded-xl border p-4 text-left transition-all hover:border-primary/60 cursor-pointer shadow-xs"
            :class="perBookingCode === plan.code ? 'border-primary ring-2 ring-primary/20 bg-primary/5' : 'border-border/80 bg-card'"
            :aria-pressed="perBookingCode === plan.code"
            @click="perBookingCode = plan.code"
          >
            <div class="flex items-start justify-between gap-2">
              <p class="text-sm font-semibold text-foreground">
                {{ plan.name }}
              </p>
              <span
                class="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors"
                :class="perBookingCode === plan.code ? 'border-primary bg-primary text-primary-foreground' : 'border-input'"
              >
                <Icon v-if="perBookingCode === plan.code" name="lucide:check" class="size-3" />
              </span>
            </div>
            <p class="mt-0.5 text-xs text-muted-foreground">
              {{ plan.quota.toLocaleString('en-US') }} bookings, prepaid
            </p>
            <p class="mt-3 text-2xl font-bold tabular-nums text-foreground">
              {{ formatUsd(perBookingRate(plan, model)) }}
            </p>
            <p class="text-xs text-muted-foreground">
              per booking
            </p>
            <p class="mt-3 border-t border-border/60 pt-2 text-xs">
              <span class="text-muted-foreground">Package total: </span>
              <span class="ml-1 font-semibold tabular-nums text-foreground">{{ formatUsd(perBookingAmount(plan, model)) }}</span>
            </p>
          </button>
        </div>

        <div v-if="selectedPerBooking" class="rounded-xl border border-border/80 bg-muted/30 p-4">
          <div class="flex flex-wrap items-baseline justify-between gap-2">
            <p class="text-sm font-semibold text-foreground">
              {{ selectedPerBooking.name }}, {{ selectedPerBooking.quota.toLocaleString('en-US') }} bookings
            </p>
            <p class="text-xl font-bold tabular-nums text-foreground">
              {{ formatUsd(perBookingAmount(selectedPerBooking, model)) }}
            </p>
          </div>
          <p class="mt-1 text-xs text-muted-foreground">
            Paid once. Your quota never expires and there is no contract.
            {{ hasChannelManager(model) ? 'This rate includes channel connections from ELEV8.' : 'This rate is for running ELEV8 alongside your current system.' }}
          </p>
        </div>

        <div class="flex gap-2.5 rounded-xl border border-border/60 bg-muted/30 p-3.5">
          <Icon name="lucide:refresh-cw" class="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <p class="text-xs leading-relaxed text-muted-foreground">
            Auto refill keeps you running. We email a warning at {{ percent(PER_BOOKING_WARNING_THRESHOLD) }}
            of your quota remaining, and at {{ percent(PER_BOOKING_REFILL_THRESHOLD) }} we buy the same
            package again and charge your saved card.
          </p>
        </div>
      </TabsContent>
    </Tabs>
  </form>
</template>
