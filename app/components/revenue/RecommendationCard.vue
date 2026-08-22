<script setup lang="ts">
import type { ApplyState, HealthFinding, HealthRoom, ObjectiveBasis } from '~/components/revenue/data/health'
import type { ApplyScenario } from '~/composables/useRevenueHealth'
import { computed } from 'vue'
import ApplyPipeline from '~/components/revenue/ApplyPipeline.vue'
import { domainLabels } from '~/components/revenue/data/health'
import EvidenceGroup from '~/components/revenue/EvidenceGroup.vue'
import HealthMoney from '~/components/revenue/HealthMoney.vue'
import HealthSeverityBadge from '~/components/revenue/HealthSeverityBadge.vue'
import { Button } from '~/components/ui/button'
import { Card } from '~/components/ui/card'
import { Progress } from '~/components/ui/progress'
import { Separator } from '~/components/ui/separator'

const props = defineProps<{
  finding: HealthFinding
  room?: HealthRoom
  basis: ObjectiveBasis
  applyState: ApplyState
}>()

const emit = defineEmits<{
  apply: [scenario: ApplyScenario]
  dismiss: []
  revert: []
}>()

const otherBasis = computed<ObjectiveBasis>(() => props.basis === 'revenue' ? 'margin' : 'revenue')
const confidenceSteps = computed(() => Math.round(props.finding.confidence * 4))
const isSettled = computed(() => props.applyState !== 'idle')
const actionable = computed(() => props.finding.changes.some(change => !change.unchanged))
</script>

