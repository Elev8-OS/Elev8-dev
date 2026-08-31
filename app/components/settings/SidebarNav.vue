<script setup lang="ts">
import { cn } from '@/lib/utils'

interface Item {
  title: string
  href: string
}

interface Section {
  label: string
  items: Item[]
}

const route = useRoute()

const sections: Section[] = [
  {
    label: 'Account',
    items: [
      { title: 'Profile', href: '/settings/profile' },
      { title: 'Account', href: '/settings/account' },
    ],
  },
  {
    label: 'Booking & Payments',
    items: [
      { title: 'Fees & Taxes', href: '/settings/fees-taxes' },
      { title: 'Cancellation Policies', href: '/settings/cancellation-policies' },
      { title: 'Payouts', href: '/settings/payouts' },
    ],
  },
  {
    label: 'Integrations',
    items: [
      { title: 'Integrations', href: '/settings/integrations' },
    ],
  },
  {
    label: 'Appearance',
    items: [
      { title: 'Appearance', href: '/settings/appearance' },
      { title: 'Branding', href: '/settings/branding' },
      { title: 'Display', href: '/settings/display' },
    ],
  },
  {
    label: 'Notifications',
    items: [
      { title: 'Notifications', href: '/settings/notifications' },
    ],
  },
]
</script>

<template>
  <nav class="flex lg:flex-col lg:space-y-6">
    <div
      v-for="section in sections"
      :key="section.label"
      class="flex flex-col gap-1 lg:gap-1.5"
    >
      <p class="hidden px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground lg:block">
        {{ section.label }}
      </p>
      <div class="flex lg:flex-col space-x-2 lg:space-x-0 lg:space-y-1">
        <Button
          v-for="item in section.items"
          :key="item.href"
          variant="ghost"
          :class="cn(
            'w-full text-left justify-start items-start',
            route.path === item.href && 'bg-muted hover:bg-muted',
          )"
          as-child
        >
          <NuxtLink :to="item.href">
            {{ item.title }}
          </NuxtLink>
        </Button>
      </div>
    </div>
  </nav>
</template>
