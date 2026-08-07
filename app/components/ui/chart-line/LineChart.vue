<script setup lang="ts" generic="T extends Record<string, any>">
import type { BulletLegendItemInterface } from '@unovis/ts'
import type { Component } from 'vue'
import type { BaseChartProps } from '.'
import { Axis, CurveType, Line } from '@unovis/ts'

import { VisAxis, VisLine, VisXYContainer } from '@unovis/vue'
import { useMounted } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import { ChartCrosshair, ChartLegend, defaultColors } from '@/components/ui/chart'
import { cn } from '@/lib/utils'

const props = withDefaults(defineProps<BaseChartProps<T> & {
  /**
   * Render custom tooltip component.
   */
  customTooltip?: Component
  /**
   * Type of curve
   */
  curveType?: CurveType
  /**
   * Optional human-readable labels for legend items, keyed by category name.
   * Falls back to the raw category name when missing.
   */
  legendLabels?: Record<string, string>
}>(), {
  curveType: CurveType.MonotoneX,
  filterOpacity: 0.2,
  margin: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  showXAxis: true,
  showYAxis: true,
  showTooltip: true,
  showLegend: true,
  showGridLine: true,
  legendLabels: () => ({}),
})

const emits = defineEmits<{
  legendItemClick: [d: BulletLegendItemInterface, i: number]
}>()

type KeyOfT = Extract<keyof T, string>
type Data = typeof props.data[number]

const index = computed(() => props.index as KeyOfT)
const colors = computed(() => props.colors?.length ? props.colors : defaultColors(props.categories.length))

const legendItems = ref<BulletLegendItemInterface[]>(props.categories.map((category, i) => ({
  name: props.legendLabels?.[category] ?? category,
  color: colors.value[i],
  inactive: false,
})))

// Rebuild legend names when labels change (e.g. comparison mode switch)
watch(() => props.legendLabels, () => {
  props.categories.forEach((category, i) => {
    if (legendItems.value[i]) {
      legendItems.value[i] = { ...legendItems.value[i]!, name: props.legendLabels?.[category] ?? category }
    }
  })
})

const isMounted = useMounted()

function handleLegendItemClick(d: BulletLegendItemInterface, i: number) {
  emits('legendItemClick', d, i)
}
</script>

<template>
  <div :class="cn('w-full h-[400px] flex flex-col items-end', $attrs.class ?? '')">
    <ChartLegend v-if="showLegend" v-model:items="legendItems" @legend-item-click="handleLegendItemClick" />

    <VisXYContainer
      :margin="{ left: 20, right: 20 }"
      :data="data"
      :style="{ height: isMounted ? '100%' : 'auto' }"
    >
      <ChartCrosshair v-if="showTooltip" :colors="colors" :items="legendItems" :index="index" :categories="props.categories" :custom-tooltip="customTooltip" />

      <template v-for="(category, i) in categories" :key="category">
        <VisLine
          :x="(d: Data, i: number) => i"
          :y="(d: Data) => d[category]"
          :curve-type="curveType"
          :color="colors[i]"
          :attributes="{
            [Line.selectors.line]: {
              opacity: legendItems[i]?.inactive ? filterOpacity : 1,
            },
          }"
        />
      </template>

      <VisAxis
        v-if="showXAxis"
        type="x"
        :tick-format="xFormatter ?? ((v: number) => data[v]?.[index])"
        :grid-line="false"
        :tick-line="false"
        tick-text-color="var(--vis-text-color)"
      />
      <VisAxis
        v-if="showYAxis"
        type="y"
        :tick-line="false"
        :tick-format="yFormatter"
        :domain-line="false"
        :grid-line="showGridLine"
        :attributes="{
          [Axis.selectors.grid]: {
            class: 'text-muted',
          },
        }"
        tick-text-color="var(--vis-text-color)"
      />

      <slot />
    </VisXYContainer>
  </div>
</template>
