<script setup lang="ts">
import type { GuideSection } from '../data/types'
import AmenitiesSectionEditor from './sections/AmenitiesSectionEditor.vue'
import CheckinSectionEditor from './sections/CheckinSectionEditor.vue'
import CheckoutSectionEditor from './sections/CheckoutSectionEditor.vue'
import CustomRichSectionEditor from './sections/CustomRichSectionEditor.vue'
import DocumentsSectionEditor from './sections/DocumentsSectionEditor.vue'
import GoodToKnowSectionEditor from './sections/GoodToKnowSectionEditor.vue'
import HeroSectionEditor from './sections/HeroSectionEditor.vue'
import HouseRulesSectionEditor from './sections/HouseRulesSectionEditor.vue'
import LocalTipsSectionEditor from './sections/LocalTipsSectionEditor.vue'
import PreArrivalSectionEditor from './sections/PreArrivalSectionEditor.vue'
import SmartLockSectionEditor from './sections/SmartLockSectionEditor.vue'
import UpsellsSectionEditor from './sections/UpsellsSectionEditor.vue'
import WelcomeSectionEditor from './sections/WelcomeSectionEditor.vue'
import WifiSectionEditor from './sections/WifiSectionEditor.vue'

const props = defineProps<{ section: GuideSection }>()
const emit = defineEmits<{ update: [data: Record<string, any>] }>()

const editorMap = {
  hero: HeroSectionEditor,
  welcome: WelcomeSectionEditor,
  checkin: CheckinSectionEditor,
  checkout: CheckoutSectionEditor,
  house_rules: HouseRulesSectionEditor,
  good_to_know: GoodToKnowSectionEditor,
  amenities: AmenitiesSectionEditor,
  wifi: WifiSectionEditor,
  local_tips: LocalTipsSectionEditor,
  documents: DocumentsSectionEditor,
  upsells: UpsellsSectionEditor,
  smart_lock: SmartLockSectionEditor,
  pre_arrival: PreArrivalSectionEditor,
  custom_rich: CustomRichSectionEditor,
}
</script>

<template>
  <component
    :is="editorMap[section.type]"
    :model-value="section.data"
    @update:model-value="(v: Record<string, any>) => $emit('update', v)"
  />
</template>
