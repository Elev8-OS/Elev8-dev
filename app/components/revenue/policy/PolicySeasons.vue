<script setup lang="ts">
import type { PolicyIssue, PricingPolicy, Season } from '~/components/revenue/data/revenue-policy'
import { computed } from 'vue'
import { addDays, isoDate, newId, parseIsoDate, seasonOverlaps } from '~/components/revenue/data/revenue-policy'
import PolicySection from '~/components/revenue/policy/PolicySection.vue'
import ProviderSupportBadge from '~/components/revenue/policy/ProviderSupportBadge.vue'
import RevenueNumberField from '~/components/revenue/policy/RevenueNumberField.vue'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'

const props = defineProps<{ issues: PolicyIssue[], canCopy: boolean }>()
const emit = defineEmits<{ copy: [] }>()
const policy = defineModel<PricingPolicy>('policy', { required: true })

const MONTHS = 12
const today = new Date()
const timelineStart = new Date(today.getFullYear(), today.getMonth(), 1)
const timelineEnd = new Date(today.getFullYear(), today.getMonth() + MONTHS, 1)
const totalDays = Math.round((timelineEnd.getTime() - timelineStart.getTime()) / 86_400_000)

const months = Array.from({ length: MONTHS }, (_, i) => {
  const d = new Date(timelineStart.getFullYear(), timelineStart.getMonth() + i, 1)
  return d.toLocaleDateString('en-GB', { month: 'short' })
})

const overlaps = computed(() => seasonOverlaps(policy.value.seasons))
const overlapping = computed(() => new Set(overlaps.value.flatMap(([a, b]) => [a.id, b.id])))

function offsetPct(date: Date): number {
  const days = (date.getTime() - timelineStart.getTime()) / 86_400_000
  return Math.min(100, Math.max(0, (days / totalDays) * 100))
}

/** Each season's bar on the 12-month timeline; seasons outside it are left off. */
const bars = computed(() => policy.value.seasons
  .filter(s => s.from && s.to && s.from <= s.to)
  .map((s, i) => {
    const left = offsetPct(parseIsoDate(s.from))
    const right = offsetPct(addDays(parseIsoDate(s.to), 1))
    return { season: s, left, width: right - left, lane: i % 3 }
  })
  .filter(b => b.width > 0))

const todayPct = offsetPct(today)

function issueFor(id: string) {
  return props.issues.find(i => i.field === `season-${id}`)?.message ?? null
}

/** A new season starts the day after the latest one ends, so it never overlaps on arrival. */
function addSeason() {
  const lastEnd = policy.value.seasons.map(s => s.to).filter(Boolean).sort().at(-1)
  const from = lastEnd ? addDays(parseIsoDate(lastEnd), 1) : addDays(today, 30)
  const season: Season = { id: newId('season'), label: `Season ${policy.value.seasons.length + 1}`, from: isoDate(from), to: isoDate(addDays(from, 30)), adjustPct: 20, minStay: null, minPrice: null }
  policy.value = { ...policy.value, seasons: [...policy.value.seasons, season] }
}

function patchSeason(id: string, patch: Partial<Season>) {
  policy.value = { ...policy.value, seasons: policy.value.seasons.map(s => s.id === id ? { ...s, ...patch } : s) }
}

function removeSeason(id: string) {
  policy.value = { ...policy.value, seasons: policy.value.seasons.filter(s => s.id !== id) }
}

