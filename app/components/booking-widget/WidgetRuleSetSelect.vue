<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { ruleSetSummary } from '~/components/channels/data/website-channel'
import { useWebsiteChannel } from '~/composables/useWebsiteChannel'

withDefaults(defineProps<{ ownLabel?: string }>(), { ownLabel: 'This widget\'s own rules' })

/** Picks the Website rule set a widget follows, or the widget's own rules (null). */
const model = defineModel<string | null>({ default: null })

const { websiteChannel, hydrate } = useWebsiteChannel()
onMounted(hydrate)

const OWN = '__own'

const available = computed(() => websiteChannel.value.enabled ? websiteChannel.value.ruleSets : [])
const picked = computed(() => available.value.find(r => r.id === model.value) ?? null)
// A set deleted on /channels: the widget is back on its own rules, say so instead of showing a blank select.
const missing = computed(() => model.value !== null && picked.value === null)

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
function days(list: number[]) {
  return list.length ? list.map(d => DAYS[d]).join(', ') : 'Any day'
}
</script>

<template>
  <div class="space-y-3" data-testid="widget-rule-set">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-2">
        <Icon name="lucide:globe" class="size-4 text-muted-foreground" aria-hidden="true" />
        <Label for="widget-rule-set" class="text-sm font-normal">Booking rules</Label>
      </div>
      <Select :model-value="picked ? picked.id : OWN" :disabled="available.length === 0" @update:model-value="(v) => model = v === OWN ? null : String(v)">
        <SelectTrigger id="widget-rule-set" class="w-64">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem :value="OWN">
            {{ ownLabel }}
          </SelectItem>
          <SelectItem v-for="set in available" :key="set.id" :value="set.id">
            Website: {{ set.name }}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>

    <p v-if="available.length === 0" class="text-xs text-muted-foreground">
      Add the Website channel with a rule set to share discounts and stay rules with your websites.
      <NuxtLink to="/channels" class="text-primary hover:underline">
        Open Channels
      </NuxtLink>
    </p>

    <p v-else-if="missing" class="text-xs text-warning-foreground">
      The rule set this widget used was deleted, so it follows its own rules again.
    </p>

    <div v-if="picked" class="space-y-1.5 rounded-lg bg-muted/60 p-3 text-sm" data-testid="widget-rule-set-summary">
      <p class="font-medium">
        {{ ruleSetSummary(picked) }}
      </p>
      <ul class="space-y-0.5 text-xs text-muted-foreground">
        <li v-for="tier in picked.lengthOfStayDiscounts" :key="tier.id">
          From {{ tier.minNights }} nights: {{ tier.pct }}% off
        </li>
        <li v-if="picked.earlyBird.enabled">
          Early bird: {{ picked.earlyBird.pct }}% off when booked {{ picked.earlyBird.days }}+ days ahead
        </li>
        <li v-if="picked.lastMinute.enabled">
          Last minute: {{ picked.lastMinute.pct }}% off within {{ picked.lastMinute.days }} days of arrival
        </li>
        <li>Stay {{ picked.minNights }}{{ picked.maxNights ? ` to ${picked.maxNights}` : '+' }} nights, book {{ picked.minDaysBeforeArrival }} days ahead</li>
        <li>Arrivals: {{ days(picked.arrivalDays) }}. Departures: {{ days(picked.departureDays) }}</li>
        <li>Prepayment: {{ picked.prepaymentPct }}% at booking</li>
      </ul>
      <NuxtLink to="/channels" class="text-xs text-primary hover:underline">
        Edit on the Channels page
      </NuxtLink>
    </div>
  </div>
</template>
