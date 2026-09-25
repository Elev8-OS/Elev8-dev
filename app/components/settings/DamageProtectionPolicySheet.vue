<script setup lang="ts">
import type { DamageProtectionPolicy, PolicyTemplateId, ProtectionCurrency } from '~/components/reservations/data/damage-protection'
import type { DepositPricing } from '~/components/reservations/data/reservations'
import type { TernTier } from '~/components/reservations/data/tern-products'
import { toast } from 'vue-sonner'
import ProtectionOptionCards from '~/components/damage-protection/ProtectionOptionCards.vue'
import {
  buildOptions,
  bumpTermsVersion,
  channelsSelectable,
  formatProtectionAmount,
  newPolicyDraft,
  POLICY_TEMPLATES,
  policyErrors,
  policyFromTemplate,
  waiverCover,
  waiverExclusions,
} from '~/components/reservations/data/damage-protection'
import { TERN_PRODUCTS, ternPriceFor, ternSizeLabel } from '~/components/reservations/data/tern-products'
import { useDamageProtection } from '~/composables/useDamageProtection'

/**
 * Edit one damage protection policy, or create one from a template. Works on a
 * DRAFT: nothing reaches the policy until Save, and Cancel throws the draft
 * away. Bookings that already accepted a policy keep what they agreed to.
 *
 * ⚠️ The tenant never types a cover amount or an exclusion: those come from the
 * Tern tier. The one waiver number here is what the tenant charges the guest,
 * shown beside the fixed fee Elev8 charges them per stay.
 */
// ⚠️ `guestPaid` defaults to TRUE explicitly: Vue turns an absent boolean prop
// into false, which would silently stop asking a new policy for a guest price.
const props = withDefaults(defineProps<{
  /** The policy to edit; null creates a new one. */
  policy: DamageProtectionPolicy | null
  /** Whether any listing uses this policy for long stays: those need a ceiling on a percent deposit. */
  usedForLongStays?: boolean
  /** False when every listing using it is host-paid: no guest price is charged there. */
  guestPaid?: boolean
}>(), { usedForLongStays: false, guestPaid: true })

const open = defineModel<boolean>('open', { required: true })

const dp = useDamageProtection()

const draft = ref<DamageProtectionPolicy>(newPolicyDraft('USD'))
const saveRefusal = ref('')
const showErrors = ref(false)

const isNew = computed(() => props.policy === null)

/**
 * ⚠️ The waiver cannot be switched ON before the damage waiver is activated:
 * a waiver policy made then could only ever sit paused. A policy that already
 * offers it can still be edited (and switched off and on again); it stays
 * paused. `savePolicy` refuses the same thing, this is the screen saying so.
 */
const waiverLocked = computed(() =>
  !dp.waiverServiceActive.value && !props.policy?.offers.includes('waiver'))

function freshDraft(): DamageProtectionPolicy {
  // Before activation the only template that can be saved is Deposit only.
  return waiverLocked.value ? policyFromTemplate('deposit_only', 'USD') : newPolicyDraft('USD')
}

watch(open, (isOpen) => {
  if (!isOpen)
    return
  draft.value = props.policy ? JSON.parse(JSON.stringify(props.policy)) : freshDraft()
  showErrors.value = false
  saveRefusal.value = ''
})

/** New policies start from a template; picking another replaces the draft, keeping the currency. */
function templateLocked(templateId: PolicyTemplateId): boolean {
  return waiverLocked.value && Boolean(POLICY_TEMPLATES.find(t => t.id === templateId)?.offers.includes('waiver'))
}

function applyTemplate(templateId: PolicyTemplateId) {
  if (templateLocked(templateId))
    return
  draft.value = { ...policyFromTemplate(templateId, draft.value.currency), id: draft.value.id }
}

function setCurrency(currency: unknown) {
  if (typeof currency !== 'string')
    return
  const guestPrice = draft.value.templateId
    ? POLICY_TEMPLATES.find(t => t.id === draft.value.templateId)?.guestPrice[currency as ProtectionCurrency] ?? 0
    : draft.value.waiver.guestPrice
  draft.value = { ...draft.value, currency: currency as ProtectionCurrency, waiver: { ...draft.value.waiver, guestPrice } }
}

function setTier(tier: TernTier) {
  if (!ternPriceFor(tier, draft.value.currency))
    return
  draft.value = { ...draft.value, waiver: { ...draft.value.waiver, tier } }
}

