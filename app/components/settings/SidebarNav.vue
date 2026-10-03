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
      { title: 'Billing', href: '/settings/billing' },
    ],
  },
  {
    label: 'Booking & Payments',
    items: [
      { title: 'Fees & Taxes', href: '/settings/fees-taxes' },
      { title: 'Cancellation Policies', href: '/settings/cancellation-policies' },
      { title: 'Damage Protection', href: '/settings/damage-protection' },
      { title: 'Payouts', href: '/settings/payouts' },
      { title: 'Invoice Templates', href: '/settings/invoice-templates' },
    ],
  },
  {
    label: 'Guest Guide',
    items: [
      { title: 'Content Templates', href: '/settings/guide-templates' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { title: 'Cleaning Templates', href: '/settings/cleaning-templates' },
      { title: 'Guidance', href: '/settings/guidance' },
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
            'w-auto shrink-0 whitespace-nowrap text-left justify-start items-start lg:w-full',
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
