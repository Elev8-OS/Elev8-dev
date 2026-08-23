<script setup lang="ts">
/**
 * Depth two of three.
 *
 * The row shows money and the one action. This panel shows why — the funnel per
 * channel, the gate it produces, both comp-set questions, the commercial stack
 * and the cost floor. The full evidence with every stamp lives on the finding
 * page, which is depth three.
 *
 * Reading order is the operator's, not the data's: action, then why, then
 * against whom, then what it costs.
 */
import type { RejectionReason, RoomDiagnosis } from '~/components/revenue/data/diagnosis'
import type { ApplyState, HealthFinding, HealthRoom, ObjectiveBasis } from '~/components/revenue/data/health'
import CompsetPanel from '~/components/revenue/CompsetPanel.vue'
import { contractLabels } from '~/components/revenue/data/diagnosis'
import FunnelPanel from '~/components/revenue/FunnelPanel.vue'
import GatePanel from '~/components/revenue/GatePanel.vue'
import HealthMoney from '~/components/revenue/HealthMoney.vue'
import MarginPanel from '~/components/revenue/MarginPanel.vue'
import PosturePanel from '~/components/revenue/PosturePanel.vue'
import RejectMenu from '~/components/revenue/RejectMenu.vue'
import { Button } from '~/components/ui/button'

const props = defineProps<{
  room: HealthRoom
  finding?: HealthFinding
  diagnosis?: RoomDiagnosis
  basis: ObjectiveBasis
  applyState: ApplyState
}>()

const emit = defineEmits<{
  apply: [findingId: string]
  reject: [payload: { findingId: string, reason: RejectionReason }]
}>()

const applied = computed(() => props.applyState !== 'idle')

/** A holdout room is never written to — that is what makes the control arm one. */
const blocked = computed(() => props.room.inHoldout)
</script>

<template>
  <div class="flex flex-col gap-4 bg-muted/20 px-4 py-5">
    <!-- 1 · the action -->
    <section
      v-if="finding"
      class="flex flex-col gap-3 rounded-lg border bg-background p-4 lg:flex-row lg:items-start lg:justify-between lg:gap-6"
    >
      <div class="flex flex-col gap-2 lg:flex-1">
        <p class="text-sm font-semibold leading-snug">
          {{ finding.headline }}
        </p>
        <p class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>{{ finding.windowLabel }}</span>
          <span>·</span>
          <span>confidence {{ Math.round(finding.confidence * 100) }}%</span>
          <span>·</span>
          <span>within {{ finding.autonomyBand }}</span>
          <span v-if="diagnosis">·</span>
          <span v-if="diagnosis">{{ contractLabels[diagnosis.contract] }}</span>
        </p>
        <ul class="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <li v-for="change in finding.changes" :key="change.label" class="tabular-nums">
            <span class="text-muted-foreground">{{ change.label }}</span>
            <span v-if="change.unchanged" class="ml-1.5 text-muted-foreground">{{ change.to }} · unchanged</span>
            <span v-else class="ml-1.5">{{ change.from }} → <span class="font-semibold">{{ change.to }}</span></span>
          </li>
        </ul>
      </div>

      <div class="flex flex-col items-start gap-2 lg:items-end">
        <HealthMoney :estimate="finding.money[basis]" :basis="basis" />
        <div class="flex flex-wrap items-center gap-2">
          <Button
            v-if="!applied"
            size="sm"
            :disabled="blocked"
            @click="emit('apply', finding.id)"
          >
            Accept
          </Button>
          <span v-else class="text-xs font-medium text-muted-foreground">
            {{ applyState.replace(/_/g, ' ') }}
          </span>
          <RejectMenu
            :disabled="applied"
            @reject="reason => emit('reject', { findingId: finding!.id, reason })"
          />
          <Button variant="ghost" size="sm" as-child>
            <NuxtLink :to="`/revenue/${finding.id}`">
              Full evidence
              <Icon name="lucide:arrow-right" class="size-3.5" />
            </NuxtLink>
          </Button>
        </div>
        <p v-if="blocked" class="text-xs text-muted-foreground">
          Holdout control arm — nothing is written here, so the measurement stays honest.
        </p>
      </div>
    </section>

    <template v-if="diagnosis">
      <!-- 2 · why -->
      <section class="flex flex-col gap-2">
        <h4 class="text-[11px] font-semibold tracking-[0.09em] text-muted-foreground uppercase">
          Funnel — per channel, not comparable across
        </h4>
        <div class="grid gap-3 lg:grid-cols-2">
          <FunnelPanel v-for="funnel in diagnosis.funnels" :key="funnel.channel" :funnel="funnel" />
        </div>
        <!-- Full width: the gate has to explain itself in prose, and prose
             needs a line length. In a third column it clipped. -->
        <GatePanel :gate="diagnosis.gate" />
      </section>

      <!-- 3 · against whom -->
      <section class="flex flex-col gap-2">
        <h4 class="text-[11px] font-semibold tracking-[0.09em] text-muted-foreground uppercase">
          Comp-set — two questions, two sources
        </h4>
        <CompsetPanel :compset="diagnosis.compset" :market="diagnosis.market" />
      </section>

      <!-- 4 · what it costs -->
      <section class="flex flex-col gap-2">
        <h4 class="text-[11px] font-semibold tracking-[0.09em] text-muted-foreground uppercase">
          Commercial posture and margin
        </h4>
        <div class="grid gap-3 xl:grid-cols-2">
          <PosturePanel :posture="diagnosis.posture" />
          <MarginPanel :margin="diagnosis.margin" :contract="diagnosis.contract" />
        </div>
      </section>

      <!-- One stamp per element. A single "last check" hides a real spread:
           the funnel is hours old, the comp-set a day, the cost basis a month. -->
      <p class="flex flex-wrap gap-x-3 gap-y-1 px-1 text-xs text-muted-foreground">
        <span v-for="(item, index) in diagnosis.freshness" :key="item.label">
          {{ item.label }} {{ item.observedAt }}<span v-if="index < diagnosis.freshness.length - 1" class="ml-3">·</span>
        </span>
      </p>
    </template>

    <p v-else class="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
      No diagnosis for this room yet — the signals a check needs are missing, so nothing is claimed here.
    </p>
  </div>
</template>
