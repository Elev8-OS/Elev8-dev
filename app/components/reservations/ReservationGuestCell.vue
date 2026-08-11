<script setup lang="ts">
interface Props {
  name: string
  email: string
}

defineProps<Props>()

function initials(name: string): string {
  return name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()
}
</script>

<template>
  <div class="flex items-center gap-3">
    <Avatar class="size-9">
      <AvatarFallback class="bg-primary/10 text-primary text-xs">
        {{ initials(name) }}
      </AvatarFallback>
    </Avatar>
    <div class="min-w-0">
      <p class="text-sm font-medium truncate">
        {{ name }}
      </p>
      <p class="text-xs text-muted-foreground truncate">
        {{ email }}
      </p>
    </div>
  </div>
</template>
