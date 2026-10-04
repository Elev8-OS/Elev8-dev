<script setup lang="ts">
import ExpandableText from '~/../app/components/shared/ExpandableText.vue'
/**
 * Numbered steps with optional photos, for the check-in and check-out
 * sections. The steps come from the listing of the stay (the dashboard's
 * listing Guest Guide tab), sent by the guide endpoint as `guideContent`.
 */
export interface GuideStep {
  id: string
  title: string
  text?: string
  photoUrl?: string
  /** Set on a step only for the guest's room ("Your room: Master Suite"). */
  roomName?: string
}

defineProps<{ steps: GuideStep[] }>()

const { translate } = useAutoTranslate()
</script>

<template>
  <ol class="space-y-4">
    <template v-for="(step, i) in steps" :key="step.id">
      <!-- The guest's room's own steps follow the property's, under its name. -->
      <li v-if="step.roomName && step.roomName !== steps[i - 1]?.roomName" class="flex items-center gap-2 pt-2 text-sm font-semibold" data-testid="guide-room-heading">
        <Icon name="lucide:door-closed" class="size-4 text-muted-foreground" />
        Your room: {{ step.roomName }}
      </li>
      <li class="flex gap-3">
        <span class="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">{{ i + 1 }}</span>
        <div class="min-w-0 flex-1 space-y-2">
          <p class="font-medium">
            {{ translate(step.title) }}
          </p>
          <ExpandableText
            v-if="step.text"
            :html="step.text"
            class="text-sm leading-relaxed text-muted-foreground"
          />
          <img v-if="step.photoUrl" :src="step.photoUrl" alt="" class="aspect-video w-full rounded-lg border object-cover">
        </div>
      </li>
    </template>
  </ol>
</template>
