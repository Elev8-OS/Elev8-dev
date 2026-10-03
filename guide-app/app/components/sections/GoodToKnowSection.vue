<script setup lang="ts">
import ExpandableText from '~/../app/components/shared/ExpandableText.vue'
// Practical tips from the listing of the stay (the dashboard's listing Guest
// Guide tab), sent by the guide endpoint as `guideContent.good_to_know`.
interface GoodToKnowItem {
  id: string
  title: string
  text?: string
  icon?: string
  photoUrl?: string
}

const props = defineProps<{
  data: Record<string, unknown>
  listing?: unknown
  content?: GoodToKnowItem[]
  token?: string
}>()

const items = computed(() => props.content ?? [])

const { translate } = useAutoTranslate()
</script>

<template>
  <section v-if="items.length" class="rounded-xl border bg-card p-6">
    <div class="mb-4 flex items-center gap-3">
      <div class="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon name="lucide:info" class="size-5" />
      </div>
      <h2 class="text-xl font-semibold">
        {{ translate('Good to know') }}
      </h2>
    </div>
    <!-- One row per tip, like the check-in steps: a photo only grows its own row. -->
    <ul class="divide-y">
      <li v-for="item in items" :key="item.id" class="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
        <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon :name="item.icon || 'lucide:info'" class="size-5" />
        </span>
        <div class="min-w-0 flex-1">
          <p class="font-medium">
            {{ translate(item.title) }}
          </p>
          <ExpandableText
            v-if="item.text"
            :html="item.text"
            class="mt-0.5 text-sm text-muted-foreground"
          />
        </div>
        <img v-if="item.photoUrl" :src="item.photoUrl" alt="" class="aspect-[4/3] w-24 shrink-0 rounded-lg border object-cover sm:w-32">
      </li>
    </ul>
  </section>
</template>
