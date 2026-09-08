<script setup lang="ts">
const { showActionNeeded, unreadFilter, assignedToMeFilter, activeStayFilter } = useInbox()

onMounted(() => {
  showActionNeeded.value = false
  unreadFilter.value = false
  assignedToMeFilter.value = false
  activeStayFilter.value = 'all'
})
</script>

<template>
  <!--
    `h-full` rather than a viewport calc: the layout column is a definite height
    already, and a fixed `100dvh` minus a guess cannot know about the billing alert
    or a broadcast banner, so it overshot and pushed the panels past the fold.
  -->
  <div class="-m-4 lg:-m-6 h-full overflow-hidden">
    <ClientOnly>
      <InboxLayout
        :default-layout="[18, 25, 42, 15]"
        :default-collapsed="false"
        :nav-collapsed-size="4"
      />
    </ClientOnly>
  </div>
</template>
