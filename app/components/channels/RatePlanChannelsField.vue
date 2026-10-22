<script setup lang="ts">
import { computed } from 'vue'
import { CHANNELS } from './data/channels'

/**
 * Which channels a rate plan sells on (NextPax `applicableChannels`), inside
 * the listing's rate plan sheets. No channel ticked means every channel. A plan
 * that sells on one channel only is also how that channel gets its own
 * cancellation policy: give the plan its own policy below.
 */
defineProps<{ code?: string }>()

const channels = defineModel<string[] | undefined>('channels', { default: undefined })

const all = computed(() => !channels.value?.length)

function toggle(name: string) {
  const current = channels.value ?? []
  channels.value = current.includes(name) ? current.filter(c => c !== name) : [...current, name]
}
</script>

<template>
  <div class="space-y-2">
    <div class="flex items-center justify-between gap-2">
      <Label>Sells on</Label>
      <span class="text-[11px] text-muted-foreground">
        {{ code ? `Channel code ${code}` : 'Channel code given on save' }}
      </span>
    </div>
    <div class="flex flex-col gap-1 rounded-lg border p-2" role="group" aria-label="Channels this rate plan sells on">
      <div
        role="checkbox"
        tabindex="0"
        :aria-checked="all"
        class="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/60"
        @click="channels = []"
        @keydown.space.prevent="channels = []"
      >
        <div class="flex size-4 items-center justify-center rounded-[4px] border" :class="all ? 'border-primary bg-primary text-primary-foreground' : 'border-input'">
          <Icon v-if="all" name="lucide:check" class="size-3" />
        </div>
        <span>All channels</span>
      </div>
      <div
        v-for="channel in CHANNELS"
        :key="channel.name"
        role="checkbox"
        tabindex="0"
        :aria-checked="!all && channels!.includes(channel.name)"
        class="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/60"
        @click="toggle(channel.name)"
        @keydown.space.prevent="toggle(channel.name)"
      >
        <div
          class="flex size-4 items-center justify-center rounded-[4px] border"
          :class="!all && channels!.includes(channel.name) ? 'border-primary bg-primary text-primary-foreground' : 'border-input'"
        >
          <Icon v-if="!all && channels!.includes(channel.name)" name="lucide:check" class="size-3" />
        </div>
        <Icon :name="channel.icon" class="size-4" aria-hidden="true" />
        <span>{{ channel.name }}</span>
      </div>
    </div>
    <p class="text-[11px] text-muted-foreground">
      For a different cancellation policy on one channel, make a plan that sells only there and give it its own policy.
    </p>
  </div>
</template>