const cover = computed(() => waiverCover(draft.value))
const exclusions = computed(() => waiverExclusions(draft.value))
/** What the tenant keeps per guest-paid stay. Same currency by construction: Tern prices each currency itself. */
const margin = computed(() => cover.value ? draft.value.waiver.guestPrice - cover.value.perStayFee : null)
const channelsLocked = computed(() => !channelsSelectable(draft.value))

const CHANNELS = ['Direct', 'Airbnb', 'Booking.com'] as const
const CURRENCIES: ProtectionCurrency[] = ['USD', 'IDR', 'EUR', 'CHF']

const DEPOSIT_PRICING: { value: DepositPricing, label: string }[] = [
  { value: 'flat', label: 'Fixed amount' },
  { value: 'percent_of_subtotal', label: '% of the stay' },
]

function offers(option: 'waiver' | 'deposit'): boolean {
  return draft.value.offers.includes(option)
}

function setOffer(option: 'waiver' | 'deposit', on: boolean) {
  if (option === 'waiver' && on && waiverLocked.value)
    return
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

const termsChanged = computed(() => !isNew.value && draft.value.termsText !== props.policy?.termsText)
const nextVersion = computed(() => bumpTermsVersion(draft.value.termsVersion))

const errors = computed(() => policyErrors(draft.value, {
  longStay: props.usedForLongStays,
  guestPaid: props.guestPaid,
}))

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
    deposit: {
      ...draft.value.deposit,
      maxAmount: draft.value.deposit.pricing === 'flat' ? undefined : draft.value.deposit.maxAmount,
    },
  }
  const result = dp.savePolicy(toSave)
  if (!result.ok) {
    saveRefusal.value = result.reason === 'waiver_not_activated'
      ? 'Activate the damage waiver first, at the top of the Damage protection page, to offer it in a policy.'
      : `Could not save the policy (${result.reason.replace(/_/g, ' ')})`
    return
  }
  saveRefusal.value = ''
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
              <Select v-if="isNew" :model-value="draft.currency" @update:model-value="setCurrency">
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

          <!-- Templates: a complete policy to start from, so a tenant assigns rather than builds -->
          <section v-if="isNew" class="flex flex-col gap-2" data-testid="policy-templates">
            <p class="text-sm font-medium">
              Start from a template
            </p>
            <div class="grid gap-2 sm:grid-cols-3">
              <button
                v-for="template in POLICY_TEMPLATES"
                :key="template.id"
                type="button"
                class="flex flex-col gap-1 rounded-lg border p-3 text-left transition-colors"
                :class="[
                  draft.templateId === template.id ? 'border-primary ring-1 ring-primary' : '',
                  templateLocked(template.id) ? 'cursor-not-allowed opacity-50' : 'hover:border-primary/60',
                ]"
                :aria-pressed="draft.templateId === template.id"
                :disabled="templateLocked(template.id)"
                data-testid="policy-template"
                @click="applyTemplate(template.id)"
              >
                <span class="text-sm font-medium">{{ template.name }}</span>
                <span class="text-xs text-muted-foreground">{{ template.summary }}</span>
                <span v-if="templateLocked(template.id)" class="text-xs text-amber-700 dark:text-amber-400">
                  Needs the damage waiver activated
                </span>
              </button>
            </div>
          </section>

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
                    Accidental damage is covered up to the Tern cover. Applies to every booking, on every channel.
                  </p>
                </div>
                <Switch
                  id="policy-offer-waiver"
                  aria-label="Offer the damage waiver"
                  :model-value="offers('waiver')"
                  :disabled="waiverLocked"
                  @update:model-value="(v) => setOffer('waiver', v)"
                />
              </div>
              <p v-if="waiverLocked" class="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400" data-testid="policy-waiver-locked">
                <Icon name="lucide:lock" class="mt-0.5 size-3 shrink-0" />
                Activate the damage waiver first, at the top of the Damage protection page. Until then a policy can offer
                the deposit only.
              </p>
              <p
                v-else-if="!dp.waiverServiceActive.value && offers('waiver')"
                class="text-xs text-amber-700 dark:text-amber-400"
              >
                Paused until the damage waiver is activated. Guests are not asked in the meantime.
              </p>
              <template v-if="offers('waiver')">
                <!-- The cover is a Tern product. The tenant picks a tier and never types an amount. -->
                <div class="flex flex-col gap-1.5">
                  <p class="text-sm">
                    Cover, provided by Tern through Elev8
                  </p>
                  <div class="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Tern cover">
                    <button
                      v-for="product in TERN_PRODUCTS"
                      :key="product.tier"
                      type="button"
                      role="radio"
                      class="flex flex-col gap-0.5 rounded-lg border p-3 text-left transition-colors"
                      :class="[
                        draft.waiver.tier === product.tier ? 'border-primary ring-1 ring-primary' : '',
                        ternPriceFor(product.tier, draft.currency) ? 'hover:border-primary/60' : 'cursor-not-allowed opacity-50',
                      ]"
                      :aria-checked="draft.waiver.tier === product.tier"
                      :disabled="!ternPriceFor(product.tier, draft.currency)"
                      :data-testid="`policy-tier-${product.tier}`"
                      @click="setTier(product.tier)"
                    >
                      <span class="text-sm font-medium">{{ product.name }}</span>
                      <span class="text-xs text-muted-foreground">{{ ternSizeLabel(product) }}</span>
                      <template v-if="ternPriceFor(product.tier, draft.currency)">
                        <span class="mt-1 text-sm tabular-nums">
                          Covers {{ formatProtectionAmount(ternPriceFor(product.tier, draft.currency)!.coverageCap, draft.currency) }}
                        </span>
                        <span class="text-xs text-muted-foreground tabular-nums">
                          Elev8 charges {{ formatProtectionAmount(ternPriceFor(product.tier, draft.currency)!.perStayFee, draft.currency) }} per stay
                        </span>
                      </template>
                      <span v-else class="mt-1 text-xs text-muted-foreground">Not available in {{ draft.currency }} yet</span>
                    </button>
                  </div>
                </div>

                <div class="grid gap-3 sm:grid-cols-2">
                  <div class="flex flex-col gap-1.5">
                    <Label for="policy-guest-price">You charge the guest, per stay ({{ draft.currency }})</Label>
                    <Input id="policy-guest-price" v-model.number="draft.waiver.guestPrice" type="number" min="0" />
                  </div>
                  <div v-if="cover" class="flex flex-col justify-end gap-0.5 text-sm" data-testid="policy-fee-readout">
                    <p class="tabular-nums">
                      Elev8 charges you {{ formatProtectionAmount(cover.perStayFee, draft.currency) }} per covered stay
                    </p>
                    <p
                      v-if="margin !== null && draft.waiver.guestPrice > 0"
                      class="text-xs tabular-nums"
                      :class="margin < 0 ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground'"
                    >
                      {{ margin < 0
                        ? `You would collect ${formatProtectionAmount(-margin, draft.currency)} less per stay than Elev8 charges you.`
                        : `You keep ${formatProtectionAmount(margin, draft.currency)} per guest-paid stay.` }}
                    </p>
                  </div>
                </div>
                <p class="text-xs text-muted-foreground">
                  On a listing where you pay for the cover, the guest is not asked and pays nothing. Elev8 charges you the same fee per stay.
                </p>

                <div class="flex flex-col gap-1.5">
                  <p class="text-sm">
                    Not covered <span class="text-xs text-muted-foreground">(set by Tern)</span>
                  </p>
                  <ul class="flex flex-col gap-1 text-xs text-muted-foreground" data-testid="policy-exclusions">
                    <li v-for="exclusion in exclusions" :key="exclusion">
                      {{ exclusion }}
                    </li>
                  </ul>
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
                  :model-value="channelsLocked || draft.channelPolicy[channel] === 'offer'"
                  :disabled="channelsLocked"
                  @update:model-value="(v) => setChannel(channel, v)"
                />
                <Label :for="`policy-channel-${channel}`" class="text-sm font-normal">{{ channel }}</Label>
              </div>
            </div>
            <p class="text-xs text-muted-foreground" data-testid="policy-channels-note">
              <template v-if="channelsLocked">
                The waiver covers every booking, so it runs on every channel, and so does the deposit beside it.
                Owner stays are never included.
              </template>
              <template v-else>
                A deposit-only policy asks guests only on the channels you turn on. Airbnb and Booking.com run their own
                damage programmes, so they are usually left off.
              </template>
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
        <p v-if="saveRefusal" class="text-sm text-destructive" data-testid="policy-save-refused">
          {{ saveRefusal }}
        </p>
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
