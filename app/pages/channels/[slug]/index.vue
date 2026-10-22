<script setup lang="ts">
import { computed } from 'vue'
import ChannelManage from '~/components/channels/ChannelManage.vue'
import { getChannelBySlug } from '~/components/channels/data/channels'

definePageMeta({ layout: 'default' })

const route = useRoute()
const channel = computed(() => getChannelBySlug(String(route.params.slug)))
</script>

<template>
  <ChannelManage v-if="channel" :key="channel.name" :channel="channel" />
  <div v-else class="flex flex-col items-start gap-3">
    <p class="text-sm text-muted-foreground">
      There is no channel called "{{ route.params.slug }}".
    </p>
    <Button variant="outline" as-child>
      <NuxtLink to="/channels">
        Back to Channels
      </NuxtLink>
    </Button>
  </div>
</template>
