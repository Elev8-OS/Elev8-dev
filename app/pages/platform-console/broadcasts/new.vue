<script setup lang="ts">
import { Button } from '~/components/ui/button'

definePageMeta({ layout: 'platform-console' })

const router = useRouter()
</script>

<template>
  <div class="space-y-4 p-6">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 class="text-2xl font-semibold tracking-tight">New broadcast</h2>
        <p class="text-sm text-muted-foreground">Write it, pick the tenants, set the timing, and check the preview.</p>
      </div>
      <Button variant="ghost" size="sm" @click="router.push('/platform-console/broadcasts')">
        <Icon name="lucide:arrow-left" class="mr-1.5 size-4" />
        Back to broadcasts
      </Button>
    </div>
    <PlatformConsoleBannerComposer @published="router.push('/platform-console/broadcasts')" />
  </div>
</template>
