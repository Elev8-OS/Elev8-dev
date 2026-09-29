<script setup lang="ts">
import type { Listing } from '~/components/listings/data/listings'
import { marginPerStay, ternPitchFor } from '~/components/damage-protection/data/tern-pitch'
import { formatProtectionAmount } from '~/components/reservations/data/damage-protection'
import { elev8CoverPartner } from '~/components/reservations/data/damage-protection-seed'
import { PAYOUT_SETTINGS_PATH } from '~/components/reservations/data/tern-activation'
import { useTernActivation } from '~/composables/useTernActivation'

/**
 * The pitch for VACATERN, shown to staff before the damage waiver is
 * activated. It leads with what the cover means for THIS listing in money:
 * a folio-style receipt of guest price, Tern's fee and what is left, then a
 * yearly estimate whose assumptions are printed beside it. Staff-facing only:
 * the guest never sees Tern's name or the word insurance. The copy follows
 * Tern's PMC product handbook; every figure is read, never typed here.
 */
const props = defineProps<{
  listing: Pick<Listing, 'name' | 'capacity' | 'stats' | 'bookings'>
  /** The listing's payout currency. Tern is only quoted where it prices that currency. */
  currency?: string | null
  /** The guest price of a waiver policy the listing already uses, if any. */
  guestPrice?: number | null
}>()

const emit = defineEmits<{ activate: [] }>()

const open = defineModel<boolean>('open', { required: true })

/** Activation needs a connected Stripe payout account: without one, the way forward is Payouts. */
const tern = useTernActivation()

const pitch = computed(() => ternPitchFor(props.listing, props.currency ?? 'USD', props.guestPrice))

/** A price to try out, not a setting: the real one is set on the policy. */
const tryPrice = ref<number>(0)
watch([open, pitch], () => {
  if (open.value && pitch.value)
    tryPrice.value = pitch.value.suggestedGuestPrice
}, { immediate: true })

