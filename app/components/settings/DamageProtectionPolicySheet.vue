<script setup lang="ts">
import type { DamageProtectionPolicy, ProtectionCurrency } from '~/components/reservations/data/damage-protection'
import type { DepositPricing, WaiverPricing } from '~/components/reservations/data/reservations'
import { toast } from 'vue-sonner'
import ProtectionOptionCards from '~/components/damage-protection/ProtectionOptionCards.vue'
import { buildOptions, bumpTermsVersion, newPolicyDraft, policyErrors } from '~/components/reservations/data/damage-protection'
import { useDamageProtection } from '~/composables/useDamageProtection'

/**
 * Edit one damage protection policy, or create one. Works on a DRAFT: nothing
 * reaches the policy until Save, and Cancel throws the draft away. Bookings
 * that already accepted a policy keep what they agreed to either way.
 */
const props = defineProps<{
  /** The policy to edit; null creates a new one. */
  policy: DamageProtectionPolicy | null
  /** Whether any listing uses this policy for long stays: those need ceilings and a wear and tear exclusion. */
  usedForLongStays?: boolean
}>()

const open = defineModel<boolean>('open', { required: true })

const dp = useDamageProtection()

const draft = ref<DamageProtectionPolicy>(newPolicyDraft('USD'))
const newExclusion = ref('')
const showErrors = ref(false)

const isNew = computed(() => props.policy === null)

watch(open, (isOpen) => {
  if (!isOpen)
    return
  draft.value = props.policy ? JSON.parse(JSON.stringify(props.policy)) : newPolicyDraft('USD')
  newExclusion.value = ''
  showErrors.value = false
})

const CHANNELS = ['Direct', 'Airbnb', 'Booking.com'] as const
const CURRENCIES: ProtectionCurrency[] = ['USD', 'IDR', 'EUR', 'CHF']

const WAIVER_PRICING: { value: WaiverPricing, label: string }[] = [
  { value: 'flat', label: 'Per stay' },
  { value: 'per_night', label: 'Per night' },
  { value: 'percent_of_subtotal', label: '% of the stay' },
]
const DEPOSIT_PRICING: { value: DepositPricing, label: string }[] = [
  { value: 'flat', label: 'Fixed amount' },
  { value: 'percent_of_subtotal', label: '% of the stay' },
]

function offers(option: 'waiver' | 'deposit'): boolean {
  return draft.value.offers.includes(option)
}

function setOffer(option: 'waiver' | 'deposit', on: boolean) {
  const next = new Set(draft.value.offers)
  if (on)
    next.add(option)
  else
    next.delete(option)
  // Keep the order the guest sees: waiver first.
  draft.value = { ...draft.value, offers: (['waiver', 'deposit'] as const).filter(o => next.has(o)) }
}

function setChannel(channel: typeof CHANNELS[number], on: boolean) {
  draft.value = { ...draft.value, channelPolicy: { ...draft.value.channelPolicy, [channel]: on ? 'offer' : 'skip' } }
}

function addExclusion() {
  const text = newExclusion.value.trim()
  if (!text || draft.value.waiver.exclusions.includes(text))
    return
  draft.value.waiver.exclusions = [...draft.value.waiver.exclusions, text]
  newExclusion.value = ''
}

function removeExclusion(text: string) {
  draft.value.waiver.exclusions = draft.value.waiver.exclusions.filter(e => e !== text)
}

const termsChanged = computed(() => !isNew.value && draft.value.termsText !== props.policy?.termsText)
const nextVersion = computed(() => bumpTermsVersion(draft.value.termsVersion))

const errors = computed(() => policyErrors(draft.value, Boolean(props.usedForLongStays)))

/** The same builder the guest screen uses, for a sample 5-night stay on a Stripe listing. */
const preview = computed(() => buildOptions(draft.value, { nights: 5, priceDetails: { subtotal: 1000 } }, 'card'))

function save() {
  showErrors.value = true
  if (errors.value.length)
    return
  const toSave: DamageProtectionPolicy = {
    ...draft.value,
    // Changed wording is a new version, so the bookings that accepted the old
    // words stay distinguishable. Nobody has to remember to bump it.
    termsVersion: termsChanged.value ? nextVersion.value : draft.value.termsVersion,
    waiver: {
      ...draft.value.waiver,
      maxAmount: draft.value.waiver.pricing === 'flat' ? undefined : draft.value.waiver.maxAmount,
    },
    deposit: {
      ...draft.value.deposit,
      maxAmount: draft.value.deposit.pricing === 'flat' ? undefined : draft.value.deposit.maxAmount,
    },
  }
  dp.savePolicy(toSave)
  toast.success(isNew.value ? 'Policy created. Assign it to listings in the Listings tab.' : 'Policy saved')
  open.value = false
}
</script>

