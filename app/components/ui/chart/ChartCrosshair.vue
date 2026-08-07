<script setup lang="ts">
import type { BulletLegendItemInterface } from '@unovis/ts'
import type { Component } from 'vue'
import { omit } from '@unovis/ts'
import { VisCrosshair, VisTooltip } from '@unovis/vue'
import { createApp } from 'vue'
import { ChartTooltip } from '.'

const props = withDefaults(defineProps<{
  colors?: string[]
  index: string
  items: BulletLegendItemInterface[]
  customTooltip?: Component
  /** Restrict tooltip rows to these data keys (in order). Defaults to all keys except index. */
  categories?: string[]
}>(), {
  colors: () => [],
  categories: () => [],
})

// Use weakmap to store reference to each datapoint for Tooltip
const wm = new WeakMap()
function template(d: any) {
  if (wm.has(d)) {
    return wm.get(d)
  }
  else {
    const componentDiv = document.createElement('div')
    const keys = props.categories.length > 0
      ? props.categories
      : Object.keys(omit(d, [props.index]))
    const omittedData = keys.map((key, i) => {
      // Match legend items by index so renamed labels ("This year", etc.) show correctly
      const legendReference = props.items[i]
      return { ...legendReference, name: legendReference?.name ?? key, value: d[key] }
    })
    const TooltipComponent = props.customTooltip ?? ChartTooltip
    createApp(TooltipComponent, { title: d[props.index].toString(), data: omittedData }).mount(componentDiv)
    wm.set(d, componentDiv.innerHTML)
    return componentDiv.innerHTML
  }
}

function color(d: unknown, i: number) {
  return props.colors[i] ?? 'transparent'
}
</script>

<template>
  <VisTooltip :horizontal-shift="20" :vertical-shift="20" />
  <VisCrosshair :template="template" :color="color" />
</template>
