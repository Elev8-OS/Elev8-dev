<script setup lang="ts">
const links = [
  { label: 'Overview', to: '/owner-portal', icon: 'lucide:layout-dashboard' },
  { label: 'Statements', to: '/owner-portal/statements', icon: 'lucide:file-text' },
  { label: 'My Stays', to: '/owner-portal/stays', icon: 'lucide:calendar-days' },
  { label: 'Documents', to: '/owner-portal/documents', icon: 'lucide:folder-open' },
  { label: 'Maintenance', to: '/owner-portal/maintenance', icon: 'lucide:wrench' },
]

const route = useRoute()

function isActive(to: string) {
  return to === '/owner-portal'
    ? route.path === to
    : route.path.startsWith(to)
}
</script>

<template>
  <nav aria-label="Owner portal navigation" class="space-y-1">
    <NuxtLink
      v-for="link in links"
      :key="link.to"
      :to="link.to"
      class="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors"
      :class="isActive(link.to)
        ? 'bg-primary text-primary-foreground'
        : 'text-muted-foreground hover:bg-muted hover:text-foreground'"
      :aria-current="isActive(link.to) ? 'page' : undefined"
    >
      <Icon :name="link.icon" class="size-4" aria-hidden="true" />
      {{ link.label }}
    </NuxtLink>
  </nav>
</template>