<template>
  <Sheet v-model:open="open">
    <SheetContent side="right" class="flex w-full flex-col gap-0 p-0 sm:max-w-2xl" data-testid="policy-sheet">
      <SheetHeader class="border-b px-6 py-4">
        <SheetTitle>{{ isNew ? 'New policy' : `Edit ${policy?.name}` }}</SheetTitle>
        <SheetDescription>
          What guests can choose before they arrive. Bookings that already accepted this policy keep what they agreed to.
        </SheetDescription>
      </SheetHeader>

      <div class="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        <div class="flex flex-col gap-6">
          <!-- Name and currency -->
          <div class="grid gap-3 sm:grid-cols-[1fr_8rem]">
            <div class="flex flex-col gap-1.5">
              <Label for="policy-name">Policy name</Label>
              <Input id="policy-name" v-model="draft.name" placeholder="Standard stay" />
            </div>
            <div class="flex flex-col gap-1.5">
              <Label>Currency</Label>
              <Select v-if="isNew" v-model="draft.currency">
                <SelectTrigger data-testid="policy-currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="c in CURRENCIES" :key="c" :value="c">
                    {{ c }}
                  </SelectItem>
                </SelectContent>
              </Select>
              <p v-else class="flex h-9 items-center text-sm text-muted-foreground">
                {{ draft.currency }}
              </p>
            </div>
          </div>

          <!-- What guests can choose -->
          <section class="flex flex-col gap-3">
            <p class="text-sm font-medium">
              What guests can choose
            </p>

            <!-- Waiver -->
            <div class="flex flex-col gap-3 rounded-lg border p-4" data-testid="policy-waiver">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <p class="text-sm font-medium">
                    Damage waiver
                  </p>
                  <p class="text-xs text-muted-foreground">
                    The guest pays a fee and is not charged for accidental damage, up to the cover.
                  </p>
                </div>
                <Switch
                  id="policy-offer-waiver"
                  aria-label="Offer the damage waiver"
                  :model-value="offers('waiver')"
                  @update:model-value="(v) => setOffer('waiver', v)"
                />
              </div>
              <template v-if="offers('waiver')">
                <div class="grid gap-3 sm:grid-cols-3">
                  <div class="flex flex-col gap-1.5">
                    <Label>Fee is charged</Label>
                    <Select v-model="draft.waiver.pricing">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem v-for="p in WAIVER_PRICING" :key="p.value" :value="p.value">
                          {{ p.label }}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div class="flex flex-col gap-1.5">
                    <Label for="policy-waiver-rate">
                      {{ draft.waiver.pricing === 'percent_of_subtotal' ? 'Fee (%)' : `Fee (${draft.currency})` }}
                    </Label>
                    <Input id="policy-waiver-rate" v-model.number="draft.waiver.rate" type="number" min="0" />
                  </div>
                  <div class="flex flex-col gap-1.5">
                    <Label for="policy-waiver-cap">Covers up to ({{ draft.currency }})</Label>
                    <Input id="policy-waiver-cap" v-model.number="draft.waiver.coverageCap" type="number" min="0" />
                  </div>
                </div>
                <div v-if="draft.waiver.pricing !== 'flat'" class="flex flex-col gap-1.5 sm:max-w-[33%]">
                  <Label for="policy-waiver-max">Highest fee ({{ draft.currency }})</Label>
                  <Input id="policy-waiver-max" v-model.number="draft.waiver.maxAmount" type="number" min="0" placeholder="No limit" />
                </div>
                <div class="flex flex-col gap-1.5">
                  <Label for="policy-exclusion">Not covered</Label>
                  <ul v-if="draft.waiver.exclusions.length" class="flex flex-col gap-1">
                    <li
                      v-for="exclusion in draft.waiver.exclusions"
                      :key="exclusion"
                      class="flex items-center justify-between gap-2 rounded-md border px-2.5 py-1 text-sm"
                    >
                      <span>{{ exclusion }}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        class="size-6 shrink-0 hover:text-destructive"
                        :aria-label="`Remove ${exclusion}`"
                        @click="removeExclusion(exclusion)"
                      >
                        <Icon name="lucide:x" class="size-3.5" />
                      </Button>
                    </li>
                  </ul>
                  <div class="flex gap-2">
                    <Input
                      id="policy-exclusion"
                      v-model="newExclusion"
                      placeholder="For example: damage caused by pets"
                      @keydown.enter.prevent="addExclusion"
                    />
                    <Button variant="outline" @click="addExclusion">
                      Add
                    </Button>
                  </div>
                </div>
              </template>
            </div>

            <!-- Deposit -->
            <div class="flex flex-col gap-3 rounded-lg border p-4" data-testid="policy-deposit">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <p class="text-sm font-medium">
                    Security deposit (card on file)
                  </p>
                  <p class="text-xs text-muted-foreground">
                    The guest saves a card. Nothing is charged unless there is damage. Only offered on Stripe listings.
                  </p>
                </div>
                <Switch
                  id="policy-offer-deposit"
                  aria-label="Offer the security deposit"
                  :model-value="offers('deposit')"
                  @update:model-value="(v) => setOffer('deposit', v)"
                />
              </div>
              <div v-if="offers('deposit')" class="grid gap-3 sm:grid-cols-3">
                <div class="flex flex-col gap-1.5">
                  <Label>Limit is</Label>
                  <Select v-model="draft.deposit.pricing">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem v-for="p in DEPOSIT_PRICING" :key="p.value" :value="p.value">
                        {{ p.label }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div class="flex flex-col gap-1.5">
                  <Label for="policy-deposit-rate">
                    {{ draft.deposit.pricing === 'percent_of_subtotal' ? 'Card can be charged up to (%)' : `Card can be charged up to (${draft.currency})` }}
                  </Label>
                  <Input id="policy-deposit-rate" v-model.number="draft.deposit.rate" type="number" min="0" />
                </div>
                <div class="flex flex-col gap-1.5">
                  <Label for="policy-deposit-days">Decide within (days after check-out)</Label>
                  <Input id="policy-deposit-days" v-model.number="draft.deposit.settleWithinDays" type="number" min="1" />
                </div>
                <div v-if="draft.deposit.pricing !== 'flat'" class="flex flex-col gap-1.5">
                  <Label for="policy-deposit-max">Highest limit ({{ draft.currency }})</Label>
                  <Input id="policy-deposit-max" v-model.number="draft.deposit.maxAmount" type="number" min="0" placeholder="No limit" />
                </div>
              </div>
            </div>
          </section>

          <!-- Channels -->
          <section class="flex flex-col gap-2">
            <p class="text-sm font-medium">
              Booking channels
            </p>
            <div class="flex flex-wrap gap-5">
              <div v-for="channel in CHANNELS" :key="channel" class="flex items-center gap-2">
                <Switch
                  :id="`policy-channel-${channel}`"
                  :model-value="draft.channelPolicy[channel] === 'offer'"
                  @update:model-value="(v) => setChannel(channel, v)"
                />
                <Label :for="`policy-channel-${channel}`" class="text-sm font-normal">{{ channel }}</Label>
              </div>
            </div>
            <p class="text-xs text-muted-foreground">
              Guests are only asked on the channels you turn on. Airbnb and Booking.com run their own damage programmes,
              so they are usually left off.
            </p>
          </section>

          <!-- Terms -->
          <section class="flex flex-col gap-1.5">
            <Label for="policy-terms" class="text-sm font-medium">Terms the guest accepts</Label>
            <Textarea id="policy-terms" v-model="draft.termsText" rows="4" />
            <p class="text-xs text-muted-foreground" data-testid="policy-terms-version">
              <template v-if="termsChanged">
                Saving will create terms version {{ nextVersion }}. Guests who accepted {{ draft.termsVersion }} keep it.
              </template>
              <template v-else>
                Version {{ draft.termsVersion }}. Changing the wording creates a new version automatically.
              </template>
            </p>
          </section>

          <!-- Preview -->
          <section class="flex flex-col gap-2">
            <p class="text-sm font-medium">
              What guests see
            </p>
            <p class="text-xs text-muted-foreground">
              For a sample 5-night stay. The waiver is always shown first and pre-selected.
            </p>
            <ProtectionOptionCards v-if="preview.length" :options="preview" :selectable="false" />
            <p v-else class="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
              Turn on the waiver or the deposit to see the preview.
            </p>
          </section>
        </div>
      </div>

      <div class="flex flex-col gap-3 border-t px-6 py-4">
        <ul v-if="showErrors && errors.length" class="flex flex-col gap-1 text-sm text-destructive" data-testid="policy-errors">
          <li v-for="error in errors" :key="error">
            {{ error }}
          </li>
        </ul>
        <div class="flex justify-end gap-2">
          <Button variant="outline" @click="open = false">
            Cancel
          </Button>
          <Button data-testid="policy-save" @click="save">
            {{ isNew ? 'Create policy' : 'Save changes' }}
          </Button>
        </div>
      </div>
    </SheetContent>
  </Sheet>
</template>