function setTryPrice(value: string | number) {
  const parsed = Number(value)
  tryPrice.value = Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

const margin = computed(() => pitch.value ? marginPerStay(tryPrice.value, pitch.value.perStayFee) : 0)
const perYear = computed(() => pitch.value ? margin.value * pitch.value.staysPerYear * pitch.value.packagesPerStay : 0)

function money(amount: number): string {
  return formatProtectionAmount(Math.abs(amount), pitch.value?.currency ?? 'USD')
}

function nightsLabel(avg: number): string {
  const rounded = Math.round(avg * 10) / 10
  return `${rounded}-night`
}

const COVERED = [
  {
    icon: 'lucide:armchair',
    title: 'Guest damage',
    text: 'Repair or replacement of furnishings, fixtures and the owner\'s things a guest breaks during a stay.',
  },
  {
    icon: 'lucide:scale',
    title: 'Host liability',
    text: 'Third-party injury or property damage arising from a booking, with legal defence and medical expenses.',
  },
  {
    icon: 'lucide:bug',
    title: 'Bed bugs',
    text: 'Extermination, new soft furnishings, somewhere else for the guest to stay, and the rent lost meanwhile.',
  },
]

/**
 * Opening focus goes to the call to action, not the first field: landing on the
 * price input selects its value and reads as if something must be typed first.
 */
const activateButton = ref<{ $el?: HTMLElement } | null>(null)
function focusActivate(event: Event) {
  event.preventDefault()
  activateButton.value?.$el?.focus()
}

function activate() {
  open.value = false
  emit('activate')
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent
      class="flex max-h-[90vh] flex-col gap-0 p-0 sm:max-w-3xl"
      data-testid="tern-promo"
      @open-auto-focus="focusActivate"
    >
      <!-- Everything scrolls but the buttons, so Activate is always in reach. -->
      <div class="min-h-0 flex-1 overflow-y-auto">
        <!-- What this listing gets, in one sentence -->
        <DialogHeader class="gap-3 border-b p-6 text-left sm:p-8">
          <p class="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Icon name="lucide:shield-check" class="size-3.5 text-primary" />
            Elev8 Cover
          </p>
          <DialogTitle class="max-w-[30ch] text-2xl leading-tight font-semibold tracking-tight text-balance">
            <template v-if="pitch">
              Cover every stay here up to {{ money(pitch.coverageCap) }}
            </template>
            <template v-else>
              Cover every stay against guest damage
            </template>
          </DialogTitle>
          <DialogDescription class="max-w-[62ch] text-sm leading-relaxed">
            <template v-if="pitch">
              {{ listing.name }} sleeps {{ listing.capacity }}, so it takes Elev8 Cover {{ pitch.tierName }}.
            </template>
            Elev8 attaches the cover to every booking on the listings you choose. Owner stays are never included.
          </DialogDescription>
        </DialogHeader>

        <div class="grid gap-8 p-6 sm:p-8" :class="pitch ? 'md:grid-cols-[1fr_minmax(0,20rem)]' : ''">
          <!-- What is covered: one program, three parts -->
          <section aria-labelledby="tern-covered">
            <h3 id="tern-covered" class="text-sm font-medium">
              What's covered
            </h3>
            <ul class="mt-4 flex flex-col gap-5">
              <li v-for="item in COVERED" :key="item.title" class="flex gap-3">
                <Icon :name="item.icon" class="mt-0.5 size-5 shrink-0 text-primary" />
                <div>
                  <p class="text-sm font-medium">
                    {{ item.title }}
                  </p>
                  <p class="mt-0.5 max-w-[48ch] text-sm leading-relaxed text-muted-foreground">
                    {{ item.text }}
                  </p>
                </div>
              </li>
            </ul>
            <p class="mt-6 max-w-[48ch] text-sm leading-relaxed text-muted-foreground">
              A claim starts from the photos in the housekeeper's cleaning report. Our insurance partner pays it by bank transfer.
            </p>
          </section>

          <!-- The folio: what one stay earns, then a year of them -->
          <section
            v-if="pitch"
            aria-labelledby="tern-receipt"
            class="order-first flex flex-col self-start rounded-lg bg-muted p-5 md:order-none"
            data-testid="tern-promo-receipt"
          >
            <h3 id="tern-receipt" class="text-sm font-medium">
              What one stay earns you
            </h3>

            <dl class="mt-4 flex flex-col gap-3 text-sm tabular-nums">
              <div class="flex items-center justify-between gap-3">
                <dt>
                  <Label for="tern-try-price" class="font-normal">Guest pays</Label>
                </dt>
                <dd class="relative w-36 shrink-0">
                  <span class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-xs text-muted-foreground">
                    {{ pitch.currency }}
                  </span>
                  <Input
                    id="tern-try-price"
                    type="number"
                    min="0"
                    step="1"
                    inputmode="decimal"
                    class="h-8 [appearance:textfield] bg-background pl-14 text-right tabular-nums [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    :model-value="tryPrice"
                    data-testid="tern-promo-price"
                    @update:model-value="setTryPrice"
                  />
                </dd>
              </div>
              <div class="flex items-baseline justify-between gap-3">
                <dt class="text-muted-foreground">
                  Elev8 Cover {{ pitch.tierName }} fee
                </dt>
                <dd class="text-muted-foreground">
                  &minus; {{ money(pitch.perStayFee) }}
                </dd>
              </div>
              <div class="flex items-baseline justify-between gap-3 border-t border-foreground/15 pt-3 font-medium">
                <dt>{{ margin >= 0 ? 'You keep, per 30 nights' : 'You pay, per 30 nights' }}</dt>
                <dd data-testid="tern-promo-margin">
                  {{ money(margin) }}
                </dd>
              </div>
            </dl>

            <div class="mt-6 border-t-2 border-double border-foreground/20 pt-4" aria-live="polite">
              <p class="text-sm text-muted-foreground">
                {{ margin >= 0 ? 'In a year, about' : 'It costs you about' }}
              </p>
              <p class="mt-1 text-4xl leading-none font-semibold tracking-tight tabular-nums" data-testid="tern-promo-year">
                {{ money(perYear) }}
              </p>
              <p class="mt-3 text-xs leading-relaxed text-muted-foreground">
                From about {{ pitch.staysPerYear }} stays a year: {{ pitch.occupancyPct }}% occupancy and
                {{ nightsLabel(pitch.avgNights) }} stays on average. You set the real price on the policy after activating.
              </p>
            </div>
          </section>
        </div>

        <p class="max-w-[72ch] px-6 pb-6 text-xs leading-relaxed text-muted-foreground sm:px-8 sm:pb-8">
          Claims are paid above a
          {{ formatProtectionAmount(elev8CoverPartner.deductiblePerClaim, elev8CoverPartner.currency) }} deductible.
          Wear and tear is not covered. Elev8 Cover comes on top of the owner's homeowner's insurance and does not replace
          it. Guests are offered a damage waiver, never insurance.
        </p>
      </div>

      <DialogFooter class="flex-row flex-wrap items-center justify-end gap-2 border-t px-6 py-4 sm:px-8">
        <p
          v-if="!tern.hasStripePayout.value"
          class="flex basis-full items-start gap-1.5 text-sm text-muted-foreground sm:mr-auto sm:basis-auto"
          data-testid="tern-promo-no-stripe"
        >
          <Icon name="lucide:info" class="mt-0.5 size-4 shrink-0" />
          First, connect a Stripe payout account.
        </p>
        <Button variant="ghost" data-testid="tern-promo-dismiss" @click="open = false">
          Not now
        </Button>
        <NuxtLink v-if="!tern.hasStripePayout.value" :to="PAYOUT_SETTINGS_PATH" @click="open = false">
          <Button ref="activateButton" class="gap-1.5" data-testid="tern-promo-connect-stripe">
            <Icon name="lucide:landmark" class="size-4" />
            Connect Stripe
          </Button>
        </NuxtLink>
        <Button v-else ref="activateButton" class="gap-1.5" data-testid="tern-promo-activate" @click="activate">
          <Icon name="lucide:shield-check" class="size-4" />
          Activate damage waiver
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
