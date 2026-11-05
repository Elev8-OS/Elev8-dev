<script setup lang="ts">
import { usePlatformBanners } from '~/composables/usePlatformBanners'
import { useBannerViewer } from '~/composables/useBannerViewer'

const { tenantId, role } = useBannerViewer()
const { liveBannersForTenant, dismiss } = usePlatformBanners()

const banners = computed(() => liveBannersForTenant(tenantId, role))

function dismissBanner(id: string) {
  dismiss(id, tenantId)
}
</script>

<template>
  <div v-if="banners.length" class="space-y-2 px-6 pt-4">
    <PlatformConsoleBannerCard
      v-for="b in banners"
      :key="b.id"
      :banner="b"
      :on-dismiss="() => dismissBanner(b.id)"
    />
  </div>
</template>
