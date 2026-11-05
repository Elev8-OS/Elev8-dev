<script setup lang="ts">
import { usePlatformBanners } from '~/composables/usePlatformBanners'
import { useBannerViewer } from '~/composables/useBannerViewer'

const { tenantId, role } = useBannerViewer()
const { liveBannersForTenant, dismiss } = usePlatformBanners()

const banners = computed(() => liveBannersForTenant(tenantId, role))
const hiddenCount = computed(() => liveBannersForTenant(tenantId, role, Infinity).length - banners.value.length)

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
    <NuxtLink
      v-if="hiddenCount > 0"
      to="/announcements"
      class="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
      data-testid="banner-more-link"
    >
      {{ hiddenCount }} more {{ hiddenCount === 1 ? 'announcement' : 'announcements' }}
      <Icon name="lucide:arrow-right" class="size-3" />
    </NuxtLink>
  </div>
</template>