<template>
  <Card class="overflow-hidden p-0">
    <!-- Head: money first, because it is the ranking metric and the reason to read on -->
    <div class="flex flex-col gap-5 border-b p-6 sm:flex-row sm:items-start sm:justify-between">
      <div class="min-w-0 flex-1">
        <div class="mb-3 flex flex-wrap items-center gap-2">
          <HealthSeverityBadge :severity="finding.severity" />
          <span class="text-xs font-medium text-muted-foreground">{{ domainLabels[finding.domain] }}</span>
          <span class="text-muted-foreground" aria-hidden="true">·</span>
          <span class="text-xs text-muted-foreground">{{ finding.windowLabel }}</span>
        </div>
        <h2 class="max-w-[46ch] text-xl leading-snug font-semibold tracking-tight">
          {{ finding.headline }}
        </h2>
        <p v-if="room" class="mt-2 text-sm text-muted-foreground">
          {{ room.name }} · {{ room.location }}
        </p>
      </div>

      <div class="flex shrink-0 flex-col gap-3 sm:items-end">
        <HealthMoney :estimate="finding.money[basis]" :basis="basis" size="lg" detail />
        <div class="flex items-center gap-2 rounded-md border bg-muted/40 px-2.5 py-1">
          <span class="text-xs font-medium text-muted-foreground">Confidence</span>
          <span class="flex items-center gap-0.5" aria-hidden="true">
            <span
              v-for="step in 4" :key="step"
              class="h-1 w-3.5 rounded-full"
              :class="step <= confidenceSteps ? 'bg-foreground' : 'bg-border'"
            />
          </span>
          <span class="text-xs font-semibold tabular-nums">{{ finding.confidence.toFixed(2) }}</span>
        </div>
      </div>
    </div>

    <!-- The change, before the argument -->
    <div class="border-b bg-muted/30 p-6">
      <h3 class="mb-4 text-[11px] font-semibold tracking-[0.09em] text-muted-foreground uppercase">
        The change
      </h3>
      <dl class="grid gap-x-10 gap-y-3 sm:grid-cols-2">
        <div
          v-for="change in finding.changes" :key="change.label"
          class="flex items-baseline justify-between gap-4 border-b pb-2 last:border-b-0"
        >
          <dt class="text-sm text-muted-foreground">
            {{ change.label }}
          </dt>
          <dd class="text-sm font-medium tabular-nums whitespace-nowrap">
            <template v-if="change.unchanged">
              <span class="text-muted-foreground">{{ change.to }} · unchanged</span>
            </template>
            <template v-else>
              <span class="text-muted-foreground line-through">{{ change.from }}</span>
              <span class="mx-1.5 text-muted-foreground" aria-hidden="true">→</span>
              <span class="font-semibold">{{ change.to }}</span>
            </template>
          </dd>
        </div>
        <div class="flex items-baseline justify-between gap-4">
          <dt class="text-sm text-muted-foreground">
            On the other basis
          </dt>
          <dd class="text-sm tabular-nums text-muted-foreground">
            <HealthMoney :estimate="finding.money[otherBasis]" :basis="otherBasis" size="sm" />
          </dd>
        </div>
      </dl>
    </div>

    <div class="flex flex-col lg:flex-row">
      <!-- The argument -->
      <div class="flex min-w-0 flex-1 flex-col gap-7 p-6">
        <EvidenceGroup
          title="Why — consolidated from four sources"
          tone="supporting"
          :items="finding.supporting"
        />
        <EvidenceGroup
          title="What argues against it"
          tone="against"
          :items="finding.against"
        />
        <EvidenceGroup
          title="What we could not see"
          tone="unknown"
          :notes="finding.unknowns"
        />
        <EvidenceGroup
          v-if="finding.agreement"
          title="Agreement"
          tone="agreement"
          :items="[finding.agreement]"
        />
      </div>

      <!-- Rail: constraint, actions, meta -->
      <div class="flex shrink-0 flex-col gap-5 border-t bg-muted/20 p-6 lg:w-[360px] lg:border-t-0 lg:border-l">
        <!-- Shown even when it passes: it is the part a pricing vendor cannot do -->
        <div v-if="finding.constraint" class="rounded-lg border border-warning/60 bg-warning/15 p-4">
          <p class="mb-2 flex items-center gap-2 text-[11px] font-semibold tracking-[0.07em] text-warning-foreground uppercase">
            <Icon name="lucide:check" class="size-3.5" />
            {{ finding.constraint.title }}
          </p>
          <p class="text-sm leading-relaxed">
            {{ finding.constraint.body }}
          </p>
          <template v-if="finding.constraint.utilisation !== undefined">
            <Progress :model-value="finding.constraint.utilisation" class="mt-3 h-1.5" />
            <div class="mt-1.5 flex justify-between text-xs text-muted-foreground">
              <span class="tabular-nums">{{ finding.constraint.utilisation }}% utilisation</span>
              <span>hard block at 100%</span>
            </div>
          </template>
        </div>

        <ApplyPipeline v-if="isSettled" :state="applyState" @revert="emit('revert')" />

        <div v-else class="flex flex-col gap-2.5">
          <Button class="w-full" :disabled="!actionable" @click="emit('apply', 'success')">
            Übernehmen
            <Icon name="lucide:arrow-right" class="size-4" />
          </Button>
          <div class="flex gap-2.5">
            <Button variant="outline" class="flex-1" disabled>
              Werte anpassen
            </Button>
            <Button variant="outline" class="flex-1" disabled>
              Nur Base Price
            </Button>
          </div>
          <Button variant="ghost" size="sm" class="w-full text-muted-foreground" @click="emit('dismiss')">
            Verwerfen …
          </Button>

          <!-- Fixture affordance: the failure paths are part of the design and need reviewing -->
          <div class="mt-1 flex flex-col gap-1.5 rounded-md border border-dashed p-2.5">
            <span class="text-[11px] font-medium text-muted-foreground">Preview a failure path</span>
            <div class="flex gap-2">
              <Button variant="ghost" size="sm" class="h-7 flex-1 text-xs" @click="emit('apply', 'recompute_unavailable')">
                No recalc
              </Button>
              <Button variant="ghost" size="sm" class="h-7 flex-1 text-xs" @click="emit('apply', 'push_failed')">
                Push fails
              </Button>
            </div>
          </div>
        </div>

        <Separator />

        <dl class="flex flex-col gap-2 text-xs text-muted-foreground">
          <div class="flex justify-between gap-3">
            <dt>Expires</dt>
            <dd class="text-foreground">
              in {{ finding.expiresInDays }} days
            </dd>
          </div>
          <div class="flex justify-between gap-3">
            <dt>Check</dt>
            <dd class="text-right text-foreground">
              {{ finding.checkKey }} v{{ finding.checkVersion }}
            </dd>
          </div>
          <div class="flex justify-between gap-3">
            <dt>Horizon band</dt>
            <dd class="text-right text-foreground">
              {{ finding.horizonBand }}
            </dd>
          </div>
          <div class="flex justify-between gap-3">
            <dt>Autonomy for this room</dt>
            <dd class="text-foreground">
              {{ finding.autonomyBand }} · {{ finding.acceptedCount }} accepted
            </dd>
          </div>
        </dl>
      </div>
    </div>
  </Card>
</template>
