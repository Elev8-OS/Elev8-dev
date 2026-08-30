<script setup lang="ts">
import type { CancellationPolicy, CancellationPolicyConfig, RefundTier } from '~/components/listings/data/listings'
import { cancellationPolicyOptions, defaultCancellationTiers } from '~/components/listings/data/listings'

const model = defineModel<CancellationPolicyConfig>('config', { required: true })

const config = computed(() => model.value)

function setPolicy(policy: CancellationPolicy) {
  const next: CancellationPolicyConfig = {
    ...model.value,
    policy,
    refundTiers: [...model.value.refundTiers],
  }
  if (policy === 'custom' && next.refundTiers.length === 0)
    next.refundTiers = defaultCancellationTiers()
  model.value = next
}

function addTier() {
  const last = model.value.refundTiers.at(-1)
  const tier: RefundTier = {
    id: `rt-${Date.now()}`,
    percent: Math.max(0, (last?.percent ?? 100) - 25),
    days: Math.max(0, (last?.days ?? 7) - 1),
  }
  model.value = { ...model.value, refundTiers: [...model.value.refundTiers, tier] }
}

function removeTier(id: string) {
  model.value = { ...model.value, refundTiers: model.value.refundTiers.filter(t => t.id !== id) }
}

function patchTier(id: string, patch: Partial<RefundTier>) {
  model.value = {
    ...model.value,
    refundTiers: model.value.refundTiers.map(t => t.id === id ? { ...t, ...patch } : t),
  }
}

function setFreeCancellationHours(hours: number) {
  model.value = { ...model.value, freeCancellationHours: Math.max(0, hours || 0) }
}

function setTerms(terms: string) {
  model.value = { ...model.value, terms }
}

const sortedTiers = computed(() =>
  [...config.value.refundTiers].sort((a, b) => b.days - a.days),
)

