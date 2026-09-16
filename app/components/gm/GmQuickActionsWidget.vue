<script setup lang="ts">
const shortcuts = [
  {
    title: 'Operations Calendar',
    description: 'Weekly housekeeping & guest turns',
    to: '/operations-calendar',
    icon: 'lucide:calendar-days',
    color: 'text-blue-600 dark:text-blue-400 bg-blue-500/10',
  },
  {
    title: 'Guest Inbox',
    description: 'Urgent guest messages & ElevAI',
    to: '/inbox',
    icon: 'lucide:message-square',
    color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-500/10',
  },
  {
    title: 'Key Management',
    description: 'Physical keys, lockboxes & custody',
    to: '/key-management',
    icon: 'lucide:key-round',
    color: 'text-amber-600 dark:text-amber-400 bg-amber-500/10',
  },
  {
    title: 'Listings & Rates',
    description: 'Pricing plans, channels & units',
    to: '/listings',
    icon: 'lucide:building-2',
    color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10',
  },
]
</script>

<template>
  <Card class="flex h-full flex-col justify-between">
    <CardHeader>
      <CardTitle class="flex items-center gap-2">
        <Icon name="lucide:compass" class="size-4 text-primary" />
        Quick navigation
      </CardTitle>
      <CardDescription>
        Direct manager access to core operational modules
      </CardDescription>
    </CardHeader>

    <CardContent>
      <div class="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <NuxtLink
          v-for="item in shortcuts"
          :key="item.to"
          :to="item.to"
          class="group flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent/50 hover:border-accent"
        >
          <div class="flex size-9 shrink-0 items-center justify-center rounded-md" :class="[item.color]">
            <Icon :name="item.icon" class="size-4" />
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1 font-medium text-sm leading-none group-hover:text-primary">
              <span class="truncate">{{ item.title }}</span>
              <Icon name="lucide:chevron-right" class="size-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
            <p class="mt-1 truncate text-xs text-muted-foreground">
              {{ item.description }}
            </p>
          </div>
        </NuxtLink>
      </div>
    </CardContent>
  </Card>
</template>