function formatShort(value: string) {
  return parseIsoDate(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
</script>

<template>
  <PolicySection
    title="Seasons"
    description="Named date ranges with their own adjustment, minimum stay and floor."
    :summary="policy.seasons.length ? `${policy.seasons.length} season${policy.seasons.length === 1 ? '' : 's'}` : 'None set'"
    test-id="policy-seasons"
  >
    <template #badges>
      <ProviderSupportBadge section="seasons" />
    </template>

    <!-- 12-month timeline -->
    <div class="flex flex-col gap-1.5" data-testid="season-timeline">
      <div class="relative h-[4.5rem] rounded-md border bg-muted/30">
        <div
          v-for="bar in bars"
          :key="bar.season.id"
          class="absolute flex h-5 items-center overflow-hidden rounded px-1.5 text-[11px] font-medium whitespace-nowrap"
          :class="overlapping.has(bar.season.id)
            ? 'bg-destructive/15 text-destructive ring-1 ring-destructive'
            : bar.season.adjustPct >= 0 ? 'bg-primary/15 text-primary' : 'bg-muted-foreground/15 text-muted-foreground'"
          :style="{ left: `${bar.left}%`, width: `${Math.max(bar.width, 0.8)}%`, top: `${0.5 + bar.lane * 1.35}rem` }"
          :title="`${bar.season.label}: ${formatShort(bar.season.from)} to ${formatShort(bar.season.to)}`"
        >
          {{ bar.season.label }}
        </div>
        <div class="absolute inset-y-0 w-px bg-foreground/40" :style="{ left: `${todayPct}%` }" aria-hidden="true" />
      </div>
      <div class="grid text-[10px] text-muted-foreground" :style="{ gridTemplateColumns: `repeat(${MONTHS}, minmax(0, 1fr))` }">
        <span v-for="(month, i) in months" :key="i">{{ month }}</span>
      </div>
    </div>

    <div v-if="overlaps.length" class="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive" data-testid="season-overlap">
      <Icon name="lucide:triangle-alert" class="mt-0.5 size-3.5 shrink-0" />
      <div>
        <p v-for="([a, b], i) in overlaps" :key="i">
          "{{ a.label }}" and "{{ b.label }}" overlap. On shared nights, "{{ b.label }}" wins because it is lower in the list.
        </p>
      </div>
    </div>

    <div v-for="season in policy.seasons" :key="season.id" class="flex flex-col gap-3 rounded-md border p-3" :class="issueFor(season.id) ? 'border-destructive' : ''">
      <div class="grid gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
        <div class="flex flex-col gap-1">
          <Label class="text-xs text-muted-foreground">Name</Label>
          <Input :model-value="season.label" class="h-9" @update:model-value="patchSeason(season.id, { label: String($event) })" />
        </div>
        <div class="flex flex-col gap-1">
          <Label class="text-xs text-muted-foreground">From</Label>
          <Input type="date" :model-value="season.from" class="h-9" @update:model-value="patchSeason(season.id, { from: String($event) })" />
        </div>
        <div class="flex flex-col gap-1">
          <Label class="text-xs text-muted-foreground">To</Label>
          <Input type="date" :model-value="season.to" class="h-9" @update:model-value="patchSeason(season.id, { to: String($event) })" />
        </div>
        <Button variant="ghost" size="icon" class="size-9 self-end" :aria-label="`Remove ${season.label}`" @click="removeSeason(season.id)">
          <Icon name="lucide:trash-2" class="size-4" />
        </Button>
      </div>
      <div class="grid gap-3 sm:grid-cols-3">
        <div class="flex flex-col gap-1">
          <Label class="text-xs text-muted-foreground">Adjustment</Label>
          <RevenueNumberField :model-value="season.adjustPct" suffix="%" aria-label="Season adjustment" @update:model-value="patchSeason(season.id, { adjustPct: $event ?? 0 })" />
        </div>
        <div class="flex flex-col gap-1">
          <Label class="text-xs text-muted-foreground">Minimum stay</Label>
          <RevenueNumberField :model-value="season.minStay" suffix="nights" :min="1" nullable placeholder="Default" aria-label="Season minimum stay" @update:model-value="patchSeason(season.id, { minStay: $event })" />
        </div>
        <div class="flex flex-col gap-1">
          <Label class="text-xs text-muted-foreground">Floor</Label>
          <RevenueNumberField :model-value="season.minPrice" :prefix="policy.currency" :min="0" nullable placeholder="Default" aria-label="Season floor" @update:model-value="patchSeason(season.id, { minPrice: $event })" />
        </div>
      </div>
      <p v-if="issueFor(season.id)" class="text-xs text-destructive">
        {{ issueFor(season.id) }}
      </p>
    </div>

    <div class="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" class="gap-1.5" @click="addSeason">
        <Icon name="lucide:plus" class="size-3.5" />
        Add season
      </Button>
      <Button v-if="canCopy" variant="ghost" size="sm" class="gap-1.5" :disabled="policy.seasons.length === 0" @click="emit('copy')">
        <Icon name="lucide:copy" class="size-3.5" />
        Copy to other rooms
      </Button>
    </div>
  </PolicySection>
</template>