const summary = computed(() => {
  const lines = sortedTiers.value.map(t =>
    `${t.percent}% refund if cancelled ${t.days} day${t.days === 1 ? '' : 's'} before check-in`,
  )
  if (lines.length > 0)
    lines.push('0% refund if cancelled within the final cancellation window')
  if (config.value.freeCancellationHours > 0)
    lines.push(`Free cancellation within ${config.value.freeCancellationHours} hours of booking`)
  return lines
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- Policy preset + custom settings -->
    <div class="flex flex-col gap-4 rounded-lg border bg-muted/20 p-3">
      <div class="flex flex-col gap-2">
        <Label>Cancellation Policy</Label>
        <Select :model-value="config.policy" @update:model-value="(v) => setPolicy(String(v) as CancellationPolicy)">
          <SelectTrigger class="h-9 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="p in cancellationPolicyOptions" :key="p.value" :value="p.value">
              {{ p.label }}
            </SelectItem>
          </SelectContent>
        </Select>
        <p class="text-xs text-muted-foreground leading-relaxed">
          {{ cancellationPolicyOptions.find(p => p.value === config.policy)?.description }}
        </p>
      </div>

      <template v-if="config.policy === 'custom'">
        <!-- Refund schedule -->
        <div class="flex flex-col gap-2 border-t pt-4">
          <div>
            <h4 class="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Refund Schedule
            </h4>
            <p class="text-[11px] text-muted-foreground mt-0.5">
              Guests get the first refund whose deadline they still meet.
            </p>
          </div>

          <div class="flex flex-col gap-2">
            <div
              v-for="(tier, index) in sortedTiers"
              :key="tier.id"
              class="rounded-lg border p-3"
            >
              <div class="flex items-start justify-between gap-2">
                <div class="flex flex-col gap-2 flex-1 min-w-0">
                  <!-- Refund % -->
                  <div class="flex items-center gap-2">
                    <span class="w-24 shrink-0 text-xs text-muted-foreground">Refund</span>
                    <div class="flex items-center gap-1.5">
                      <Input
                        type="number"
                        :model-value="tier.percent"
                        min="0"
                        max="100"
                        class="h-8 w-16 text-sm text-right"
                        @update:model-value="(v) => patchTier(tier.id, { percent: Math.min(100, Math.max(0, Number(v) || 0)) })"
                      />
                      <span class="text-sm text-muted-foreground shrink-0">%</span>
                    </div>
                  </div>

                  <!-- Deadline -->
                  <div class="flex items-center gap-2">
                    <span class="w-24 shrink-0 text-xs text-muted-foreground">If cancelled</span>
                    <div class="flex items-center gap-1.5">
                      <Input
                        type="number"
                        :model-value="tier.days"
                        min="0"
                        class="h-8 w-16 text-sm text-right"
                        @update:model-value="(v) => patchTier(tier.id, { days: Math.max(0, Number(v) || 0) })"
                      />
                      <span class="text-xs text-muted-foreground shrink-0">days or more before check-in</span>
                    </div>
                  </div>

                  <!-- Hours equivalent -->
                  <div class="flex items-center gap-2">
                    <span class="w-24 shrink-0" />
                    <span class="text-[11px] text-muted-foreground">= {{ tier.days * 24 }} hours</span>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  class="h-7 w-7 p-0 shrink-0"
                  :disabled="config.refundTiers.length <= 1"
                  :title="`Remove tier ${index + 1}`"
                  @click="removeTier(tier.id)"
                >
                  <Icon name="lucide:x" class="size-3.5 text-muted-foreground" />
                </Button>
              </div>
            </div>
          </div>

          <Button variant="outline" size="sm" class="w-fit gap-1.5" @click="addTier">
            <Icon name="lucide:plus" class="size-3.5" />
            Add a refund tier
          </Button>

          <div class="flex items-start gap-2 rounded-lg bg-muted/40 p-3">
            <Icon name="lucide:info" class="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
            <p class="text-[11px] text-muted-foreground leading-relaxed">
              0% refund for any later cancellation. Applies from the last deadline right up to check-in.
            </p>
          </div>
        </div>

        <!-- Free cancellation window -->
        <div class="flex flex-col gap-2 rounded-lg border p-3">
          <Label>Free Cancellation Window</Label>
          <div class="flex items-center gap-2">
            <Input
              type="number"
              :model-value="config.freeCancellationHours"
              min="0"
              class="h-8 w-16 text-sm text-right"
              @update:model-value="(v) => setFreeCancellationHours(Number(v))"
            />
            <span class="text-xs text-muted-foreground">hours after booking</span>
          </div>
          <p class="text-[11px] text-muted-foreground leading-relaxed">
            Guests who cancel within this window of booking are refunded in full, whatever the schedule says.
          </p>
        </div>

        <!-- Policy terms -->
        <div class="flex flex-col gap-1.5">
          <Label>Policy Terms</Label>
          <Textarea
            :model-value="config.terms"
            rows="4"
            maxlength="5000"
            placeholder="Add any additional terms guests should know about cancellations..."
            @update:model-value="(v) => setTerms(String(v))"
          />
          <span class="text-[10px] text-muted-foreground self-end">
            {{ config.terms.length }}/5000 characters
          </span>
        </div>

        <!-- Summary -->
        <div class="flex flex-col gap-2 rounded-lg border p-3">
          <div class="flex items-center gap-1.5">
            <Icon name="lucide:list-checks" class="size-3.5 text-muted-foreground" />
            <span class="text-xs font-medium">Refund schedule preview</span>
          </div>
          <ul v-if="summary.length > 0" class="flex flex-col gap-1 pl-5">
            <li v-for="line in summary" :key="line" class="list-disc text-[11px] text-muted-foreground">
              {{ line }}
            </li>
          </ul>
          <p v-else class="text-[11px] text-muted-foreground italic">
            No refund tiers configured.
          </p>
        </div>
      </template>
    </div>
  </div>
</template>
