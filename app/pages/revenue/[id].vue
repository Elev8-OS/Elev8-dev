<script setup lang="ts">
import type { ApplyScenario } from '~/composables/useRevenueHealth'
import { computed } from 'vue'
import { toast } from 'vue-sonner'
import { domainLabels } from '~/components/revenue/data/health'
import HealthMoney from '~/components/revenue/HealthMoney.vue'
import HealthSeverityBadge from '~/components/revenue/HealthSeverityBadge.vue'
import RecommendationCard from '~/components/revenue/RecommendationCard.vue'
import { Button } from '~/components/ui/button'
import { Card } from '~/components/ui/card'
import { useRevenueHealth } from '~/composables/useRevenueHealth'

definePageMeta({ layout: 'default' })

const route = useRoute()
const router = useRouter()

const {
  basis,
  getFinding,
  getRoom,
  findingsForRoom,
  applyStateFor,
  applyFinding,
  revertFinding,
  dismissFinding,
} = useRevenueHealth()

const findingId = computed(() => String(route.params.id))
const finding = computed(() => getFinding(findingId.value))
const room = computed(() => finding.value ? getRoom(finding.value.roomId) : undefined)
const applyState = computed(() => applyStateFor(findingId.value))

/** Other open findings on the same room, so the operator can work a room through. */
const siblings = computed(() => {
  if (!finding.value)
    return []
  return findingsForRoom(finding.value.roomId).filter(item => item.id !== finding.value?.id)
})

function onApply(scenario: ApplyScenario) {
  applyFinding(findingId.value, scenario)
  if (scenario === 'success')
    toast.success('Applied — writing to the pricing engine')
}

function onRevert() {
  revertFinding(findingId.value)
  toast.info('Reverted to the previous settings')
}

function onDismiss() {
  dismissFinding(findingId.value)
  toast.info('Finding dismissed')
  router.push('/revenue')
}
</script>

<template>
  <div class="flex flex-col gap-5 p-4 lg:p-6">
    <NuxtLink to="/revenue" class="flex w-fit items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
      <Icon name="lucide:chevron-left" class="size-3.5" />
      Listing health
      <template v-if="room">
        <span aria-hidden="true">/</span>
        <span>{{ room.name }}</span>
      </template>
    </NuxtLink>

    <template v-if="finding">
      <RecommendationCard
        :finding="finding"
        :room="room"
        :basis="basis"
        :apply-state="applyState"
        @apply="onApply"
        @revert="onRevert"
        @dismiss="onDismiss"
      />

      <section v-if="siblings.length" class="flex flex-col gap-2.5">
        <h2 class="px-1 text-[11px] font-semibold tracking-[0.09em] text-muted-foreground uppercase">
          Also open on this listing
        </h2>
        <Card
          v-for="sibling in siblings" :key="sibling.id"
          class="cursor-pointer flex-row items-center gap-4 p-4 transition-colors hover:bg-muted/40"
          @click="router.push(`/revenue/${sibling.id}`)"
        >
          <HealthSeverityBadge :severity="sibling.severity" />
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium">
              {{ sibling.headline }}
            </p>
            <p class="mt-0.5 text-xs text-muted-foreground">
              {{ domainLabels[sibling.domain] }} · {{ sibling.windowLabel }}
            </p>
          </div>
          <HealthMoney :estimate="sibling.money[basis]" :basis="basis" />
          <Icon name="lucide:chevron-right" class="size-4 shrink-0 text-muted-foreground" />
        </Card>
      </section>
    </template>

    <Card v-else class="flex flex-col items-center gap-3 p-12 text-center">
      <Icon name="lucide:search-x" class="size-8 text-muted-foreground" />
      <div>
        <p class="font-medium">
          This finding is no longer available
        </p>
        <p class="mt-1 text-sm text-muted-foreground">
          It may have expired, been applied, or been dismissed.
        </p>
      </div>
      <Button variant="outline" @click="router.push('/revenue')">
        Back to listing health
      </Button>
    </Card>
  </div>
</template>
